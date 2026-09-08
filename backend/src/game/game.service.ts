import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { performance } from 'perf_hooks';
import { JoinGameDto } from './dto/join-game.dto';
import { AuthSocket } from './game.middleware';
import { Room } from './interface/room.state';
import { MatchService } from '../user/match.service';
import { UserService } from '../user/user.service';
import { SpecData } from './interface/spec.data';
import { createSeededRng, Side } from '../../../shared/game-core';
import { Snapshot } from '../../../shared/protocol';
import { ServerMatchRunner } from './server-match-runner';

export const GAME_CLOCK = Symbol('GAME_CLOCK');
export const RECONNECT_GRACE_MS = 5000;
const MAX_SAVE_ATTEMPTS = 3;
type Session = { socket: AuthSocket; generation: number };
type Binding = { roomId: string; side: Side };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const userId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

@Injectable()
export class GameService implements OnModuleDestroy {
  private rooms = new Map<string, Room>();
  private waitList: SpecData[] = [];
  private inviteList: { from: AuthSocket; to: number; mode: boolean }[] = [];
  private userList: AuthSocket[] = [];
  private sessions = new Map<number, Session>();
  private bindings = new Map<AuthSocket, Binding>();
  private matchByUser = new Map<number, Binding>();
  private watching = new Map<AuthSocket, string>();
  private reservations = new Map<number, AuthSocket>();
  private generation = 0;
  private failedResults: Array<{
    roomId: string;
    winner: Side | null;
    reason: string;
    leftScore: number;
    rightScore: number;
    attempts: number;
    cleanup?: string;
  }> = [];

  constructor(
    @Inject(MatchService) private readonly matchService: MatchService,
    @Inject(UserService) private readonly userService: UserService,
    @Optional()
    @Inject(GAME_CLOCK)
    private readonly now: () => number = () => performance.now(),
  ) {}

  private current(socket: AuthSocket): boolean {
    return this.sessions.get(socket.user.id)?.socket === socket;
  }

  private busy(socket: AuthSocket): boolean {
    return (
      this.matchByUser.has(socket.user.id) ||
      this.reservations.has(socket.user.id)
    );
  }

  private error(socket: AuthSocket, message: string): void {
    socket.emit('error', { message });
  }

  async addUser(socket: AuthSocket): Promise<void> {
    const previous = this.sessions.get(socket.user.id);
    if (previous?.socket === socket) return;
    // An active authenticated connection keeps control; only a disconnected
    // owner's account may resume its reserved paddle during the grace period.
    if (previous) {
      this.error(
        socket,
        '이미 연결된 게임 세션이 있습니다. 기존 탭을 닫고 다시 연결해 주세요.',
      );
      socket.disconnect(true);
      return;
    }
    this.sessions.set(socket.user.id, {
      socket,
      generation: ++this.generation,
    });
    this.userList.push(socket);
    const binding = this.matchByUser.get(socket.user.id);
    const room = binding && this.rooms.get(binding.roomId);
    const disconnected = room?.offline.get(binding.side);
    if (!room || room.persistence !== 'active' || !disconnected) return;
    if (this.now() >= disconnected.expiresAt) {
      void this.finalizeMatch(
        room,
        binding.side === 'left' ? 'right' : 'left',
        'disconnect',
      );
      this.error(socket, '재접속 유예 시간이 만료되었습니다.');
      return;
    }
    room.players[binding.side === 'left' ? 0 : 1] = socket;
    this.bindings.set(socket, binding);
    room.offline.delete(binding.side);
    room.runner.replaceInput(
      binding.side,
      this.sessions.get(socket.user.id).generation,
    );
    if (room.offline.size === 0) {
      // Both render buffers and input sequences start a new ownership epoch.
      // This also avoids a held-input sequence jump after a long pause.
      for (const side of ['left', 'right'] as Side[]) {
        const player = room.players[side === 'left' ? 0 : 1];
        const session = this.sessions.get(player.user.id);
        session.generation = ++this.generation;
        room.runner.replaceInput(side, session.generation);
      }
      room.runner.start(this.now());
      const snapshot = room.runner.snapshot();
      room.players.forEach((player, index) =>
        player.emit(
          'ready',
          this.ready(room, player, index === 0 ? 'left' : 'right', snapshot),
        ),
      );
      for (const spectator of room.spectators) {
        const session = this.sessions.get(spectator.user.id);
        if (session?.socket !== spectator) continue;
        session.generation = ++this.generation;
        spectator.emit('setData', {
          ...this.ready(room, spectator, 'spectator', snapshot),
          leftScore: room.runner.state.players.left.score,
          rightScore: room.runner.state.players.right.score,
        });
      }
      this.broadcast(room, 'sessionStatus', {
        roomId: room.roomIndex,
        status: 'active',
      });
      this.broadcast(room, 'snapshot', snapshot);
    } else {
      socket.emit('ready', this.ready(room, socket, binding.side));
      socket.emit('sessionStatus', {
        roomId: room.roomIndex,
        status: 'waiting',
        graceMs: RECONNECT_GRACE_MS,
      });
    }
  }

  async deleteUser(socket: AuthSocket): Promise<void> {
    const index = this.userList.indexOf(socket);
    if (index !== -1) this.userList.splice(index, 1);
    if (this.current(socket)) this.sessions.delete(socket.user.id);
  }

  async deleteInviteList(client: AuthSocket): Promise<void> {
    const index = this.inviteList.findIndex(
      (invitation) => invitation.to === client.user.id,
    );
    if (index !== -1) this.inviteList.splice(index, 1);
  }

  async invite(client: AuthSocket, data: JoinGameDto): Promise<void> {
    if (
      !this.current(client) ||
      !object(data) ||
      !userId(data.friendId) ||
      typeof data.mode !== 'boolean'
    )
      return;
    if (data.friendId === client.user.id)
      return this.error(client, '자신은 초대할 수 없습니다.');
    const friend = this.sessions.get(data.friendId)?.socket;
    if (!friend) return this.error(client, '연결된 친구를 찾을 수 없습니다.');
    if (this.busy(client) || this.busy(friend))
      return this.error(client, '이미 게임 또는 매칭 중인 유저입니다.');
    if (this.inviteList.some((invitation) => invitation.from === client)) {
      return this.error(client, '이미 초대를 진행중입니다.');
    }
    this.removeWaiting(client);
    this.inviteList.push({ from: client, to: friend.user.id, mode: data.mode });
    friend.emit('invited', {
      friendId: client.user.id,
      friendName: client.user.name,
    });
    client.emit('invite');
  }

  async refuse(client: AuthSocket, data: unknown): Promise<void> {
    if (!this.current(client)) return;
    const friendId =
      typeof data === 'number'
        ? data
        : object(data)
        ? data.friendId
        : undefined;
    if (!userId(friendId))
      return this.error(client, '거절할 초대자를 확인할 수 없습니다.');
    const index = this.inviteList.findIndex(
      (invitation) =>
        invitation.to === client.user.id &&
        invitation.from.user.id === friendId,
    );
    if (index === -1) return this.error(client, '존재하지 않는 초대입니다.');
    const [invitation] = this.inviteList.splice(index, 1);
    client.emit('refuse');
    invitation.from.emit('refuse');
  }

  async userInviteList(client: AuthSocket): Promise<void> {
    if (!this.current(client)) return;
    client.emit('userInviteList', {
      userInviteList: this.inviteList
        .filter((invitation) => invitation.to === client.user.id)
        .map((invitation) => ({
          inviteId: invitation.from.user.id,
          inviteName: invitation.from.user.nickname,
        })),
    });
  }

  private removeWaiting(client: AuthSocket): void {
    const index = this.waitList.findIndex((entry) => entry.socket === client);
    if (index !== -1) this.waitList.splice(index, 1);
  }

  async joinMatch(client: AuthSocket, data: JoinGameDto): Promise<void> {
    if (
      !this.current(client) ||
      !object(data) ||
      typeof data.mode !== 'boolean' ||
      this.busy(client)
    )
      return;
    if (this.waitList.some((entry) => entry.socket === client)) return;
    let other: SpecData | undefined;
    while (this.waitList.length && !other) {
      const candidate = this.waitList.pop();
      if (this.current(candidate.socket) && !this.busy(candidate.socket))
        other = candidate;
    }
    if (!other) {
      this.waitList.push({ socket: client, mode: data.mode });
      return;
    }
    await this.publishMatch(other, client, data.mode);
  }

  async joinToFriend(client: AuthSocket, friendId: number): Promise<void> {
    if (!this.current(client) || !userId(friendId) || this.busy(client)) return;
    const index = this.inviteList.findIndex(
      (invitation) =>
        invitation.to === client.user.id &&
        invitation.from.user.id === friendId,
    );
    if (index === -1)
      return this.error(client, '친구 초대를 찾을 수 없습니다.');
    const invitation = this.inviteList[index];
    if (!this.current(invitation.from) || this.busy(invitation.from))
      return this.error(client, '이미 플레이 중인 유저입니다.');
    this.inviteList.splice(index, 1);
    await this.publishMatch(
      { socket: invitation.from, mode: invitation.mode },
      client,
      invitation.mode,
    );
  }

  private async publishMatch(
    other: SpecData,
    client: AuthSocket,
    mode: boolean,
  ): Promise<void> {
    const players = [other.socket, client];
    for (const player of players) {
      this.reservations.set(player.user.id, player);
      this.removeWaiting(player);
      this.leaveSpectator(player);
    }
    try {
      const saved = await this.matchService.create(
        other.socket.user,
        client.user,
      );
      if (!saved || !userId(saved.id))
        throw new Error('Persistence returned no match id');
      const id = String(saved.id);
      if (
        players.some(
          (player) =>
            !this.current(player) ||
            this.reservations.get(player.user.id) !== player,
        )
      ) {
        // This is only the new, unpublished, unfinished row created above.
        await this.matchService.delete(id);
        throw new Error('A participant disconnected while reserving the match');
      }
      const room = this.createRoom(id, other, client, mode);
      this.rooms.set(id, room);
      this.bindings.set(other.socket, { roomId: id, side: 'left' });
      this.bindings.set(client, { roomId: id, side: 'right' });
      this.matchByUser.set(other.socket.user.id, { roomId: id, side: 'left' });
      this.matchByUser.set(client.user.id, { roomId: id, side: 'right' });
      this.inviteList = this.inviteList.filter(
        (invitation) =>
          !players.some(
            (player) =>
              invitation.from === player || invitation.to === player.user.id,
          ),
      );
      const snapshot = room.runner.snapshot();
      other.socket.emit(
        'ready',
        this.ready(room, other.socket, 'left', snapshot),
      );
      client.emit('ready', this.ready(room, client, 'right', snapshot));
    } catch {
      for (const player of players)
        if (this.current(player))
          this.error(player, '매칭에 실패하였습니다. 다시 시도해 주세요.');
    } finally {
      for (const player of players) {
        if (this.reservations.get(player.user.id) === player)
          this.reservations.delete(player.user.id);
      }
    }
  }

  createRoom(
    roomIndex: string,
    other: SpecData,
    user2: AuthSocket,
    mode: boolean,
  ): Room {
    const power = other.mode === true && mode === true;
    const runner = new ServerMatchRunner(
      roomIndex,
      power,
      {
        left: this.sessions.get(other.socket.user.id)?.generation || 1,
        right: this.sessions.get(user2.user.id)?.generation || 1,
      },
      this.now(),
      createSeededRng(Number(roomIndex)),
    );
    return new Room(roomIndex, power, [other.socket, user2], runner);
  }

  private ready(
    room: Room,
    client: AuthSocket,
    side: Side | 'spectator',
    snapshot: Snapshot = room.runner.snapshot(),
  ) {
    return {
      v: 1,
      roomId: room.roomIndex,
      leftName: room.players[0].user.nickname,
      rightName: room.players[1].user.nickname,
      roomMode: room.gameMode,
      side,
      generation: this.sessions.get(client.user.id).generation,
      snapshot,
    };
  }

  async spectatorList(client: AuthSocket): Promise<void> {
    if (!this.current(client)) return;
    client.emit(
      'roomlist',
      Array.from(this.rooms.values())
        .filter((room) => room.persistence === 'active')
        .map((room) => ({
          roomId: room.roomIndex,
          leftName: room.players[0].user.nickname,
          rightName: room.players[1].user.nickname,
        })),
    );
  }

  listenKeyEvent(client: AuthSocket, payload: unknown): boolean {
    const binding = this.bindings.get(client);
    if (!this.current(client) || !binding) return false;
    const room = this.rooms.get(binding.roomId);
    if (!room || room.persistence !== 'active') return false;
    if (room.offline.size)
      return room.runner.receiveWhilePaused(binding.side, payload, this.now());
    return room.runner.receive(binding.side, payload, this.now());
  }

  private leaveSpectator(client: AuthSocket): void {
    const id = this.watching.get(client);
    if (id) this.rooms.get(id)?.removeSpectator(client);
    this.watching.delete(client);
  }

  async spectate(client: AuthSocket, data: unknown): Promise<void> {
    if (
      !this.current(client) ||
      this.busy(client) ||
      !object(data) ||
      typeof data.id !== 'string' ||
      !/^[1-9][0-9]{0,15}$/.test(data.id)
    )
      return;
    try {
      const room = this.rooms.get(data.id);
      if (room && room.persistence === 'active') {
        this.removeWaiting(client);
        this.leaveSpectator(client);
        room.spectators.push(client);
        this.watching.set(client, room.roomIndex);
        client.emit('setData', {
          ...this.ready(room, client, 'spectator'),
          leftScore: room.runner.state.players.left.score,
          rightScore: room.runner.state.players.right.score,
        });
        if (room.offline.size)
          client.emit('sessionStatus', {
            roomId: room.roomIndex,
            status: 'waiting',
            graceMs: RECONNECT_GRACE_MS,
          });
      } else {
        const match = await this.matchService.getOne(data.id);
        if (!match?.winner || !match.loser)
          return this.error(client, '완료된 경기 정보를 찾을 수 없습니다.');
        client.emit('finish', {
          leftName: match.winner.nickname,
          rightName: match.loser.nickname,
          leftScore: match.winnerScore,
          rightScore: match.loserScore,
        });
        client.emit('end', 'left');
      }
    } catch {
      this.error(client, '관전 정보를 가져올 수 없습니다.');
    }
  }

  async achievement(client: AuthSocket): Promise<void> {
    // Retain the old event as an inert compatibility boundary. Results and
    // achievements now commit atomically in MatchService, never from a client.
    if (!this.current(client)) return;
  }

  private broadcast(room: Room, event: string, payload: unknown): void {
    for (const socket of [...room.players, ...room.spectators])
      socket.emit(event, payload);
  }

  async dropUser(client: AuthSocket, disconnected = false): Promise<void> {
    const owned = this.current(client);
    this.removeWaiting(client);
    this.leaveSpectator(client);
    this.inviteList = this.inviteList.filter(
      (invitation) =>
        invitation.from !== client &&
        !(owned && invitation.to === client.user.id),
    );
    if (this.reservations.get(client.user.id) === client)
      this.reservations.delete(client.user.id);
    if (disconnected) await this.deleteUser(client);
    const binding = this.bindings.get(client);
    if (!owned || !binding) return;
    const room = this.rooms.get(binding.roomId);
    if (!room) return;
    if (disconnected && room.persistence === 'active') {
      this.bindings.delete(client);
      room.offline.set(binding.side, {
        expiresAt: this.now() + RECONNECT_GRACE_MS,
        generation: room.runner.generations[binding.side],
      });
      room.runner.stop();
      this.broadcast(room, 'snapshot', room.runner.snapshot());
      this.broadcast(room, 'sessionStatus', {
        roomId: room.roomIndex,
        status: 'waiting',
        side: binding.side,
        graceMs: RECONNECT_GRACE_MS,
      });
      return;
    }
    await this.finalizeMatch(
      room,
      binding.side === 'left' ? 'right' : 'left',
      disconnected ? 'disconnect' : 'forfeit',
    );
  }

  private finalizeMatch(
    room: Room,
    winner: Side,
    reason: 'score' | 'forfeit' | 'disconnect',
  ): Promise<void> {
    if (room.persistence !== 'active')
      return room.completion || Promise.resolve();
    // Reserve synchronously, before the first persistence await. The fixed loop
    // and disconnect handler can never start two finalizations for this room.
    room.persistence = 'saving';
    room.result = { winner, reason };
    room.runner.stop();
    this.broadcast(room, 'snapshot', room.runner.snapshot());
    return this.persistResult(room);
  }

  private releaseRoom(room: Room): void {
    this.rooms.delete(room.roomIndex);
    room.runner.dispose();
    for (const player of room.players) {
      this.bindings.delete(player);
      if (this.matchByUser.get(player.user.id)?.roomId === room.roomIndex)
        this.matchByUser.delete(player.user.id);
    }
    for (const spectator of room.spectators) this.watching.delete(spectator);
    room.spectators.length = 0;
    room.offline.clear();
  }

  private persistResult(room: Room): Promise<void> {
    room.persistence = 'saving';
    room.attempts++;
    const { winner, reason } = room.result;
    const winnerIndex = winner === 'left' ? 0 : 1;
    const loser = winner === 'left' ? 'right' : 'left';
    room.completion = (async () => {
      try {
        await this.matchService.update(room.roomIndex, {
          winner: room.players[winnerIndex].user,
          loser: room.players[1 - winnerIndex].user,
          winnerScore: room.runner.state.players[winner].score,
          loserScore: room.runner.state.players[loser].score,
        });
        room.persistence = 'saved';
        this.broadcast(room, 'resultStatus', {
          roomId: room.roomIndex,
          status: 'saved',
          winner,
          reason,
          attempt: room.attempts,
        });
        this.broadcast(room, 'end', winner);
        this.releaseRoom(room);
      } catch {
        room.persistence = 'failed';
        if (room.attempts < MAX_SAVE_ATTEMPTS) {
          const retryInMs = room.attempts === 1 ? 250 : 1000;
          room.retryAt = this.now() + retryInMs;
          this.broadcast(room, 'resultStatus', {
            roomId: room.roomIndex,
            status: 'retrying',
            winner,
            reason,
            attempt: room.attempts,
            retryInMs,
          });
        } else {
          this.failedResults.push({
            roomId: room.roomIndex,
            winner,
            reason,
            leftScore: room.runner.state.players.left.score,
            rightScore: room.runner.state.players.right.score,
            attempts: room.attempts,
          });
          if (this.failedResults.length > 100) this.failedResults.shift();
          this.broadcast(room, 'resultStatus', {
            roomId: room.roomIndex,
            status: 'failed',
            winner,
            reason,
            attempt: room.attempts,
          });
          this.broadcast(room, 'end', winner);
          this.releaseRoom(room);
        }
      }
    })();
    return room.completion;
  }

  @Interval(1000 / 60)
  loop(): void {
    const nowMs = this.now();
    for (const room of this.rooms.values()) {
      if (
        room.persistence === 'failed' &&
        room.result &&
        room.attempts < MAX_SAVE_ATTEMPTS &&
        nowMs >= room.retryAt
      ) {
        void this.persistResult(room);
        continue;
      }
      if (room.persistence !== 'active') continue;
      if (room.offline.size) {
        const expired = Array.from(room.offline.entries()).find(
          ([, offline]) => nowMs >= offline.expiresAt,
        );
        if (expired)
          void this.finalizeMatch(
            room,
            expired[0] === 'left' ? 'right' : 'left',
            'disconnect',
          );
        continue;
      }
      try {
        const advanced = room.runner.advance(nowMs);
        if (room.runner.state.phase === 'finished') {
          void this.finalizeMatch(room, room.runner.state.winner, 'score');
        } else if (advanced.snapshot)
          this.broadcast(room, 'snapshot', advanced.snapshot);
      } catch {
        room.runner.stop();
        room.persistence = 'failed';
        this.broadcast(room, 'sessionStatus', {
          roomId: room.roomIndex,
          status: 'aborted',
        });
        this.broadcast(room, 'error', {
          message: '이 경기의 시뮬레이션을 중단했습니다.',
        });
        const diagnostic = {
          roomId: room.roomIndex,
          winner: null,
          reason: 'simulation',
          leftScore: room.runner.state.players.left.score,
          rightScore: room.runner.state.players.right.score,
          attempts: 0,
          cleanup: 'pending',
        };
        this.failedResults.push(diagnostic);
        if (this.failedResults.length > 100) this.failedResults.shift();
        this.releaseRoom(room);
        // A simulation abort declares no winner. This row was published by
        // this room but never submitted for finalization; remove that unfinished
        // record, and retain a bounded diagnostic if cleanup itself fails.
        void this.matchService.delete(room.roomIndex).then(
          () => {
            diagnostic.cleanup = 'removed';
          },
          () => {
            diagnostic.cleanup = 'failed';
          },
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const room of this.rooms.values()) room.runner.dispose();
    await Promise.all(
      Array.from(this.rooms.values())
        .map((room) => room.completion)
        .filter(Boolean),
    );
  }
}

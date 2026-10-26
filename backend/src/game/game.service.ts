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
import {
  Snapshot,
  isSessionSyncRequest,
  RecoveredResult,
  SessionSyncRequest,
  SessionSyncResponse,
  isSnapshot,
} from '../../../shared/protocol';
import { ServerMatchRunner } from './server-match-runner';
import { GameRuntimeState } from './distributed-state';
import { GAME_RECONNECT_GRACE_MS } from '../../../shared/realtime-policy';

export const GAME_CLOCK = Symbol('GAME_CLOCK');
export const RECONNECT_GRACE_MS = GAME_RECONNECT_GRACE_MS;
const MAX_SAVE_ATTEMPTS = 3;
const OBSERVER_GRANT_MS = 10 * 60 * 1000;
const MAX_OBSERVER_GRANTS = 1000;
type Session = { socket: AuthSocket; generation: number };
type Binding = { roomId: string; side: Side };
type DisconnectCause = 'transport_close' | 'presence_expired';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const userId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

@Injectable()
export class GameService implements OnModuleDestroy {
  private runtimeActive = true;
  private runtimeGuard: () => boolean = () => true;
  private durabilityGate?: () => Promise<boolean>;
  private rooms = new Map<string, Room>();
  private waitList: SpecData[] = [];
  private inviteList: { from: AuthSocket; to: number; mode: boolean }[] = [];
  private userList: AuthSocket[] = [];
  private sessions = new Map<number, Session>();
  private bindings = new Map<AuthSocket, Binding>();
  private matchByUser = new Map<number, Binding>();
  private watching = new Map<AuthSocket, string>();
  private observerGrants = new Map<string, number>();
  private reservations = new Map<number, AuthSocket>();
  private generation = 0;
  private lifecycleLogCounts = new WeakMap<Room, number>();
  private syncRequests = new WeakMap<AuthSocket, SessionSyncRequest>();
  private recoveryLookups = new Map<
    number,
    { key: string; task: ReturnType<MatchService['getOne']> }
  >();
  private recentResults = new Map<
    string,
    {
      expiresAt: number;
      participants: number[];
      status: 'saved' | 'failed';
      winnerId: number;
      result: Omit<RecoveredResult, 'outcome'>;
    }
  >();
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

  /** Followers must never advance physics; only the Redis lease owner may run it. */
  setRuntimeActive(value: boolean): void {
    this.runtimeActive = value;
  }

  setRuntimeGuard(guard: () => boolean): void { this.runtimeGuard = guard; }

  setDurabilityGate(gate: () => Promise<boolean>): void { this.durabilityGate = gate; }

  private canRun(): boolean { return this.runtimeActive && this.runtimeGuard(); }

  sessionForUser(id: number): AuthSocket | undefined {
    return this.sessions.get(id)?.socket;
  }

  activeSessions(): AuthSocket[] {
    return Array.from(this.sessions.values()).map(({ socket }) => socket);
  }

  hasRuntimeRooms(): boolean { return this.rooms.size > 0; }

  /** Durable checkpoint without raw Socket.IO objects, circular references or timers. */
  checkpoint(): GameRuntimeState {
    const nowMs = this.now();
    const sockets = new Map<string, AuthSocket>();
    const include = (socket: AuthSocket) => sockets.set(socket.id, socket);
    for (const session of this.sessions.values()) include(session.socket);
    for (const room of this.rooms.values()) {
      room.players.forEach(include);
      room.spectators.forEach(include);
    }
    for (const waiting of this.waitList) include(waiting.socket);
    for (const invite of this.inviteList) include(invite.from);
    return {
      v: 1,
      savedAt: Date.now(),
      generation: this.generation,
      sockets: Array.from(sockets.values()).map((socket) => ({
        socketId: socket.id,
        user: { id: socket.user.id, name: socket.user.name, nickname: socket.user.nickname },
      })),
      sessions: Array.from(this.sessions, ([userId, session]) => ({
        userId, socketId: session.socket.id, generation: session.generation,
      })),
      waitList: this.waitList.map(({ socket, mode }) => ({ socketId: socket.id, mode })),
      inviteList: this.inviteList.map(({ from, to, mode }) => ({ socketId: from.id, to, mode })),
      watching: Array.from(this.watching, ([socket, roomId]) => ({ socketId: socket.id, roomId })),
      observerGrants: Array.from(this.observerGrants, ([key, expiresAt]) => ({
        key, remainingMs: Math.max(0, expiresAt - nowMs),
      })),
      recentResults: Array.from(this.recentResults, ([roomId, result]) => ({
        roomId, remainingMs: Math.max(0, result.expiresAt - nowMs),
        participants: result.participants, status: result.status,
        winnerId: result.winnerId, result: result.result,
      })),
      rooms: Array.from(this.rooms.values()).map((room) => ({
        id: room.roomIndex,
        mode: room.gameMode,
        playerSocketIds: room.players.map((player) => player.id) as [string, string],
        spectatorSocketIds: room.spectators.map((spectator) => spectator.id),
        // Persistence is not a network frame; do not create artificial gaps in
        // the sequence numbers observed by players and spectators.
        snapshot: room.runner.snapshot(false),
        persistence: room.persistence,
        result: room.result,
        offline: Array.from(room.offline, ([side, entry]) => ({
          side, remainingMs: Math.max(0, entry.expiresAt - nowMs), generation: entry.generation,
        })),
        attempts: room.attempts,
        retryRemainingMs: Number.isFinite(room.retryAt) ? Math.max(0, room.retryAt - nowMs) : null,
      })),
    };
  }

  /** Adopt a prior leader's checkpoint, forcing a fresh protocol ownership epoch. */
  restoreCheckpoint(state: GameRuntimeState, socketForId: (id: string) => AuthSocket,
    liveSocketIds?: ReadonlySet<string>): void {
    if (state?.v !== 1 || !Array.isArray(state.rooms))
      throw new Error('Unsupported game checkpoint');
    const nowMs = this.now();
    const elapsed = Math.max(0, Date.now() - state.savedAt);
    const live = (remaining: number) => nowMs + Math.max(0, remaining - elapsed);
    for (const room of this.rooms.values()) room.runner.dispose();
    this.rooms.clear();
    this.sessions.clear();
    this.bindings.clear();
    this.matchByUser.clear();
    this.watching.clear();
    this.observerGrants.clear();
    this.recentResults.clear();
    this.waitList.length = 0;
    this.inviteList.length = 0;
    this.reservations.clear();
    this.generation = state.generation;
    const liveSessions = state.sessions.filter((session) => !liveSocketIds || liveSocketIds.has(session.socketId));
    const restoredSocketIds = new Set(liveSessions.map((session) => session.socketId));
    const absentUsers = new Set(state.sessions.filter((session) => !restoredSocketIds.has(session.socketId))
      .map((session) => session.userId));
    for (const session of liveSessions) {
      this.sessions.set(session.userId, {
        socket: socketForId(session.socketId),
        generation: session.generation,
      });
    }
    this.userList = Array.from(this.sessions.values()).map(({ socket }) => socket);
    for (const entry of state.waitList)
      if (restoredSocketIds.has(entry.socketId))
        this.waitList.push({ socket: socketForId(entry.socketId), mode: entry.mode });
    for (const entry of state.inviteList)
      if (restoredSocketIds.has(entry.socketId) && !absentUsers.has(entry.to))
        this.inviteList.push({ from: socketForId(entry.socketId), to: entry.to, mode: entry.mode });
    for (const entry of state.watching)
      if (restoredSocketIds.has(entry.socketId)) this.watching.set(socketForId(entry.socketId), entry.roomId);
    for (const entry of state.observerGrants)
      if (entry.remainingMs > elapsed) this.observerGrants.set(entry.key, live(entry.remainingMs));
    for (const entry of state.recentResults)
      if (entry.remainingMs > elapsed) this.recentResults.set(entry.roomId, {
        expiresAt: live(entry.remainingMs), participants: entry.participants,
        status: entry.status, winnerId: entry.winnerId, result: entry.result,
      });

    for (const entry of state.rooms) {
      if (!isSnapshot(entry.snapshot) || entry.snapshot.matchId !== entry.id)
        throw new Error('Corrupted authoritative game checkpoint');
      const players: [AuthSocket, AuthSocket] = entry.playerSocketIds.map(socketForId) as [AuthSocket, AuthSocket];
      // Seed RNG is consumed once per serve; rallyId counts completed serves.
      const rng = createSeededRng(Number(entry.id));
      for (let i = 0; i < entry.snapshot.state.rallyId; i++) rng();
      const runner = new ServerMatchRunner(entry.id, entry.mode, {
        left: ++this.generation, right: ++this.generation,
      }, nowMs, rng);
      runner.restore(entry.snapshot, nowMs);
      const room = new Room(entry.id, entry.mode, players, runner);
      room.spectators = entry.spectatorSocketIds.filter((id) => restoredSocketIds.has(id)).map(socketForId);
      room.persistence = entry.persistence === 'saving' ? 'failed' : entry.persistence;
      room.result = entry.result;
      room.offline = new Map(entry.offline.map(({ side, remainingMs, generation }) => [side, {
        expiresAt: live(remainingMs), generation,
      }]));
      // A checkpoint predates a crashed transport's presence expiry. Reconcile
      // it before the new authority can tick or announce a ready state. Existing
      // disconnect deadlines retain elapsed time; only newly absent players get
      // a fresh grace. Their paddle reservation and observer grants survive.
      if (liveSocketIds && room.persistence === 'active') {
        for (const [index, player] of players.entries()) {
          const side: Side = index === 0 ? 'left' : 'right';
          if (!restoredSocketIds.has(player.id) && !room.offline.has(side))
            room.offline.set(side, { expiresAt: nowMs + RECONNECT_GRACE_MS,
              generation: runner.generations[side] });
        }
      }
      // A process can disappear during its last in-flight save. Replaying that
      // same idempotent attempt must remain possible after recovery.
      room.attempts = entry.persistence === 'saving' ? Math.max(0, entry.attempts - 1) : entry.attempts;
      room.retryAt = entry.persistence === 'saving' ? nowMs :
        entry.retryRemainingMs === null ? Infinity : live(entry.retryRemainingMs);
      if (room.offline.size || room.persistence !== 'active') runner.stop();
      this.rooms.set(room.roomIndex, room);
      for (const [index, player] of players.entries()) {
        const side: Side = index === 0 ? 'left' : 'right';
        const binding = { roomId: room.roomIndex, side };
        this.matchByUser.set(player.user.id, binding);
        if (this.sessions.get(player.user.id)?.socket === player) this.bindings.set(player, binding);
        const session = this.sessions.get(player.user.id);
        if (session) session.generation = runner.generations[side];
      }
      for (const spectator of room.spectators) {
        const session = this.sessions.get(spectator.user.id);
        if (session?.socket !== spectator) continue;
        session.generation = ++this.generation;
      }
    }
  }

  /** Re-announce authoritative state after ownership moves between instances. */
  announceRecovery(): void {
    for (const room of this.rooms.values()) {
      this.logLifecycle(room, 'authority_recovered');
      for (const [index, player] of room.players.entries()) {
        if (this.sessions.get(player.user.id)?.socket !== player) continue;
        const side: Side = index === 0 ? 'left' : 'right';
        player.emit('ready', this.ready(room, player, side));
        if (room.offline.size) player.emit('sessionStatus', {
          roomId: room.roomIndex, status: 'waiting', graceMs: RECONNECT_GRACE_MS,
        });
      }
      for (const spectator of room.spectators) {
        if (this.sessions.get(spectator.user.id)?.socket !== spectator) continue;
        spectator.emit('setData', {
          ...this.ready(room, spectator, 'spectator'),
          leftScore: room.runner.state.players.left.score,
          rightScore: room.runner.state.players.right.score,
        });
      }
    }
  }

  private current(socket: AuthSocket): boolean {
    return this.canRun() && this.sessions.get(socket.user.id)?.socket === socket;
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
    if (!this.canRun()) return;
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
      this.logLifecycle(room, 'resumed');
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

  /** A transport connection is not proof that its previous match still exists. */
  async syncSession(
    client: AuthSocket,
    value: unknown,
  ): Promise<SessionSyncResponse | undefined> {
    if (!this.current(client) || !isSessionSyncRequest(value)) return;
    const request = { ...value };
    this.syncRequests.set(client, request);
    const identity = {
      v: 1 as const,
      requestId: request.requestId,
      matchId: request.matchId,
    };
    const response = (data: object) =>
      ({ ...identity, ...data } as SessionSyncResponse);
    if (request.role === 'spectator') {
      if (this.busy(client)) return response({ status: 'unavailable' });
      const watched = this.rooms.get(request.matchId);
      // Public live spectating must not authorize arbitrary historical results.
      // Only an account that actually subscribed while this match was active
      // can recover its completed result, for a bounded period in this process.
      if (
        watched?.persistence !== 'active' &&
        !this.hasObserverGrant(client, request.matchId)
      )
        return response({ status: 'unavailable' });
      if (watched) {
        const ready = this.watchRoom(client, watched);
        if (watched.persistence === 'active')
          return response({
            status: watched.offline.size ? 'waiting' : 'active',
            ready,
          });
        if (watched.result)
          return response({
            status: watched.persistence === 'saving' ? 'saving' : 'retrying',
            result: { ...this.roomResult(watched), outcome: 'spectator' },
          });
      }
      const recent = this.recentResults.get(request.matchId);
      if (recent && this.now() < recent.expiresAt)
        return response({
          status: recent.status,
          result: { ...recent.result, outcome: 'spectator' },
        });
      try {
        const match = await this.lookupRecoveryResult(client, request);
        if (
          !this.current(client) ||
          this.syncRequests.get(client) !== request ||
          this.busy(client)
        )
          return;
        if (!this.hasObserverGrant(client, request.matchId))
          return response({ status: 'unavailable' });
        if (!match?.winner || !match.loser)
          return response({ status: 'unavailable' });
        return response({
          status: 'saved',
          result: {
            winnerName: match.winner.nickname,
            loserName: match.loser.nickname,
            winnerScore: match.winnerScore,
            loserScore: match.loserScore,
            outcome: 'spectator',
          },
        });
      } catch {
        if (!this.current(client) || this.syncRequests.get(client) !== request)
          return;
        return response({ status: 'error' });
      }
    }
    const binding = this.matchByUser.get(client.user.id);
    const room = this.rooms.get(request.matchId);
    if (room) {
      if (
        !binding ||
        binding.roomId !== request.matchId ||
        !room.players.some((player) => player.user.id === client.user.id)
      )
        return response({ status: 'unavailable' });
      if (room.persistence === 'active')
        return response({
          status: room.offline.size ? 'waiting' : 'active',
          ready: this.ready(room, client, binding.side),
        });
      if (room.result) {
        // The returning authenticated participant must receive the pending save's
        // final notification, even though this match will never resume physics.
        room.players[binding.side === 'left' ? 0 : 1] = client;
        this.bindings.set(client, binding);
        const winner = room.result.winner === 'left' ? 0 : 1;
        return response({
          status: room.persistence === 'saving' ? 'saving' : 'retrying',
          result: {
            ...this.roomResult(room),
            outcome:
              room.players[winner].user.id === client.user.id ? 'won' : 'lost',
          },
        });
      }
    }
    for (const [id, result] of this.recentResults)
      if (this.now() >= result.expiresAt) this.recentResults.delete(id);
    const recent = this.recentResults.get(request.matchId);
    if (recent)
      return response(
        recent.participants.includes(client.user.id)
          ? {
              status: recent.status,
              result: {
                ...recent.result,
                outcome: recent.winnerId === client.user.id ? 'won' : 'lost',
              },
            }
          : { status: 'unavailable' },
      );
    try {
      const match = await this.lookupRecoveryResult(client, request);
      if (
        !this.current(client) ||
        this.syncRequests.get(client) !== request ||
        (this.matchByUser.has(client.user.id) &&
          this.matchByUser.get(client.user.id).roomId !== request.matchId)
      )
        return;
      if (!match?.winner || !match.loser)
        return response({ status: 'unavailable' });
      return response({
        status: 'saved',
        result: {
          winnerName: match.winner.nickname,
          loserName: match.loser.nickname,
          winnerScore: match.winnerScore,
          loserScore: match.loserScore,
          outcome: match.winner.id === client.user.id ? 'won' : 'lost',
        },
      });
    } catch {
      if (!this.current(client) || this.syncRequests.get(client) !== request)
        return;
      return response({ status: 'error' });
    }
  }

  private roomResult(room: Room): Omit<RecoveredResult, 'outcome'> {
    const winner = room.result.winner;
    const loser = winner === 'left' ? 'right' : 'left';
    return {
      winnerName: room.players[winner === 'left' ? 0 : 1].user.nickname,
      loserName: room.players[loser === 'left' ? 0 : 1].user.nickname,
      winnerScore: room.runner.state.players[winner].score,
      loserScore: room.runner.state.players[loser].score,
    };
  }

  private lookupRecoveryResult(
    client: AuthSocket,
    request: SessionSyncRequest,
  ) {
    const key = request.role + ':' + request.matchId;
    const existing = this.recoveryLookups.get(client.user.id);
    if (existing) {
      if (existing.key !== key)
        throw new Error('A previous recovery lookup is still pending');
      return existing.task;
    }
    const task =
      request.role === 'player'
        ? this.matchService.getOneForParticipant(
            request.matchId,
            client.user.id,
          )
        : this.matchService.getOne(request.matchId);
    const owned = { key, task };
    this.recoveryLookups.set(client.user.id, owned);
    const release = () => {
      if (this.recoveryLookups.get(client.user.id) === owned)
        this.recoveryLookups.delete(client.user.id);
    };
    void task.then(release, release);
    return task;
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
      // A player must not see a match that exists only in a disappearing
      // Function. Publish ready only after the room has a fenced checkpoint.
      if (this.durabilityGate && !(await this.durabilityGate())) return;
      if (!this.canRun() || this.rooms.get(id) !== room) return;
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

  private hasObserverGrant(client: AuthSocket, roomId: string): boolean {
    for (const [key, expiresAt] of this.observerGrants)
      if (this.now() >= expiresAt) this.observerGrants.delete(key);
    return this.observerGrants.has(`${client.user.id}:${roomId}`);
  }

  private watchRoom(client: AuthSocket, room: Room) {
    if (room.persistence === 'active') {
      const key = `${client.user.id}:${room.roomIndex}`;
      this.hasObserverGrant(client, room.roomIndex);
      this.observerGrants.delete(key);
      this.observerGrants.set(key, this.now() + OBSERVER_GRANT_MS);
      while (this.observerGrants.size > MAX_OBSERVER_GRANTS)
        this.observerGrants.delete(this.observerGrants.keys().next().value);
    }
    this.removeWaiting(client);
    if (
      this.watching.get(client) !== room.roomIndex ||
      !room.spectators.includes(client)
    ) {
      this.leaveSpectator(client);
      room.spectators.push(client);
      this.watching.set(client, room.roomIndex);
    }
    return this.ready(room, client, 'spectator');
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
        client.emit('setData', {
          ...this.watchRoom(client, room),
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
        if (!this.hasObserverGrant(client, data.id))
          return this.error(
            client,
            '이전에 관전한 경기의 복구 기간이 끝났습니다. 목록에서 다시 선택해 주세요.',
          );
        const match = await this.lookupRecoveryResult(client, {
          v: 1,
          requestId: 'legacy-spectate',
          matchId: data.id,
          role: 'spectator',
        });
        if (
          !this.current(client) ||
          this.busy(client) ||
          !this.hasObserverGrant(client, data.id)
        )
          return;
        if (!match?.winner || !match.loser)
          return this.error(client, '완료된 경기 정보를 찾을 수 없습니다.');
        client.emit('finish', {
          leftName: match.winner.nickname,
          rightName: match.loser.nickname,
          leftScore: match.winnerScore,
          rightScore: match.loserScore,
        });
        client.emit('matchEnded', { v: 1, roomId: data.id, winner: 'left' });
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

  /** Bounded lifecycle evidence; never include identities, auth or socket data. */
  private logLifecycle(room: Room,
    transition: 'paused' | 'resumed' | 'authority_recovered' | 'result_saved' | 'result_failed',
    detail: { cause?: DisconnectCause; side?: Side; reason?: 'score' | 'forfeit' | 'disconnect' } = {}): void {
    const count = this.lifecycleLogCounts.get(room) || 0;
    const terminal = transition === 'result_saved' || transition === 'result_failed';
    if (!terminal && count >= 12) return;
    this.lifecycleLogCounts.set(room, count + 1);
    console.info(JSON.stringify({ event: 'game.lifecycle', transition,
      at: new Date().toISOString(), matchId: room.roomIndex,
      runnerId: room.runner.instanceId, tick: room.runner.state.tick,
      score: { left: room.runner.state.players.left.score, right: room.runner.state.players.right.score },
      ...(transition === 'paused' ? { graceMs: RECONNECT_GRACE_MS } : {}), ...detail }));
  }

  async dropUser(client: AuthSocket, disconnected = false,
    cause: DisconnectCause = 'transport_close'): Promise<void> {
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
    const binding = this.bindings.get(client);
    if (disconnected) {
      this.bindings.delete(client);
      await this.deleteUser(client);
    }
    if (!owned || !binding) return;
    const room = this.rooms.get(binding.roomId);
    if (!room) return;
    if (disconnected && room.persistence === 'active') {
      room.offline.set(binding.side, {
        expiresAt: this.now() + RECONNECT_GRACE_MS,
        generation: room.runner.generations[binding.side],
      });
      room.runner.stop();
      this.logLifecycle(room, 'paused', { cause, side: binding.side });
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
    // A save started by a former authority may finish after this process has
    // adopted a newer checkpoint. It must not delete the restored room.
    if (this.rooms.get(room.roomIndex) !== room) return;
    if (
      room.result &&
      (room.persistence === 'saved' || room.persistence === 'failed')
    ) {
      this.recentResults.set(room.roomIndex, {
        expiresAt: this.now() + 10 * 60 * 1000,
        participants: room.players.map((player) => player.user.id),
        status: room.persistence,
        winnerId: room.players[room.result.winner === 'left' ? 0 : 1].user.id,
        result: this.roomResult(room),
      });
      while (this.recentResults.size > 100)
        this.recentResults.delete(this.recentResults.keys().next().value);
    }
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
        // Persist the chosen terminal outcome under the current authority
        // before writing PostgreSQL. A successor will then replay the same
        // result rather than simulate a potentially different final outcome.
        if (this.durabilityGate && !(await this.durabilityGate())) return;
        if (!this.canRun() || this.rooms.get(room.roomIndex) !== room) return;
        await this.matchService.update(room.roomIndex, {
          winner: room.players[winnerIndex].user,
          loser: room.players[1 - winnerIndex].user,
          winnerScore: room.runner.state.players[winner].score,
          loserScore: room.runner.state.players[loser].score,
        });
        if (!this.canRun() || this.rooms.get(room.roomIndex) !== room) return;
        room.persistence = 'saved';
        this.logLifecycle(room, 'result_saved', { reason });
        this.broadcast(room, 'resultStatus', {
          roomId: room.roomIndex,
          status: 'saved',
          winner,
          reason,
          attempt: room.attempts,
        });
        this.broadcast(room, 'matchEnded', {
          v: 1,
          roomId: room.roomIndex,
          winner,
        });
        this.releaseRoom(room);
      } catch {
        if (!this.canRun() || this.rooms.get(room.roomIndex) !== room) return;
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
          this.logLifecycle(room, 'result_failed', { reason });
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
          this.broadcast(room, 'matchEnded', {
            v: 1,
            roomId: room.roomIndex,
            winner,
          });
          this.releaseRoom(room);
        }
      }
    })();
    return room.completion;
  }

  @Interval(1000 / 60)
  loop(): void {
    if (!this.canRun()) return;
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

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { Server, Namespace } from 'socket.io';
import Redis from 'ioredis';
import { RedisService } from '../infra/redis.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entity/user.entity';
import { AuthSocket } from './game.middleware';
import { GameService } from './game.service';
import { GameRuntimeState } from './distributed-state';
import { GAME_COMMAND_TIMEOUT_MS } from '../../../shared/protocol';

const LEASE_MS = 5000;
const LEASE_SAFETY_MS = 250;
const COMMAND_RETRY_MS = 400;
const CHECKPOINT_MS = 100;
const IDLE_CHECKPOINT_MS = 120000;
const CHECKPOINT_TTL_SECONDS = 600;
const PRESENCE_MS = 3000;
export const GAME_AUTHORITY_CLOCK = Symbol('GAME_AUTHORITY_CLOCK');
type GameCommand = 'connect' | 'disconnect' | 'keyboardEvent' | 'sessionSync' |
  'matchmaking' | 'invitelist' | 'invite' | 'joinFriend' | 'refuse' |
  'spectate' | 'roomlist' | 'achievement' | 'end';
interface CommandEnvelope {
  id: string;
  replyTo: string;
  socketId: string;
  userId: number;
  event: GameCommand;
  payload?: unknown;
  expectsReply: boolean;
}

/**
 * One Redis-fenced game authority across arbitrary short-lived WebSocket nodes.
 * Clients remain connected to their own instance; the authority forwards all
 * events over Socket.IO's Redis adapter. Periodic checkpoints preserve the
 * physics state and matchmaking queues when a Function instance disappears.
 */
@Injectable()
export class RedisGameCoordinator implements OnModuleInit, OnModuleDestroy {
  private readonly instanceId = randomUUID();
  private readonly namespace = (process.env.GAME_REDIS_NAMESPACE || process.env.VERCEL_URL || 'local')
    .replace(/[^a-zA-Z0-9:_-]/g, '_');
  private readonly prefix = `ft:game:${this.namespace}`;
  private readonly leaseKey = `${this.prefix}:lease`;
  private readonly checkpointKey = `${this.prefix}:checkpoint`;
  private readonly commandChannel = `${this.prefix}:command`;
  private readonly replyChannel = `${this.prefix}:reply:${this.instanceId}`;
  private readonly sockets = new Map<string, AuthSocket>();
  private readonly ownedSockets = new Set<string>();
  private readonly pending = new Map<string, { resolve: (value: any) => void;
    timeout: ReturnType<typeof setTimeout>; retry: ReturnType<typeof setInterval> }>();
  private readonly inFlight = new Set<string>();
  private readonly completed = new Map<string, { value: unknown; expiresAt: number }>();
  private subscriber?: Redis;
  private heartbeat?: ReturnType<typeof setInterval>;
  private presenceTimer?: ReturnType<typeof setInterval>;
  private checkpointTimer?: ReturnType<typeof setInterval>;
  private server?: Server | Namespace;
  private isLeader = false;
  private recovering = false;
  private leaseToken?: string;
  private leaseUntil = 0;
  private authorityEpoch = 0;
  private leadershipCheck = false;
  private checkpointTask?: Promise<boolean>;
  private lastCheckpointIdle = false;
  private lastCheckpointAt = 0;
  private queue = Promise.resolve();

  constructor(
    private readonly redis: RedisService,
    private readonly game: GameService,
    private readonly users: UserService,
    @Optional() @Inject(GAME_AUTHORITY_CLOCK)
    private readonly now: () => number = () => performance.now(),
  ) {}

  get distributed(): boolean { return this.redis.enabled; }

  private hasLease(): boolean {
    return this.isLeader && this.now() < this.leaseUntil;
  }

  private revokeAuthority(): void {
    this.isLeader = false;
    this.recovering = false;
    this.leaseUntil = 0;
    this.game.setRuntimeActive(false);
  }

  bindServer(server: Server | Namespace): void { this.server = server; }

  private presenceKey(id: string): string { return `${this.prefix}:presence:${id}`; }

  /** Unknown presence is not permission to run restored physics. */
  private async restoredPresence(state: GameRuntimeState): Promise<{
    liveSocketIds: Set<string>; validUntil: number;
  }> {
    if (!Array.isArray(state?.sessions)) throw new Error('Invalid checkpoint sessions');
    const ids = Array.from(new Set(state.sessions.map((session) => session.socketId)));
    if (ids.some((id) => typeof id !== 'string' || !id)) throw new Error('Invalid checkpoint socket identity');
    if (!ids.length) return { liveSocketIds: new Set(), validUntil: Infinity };
    const startedAt = this.now();
    const pipeline = this.redis.client.pipeline();
    for (const id of ids) pipeline.pttl(this.presenceKey(id));
    const statuses = await pipeline.exec();
    if (!Array.isArray(statuses) || statuses.length !== ids.length ||
      statuses.some((status) => !Array.isArray(status) || status[0] ||
        typeof status[1] !== 'number' || !Number.isInteger(status[1]) ||
        (status[1] !== -2 && (status[1] < 0 || status[1] > PRESENCE_MS))))
      throw new Error('Could not verify restored socket presence');
    // Anchor remaining TTLs at request start, not response receipt. A slow
    // presence read or first fenced checkpoint must never extend stale proof
    // that a remote transport is alive. Unknown/non-expiring keys fail closed.
    const ttls = statuses.map((status) => status[1] as number);
    return {
      liveSocketIds: new Set(ids.filter((_id, index) => ttls[index] > 0)),
      validUntil: Math.min(...ttls.filter((ttl) => ttl >= 0).map((ttl) => startedAt + ttl), Infinity),
    };
  }

  private async refreshPresence(): Promise<void> {
    if (!this.redis.client || !this.ownedSockets.size) return;
    const pipeline = this.redis.client.pipeline();
    for (const id of this.ownedSockets)
      pipeline.set(this.presenceKey(id), this.instanceId, 'PX', PRESENCE_MS);
    await pipeline.exec().catch((error) =>
      console.error('Socket presence heartbeat failed:', error.message));
  }

  private async reapStaleSockets(): Promise<void> {
    if (!this.hasLease() || !this.redis.client) return;
    const epoch = this.authorityEpoch;
    const sessions = this.game.activeSessions();
    if (!sessions.length) return;
    const pipeline = this.redis.client.pipeline();
    for (const socket of sessions) pipeline.exists(this.presenceKey(socket.id));
    const statuses = await pipeline.exec();
    if (!this.hasLease() || epoch !== this.authorityEpoch) return;
    let changed = false;
    for (const [index, [, alive]] of statuses.entries()) {
      if (alive === 0) {
        await this.game.dropUser(sessions[index], true, 'presence_expired');
        changed = true;
      }
    }
    if (changed) await this.persistCheckpoint(true);
  }

  async onModuleInit(): Promise<void> {
    if (!this.redis.client) return;
    this.game.setRuntimeActive(false);
    this.game.setRuntimeGuard(() => this.hasLease());
    this.game.setDurabilityGate(() => this.persistCheckpoint(true));
    await this.redis.connect();
    this.subscriber = this.redis.client.duplicate();
    await this.subscriber.connect();
    await this.subscriber.subscribe(this.commandChannel, this.replyChannel);
    this.subscriber.on('message', (channel, message) => {
      if (channel === this.replyChannel) {
        try {
          const response = JSON.parse(message) as { id: string; value: unknown; error?: string };
          const pending = this.pending.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            clearInterval(pending.retry);
            this.pending.delete(response.id);
            pending.resolve(response.error ? undefined : response.value);
          }
        } catch { /* Invalid pub/sub message is not a game event. */ }
      } else if (channel === this.commandChannel && this.hasLease()) {
        try {
          const command = JSON.parse(message) as CommandEnvelope;
          if (this.inFlight.has(command.id)) return;
          const epoch = this.authorityEpoch;
          this.inFlight.add(command.id);
          this.queue = this.queue.then(async () => {
            if (epoch === this.authorityEpoch) await this.handleCommand(command);
          }).catch((error) => console.error('Game command rejected:', error.message))
            .finally(() => this.inFlight.delete(command.id));
        } catch { /* Malformed messages must not tear down the subscriber. */ }
      }
    });
    this.heartbeat = setInterval(() => { void this.checkLeadership(); }, 1000);
    this.presenceTimer = setInterval(() => { void this.refreshPresence(); }, 750);
    this.checkpointTimer = setInterval(() => { void this.persistCheckpoint(); }, CHECKPOINT_MS);
    await this.checkLeadership();
  }

  private proxy(id: string, user: Pick<User, 'id' | 'name' | 'nickname'>): AuthSocket {
    const existing = this.sockets.get(id);
    if (existing) return existing;
    const epoch = this.authorityEpoch;
    const socket = {
      id, user,
      emit: (event: string, payload: unknown) => {
        if (this.hasLease() && !this.recovering && epoch === this.authorityEpoch) this.server?.to(id).emit(event, payload);
        return true;
      },
      disconnect: () => {
        if (this.hasLease() && !this.recovering && epoch === this.authorityEpoch) this.server?.in(id).disconnectSockets(true);
      },
    } as unknown as AuthSocket;
    this.sockets.set(id, socket);
    return socket;
  }

  private async checkLeadership(): Promise<void> {
    const client = this.redis.client;
    if (!client || this.leadershipCheck) return;
    // An HTTP-only warm instance must not poll or own game authority forever.
    // Nodes with active local game transports can take over an expired lease.
    if (!this.isLeader && !this.ownedSockets.size) return;
    this.leadershipCheck = true;
    try {
      if (this.isLeader) {
        // A resumed/frozen Function must stop before doing any work under an
        // already-expired lease, even if its renewal callback has not run yet.
        if (!this.hasLease()) { this.revokeAuthority(); return; }
        if (!this.ownedSockets.size && !this.game.activeSessions().length &&
          !this.game.hasRuntimeRooms()) {
          // Flush terminal/session cleanup before stopping idle Redis traffic.
          // A connect can race this await, so recheck interest before release.
          if (!(await this.persistCheckpoint(true))) return;
          if (this.ownedSockets.size || this.game.activeSessions().length ||
            this.game.hasRuntimeRooms()) return;
          const token = this.leaseToken;
          this.revokeAuthority();
          await client.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1, this.leaseKey, token,
          );
          return;
        }
        const startedAt = this.now();
        const token = this.leaseToken;
        const renewed = await client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
          1, this.leaseKey, token, LEASE_MS,
        );
        if (renewed !== 1 || token !== this.leaseToken ||
          this.now() >= startedAt + LEASE_MS - LEASE_SAFETY_MS) {
          this.revokeAuthority(); return;
        }
        this.leaseUntil = startedAt + LEASE_MS - LEASE_SAFETY_MS;
        // Serialize presence cleanup with connection commands; stale presence
        // reads must never evict a newly restored socket concurrently.
        const epoch = this.authorityEpoch;
        this.queue = this.queue.then(async () => {
          if (epoch === this.authorityEpoch) await this.reapStaleSockets();
        }).catch((error) => console.error('Game presence cleanup failed:', error.message));
        return;
      }
      const token = `${this.instanceId}:${randomUUID()}`;
      const startedAt = this.now();
      const acquired = await client.set(this.leaseKey, token, 'PX', LEASE_MS, 'NX');
      if (acquired !== 'OK') return;
      this.leaseToken = token;
      this.leaseUntil = startedAt + LEASE_MS - LEASE_SAFETY_MS;
      this.recovering = true;
      this.game.setRuntimeActive(false);
      this.authorityEpoch++;
      this.lastCheckpointIdle = false;
      // A brand-new authority resumes from the last successful fenced write.
      const serialized = await client.get(this.checkpointKey);
      if (this.now() >= this.leaseUntil) { this.revokeAuthority(); return; }
      this.sockets.clear();
      this.completed.clear();
      let presenceValidUntil = Infinity;
      if (serialized) {
        const state = JSON.parse(serialized) as GameRuntimeState;
        const presence = await this.restoredPresence(state);
        presenceValidUntil = presence.validUntil;
        if (this.now() >= Math.min(this.leaseUntil, presenceValidUntil)) { this.revokeAuthority(); return; }
        for (const item of state.sockets) this.proxy(item.socketId, item.user);
        this.game.restoreCheckpoint(state, (id) => {
          const socket = this.sockets.get(id);
          if (!socket) throw new Error(`Checkpoint references an unknown socket: ${id}`);
          return socket;
        }, presence.liveSocketIds);
        for (const command of state.completedCommands || []) {
          if (command.expiresAt > Date.now()) this.completed.set(command.id, {
            value: command.value, expiresAt: command.expiresAt,
          });
        }
      } else {
        // No checkpoint means a fresh runtime, including when an old instance
        // resumes after the checkpoint's retention window has elapsed.
        this.game.restoreCheckpoint({ v: 1, savedAt: Date.now(), generation: 0,
          sockets: [], sessions: [], waitList: [], inviteList: [], watching: [],
          observerGrants: [], recentResults: [], rooms: [] }, () => {
          throw new Error('An empty checkpoint cannot reference sockets');
        });
      }
      this.isLeader = true;
      // Verify ownership again with a fenced checkpoint before telling clients
      // to adopt this new input/clock epoch or allowing the fixed loop to tick.
      // The checkpoint includes missing transports' paused/offline state.
      if (await this.persistCheckpoint(true)) {
        if (this.now() >= presenceValidUntil) { this.revokeAuthority(); return; }
        this.recovering = false;
        this.game.setRuntimeActive(true);
        if (serialized) this.game.announceRecovery();
      }
    } catch (error) {
      this.revokeAuthority();
      console.error('Game authority recovery failed:', (error as Error).message);
    } finally {
      this.leadershipCheck = false;
    }
  }

  private async persistCheckpoint(flush = false): Promise<boolean> {
    const client = this.redis.client;
    while (this.checkpointTask) {
      if (!flush) return false;
      await this.checkpointTask;
    }
    if (!this.hasLease() || !client) return false;
    // Lobby sessions change through checkpointed control commands. Avoid ten
    // unchanged writes per second when there is no match to advance. Refresh
    // occasional lobby snapshots so queue/session state outlives the Redis TTL.
    // The first empty checkpoint after a completed match is always written.
    if (!flush && this.lastCheckpointIdle && !this.game.hasRuntimeRooms() &&
      this.now() - this.lastCheckpointAt < IDLE_CHECKPOINT_MS) return true;
    const token = this.leaseToken;
    const state = this.game.checkpoint();
    for (const [id, entry] of this.completed)
      if (entry.expiresAt <= Date.now()) this.completed.delete(id);
    state.completedCommands = Array.from(this.completed, ([id, entry]) => ({ id, ...entry }));
    const data = JSON.stringify(state);
    const task = (async () => {
      try {
        const result = await client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end",
          2, this.leaseKey, this.checkpointKey, token, data, CHECKPOINT_TTL_SECONDS,
        );
        if (token !== this.leaseToken) return false;
        if (result !== 1 || !this.hasLease()) {
          this.revokeAuthority(); return false;
        }
        this.lastCheckpointIdle = state.rooms.length === 0;
        this.lastCheckpointAt = this.now();
        return true;
      } catch (error) {
        if (token === this.leaseToken) this.revokeAuthority();
        console.error('Game checkpoint failed:', (error as Error).message);
        return false;
      }
    })();
    this.checkpointTask = task;
    try { return await task; }
    finally { if (this.checkpointTask === task) this.checkpointTask = undefined; }
  }

  async dispatch(socket: AuthSocket, event: GameCommand, payload?: unknown): Promise<any> {
    if (!this.redis.client) throw new Error('Redis game coordinator is disabled');
    if (!this.subscriber) throw new Error('Game coordinator is not ready');
    if (event === 'connect') {
      this.ownedSockets.add(socket.id);
      await this.redis.client.set(this.presenceKey(socket.id), this.instanceId, 'PX', PRESENCE_MS);
      // Empty deployments sleep until a real game connection needs authority.
      await this.checkLeadership();
    }
    if (event === 'disconnect') {
      this.ownedSockets.delete(socket.id);
      await this.redis.client.del(this.presenceKey(socket.id));
    }
    // Input frames are replaceable and already sequence-checked by the game.
    // Control operations are retried until the authority durably checkpoints
    // and acknowledges them, so a leader handoff cannot silently lose a queue
    // join, invitation, connect or disconnect.
    const expectsReply = event !== 'keyboardEvent';
    const id = randomUUID();
    const message: CommandEnvelope = {
      id, replyTo: this.replyChannel, socketId: socket.id,
      userId: socket.user.id, event, payload, expectsReply,
    };
    const serialized = JSON.stringify(message);
    let result: Promise<any> | undefined;
    if (expectsReply) {
      result = new Promise((resolve) => {
        const retry = setInterval(() => {
          if (!this.pending.has(id)) return;
          void this.redis.client.publish(this.commandChannel, serialized).catch(() => undefined);
        }, COMMAND_RETRY_MS);
        const timeout = setTimeout(() => {
          this.pending.delete(id);
          clearInterval(retry);
          resolve(undefined);
        }, GAME_COMMAND_TIMEOUT_MS);
        this.pending.set(id, { resolve, timeout, retry });
      });
    }
    try {
      await this.redis.client.publish(this.commandChannel, serialized);
    } catch (error) {
      const pending = this.pending.get(id);
      if (pending) {
        // Keep bounded retries alive while a short Redis outage recovers.
        return result;
      }
      throw error;
    }
    return result;
  }

  private async handleCommand(command: CommandEnvelope): Promise<void> {
    // Control senders already retry until a durable ACK. Do not consume their
    // operation against a half-restored runtime while the first fence is pending.
    if (!this.hasLease() || this.recovering) return;
    const epoch = this.authorityEpoch;
    const current = () => this.hasLease() && epoch === this.authorityEpoch;
    const completed = this.completed.get(command.id);
    // Recovery is a repeatable state read (observer registration is idempotent).
    // Its cached ACK may describe the former authority saved in a checkpoint;
    // after takeover, always read this runner's instance and input generation.
    // Mutating commands still replay their durable receipt without reapplying.
    if (command.event !== 'sessionSync' && completed && completed.expiresAt > Date.now()) {
      if (command.expectsReply) await this.redis.client.publish(command.replyTo,
        JSON.stringify({ id: command.id, value: completed.value }));
      return;
    }
    let socket = this.sockets.get(command.socketId);
    try {
      let value: unknown;
      if (command.event === 'connect') {
        const user = await this.users.getOne(command.userId);
        if (!user || !current()) return;
        const previous = this.game.sessionForUser(command.userId);
        if (previous && previous.id !== command.socketId) {
          // Preserve the original single-active-tab rule. If the owning
          // Function died without a disconnect, give its short Redis presence
          // lease time to expire before taking over the paddle.
          for (let i = 0; i < 16; i++) {
            if (!(await this.redis.client.exists(this.presenceKey(previous.id)))) break;
            await new Promise((resolve) => setTimeout(resolve, 200));
            if (!current()) return;
          }
          if (!current()) return;
          if (!(await this.redis.client.exists(this.presenceKey(previous.id))))
            await this.game.dropUser(previous, true, 'presence_expired');
        }
        if (!current()) return;
        socket = this.proxy(command.socketId, user);
        await this.game.addUser(socket);
        value = this.game.sessionForUser(command.userId)?.id === command.socketId;
      } else if (socket && socket.user.id === command.userId) {
        // A brief presence outage may have reaped a healthy transport. Its
        // next authenticated command can re-establish the same session once
        // its owning node's heartbeat is visible, without evicting another tab.
        if (command.event !== 'disconnect' && !this.game.sessionForUser(command.userId)) {
          const alive = await this.redis.client.exists(this.presenceKey(command.socketId));
          if (!alive || !current()) return;
          await this.game.addUser(socket);
        }
        if (!current()) return;
        switch (command.event) {
          case 'disconnect':
            await this.game.dropUser(socket, true);
            this.sockets.delete(command.socketId);
            break;
          case 'keyboardEvent': this.game.listenKeyEvent(socket, command.payload); break;
          case 'sessionSync': value = await this.game.syncSession(socket, command.payload); break;
          case 'matchmaking': await this.game.joinMatch(socket, command.payload as any); break;
          case 'invitelist': await this.game.userInviteList(socket); break;
          case 'invite': await this.game.invite(socket, command.payload as any); break;
          case 'joinFriend': await this.game.joinToFriend(socket, command.payload as number); break;
          case 'refuse': await this.game.refuse(socket, command.payload); break;
          case 'spectate': await this.game.spectate(socket, command.payload); break;
          case 'roomlist': await this.game.spectatorList(socket); break;
          case 'achievement': await this.game.achievement(socket); break;
          case 'end': await this.game.dropUser(socket); break;
        }
      } else if (command.event !== 'disconnect') {
        // A control message can race its retried connect during a handoff.
        // Leave it unacknowledged until that authenticated session is restored.
        return;
      }
      if (!current()) return;
      if (command.expectsReply) {
        this.completed.set(command.id, { value: value === undefined ? null : value,
          expiresAt: Date.now() + GAME_COMMAND_TIMEOUT_MS * 2 });
        while (this.completed.size > 512) this.completed.delete(this.completed.keys().next().value);
        // Do not acknowledge state that only exists in this Function's memory.
        if (!(await this.persistCheckpoint(true)) || !current()) return;
        await this.redis.client.publish(command.replyTo, JSON.stringify({
          id: command.id, value: value === undefined ? null : value,
        }));
      }
    } catch (error) {
      console.error('Game command failed:', (error as Error).message);
      if (command.expectsReply && current()) await this.redis.client.publish(command.replyTo, JSON.stringify({
        id: command.id, error: 'Game request failed',
      }));
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    if (this.redis.client && this.ownedSockets.size)
      await this.redis.client.del(...Array.from(this.ownedSockets, (id) => this.presenceKey(id))).catch(() => undefined);
    await this.persistCheckpoint(true);
    this.revokeAuthority();
    if (this.redis.client) await this.redis.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1, this.leaseKey, this.leaseToken || '',
    ).catch(() => undefined);
    this.subscriber?.disconnect();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      clearInterval(pending.retry);
      pending.resolve(undefined);
    }
    this.pending.clear();
  }
}

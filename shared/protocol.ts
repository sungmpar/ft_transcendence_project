import { createGame, GameEvent, GameState, PlayerInput } from './game-core';

export const PROTOCOL_VERSION = 1;
export const EVENT_HISTORY_TICKS = 120;
export const MAX_SNAPSHOT_EVENTS = 64;
export interface ServerEvent { id: number; event: GameEvent }
export interface MatchInput {
  v: 1;
  matchId: string;
  generation: number;
  seq: number;
  up: boolean;
  down: boolean;
  actionId: number;
}
export interface Snapshot {
  v: 1;
  matchId: string;
  /** One server runner incarnation, independent of either player's input owner. */
  instanceId: string;
  /** Advances only when simulation time is discarded or the runner resumes. */
  clockEpoch: number;
  /** Highest event ID at capture; a full ready uses this as its no-replay baseline. */
  eventCursor: number;
  /** Bounded, non-destructive history owned by this match/instance/clock epoch. */
  events: ServerEvent[];
  seq: number;
  tick: number;
  state: GameState;
  ack: { left: number; right: number };
}
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const matchId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

export function isMatchInput(value: unknown): value is MatchInput {
  if (!record(value)) return false;
  const fields = ['v', 'matchId', 'generation', 'seq', 'up', 'down', 'actionId'];
  return Object.keys(value).length === fields.length &&
    fields.every((field) => Object.prototype.hasOwnProperty.call(value, field)) &&
    value.v === PROTOCOL_VERSION && matchId(value.matchId) &&
    integer(value.generation) && value.generation > 0 &&
    integer(value.seq) && value.seq > 0 && integer(value.actionId) &&
    typeof value.up === 'boolean' && typeof value.down === 'boolean';
}

/** One authenticated room/connection owns each inbox. No message advances time. */
export class InputInbox {
  private latest: PlayerInput = { up: false, down: false, action: false };
  private lastSeen = -Infinity;
  private lastAction = 0;
  private tokens = 30;
  private tokenTime: number | undefined;
  private takenSeq = 0;
  public receivedSeq = 0;
  public ack = 0;
  constructor(readonly roomId: string, readonly generation: number,
    readonly ttlMs = 350) {}

  receive(value: unknown, nowMs: number): boolean {
    if (!Number.isFinite(nowMs) || !isMatchInput(value) ||
      value.matchId !== this.roomId || value.generation !== this.generation ||
      value.seq <= this.receivedSeq || value.seq - this.receivedSeq > 120 ||
      value.actionId < this.lastAction || value.actionId - this.lastAction > 16) return false;
    const elapsed = this.tokenTime === undefined ? 0 : Math.max(0, nowMs - this.tokenTime);
    this.tokens = Math.min(30, this.tokens + elapsed * 0.09);
    this.tokenTime = nowMs;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.latest = { up: value.up, down: value.down,
      action: this.latest.action || value.actionId > this.lastAction };
    this.lastAction = value.actionId;
    this.lastSeen = nowMs;
    this.receivedSeq = value.seq;
    return true;
  }

  take(nowMs: number): PlayerInput {
    if (!Number.isFinite(nowMs) || nowMs - this.lastSeen > this.ttlMs) this.clear();
    const result = { ...this.latest };
    this.takenSeq = this.receivedSeq;
    this.latest.action = false;
    return result;
  }

  /** Call only after the synchronous simulation step succeeds. */
  markApplied(): void { this.ack = this.takenSeq; }

  clear(): void {
    this.latest = { up: false, down: false, action: false };
    this.lastSeen = -Infinity;
  }
}

/** Capture data now; delayed transport must never retain mutable simulation state. */
export function captureSnapshot(state: GameState, id: string, seq: number,
  ack: Snapshot['ack'], clock: Pick<Snapshot, 'instanceId' | 'clockEpoch'>,
  feedback: Pick<Snapshot, 'events' | 'eventCursor'> = { events: [], eventCursor: 0 }): Snapshot {
  return { v: PROTOCOL_VERSION, matchId: id, instanceId: clock.instanceId,
    clockEpoch: clock.clockEpoch, seq, tick: state.tick,
    eventCursor: feedback.eventCursor, events: copyServerEvents(feedback.events),
    state: JSON.parse(JSON.stringify(state)) as GameState, ack: { ...ack } };
}

export function copyServerEvents(events: ServerEvent[]): ServerEvent[] {
  return events.map(({ id, event }) => ({ id, event: event.type === 'point'
    ? { ...event, score: { ...event.score } } : { ...event } }));
}

export function isGameEvent(value: unknown): value is GameEvent {
  if (!record(value) || !integer(value.tick)) return false;
  const side = (name: string) => ['left', 'right'].includes(value[name] as string);
  const fields = Object.keys(value).length;
  switch (value.type) {
    case 'wall': return fields === 2;
    case 'serve': return fields === 3 && integer(value.rallyId);
    case 'paddle': return fields === 3 && side('side');
    case 'finished': return fields === 3 && side('winner');
    case 'power': return fields === 5 && side('side') && typeof value.active === 'boolean' && integer(value.charge) && value.charge <= 5;
    case 'point': return fields === 4 && side('side') && record(value.score) && Object.keys(value.score).length === 2 &&
      integer(value.score.left) && integer(value.score.right) && value.score.left <= 99 && value.score.right <= 99;
    default: return false;
  }
}

function validEventHistory(value: Record<string, unknown>): boolean {
  if (!integer(value.eventCursor) || !Array.isArray(value.events) || value.events.length > MAX_SNAPSHOT_EVENTS) return false;
  let lastId = 0, lastTick = -1;
  for (const entry of value.events) {
    if (!record(entry) || Object.keys(entry).length !== 2 || !integer(entry.id) || entry.id <= lastId ||
      entry.id > value.eventCursor || !isGameEvent(entry.event) || entry.event.tick < lastTick ||
      entry.event.tick > (value.tick as number) || entry.event.tick < (value.tick as number) - EVENT_HISTORY_TICKS) return false;
    lastId = entry.id; lastTick = entry.event.tick;
  }
  return true;
}

/** Runtime validation is separate from static DTO typing. */
export function isSnapshot(value: unknown): value is Snapshot {
  if (!record(value) || value.v !== 1 || !matchId(value.matchId) ||
    !matchId(value.instanceId) || !integer(value.clockEpoch) ||
    !validEventHistory(value) ||
    !integer(value.seq) || !integer(value.tick) || !record(value.ack) ||
    !integer(value.ack.left) || !integer(value.ack.right) || !record(value.state)) return false;
  const state = value.state;
  if (state.tick !== value.tick || !integer(state.phaseTicks) || !integer(state.rallyId) ||
    !['ready', 'rally', 'point', 'finished'].includes(state.phase as string) ||
    !['left', 'right'].includes(state.serveToward as string) ||
    ![null, 'left', 'right'].includes(state.winner as null | string) ||
    (state.phase === 'finished') !== (state.winner !== null) ||
    !record(state.config) || !record(state.players) || !record(state.ball)) return false;
  let config: GameState['config'];
  try { config = createGame(state.config).config; } catch { return false; }
  if (Object.keys(config).some((key) => config[key as keyof typeof config] !== (state.config as Record<string, unknown>)[key])) return false;
  for (const side of ['left', 'right']) {
    const player = state.players[side];
    if (!record(player) || typeof player.powered !== 'boolean' ||
      !integer(player.charge) || player.charge > 5 || !integer(player.score) ||
      player.score > config.winningScore || typeof player.y !== 'number' || !Number.isFinite(player.y) ||
      player.width !== config.paddleWidth || typeof player.height !== 'number' ||
      player.height !== (player.powered ? config.poweredHeight : config.paddleHeight) ||
      player.y < 0 || player.y > config.height - player.height ||
      player.x !== (side === 'left' ? config.paddleInset : config.width - config.paddleInset - config.paddleWidth) ||
      (player.powered && (config.mode !== 'power' || player.charge === 0))) return false;
  }
  const players = state.players as unknown as GameState['players'];
  if (state.phase === 'finished') {
    const winner = state.winner as 'left' | 'right';
    if (players[winner].score !== config.winningScore ||
      players[winner === 'left' ? 'right' : 'left'].score >= config.winningScore) return false;
  } else if (players.left.score >= config.winningScore || players.right.score >= config.winningScore) return false;
  const ball = state.ball;
  if (['x', 'y', 'vx', 'vy'].some((key) => typeof ball[key] !== 'number' || !Number.isFinite(ball[key])) ||
    ball.radius !== config.ballRadius) return false;
  const { x, y, vx, vy } = ball as unknown as GameState['ball'];
  return x >= 0 && x <= config.width && y >= 0 && y <= config.height &&
    Math.hypot(vx, vy) <= config.maxBallSpeed + 0.001;
}

export interface ReadyMessage {
  v: 1;
  roomId: string;
  leftName: string;
  rightName: string;
  roomMode: boolean;
  side: 'left' | 'right' | 'spectator';
  generation: number;
  snapshot: Snapshot;
}

export function isReadyMessage(value: unknown): value is ReadyMessage {
  if (!record(value) || value.v !== 1 || !matchId(value.roomId) ||
    typeof value.leftName !== 'string' || value.leftName.length > 100 ||
    typeof value.rightName !== 'string' || value.rightName.length > 100 ||
    typeof value.roomMode !== 'boolean' || !integer(value.generation) || value.generation < 1 ||
    !['left', 'right', 'spectator'].includes(value.side as string) || !isSnapshot(value.snapshot)) return false;
  return value.roomId === value.snapshot.matchId &&
    value.roomMode === (value.snapshot.state.config.mode === 'power');
}

/** Versioned session recovery is separate from simulation/input protocol v1. */
export interface SessionSyncRequest {
  v: 1;
  requestId: string;
  matchId: string;
  role: 'player' | 'spectator';
}
export interface RecoveredResult {
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  outcome: 'won' | 'lost' | 'spectator';
}
type SyncIdentity = Pick<SessionSyncRequest, 'v' | 'requestId' | 'matchId'>;
export type SessionSyncResponse = SyncIdentity & (
  { status: 'active' | 'waiting'; ready: ReadyMessage } |
  { status: 'saving' | 'retrying' | 'saved' | 'failed'; result: RecoveredResult } |
  { status: 'unavailable' | 'error' }
);
export interface MatchEnded { v: 1; roomId: string; winner: 'left' | 'right' }
export function isSessionSyncRequest(value: unknown): value is SessionSyncRequest {
  return record(value) && Object.keys(value).length === 4 && value.v === 1 &&
    matchId(value.requestId) && typeof value.matchId === 'string' && /^[1-9][0-9]{0,15}$/.test(value.matchId) &&
    ['player', 'spectator'].includes(value.role as string);
}
export function isRecoveredResult(value: unknown): value is RecoveredResult {
  return record(value) && Object.keys(value).length === 5 &&
    ['winnerName', 'loserName'].every(key => typeof value[key] === 'string' && (value[key] as string).length <= 100) &&
    ['winnerScore', 'loserScore'].every(key => integer(value[key]) && (value[key] as number) <= 6) &&
    ['won', 'lost', 'spectator'].includes(value.outcome as string);
}
export function isSessionSyncResponse(value: unknown): value is SessionSyncResponse {
  if (!record(value) || value.v !== 1 || !matchId(value.requestId) || !matchId(value.matchId)) return false;
  if (['active', 'waiting'].includes(value.status as string)) return Object.keys(value).length === 5 &&
    isReadyMessage(value.ready) && value.ready.roomId === value.matchId;
  if (['saving', 'retrying', 'saved', 'failed'].includes(value.status as string)) return Object.keys(value).length === 5 && isRecoveredResult(value.result);
  return Object.keys(value).length === 4 && ['unavailable', 'error'].includes(value.status as string);
}
export function isMatchEnded(value: unknown): value is MatchEnded {
  return record(value) && Object.keys(value).length === 3 && value.v === 1 && matchId(value.roomId) &&
    ['left', 'right'].includes(value.winner as string);
}

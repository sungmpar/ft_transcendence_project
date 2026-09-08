import { createGame, GameState, PlayerInput } from './game-core';

export const PROTOCOL_VERSION = 1;
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
  ack: Snapshot['ack']): Snapshot {
  return { v: PROTOCOL_VERSION, matchId: id, seq, tick: state.tick,
    state: JSON.parse(JSON.stringify(state)) as GameState, ack: { ...ack } };
}

/** Runtime validation is separate from static DTO typing. */
export function isSnapshot(value: unknown): value is Snapshot {
  if (!record(value) || value.v !== 1 || !matchId(value.matchId) ||
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

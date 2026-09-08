import { cloneGameState, DEFAULT_CONFIG, GameState, PlayerState } from '../../../shared/game-core';
import { isSnapshot, Snapshot } from '../../../shared/protocol';

export type SnapshotDisplayMode = 'interpolate' | 'latest';
export interface SnapshotMetrics {
  depth: number;
  received: number;
  rejected: number;
  lastSeq: number | null;
  gaps: number;
  trimmed: number;
  underflowCount: number;
  /** Estimated tick-clock age; this is not measured one-way network latency. */
  displayDelayMs: number;
  arrivalIntervalMeanMs: number;
  /** Population standard deviation of accepted local arrival intervals. */
  arrivalJitterMs: number;
  presentationTick: number | null;
}
const TICK_MS = 1000 / 60;
const CAPACITY = 32;
const EPSILON = 0.000001;

function ownPlayer(player: PlayerState): PlayerState {
  return { x: player.x, y: player.y, width: player.width, height: player.height,
    score: player.score, charge: player.charge, powered: player.powered };
}

/** Copy only validated scalar fields; unknown payload properties are discarded. */
function ownState(state: GameState): GameState {
  const config = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    (config as unknown as Record<string, unknown>)[key] = (state.config as unknown as Record<string, unknown>)[key];
  }
  return {
    config, tick: state.tick, phase: state.phase, phaseTicks: state.phaseTicks,
    rallyId: state.rallyId, winner: state.winner, serveToward: state.serveToward,
    players: { left: ownPlayer(state.players.left), right: ownPlayer(state.players.right) },
    ball: { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy, radius: state.ball.radius },
  };
}

function continuous(a: GameState, b: GameState): boolean {
  return a.phase === b.phase && a.rallyId === b.rallyId && a.winner === b.winner
    && a.players.left.score === b.players.left.score && a.players.right.score === b.players.right.score
    && a.players.left.height === b.players.left.height && a.players.right.height === b.players.right.height
    && a.players.left.powered === b.players.left.powered && a.players.right.powered === b.players.right.powered
    && Object.keys(DEFAULT_CONFIG).every((key) =>
      (a.config as unknown as Record<string, unknown>)[key] === (b.config as unknown as Record<string, unknown>)[key]);
}

const blankMetrics = (): Omit<SnapshotMetrics, 'depth'> => ({
  received: 0, rejected: 0, lastSeq: null, gaps: 0, trimmed: 0, underflowCount: 0,
  displayDelayMs: 0, arrivalIntervalMeanMs: 0, arrivalJitterMs: 0, presentationTick: null,
});

/**
 * Owns no socket, RAF, or wall clock. The session filters the expected match ID;
 * call reset() before a same-match full resync. A new match ID resets this buffer.
 *
 * Clock offset is the minimum observed (arrivalMs - serverTickMs). This lower
 * envelope can advance the estimate but cannot rewind it on a delayed packet.
 * It is an arrival-based estimate, not synchronized clocks or one-way latency.
 * Presentation trails that estimate by 100ms by default. Missing future data
 * freezes the latest snapshot; discontinuities hold the older sample then snap.
 */
export class SnapshotBuffer {
  private snapshots: Snapshot[] = [];
  private matchId: string | null = null;
  private offsetMs: number | null = null;
  private lastArrivalMs: number | null = null;
  private lastDisplayMs: number | null = null;
  private intervalCount = 0;
  private intervalM2 = 0;
  private underflowing = false;
  private values = blankMetrics();

  constructor(readonly mode: SnapshotDisplayMode = 'interpolate', readonly delayMs = 100) {
    if (!['interpolate', 'latest'].includes(mode) || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 1000) {
      throw new Error('Unsupported snapshot display settings');
    }
  }

  get metrics(): SnapshotMetrics { return { ...this.values, depth: this.snapshots.length }; }

  reset(): void {
    this.snapshots = [];
    this.matchId = null;
    this.offsetMs = null;
    this.lastArrivalMs = null;
    this.lastDisplayMs = null;
    this.intervalCount = 0;
    this.intervalM2 = 0;
    this.underflowing = false;
    this.values = blankMetrics();
  }

  receive(value: unknown, localArrivalMs: number): boolean {
    if (!Number.isFinite(localArrivalMs) || !isSnapshot(value)) {
      this.values.rejected++;
      return false;
    }
    if (this.matchId !== null && this.matchId !== value.matchId) this.reset();
    const previous = this.snapshots[this.snapshots.length - 1];
    if (previous && (value.seq <= previous.seq || value.tick < previous.tick
      || localArrivalMs < (this.lastArrivalMs as number))) {
      this.values.rejected++;
      return false;
    }
    if (previous) this.values.gaps += Math.max(0, value.seq - previous.seq - 1);
    if (this.lastArrivalMs !== null) {
      const interval = localArrivalMs - this.lastArrivalMs;
      this.intervalCount++;
      const difference = interval - this.values.arrivalIntervalMeanMs;
      this.values.arrivalIntervalMeanMs += difference / this.intervalCount;
      this.intervalM2 += difference * (interval - this.values.arrivalIntervalMeanMs);
      this.values.arrivalJitterMs = Math.sqrt(Math.max(0, this.intervalM2 / this.intervalCount));
    }
    this.matchId = value.matchId;
    this.lastArrivalMs = localArrivalMs;
    const observedOffset = localArrivalMs - value.tick * TICK_MS;
    this.offsetMs = this.offsetMs === null ? observedOffset : Math.min(this.offsetMs, observedOffset);
    const captured: Snapshot = {
      v: 1, matchId: value.matchId, seq: value.seq, tick: value.tick,
      state: ownState(value.state), ack: { left: value.ack.left, right: value.ack.right },
    };
    if (previous && previous.tick === captured.tick) this.snapshots[this.snapshots.length - 1] = captured;
    else this.snapshots.push(captured);
    if (this.snapshots.length > CAPACITY) { this.snapshots.shift(); this.values.trimmed++; }
    this.values.received++;
    this.values.lastSeq = value.seq;
    return true;
  }

  display(localNowMs: number): GameState | null {
    if (!Number.isFinite(localNowMs) || this.snapshots.length === 0) return null;
    const now = Math.max(localNowMs, this.lastDisplayMs ?? localNowMs);
    this.lastDisplayMs = now;
    const estimatedTick = (now - (this.offsetMs as number)) / TICK_MS;
    const newest = this.snapshots[this.snapshots.length - 1];
    const target = Math.max(this.values.presentationTick ?? -Infinity,
      estimatedTick - (this.mode === 'latest' ? 0 : this.delayMs / TICK_MS));
    let state: GameState;
    let presentationTick: number;
    const underflow = this.mode === 'interpolate' && target > newest.tick + EPSILON;
    if (underflow && !this.underflowing) this.values.underflowCount++;
    this.underflowing = underflow;

    if (this.mode === 'latest' || target >= newest.tick - EPSILON) {
      state = cloneGameState(newest.state);
      presentationTick = newest.tick;
    } else if (target <= this.snapshots[0].tick + EPSILON) {
      state = cloneGameState(this.snapshots[0].state);
      presentationTick = this.snapshots[0].tick;
    } else {
      let index = 1;
      while (this.snapshots[index].tick < target - EPSILON) index++;
      const before = this.snapshots[index - 1];
      const after = this.snapshots[index];
      if (target >= after.tick - EPSILON) {
        state = cloneGameState(after.state);
        presentationTick = after.tick;
      } else if (!continuous(before.state, after.state)) {
        state = cloneGameState(before.state);
        presentationTick = before.tick;
      } else {
        const alpha = (target - before.tick) / (after.tick - before.tick);
        const lerp = (a: number, b: number) => a + (b - a) * alpha;
        state = cloneGameState(before.state);
        state.ball.x = lerp(before.state.ball.x, after.state.ball.x);
        state.ball.y = lerp(before.state.ball.y, after.state.ball.y);
        state.players.left.y = lerp(before.state.players.left.y, after.state.players.left.y);
        state.players.right.y = lerp(before.state.players.right.y, after.state.players.right.y);
        state.tick = Math.floor(target);
        state.phaseTicks = Math.max(0, Math.round(lerp(before.state.phaseTicks, after.state.phaseTicks)));
        presentationTick = target;
      }
    }
    this.values.presentationTick = presentationTick;
    this.values.displayDelayMs = Math.max(0, (estimatedTick - presentationTick) * TICK_MS);
    return state;
  }
}

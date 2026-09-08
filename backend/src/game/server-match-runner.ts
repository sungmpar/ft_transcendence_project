import {
  createGame,
  GameEvent,
  GameState,
  RandomSource,
  Side,
  stepGame,
} from '../../../shared/game-core';
import { advanceClock, createClock } from '../../../shared/fixed-clock';
import {
  captureSnapshot,
  InputInbox,
  Snapshot,
} from '../../../shared/protocol';

/** Clock/RNG are supplied by the server adapter; no sockets, Nest, or persistence. */
export class ServerMatchRunner {
  state: GameState;
  readonly inputs: Record<Side, InputInbox>;
  private clock = createClock();
  private lastNowMs: number;
  private lastSnapshotTick = 0;
  private snapshotSeq = 0;
  private active = true;
  private disposed = false;
  readonly metrics = { ticks: 0, droppedMs: 0 };

  constructor(
    readonly matchId: string,
    power: boolean,
    readonly generations: Record<Side, number>,
    nowMs: number,
    private readonly rng: RandomSource,
  ) {
    this.state = createGame({ mode: power ? 'power' : 'classic' });
    this.lastNowMs = nowMs;
    this.inputs = {
      left: new InputInbox(matchId, generations.left),
      right: new InputInbox(matchId, generations.right),
    };
  }

  start(nowMs = this.lastNowMs): void {
    if (this.disposed || this.active) return;
    this.active = true;
    this.lastNowMs = nowMs;
    this.clock = createClock();
  }

  stop(): void {
    this.active = false;
    this.clock = createClock();
    this.inputs.left.clear();
    this.inputs.right.clear();
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  receive(side: Side, payload: unknown, nowMs: number): boolean {
    return (
      this.active &&
      !this.disposed &&
      this.state.phase !== 'finished' &&
      this.inputs[side].receive(payload, nowMs)
    );
  }

  receiveWhilePaused(side: Side, payload: unknown, nowMs: number): boolean {
    if (this.disposed || this.state.phase === 'finished') return false;
    const accepted = this.inputs[side].receive(payload, nowMs);
    // Keep sequence accounting current without queuing movement or abilities
    // during another player's disconnect grace period.
    this.inputs[side].clear();
    return accepted;
  }

  replaceInput(side: Side, generation: number): void {
    this.generations[side] = generation;
    this.inputs[side] = new InputInbox(this.matchId, generation);
  }

  snapshot(): Snapshot {
    this.lastSnapshotTick = this.state.tick;
    return captureSnapshot(this.state, this.matchId, ++this.snapshotSeq, {
      left: this.inputs.left.ack,
      right: this.inputs.right.ack,
    });
  }

  advance(nowMs: number): { events: GameEvent[]; snapshot?: Snapshot } {
    if (!this.active || this.disposed) return { events: [] };
    const events: GameEvent[] = [];
    const elapsedMs = nowMs - this.lastNowMs;
    this.lastNowMs = nowMs;
    const result = advanceClock(this.clock, elapsedMs, () => {
      if (this.state.phase === 'finished') return;
      const next = stepGame(
        this.state,
        {
          left: this.inputs.left.take(nowMs),
          right: this.inputs.right.take(nowMs),
        },
        this.rng,
      );
      this.state = next.state;
      this.inputs.left.markApplied();
      this.inputs.right.markApplied();
      this.metrics.ticks++;
      events.push(...next.events);
    });
    this.clock = result.clock;
    this.metrics.droppedMs += result.droppedMs;
    // Nominal 20Hz snapshots; phase discontinuities are sent immediately.
    const boundary = events.some((event) =>
      ['serve', 'point', 'finished'].includes(event.type),
    );
    return {
      events,
      snapshot:
        boundary || this.state.tick - this.lastSnapshotTick >= 3
          ? this.snapshot()
          : undefined,
    };
  }
}

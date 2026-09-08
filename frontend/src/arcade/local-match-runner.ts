import {
  cloneGameState, createGame, createSeededRng, GameConfig, GameEvent, GameState, MatchInput, stepGame,
} from '../../../shared/game-core';
import { advanceClock, createClock } from '../../../shared/fixed-clock';

export interface FrameScheduler {
  request(callback: (timestamp: number) => void): number;
  cancel(id: number): void;
  now(): number;
}
export interface RunnerMetrics {
  frames: number;
  ticks: number;
  fps: number;
  droppedMs: number;
  simulationMs: number;
  maxFrameMs: number;
  lastSteps: number;
}
export interface RunnerOptions {
  config?: Partial<GameConfig>;
  seed: number;
  scheduler: FrameScheduler;
  input(state: GameState): MatchInput;
  frame(state: GameState, metrics: RunnerMetrics): void;
  events?(events: GameEvent[]): void;
  error?(error: Error): void;
}
const emptyMetrics = (): RunnerMetrics => ({
  frames: 0, ticks: 0, fps: 0, droppedMs: 0, simulationMs: 0, maxFrameMs: 0, lastSteps: 0,
});

/** One match owns one RAF and one clock. Pausing discards elapsed wall time. */
export class LocalMatchRunner {
  private state: GameState;
  private random: () => number;
  private clock = createClock();
  private running = false;
  private disposed = false;
  private generation = 0;
  private frameId: number | null = null;
  private previousTime: number | null = null;
  private fpsTime = 0;
  private fpsFrames = 0;
  private metrics = emptyMetrics();

  constructor(private options: RunnerOptions) {
    this.state = createGame(options.config);
    this.random = createSeededRng(options.seed);
  }
  get snapshot(): GameState { return cloneGameState(this.state); }
  get measurement(): RunnerMetrics { return { ...this.metrics }; }
  get active(): boolean { return this.running; }

  start(): void {
    if (this.disposed || this.running || this.state.phase === 'finished') return;
    this.running = true;
    this.previousTime = null;
    this.clock = createClock();
    this.fpsTime = 0;
    this.fpsFrames = 0;
    const generation = ++this.generation;
    this.frameId = this.options.scheduler.request((time) => this.advance(time, generation));
  }
  stop(): void {
    this.running = false;
    this.generation++;
    if (this.frameId !== null) this.options.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.previousTime = null;
    this.clock = createClock();
  }
  restart(): void {
    if (this.disposed) return;
    this.stop();
    this.state = createGame(this.options.config);
    this.random = createSeededRng(this.options.seed);
    this.metrics = emptyMetrics();
    this.options.frame(this.snapshot, this.measurement);
    this.start();
  }
  dispose(): void { this.stop(); this.disposed = true; }

  private advance(time: number, generation: number): void {
    if (!this.running || this.disposed || generation !== this.generation) return;
    this.frameId = null;
    try {
      const elapsed = this.previousTime === null ? 0 : Math.max(0, time - this.previousTime);
      this.previousTime = time;
      this.metrics.frames++;
      this.metrics.maxFrameMs = Math.max(this.metrics.maxFrameMs, elapsed);
      this.fpsTime += elapsed;
      if (elapsed > 0) this.fpsFrames++;
      if (this.fpsTime >= 500) {
        this.metrics.fps = this.fpsFrames * 1000 / this.fpsTime;
        this.fpsFrames = 0;
        this.fpsTime = 0;
      }
      const before = this.options.scheduler.now();
      let actualSteps = 0;
      const advance = advanceClock(this.clock, elapsed, () => {
        if (!this.running || generation !== this.generation) return;
        const result = stepGame(this.state, this.options.input(this.snapshot), this.random);
        this.state = result.state;
        actualSteps++;
        if (result.events.length) this.options.events?.(result.events);
        if (generation !== this.generation) return;
        if (this.state.phase === 'finished') this.running = false;
      });
      if (generation !== this.generation) return;
      this.clock = advance.clock;
      this.metrics.lastSteps = actualSteps;
      this.metrics.ticks = this.state.tick;
      this.metrics.droppedMs += advance.droppedMs;
      this.metrics.simulationMs += Math.max(0, this.options.scheduler.now() - before);
      this.options.frame(this.snapshot, this.measurement);
      if (this.running && generation === this.generation) {
        this.frameId = this.options.scheduler.request((timestamp) => this.advance(timestamp, generation));
      }
    } catch (error) {
      this.stop();
      this.options.error?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

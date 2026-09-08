import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createSeededRng, GameState } from '../../../shared/game-core';
import { Snapshot } from '../../../shared/protocol';
import { SnapshotBuffer } from '../../../frontend/src/arcade/snapshot-buffer';
import { ServerMatchRunner } from './server-match-runner';

const WARMUP_MS = 2500;
const RECOVERY_BOUND_MS = 300;
const BASE_TRANSIT_MS = 50;
const EPSILON = 0.00001;
interface Captured { snapshot: Snapshot; generatedAt: number; arrival: number }
interface InterpolationProof { localTime: number; beforeTick: number; afterTick: number;
  presentationTick: number; alpha: number; movingAxes: string[] }
const reports: Array<Record<string, unknown>> = [];

/** Synthetic scheduler/arrival clocks, real runner/core/input/buffer APIs.
 * No production state is assigned, no buffer offset is changed, and no mock
 * snapshot position is fabricated to satisfy the interpolation assertion.
 */
class CoupledClockFixture {
  readonly runner = new ServerMatchRunner('clock-fixture', false, { left: 1, right: 2 }, 0, createSeededRng(23));
  readonly buffer = new SnapshotBuffer();
  readonly delivered: Captured[] = [];
  readonly proofs: InterpolationProof[] = [];
  private queue: Captured[] = [];
  private snapshotNumber = 0;
  private inputSequence = 0;
  private lastInput = -Infinity;
  now = 0;
  firstSecond: { ticks: number; snapshots: number } | undefined;
  constructor(private jitter: (index: number) => number = () => 0) {}

  server(now: number): void {
    if (now - this.lastInput >= 20) {
      this.lastInput = now;
      const up = this.runner.state.tick % 24 < 12;
      const sequence = ++this.inputSequence;
      for (const side of ['left', 'right'] as const) {
        const movingUp = side === 'left' ? up : !up;
        const accepted = this.runner.receive(side, { v: 1, matchId: this.runner.matchId,
          generation: this.runner.generations[side], seq: sequence, actionId: 0,
          up: movingUp, down: !movingUp }, now);
        if (!accepted) throw new Error('Clock fixture input was unexpectedly rejected');
      }
    }
    const result = this.runner.advance(now);
    if (result.snapshot) {
      this.queue.push({ snapshot: result.snapshot, generatedAt: now,
        arrival: now + BASE_TRANSIT_MS + this.jitter(this.snapshotNumber++) });
    }
    if (now === 1000) this.firstSecond = { ticks: this.runner.metrics.ticks, snapshots: this.snapshotNumber };
  }

  client(now: number): void {
    this.queue.sort((a, b) => a.arrival - b.arrival);
    while (this.queue[0]?.arrival <= now) {
      const delivery = this.queue.shift()!;
      if (this.buffer.receive(delivery.snapshot, delivery.arrival)) this.delivered.push(delivery);
    }
    // Sample halfway between scheduler callbacks to require fractional presentation.
    const displayed = this.buffer.display(now + 5);
    if (!displayed) return;
    const tick = this.buffer.metrics.presentationTick;
    if (tick === null) return;
    for (let index = 1; index < this.delivered.length; index++) {
      const before = this.delivered[index - 1], after = this.delivered[index];
      if (!(before.snapshot.tick + EPSILON < tick && tick < after.snapshot.tick - EPSILON)) continue;
      if (!sameInterval(before.snapshot.state, after.snapshot.state)) return;
      const alpha = (tick - before.snapshot.tick) / (after.snapshot.tick - before.snapshot.tick);
      const axes = coordinates(before.snapshot.state), next = coordinates(after.snapshot.state), shown = coordinates(displayed);
      const movingAxes = Object.keys(axes).filter((key) => Math.abs(next[key] - axes[key]) > EPSILON);
      if (!movingAxes.length) return;
      // Every interpolated coordinate must equal the actual captured endpoints' lerp.
      for (const key of Object.keys(axes)) {
        const expected = axes[key] + (next[key] - axes[key]) * alpha;
        if (Math.abs(shown[key] - expected) > EPSILON) return;
      }
      for (const key of movingAxes) {
        if (!(shown[key] > Math.min(axes[key], next[key]) + EPSILON &&
          shown[key] < Math.max(axes[key], next[key]) - EPSILON)) return;
      }
      this.proofs.push({ localTime: now + 5, beforeTick: before.snapshot.tick,
        afterTick: after.snapshot.tick, presentationTick: tick, alpha, movingAxes });
      return;
    }
  }

  runTo(until: number, serverRuns = true): void {
    while (this.now < until) {
      this.now += 10;
      if (serverRuns) this.server(this.now);
      this.client(this.now);
    }
  }

  recoveryProof(resumedAt: number): InterpolationProof | undefined {
    const postResumeTicks = new Set(this.delivered.filter((packet) => packet.generatedAt >= resumedAt).map((packet) => packet.snapshot.tick));
    return this.proofs.find((proof) => proof.localTime >= resumedAt &&
      proof.localTime <= resumedAt + RECOVERY_BOUND_MS &&
      postResumeTicks.has(proof.beforeTick) && postResumeTicks.has(proof.afterTick));
  }
}
function coordinates(state: GameState): Record<string, number> {
  return { ballX: state.ball.x, ballY: state.ball.y, leftY: state.players.left.y, rightY: state.players.right.y };
}
function sameInterval(a: GameState, b: GameState): boolean {
  return a.phase === b.phase && a.rallyId === b.rallyId && a.winner === b.winner &&
    a.players.left.score === b.players.left.score && a.players.right.score === b.players.right.score &&
    a.players.left.height === b.players.left.height && a.players.right.height === b.players.right.height &&
    a.players.left.powered === b.players.left.powered && a.players.right.powered === b.players.right.powered;
}
function warmup(): CoupledClockFixture {
  const fixture = new CoupledClockFixture();
  fixture.runTo(WARMUP_MS);
  expect(fixture.firstSecond).toEqual({ ticks: 60, snapshots: 20 });
  expect(fixture.proofs.length).toBeGreaterThan(30);
  return fixture;
}
function assertRecovery(name: string, fixture: CoupledClockFixture, resumedAt: number, droppedBefore: number): void {
  fixture.runTo(resumedAt + RECOVERY_BOUND_MS);
  const proof = fixture.recoveryProof(resumedAt);
  reports.push({ name, status: proof ? 'PASS' : 'FAIL', resumedAt, recoveryBoundMs: RECOVERY_BOUND_MS,
    droppedMs: fixture.runner.metrics.droppedMs - droppedBefore,
    proof: proof || null, finalPresentationTick: fixture.buffer.metrics.presentationTick,
    finalServerTick: fixture.runner.state.tick, underflowEpisodes: fixture.buffer.metrics.underflowCount,
    clockEpoch: fixture.buffer.metrics.clockEpoch, explicitResyncs: fixture.buffer.metrics.resyncCount });
  expect(proof).toBeDefined();
}

describe('real runner and buffer recover interpolation after scheduler time loss', () => {
  afterAll(() => {
    const evidence = resolve(__dirname, '../../../docs/home-online-polish/evidence');
    mkdirSync(evidence, { recursive: true });
    const name = process.env.ARCADE_CLOCK_REPORT || 'clock-recovery';
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(name)) throw new Error('Invalid clock evidence filename');
    writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({
      environment: 'Synthetic 10ms scheduler/50ms transit/10ms client sampling; real ServerMatchRunner and SnapshotBuffer; no WAN or browser claims',
      criterion: 'Within 300ms after resumption, presentation tick and moving coordinates strictly between two actual post-resume snapshots, with exact lerp coordinates',
      reports,
    }, null, 2));
  });

  it('establishes real 60Hz simulation/20Hz delivery and strict interpolation before impairment', () => {
    const fixture = warmup();
    reports.push({ name: 'normal', status: 'PASS', firstSecond: fixture.firstSecond,
      strictInterpolationSamples: fixture.proofs.length, sample: fixture.proofs[0] });
    expect(fixture.runner.metrics.droppedMs).toBe(0);
  });

  it.each([200, 500, 1000])('recovers strict interpolation within 300ms after a %dms server stall', (stallMs) => {
    const fixture = warmup();
    const droppedBefore = fixture.runner.metrics.droppedMs;
    fixture.runTo(WARMUP_MS + stallMs, false);
    const resumedAt = fixture.now;
    fixture.server(resumedAt);
    fixture.client(resumedAt);
    expect(fixture.runner.metrics.droppedMs).toBeGreaterThan(droppedBefore);
    assertRecovery(`stall-${stallMs}`, fixture, resumedAt, droppedBefore);
  });

  it('recovers within the same bound after each of three separate 500ms stalls', () => {
    const fixture = warmup();
    const proofs: Array<InterpolationProof | undefined> = [];
    for (let count = 0; count < 3; count++) {
      const before = fixture.runner.metrics.droppedMs;
      fixture.runTo(fixture.now + 500, false);
      const resumedAt = fixture.now;
      fixture.server(resumedAt); fixture.client(resumedAt);
      fixture.runTo(resumedAt + RECOVERY_BOUND_MS);
      const proof = fixture.recoveryProof(resumedAt); proofs.push(proof);
      reports.push({ name: `repeated-stall-${count + 1}`, status: proof ? 'PASS' : 'FAIL', resumedAt,
        droppedMs: fixture.runner.metrics.droppedMs - before, proof: proof || null,
        clockEpoch: fixture.buffer.metrics.clockEpoch, explicitResyncs: fixture.buffer.metrics.resyncCount });
    }
    expect(proofs.every(Boolean)).toBe(true);
  });

  it('keeps real interpolation and monotone presentation under bounded ±40ms arrival jitter', () => {
    const jitter = [-40, -20, 0, 20, 40, 20, 0, -20];
    const fixture = new CoupledClockFixture((index) => jitter[index % jitter.length]);
    let last = -Infinity;
    for (let until = 10; until <= WARMUP_MS; until += 10) {
      fixture.runTo(until);
      const current = fixture.buffer.metrics.presentationTick;
      if (current !== null) { expect(current).toBeGreaterThanOrEqual(last); last = current; }
    }
    expect(fixture.proofs.length).toBeGreaterThan(30);
    expect(fixture.runner.metrics.droppedMs).toBe(0);
    reports.push({ name: 'arrival-jitter-40ms', status: 'PASS', strictInterpolationSamples: fixture.proofs.length,
      presentationNeverReversed: true, droppedMs: 0 });
  });

  it('recovers after a deliberate 500ms server pause/resume without inventing simulation ticks', () => {
    const fixture = warmup();
    const pausedTick = fixture.runner.state.tick;
    const droppedBefore = fixture.runner.metrics.droppedMs;
    fixture.runner.stop();
    fixture.runTo(WARMUP_MS + 500, false);
    expect(fixture.runner.state.tick).toBe(pausedTick);
    const resumedAt = fixture.now;
    fixture.runner.start(resumedAt);
    assertRecovery('pause-resume-500ms', fixture, resumedAt, droppedBefore);
    expect(fixture.runner.metrics.droppedMs).toBe(droppedBefore);
  });

  it('requires a fresh full-state buffer to accept a new runner incarnation and rejects delayed previous-instance packets', () => {
    const fixture = warmup();
    const oldPacket = fixture.runner.snapshot();
    const restarted = new ServerMatchRunner(fixture.runner.matchId, false, { left: 1, right: 2 },
      fixture.now, createSeededRng(23));
    restarted.advance(fixture.now + 50);
    const readySnapshot = restarted.snapshot();
    expect(readySnapshot.instanceId).not.toBe(oldPacket.instanceId);
    expect(readySnapshot.clockEpoch).toBe(0);
    expect(fixture.buffer.receive(readySnapshot, fixture.now + 100)).toBe(false);
    fixture.buffer.reset(); // A newly accepted full ready/session owns this boundary.
    expect(fixture.buffer.receive(readySnapshot, fixture.now + 100)).toBe(true);
    expect(fixture.buffer.display(fixture.now + 100)!.tick).toBe(readySnapshot.tick);
    expect(fixture.buffer.receive(oldPacket, fixture.now + 150)).toBe(false);
    reports.push({ name: 'new-runner-instance-full-state-boundary', status: 'PASS',
      distinctInstances: true, newRunnerTick: readySnapshot.tick,
      unsolicitedInstanceRejected: true, delayedPriorInstanceRejected: true,
      scope: 'Two actual runner objects; does not claim process restart or persistence restoration' });
  });
});

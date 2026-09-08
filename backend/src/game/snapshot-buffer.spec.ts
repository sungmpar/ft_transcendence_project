import { SnapshotBuffer } from '../../../frontend/src/arcade/snapshot-buffer';
import { captureSnapshot, Snapshot } from '../../../shared/protocol';
import { createGame, createSeededRng, NEUTRAL_INPUT, stepGame } from '../../../shared/game-core';

function snapshot(tick: number, seq: number, id = 'match-1'): Snapshot {
  const state = stepGame(createGame({ readyTicks: 0 }), {
    left: NEUTRAL_INPUT, right: NEUTRAL_INPUT,
  }, createSeededRng(1)).state;
  state.tick = tick;
  state.ball.x = 300 + tick * 2;
  state.ball.y = 200 + tick;
  state.players.left.y = 100 + tick;
  state.players.right.y = 500 - tick;
  return captureSnapshot(state, id, seq, { left: seq, right: seq });
}

describe('captured snapshot presentation buffer', () => {
  it('presents real 60Hz core snapshots captured at 20Hz with 200ms injected arrival delay', () => {
    const buffer = new SnapshotBuffer();
    let state = createGame({ readyTicks: 1, pointTicks: 6 });
    const rng = createSeededRng(23);
    const captured = new Map<number, Snapshot>();
    let comparisons = 0;
    for (let tick = 1; tick <= 120; tick++) {
      state = stepGame(state, {
        left: { up: tick % 60 < 30, down: tick % 60 >= 30, action: false },
        right: NEUTRAL_INPUT,
      }, rng).state;
      if (tick % 3 !== 0) continue;
      const packet = captureSnapshot(state, 'actual-core', tick / 3, { left: tick, right: tick });
      captured.set(tick, packet);
      const arrival = tick * 1000 / 60 + 200;
      expect(buffer.receive(packet, arrival)).toBe(true);
      const before = captured.get(tick - 6);
      const after = captured.get(tick - 3);
      if (!before || !after || before.state.phase !== after.state.phase
        || before.state.rallyId !== after.state.rallyId) continue;
      const shown = buffer.display(arrival + 25)!;
      expect(shown.ball.x).toBeCloseTo((before.state.ball.x + after.state.ball.x) / 2);
      expect(shown.players.left.y).toBeCloseTo((before.state.players.left.y + after.state.players.left.y) / 2);
      expect(shown.players.right.y).toBeCloseTo((before.state.players.right.y + after.state.players.right.y) / 2);
      comparisons++;
    }
    expect(comparisons).toBeGreaterThan(30);
  });

  it('validates packets and caller time at runtime without changing valid state', () => {
    const buffer = new SnapshotBuffer();
    expect(buffer.receive(null, 0)).toBe(false);
    expect(buffer.receive(snapshot(0, 1), Number.NaN)).toBe(false);
    const malformed = snapshot(0, 1);
    malformed.state.ball.vx = Number.NaN;
    expect(buffer.receive(malformed, 0)).toBe(false);
    expect(buffer.display(0)).toBeNull();
    expect(buffer.metrics.rejected).toBe(3);
  });

  it('captures owned scalars and returns independently owned display state', () => {
    const buffer = new SnapshotBuffer('latest');
    const source = snapshot(0, 1);
    expect(buffer.receive(source, 0)).toBe(true);
    source.state.ball.x = 999;
    source.state.players.left.y = 999;
    const shown = buffer.display(0)!;
    expect(shown.ball.x).toBe(300);
    expect(shown.players.left.y).toBe(100);
    shown.ball.x = 111;
    expect(buffer.display(0)!.ball.x).toBe(300);
  });

  it('interpolates ball and both paddles with one common tick axis', () => {
    const buffer = new SnapshotBuffer();
    buffer.receive(snapshot(0, 1), 0);
    buffer.receive(snapshot(6, 2), 100);
    const state = buffer.display(150)!; // presentation tick 3
    expect(state.ball.x).toBeCloseTo(306);
    expect(state.ball.y).toBeCloseTo(203);
    expect(state.players.left.y).toBeCloseTo(103);
    expect(state.players.right.y).toBeCloseTo(497);
    expect(buffer.metrics.presentationTick).toBeCloseTo(3);
    expect(buffer.metrics.displayDelayMs).toBeCloseTo(100);
  });

  it('does not move presentation backward after a later jittered arrival or regressing local call', () => {
    const buffer = new SnapshotBuffer();
    buffer.receive(snapshot(0, 1), 0);
    buffer.receive(snapshot(6, 2), 100);
    const first = buffer.display(150)!.ball.x;
    buffer.receive(snapshot(12, 3), 260); // 60ms extra arrival delay
    expect(buffer.display(260)!.ball.x).toBeGreaterThanOrEqual(first);
    const tick = buffer.metrics.presentationTick!;
    buffer.display(100);
    expect(buffer.metrics.presentationTick).toBeGreaterThanOrEqual(tick);
  });

  it('discards late/duplicate sequences, backwards ticks and backwards arrival times', () => {
    const buffer = new SnapshotBuffer();
    expect(buffer.receive(snapshot(6, 2), 100)).toBe(true);
    expect(buffer.receive(snapshot(0, 1), 150)).toBe(false);
    expect(buffer.receive(snapshot(6, 2), 160)).toBe(false);
    expect(buffer.receive(snapshot(3, 3), 170)).toBe(false);
    expect(buffer.receive(snapshot(9, 3), 90)).toBe(false);
    expect(buffer.metrics.lastSeq).toBe(2);
  });

  it('freezes on underflow without extrapolation and counts underflow episodes', () => {
    const buffer = new SnapshotBuffer();
    buffer.receive(snapshot(0, 1), 0);
    buffer.receive(snapshot(6, 2), 100);
    expect(buffer.display(1000)!.ball.x).toBe(312);
    expect(buffer.display(2000)!.ball.x).toBe(312);
    expect(buffer.metrics.underflowCount).toBe(1);
    expect(buffer.metrics.displayDelayMs).toBeCloseTo(1900);
    buffer.receive(snapshot(126, 3), 2100);
    buffer.display(2100);
    expect(buffer.metrics.presentationTick).toBeCloseTo(120);
    buffer.display(2400);
    expect(buffer.metrics.underflowCount).toBe(2);
  });

  it('holds across a point reset, then snaps without drawing the goal-to-center path', () => {
    const buffer = new SnapshotBuffer();
    const old = snapshot(0, 1);
    old.state.ball.x = 1180;
    const scored = snapshot(6, 2);
    scored.state.phase = 'point';
    scored.state.players.left.score = 1;
    scored.state.ball = { ...scored.state.ball, x: 600, y: 400, vx: 0, vy: 0 };
    buffer.receive(old, 0);
    buffer.receive(scored, 100);
    expect(buffer.display(150)!.ball.x).toBe(1180);
    expect(buffer.display(150)!.players.left.score).toBe(0);
    expect(buffer.display(200)!.ball.x).toBe(600);
    expect(buffer.display(200)!.players.left.score).toBe(1);
  });

  it.each(['rallyId', 'score', 'height', 'config'])('does not interpolate across a %s discontinuity', (kind) => {
    const buffer = new SnapshotBuffer();
    const old = snapshot(0, 1);
    const next = snapshot(6, 2);
    if (kind === 'rallyId') next.state.rallyId++;
    if (kind === 'score') next.state.players.left.score++;
    if (kind === 'height') {
      old.state.config = { ...old.state.config, mode: 'power' };
      next.state.config = { ...next.state.config, mode: 'power' };
      next.state.players.left.powered = true;
      next.state.players.left.charge = 5;
      next.state.players.left.height = 400;
    }
    if (kind === 'config') next.state.config = { ...next.state.config, ballSpeed: 800 };
    expect(buffer.receive(old, 0)).toBe(true);
    expect(buffer.receive(next, 100)).toBe(true);
    expect(buffer.display(150)!.ball.x).toBe(300);
    expect(buffer.display(200)!.ball.x).toBe(312);
  });

  it('clears state on match replacement and explicit full resynchronization', () => {
    const buffer = new SnapshotBuffer();
    buffer.receive(snapshot(60, 20), 1000);
    buffer.display(1200);
    expect(buffer.receive(snapshot(0, 1, 'match-2'), 1300)).toBe(true);
    expect(buffer.display(1300)!.tick).toBe(0);
    expect(buffer.metrics.depth).toBe(1);
    buffer.reset();
    expect(buffer.display(1400)).toBeNull();
    expect(buffer.receive(snapshot(3, 1, 'match-2'), 1400)).toBe(true);
    expect(buffer.display(1400)!.tick).toBe(3);
  });

  it('bounds retained snapshots at 32 and records actual sequence gaps/arrival jitter', () => {
    const buffer = new SnapshotBuffer();
    for (let index = 0; index < 100; index++) buffer.receive(snapshot(index, index * 2 + 1), index * 20);
    expect(buffer.metrics.depth).toBe(32);
    expect(buffer.metrics.received).toBe(100);
    expect(buffer.metrics.gaps).toBe(99);
    expect(buffer.metrics.arrivalIntervalMeanMs).toBe(20);
    expect(buffer.metrics.arrivalJitterMs).toBe(0);
    expect(buffer.metrics.trimmed).toBe(68);
  });

  it('computes arrival interval statistics from actual accepted arrival times', () => {
    const buffer = new SnapshotBuffer();
    buffer.receive(snapshot(0, 1), 0);
    buffer.receive(snapshot(3, 2), 40);
    buffer.receive(snapshot(6, 3), 100);
    expect(buffer.metrics.arrivalIntervalMeanMs).toBe(50);
    expect(buffer.metrics.arrivalJitterMs).toBe(10);
  });

  it('supports a latest-state comparator using the same captured snapshots', () => {
    const latest = new SnapshotBuffer('latest');
    const buffered = new SnapshotBuffer('interpolate');
    for (const buffer of [latest, buffered]) {
      buffer.receive(snapshot(0, 1), 0);
      buffer.receive(snapshot(6, 2), 100);
    }
    expect(latest.display(150)!.ball.x).toBe(312);
    expect(buffered.display(150)!.ball.x).toBe(306);
    expect(latest.metrics.displayDelayMs).toBeCloseTo(50);
  });
});

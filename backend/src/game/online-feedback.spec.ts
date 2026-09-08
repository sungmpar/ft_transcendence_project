import { createSeededRng, GameEvent } from '../../../shared/game-core';
import { isSnapshot } from '../../../shared/protocol';
import { ServerMatchRunner } from './server-match-runner';

describe('authoritative online event capture', () => {
  it('does not postpone the next 20Hz broadcast when an individual full state is captured', () => {
    const runner = new ServerMatchRunner('41', false, { left: 1, right: 2 }, 0, createSeededRng(23));
    runner.advance(17);
    runner.snapshot(); // A new spectator or sessionSync full state.
    expect(runner.advance(50).snapshot).toBeDefined();
  });

  it('retains an actual between-broadcast collision for the next snapshot and independent full-state readers', () => {
    const runner = new ServerMatchRunner('41', false, { left: 1, right: 2 }, 0, createSeededRng(23));
    let pending: GameEvent | undefined;
    let sequence = 0;
    for (let now = 10; now <= 20000; now += 10) {
      if (now % 20 === 0) for (const side of ['left', 'right'] as const) {
        const player = runner.state.players[side];
        const down = runner.state.ball.y > player.y + player.height / 2;
        runner.receive(side, { v: 1, matchId: '41', generation: runner.generations[side],
          seq: side === 'left' ? ++sequence : sequence, up: !down, down, actionId: 0 }, now);
      }
      const result = runner.advance(now);
      if (!result.snapshot) pending ||= result.events.find(event => event.type === 'paddle' || event.type === 'wall');
      if (!pending || !result.snapshot) continue;
      const first = (result.snapshot as any).events;
      expect(Array.isArray(first)).toBe(true);
      const captured = first.find((entry: any) => JSON.stringify(entry.event) === JSON.stringify(pending));
      expect(captured).toBeDefined();
      const individual = runner.snapshot() as any;
      expect(individual.events).toContainEqual(captured);
      const another = runner.snapshot() as any;
      expect(another.events).toContainEqual(captured);
      expect(another.eventCursor).toBe(individual.eventCursor);
      first[0].event.tick = -10;
      expect((runner.snapshot() as any).events.every((entry: any) => entry.event.tick >= 0)).toBe(true);
      return;
    }
    throw new Error('The legal-control fixture did not encounter a between-broadcast collision');
  });

  it('bounds history by size and tick age, and keeps its watermark while a new clock epoch skips old effects', () => {
    const runner = new ServerMatchRunner('41', true, { left: 1, right: 2 }, 0, createSeededRng(23));
    // Unit stress fixture: prepare legal Power-ready states before actual core
    // steps; this artificial recharge loop is not claimed as real match play.
    runner.state.phase = 'rally';
    for (let index = 1; index <= 80; index++) {
      for (const side of ['left', 'right'] as const) {
        const player = runner.state.players[side]; player.powered = false; player.height = 200; player.charge = 5;
        runner.receive(side, { v: 1, matchId: '41', generation: runner.generations[side],
          seq: index, up: false, down: false, actionId: index }, index * 1000 / 60);
      }
      runner.advance(index * 1000 / 60);
    }
    const captured = runner.snapshot();
    expect(isSnapshot(captured)).toBe(true);
    expect(captured.events).toHaveLength(64);
    expect(captured.eventCursor).toBe(160);
    for (let index = 81; index <= 201; index++) runner.advance(index * 1000 / 60);
    expect(runner.snapshot().events).toEqual([]);
    runner.stop(); runner.start(4000);
    const resumed = runner.snapshot();
    expect(resumed.clockEpoch).toBe(1);
    expect(resumed.eventCursor).toBe(captured.eventCursor);
    expect(resumed.events).toEqual([]);
    expect(resumed.instanceId).toBe(captured.instanceId);
  });
});

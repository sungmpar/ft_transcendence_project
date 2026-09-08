import { EventPresentation } from '../../../frontend/src/arcade/event-presentation';
import { createGame, GameEvent } from '../../../shared/game-core';
import { captureSnapshot, ServerEvent, Snapshot } from '../../../shared/protocol';

function packet(tick = 0, seq = 0, events: ServerEvent[] = [], clockEpoch = 0): Snapshot {
  const state = createGame(); state.tick = tick;
  return captureSnapshot(state, '41', seq, { left: 0, right: 0 }, { instanceId: 'event-fixture', clockEpoch },
    { eventCursor: events[events.length - 1]?.id || 0, events });
}
const hit = (id: number, tick: number): ServerEvent => ({ id, event: { type: 'paddle', tick, side: 'left' } });

describe('authoritative event presentation, separate from packet arrival', () => {
  it('waits for the fractional presentation clock and suppresses repeated history and old packets', () => {
    const presentation = new EventPresentation(packet());
    presentation.receive(packet(12, 1, [hit(1, 10), hit(2, 12)]));
    expect(presentation.take(9.9)).toEqual([]);
    expect(presentation.take(10)).toEqual([hit(1, 10).event]);
    presentation.receive(packet(13, 2, [hit(1, 10), hit(2, 12)]));
    presentation.receive(packet(12, 1, [hit(1, 10)]));
    expect(presentation.take(12)).toEqual([hit(2, 12).event]);
    expect(presentation.take(13)).toEqual([]);
    expect(presentation.metrics).toEqual({ received: 2, presented: 2, skipped: 0, queued: 0 });
  });

  it('uses an immutable full-ready cursor as a history baseline for late join/reconnect', () => {
    const initial = packet(12, 5, [hit(8, 10), hit(9, 12)]);
    const presentation = new EventPresentation(initial);
    initial.eventCursor = 0;
    presentation.receive(packet(15, 6, [hit(8, 10), hit(9, 12), hit(10, 15)]));
    expect(presentation.take(15)).toEqual([hit(10, 15).event]);
    expect(presentation.metrics.presented).toBe(1);
  });

  it('owns copied event payloads and bounds pending history to 64 entries', () => {
    const presentation = new EventPresentation(packet());
    const first = packet(64, 1, Array.from({ length: 64 }, (_, index) => hit(index + 1, index + 1)));
    presentation.receive(first); first.events[63].event.tick = 999;
    const second = packet(100, 2, Array.from({ length: 64 }, (_, index) => hit(index + 37, index + 37)));
    presentation.receive(second);
    expect(presentation.metrics).toMatchObject({ received: 100, queued: 64, skipped: 36 });
    expect(presentation.take(64).some(event => event.tick === 64)).toBe(true);
  });

  it('skips effects more than six ticks late and clears older hits at a displayed point/serve boundary', () => {
    const presentation = new EventPresentation(packet());
    const score: GameEvent = { type: 'point', tick: 12, side: 'left', score: { left: 1, right: 0 } };
    presentation.receive(packet(12, 1, [hit(1, 2), hit(2, 11), { id: 3, event: score }]));
    expect(presentation.take(12)).toEqual([score]);
    presentation.receive(packet(20, 2, [hit(4, 20)]));
    expect(presentation.take(26)).toEqual([hit(4, 20).event]);
    presentation.receive(packet(30, 3, [hit(5, 30)]));
    expect(presentation.take(36.01)).toEqual([]);
    expect(presentation.metrics.skipped).toBe(3);
  });

  it('drops queued and new full-state history on epoch changes and rejects other match/instance streams', () => {
    const presentation = new EventPresentation(packet());
    presentation.receive(packet(3, 1, [hit(1, 3)]));
    presentation.receive(packet(6, 2, [hit(2, 6)], 1));
    expect(presentation.take(6)).toEqual([]);
    presentation.receive({ ...packet(9, 3, [hit(3, 9)], 1), instanceId: 'other-instance' });
    presentation.receive({ ...packet(9, 3, [hit(3, 9)], 1), matchId: '42' });
    presentation.receive(packet(9, 3, [hit(3, 9)], 0));
    expect(presentation.metrics.queued).toBe(0);
    presentation.receive(packet(9, 3, [hit(3, 9)], 1));
    expect(presentation.take(9)).toEqual([hit(3, 9).event]);
  });

  it('terminal snap plays only actual terminal-tick point/finished events once, never earlier hits', () => {
    const presentation = new EventPresentation(packet());
    const point: GameEvent = { type: 'point', tick: 12, side: 'left', score: { left: 6, right: 0 } };
    const finished: GameEvent = { type: 'finished', tick: 12, winner: 'left' };
    const terminal = packet(12, 1, [hit(1, 9), { id: 2, event: point }, { id: 3, event: finished }]);
    terminal.state.phase = 'finished'; terminal.state.winner = 'left'; terminal.state.players.left.score = 6;
    presentation.receive(terminal);
    expect(presentation.take(5)).toEqual([]); // The usual 100ms buffer is still behind.
    expect(presentation.terminal(terminal)).toEqual([point, finished]);
    expect(presentation.terminal(terminal)).toEqual([]);
    expect(presentation.metrics).toMatchObject({ presented: 2, skipped: 1, queued: 0 });
  });

  it('does not fabricate a score effect for forfeit/disconnect completion and clears every pending event on disposal', () => {
    const presentation = new EventPresentation(packet());
    const forfeit = packet(12, 1, [hit(1, 12)]);
    presentation.receive(forfeit);
    expect(presentation.terminal(forfeit)).toEqual([]);
    presentation.dispose(); presentation.receive(packet(15, 2, [hit(2, 15)]));
    expect(presentation.take(15)).toEqual([]);
    expect(presentation.metrics.queued).toBe(0);
  });
});

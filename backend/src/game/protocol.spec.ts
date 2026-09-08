import { createGame } from '../../../shared/game-core';
import { captureSnapshot, InputInbox, isMatchInput, isSnapshot, MatchInput, isSessionSyncRequest, isSessionSyncResponse, isMatchEnded } from '../../../shared/protocol';

const packet = (changes: Partial<MatchInput> = {}): MatchInput => ({
  v: 1, matchId: '41', generation: 1, seq: 1,
  up: false, down: false, actionId: 0, ...changes,
});

describe('versioned recovery and identified match end envelopes', () => {
  it('rejects scalar endings and malformed or oversized recovery identities', () => {
    expect(isMatchEnded('left')).toBe(false);
    expect(isMatchEnded({ v: 1, roomId: '41', winner: 'left' })).toBe(true);
    expect(isMatchEnded({ v: 1, roomId: '', winner: 'left' })).toBe(false);
    const request = { v: 1, requestId: 'sync-1', matchId: '41', role: 'player' };
    expect(isSessionSyncRequest(request)).toBe(true);
    for (const invalid of [{ ...request, matchId: '41extra' }, { ...request, requestId: 'x'.repeat(65) },
      { ...request, userId: 1 }, { ...request, role: 'admin' }, { ...request, v: 2 }]) expect(isSessionSyncRequest(invalid)).toBe(false);
  });
  it('bounds confirmed results and keeps storage failure distinct from a fake score', () => {
    const value = { v: 1, requestId: 'sync-1', matchId: '41', status: 'failed',
      result: { winnerName: 'a', loserName: 'b', winnerScore: 0, loserScore: 0, outcome: 'lost' } };
    expect(isSessionSyncResponse(value)).toBe(true);
    expect(isSessionSyncResponse({ ...value, result: { ...value.result, winnerScore: 7 } })).toBe(false);
    expect(isSessionSyncResponse({ ...value, result: { ...value.result, outcome: 'unknown' } })).toBe(false);
    expect(isSessionSyncResponse({ ...value, status: 'unavailable' })).toBe(false);
  });
});

describe('untrusted game input and held/action contract', () => {
  it('accepts only the complete finite bounded input DTO', () => {
    expect(isMatchInput(packet())).toBe(true);
    for (const value of [null, [], 'up', {}, packet({ seq: NaN }),
      packet({ seq: Infinity }), packet({ seq: 0 }), packet({ generation: 0 }),
      packet({ matchId: 'x'.repeat(65) }), packet({ up: 1 as any }),
      { ...packet(), x: 400 }, { ...packet(), playerId: 1 }]) {
      expect(isMatchInput(value)).toBe(false);
    }
  });
  it('keeps held movement independently of a one-shot action', () => {
    const inbox = new InputInbox('41', 1);
    expect(inbox.receive(packet({ up: true, actionId: 1 }), 0)).toBe(true);
    expect(inbox.receive(packet({ seq: 2, up: true, actionId: 1 }), 1)).toBe(true);
    expect(inbox.take(2)).toEqual({ up: true, down: false, action: true });
    expect(inbox.take(3)).toEqual({ up: true, down: false, action: false });
  });
  it('rejects duplicates, stale sessions, other rooms and excessive jumps', () => {
    const inbox = new InputInbox('41', 2);
    expect(inbox.receive(packet({ generation: 2 }), 0)).toBe(true);
    for (const input of [packet({ generation: 2 }), packet({ generation: 1, seq: 2 }),
      packet({ generation: 2, matchId: '42', seq: 2 }),
      packet({ generation: 2, seq: 200 }), packet({ generation: 2, seq: 2, actionId: 17 })]) {
      expect(inbox.receive(input, 1)).toBe(false);
    }
    expect(inbox.receivedSeq).toBe(1);
  });
  it('expires missing releases but continuous refresh keeps a held key working', () => {
    const inbox = new InputInbox('41', 1);
    for (let i = 1; i <= 50; i++) {
      expect(inbox.receive(packet({ seq: i, down: true }), i * 100)).toBe(true);
      expect(inbox.take(i * 100 + 90).down).toBe(true);
    }
    expect(inbox.take(5351)).toEqual({ up: false, down: false, action: false });
  });
  it('bounds bursts without advancing a simulation or consuming unaccepted sequence', () => {
    const inbox = new InputInbox('41', 1);
    let accepted = 0;
    for (let seq = 1; seq <= 100; seq++) accepted += Number(inbox.receive(packet({ seq }), 0));
    expect(accepted).toBe(30);
    expect(inbox.receivedSeq).toBe(30);
    expect(inbox.receive(packet({ seq: 101 }), 1000)).toBe(true);
  });
  it('clears movement and pending action on disconnect/focus loss', () => {
    const inbox = new InputInbox('41', 1);
    inbox.receive(packet({ down: true, actionId: 1 }), 0);
    inbox.clear();
    expect(inbox.take(1)).toEqual({ up: false, down: false, action: false });
  });
});

describe('snapshot capture and validation', () => {
  it('captures independent serializable data for delayed sends', () => {
    const state = createGame();
    const snapshot = captureSnapshot(state, '41', 1, { left: 2, right: 3 }, { instanceId: 'protocol-fixture', clockEpoch: 0 });
    expect(isSnapshot(snapshot)).toBe(true);
    state.ball.x = 100;
    state.players.left.score = 1;
    expect(snapshot.state.ball.x).toBe(600);
    expect(snapshot.state.players.left.score).toBe(0);
  });
  it('rejects invalid geometry, non-finite values and inconsistent phases', () => {
    for (const corrupt of [
      (s: any) => { s.state.ball.vx = NaN; },
      (s: any) => { s.state.players.left.height = 0; },
      (s: any) => { s.state.config.width = 1e9; },
      (s: any) => { s.state.config.tickRate = 600; },
      (s: any) => { s.state.winner = 'left'; },
      (s: any) => { s.tick = 20; },
    ]) {
      const snapshot = captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 }, { instanceId: 'protocol-fixture', clockEpoch: 0 });
      corrupt(snapshot);
      expect(isSnapshot(snapshot)).toBe(false);
    }
  });

  it('requires a bounded server instance and a nonnegative safe clock epoch on snapshots and ready', () => {
    for (const fields of [
      { instanceId: undefined }, { instanceId: '' }, { instanceId: 'x'.repeat(65) },
      { instanceId: 'bad/instance' }, { clockEpoch: undefined }, { clockEpoch: -1 },
      { clockEpoch: 0.5 }, { clockEpoch: NaN }, { clockEpoch: Infinity },
      { clockEpoch: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      const snapshot = captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 }, { instanceId: 'protocol-fixture', clockEpoch: 0 });
      Object.assign(snapshot, fields);
      expect(isSnapshot(snapshot)).toBe(false);
      expect(isSessionSyncResponse({ v: 1, requestId: 'sync-1', matchId: '41', status: 'active',
        ready: { v: 1, roomId: '41', leftName: 'left', rightName: 'right', side: 'left',
          roomMode: false, generation: 1, snapshot } })).toBe(false);
    }
  });

  it('requires bounded, ordered authoritative event history with valid per-event payloads', () => {
    const initial = () => captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 }, { instanceId: 'protocol-fixture', clockEpoch: 0 });
    for (const corrupt of [
      (snapshot: any) => { delete snapshot.events; },
      (snapshot: any) => { snapshot.eventCursor = -1; },
      (snapshot: any) => { snapshot.events = Array.from({ length: 65 }, (_, index) => ({ id: index + 1, event: { type: 'wall', tick: 0 } })); snapshot.eventCursor = 65; },
      (snapshot: any) => { snapshot.eventCursor = 1; snapshot.events = [{ id: 1, event: { type: 'wall', tick: 1 } }]; },
      (snapshot: any) => { snapshot.eventCursor = 1; snapshot.events = [{ id: 2, event: { type: 'wall', tick: 0 } }]; },
      (snapshot: any) => { snapshot.eventCursor = 1; snapshot.events = [{ id: 1, event: { type: 'wall', tick: 0 } }, { id: 1, event: { type: 'wall', tick: 0 } }]; },
      (snapshot: any) => { snapshot.eventCursor = 1; snapshot.events = [{ id: 1, event: { type: 'power', tick: 0, side: 'left', active: true, charge: 6 } }]; },
      (snapshot: any) => { snapshot.eventCursor = 1; snapshot.events = [{ id: 1, event: { type: 'point', tick: 0, side: 'left', score: { left: 1e9, right: 0 } } }]; },
    ]) { const snapshot = initial(); corrupt(snapshot); expect(isSnapshot(snapshot)).toBe(false); }
    const valid = initial(); valid.eventCursor = 1; valid.events = [{ id: 1, event: { type: 'wall', tick: 0 } }];
    expect(isSnapshot(valid)).toBe(true);
    valid.tick = valid.state.tick = 121;
    expect(isSnapshot(valid)).toBe(false); // Retained history cannot outlive 120 ticks.
  });
});

describe('independent-review contracts', () => {
  it('does not acknowledge received input until a simulation step applies it', () => {
    const inbox = new InputInbox('41', 1);
    inbox.receive(packet({ up: true }), 0);
    expect(inbox.ack).toBe(0);
    inbox.take(1);
    expect(inbox.ack).toBe(0);
    inbox.markApplied();
    expect(inbox.ack).toBe(1);
  });
  it('rejects a scored winner before the winning score is reached', () => {
    const snapshot = captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 }, { instanceId: 'protocol-fixture', clockEpoch: 0 });
    snapshot.state.phase = 'finished';
    snapshot.state.winner = 'left';
    expect(isSnapshot(snapshot)).toBe(false);
  });
});

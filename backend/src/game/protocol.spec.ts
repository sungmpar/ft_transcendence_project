import { createGame } from '../../../shared/game-core';
import { captureSnapshot, InputInbox, isMatchInput, isSnapshot, MatchInput } from '../../../shared/protocol';

const packet = (changes: Partial<MatchInput> = {}): MatchInput => ({
  v: 1, matchId: '41', generation: 1, seq: 1,
  up: false, down: false, actionId: 0, ...changes,
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
    const snapshot = captureSnapshot(state, '41', 1, { left: 2, right: 3 });
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
      const snapshot = captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 });
      corrupt(snapshot);
      expect(isSnapshot(snapshot)).toBe(false);
    }
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
    const snapshot = captureSnapshot(createGame(), '41', 1, { left: 0, right: 0 });
    snapshot.state.phase = 'finished';
    snapshot.state.winner = 'left';
    expect(isSnapshot(snapshot)).toBe(false);
  });
});

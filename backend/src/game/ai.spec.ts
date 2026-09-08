import { AI_SETTINGS, createAiController, predictIntercept } from '../../../shared/ai';
import { createGame, createSeededRng, GameState, NEUTRAL_INPUT, stepGame } from '../../../shared/game-core';

function rally(): GameState {
  return stepGame(createGame({ readyTicks: 0 }), {
    left: NEUTRAL_INPUT, right: NEUTRAL_INPUT,
  }, createSeededRng(1)).state;
}

describe('delayed rule-based AI', () => {
  it('predicts a multi-bounce intercept using the playable ball-center interval', () => {
    const state = rally();
    state.ball = { ...state.ball, x: 600, y: 100, vx: 200, vy: 1000 };
    // Contact x=1135; t=2.675; unwrapped y=2775. Fold [15,785] => 335.
    expect(predictIntercept(state, 'right')).toEqual({ y: 335, seconds: 2.675 });
    state.ball.vy = -1000;
    expect(predictIntercept(state, 'right')).toEqual({ y: 505, seconds: 2.675 });
  });

  it('predicts symmetrically for the other side', () => {
    const state = rally();
    state.ball = { ...state.ball, x: 600, y: 100, vx: -200, vy: 1000 };
    expect(predictIntercept(state, 'left')).toEqual({ y: 335, seconds: 2.675 });
  });

  it('returns no intercept for retreating, almost vertical, passed or scored balls', () => {
    const state = rally();
    state.ball.vx = -600;
    expect(predictIntercept(state, 'right')).toBeNull();
    state.ball.vx = 0.00000001;
    expect(predictIntercept(state, 'right')).toBeNull();
    state.ball.vx = 600;
    state.ball.x = 1170;
    expect(predictIntercept(state, 'right')).toBeNull();
    state.ball.x = 600;
    state.phase = 'point';
    expect(predictIntercept(state, 'right')).toBeNull();
    state.phase = 'rally';
    state.ball.y = Number.NaN;
    expect(predictIntercept(state, 'right')).toBeNull();
  });

  it('does not react until an owned observation has completed its latency', () => {
    const ai = createAiController('right', 'normal', () => 0.5);
    const state = rally();
    state.tick = 0;
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    expect(ai.sample(state)).toEqual(NEUTRAL_INPUT);
    expect(ai.debug.observationTick).toBeNull();
    // Mutating the source after capture must not change that captured observation.
    state.ball.y = 700;
    for (let tick = 1; tick < AI_SETTINGS.normal.reactionTicks; tick++) {
      state.tick = tick;
      expect(ai.sample(state)).toEqual(NEUTRAL_INPUT);
    }
    state.tick = AI_SETTINGS.normal.reactionTicks;
    expect(ai.sample(state)).toEqual({ up: true, down: false, action: false });
    expect(ai.debug.observationTick).toBe(0);
    expect(ai.debug.predictedY).toBe(100);
  });

  it('holds the last movement between decisions and updates only on the configured period', () => {
    const ai = createAiController('right', 'normal', () => 0.5);
    const state = rally();
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    for (let tick = 0; tick <= 12; tick++) { state.tick = tick; ai.sample(state); }
    expect(ai.debug.decisionTick).toBe(12);
    state.tick = 13;
    expect(ai.sample(state).up).toBe(true);
    expect(ai.debug.decisionTick).toBe(12);
    state.tick = 18;
    ai.sample(state);
    expect(ai.debug.decisionTick).toBe(18);
    expect(ai.debug.observationTick).toBe(6);
  });

  it('returns toward center when a delayed observed ball is moving away', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    const state = rally();
    state.players.right.y = 600;
    state.ball.vx = -600;
    for (let tick = 0; tick <= 6; tick++) { state.tick = tick; ai.sample(state); }
    expect(ai.debug.predictedY).toBeNull();
    expect(ai.debug.targetY).toBe(400);
    expect(ai.debug.input).toEqual({ up: true, down: false, action: false });
  });

  it('keeps the same core movement speed as a human instead of altering state', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    let state = rally();
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    const rng = createSeededRng(4);
    let moved = false;
    for (let tick = 0; tick < 60; tick++) {
      const before = JSON.stringify(state);
      const input = ai.sample(state);
      expect(JSON.stringify(state)).toBe(before);
      const next = stepGame(state, { left: NEUTRAL_INPUT, right: input }, rng).state;
      const delta = Math.abs(next.players.right.y - state.players.right.y);
      expect(delta).toBeLessThanOrEqual(state.config.paddleSpeed / 60);
      moved = moved || delta > 0;
      state = next;
    }
    expect(moved).toBe(true);
  });

  it('requests Power from delayed charge observations and emits only a press pulse', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    const state = rally();
    state.config = { ...state.config, mode: 'power' };
    state.players.right.charge = 5;
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    for (let tick = 0; tick < 6; tick++) { state.tick = tick; ai.sample(state); }
    state.tick = 6;
    expect(ai.sample(state)).toEqual({ up: true, down: false, action: true });
    expect(ai.sample(state).action).toBe(false);
    state.tick = 7;
    expect(ai.sample(state).action).toBe(false);
  });

  it('rearms Power after a delayed request is rejected during a point transition', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    const rng = createSeededRng(1);
    let state = stepGame(createGame({ mode: 'power', readyTicks: 0 }), {
      left: NEUTRAL_INPUT, right: NEUTRAL_INPUT,
    }, rng).state;
    state.tick = 0;
    // This charged paddle misses: the goal is reached before its delayed
    // observation can request Power. The real core rejects that stale action.
    state.ball = { ...state.ball, x: 1130, y: 100, vx: 600, vy: 0 };
    state.players.right.charge = 5;
    const requests: { tick: number; phase: string }[] = [];
    const activations: number[] = [];
    for (let tick = 0; tick < 240; tick++) {
      const input = ai.sample(state);
      if (input.action) requests.push({ tick: state.tick, phase: state.phase });
      expect(ai.sample(state).action).toBe(false);
      const result = stepGame(state, { left: NEUTRAL_INPUT, right: input }, rng);
      for (const event of result.events) {
        if (event.type === 'power' && event.active) activations.push(event.tick);
      }
      state = result.state;
    }
    expect(requests[0]).toEqual({ tick: 6, phase: 'point' });
    expect(activations.some((tick) => tick > 6)).toBe(true);
    expect(requests.some((request) => request.tick > 6 && request.phase === 'rally')).toBe(true);
  });

  it('exposes real difficulty differences without increasing paddle speed', () => {
    expect(AI_SETTINGS.easy.reactionTicks).toBeGreaterThan(AI_SETTINGS.normal.reactionTicks);
    expect(AI_SETTINGS.normal.reactionTicks).toBeGreaterThan(AI_SETTINGS.hard.reactionTicks);
    expect(AI_SETTINGS.easy.aimError).toBeGreaterThan(AI_SETTINGS.hard.aimError);
    expect(AI_SETTINGS.easy.observationEveryTicks).toBeGreaterThan(AI_SETTINGS.hard.observationEveryTicks);
    expect(Object.keys(AI_SETTINGS.hard)).not.toContain('paddleSpeed');
  });

  it('replays the same seed and changes aim with a different seed', () => {
    const replay = (seed: number) => {
      const ai = createAiController('right', 'easy', createSeededRng(seed));
      const state = rally();
      state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
      const output = [];
      for (let tick = 0; tick < 120; tick++) {
        state.tick = tick;
        output.push({ input: ai.sample(state), debug: ai.debug });
      }
      return output;
    };
    expect(replay(22)).toEqual(replay(22));
    expect(replay(22)).not.toEqual(replay(23));
  });

  it('cannot observe future human inputs or source mutations and resets its delayed queue', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    const other = createAiController('right', 'hard', () => 0.5);
    const state = rally();
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    for (let tick = 0; tick <= 6; tick++) {
      state.tick = tick;
      const alternate = { ...state, players: { ...state.players, left: { ...state.players.left, y: tick * 99 } } };
      expect(ai.sample(state)).toEqual(other.sample(alternate));
    }
    ai.reset();
    expect(ai.debug.observationTick).toBeNull();
    expect(ai.debug.input).toEqual(NEUTRAL_INPUT);
    state.tick = 0;
    expect(ai.sample(state)).toEqual(NEUTRAL_INPUT);
  });

  it('stops issuing held movement immediately when a match finishes', () => {
    const ai = createAiController('right', 'hard', () => 0.5);
    const state = rally();
    state.ball = { ...state.ball, x: 900, y: 100, vx: 600, vy: 0 };
    for (let tick = 0; tick <= 6; tick++) { state.tick = tick; ai.sample(state); }
    state.phase = 'finished';
    expect(ai.sample(state)).toEqual(NEUTRAL_INPUT);
  });
});

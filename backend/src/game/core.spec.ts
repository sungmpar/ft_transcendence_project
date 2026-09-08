import {
  createGame,
  createSeededRng,
  GameState,
  NEUTRAL_INPUT,
  stepGame,
} from '../../../shared/game-core';
import { advanceClock, createClock } from '../../../shared/fixed-clock';

const neutral = { left: NEUTRAL_INPUT, right: NEUTRAL_INPUT };

function rally(overrides = {}): GameState {
  const state = createGame({ readyTicks: 0, ...overrides });
  return stepGame(state, neutral, createSeededRng(1)).state;
}

function contact(state: GameState, side: 'left' | 'right', offset = 0) {
  const player = state.players[side];
  state.ball.x = side === 'left'
    ? player.x + player.width + state.ball.radius + 1
    : player.x - state.ball.radius - 1;
  state.ball.y = player.y + player.height / 2 + offset;
  state.ball.vx = side === 'left' ? -600 : 600;
  state.ball.vy = 0;
  return state;
}

describe('shared fixed-tick game rules', () => {
  it('keeps default dimensions and victory condition; rejects unsupported config', () => {
    const state = createGame();
    expect(state.config).toMatchObject({ width: 1200, height: 800, winningScore: 6, tickRate: 60 });
    expect(() => createGame({ paddleHeight: 900 })).toThrow();
    expect(() => createGame({ ballSpeed: Number.NaN })).toThrow();
    expect(() => createGame({ maxBallSpeed: 100000 })).toThrow();
  });

  it('does not mutate its input state or share mutable player state across games', () => {
    const source = rally();
    const before = JSON.parse(JSON.stringify(source));
    const result = stepGame(source, { left: { up: false, down: true, action: false }, right: NEUTRAL_INPUT }, createSeededRng(1));
    expect(source).toEqual(before);
    expect(result.state.players.left.y).toBe(before.players.left.y + 15);
    expect(createGame().players.left.y).toBe(300);
  });

  it('uses a neutral direction for opposite held inputs and clamps a full legal step', () => {
    const source = rally();
    source.players.left.y = 575;
    source.players.right.y = 575;
    const result = stepGame(source, {
      left: { up: false, down: true, action: false },
      right: { up: true, down: true, action: false },
    }, createSeededRng(1));
    expect(result.state.players.left.y).toBe(590);
    expect(result.state.players.right.y).toBe(575);
  });

  it('serves exactly once after the configured countdown', () => {
    let state = createGame({ readyTicks: 2 });
    const rng = createSeededRng(2);
    state = stepGame(state, neutral, rng).state;
    expect(state.phase).toBe('ready');
    const served = stepGame(state, neutral, rng);
    expect(served.state.phase).toBe('rally');
    expect(served.events.filter((event) => event.type === 'serve')).toHaveLength(1);
    expect(stepGame(served.state, neutral, rng).events.filter((event) => event.type === 'serve')).toHaveLength(0);
  });

  it('reflects at the upper and lower walls within the same step', () => {
    for (const direction of [-1, 1]) {
      const source = rally();
      source.ball.y = direction < 0 ? 16 : 784;
      source.ball.vx = 600;
      source.ball.vy = direction * 500;
      const result = stepGame(source, neutral, createSeededRng(1));
      expect(Math.sign(result.state.ball.vy)).toBe(-direction);
      expect(result.state.ball.y).toBeGreaterThanOrEqual(15);
      expect(result.state.ball.y).toBeLessThanOrEqual(785);
      expect(result.events.filter((event) => event.type === 'wall')).toHaveLength(1);
    }
  });

  it('reflects a centered paddle hit horizontally and symmetrically', () => {
    for (const side of ['left', 'right'] as const) {
      const result = stepGame(contact(rally(), side), neutral, createSeededRng(1));
      expect(result.state.ball.vy).toBeCloseTo(0);
      expect(Math.sign(result.state.ball.vx)).toBe(side === 'left' ? 1 : -1);
      expect(result.events.filter((event) => event.type === 'paddle')).toHaveLength(1);
    }
  });

  it('gives opposite edge hits symmetric angles and respects the total speed cap', () => {
    const upper = stepGame(contact(rally(), 'right', -100), neutral, createSeededRng(1)).state;
    const lower = stepGame(contact(rally(), 'right', 100), neutral, createSeededRng(1)).state;
    expect(upper.ball.vx).toBeCloseTo(lower.ball.vx);
    expect(upper.ball.vy).toBeCloseTo(-lower.ball.vy);
    expect(Math.hypot(upper.ball.vx, upper.ball.vy)).toBeLessThanOrEqual(upper.config.maxBallSpeed);
    expect(Math.abs(upper.ball.vx)).toBeGreaterThan(0.4 * Math.hypot(upper.ball.vx, upper.ball.vy));
  });

  it('uses inclusive expanded-face tangency and misses beyond that approximation', () => {
    const tangent = contact(rally(), 'left', -115);
    expect(stepGame(tangent, neutral, createSeededRng(1)).events.some((event) => event.type === 'paddle')).toBe(true);
    const miss = contact(rally(), 'left', -115.01);
    expect(stepGame(miss, neutral, createSeededRng(1)).events.some((event) => event.type === 'paddle')).toBe(false);
  });

  it('sweeps through a thin paddle at the supported maximum speed', () => {
    const source = contact(rally({ paddleHeight: 20, maxBallSpeed: 6000 }), 'right');
    source.ball.x -= 40;
    source.ball.vx = 6000;
    const result = stepGame(source, neutral, createSeededRng(1));
    expect(result.state.ball.vx).toBeLessThan(0);
    expect(result.state.players.left.score).toBe(0);
    expect(result.events.filter((event) => event.type === 'paddle')).toHaveLength(1);
  });

  it('resolves a simultaneous wall/paddle contact without repeated charge or escape', () => {
    const source = rally({ mode: 'power' });
    source.players.right.y = 0;
    source.ball.x = source.players.right.x - source.ball.radius - 6;
    source.ball.y = source.ball.radius + 6;
    source.ball.vx = 600;
    source.ball.vy = -600;
    const result = stepGame(source, neutral, createSeededRng(1));
    expect(result.state.ball.vx).toBeLessThan(0);
    expect(result.state.ball.vy).toBeGreaterThanOrEqual(0);
    expect(result.state.ball.y).toBeGreaterThanOrEqual(15);
    expect(result.state.players.right.charge).toBe(1);
    expect(result.events.filter((event) => event.type === 'paddle')).toHaveLength(1);
  });

  it('does not reflect or charge a ball already moving away from a paddle', () => {
    const source = contact(rally({ mode: 'power' }), 'left');
    source.ball.vx = 600;
    const result = stepGame(source, neutral, createSeededRng(1));
    expect(result.state.players.left.charge).toBe(0);
    expect(result.state.ball.vx).toBe(600);
  });

  it('scores once, centers the inactive ball, then makes one new rally', () => {
    const source = rally({ pointTicks: 2 });
    source.ball.x = 16;
    source.ball.y = 100;
    source.ball.vx = -600;
    source.ball.vy = 0;
    const rng = createSeededRng(1);
    const scored = stepGame(source, neutral, rng);
    expect(scored.state.players.right.score).toBe(1);
    expect(scored.state.phase).toBe('point');
    expect(scored.state.ball).toMatchObject({ x: 600, y: 400, vx: 0, vy: 0 });
    expect(scored.events.filter((event) => event.type === 'point')).toHaveLength(1);
    const waiting = stepGame(scored.state, neutral, rng);
    expect(waiting.state.players.right.score).toBe(1);
    expect(waiting.events).toEqual([]);
    const served = stepGame(waiting.state, neutral, rng);
    expect(served.state.phase).toBe('rally');
    expect(served.state.rallyId).toBe(source.rallyId + 1);
  });

  it('freezes every field after the winning point', () => {
    const source = rally({ winningScore: 1 });
    source.ball.x = 1184;
    source.ball.y = 100;
    source.ball.vx = 600;
    source.ball.vy = 0;
    const result = stepGame(source, neutral, createSeededRng(1));
    expect(result.state.phase).toBe('finished');
    expect(result.state.winner).toBe('left');
    const after = stepGame(result.state, {
      left: { up: true, down: false, action: true }, right: NEUTRAL_INPUT,
    }, () => { throw new Error('finished match consumed RNG'); });
    expect(after.state).toEqual(result.state);
    expect(after.events).toEqual([]);
  });

  it('activates Power independently of movement and clamps the effective height', () => {
    const source = rally({ mode: 'power' });
    source.players.left.charge = 5;
    source.players.left.y = 575;
    const result = stepGame(source, {
      left: { up: true, down: false, action: true }, right: NEUTRAL_INPUT,
    }, createSeededRng(1));
    expect(result.state.players.left).toMatchObject({ height: 400, y: 385, powered: true, charge: 5 });
    expect(result.events.filter((event) => event.type === 'power')).toHaveLength(1);
  });

  it('caps charge and expires Power on the same valid hit that spends the last charge', () => {
    const full = contact(rally({ mode: 'power' }), 'left');
    full.players.left.charge = 5;
    expect(stepGame(full, neutral, createSeededRng(1)).state.players.left.charge).toBe(5);
    const powered = rally({ mode: 'power' });
    powered.players.left = { ...powered.players.left, charge: 1, powered: true, height: 400, y: 400 };
    contact(powered, 'left');
    const result = stepGame(powered, neutral, createSeededRng(1));
    expect(result.state.players.left).toMatchObject({ charge: 0, powered: false, height: 200, y: 400 });
    expect(result.events.filter((event) => event.type === 'power')).toHaveLength(1);
  });

  it('does not activate or charge in Classic', () => {
    const source = contact(rally(), 'left');
    const result = stepGame(source, { left: { up: false, down: false, action: true }, right: NEUTRAL_INPUT }, createSeededRng(1));
    expect(result.state.players.left).toMatchObject({ powered: false, charge: 0, height: 200 });
  });

  it('replays identical tick inputs and seed without non-finite state', () => {
    const play = () => {
      let state = createGame({ readyTicks: 1, pointTicks: 1 });
      const rng = createSeededRng(890);
      for (let tick = 0; tick < 3600; tick++) {
        state = stepGame(state, {
          left: { up: tick % 180 < 90, down: tick % 180 >= 90, action: tick % 90 === 0 },
          right: { up: tick % 120 < 60, down: tick % 120 >= 60, action: false },
        }, rng).state;
        expect(Object.values(state.ball).every(Number.isFinite)).toBe(true);
      }
      return state;
    };
    expect(play()).toEqual(play());
  });
});

describe('bounded fixed-step accumulator', () => {
  it('replays the same 600 ticks at 30, 60 and 120 render Hz', () => {
    const replay = (hz: number) => {
      let clock = createClock();
      let state = createGame();
      const rng = createSeededRng(14);
      let steps = 0;
      for (let frame = 0; frame < hz * 10; frame++) {
        const result = advanceClock(clock, 1000 / hz, () => {
          state = stepGame(state, neutral, rng).state;
          steps++;
        });
        clock = result.clock;
      }
      return { state, steps };
    };
    expect(replay(30)).toEqual(replay(60));
    expect(replay(60)).toEqual(replay(120));
    expect(replay(60).steps).toBe(600);
  });

  it('caps catch-up at eight ticks and drops excess whole steps after a long frame', () => {
    const step = jest.fn();
    const result = advanceClock(createClock(), 5000, step);
    expect(step).toHaveBeenCalledTimes(8);
    expect(result.steps).toBe(8);
    expect(result.droppedMs).toBeGreaterThan(4800);
    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThan(1);
    expect(advanceClock(result.clock, 0, step).steps).toBe(0);
  });

  it('rejects non-finite time and ignores negative frame time', () => {
    expect(() => advanceClock(createClock(), Number.NaN, () => undefined)).toThrow();
    expect(advanceClock(createClock(), -100, () => undefined).steps).toBe(0);
  });
});

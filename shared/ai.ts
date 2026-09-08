import {
  clamp, cloneGameState, GameState, NEUTRAL_INPUT, PlayerInput, RandomSource, Side,
} from './game-core';

export type AiDifficulty = 'easy' | 'normal' | 'hard';
export interface AiSettings {
  reactionTicks: number;
  observationEveryTicks: number;
  decisionEveryTicks: number;
  aimError: number;
  deadZone: number;
}

/** Difficulty changes information and aiming, never the core's movement speed. */
export const AI_SETTINGS: Readonly<Record<AiDifficulty, Readonly<AiSettings>>> = Object.freeze({
  easy: Object.freeze({ reactionTicks: 18, observationEveryTicks: 10, decisionEveryTicks: 10, aimError: 110, deadZone: 28 }),
  normal: Object.freeze({ reactionTicks: 12, observationEveryTicks: 6, decisionEveryTicks: 6, aimError: 55, deadZone: 18 }),
  hard: Object.freeze({ reactionTicks: 6, observationEveryTicks: 3, decisionEveryTicks: 3, aimError: 18, deadZone: 12 }),
});

export interface AiDebug {
  difficulty: AiDifficulty;
  side: Side;
  observationTick: number | null;
  decisionTick: number | null;
  predictedY: number | null;
  targetY: number | null;
  input: PlayerInput;
  reactionTicks: number;
  observationEveryTicks: number;
  decisionEveryTicks: number;
}

export interface AiController {
  /** Call once per simulation tick. Repeated calls never repeat an action edge. */
  sample(state: GameState): PlayerInput;
  /** Clear observations and held input; the caller owns the injected RNG lifetime. */
  reset(): void;
  readonly debug: AiDebug;
}

/**
 * Project to the inward paddle face, then fold the unwrapped vertical position
 * into the ball-center wall interval. This handles any number of wall bounces
 * without reading future inputs or simulating a second hidden game.
 */
export function predictIntercept(state: GameState, side: Side): { y: number; seconds: number } | null {
  const ball = state.ball;
  const player = state.players[side];
  if (state.phase !== 'rally' || !Object.values(ball).every(Number.isFinite)
    || Math.abs(ball.vx) < 0.000001 || ball.radius <= 0
    || ball.x < ball.radius || ball.x > state.config.width - ball.radius
    || (side === 'right' ? ball.vx <= 0 : ball.vx >= 0)) return null;
  const face = side === 'left' ? player.x + player.width + ball.radius : player.x - ball.radius;
  const seconds = (face - ball.x) / ball.vx;
  const usableHeight = state.config.height - 2 * ball.radius;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 8 || usableHeight <= 0) return null;
  const period = 2 * usableHeight;
  const unfolded = ball.y - ball.radius + ball.vy * seconds;
  const folded = ((unfolded % period) + period) % period;
  return { y: ball.radius + (folded <= usableHeight ? folded : period - folded), seconds };
}

export function createAiController(side: Side, difficulty: AiDifficulty, rng: RandomSource): AiController {
  const settings = AI_SETTINGS[difficulty];
  if (!settings || (side !== 'left' && side !== 'right')) throw new Error('Unsupported AI settings');
  let observations: GameState[] = [];
  let latestObserved: GameState | null = null;
  let lastCaptureTick: number | null = null;
  let lastSampleTick: number | null = null;
  let powerRequested = false;
  const initialDebug = (): AiDebug => ({
    difficulty, side, observationTick: null, decisionTick: null, predictedY: null, targetY: null,
    input: { ...NEUTRAL_INPUT }, reactionTicks: settings.reactionTicks,
    observationEveryTicks: settings.observationEveryTicks,
    decisionEveryTicks: settings.decisionEveryTicks,
  });
  let debug = initialDebug();

  function reset(): void {
    observations = [];
    latestObserved = null;
    lastCaptureTick = null;
    lastSampleTick = null;
    powerRequested = false;
    debug = initialDebug();
  }

  return {
    reset,
    get debug() { return { ...debug, input: { ...debug.input } }; },
    sample(state: GameState): PlayerInput {
      if (lastSampleTick !== null && state.tick < lastSampleTick) reset();
      if (state.phase === 'finished') {
        observations = [];
        latestObserved = null;
        debug.input = { ...NEUTRAL_INPUT };
        return { ...debug.input };
      }
      // Action is always a pulse. Keep movement between decisions and repeated calls.
      debug.input = { ...debug.input, action: false };
      if (state.tick === lastSampleTick) return { ...debug.input };
      lastSampleTick = state.tick;
      if (lastCaptureTick === null || state.tick - lastCaptureTick >= settings.observationEveryTicks) {
        observations.push(cloneGameState(state));
        lastCaptureTick = state.tick;
      }
      while (observations.length && observations[0].tick <= state.tick - settings.reactionTicks) {
        latestObserved = observations.shift() as GameState;
      }
      if (!latestObserved || (debug.decisionTick !== null
        && state.tick - debug.decisionTick < settings.decisionEveryTicks)) return { ...debug.input };

      const observed = latestObserved;
      const player = observed.players[side];
      const intercept = predictIntercept(observed, side);
      let targetY = observed.config.height / 2;
      if (intercept) {
        const random = rng();
        if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('AI RNG must return [0, 1)');
        targetY = clamp(intercept.y + (random * 2 - 1) * settings.aimError,
          player.height / 2, observed.config.height - player.height / 2);
      }
      const difference = targetY - (player.y + player.height / 2);
      // A delayed action can reach the core after a goal and be rejected.
      // Observing the point/ready phase rearms that request for the next rally.
      if (observed.phase !== 'rally' || player.powered || player.charge < 5) powerRequested = false;
      const action = observed.phase === 'rally' && observed.config.mode === 'power'
        && !player.powered && player.charge === 5 && !powerRequested
        && intercept !== null && intercept.seconds <= 1;
      if (action) powerRequested = true;
      debug = {
        ...debug, observationTick: observed.tick, decisionTick: state.tick,
        predictedY: intercept ? intercept.y : null, targetY,
        input: observed.phase === 'rally' ? {
          up: difference < -settings.deadZone, down: difference > settings.deadZone, action,
        } : { ...NEUTRAL_INPUT },
      };
      return { ...debug.input };
    },
  };
}

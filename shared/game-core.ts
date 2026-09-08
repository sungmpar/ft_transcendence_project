/** One source of truth for browser and server rules. No clocks or platform APIs. */
export type Side = 'left' | 'right';
export type RuleMode = 'classic' | 'power';
export type GamePhase = 'ready' | 'rally' | 'point' | 'finished';
export type RandomSource = () => number;

export interface GameConfig {
  width: number;
  height: number;
  tickRate: 60;
  winningScore: number;
  mode: RuleMode;
  paddleWidth: number;
  paddleHeight: number;
  poweredHeight: number;
  paddleInset: number;
  paddleSpeed: number;
  ballRadius: number;
  ballSpeed: number;
  maxBallSpeed: number;
  hitAcceleration: number;
  maxBounceAngle: number;
  readyTicks: number;
  pointTicks: number;
}

export interface PlayerInput { up: boolean; down: boolean; action: boolean }
export interface MatchInput { left: PlayerInput; right: PlayerInput }
export const NEUTRAL_INPUT: Readonly<PlayerInput> = Object.freeze({ up: false, down: false, action: false });
export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  charge: number;
  powered: boolean;
}
export interface BallState { x: number; y: number; vx: number; vy: number; radius: number }
export interface GameState {
  config: Readonly<GameConfig>;
  tick: number;
  phase: GamePhase;
  phaseTicks: number;
  rallyId: number;
  players: Record<Side, PlayerState>;
  ball: BallState;
  winner: Side | null;
  serveToward: Side;
}
export type GameEvent =
  | { type: 'serve'; tick: number; rallyId: number }
  | { type: 'wall'; tick: number }
  | { type: 'paddle'; tick: number; side: Side }
  | { type: 'power'; tick: number; side: Side; active: boolean; charge: number }
  | { type: 'point'; tick: number; side: Side; score: { left: number; right: number } }
  | { type: 'finished'; tick: number; winner: Side };
export interface StepResult { state: GameState; events: GameEvent[] }

export const DEFAULT_CONFIG: Readonly<GameConfig> = Object.freeze({
  width: 1200, height: 800, tickRate: 60, winningScore: 6, mode: 'classic',
  paddleWidth: 30, paddleHeight: 200, poweredHeight: 400, paddleInset: 20,
  paddleSpeed: 900, ballRadius: 15, ballSpeed: 720, maxBallSpeed: 1500,
  hitAcceleration: 1.025, maxBounceAngle: Math.PI / 3, readyTicks: 120, pointTicks: 60,
});

const SIDES: Side[] = ['left', 'right'];
const EPSILON = 0.000001;
const MAX_CONTACTS_PER_TICK = 8;
export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

function validateConfig(config: GameConfig): void {
  const numbers = Object.keys(config).filter((key) => key !== 'mode');
  if (numbers.some((key) => !Number.isFinite(config[key as keyof GameConfig]))) {
    throw new Error('Game configuration numbers must be finite');
  }
  if (config.tickRate !== 60 || !['classic', 'power'].includes(config.mode)
    || config.width < 400 || config.width > 5000 || config.height < 200 || config.height > 5000
    || config.paddleHeight < 20 || config.paddleHeight > config.height
    || config.poweredHeight < config.paddleHeight || config.poweredHeight > config.height
    || config.paddleWidth < 5 || config.paddleWidth > 100
    || config.paddleInset < 0 || config.paddleInset + config.paddleWidth > config.width / 4
    || config.paddleSpeed <= 0 || config.paddleSpeed > 2000
    || config.ballRadius < 2 || config.ballRadius > 40
    || config.ballSpeed < 100 || config.ballSpeed > config.maxBallSpeed
    || config.maxBallSpeed > 6000 || config.hitAcceleration < 1 || config.hitAcceleration > 1.2
    || config.maxBounceAngle <= 0 || config.maxBounceAngle > Math.PI / 3
    || !Number.isInteger(config.winningScore) || config.winningScore < 1 || config.winningScore > 99
    || !Number.isInteger(config.readyTicks) || config.readyTicks < 0 || config.readyTicks > 600
    || !Number.isInteger(config.pointTicks) || config.pointTicks < 0 || config.pointTicks > 600) {
    throw new Error('Unsupported game configuration');
  }
}

export function createGame(overrides: Partial<GameConfig> = {}): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...overrides };
  validateConfig(config);
  const player = (x: number): PlayerState => ({
    x, y: (config.height - config.paddleHeight) / 2,
    width: config.paddleWidth, height: config.paddleHeight, score: 0, charge: 0, powered: false,
  });
  return {
    config: Object.freeze(config), tick: 0, phase: 'ready', phaseTicks: config.readyTicks,
    rallyId: 0, players: {
      left: player(config.paddleInset),
      right: player(config.width - config.paddleInset - config.paddleWidth),
    },
    ball: { x: config.width / 2, y: config.height / 2, vx: 0, vy: 0, radius: config.ballRadius },
    winner: null, serveToward: 'right',
  };
}

export function createSeededRng(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Capture owned scalar data; adapters must not retain mutable simulation objects. */
export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    config: { ...state.config },
    players: { left: { ...state.players.left }, right: { ...state.players.right } },
    ball: { ...state.ball },
  };
}

function setPower(state: GameState, side: Side, active: boolean, events: GameEvent[]): void {
  const player = state.players[side];
  player.powered = active;
  player.height = active ? state.config.poweredHeight : state.config.paddleHeight;
  player.y = clamp(player.y, 0, state.config.height - player.height);
  events.push({ type: 'power', tick: state.tick, side, active, charge: player.charge });
}

function serve(state: GameState, rng: RandomSource, events: GameEvent[]): void {
  const random = rng();
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('RNG must return [0, 1)');
  const angle = (random - 0.5) * Math.PI / 3;
  state.ball.vx = Math.cos(angle) * state.config.ballSpeed * (state.serveToward === 'right' ? 1 : -1);
  state.ball.vy = Math.sin(angle) * state.config.ballSpeed;
  state.phase = 'rally';
  state.phaseTicks = 0;
  state.rallyId++;
  events.push({ type: 'serve', tick: state.tick, rallyId: state.rallyId });
}

function point(state: GameState, scorer: Side, events: GameEvent[]): void {
  state.players[scorer].score++;
  state.serveToward = scorer === 'left' ? 'right' : 'left';
  state.ball = { x: state.config.width / 2, y: state.config.height / 2, vx: 0, vy: 0, radius: state.config.ballRadius };
  events.push({ type: 'point', tick: state.tick, side: scorer,
    score: { left: state.players.left.score, right: state.players.right.score } });
  if (state.players[scorer].score >= state.config.winningScore) {
    state.winner = scorer;
    state.phase = 'finished';
    state.phaseTicks = 0;
    events.push({ type: 'finished', tick: state.tick, winner: scorer });
  } else {
    state.phase = 'point';
    state.phaseTicks = state.config.pointTicks;
  }
}

interface Contact { time: number; kind: 'paddle' | 'wall' | 'goal'; side?: Side; priority: number }

/**
 * Swept inward paddle faces with radius-expanded vertical intervals (AABB
 * approximation, including tangency; not exact circular corner collision).
 * Paddles move/clamp before the ball sweep. At simultaneous contact a paddle
 * chooses the bounce angle first, then a wall directs vertical velocity inward.
 * Goals lie at ball-center x=radius / width-radius. Eight contacts is the
 * hard work bound; exceptional remaining time is discarded, never teleported.
 */
function moveBall(state: GameState, events: GameEvent[]): void {
  const ball = state.ball;
  const config = state.config;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > config.maxBallSpeed) {
    ball.vx *= config.maxBallSpeed / speed;
    ball.vy *= config.maxBallSpeed / speed;
  }
  let remaining = 1 / config.tickRate;
  for (let count = 0; count < MAX_CONTACTS_PER_TICK && remaining > EPSILON; count++) {
    const contacts: Contact[] = [];
    const candidate = (time: number, kind: Contact['kind'], priority: number, side?: Side) => {
      if (time >= -EPSILON && time <= remaining + EPSILON) {
        contacts.push({ time: Math.max(0, time), kind, priority, side });
      }
    };
    if (ball.vy < -EPSILON) candidate((ball.radius - ball.y) / ball.vy, 'wall', 1);
    if (ball.vy > EPSILON) candidate((config.height - ball.radius - ball.y) / ball.vy, 'wall', 1);
    if (Math.abs(ball.vx) > EPSILON) {
      const side: Side = ball.vx < 0 ? 'left' : 'right';
      const player = state.players[side];
      const face = side === 'left' ? player.x + player.width + ball.radius : player.x - ball.radius;
      const hitTime = (face - ball.x) / ball.vx;
      const hitY = ball.y + ball.vy * hitTime;
      if (hitY >= player.y - ball.radius - EPSILON && hitY <= player.y + player.height + ball.radius + EPSILON) {
        candidate(hitTime, 'paddle', 0, side);
      }
      const goal = side === 'left' ? ball.radius : config.width - ball.radius;
      candidate((goal - ball.x) / ball.vx, 'goal', 2, side);
    }
    contacts.sort((a, b) => Math.abs(a.time - b.time) <= EPSILON ? a.priority - b.priority : a.time - b.time);
    const contact = contacts[0];
    if (!contact) {
      ball.x += ball.vx * remaining;
      ball.y += ball.vy * remaining;
      break;
    }
    ball.x += ball.vx * contact.time;
    ball.y += ball.vy * contact.time;
    remaining -= contact.time;
    if (contact.kind === 'goal') {
      point(state, contact.side === 'left' ? 'right' : 'left', events);
      return;
    }
    if (contact.kind === 'wall') {
      ball.y = clamp(ball.y, ball.radius, config.height - ball.radius);
      ball.vy = -ball.vy;
      ball.y += Math.sign(ball.vy) * EPSILON;
      events.push({ type: 'wall', tick: state.tick });
      continue;
    }
    const side = contact.side as Side;
    const player = state.players[side];
    const offset = clamp((ball.y - (player.y + player.height / 2)) / (player.height / 2), -1, 1);
    const angle = offset * config.maxBounceAngle;
    const nextSpeed = Math.min(config.maxBallSpeed, Math.hypot(ball.vx, ball.vy) * config.hitAcceleration);
    ball.vx = (side === 'left' ? 1 : -1) * Math.cos(angle) * nextSpeed;
    ball.vy = Math.sin(angle) * nextSpeed;
    ball.x += Math.sign(ball.vx) * EPSILON;
    events.push({ type: 'paddle', tick: state.tick, side });
    if (config.mode === 'power') {
      if (player.powered) {
        player.charge = Math.max(0, player.charge - 1);
        if (player.charge === 0) setPower(state, side, false, events);
      } else {
        player.charge = Math.min(5, player.charge + 1);
      }
    }
    if ((ball.y <= ball.radius + EPSILON && ball.vy < 0)
      || (ball.y >= config.height - ball.radius - EPSILON && ball.vy > 0)) {
      ball.vy = -ball.vy;
      ball.y = clamp(ball.y, ball.radius, config.height - ball.radius) + Math.sign(ball.vy) * EPSILON;
      events.push({ type: 'wall', tick: state.tick });
    }
  }
}

/** A pure transition for exactly one 60Hz tick; action is a one-tick press edge. */
export function stepGame(previous: GameState, inputs: MatchInput, rng: RandomSource): StepResult {
  if (previous.phase === 'finished') return { state: previous, events: [] };
  const state = cloneGameState(previous);
  state.tick++;
  const events: GameEvent[] = [];
  for (const side of SIDES) {
    const player = state.players[side];
    const input = inputs[side];
    if (state.phase === 'rally' && state.config.mode === 'power' && input.action
      && !player.powered && player.charge === 5) setPower(state, side, true, events);
    const movement = Number(input.down) - Number(input.up);
    player.y = clamp(player.y + movement * state.config.paddleSpeed / state.config.tickRate,
      0, state.config.height - player.height);
  }
  if (state.phase === 'ready' || state.phase === 'point') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (state.phaseTicks === 0) serve(state, rng, events);
  } else {
    moveBall(state, events);
  }
  return { state, events };
}

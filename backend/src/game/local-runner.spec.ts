import { createGame, NEUTRAL_INPUT, GameState } from '../../../shared/game-core';
import { STEP_MS } from '../../../shared/fixed-clock';
import { LocalMatchRunner, FrameScheduler, RunnerOptions } from '../../../frontend/src/arcade/local-match-runner';
import { bindingError, copyBindings, DEFAULT_BINDINGS, EventSource, KeyboardController, KeyBindings } from '../../../frontend/src/arcade/keyboard-controller';
import { readPreferences } from '../../../frontend/src/arcade/preferences';

class FakeFrames implements FrameScheduler {
  callbacks = new Map<number, (timestamp: number) => void>();
  time = 0;
  private id = 0;
  request(callback: (timestamp: number) => void): number { this.callbacks.set(++this.id, callback); return this.id; }
  cancel(id: number): void { this.callbacks.delete(id); }
  now(): number { return this.time; }
  frame(time: number): void {
    this.time = time;
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(time));
  }
}
class FakeEvents implements EventSource {
  listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) || new Set<EventListener>();
    set.add(listener); this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: EventListener): void { this.listeners.get(type)?.delete(listener); }
  dispatch(type: string, options: { code?: string; repeat?: boolean; target?: object } = {}) {
    const event = { ...options, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    this.listeners.get(type)?.forEach((listener) => listener(event as unknown as Event));
    return event;
  }
  get count(): number { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}
function keyboardFixture() {
  const events = new FakeEvents();
  const visibility = new FakeEvents();
  const surface = new FakeEvents();
  const onPause = jest.fn();
  const environment = { focused: true, hidden: false };
  const keyboard = new KeyboardController({
    events, visibility, surface, onPause,
    isFocused: () => environment.focused, isHidden: () => environment.hidden,
  });
  keyboard.attach(); keyboard.setEnabled(true);
  return { keyboard, events, visibility, surface, environment, onPause };
}
function runnerFixture(overrides: Partial<RunnerOptions> = {}) {
  const scheduler = new FakeFrames();
  const frame = jest.fn();
  const runner = new LocalMatchRunner({
    seed: 20260907, scheduler, input: () => ({ left: NEUTRAL_INPUT, right: NEUTRAL_INPUT }), frame, ...overrides,
  });
  return { runner, scheduler, frame };
}

describe('local keyboard ownership and simultaneous input', () => {
  test('both players hold movement while each action edge is consumed once', () => {
    const { keyboard, events } = keyboardFixture();
    for (const code of ['KeyW', 'KeyD', 'ArrowDown', 'ArrowLeft']) events.dispatch('keydown', { code });
    expect(keyboard.read('left')).toEqual({ up: true, down: false, action: true });
    expect(keyboard.read('right')).toEqual({ up: false, down: true, action: true });
    expect(keyboard.read('left')).toEqual({ up: true, down: false, action: false });
    events.dispatch('keydown', { code: 'KeyD', repeat: true });
    expect(keyboard.read('left').action).toBe(false);
    events.dispatch('keyup', { code: 'KeyD' });
    events.dispatch('keydown', { code: 'KeyD' });
    expect(keyboard.read('left').action).toBe(true);
  });
  test('opposite held keys are neutral, preserving an independent action', () => {
    const { keyboard, events } = keyboardFixture();
    for (const code of ['KeyW', 'KeyS', 'KeyD']) events.dispatch('keydown', { code });
    expect(keyboard.read('left')).toEqual({ up: false, down: false, action: true });
    events.dispatch('keyup', { code: 'KeyS' });
    expect(keyboard.read('left')).toEqual({ up: true, down: false, action: false });
  });
  test('only owned game keys prevent defaults; form/contenteditable input stays untouched', () => {
    const { keyboard, events, environment } = keyboardFixture();
    expect(events.dispatch('keydown', { code: 'ArrowUp' }).defaultPrevented).toBe(true);
    expect(events.dispatch('keydown', { code: 'KeyQ' }).defaultPrevented).toBe(false);
    keyboard.clear();
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { isContentEditable: true }]) {
      expect(events.dispatch('keydown', { code: 'KeyW', target }).defaultPrevented).toBe(false);
      expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    }
    environment.focused = false;
    expect(events.dispatch('keydown', { code: 'ArrowDown' }).defaultPrevented).toBe(false);
    expect(keyboard.read('right')).toEqual(NEUTRAL_INPUT);
  });
  test('blur/hidden clear held state and request pause; visibility return never requests resume', () => {
    const { keyboard, events, visibility, environment, onPause } = keyboardFixture();
    events.dispatch('keydown', { code: 'KeyW' });
    events.dispatch('blur');
    expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    expect(onPause).toHaveBeenLastCalledWith('blur');
    events.dispatch('keydown', { code: 'KeyS' });
    environment.hidden = true;
    visibility.dispatch('visibilitychange');
    expect(onPause).toHaveBeenLastCalledWith('hidden');
    expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    environment.hidden = false;
    visibility.dispatch('visibilitychange');
    expect(onPause).toHaveBeenCalledTimes(2);
    expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
  });
  test('surface blur, remapping, disable, and disposal release input', () => {
    const { keyboard, events, surface } = keyboardFixture();
    events.dispatch('keydown', { code: 'KeyW' }); surface.dispatch('blur');
    expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    const bindings = copyBindings(DEFAULT_BINDINGS); bindings.left.up = 'KeyE';
    keyboard.configure(bindings);
    events.dispatch('keydown', { code: 'KeyW' }); expect(keyboard.read('left').up).toBe(false);
    events.dispatch('keydown', { code: 'KeyE' }); expect(keyboard.read('left').up).toBe(true);
    keyboard.setEnabled(false); expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    keyboard.setEnabled(true); expect(keyboard.read('left')).toEqual(NEUTRAL_INPUT);
    keyboard.dispose(); keyboard.dispose();
    expect(events.count).toBe(0); expect(surface.count).toBe(0);
  });
  test('attach is idempotent, Escape is a command edge, key repeat does not retrigger pause', () => {
    const { keyboard, events, onPause, visibility, surface } = keyboardFixture();
    keyboard.attach(); expect(events.count + visibility.count + surface.count).toBe(5);
    events.dispatch('keydown', { code: 'Escape' }); events.dispatch('keydown', { code: 'Escape', repeat: true });
    expect(onPause).toHaveBeenCalledTimes(1);
    keyboard.dispose(); expect(events.count + visibility.count + surface.count).toBe(0);
  });
  test('duplicate, reserved, and missing binding fields are rejected', () => {
    const duplicate = copyBindings(DEFAULT_BINDINGS); duplicate.right.up = 'KeyW';
    expect(bindingError(duplicate)).not.toBeNull();
    const reserved = copyBindings(DEFAULT_BINDINGS); reserved.left.up = 'Escape';
    expect(bindingError(reserved)).not.toBeNull();
    const malformed = { left: { foo: 'KeyW', bar: 'KeyS', baz: 'KeyD' }, right: DEFAULT_BINDINGS.right };
    expect(bindingError(malformed as unknown as KeyBindings)).not.toBeNull();
    expect(bindingError(DEFAULT_BINDINGS)).toBeNull();
  });
  test('malformed persisted key fields and unavailable storage fall back to usable defaults', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => JSON.stringify({ bindings: { left: { foo: 'KeyW', bar: 'KeyS', baz: 'KeyD' }, right: DEFAULT_BINDINGS.right } }),
      } });
      expect(readPreferences().bindings).toEqual(DEFAULT_BINDINGS);
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { throw new Error('storage denied'); } } });
      expect(readPreferences().bindings).toEqual(DEFAULT_BINDINGS);
    } finally {
      if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('local fixed-tick runner lifecycle', () => {
  test('start/stop/dispose are idempotent and late generations cannot create another RAF', () => {
    const { runner, scheduler } = runnerFixture();
    runner.start(); runner.start(); expect(scheduler.callbacks.size).toBe(1);
    const lateFrame = [...scheduler.callbacks.values()][0];
    runner.stop(); runner.stop(); expect(scheduler.callbacks.size).toBe(0);
    runner.start(); lateFrame(1000); expect(scheduler.callbacks.size).toBe(1); expect(runner.snapshot.tick).toBe(0);
    runner.dispose(); runner.dispose(); runner.start(); expect(scheduler.callbacks.size).toBe(0);
  });
  test('pause/resume drops hidden wall time and restarts with a neutral clock', () => {
    const { runner, scheduler } = runnerFixture();
    runner.start(); scheduler.frame(0); scheduler.frame(STEP_MS); expect(runner.snapshot.tick).toBe(1);
    runner.stop(); scheduler.frame(10000); runner.start(); scheduler.frame(20000);
    expect(runner.snapshot.tick).toBe(1);
    scheduler.frame(20000 + STEP_MS); expect(runner.snapshot.tick).toBe(2);
  });
  test('a long frame advances at most eight ticks and reports dropped time', () => {
    const { runner, scheduler } = runnerFixture();
    runner.start(); scheduler.frame(0); scheduler.frame(10000);
    expect(runner.snapshot.tick).toBe(8);
    expect(runner.measurement.lastSteps).toBe(8);
    expect(runner.measurement.droppedMs).toBeGreaterThan(9800);
  });
  test('same seed/tick input yields identical states at 30, 60 and 120 RAF Hz', () => {
    const snapshots: GameState[] = [];
    for (const rate of [30, 60, 120]) {
      const { runner, scheduler } = runnerFixture({ input: (state) => ({
        left: { up: state.tick % 90 < 30, down: state.tick % 90 >= 60, action: false }, right: NEUTRAL_INPUT,
      }) });
      runner.start();
      for (let frame = 0; frame <= rate * 5; frame++) scheduler.frame(frame * 1000 / rate);
      snapshots.push(runner.snapshot); runner.dispose();
    }
    expect(snapshots[0]).toEqual(snapshots[1]); expect(snapshots[1]).toEqual(snapshots[2]);
    expect(snapshots[0].tick).toBe(300);
  });
  test('separate matches, returned snapshots and restart do not share mutable state', () => {
    const first = runnerFixture(); const second = runnerFixture();
    first.runner.start(); first.scheduler.frame(0); first.scheduler.frame(100);
    const snapshot = first.runner.snapshot; snapshot.players.left.score = 99; snapshot.ball.x = -999;
    expect(first.runner.snapshot.players.left.score).toBe(0); expect(second.runner.snapshot.tick).toBe(0);
    const oldCallback = [...first.scheduler.callbacks.values()][0];
    first.runner.restart(); oldCallback(200);
    expect(first.runner.snapshot).toEqual(createGame()); expect(first.scheduler.callbacks.size).toBe(1);
    first.runner.dispose(); second.runner.dispose();
  });
  test('a full real-core match finishes once and restart creates another ready match', () => {
    const events = jest.fn();
    const { runner, scheduler } = runnerFixture({ events });
    runner.start();
    for (let frame = 0; frame < 14400 && runner.active; frame++) scheduler.frame(frame * STEP_MS);
    expect(runner.snapshot.phase).toBe('finished');
    const finished = runner.snapshot;
    expect(Math.max(finished.players.left.score, finished.players.right.score)).toBe(6);
    expect(events.mock.calls.flatMap((args) => args[0]).filter((event) => event.type === 'finished')).toHaveLength(1);
    expect(scheduler.callbacks.size).toBe(0); scheduler.frame(999999); expect(runner.snapshot).toEqual(finished);
    runner.restart(); expect(runner.snapshot.phase).toBe('ready'); expect(runner.snapshot.tick).toBe(0);
    runner.dispose();
  });
  test('restarting in an event callback cannot spend the old frame backlog on the new match', () => {
    let runner: LocalMatchRunner;
    const scheduler = new FakeFrames();
    runner = new LocalMatchRunner({
      config: { readyTicks: 1 }, seed: 1, scheduler,
      input: () => ({ left: NEUTRAL_INPUT, right: NEUTRAL_INPUT }), frame: () => undefined,
      events: () => runner.restart(),
    });
    runner.start(); scheduler.frame(0); scheduler.frame(100);
    expect(runner.snapshot.tick).toBe(0); expect(runner.snapshot.phase).toBe('ready');
    expect(scheduler.callbacks.size).toBe(1); runner.dispose();
  });
  test('a step failure stops the runner and reports the real error', () => {
    const error = jest.fn(); const { runner, scheduler } = runnerFixture({ error, input: () => { throw new Error('fixture input failure'); } });
    runner.start(); scheduler.frame(0); scheduler.frame(STEP_MS);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'fixture input failure' }));
    expect(runner.active).toBe(false); expect(scheduler.callbacks.size).toBe(0);
  });
});

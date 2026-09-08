import { PlayerInput, Side } from '../../../shared/game-core';

export interface PlayerBindings { up: string; down: string; action: string }
export type KeyBindings = Record<Side, PlayerBindings>;
export const DEFAULT_BINDINGS: KeyBindings = {
  left: { up: 'KeyW', down: 'KeyS', action: 'KeyD' },
  right: { up: 'ArrowUp', down: 'ArrowDown', action: 'ArrowLeft' },
};
export const KEY_OPTIONS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
];
export function keyLabel(code: string): string {
  return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space' } as Record<string, string>)[code]
    || code.replace(/^Key/, '');
}
export function copyBindings(bindings: KeyBindings): KeyBindings {
  return { left: { ...bindings.left }, right: { ...bindings.right } };
}
export function bindingError(bindings: KeyBindings): string | null {
  const keys = [bindings.left.up, bindings.left.down, bindings.left.action, bindings.right.up, bindings.right.down, bindings.right.action];
  if (keys.length !== 6 || keys.some((key) => !KEY_OPTIONS.includes(key))) return '지원하는 키를 선택해 주세요.';
  if (new Set(keys).size !== keys.length) return '각 조작에는 서로 다른 키를 지정해 주세요.';
  return null;
}

export interface EventSource {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}
export interface KeyboardEnvironment {
  events: EventSource;
  visibility: EventSource;
  surface: EventSource;
  isFocused(): boolean;
  isHidden(): boolean;
  onPause(reason: 'blur' | 'hidden' | 'keyboard'): void;
}

/** Held movement and one-tick actions are independent; no browser globals. */
export class KeyboardController {
  private bindings: KeyBindings;
  private held = new Set<string>();
  private actions = new Set<Side>();
  private attached = false;
  private enabled = false;

  constructor(private environment: KeyboardEnvironment, bindings = DEFAULT_BINDINGS) {
    const error = bindingError(bindings);
    if (error) throw new Error(error);
    this.bindings = copyBindings(bindings);
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.environment.events.addEventListener('keydown', this.keydown);
    this.environment.events.addEventListener('keyup', this.keyup);
    this.environment.events.addEventListener('blur', this.blur);
    this.environment.visibility.addEventListener('visibilitychange', this.visibility);
    this.environment.surface.addEventListener('blur', this.surfaceBlur);
  }

  dispose(): void {
    this.setEnabled(false);
    if (!this.attached) return;
    this.attached = false;
    this.environment.events.removeEventListener('keydown', this.keydown);
    this.environment.events.removeEventListener('keyup', this.keyup);
    this.environment.events.removeEventListener('blur', this.blur);
    this.environment.visibility.removeEventListener('visibilitychange', this.visibility);
    this.environment.surface.removeEventListener('blur', this.surfaceBlur);
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; this.clear(); }
  clear(): void { this.held.clear(); this.actions.clear(); }
  configure(bindings: KeyBindings): void {
    const error = bindingError(bindings);
    if (error) throw new Error(error);
    this.clear();
    this.bindings = copyBindings(bindings);
  }

  read(side: Side): PlayerInput {
    if (!this.enabled || !this.environment.isFocused() || this.environment.isHidden()) {
      this.clear();
      return { up: false, down: false, action: false };
    }
    const keys = this.bindings[side];
    const up = this.held.has(keys.up);
    const down = this.held.has(keys.down);
    return { up: up && !down, down: down && !up, action: this.actions.delete(side) };
  }

  private accepts(event: KeyboardEvent): boolean {
    const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
    return this.attached && this.enabled && this.environment.isFocused() && !this.environment.isHidden()
      && !event.defaultPrevented && !target?.isContentEditable
      && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '');
  }

  private keydown = ((event: KeyboardEvent) => {
    if (!this.accepts(event)) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) { this.clear(); this.environment.onPause('keyboard'); }
      return;
    }
    const sides: Side[] = ['left', 'right'];
    if (!sides.some((side) => Object.values(this.bindings[side]).includes(event.code))) return;
    event.preventDefault();
    const wasHeld = this.held.has(event.code);
    this.held.add(event.code);
    if (!wasHeld && !event.repeat) {
      sides.forEach((side) => {
        if (this.bindings[side].action === event.code) this.actions.add(side);
      });
    }
  }) as EventListener;

  private keyup = ((event: KeyboardEvent) => {
    this.held.delete(event.code);
    if (this.accepts(event) && Object.values(this.bindings).some((keys) => Object.values(keys).includes(event.code))) {
      event.preventDefault();
    }
  }) as EventListener;
  private surfaceBlur = (() => this.clear()) as EventListener;
  private blur = (() => {
    this.clear();
    if (this.enabled) this.environment.onPause('blur');
  }) as EventListener;
  private visibility = (() => {
    this.clear();
    if (this.enabled && this.environment.isHidden()) this.environment.onPause('hidden');
  }) as EventListener;
}

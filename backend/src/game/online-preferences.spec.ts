import { onlineBindings, readOnlinePreferences, saveOnlinePreferences } from '../../../frontend/src/arcade/online-preferences';
import { readPreferences } from '../../../frontend/src/arcade/preferences';

describe('online three-key presets stay separate from local six-key bindings', () => {
  let original: PropertyDescriptor | undefined;
  const storage = new Map<string, string>();
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); storage.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value),
    } });
  });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  it('preserves arrows+Space and W/S/D, stores online choice, and never changes local ArrowLeft Power', () => {
    expect(readOnlinePreferences()).toEqual({ layout: 'arrows', motion: 'system' });
    expect(onlineBindings('arrows')).toEqual({ up: 'ArrowUp', down: 'ArrowDown', action: 'Space' });
    saveOnlinePreferences({ layout: 'wasd', motion: 'reduce' });
    expect(readOnlinePreferences()).toEqual({ layout: 'wasd', motion: 'reduce' });
    expect(onlineBindings('wasd')).toEqual({ up: 'KeyW', down: 'KeyS', action: 'KeyD' });
    expect(readPreferences().bindings.right.action).toBe('ArrowLeft');
    expect(readPreferences().muted).toBe(true);
  });
  it('returns owned bindings and handles malformed/blocked storage without blocking play', () => {
    const keys = onlineBindings('arrows'); keys.action = 'KeyQ';
    expect(onlineBindings('arrows').action).toBe('Space');
    storage.set('transcendence.online.preferences.v1', '{broken');
    expect(readOnlinePreferences()).toEqual({ layout: 'arrows', motion: 'system' });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Blocked'); } });
    expect(readOnlinePreferences()).toEqual({ layout: 'arrows', motion: 'system' });
    expect(() => saveOnlinePreferences({ layout: 'wasd', motion: 'reduce' })).not.toThrow();
  });
});

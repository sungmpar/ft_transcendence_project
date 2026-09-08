import type { PlayerBindings } from './keyboard-controller';

export type OnlineKeyLayout = 'arrows' | 'wasd';
export interface OnlinePreferences { layout: OnlineKeyLayout; motion: 'system' | 'reduce' }
const STORAGE_KEY = 'transcendence.online.preferences.v1';
const PRESETS: Record<OnlineKeyLayout, PlayerBindings> = {
  arrows: { up: 'ArrowUp', down: 'ArrowDown', action: 'Space' },
  wasd: { up: 'KeyW', down: 'KeyS', action: 'KeyD' },
};
export function onlineBindings(layout: OnlineKeyLayout): PlayerBindings { return { ...PRESETS[layout] }; }
export function readOnlinePreferences(): OnlinePreferences {
  const result: OnlinePreferences = { layout: 'arrows', motion: 'system' };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (value?.layout === 'arrows' || value?.layout === 'wasd') result.layout = value.layout;
    if (value?.motion === 'system' || value?.motion === 'reduce') result.motion = value.motion;
  } catch { /* Local play and online controls do not require storage. */ }
  return result;
}
export function saveOnlinePreferences(value: OnlinePreferences): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Optional storage. */ }
}

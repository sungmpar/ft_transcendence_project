import { RuleMode } from '../../../shared/game-core';
import { bindingError, copyBindings, DEFAULT_BINDINGS, KeyBindings } from './keyboard-controller';

export interface ArcadePreferences {
  rule: RuleMode;
  difficulty: 'easy' | 'normal' | 'hard';
  humanKeys: 'left' | 'right';
  bindings: KeyBindings;
  muted: boolean;
}
const STORAGE_KEY = 'transcendence.arcade.preferences.v1';
export function readPreferences(): ArcadePreferences {
  const fallback: ArcadePreferences = {
    rule: 'classic', difficulty: 'normal', humanKeys: 'left', bindings: copyBindings(DEFAULT_BINDINGS), muted: true,
  };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return fallback;
    if (value.rule === 'classic' || value.rule === 'power') fallback.rule = value.rule;
    if (['easy', 'normal', 'hard'].includes(value.difficulty)) fallback.difficulty = value.difficulty;
    if (value.humanKeys === 'left' || value.humanKeys === 'right') fallback.humanKeys = value.humanKeys;
    if (value.bindings?.left && value.bindings?.right && !bindingError(value.bindings)) fallback.bindings = copyBindings(value.bindings);
    if (typeof value.muted === 'boolean') fallback.muted = value.muted;
  } catch { /* Storage is optional, including in private/blocked environments. */ }
  return fallback;
}
export function savePreferences(preferences: ArcadePreferences): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Play does not need storage. */ }
}

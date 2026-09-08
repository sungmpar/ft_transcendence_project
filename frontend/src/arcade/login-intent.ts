/** A small, tab-local contract; never accept arbitrary return URLs or credentials. */
export type LoginDestination = '/game' | '/invite' | '/spectate';
export const LOGIN_INTENT_KEY = 'transcendence.online-intent.v1';
export const LOGIN_INTENT_TTL_MS = 10 * 60 * 1000;

export function parseLoginDestination(value: unknown): LoginDestination | null {
  return value === '/game' || value === '/invite' || value === '/spectate' ? value : null;
}
export function clearLoginIntent(): void {
  try { sessionStorage.removeItem(LOGIN_INTENT_KEY); } catch { /* Storage is optional. */ }
}
export function rememberLoginIntent(value: unknown, now = Date.now()): boolean {
  clearLoginIntent();
  const destination = parseLoginDestination(value);
  if (!destination) return false;
  try {
    sessionStorage.setItem(LOGIN_INTENT_KEY, JSON.stringify({ version: 1, destination, createdAt: now }));
    return true;
  } catch { return false; }
}
export function readLoginIntent(now = Date.now()): LoginDestination | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(LOGIN_INTENT_KEY) || 'null');
    const destination = parseLoginDestination(value?.destination);
    if (value?.version === 1 && destination && Number.isFinite(value.createdAt) &&
      value.createdAt <= now && now - value.createdAt < LOGIN_INTENT_TTL_MS) return destination;
  } catch { /* Malformed or blocked storage falls back to Home. */ }
  clearLoginIntent();
  return null;
}
export function consumeLoginIntent(now = Date.now()): LoginDestination | null {
  const destination = readLoginIntent(now);
  clearLoginIntent();
  return destination;
}

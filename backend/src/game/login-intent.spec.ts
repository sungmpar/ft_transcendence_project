import { clearLoginIntent, consumeLoginIntent, LOGIN_INTENT_KEY, LOGIN_INTENT_TTL_MS,
  parseLoginDestination, readLoginIntent, rememberLoginIntent } from '../../../frontend/src/arcade/login-intent';

describe('bounded online login intent across a full document redirect', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  });
  afterAll(() => { Reflect.deleteProperty(globalThis, 'sessionStorage'); });

  test.each(['/game', '/invite', '/spectate'])('only permits the exact online destination %s', (path) => {
    expect(parseLoginDestination(path)).toBe(path);
    rememberLoginIntent(path, 1000);
    expect(readLoginIntent(1001)).toBe(path);
  });
  test.each(['https://example.com/game', '//example.com/game', 'javascript:alert(1)',
    '/login?token=check', '/', '/play', '/game?next=https://example.com', '/game#fragment',
    '/game/', '/%67ame', ['/game'], { path: '/game' }, null, ' /game'])('rejects invalid destinations (%p)', (path) => {
    rememberLoginIntent('/game', 1000);
    expect(parseLoginDestination(path)).toBeNull();
    expect(rememberLoginIntent(path, 1001)).toBe(false);
    expect(readLoginIntent(1002)).toBeNull();
  });
  test('survives module reload, is single use, and stores no credentials', () => {
    rememberLoginIntent('/spectate', 1000);
    expect(JSON.parse(values.get(LOGIN_INTENT_KEY)!)).toEqual({ version: 1, destination: '/spectate', createdAt: 1000 });
    jest.resetModules();
    const reloaded = require('../../../frontend/src/arcade/login-intent') as typeof import('../../../frontend/src/arcade/login-intent');
    expect(reloaded.consumeLoginIntent(2000)).toBe('/spectate');
    expect(readLoginIntent(2001)).toBeNull();
  });
  test('expires after ten minutes and rejects future/corrupt records', () => {
    rememberLoginIntent('/game', 1000);
    expect(readLoginIntent(1000 + LOGIN_INTENT_TTL_MS)).toBeNull();
    for (const record of ['{', 'null', '{"destination":"/game"}',
      JSON.stringify({ version: 1, destination: '/game', createdAt: 3000 }),
      JSON.stringify({ version: 2, destination: '/game', createdAt: 1000 })]) {
      values.set(LOGIN_INTENT_KEY, record);
      expect(readLoginIntent(2000)).toBeNull();
      expect(values.has(LOGIN_INTENT_KEY)).toBe(false);
    }
  });
  test('explicit cancellation removes a pending destination', () => {
    rememberLoginIntent('/invite', 1000); clearLoginIntent();
    expect(consumeLoginIntent(1001)).toBeNull();
  });
  test('unavailable storage cannot break login or public play', () => {
    storage.getItem = () => { throw new Error('blocked'); };
    storage.setItem = () => { throw new Error('blocked'); };
    storage.removeItem = () => { throw new Error('blocked'); };
    expect(rememberLoginIntent('/game')).toBe(false);
    expect(readLoginIntent()).toBeNull();
    expect(() => clearLoginIntent()).not.toThrow();
  });
});

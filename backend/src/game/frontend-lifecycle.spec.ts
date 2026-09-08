import { canonicalReady, OnlineBrowserFixture } from '../../test/online-browser-unit-fixture';
import { isMatchInput } from '../../../shared/protocol';

/**
 * C03/C04/C08 retain their baseline behavioral contracts. The new required v1
 * ready fixture replaces the obsolete implicit start payload, and real keyboard
 * events now traverse KeyboardController -> OnlineSession -> MatchInput instead
 * of the unused legacy Bar string encoder. Fake clocks are not browser play.
 */
describe('frontend game lifecycle and input contracts', () => {
  let fixture: OnlineBrowserFixture;
  let service: typeof import('../../../frontend/src/plugins/gamePlayService').GameplayService;
  let store: typeof import('../../../frontend/src/store').default;

  beforeEach(() => {
    jest.resetModules();
    // Vue loads before the intentionally minimal fake DOM is installed.
    store = require('../../../frontend/src/store').default;
    fixture = new OnlineBrowserFixture();
    fixture.install();
    store.commit('setGameSocket', fixture.socket);
    service = require('../../../frontend/src/plugins/gamePlayService').GameplayService;
    service.useKeyLayout('arrows');
  });

  afterEach(() => {
    service.dispose(); fixture.restore(); jest.restoreAllMocks();
  });

  test('C08: repeated start owns only one RAF loop and one listener per event', () => {
    expect(service.start(fixture.context, 'black', canonicalReady())).toBe(true);
    expect(service.start(fixture.context, 'black', canonicalReady())).toBe(true);
    expect({ frames: fixture.callbacks.size, keydown: fixture.windowEvents.count('keydown'),
      keyup: fixture.windowEvents.count('keyup') }).toEqual({ frames: 1, keydown: 1, keyup: 1 });
    expect(fixture.socketEvents.count('snapshot')).toBe(1);
  });

  test('C08: stop removes the current loop and keyboard listeners', () => {
    service.start(fixture.context, 'black', canonicalReady()); service.stop('left');
    expect(fixture.callbacks.size).toBe(0);
    expect(fixture.windowEvents.count('keydown')).toBe(0);
    expect(fixture.windowEvents.count('keyup')).toBe(0);
    expect(fixture.listenerCount()).toBe(0);
  });

  test('C08: a late callback from a stopped generation cannot restart rendering', () => {
    service.start(fixture.context, 'black', canonicalReady());
    const lateFrame = [...fixture.callbacks.values()][0];
    service.stop('left'); lateFrame(100);
    expect(fixture.callbacks.size).toBe(0);
  });

  test('C08: dispose is safe before start and when repeated', () => {
    expect(() => {
      service.dispose(); service.dispose();
      service.start(fixture.context, 'black', canonicalReady());
      service.dispose(); service.dispose();
    }).not.toThrow();
    expect(fixture.callbacks.size).toBe(0);
    expect(fixture.windowEvents.count('keydown')).toBe(0);
    expect(fixture.windowEvents.count('keyup')).toBe(0);
  });

  test('C08: callbacks from a replaced generation cannot affect the new game', () => {
    service.start(fixture.context, 'black', canonicalReady());
    const lateFrame = [...fixture.callbacks.values()][0];
    const lateKey = [...fixture.windowEvents.listeners.get('keydown')!][0];
    service.start(fixture.context, 'black', canonicalReady(false, 'left', 2));
    // Replacement legitimately sends a final neutral packet before teardown.
    // The unchanged contract below concerns effects from the OLD callbacks.
    fixture.socket.emit.mockClear();
    lateFrame(100); lateKey({ code: 'ArrowUp', target: fixture.canvas, defaultPrevented: false });
    expect(fixture.callbacks.size).toBe(1);
    expect(fixture.socket.emit).not.toHaveBeenCalled();
    fixture.frame(116);
    expect(fixture.packets()[0]).toMatchObject({ generation: 2, up: false, down: false });
  });

  test.each([true, false])('C03: server ready roomMode=%s is retained', (roomMode) => {
    const ready = canonicalReady(roomMode); store.commit('setRoom', ready);
    expect(store.getters.room.mode).toBe(roomMode);
    expect(store.getters.room.roomId).toBe(ready.roomId);
    expect(service.start(fixture.context, 'black', ready)).toBe(true);
    fixture.frame(0);
    expect(store.getters.onlineState.config.mode).toBe(roomMode ? 'power' : 'classic');
  });

  test('C04: opposing held movement keys produce neutral input', () => {
    service.start(fixture.context, 'black', canonicalReady()); fixture.frame(0);
    const neutral = fixture.packets()[0];
    fixture.key('ArrowUp'); fixture.key('ArrowDown'); fixture.frame(100);
    const packet = fixture.packets()[fixture.packets().length - 1];
    expect(isMatchInput(packet)).toBe(true);
    // Sequence advances on a state refresh; the held movement is still neutral.
    expect({ up: packet.up, down: packet.down }).toEqual({ up: neutral.up, down: neutral.down });
    expect(packet).toMatchObject({ up: false, down: false });
  });

  test('C04: held movement and a Power press are both represented', () => {
    service.start(fixture.context, 'black', canonicalReady(true));
    fixture.key('ArrowUp'); fixture.frame(0);
    const movementOnly = fixture.packets()[0];
    fixture.key('Space'); fixture.frame(16);
    const combined = fixture.packets()[1];
    expect(isMatchInput(combined)).toBe(true);
    expect(movementOnly).toMatchObject({ up: true, down: false, actionId: 0 });
    expect(combined).toMatchObject({ up: true, down: false, actionId: 1 });
    expect(combined.seq).toBeGreaterThan(movementOnly.seq);
  });
});

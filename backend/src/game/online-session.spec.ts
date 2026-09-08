import { OnlineSession } from '../../../frontend/src/arcade/online-session';
import { canonicalReady, nextSnapshot, OnlineBrowserFixture } from '../../test/online-browser-unit-fixture';
import { isMatchInput, ReadyMessage } from '../../../shared/protocol';

describe('actual online session class with owned fake DOM and transport', () => {
  let fixture: OnlineBrowserFixture;
  let session: OnlineSession | undefined;
  let onState: jest.Mock;
  let onStatus: jest.Mock;
  function start(ready: ReadyMessage = canonicalReady()) {
    session = new OnlineSession({ canvas: fixture.canvas, socket: fixture.socket, ready, onState, onStatus });
    return session;
  }
  beforeEach(() => {
    fixture = new OnlineBrowserFixture(); fixture.install();
    onState = jest.fn(); onStatus = jest.fn(); session = undefined;
  });
  afterEach(() => { session?.dispose(); fixture.restore(); });

  it('receives 20Hz snapshots without adding RAF loops or advancing simulation', () => {
    start();
    const initialCallbacks = [...fixture.callbacks.keys()];
    for (let seq = 1; seq <= 20; seq++) {
      fixture.now = seq * 50;
      fixture.socketEvents.dispatch('snapshot', nextSnapshot(seq * 3, seq));
    }
    expect([...fixture.callbacks.keys()]).toEqual(initialCallbacks);
    expect(session!.state.tick).toBe(0);
    expect(session!.latest.tick).toBe(60);
    expect(session!.measurement.snapshots).toBe(20);
    expect(onState).not.toHaveBeenCalled();
  });

  it('restores every owned listener and cancels late callbacks when disposed repeatedly', () => {
    start(); expect(fixture.listenerCount()).toBeGreaterThan(0);
    const lateFrame = [...fixture.callbacks.values()][0];
    const latePacket = [...fixture.socketEvents.listeners.get('snapshot')!][0];
    session!.dispose(); session!.dispose();
    fixture.socket.emit.mockClear(); onState.mockClear();
    lateFrame(100); latePacket(nextSnapshot(3, 1));
    expect(fixture.callbacks.size).toBe(0);
    expect(fixture.listenerCount()).toBe(0);
    expect(fixture.socket.emit).not.toHaveBeenCalled();
    expect(onState).not.toHaveBeenCalled();
  });

  it('ignores late transport status callbacks after the session owner is disposed', () => {
    start();
    const late = ['disconnect', 'connect', 'resultStatus', 'sessionStatus'].map((event) =>
      [...fixture.socketEvents.listeners.get(event)!][0]);
    session!.dispose(); onStatus.mockClear();
    late[0]({}); late[1]({});
    late[2]({ roomId: canonicalReady().roomId, status: 'saved' });
    late[3]({ roomId: canonicalReady().roomId, status: 'active' });
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('ignores missing or wrong match IDs in result and connection status events', () => {
    start(); onStatus.mockClear();
    for (const [event, status] of [['resultStatus', 'saved'], ['sessionStatus', 'active']]) {
      fixture.socketEvents.dispatch(event, { status });
      fixture.socketEvents.dispatch(event, { roomId: 'other-match', status });
      fixture.socketEvents.dispatch(event, null);
    }
    expect(onStatus).not.toHaveBeenCalled();
    fixture.socketEvents.dispatch('resultStatus', { roomId: canonicalReady().roomId, status: 'saving' });
    fixture.socketEvents.dispatch('sessionStatus', { roomId: canonicalReady().roomId, status: 'active' });
    expect(onStatus).toHaveBeenCalledTimes(2);
  });

  it('sends held movement plus one ability edge using valid increasing DTOs', () => {
    start(canonicalReady(true));
    fixture.key('ArrowUp'); fixture.key('Space'); fixture.frame(0);
    fixture.key('Space', { repeat: true }); fixture.frame(50); fixture.frame(100);
    fixture.key('Space', { up: true }); fixture.key('Space'); fixture.frame(116);
    const packets = fixture.packets();
    expect(packets.every(isMatchInput)).toBe(true);
    expect(packets.map((packet) => packet.seq)).toEqual([1, 2, 3]);
    expect(packets.map((packet) => packet.actionId)).toEqual([1, 1, 2]);
    expect(packets.every((packet) => packet.up && !packet.down)).toBe(true);
  });

  it('refreshes a held movement at 100ms without manufacturing action presses', () => {
    start(); fixture.key('ArrowDown');
    [0, 50, 99, 100, 150, 200].forEach((time) => fixture.frame(time));
    expect(fixture.packets()).toHaveLength(3);
    expect(fixture.packets().every((packet) => !packet.up && packet.down && packet.actionId === 0)).toBe(true);
  });

  it('ignores form typing and returns neutral input on focus loss', () => {
    start();
    const event = fixture.key('ArrowUp', { target: { tagName: 'INPUT' } }); fixture.frame(0);
    expect(event.defaultPrevented).toBe(false);
    expect(fixture.packets()[0]).toMatchObject({ up: false, down: false });
    fixture.key('ArrowUp'); fixture.frame(16);
    expect(fixture.packets()[1].up).toBe(true);
    fixture.document.activeElement = { tagName: 'TEXTAREA' }; fixture.frame(32);
    expect(fixture.packets()[2]).toMatchObject({ up: false, down: false });
  });

  it('clears held movement on window blur and hidden without stopping server rendering', () => {
    start(); fixture.key('ArrowUp'); fixture.frame(0);
    fixture.now = 10; fixture.windowEvents.dispatch('blur');
    expect(fixture.packets()[1]).toMatchObject({ up: false, down: false });
    fixture.key('ArrowDown'); fixture.frame(16);
    fixture.document.hidden = true; fixture.now = 20; fixture.documentEvents.dispatch('visibilitychange');
    expect(fixture.packets()[fixture.packets().length - 1]).toMatchObject({ up: false, down: false });
    expect(fixture.callbacks.size).toBe(1);
  });

  it('never emits spectator input, including blur, layout changes and disposal', () => {
    start(canonicalReady(false, 'spectator'));
    fixture.canvas.focus(); fixture.key('ArrowUp'); fixture.frame(0);
    fixture.windowEvents.dispatch('blur'); session!.useKeyLayout('wasd'); fixture.frame(100); session!.dispose();
    expect(fixture.packets()).toEqual([]);
  });

  it('rejects invalid, wrong-match, duplicate and old snapshots', () => {
    start(); fixture.now = 50; fixture.socketEvents.dispatch('snapshot', nextSnapshot(3, 1));
    const wrong = nextSnapshot(6, 2); wrong.matchId = 'different-match';
    fixture.socketEvents.dispatch('snapshot', wrong);
    fixture.socketEvents.dispatch('snapshot', nextSnapshot(3, 1));
    fixture.socketEvents.dispatch('snapshot', null);
    fixture.socketEvents.dispatch('snapshot', nextSnapshot(0, 0));
    expect(session!.latest.tick).toBe(3);
    expect(session!.measurement.snapshots).toBe(1);
  });

  it('owns ready and received snapshot data used for latest state and completion', () => {
    const ready = canonicalReady(); start(ready); ready.snapshot.state.ball.x = 999;
    expect(session!.latest.ball.x).toBe(600);
    const packet = nextSnapshot(3, 1); fixture.now = 50;
    fixture.socketEvents.dispatch('snapshot', packet); packet.state.ball.x = 888;
    expect(session!.latest.ball.x).toBe(600);
    session!.complete();
    expect(onState.mock.calls[onState.mock.calls.length - 1][0].ball.x).toBe(600);
  });

  it('flushes the authoritative winning score on completion ahead of interpolation delay', () => {
    start(); fixture.frame(0);
    const finished = nextSnapshot(3, 1);
    finished.state.phase = 'finished'; finished.state.winner = 'left'; finished.state.players.left.score = 6;
    fixture.now = 50; fixture.socketEvents.dispatch('snapshot', finished);
    expect(session!.state.players.left.score).toBe(0);
    session!.complete();
    expect(onState.mock.calls[onState.mock.calls.length - 1][0]).toMatchObject({
      phase: 'finished', winner: 'left', players: { left: { score: 6 } },
    });
    expect(fixture.callbacks.size).toBe(0);
    expect(fixture.listenerCount()).toBe(0);
  });

  it('blocks old-generation input after reconnect until a new session supplies full ready', () => {
    start(); fixture.key('ArrowUp'); fixture.frame(0);
    fixture.socket.connected = false; fixture.socketEvents.dispatch('disconnect'); fixture.frame(100);
    fixture.socket.connected = true; fixture.socketEvents.dispatch('connect');
    fixture.key('ArrowUp'); fixture.frame(200);
    expect(fixture.packets()).toHaveLength(1);
    const lateFrame = [...fixture.callbacks.values()][0];
    session!.dispose(); start(canonicalReady(false, 'left', 2));
    fixture.socket.emit.mockClear(); lateFrame(216); fixture.frame(232);
    expect(fixture.packets()).toHaveLength(1);
    expect(fixture.packets()[0]).toMatchObject({ generation: 2, up: false, down: false, seq: 1 });
  });

  it('measures input-to-ack round trip using the same injected local clock', () => {
    start(); fixture.frame(0);
    const packet = nextSnapshot(3, 1); packet.ack.left = 1;
    fixture.now = 80; fixture.socketEvents.dispatch('snapshot', packet);
    expect(session!.measurement.ackRoundTripMs).toBe(80);
  });

  it('measures a matching latency probe with one local clock and rejects unknown nonce values', () => {
    start(); fixture.frame(0);
    const [, probe, acknowledge] = fixture.socket.emit.mock.calls.find(([event]) => event === 'latencyProbe')!;
    fixture.now = 80;
    acknowledge(null); acknowledge({ nonce: probe.nonce + 1 }); acknowledge({ nonce: String(probe.nonce) });
    expect(session!.measurement.transportRoundTripMs).toBeNull();
    acknowledge({ nonce: probe.nonce });
    expect(session!.measurement.transportRoundTripMs).toBe(80);
  });

  it('does not accept a superseded probe callback as the current round trip', () => {
    start(); fixture.frame(0); fixture.frame(1100);
    const probes = fixture.socket.emit.mock.calls.filter(([event]) => event === 'latencyProbe');
    expect(probes).toHaveLength(2);
    fixture.now = 1200; probes[0][2]({ nonce: probes[0][1].nonce });
    expect(session!.measurement.transportRoundTripMs).toBeNull();
    probes[1][2]({ nonce: probes[1][1].nonce });
    expect(session!.measurement.transportRoundTripMs).toBe(100);
  });

  it('does not change metrics from a latency probe callback after disposal', () => {
    start(); fixture.frame(0);
    const [, probe, acknowledge] = fixture.socket.emit.mock.calls.find(([event]) => event === 'latencyProbe')!;
    session!.dispose();
    const before = session!.measurement;
    fixture.now = 80; acknowledge({ nonce: probe.nonce });
    expect(session!.measurement).toEqual(before);
    expect(fixture.callbacks.size).toBe(0);
  });
});

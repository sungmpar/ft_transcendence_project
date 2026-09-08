import { OnlineFeedback, OnlineSession } from '../../../frontend/src/arcade/online-session';
import { canonicalReady, nextSnapshot, OnlineBrowserFixture } from '../../test/online-browser-unit-fixture';
import { isMatchInput, ReadyMessage } from '../../../shared/protocol';
import { SessionRecovery } from '../../../frontend/src/arcade/session-recovery';
import { io as socketClient } from '../../../frontend/node_modules/socket.io-client';

describe('actual online session class with owned fake DOM and transport', () => {
  let fixture: OnlineBrowserFixture;
  let session: OnlineSession | undefined;
  let onState: jest.Mock;
  let onStatus: jest.Mock;
  function start(ready: ReadyMessage = canonicalReady(), feedback?: OnlineFeedback) {
    session = new OnlineSession({ canvas: fixture.canvas, socket: fixture.socket, ready, onState, onStatus, feedback });
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

  it('captures only the selected online three-key preset while preserving neutral input on layout changes', () => {
    start();
    expect(fixture.key('KeyW').defaultPrevented).toBe(false);
    fixture.key('ArrowUp'); fixture.frame(0);
    expect(fixture.packets()[0].up).toBe(true);
    session!.useKeyLayout('wasd');
    expect(fixture.packets().slice(-1)[0]).toMatchObject({ up: false, down: false });
    expect(fixture.key('ArrowDown').defaultPrevented).toBe(false);
    fixture.key('KeyS'); fixture.key('KeyD'); fixture.frame(20);
    expect(fixture.packets().slice(-1)[0]).toMatchObject({ up: false, down: true, actionId: 1 });
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

  it.each(['disconnect', 'waiting'])('clears an actual presented hit flash at %s without inventing another event', (boundary) => {
    start();
    const colors: string[] = [];
    (fixture.context.fillRect as jest.Mock).mockImplementation(() => { colors.push(fixture.context.fillStyle as string); });
    const packet = nextSnapshot(3, 1);
    packet.state.phase = 'rally'; packet.state.rallyId = 1;
    packet.eventCursor = 1; packet.events = [{ id: 1, event: { type: 'paddle', tick: 3, side: 'left' } }];
    fixture.now = 50; fixture.socketEvents.dispatch('snapshot', packet); fixture.frame(150);
    expect(colors).toContain('#ffffff');
    const presented = session!.measurement.effectsPresented;
    colors.length = 0;
    if (boundary === 'disconnect') { fixture.socket.connected = false; fixture.socketEvents.dispatch('disconnect'); }
    else fixture.socketEvents.dispatch('sessionStatus', { roomId: packet.matchId, status: 'waiting' });
    fixture.frame(200);
    expect(colors).not.toContain('#ffffff');
    expect(session!.measurement.effectsPresented).toBe(presented);
  });

  it('adopts higher clock epochs without recreating input/RAF ownership and rejects past epochs or another instance', () => {
    start(); fixture.frame(0);
    const raf = [...fixture.callbacks.keys()];
    const current = nextSnapshot(8, 2); current.clockEpoch = 1;
    fixture.now = 500; fixture.socketEvents.dispatch('snapshot', current);
    fixture.socketEvents.dispatch('snapshot', nextSnapshot(9, 3)); // Prior epoch, despite a higher sequence.
    fixture.socketEvents.dispatch('snapshot', { ...nextSnapshot(10, 4), instanceId: 'different-server', clockEpoch: 2 });
    expect(session!.latest.tick).toBe(8);
    expect(session!.measurement.snapshots).toBe(1);
    expect([...fixture.callbacks.keys()]).toEqual(raf);
    fixture.frame(500);
    expect(session!.state.tick).toBe(8);
    expect(fixture.packets().every(packet => packet.generation === 1)).toBe(true);
  });

  it('uses a new full-ready session as the explicit boundary for a different server instance', () => {
    start(); fixture.now = 1000;
    fixture.socketEvents.dispatch('snapshot', nextSnapshot(60, 20));
    const oldReceiver = [...fixture.socketEvents.listeners.get('snapshot')!][0];
    session!.dispose();
    const restarted = canonicalReady(); restarted.snapshot.instanceId = 'restarted-server';
    start(restarted);
    oldReceiver(nextSnapshot(63, 21));
    fixture.socketEvents.dispatch('snapshot', nextSnapshot(63, 21));
    fixture.now = 1050; fixture.socketEvents.dispatch('snapshot', nextSnapshot(3, 1, restarted));
    expect(session!.latest.tick).toBe(3);
    expect(session!.measurement.snapshots).toBe(1);
    expect(fixture.callbacks.size).toBe(1);
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

  it('sends server-confirmed feedback to the audio adapter only at presentation time, with no ready replay', () => {
    const audio = { play: jest.fn(), silence: jest.fn(), measurement: { tones: 0, activeVoices: 0 } };
    const ready = canonicalReady();
    ready.snapshot.eventCursor = 1;
    ready.snapshot.events = [{ id: 1, event: { type: 'paddle', tick: 0, side: 'left' } }];
    start(ready, { audio, reducedMotion: false });
    const packet = nextSnapshot(3, 1, ready);
    packet.state.phase = 'rally'; packet.state.rallyId = 1;
    packet.eventCursor = 2; packet.events.push({ id: 2, event: { type: 'paddle', tick: 3, side: 'right' } });
    fixture.now = 50; fixture.socketEvents.dispatch('snapshot', packet); fixture.frame(100);
    expect(audio.play).not.toHaveBeenCalled();
    fixture.frame(150);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledWith([{ type: 'paddle', tick: 3, side: 'right' }]);
    const repeat = { ...packet, seq: 2 }; fixture.now = 160; fixture.socketEvents.dispatch('snapshot', repeat);
    fixture.frame(200); expect(audio.play).toHaveBeenCalledTimes(1);
    session!.dispose(); expect(audio.silence).toHaveBeenCalledTimes(2);
  });

  it('immediate complete exposes final score and only terminal-tick feedback, then stops RAF/input/listeners', () => {
    const audio = { play: jest.fn(), silence: jest.fn(), measurement: { tones: 0, activeVoices: 0 } };
    start(canonicalReady(), { audio, reducedMotion: false });
    const finished = nextSnapshot(3, 1);
    finished.state.phase = 'finished'; finished.state.winner = 'left'; finished.state.players.left.score = 6;
    finished.eventCursor = 3; finished.events = [
      { id: 1, event: { type: 'paddle', tick: 1, side: 'left' } },
      { id: 2, event: { type: 'point', tick: 3, side: 'left', score: { left: 6, right: 0 } } },
      { id: 3, event: { type: 'finished', tick: 3, winner: 'left' } },
    ];
    fixture.now = 50; fixture.socketEvents.dispatch('snapshot', finished);
    expect(audio.play).not.toHaveBeenCalled();
    session!.complete(); session!.complete();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.play.mock.calls[0][0].map((event: { type: string }) => event.type)).toEqual(['point', 'finished']);
    expect(onState.mock.calls.slice(-1)[0][0].players.left.score).toBe(6);
    expect(session!.measurement.effectsSkipped).toBe(1);
    expect(fixture.callbacks.size).toBe(0); expect(fixture.listenerCount()).toBe(0);
  });

  it('never creates point audio on forfeit completion when no core finished event exists', () => {
    const audio = { play: jest.fn(), silence: jest.fn(), measurement: { tones: 0, activeVoices: 0 } };
    start(canonicalReady(), { audio, reducedMotion: false });
    const last = nextSnapshot(3, 1); last.state.phase = 'rally';
    last.eventCursor = 1; last.events = [{ id: 1, event: { type: 'paddle', tick: 3, side: 'left' } }];
    fixture.now = 50; fixture.socketEvents.dispatch('snapshot', last); session!.complete();
    expect(audio.play).not.toHaveBeenCalled();
    expect(session!.measurement.effectsPresented).toBe(0);
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

describe('identified recovery request lifecycle', () => {
  let fixture: OnlineBrowserFixture;
  let recovery: SessionRecovery;
  let receive: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    fixture = new OnlineBrowserFixture(); receive = jest.fn();
    recovery = new SessionRecovery(fixture.socket, 'player', receive);
  });
  afterEach(() => { recovery?.dispose(); jest.useRealTimers(); });
  const response = (requestId: string, matchId = '41') => ({ v: 1, requestId, matchId, status: 'unavailable' });

  it('requests last match identity and times out once without declaring an outcome', () => {
    recovery.resume('41');
    expect(fixture.socket.emit.mock.calls[0].slice(0, 2)).toEqual(['sessionSync', { v: 1, requestId: 'sync-1', matchId: '41', role: 'player' }]);
    jest.advanceTimersByTime(4999); expect(receive).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1); expect(receive).toHaveBeenCalledWith(null);
    jest.advanceTimersByTime(30000); expect(receive).toHaveBeenCalledTimes(1);
    fixture.socket.emit.mock.calls[0][2](response('sync-1'));
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed, old-request and wrong-match replies and consumes the current reply once', () => {
    recovery.resume('41'); const first = fixture.socket.emit.mock.calls[0][2];
    recovery.resume('42'); const second = fixture.socket.emit.mock.calls[1][2];
    first(response('sync-1')); second(null); second(response('sync-1', '42')); second(response('sync-2', '41'));
    expect(receive).not.toHaveBeenCalled();
    second(response('sync-2', '42')); second(response('sync-2', '42'));
    expect(receive).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('handles automatic ready before recovery acknowledgement without duplicate session construction', () => {
    const initial = canonicalReady();
    initial.roomId = initial.snapshot.matchId = '41';
    expect(recovery.acceptReady(initial)).toBe(true);
    recovery.resume('41'); const acknowledge = fixture.socket.emit.mock.calls[0][2];
    const resumed = { ...initial, generation: 2 };
    expect(recovery.acceptReady(resumed)).toBe(true);
    acknowledge({ v: 1, requestId: 'sync-1', matchId: '41', status: 'active', ready: resumed });
    expect(receive).not.toHaveBeenCalled();
    expect(recovery.acceptReady(resumed)).toBe(false);
    expect(recovery.acceptReady(initial)).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not reinterpret a higher input generation as permission to replace an active server instance', () => {
    const first = canonicalReady(); first.roomId = first.snapshot.matchId = '41';
    expect(recovery.acceptReady(first)).toBe(true);
    const unsolicited = { ...first, generation: 99, snapshot: { ...first.snapshot, instanceId: 'different-server' } };
    expect(recovery.acceptReady(unsolicited)).toBe(false);
    recovery.resume('41');
    expect(recovery.acceptReady(unsolicited)).toBe(false);
    expect(recovery.acceptReady({ ...first, generation: 2 })).toBe(true);
    recovery.clear();
    const newMatch = canonicalReady(); newMatch.roomId = newMatch.snapshot.matchId = '42';
    newMatch.snapshot.instanceId = 'different-server';
    expect(recovery.acceptReady(newMatch)).toBe(true);
  });

  it('keeps the owner timeout when a matching recovery ACK contains an inadmissible server instance', () => {
    const first = canonicalReady(); first.roomId = first.snapshot.matchId = '41';
    expect(recovery.acceptReady(first)).toBe(true);
    recovery.resume('41');
    const acknowledge = fixture.socket.emit.mock.calls[0][2];
    acknowledge({ v: 1, requestId: 'sync-1', matchId: '41', status: 'active', ready: {
      ...first, generation: 99, snapshot: { ...first.snapshot, instanceId: 'different-server' },
    } });
    expect(receive).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith(null);
    expect(recovery.acceptReady({ ...first, generation: 2 })).toBe(true);
  });

  it('ignores an old ready or end after a different match and blocks duplicate ends', () => {
    const first = canonicalReady(); first.roomId = first.snapshot.matchId = '41';
    recovery.acceptReady(first); expect(recovery.finish('41')).toBe(true);
    expect(recovery.finish('41')).toBe(false); recovery.clear();
    const next = canonicalReady(); next.roomId = next.snapshot.matchId = '42';
    expect(recovery.acceptReady(next)).toBe(true);
    expect(recovery.acceptReady({ ...first, generation: 99 })).toBe(false);
    expect(recovery.finish('41')).toBe(false);
  });

  it('clears pending work and rejects callbacks after disposal', () => {
    recovery.resume('41'); const acknowledge = fixture.socket.emit.mock.calls[0][2];
    recovery.dispose(); recovery.dispose();
    acknowledge(response('sync-1')); jest.advanceTimersByTime(10000);
    expect(receive).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  });

  it('resubscribes an observer without accepting player control or an old target response', () => {
    recovery.dispose(); recovery = new SessionRecovery(fixture.socket, 'spectator', receive);
    const first = canonicalReady(false, 'spectator'); first.roomId = first.snapshot.matchId = '41';
    recovery.expect('41'); expect(recovery.acceptReady(first)).toBe(true);
    recovery.resume('41'); const oldReply = fixture.socket.emit.mock.calls[0][2];
    recovery.expect('42');
    oldReply({ v: 1, requestId: 'sync-1', matchId: '41', status: 'active', ready: { ...first, generation: 2 } });
    expect(receive).not.toHaveBeenCalled();
    expect(recovery.acceptReady({ ...first, generation: 2 })).toBe(false);
    const next = canonicalReady(false, 'spectator'); next.roomId = next.snapshot.matchId = '42';
    expect(recovery.acceptReady({ ...next, side: 'left' })).toBe(false);
    expect(recovery.acceptReady(next)).toBe(true);
    recovery.clear(); recovery.expect('42');
    expect(recovery.acceptReady(next)).toBe(true); // Explicitly rewatching a still-live room is allowed.
  });

  it('expires the installed Socket.IO ACK registry and send buffer after unacknowledged recovery', () => {
    const client = socketClient('http://127.0.0.1:9/game', { autoConnect: false, forceNew: true });
    // No connection is opened: this adapter deliberately tests the real client's
    // ACK registry and offline send buffer under a controlled owner clock.
    recovery.dispose(); recovery = new SessionRecovery({ connected: true, timeout: milliseconds => client.timeout(milliseconds) }, 'player', receive);
    for (let index = 0; index < 8; index++) recovery.resume('41');
    const internals = client as any;
    expect(Object.keys(internals.acks).length).toBe(8);
    expect(internals.sendBuffer.length).toBe(8);
    recovery.dispose(); jest.advanceTimersByTime(5001);
    expect(Object.keys(internals.acks)).toEqual([]);
    expect(internals.sendBuffer).toEqual([]);
    expect(receive).not.toHaveBeenCalled();
    client.disconnect();
  });
});

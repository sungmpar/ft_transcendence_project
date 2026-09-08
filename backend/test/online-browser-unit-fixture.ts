import { createGame } from '../../shared/game-core';
import { captureSnapshot, MatchInput, ReadyMessage, Snapshot } from '../../shared/protocol';

/** Synthetic DOM/transport only; no authenticated service or pixels are tested. */
export class EventHub {
  readonly listeners = new Map<string, Set<(event: any) => void>>();
  addEventListener(type: string, listener: (event: any) => void): void {
    const set = this.listeners.get(type) || new Set();
    set.add(listener); this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: any) => void): void { this.listeners.get(type)?.delete(listener); }
  dispatch(type: string, event: any = {}): void { [...(this.listeners.get(type) || [])].forEach((listener) => listener(event)); }
  count(type?: string): number {
    return type ? this.listeners.get(type)?.size || 0 : [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

export function canonicalReady(roomMode = false, side: ReadyMessage['side'] = 'left', generation = 1): ReadyMessage {
  return {
    v: 1, roomId: 'fixture-match', leftName: 'left fixture', rightName: 'right fixture',
    roomMode, side, generation,
    snapshot: captureSnapshot(createGame({ mode: roomMode ? 'power' : 'classic' }), 'fixture-match', 0, { left: 0, right: 0 },
      { instanceId: 'browser-fixture', clockEpoch: 0 }),
  };
}

export function nextSnapshot(tick: number, seq: number, initial = canonicalReady()): Snapshot {
  const snapshot = captureSnapshot(initial.snapshot.state, initial.roomId, seq, { left: 0, right: 0 }, initial.snapshot, initial.snapshot);
  snapshot.tick = tick; snapshot.state.tick = tick;
  return snapshot;
}

export class OnlineBrowserFixture {
  now = 0;
  private nextFrame = 0;
  private descriptors = new Map<string, PropertyDescriptor | undefined>();
  private performanceObject: Performance | undefined;
  private performanceNowDescriptor: PropertyDescriptor | undefined;
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly windowEvents = new EventHub();
  readonly documentEvents = new EventHub();
  readonly canvasEvents = new EventHub();
  readonly motionEvents = new EventHub();
  readonly socketEvents = new EventHub();
  readonly document = Object.assign(this.documentEvents, { activeElement: null as unknown, hidden: false });
  readonly socket = {
    connected: true,
    on: (type: string, listener: (event: any) => void) => this.socketEvents.addEventListener(type, listener),
    off: (type: string, listener: (event: any) => void) => this.socketEvents.removeEventListener(type, listener),
    emit: jest.fn(),
    timeout: (_milliseconds: number) => ({
      emit: (type: string, value: unknown, ack: (error: Error | null, value?: unknown) => void) =>
        this.socket.emit(type, value, (response: unknown) => ack(null, response)),
    }),
  };
  readonly context = {
    canvas: null as unknown, setTransform: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
    setLineDash: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
    stroke: jest.fn(), arc: jest.fn(), fill: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
  readonly canvas = Object.assign(this.canvasEvents, {
    width: 1200, height: 800, tabIndex: 0,
    getContext: () => this.context,
    getBoundingClientRect: () => ({ width: 1200, height: 800 }),
    focus: () => { this.document.activeElement = this.canvas; },
  }) as unknown as HTMLCanvasElement;

  install(): void {
    this.performanceObject = performance;
    this.performanceNowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    Object.defineProperty(performance, 'now', { configurable: true, value: () => this.now });
    (this.context as unknown as { canvas: HTMLCanvasElement }).canvas = this.canvas;
    const request = (callback: FrameRequestCallback): number => {
      const id = ++this.nextFrame; this.callbacks.set(id, callback); return id;
    };
    const cancel = (id: number): void => { this.callbacks.delete(id); };
    const values = {
      window: Object.assign(this.windowEvents, {
        devicePixelRatio: 1, location: { search: '' }, requestAnimationFrame: request, cancelAnimationFrame: cancel,
        matchMedia: () => Object.assign(this.motionEvents, { matches: false }),
      }),
      document: this.document,
      requestAnimationFrame: request,
      cancelAnimationFrame: cancel,
    };
    for (const [key, value] of Object.entries(values)) {
      this.descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
  }

  restore(): void {
    if (this.performanceObject) {
      if (this.performanceNowDescriptor) Object.defineProperty(this.performanceObject, 'now', this.performanceNowDescriptor);
      else Reflect.deleteProperty(this.performanceObject, 'now');
    }
    for (const [key, descriptor] of this.descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    this.descriptors.clear();
  }

  frame(time: number): void {
    this.now = time;
    const callbacks = [...this.callbacks.entries()];
    for (const [id, callback] of callbacks) { this.callbacks.delete(id); callback(time); }
  }

  key(code: string, options: { up?: boolean; repeat?: boolean; target?: unknown } = {}): any {
    const event = { code, repeat: options.repeat || false, target: options.target || this.canvas,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    this.windowEvents.dispatch(options.up ? 'keyup' : 'keydown', event);
    return event;
  }

  packets(): MatchInput[] { return this.socket.emit.mock.calls.filter(([event]) => event === 'keyboardEvent').map(([, packet]) => packet); }
  listenerCount(): number {
    return this.windowEvents.count() + this.documentEvents.count() + this.canvasEvents.count()
      + this.motionEvents.count() + this.socketEvents.count();
  }
}

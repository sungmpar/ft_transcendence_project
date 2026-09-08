import { cloneGameState, GameState, PlayerInput } from '../../../shared/game-core';
import { captureSnapshot, isSnapshot, MatchInput, ReadyMessage, Snapshot } from '../../../shared/protocol';
import { CourtRenderer } from './court-renderer';
import { copyBindings, DEFAULT_BINDINGS, KeyboardController } from './keyboard-controller';
import { SnapshotBuffer } from './snapshot-buffer';

export type OnlineKeyLayout = 'arrows' | 'wasd';
export interface GameTransport {
  connected: boolean;
  on(event: string, listener: (value: unknown) => void): unknown;
  off(event: string, listener: (value: unknown) => void): unknown;
  emit(event: string, value: unknown, ack?: (value: unknown) => void): unknown;
}
export interface OnlineMetrics {
  fps: number;
  snapshots: number;
  inputMessages: number;
  ackRoundTripMs: number | null;
  transportRoundTripMs: number | null;
  bufferDepth: number;
  displayDelayMs: number;
  underflows: number;
}
export interface OnlineOptions {
  canvas: HTMLCanvasElement;
  socket: GameTransport;
  ready: ReadyMessage;
  background?: string;
  keyLayout?: OnlineKeyLayout;
  displayMode?: 'interpolate' | 'latest';
  onState(state: GameState, metrics: OnlineMetrics): void;
  onStatus(message: string): void;
}

/** Rendering never steps the core. One owner supplies RAF, input and socket teardown. */
export class OnlineSession {
  private buffer: SnapshotBuffer;
  private renderer: CourtRenderer;
  private keyboard: KeyboardController;
  private frameId: number | null = null;
  private disposed = false;
  private awaitingResync = false;
  private generation = 0;
  private sequence = 0;
  private actionId = 0;
  private lastSent = -Infinity;
  private lastProbe = -Infinity;
  private probeSequence = 0;
  private previousInput: PlayerInput = { up: false, down: false, action: false };
  private pending = new Map<number, number>();
  private layout: OnlineKeyLayout;
  private snapshot: GameState;
  private networkSnapshot: Snapshot;
  private lastFrameTime: number | null = null;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private metrics: OnlineMetrics = { fps: 0, snapshots: 0, inputMessages: 0,
    ackRoundTripMs: null, transportRoundTripMs: null, bufferDepth: 0, displayDelayMs: 0, underflows: 0 };

  constructor(private options: OnlineOptions) {
    this.layout = options.keyLayout || 'arrows';
    this.buffer = new SnapshotBuffer(options.displayMode || 'interpolate');
    const initial = options.ready.snapshot;
    this.networkSnapshot = captureSnapshot(initial.state, initial.matchId, initial.seq, initial.ack);
    this.snapshot = cloneGameState(options.ready.snapshot.state);
    this.buffer.receive(options.ready.snapshot, performance.now());
    this.renderer = new CourtRenderer(options.canvas, this.motion.matches, options.background);
    const bindings = copyBindings(DEFAULT_BINDINGS);
    bindings.right.action = 'Space';
    this.keyboard = new KeyboardController({
      events: window, visibility: document, surface: options.canvas,
      isFocused: () => document.activeElement === options.canvas,
      isHidden: () => document.hidden,
      onPause: () => this.sendNeutral(),
    }, bindings);
    this.keyboard.attach();
    this.keyboard.setEnabled(options.ready.side !== 'spectator');
    options.canvas.tabIndex = 0;
    options.socket.on('snapshot', this.receive);
    options.socket.on('disconnect', this.disconnected);
    options.socket.on('connect', this.connected);
    options.socket.on('resultStatus', this.resultStatus);
    options.socket.on('sessionStatus', this.sessionStatus);
    window.addEventListener('resize', this.resize);
    this.motion.addEventListener('change', this.motionChanged);
    if (options.ready.side !== 'spectator') options.canvas.focus();
    this.options.onStatus(options.ready.side === 'spectator' ? '관전 중 · 서버 경기 화면' : '연결됨 · 경기장을 클릭해 조작하세요');
    const generation = ++this.generation;
    this.frameId = requestAnimationFrame((time) => this.frame(time, generation));
  }

  get state(): GameState { return cloneGameState(this.snapshot); }
  get latest(): GameState { return cloneGameState(this.networkSnapshot.state); }
  get measurement(): OnlineMetrics { return { ...this.metrics }; }

  useKeyLayout(layout: OnlineKeyLayout): void {
    this.sendNeutral();
    this.keyboard.clear();
    this.layout = layout;
  }

  complete(): void {
    if (this.disposed) return;
    this.snapshot = cloneGameState(this.networkSnapshot.state);
    this.renderer.draw(this.snapshot);
    this.options.onState(this.state, this.measurement);
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.sendNeutral();
    this.disposed = true;
    this.generation++;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.keyboard.dispose();
    this.options.socket.off('snapshot', this.receive);
    this.options.socket.off('disconnect', this.disconnected);
    this.options.socket.off('connect', this.connected);
    this.options.socket.off('resultStatus', this.resultStatus);
    this.options.socket.off('sessionStatus', this.sessionStatus);
    window.removeEventListener('resize', this.resize);
    this.motion.removeEventListener('change', this.motionChanged);
    this.pending.clear();
  }

  private sendNeutral(): void {
    this.keyboard?.clear();
    this.send({ up: false, down: false, action: false }, performance.now(), true);
  }
  private send(input: PlayerInput, now: number, force = false): void {
    if (this.disposed || this.awaitingResync || this.options.ready.side === 'spectator' || !this.options.socket.connected) return;
    if (!force && !input.action && input.up === this.previousInput.up &&
      input.down === this.previousInput.down && now - this.lastSent < 100) return;
    if (input.action) this.actionId++;
    const packet: MatchInput = { v: 1, matchId: this.options.ready.roomId,
      generation: this.options.ready.generation, seq: ++this.sequence,
      up: input.up, down: input.down, actionId: this.actionId };
    this.options.socket.emit('keyboardEvent', packet);
    this.pending.set(packet.seq, now);
    while (this.pending.size > 128) this.pending.delete(this.pending.keys().next().value as number);
    this.previousInput = { ...input, action: false };
    this.lastSent = now;
    this.metrics.inputMessages++;
  }

  private receive = (value: unknown): void => {
    if (this.disposed || !isSnapshot(value) || value.matchId !== this.options.ready.roomId) return;
    const now = performance.now();
    if (!this.buffer.receive(value, now)) return;
    this.networkSnapshot = captureSnapshot(value.state, value.matchId, value.seq, value.ack);
    this.metrics.snapshots++;
    const side = this.options.ready.side;
    if (side !== 'spectator') {
      const ack = value.ack[side];
      const sent = this.pending.get(ack);
      if (sent !== undefined) this.metrics.ackRoundTripMs = now - sent;
      for (const seq of this.pending.keys()) if (seq <= ack) this.pending.delete(seq);
    }
    if (value.state.phase === 'finished') {
      this.keyboard.setEnabled(false);
      this.options.onStatus('경기 종료 · 결과 저장 확인 중');
    }
  };
  private disconnected = (): void => {
    if (this.disposed) return;
    this.keyboard.clear();
    this.pending.clear();
    this.options.onStatus('연결이 끊겼습니다 · 재연결 상태를 확인하고 있습니다');
  };
  private connected = (): void => {
    if (this.disposed) return;
    // A reconnect must receive a new generation and full ready state before input.
    this.keyboard.setEnabled(false);
    this.awaitingResync = true;
    this.options.onStatus('연결 복구 · 서버의 전체 경기 상태를 기다립니다');
  };
  private resultStatus = (value: unknown): void => {
    if (this.disposed || (value as { roomId?: unknown } | null)?.roomId !== this.options.ready.roomId) return;
    const status = (value as { status?: unknown } | null)?.status;
    if (status === 'failed') this.options.onStatus('경기는 종료됐지만 결과 저장 확인에 실패했습니다 · 전적 반영 여부를 확인할 수 없습니다');
    else if (status === 'retrying') this.options.onStatus('경기 종료 · 결과 저장을 재시도하고 있습니다');
    else if (status === 'saved') this.options.onStatus('경기 결과가 저장되었습니다');
    else if (status === 'saving') this.options.onStatus('경기 종료 · 결과 저장 중');
  };
  private sessionStatus = (value: unknown): void => {
    if (this.disposed || (value as { roomId?: unknown } | null)?.roomId !== this.options.ready.roomId) return;
    const status = (value as { status?: unknown } | null)?.status;
    if (status === 'waiting') {
      this.sendNeutral();
      const grace = (value as { graceMs?: unknown }).graceMs;
      const duration = typeof grace === 'number' && Number.isFinite(grace) && grace > 0
        ? ` · 최대 ${Math.ceil(grace / 1000)}초` : '';
      this.options.onStatus('상대 연결 대기 · 경기가 일시정지되었습니다' + duration);
    }
    if (status === 'active') this.options.onStatus('두 플레이어 연결됨');
    if (status === 'aborted') {
      this.options.onStatus('경기 오류로 중단되었습니다 · 결과는 저장되지 않았습니다');
      this.dispose();
    }
  };
  private resize = (): void => { if (!this.disposed) this.renderer.draw(this.snapshot); };
  private motionChanged = (): void => {
    if (this.disposed) return;
    this.renderer.setReducedMotion(this.motion.matches); this.resize();
  };

  private frame(time: number, generation: number): void {
    if (this.disposed || generation !== this.generation) return;
    this.frameId = null;
    if (this.options.socket.connected && time - this.lastProbe >= 1100) {
      this.lastProbe = time;
      const nonce = ++this.probeSequence;
      const sent = performance.now();
      this.options.socket.emit('latencyProbe', { nonce }, (value: unknown) => {
        if (this.disposed || generation !== this.generation || nonce !== this.probeSequence) return;
        if ((value as { nonce?: unknown } | null)?.nonce === nonce) {
          this.metrics.transportRoundTripMs = Math.max(0, performance.now() - sent);
        }
      });
    }
    const elapsed = this.lastFrameTime === null ? 0 : Math.max(0, time - this.lastFrameTime);
    this.lastFrameTime = time;
    this.fpsElapsed += elapsed; this.fpsFrames++;
    if (this.fpsElapsed >= 500) {
      this.metrics.fps = this.fpsFrames * 1000 / this.fpsElapsed;
      this.fpsFrames = 0; this.fpsElapsed = 0;
    }
    const input = this.keyboard.read(this.layout === 'wasd' ? 'left' : 'right');
    this.send(input, time);
    const displayed = this.buffer.display(time);
    if (displayed) {
      this.snapshot = displayed;
      const metrics = this.buffer.metrics;
      this.metrics.bufferDepth = metrics.depth;
      this.metrics.displayDelayMs = metrics.displayDelayMs;
      this.metrics.underflows = metrics.underflowCount;
      this.renderer.draw(displayed);
      this.options.onState(cloneGameState(displayed), this.measurement);
    }
    if (!this.disposed && generation === this.generation) {
      this.frameId = requestAnimationFrame((timestamp) => this.frame(timestamp, generation));
    }
  }
}

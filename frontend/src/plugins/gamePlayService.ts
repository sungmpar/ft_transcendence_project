import store from '@/store';
import { isReadyMessage } from '../../../shared/protocol';
import { OnlineFeedback, OnlineKeyLayout, OnlineSession } from '../arcade/online-session';

/** Compatibility entry point for the three existing online routes. */
export class GameplayService {
  private static session: OnlineSession | null = null;
  private static layout: OnlineKeyLayout = 'arrows';
  private static debugApi: object | null = null;
  private static activeRoom: string | null = null;
  private static activeGeneration = 0;
  private static canvas: HTMLCanvasElement | null = null;
  private static feedback = new WeakMap<HTMLCanvasElement, OnlineFeedback>();

  static bindFeedback(canvas: HTMLCanvasElement, feedback: OnlineFeedback): () => void {
    this.feedback.set(canvas, feedback);
    return () => {
      if (this.feedback.get(canvas) !== feedback) return;
      this.feedback.delete(canvas);
      feedback.audio.silence();
    };
  }
  static useReducedMotion(canvas: HTMLCanvasElement, value: boolean): void {
    const feedback = this.feedback.get(canvas);
    if (feedback) feedback.reducedMotion = value;
    if (this.canvas === canvas) this.session?.useReducedMotion(value);
  }

  static start(ctx: CanvasRenderingContext2D, backgroundImage: string, ready?: unknown,
    onStatus: (message: string) => void = () => undefined): boolean {
    if (!isReadyMessage(ready) || !store.getters.gameSocket) {
      onStatus('서버 경기 정보를 확인하지 못했습니다');
      return false;
    }
    if (this.session && this.activeRoom === ready.roomId &&
      this.activeGeneration === ready.generation && this.canvas === ctx.canvas) return true;
    this.dispose();
    const session = new OnlineSession({
      canvas: ctx.canvas, background: backgroundImage, ready,
      socket: store.getters.gameSocket, keyLayout: this.layout,
      feedback: this.feedback.get(ctx.canvas),
      displayMode: new URLSearchParams(window.location.search).get('display') === 'latest' ? 'latest' : 'interpolate',
      onStatus,
      onState: (state, metrics) => {
        store.commit('setOnlineState', state);
        store.commit('setOnlineMetrics', metrics);
        store.commit('setGameData', {
          ball: { x: state.ball.x, y: state.ball.y },
          leftBar: { x: state.players.left.x, y: state.players.left.y, power: state.players.left.powered },
          rightBar: { x: state.players.right.x, y: state.players.right.y, power: state.players.right.powered },
          score: { left: state.players.left.score, right: state.players.right.score },
        });
      },
    });
    this.session = session;
    this.activeRoom = ready.roomId;
    this.activeGeneration = ready.generation;
    this.canvas = ctx.canvas;
    if ((process.env.NODE_ENV !== 'production' || process.env.VUE_APP_ARCADE_DEBUG === 'true') &&
      new URLSearchParams(window.location.search).get('debug') === '1') {
      this.debugApi = Object.freeze({ snapshot: () => session.state, latest: () => session.latest,
        metrics: () => session.measurement,
        identity: () => ({ matchId: ready.roomId, generation: ready.generation, side: ready.side,
          instanceId: ready.snapshot.instanceId, clockEpoch: session.measurement.clockEpoch }) });
      Object.defineProperty(window, '__ONLINE_DEBUG__', { configurable: true, value: this.debugApi });
    }
    return true;
  }

  static useKeyLayout(layout: OnlineKeyLayout): void {
    this.layout = layout;
    this.session?.useKeyLayout(layout);
  }
  static stop(_winner?: unknown): void { void _winner; this.session?.complete(); this.dispose(); }
  static stopSpectate(winner?: unknown): void { this.stop(winner); }
  static disposeFor(canvas?: HTMLCanvasElement): void {
    if (canvas && this.canvas === canvas) this.dispose();
  }
  static dispose(): void {
    this.session?.dispose();
    this.session = null;
    this.activeRoom = null;
    this.activeGeneration = 0;
    this.canvas = null;
    if (this.debugApi && Object.getOwnPropertyDescriptor(window, '__ONLINE_DEBUG__')?.value === this.debugApi) {
      Reflect.deleteProperty(window, '__ONLINE_DEBUG__');
    }
    this.debugApi = null;
  }
}

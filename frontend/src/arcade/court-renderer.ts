import { GameEvent, GameState, Side } from '../../../shared/game-core';

export class CourtRenderer {
  private context: CanvasRenderingContext2D;
  private trail: { x: number; y: number }[] = [];
  private lastTick = -1;
  private lastRally = -1;
  private flashUntil = -1;
  private flashSide: Side | null = null;
  constructor(private canvas: HTMLCanvasElement, private reducedMotion = false, private palette = 'black') {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 Canvas 2D를 시작할 수 없습니다.');
    this.context = context;
  }
  setReducedMotion(value: boolean): void { this.reducedMotion = value; this.trail = []; }
  reset(): void { this.trail = []; this.lastTick = -1; this.lastRally = -1; this.flashUntil = -1; }
  events(events: GameEvent[]): void {
    events.forEach((event) => {
      if (event.type === 'paddle') { this.flashUntil = event.tick + 5; this.flashSide = event.side; }
      if (event.type === 'point' || event.type === 'serve') this.trail = [];
    });
  }
  draw(state: GameState, prediction: number | null = null): void {
    const bounds = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.context;
    ctx.setTransform(width / state.config.width, 0, 0, height / state.config.height, 0, 0);
    ctx.fillStyle = this.palette === 'winter' ? '#172c39' : this.palette === 'space' ? '#20172f' : '#101624';
    ctx.fillRect(0, 0, state.config.width, state.config.height);
    ctx.strokeStyle = '#263247';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 18]);
    ctx.beginPath();
    ctx.moveTo(600, 24); ctx.lineTo(600, 776); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#1d293c';
    ctx.beginPath(); ctx.arc(600, 400, 105, 0, Math.PI * 2); ctx.stroke();
    if (this.lastRally !== state.rallyId || state.phase !== 'rally') this.trail = [];
    if (!this.reducedMotion && this.lastTick !== state.tick && state.phase === 'rally') {
      this.trail.push({ x: state.ball.x, y: state.ball.y });
      if (this.trail.length > 7) this.trail.shift();
    }
    this.lastTick = state.tick;
    this.lastRally = state.rallyId;
    this.trail.forEach((position, index) => {
      ctx.fillStyle = `rgba(230, 237, 255, ${index / 55})`;
      ctx.beginPath(); ctx.arc(position.x, position.y, state.ball.radius * (index + 1) / 8, 0, Math.PI * 2); ctx.fill();
    });
    (['left', 'right'] as Side[]).forEach((side) => {
      const player = state.players[side];
      const color = side === 'left' ? '#92f0d1' : '#af9bff';
      ctx.fillStyle = !this.reducedMotion && this.flashUntil >= state.tick && this.flashSide === side ? '#ffffff' : color;
      ctx.fillRect(player.x, player.y, player.width, player.height);
      if (player.powered) {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.strokeRect(player.x - 5, player.y - 5, player.width + 10, player.height + 10);
      }
    });
    ctx.fillStyle = '#f4f6ff';
    ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2); ctx.fill();
    if (prediction !== null && Number.isFinite(prediction)) {
      ctx.strokeStyle = '#f4cb7b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1085, prediction); ctx.lineTo(1135, prediction); ctx.stroke();
    }
  }
}

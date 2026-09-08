import { GameEvent } from '../../../shared/game-core';

/** Synthesized tones only. Constructed/resumed from an explicit user gesture. */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private muted = true;
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) return;
    try {
      if (!this.context) this.context = new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch { this.muted = true; }
  }
  play(events: GameEvent[]): void {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const event = events.find((item) => ['finished', 'point', 'power', 'paddle'].includes(item.type));
    if (!event) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.frequency.value = event.type === 'paddle' ? 330 : event.type === 'power' ? 660 : 520;
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.11);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  dispose(): void {
    this.muted = true;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}

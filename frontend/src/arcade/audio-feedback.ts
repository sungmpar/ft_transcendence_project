import { GameEvent } from '../../../shared/game-core';

export type AudioStatus = 'muted' | 'gesture-required' | 'starting' | 'ready' | 'blocked' | 'unavailable';
type Voice = { oscillator: OscillatorNode; gain: GainNode };
const MAX_VOICES = 8;

/** One route owns the context and every short-lived node. No automatic resume. */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private muted = true;
  private disposed = false;
  private activation = 0;
  private activated = false;
  private voices = new Set<Voice>();
  private value: AudioStatus = 'muted';
  private tones = 0;
  constructor(private onStatus: (status: AudioStatus) => void = () => undefined) {}
  get status(): AudioStatus { return this.value; }
  get measurement(): { tones: number; activeVoices: number } { return { tones: this.tones, activeVoices: this.voices.size }; }
  private report(value: AudioStatus): void { this.value = value; this.onStatus(value); }

  restoreMuted(muted: boolean): void {
    if (this.disposed) return;
    this.muted = muted; this.activated = false; this.activation++; this.silence();
    this.report(muted ? 'muted' : 'gesture-required');
  }
  /** Called by native sound/play/court gestures; preference alone cannot start audio. */
  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.muted = muted;
    const activation = ++this.activation;
    if (muted) { this.activated = false; this.silence(); this.report('muted'); return; }
    const userActivation = typeof navigator === 'undefined' ? undefined :
      (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    if (userActivation && !userActivation.isActive) {
      this.activated = false; this.silence(); this.report('gesture-required'); return;
    }
    try {
      if (!this.context) this.context = new AudioContext();
      const context = this.context;
      this.activated = context.state === 'running';
      this.report(this.activated ? 'ready' : 'starting');
      void context.resume().then(() => {
        if (!this.disposed && activation === this.activation && context === this.context) {
          this.activated = context.state === 'running';
          this.report(this.activated ? 'ready' : 'blocked');
        }
      }, () => {
        if (!this.disposed && activation === this.activation) {
          this.activated = false; this.silence(); this.report('blocked');
        }
      });
    } catch { this.activated = false; this.report('unavailable'); }
  }

  play(events: GameEvent[]): void {
    if (this.disposed || this.muted || !this.activated || !this.context) return;
    if (this.context.state !== 'running') { this.report('blocked'); return; }
    // Simultaneous events share one tone: terminal > point > Power > paddle.
    const priority = ['paddle', 'power', 'point', 'finished'];
    const byTick = new Map<number, GameEvent>();
    for (const event of events) {
      if (!priority.includes(event.type)) continue;
      const previous = byTick.get(event.tick);
      if (!previous || priority.indexOf(event.type) > priority.indexOf(previous.type)) byTick.set(event.tick, event);
    }
    for (const event of byTick.values()) {
      if (this.voices.size >= MAX_VOICES) this.release(this.voices.values().next().value as Voice);
      try {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        const voice = { oscillator, gain }; this.voices.add(voice);
        const now = this.context.currentTime;
        oscillator.frequency.value = event.type === 'paddle' ? 330 : event.type === 'power' ? 660 : 520;
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscillator.connect(gain); gain.connect(this.context.destination);
        oscillator.onended = () => this.release(voice, false);
        oscillator.start(now); oscillator.stop(now + 0.11); this.tones++;
      } catch { this.silence(); this.report('unavailable'); }
    }
  }
  private release(voice: Voice, stop = true): void {
    if (!this.voices.delete(voice)) return;
    voice.oscillator.onended = null;
    if (stop) try { voice.oscillator.stop(); } catch { /* Already ended. */ }
    voice.oscillator.disconnect(); voice.gain.disconnect();
  }
  silence(): void { for (const voice of [...this.voices]) this.release(voice); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.muted = true; this.activated = false; this.activation++; this.silence();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null; this.report('muted');
  }
}

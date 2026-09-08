import { AudioFeedback } from '../../../frontend/src/arcade/audio-feedback';

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running'; currentTime = 0; destination = {};
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
  oscillators: any[] = []; gains: any[] = [];
  constructor() { FakeAudioContext.instances.push(this); }
  createOscillator() {
    const oscillator = { frequency: { value: 0 }, connect: jest.fn(), disconnect: jest.fn(),
      start: jest.fn(), stop: jest.fn(), onended: null as (() => void) | null };
    this.oscillators.push(oscillator); return oscillator;
  }
  createGain() {
    const gain = { gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(), disconnect: jest.fn() };
    this.gains.push(gain); return gain;
  }
}

describe('owned synthesized audio nodes (adapter, not human listening)', () => {
  let original: PropertyDescriptor | undefined;
  let audio: AudioFeedback;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
    FakeAudioContext.instances = []; audio = new AudioFeedback();
  });
  afterEach(() => {
    audio.dispose();
    if (original) Object.defineProperty(globalThis, 'AudioContext', original);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });

  it('immediately stops and disconnects an already playing tone when muted', () => {
    audio.setMuted(false);
    audio.play([{ type: 'paddle', tick: 1, side: 'left' }]);
    const context = FakeAudioContext.instances[0];
    expect(context.oscillators).toHaveLength(1);
    audio.setMuted(true);
    expect(context.oscillators[0].disconnect).toHaveBeenCalled();
    expect(context.gains[0].disconnect).toHaveBeenCalled();
    expect(context.oscillators[0].stop).toHaveBeenCalledTimes(2);
  });

  it('cleans nodes as well as closing the context on route disposal', () => {
    audio.setMuted(false);
    audio.play([{ type: 'point', tick: 4, side: 'left', score: { left: 1, right: 0 } }]);
    const context = FakeAudioContext.instances[0];
    audio.dispose(); audio.dispose();
    expect(context.oscillators[0].disconnect).toHaveBeenCalled();
    expect(context.gains[0].disconnect).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('cannot reuse a running context to bypass a missing gesture after mute', () => {
    audio.setMuted(false); audio.setMuted(true);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userActivation: { isActive: false } } });
    try {
      audio.setMuted(false);
      expect(audio.status).toBe('gesture-required');
      audio.play([{ type: 'paddle', tick: 1, side: 'left' }]);
      expect(FakeAudioContext.instances[0].oscillators).toHaveLength(0);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('restores an unmuted preference without constructing or resuming audio, including an existing context', () => {
    audio.restoreMuted(false);
    expect(audio.status).toBe('gesture-required');
    expect(FakeAudioContext.instances).toHaveLength(0);
    audio.play([{ type: 'paddle', tick: 1, side: 'left' }]);
    audio.setMuted(false);
    const context = FakeAudioContext.instances[0];
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.restoreMuted(false);
    audio.play([{ type: 'paddle', tick: 2, side: 'left' }]);
    expect(context.oscillators).toHaveLength(0);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('surfaces resume rejection and ignores late resume completion after disposal', async () => {
    audio.setMuted(false);
    const context = FakeAudioContext.instances[0];
    context.state = 'suspended'; context.resume.mockRejectedValueOnce(new Error('Denied'));
    audio.setMuted(false); await Promise.resolve();
    expect(audio.status).toBe('blocked');
    audio.play([{ type: 'paddle', tick: 1, side: 'left' }]);
    expect(context.oscillators).toHaveLength(0);
    let resolve: () => void = () => undefined;
    context.resume.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
    audio.setMuted(false); audio.dispose(); context.state = 'running'; resolve(); await Promise.resolve();
    expect(audio.status).toBe('muted');
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('bounds concurrent nodes at eight and coalesces simultaneous point/finished into one tone', () => {
    audio.setMuted(false);
    audio.play(Array.from({ length: 20 }, (_, tick) => ({ type: 'paddle' as const, tick, side: 'left' as const })));
    expect(audio.measurement).toEqual({ tones: 20, activeVoices: 8 });
    audio.silence();
    audio.play([{ type: 'point', tick: 30, side: 'left', score: { left: 6, right: 0 } },
      { type: 'finished', tick: 30, winner: 'left' }]);
    expect(audio.measurement).toEqual({ tones: 21, activeVoices: 1 });
    const latest = FakeAudioContext.instances[0].oscillators.slice(-1)[0];
    latest.onended();
    expect(audio.measurement.activeVoices).toBe(0);
  });
});

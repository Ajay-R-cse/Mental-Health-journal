// Web Audio API ambient relaxation synthesizer for mindful relaxation
class RelaxationAudioEngine {
  private ctx: AudioContext | null = null;
  private currentTrack: string | null = null;
  private gainNode: GainNode | null = null;
  private noiseNode: AudioNode | null = null;
  private bellInterval: any = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play ambient soundscape
  play(track: 'rain' | 'waves' | 'bell' | 'whitenoise', volume = 0.5) {
    this.stop();
    const ctx = this.getAudioContext();
    this.currentTrack = track;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    this.gainNode.connect(ctx.destination);

    if (track === 'rain') {
      this.startRain(ctx, this.gainNode);
    } else if (track === 'waves') {
      this.startWaves(ctx, this.gainNode);
    } else if (track === 'whitenoise') {
      this.startPinkNoise(ctx, this.gainNode);
    } else if (track === 'bell') {
      this.startZenBell(ctx, this.gainNode);
    }
  }

  setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.05);
    }
  }

  stop() {
    if (this.bellInterval) {
      clearInterval(this.bellInterval);
      this.bellInterval = null;
    }
    if (this.noiseNode) {
      try {
        (this.noiseNode as any).stop?.();
        this.noiseNode.disconnect();
      } catch (e) {}
      this.noiseNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {}
      this.gainNode = null;
    }
    this.currentTrack = null;
  }

  isPlaying(track?: string): boolean {
    if (track) {
      return this.currentTrack === track;
    }
    return this.currentTrack !== null;
  }

  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  // Pink noise generator for soothing rain
  private startRain(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(destination);
    whiteNoise.start(0);
    this.noiseNode = whiteNoise;
  }

  // Ocean waves with low frequency oscillation
  private startWaves(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 4 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 1.5;
    }

    const waveSource = ctx.createBufferSource();
    waveSource.buffer = noiseBuffer;
    waveSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const waveGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 8 second wave cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.45, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    waveSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(destination);

    waveSource.start(0);
    lfo.start(0);
    this.noiseNode = waveSource;
  }

  private startPinkNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(destination);
    noiseSource.start(0);
    this.noiseNode = noiseSource;
  }

  // Tibetan Zen Singing Bowl chime
  private startZenBell(ctx: AudioContext, destination: AudioNode) {
    const strike = () => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const bellGain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(432, now); // 432 Hz healing tone
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(864, now); // 1st harmonic

      bellGain.gain.setValueAtTime(0.35, now);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      osc1.connect(bellGain);
      osc2.connect(bellGain);
      bellGain.connect(destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 5);
      osc2.stop(now + 5);
    };

    strike();
    this.bellInterval = setInterval(() => {
      strike();
    }, 6000);
  }
}

export const audioSynth = new RelaxationAudioEngine();

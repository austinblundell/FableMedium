// Procedural WebAudio sound design: no external assets needed.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.startCrowd();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Continuous arena crowd bed: filtered noise with slow undulation.
  startCrowd() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.97 + white * 0.03;      // brownish noise
        d[i] = last * 6;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 550; bp.Q.value = 0.5;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.10;
    src.connect(bp).connect(this.crowdGain).connect(this.master);
    src.start();
    // slow LFO so the crowd "breathes"
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(this.crowdGain.gain);
    lfo.start();
  }

  cheer(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(big ? 0.55 : 0.35, t + 0.15);
    g.exponentialRampToValueAtTime(0.10, t + (big ? 3.5 : 2.0));
  }

  groan() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.22, t + 0.1);
    g.exponentialRampToValueAtTime(0.10, t + 1.2);
  }

  bounce(intensity = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 * Math.min(1, intensity), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.14);
  }

  swish() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0.35;
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
  }

  rim() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [523, 1046, 1580].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * (1 + Math.random() * 0.01);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16 / (i + 1), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + 0.4);
    });
  }

  backboard() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.12);
  }

  buzzer() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 160;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 163;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.setValueAtTime(0.25, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
    osc.connect(g); osc2.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 1.2);
    osc2.start(t); osc2.stop(t + 1.2);
  }

  whistle() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2800, t);
    const trill = ctx.createOscillator();
    trill.frequency.value = 40;
    const trillGain = ctx.createGain();
    trillGain.gain.value = 300;
    trill.connect(trillGain).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.5);
    trill.start(t); trill.stop(t + 0.5);
  }
}

export const audio = new AudioEngine();

// 音：WebAudio で作る効果音（録音素材なし）。
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.8; this.tickGain = null; }
  ensure() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
    const comp = this.ctx.createDynamicsCompressor(); this.master.connect(comp).connect(this.ctx.destination);
    // 部屋の空気（ごく小さなノイズ）
    const n = this.noise(4, true); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = this.ctx.createGain(); g.gain.value = 0.012; n.connect(f).connect(g).connect(this.master); n.start();
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  noise(sec, loop = false) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = loop; return s;
  }
  env(node, t0, a, peak, dec) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); node.connect(g).connect(this.master); return g; }
  play(kind, k = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const tone = (freq, type, a, peak, dec, glide) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + a + dec); this.env(o, t, a, peak * k, dec); o.start(t); o.stop(t + a + dec + 0.05); };
    const burst = (dur, fType, freq, q, peak, a = 0.005) => { const n = this.noise(dur + 0.1); const f = c.createBiquadFilter(); f.type = fType; f.frequency.value = freq; f.Q.value = q; n.connect(f); this.env(f, t, a, peak * k, dur); n.start(t); n.stop(t + dur + 0.1); };
    switch (kind) {
      case 'rustle': burst(0.35, 'bandpass', 3200, 0.8, 0.06, 0.08); break;               // 衣ずれ
      case 'step': burst(0.08, 'lowpass', 500, 1, 0.25); break;                            // 足音
      case 'creak': tone(180, 'sawtooth', 0.02, 0.05, 0.4, 120); burst(0.3, 'bandpass', 900, 6, 0.08); break; // きしみ
      case 'thud': tone(90, 'sine', 0.005, 0.5, 0.35, 45); burst(0.12, 'lowpass', 700, 1, 0.3); break;          // 物が落ちる
      case 'clink': tone(2400, 'sine', 0.002, 0.15, 0.5); tone(3700, 'sine', 0.002, 0.07, 0.35); break;          // 陶器
      case 'set': tone(1400, 'sine', 0.002, 0.08, 0.2); burst(0.05, 'bandpass', 2000, 2, 0.08); break;         // 置く
      case 'spill': burst(0.6, 'bandpass', 1500, 1.5, 0.12, 0.03); break;                    // こぼれる
      case 'wipe': burst(0.25, 'highpass', 2500, 0.7, 0.05, 0.05); break;
      case 'bonk': tone(220, 'square', 0.002, 0.18, 0.25, 110); burst(0.08, 'lowpass', 1200, 1, 0.3); break;     // ごつん
      case 'good': tone(880, 'sine', 0.01, 0.06, 0.6); tone(1320, 'sine', 0.04, 0.04, 0.7); break;              // うまくいった
      case 'awk': tone(140, 'triangle', 0.05, 0.05, 0.9, 120); break;                       // 気まずい
      case 'door': burst(0.7, 'lowpass', 900, 0.7, 0.2, 0.05); tone(160, 'triangle', 0.02, 0.05, 0.4); break;
      case 'chime': tone(1046, 'sine', 0.005, 0.12, 1.2); setTimeout(() => this.play('chimeLo', k), 380); break;
      case 'chimeLo': tone(784, 'sine', 0.005, 0.12, 1.4); break;
      case 'best': tone(784, 'triangle', 0.005, 0.1, 0.25); setTimeout(() => this.play('best2', k), 90); break;   // 見事
      case 'best2': tone(1175, 'triangle', 0.005, 0.1, 0.5); tone(1568, 'sine', 0.01, 0.05, 0.6); break;
      case 'boing': tone(330, 'sine', 0.005, 0.18, 0.5, 90); tone(500, 'triangle', 0.005, 0.05, 0.3, 180); break; // 珍事
      case 'whoosh': burst(0.3, 'bandpass', 1800, 1.2, 0.1, 0.06); break;
      case 'tick': tone(3000, 'square', 0.001, 0.03, 0.03); break;                          // 時計
    }
  }
}

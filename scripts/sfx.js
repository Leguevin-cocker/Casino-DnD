/**
 * Casino DnD — sons synthétisés (WebAudio). Aucun fichier audio à fournir.
 */
export class Sfx {
  constructor(volume = 0.6) {
    this.volume = volume;
    this._ctx = null;
    this._lastTick = 0;
  }

  get ctx() {
    if (!this._ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      this._ctx = new AC();
      this.master = this._ctx.createGain();
      this.master.connect(this._ctx.destination);
    }
    if (this._ctx.state === "suspended") this._ctx.resume().catch(() => {});
    this.master.gain.value = this.volume;
    return this._ctx;
  }

  _tone({ freq = 440, type = "sine", start = 0, dur = 0.2, vol = 0.3, attack = 0.005, slideTo = null, filter = null }) {
    const ctx = this.ctx;
    if (!ctx || this.volume <= 0) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise({ start = 0, dur = 0.4, vol = 0.2, from = 400, to = 4000, q = 1 }) {
    const ctx = this.ctx;
    if (!ctx || this.volume <= 0) return;
    const t = ctx.currentTime + start;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Clic de la roulette qui passe une case. */
  tick(rarityIdx = 0) {
    const now = performance.now();
    if (now - this._lastTick < 28) return;
    this._lastTick = now;
    this._tone({ freq: 1800 + rarityIdx * 120, type: "square", dur: 0.03, vol: 0.08, filter: 3500 });
  }

  whoosh() { this._noise({ dur: 0.45, vol: 0.25, from: 300, to: 3000 }); }
  deal() { this._noise({ dur: 0.18, vol: 0.18, from: 1500, to: 5000, q: 2 }); }
  flip() { this._noise({ dur: 0.12, vol: 0.22, from: 2500, to: 800, q: 3 }); }

  heartbeat() {
    this._tone({ freq: 70, type: "sine", dur: 0.18, vol: 0.5 });
    this._tone({ freq: 60, type: "sine", start: 0.22, dur: 0.22, vol: 0.4 });
  }

  /** Arrêt de la roulette sur un objet. */
  land(rarityIdx = 0) {
    this._tone({ freq: 220, type: "triangle", dur: 0.25, vol: 0.35, slideTo: 110 });
    this._noise({ dur: 0.15, vol: 0.15, from: 4000, to: 1000, q: 4 });
    if (rarityIdx >= 3) this._tone({ freq: 55, type: "sine", dur: 0.9, vol: 0.5 });
  }

  /** Jingle de révélation, de plus en plus grandiose selon la rareté. */
  reveal(rarityIdx = 0) {
    const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]; // do mi sol do mi sol
    const n = 2 + Math.min(rarityIdx, 4);
    const type = rarityIdx >= 3 ? "sawtooth" : "triangle";
    for (let i = 0; i < n; i++) {
      this._tone({ freq: base[i], type, start: i * 0.085, dur: 0.5, vol: 0.18, filter: rarityIdx >= 3 ? 2600 : null });
    }
    if (rarityIdx >= 2) this._shimmer(n * 0.085, rarityIdx);
    if (rarityIdx >= 4) this.fanfare(n * 0.085 + 0.15);
  }

  _shimmer(start, rarityIdx) {
    for (let i = 0; i < 6 + rarityIdx * 3; i++) {
      this._tone({ freq: 2000 + Math.random() * 3000, type: "sine", start: start + i * 0.05, dur: 0.25, vol: 0.05 });
    }
  }

  /** Le coffre tombe sur la table. */
  thud() {
    this._tone({ freq: 95, type: "sine", dur: 0.35, vol: 0.6, slideTo: 45 });
    this._noise({ dur: 0.22, vol: 0.25, from: 600, to: 150, q: 1 });
  }

  /** Le coffre se charge d'énergie avant une amélioration. */
  charge(level = 0) {
    const d = 0.9;
    this._noise({ dur: d, vol: 0.12 + level * 0.03, from: 300 + level * 100, to: 3000 + level * 800, q: 6 });
    this._tone({ freq: 160 + level * 40, type: "sawtooth", dur: d, vol: 0.07, slideTo: 700 + level * 150, filter: 1800 });
  }

  /** Amélioration réussie (bois -> bronze -> argent -> or -> gemme). */
  upgrade(level = 1) {
    const base = 392 * Math.pow(1.26, level - 1);
    [1, 1.25, 1.5, 2].forEach((m, i) => this._tone({ freq: base * m, type: "triangle", start: i * 0.05, dur: 0.6, vol: 0.16 }));
    this._tone({ freq: base * 4, type: "sine", start: 0.18, dur: 0.8, vol: 0.06 });
    this._noise({ dur: 0.3, vol: 0.15, from: 5000, to: 1500, q: 2 });
    if (level >= 4) this._shimmer(0.2, 4);
  }

  /** Tentative ratée : « pfffft ». */
  fizzle() {
    this._tone({ freq: 500, type: "sawtooth", dur: 0.6, vol: 0.08, slideTo: 90, filter: 1200 });
    this._noise({ dur: 0.5, vol: 0.12, from: 2000, to: 300, q: 1 });
  }

  /** Grincement du couvercle. */
  creak() {
    this._tone({ freq: 140, type: "sawtooth", dur: 0.45, vol: 0.07, slideTo: 260, filter: 900 });
    this._tone({ freq: 210, type: "square", start: 0.08, dur: 0.3, vol: 0.03, slideTo: 330, filter: 700 });
  }

  fanfare(start = 0) {
    const notes = [[392, 0], [523.25, 0.16], [659.25, 0.32], [783.99, 0.48], [1046.5, 0.7]];
    for (const [f, s] of notes) {
      this._tone({ freq: f, type: "sawtooth", start: start + s, dur: s === 0.7 ? 1.4 : 0.3, vol: 0.16, filter: 3000 });
      this._tone({ freq: f / 2, type: "square", start: start + s, dur: s === 0.7 ? 1.4 : 0.3, vol: 0.06, filter: 1200 });
    }
    this._tone({ freq: 65, type: "sine", start: start + 0.7, dur: 1.6, vol: 0.45 });
  }
}

/* ==========================================================================
   audio.js – komplett synthetisierter Sound (WebAudio, keine Dateien)
   Soundeffekte: Katapult, Flug, Aufprall (stärkeabhängig), Brot-Bounce,
   Münzen, Spezial-Bounce, UI-Klicks, Charakter-Reaktionen.
   Musik: kleine Schleife im persischen Tonsystem, separat regelbar.
   ========================================================================== */

const Audio = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuf: null,
  musicOn: true,
  sfxOn: true,
  volume: 0.8,
  musicTimer: null,
  musicStep: 0,
  nextNoteTime: 0,
  tempo: 96,
  intensity: 0,

  // Dastgah-artige Skala (Viertel- und Halbtöne vereinfacht)
  SCALE: [0, 2, 3, 6, 7, 8, 11],
  ROOT: 50, // D3

  setup(opts = {}) {
    this.musicOn = opts.music !== false;
    this.sfxOn = opts.sfx !== false;
    this.volume = opts.volume ?? 0.8;
  },

  // Muss nach einer Nutzeraktion aufgerufen werden
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
    this.musicBus.connect(this.master);

    // Rauschpuffer
    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startMusic();
  },

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  },
  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
  },

  // ---------- Bausteine ----------
  // Einfacher Ton mit Hüllkurve und optionalem Glide
  tone(freq, dur, opts = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + (opts.when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
    const vol = opts.vol ?? 0.3;
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = g;
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = opts.filter.type || "lowpass";
      f.frequency.setValueAtTime(opts.filter.freq, t);
      if (opts.filter.to) f.frequency.exponentialRampToValueAtTime(opts.filter.to, t + dur);
      f.Q.value = opts.filter.q ?? 1;
      g.connect(f);
      last = f;
    }
    o.connect(g);
    last.connect(opts.bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  // Rauschen (Wind, Stöße)
  noise(dur, opts = {}) {
    if (!this.ctx || !this.noiseBuf) return;
    const c = this.ctx, t = c.currentTime + (opts.when || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.setValueAtTime(opts.freq || 800, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = c.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },

  // ---------- Soundeffekte ----------
  // Katapult-Abschuss, Stärke 0..1
  launch(power = 0.5) {
    if (!this.ctx) return;
    this.tone(180 + power * 60, 0.35, { type: "triangle", glideTo: 55, vol: 0.5 + power * 0.25 });
    this.noise(0.28, { type: "lowpass", freq: 1400, to: 300, vol: 0.5 + power * 0.3, attack: 0.004 });
    this.tone(90, 0.12, { type: "square", glideTo: 40, vol: 0.12, filter: { type: "lowpass", freq: 600 } });
  },

  whoosh(speed = 600) {
    if (!this.ctx) return;
    const k = MathUtil.clamp(speed / 2500, 0, 1);
    this.noise(0.5, { type: "bandpass", freq: 300 + k * 400, to: 900 + k * 1400, q: 1.2, vol: 0.06 + k * 0.12, attack: 0.1 });
  },

  // Aufprall; strength in px/s, type = Material
  bounce(strength = 400, type = "bread") {
    if (!this.ctx) return;
    const k = MathUtil.clamp(strength / 1200, 0.05, 1);
    const base = { bread: 330, baguette: 280, toast: 520, giant: 180, golden: 640, pine: 230, oak: 210, pista: 400, bush: 150, secret: 760, ground: 120 }[type] || 300;
    const pitch = base * (0.85 + k * 0.4);
    this.tone(pitch, 0.22 + k * 0.1, { type: "sine", glideTo: pitch * 0.5, vol: 0.25 + k * 0.35, attack: 0.002 });
    if (k > 0.45) {
      this.tone(pitch * 2.01, 0.12, { type: "triangle", glideTo: pitch * 1.2, vol: 0.08 + k * 0.08 });
    }
    this.noise(0.12, { type: "highpass", freq: 1800, vol: 0.05 + k * 0.12, attack: 0.002 });
  },

  // Starker Aufprall = Kamera-/Shake-Sound
  thud(strength = 500) {
    if (!this.ctx) return;
    const k = MathUtil.clamp(strength / 1000, 0.1, 1);
    this.tone(120, 0.3, { type: "sine", glideTo: 45, vol: 0.4 * k + 0.1 });
    this.noise(0.18, { type: "lowpass", freq: 600, to: 120, vol: 0.2 + 0.3 * k });
  },

  coin(pitchShift = 0) {
    if (!this.ctx) return;
    const b = 1046 * Math.pow(2, pitchShift / 12);
    this.tone(b, 0.12, { type: "square", vol: 0.12, filter: { type: "lowpass", freq: 3000 } });
    this.tone(b * 1.5, 0.18, { type: "square", vol: 0.1, when: 0.07, filter: { type: "lowpass", freq: 3000 } });
  },

  special() {
    if (!this.ctx) return;
    [0, 4, 7, 11, 12].forEach((n, i) => {
      this.tone(440 * Math.pow(2, n / 12), 0.25, { type: "triangle", vol: 0.18, when: i * 0.06 });
    });
    this.noise(0.6, { type: "bandpass", freq: 600, to: 3000, vol: 0.15 });
  },

  golden() {
    if (!this.ctx) return;
    [0, 4, 7, 12, 16, 19].forEach((n, i) => {
      this.tone(523 * Math.pow(2, n / 12), 0.35, { type: "sine", vol: 0.16, when: i * 0.05 });
    });
  },

  // Eigener Intro-Effekt: kurzer „Ratsch“-Peitschenklang mit aufsteigendem Glissando
  intro() {
    if (!this.ctx) return;
    this.noise(0.09, { type: "highpass", freq: 2200, to: 800, vol: 0.35, attack: 0.002 });
    this.tone(260, 0.32, { type: "sawtooth", glideTo: 980, vol: 0.14, when: 0.05, filter: { type: "bandpass", freq: 900, to: 2400, q: 2 } });
    this.tone(520, 0.2, { type: "triangle", glideTo: 300, vol: 0.2, when: 0.36 });
  },

  click() {
    if (!this.ctx) return;
    this.tone(880, 0.06, { type: "triangle", vol: 0.15, glideTo: 660 });
  },

  hover() {
    if (!this.ctx) return;
    this.tone(1200, 0.03, { type: "sine", vol: 0.04 });
  },

  // Charakter-Reaktionen: Ruf mit Tonhöhe, die die Aufprallstärke spiegelt
  voice(kind = "wee", strength = 0.5) {
    if (!this.ctx) return;
    const base = 380 + strength * 260;
    if (kind === "wee") {
      this.tone(base, 0.55, { type: "sawtooth", glideTo: base * 1.9, vol: 0.10, filter: { type: "bandpass", freq: 900, to: 1800, q: 2.5 } });
    } else if (kind === "oh") {
      this.tone(base * 0.7, 0.4, { type: "sawtooth", glideTo: base * 0.55, vol: 0.10, filter: { type: "bandpass", freq: 700, q: 3 } });
    } else if (kind === "yay") {
      this.tone(base, 0.2, { type: "sawtooth", glideTo: base * 1.4, vol: 0.09, filter: { type: "bandpass", freq: 1200, q: 2 } });
      this.tone(base * 1.4, 0.3, { type: "sawtooth", vol: 0.09, when: 0.18, filter: { type: "bandpass", freq: 1500, q: 2 } });
    } else if (kind === "gasp") {
      this.noise(0.3, { type: "bandpass", freq: 1200, to: 700, vol: 0.12, q: 2 });
    }
  },

  // ---------- Musik ----------
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  },

  scheduleMusic() {
    if (!this.ctx) return;
    const c = this.ctx;
    const beat = 60 / this.tempo;
    const stepDur = beat / 2; // Achtel
    const chords = [[0, 4, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]]; // Progression in Skalenschritten
    while (this.nextNoteTime < c.currentTime + 0.25) {
      const step = this.musicStep;
      const bar = Math.floor(step / 8) % 4;
      const sIdx = step % 8;
      const t = this.nextNoteTime;
      // Bass alle halben Takte
      if (sIdx % 4 === 0) {
        const root = this.ROOT + chords[bar][0];
        const f = 440 * Math.pow(2, (root - 69) / 12);
        this.bus(t, f, stepDur * 3.6, "triangle", 0.20, this.musicBus);
      }
      // Arpeggio im persischen Tonsystem
      const arpNotes = this.SCALE;
      const deg = arpNotes[(sIdx * 3 + bar * 2) % arpNotes.length];
      const noteMidi = this.ROOT + 12 + deg + chords[bar][sIdx % 3] - chords[bar][0];
      const f2 = 440 * Math.pow(2, (noteMidi - 69) / 12);
      this.bus(t, f2, stepDur * 0.9, "sine", 0.07 + this.intensity * 0.03, this.musicBus);
      // Perkussiver Klick
      if (sIdx % 2 === 0) this.bus(t, 90, 0.08, "sine", 0.12, this.musicBus, true);
      this.musicStep++;
      this.nextNoteTime += stepDur;
    }
  },

  // Einzelner Musik-Ton auf eigenem Bus
  bus(when, freq, dur, type, vol, bus, drum = false) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (drum) o.frequency.exponentialRampToValueAtTime(40, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(bus);
    o.start(when);
    o.stop(when + dur + 0.05);
  },

  setIntensity(v) { this.intensity = MathUtil.clamp(v, 0, 1); },
};

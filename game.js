/* ==========================================================================
   game.js – Spielschleife, Zustände, Story-Sequenz, Gameplay, Welt.
   Zustände: menu → story → ready → flight → end → result
   Pause ist ein Overlay über 'ready' / 'flight'.
   ========================================================================== */

const LOGICAL_H = 720;
const CAT_X = 200;          // Position des Katapults (Welt)
const PIVOT_Y = 496;        // Drehpunkt des Wurfarms (Welt)
const ARM_LEN = 150;
const GROUND = Physics.GROUND_Y;
const PX_PER_M = 10;

// Biome entlang der Flugstrecke (ab Meter)
const BIOMES = [
  { id: "meadow", name: "Persischer Garten", from: 0,
    skyTop: "#8fd3ff", skyBot: "#fff0c4", sun: "#fff7d4",
    far: "#a9d6b4", mid: "#6fae83", forest: "#3f7d4b", peaks: 90,
    ground: { base: "#79b84e", light: "#9dd66a", dark: "#4f8a36" }, edge: "#9be06a", earth: "#7a4e25" },
  { id: "desert", name: "Dasht-e Kavir", from: 200,
    skyTop: "#ff9b68", skyBot: "#ffe2a4", sun: "#ffe9b0",
    far: "#e6b07f", mid: "#cf9060", forest: "#8e7a44", peaks: 60,
    ground: { base: "#e8c07a", light: "#f8dea4", dark: "#c3924c" }, edge: "#f1cb7a", earth: "#b5773c" },
  { id: "mountains", name: "Alborz-Gebirge", from: 500,
    skyTop: "#4a86d2", skyBot: "#d3eaff", sun: "#ffffff",
    far: "#9fb2d4", mid: "#62789f", forest: "#2c5a48", peaks: 200,
    ground: { base: "#6a9d68", light: "#8bc27c", dark: "#466f4c" }, edge: "#86c178", earth: "#5b5a4b" },
];

// Gewichtete Objekt-Tabelle (Summe = 1)
const OBJECT_TABLE = [
  { p: 0.24, kind: "bread",  mat: "bread",    sprite: "bread_round",    r: 42, y: [300, 470] },
  { p: 0.12, kind: "bread",  mat: "baguette", sprite: "bread_baguette", r: 40, y: [300, 470] },
  { p: 0.14, kind: "bread",  mat: "toast",    sprite: "bread_toast",    r: 36, y: [280, 460] },
  { p: 0.08, kind: "bread",  mat: "giant",    sprite: "bread_giant",    r: 92, y: [300, 420] },
  { p: 0.04, kind: "bread",  mat: "golden",   sprite: "bread_golden",   r: 40, y: [260, 460] },
  { p: 0.20, kind: "tree",   mat: "tree",                                 r: 46, y: [0, 0] },
  { p: 0.14, kind: "bush",   mat: "bush",     sprite: "bush",           r: 46, y: [0, 0] },
  { p: 0.04, kind: "bush",   mat: "secret",   sprite: "bush_secret",    r: 46, y: [0, 0], secret: true },
];

const TREE_MATS = { meadow: ["oak", "pista"], desert: ["pista", "pine"], mountains: ["pine", "oak"] };
const SURPRISES = ["rain", "boost", "feast"];

const Game = {
  canvas: null,
  ctx: null,
  k: 1,
  VW: 1280,
  state: "menu",
  prevState: null,
  t: 0,
  lastTs: 0,
  paused: false,
  endTimer: 0,
  story: null,
  fade: 0,
  fadeTarget: 0,
  fadeThen: null,

  camX: 0,
  camY: 0,
  anchorX: 300,

  body: null,
  objects: [],
  coins: [],
  spawnX: 0,
  nextIdx: 0,
  biomeIdx: 0,
  biomeBlend: 1,
  biomeFrom: 0,
  clouds: [],
  bio: [],

  aim: { angle: 0.95, power: 0.55, dragging: false, pointerId: null, px: 0, py: 0, charging: false, dir: 1, key: false },
  arm: { theta: -0.25, from: -0.25, to: -0.25, anim: 0, animDur: 0.25 },

  // Runde
  run: null,
  hitT: 0,
  lastBounceT: -10,
  combo: 0,
  woman: null,
  shot: { power: 0, angle: 0 },

  particles: null,
  texts: null,
  input: { lift: 0 },

  init() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    Save.load();
    Assets.init();
    Audio.setup(Save.data.settings);
    Camera.shakeEnabled = Save.data.settings.shake;
    this.particles = new ParticleSystem(700);
    this.texts = new FloatTexts();
    this.body = Physics.createBody(0, 0, 30);
    this.buildBiomes();
    this.buildClouds();
    this.resetWorld();

    UI.init((action) => this.onAction(action));
    UI.refreshMenu();
    UI.renderAll();
    this.bindInput();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());

    this.setState("menu");
    requestAnimationFrame(ts => this.loop(ts));
  },

  // ---------- Setup ----------
  buildBiomes() {
    this.bio = BIOMES.map((b, i) => {
      const seed = 1234 + i * 77;
      return {
        def: b,
        far: Assets.mountainLayer(2400, 300, 230, b.far, b.mid, b.peaks + 40, seed),
        mid: Assets.mountainLayer(2400, 240, 170, b.mid, b.forest, b.peaks, seed + 5),
        forest: Assets.forestLayer(2400, 140, b.forest, seed + 9),
        tile: Assets.groundTile(b.ground),
      };
    });
  },

  buildClouds() {
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        img: Assets.sprites.cloud[i % 3],
        layer: i % 3,            // Parallax-Ebene
        x: Math.random() * 3000,
        y: [60, 150, 230][i % 3] + Math.random() * 60,
        s: [0.75, 1, 1.25][i % 3] * MathUtil.rand(0.85, 1.15),
      });
    }
  },

  // Welt zurücksetzen (neue Runde)
  resetWorld() {
    this.objects = [];
    this.coins = [];
    this.spawnX = CAT_X + 480;
    this.nextIdx = 0;
    this.biomeIdx = 0;
    this.biomeBlend = 1;
    this.camX = 0;
    this.camY = 0;
    while (this.spawnX < CAT_X + 4200) this.spawnChunk();
  },

  spawnChunk() {
    const gap = MathUtil.rand(240, 380);
    const x = this.spawnX + gap;
    const roll = Math.random();
    let acc = 0, def = OBJECT_TABLE[0];
    for (const d of OBJECT_TABLE) {
      acc += d.p;
      if (roll <= acc) { def = d; break; }
    }
    const biomeName = BIOMES[this.biomeIdx].id;
    const obj = { x, kind: def.kind, material: def.mat, sprite: def.sprite, r: def.r + 20, secret: !!def.secret, phase: Math.random() * 6.28, spring: new Spring(180, 12), tilt: new Spring(120, 8), used: 0 };
    if (def.kind === "tree") {
      obj.material = MathUtil.pick(TREE_MATS[biomeName]);
      obj.sprite = "tree_" + (obj.material === "pista" ? "pista" : obj.material);
      obj.baseY = 408;
      obj.r = obj.material === "oak" ? 72 : obj.material === "pine" ? 62 : 66;
    } else if (def.kind === "bush") {
      obj.baseY = 560;
      obj.bob = 0;
    } else {
      obj.baseY = MathUtil.rand(def.y[0], def.y[1]);
      obj.bob = MathUtil.rand(6, 14);
    }
    obj.y = obj.baseY;
    this.objects.push(obj);

    // Münzbogen zwischen den Objekten
    if (Math.random() < 0.6) {
      const cy = MathUtil.rand(200, 380);
      for (let i = 0; i < 5; i++) {
        const u = i / 4;
        this.coins.push({
          x: this.spawnX + gap * (0.25 + u * 0.5),
          y: cy - Math.sin(u * Math.PI) * 90,
          vx: 0, vy: 0, taken: false, golden: false, phase: i * 0.6,
        });
      }
    }
    this.spawnX = x + 60;
  },

  ensureWorld() {
    const need = this.camX + this.VW + 1400;
    while (this.spawnX < need) this.spawnChunk();
    // Alte Objekte verwerfen
    this.objects = this.objects.filter(o => o.x > this.camX - 400);
    this.coins = this.coins.filter(c => !c.taken && c.x > this.camX - 400);
  },

  // ---------- Zustand ----------
  setState(s) {
    this.prevState = this.state;
    this.state = s;
    document.body.dataset.state = s;
    const hudOn = s === "ready" || s === "flight" || s === "end" || s === "paused";
    UI.setHud(hudOn);
  },

  onAction(action) {
    Audio.ensure();
    switch (action) {
      case "play": return this.startGame(true);
      case "restart": return this.startGame(false);
      case "menu": return this.toMenu();
      case "resume": return this.resume();
      case "shop": case "upgrades": case "achievements": case "stats": case "settings":
        this.paused = false;
        UI.show({ shop: "screenShop", upgrades: "screenUpgrades", achievements: "screenAchievements", stats: "screenStats", settings: "screenSettings" }[action]);
        return;
    }
  },

  toMenu() {
    this.paused = false;
    this.setState("menu");
    UI.show("screenMenu");
    UI.refreshMenu();
  },

  // Neue Runde: ggf. Story zeigen
  startGame(withStory) {
    Audio.ensure();
    UI.show("__none__");
    if (withStory) {
      this.setState("story");
      this.story = new Story(this);
      document.getElementById("btnSkip").classList.remove("hidden");
      this.story.start();
      Audio.intro();
    } else {
      this.beginRound();
    }
  },

  beginRound() {
    document.getElementById("btnSkip").classList.add("hidden");
    this.resetWorld();
    this.body = Physics.createBody(0, 0, 30);
    this.hitT = 0;
    this.combo = 0;
    this.lastBounceT = -10;
    this.aim.angle = 0.95;
    this.aim.power = 0.55;
    this.aim.dragging = false;
    this.aim.charging = false;
    this.arm.theta = this.loadedTheta(this.aim.power);
    this.arm.anim = 0;
    this.endTimer = 0;
    this.run = {
      startT: this.t, bounces: 0, coins: 0, golden: 0, maxSpeed: 0,
      maxDist: 0, biomeMax: 0, secret: 0, launched: false,
    };
    this.camX = 0;
    this.paused = false;
    this.setState("ready");
    UI.hide("screenResult");
    UI.hide("screenPause");
    UI.hide("screenMenu");
    UI.show("__none__");
    UI.setHud(true);
    UI.flashHint("hudHint");
    this.placeWoman();
  },

  pause() {
    if (this.state !== "ready" && this.state !== "flight") return;
    this.paused = true;
    this.prevState = this.state;
    this.state = "paused";
    document.body.dataset.state = "paused";
    UI.overlay("screenPause");
  },

  resume() {
    if (!this.paused) return;
    this.paused = false;
    UI.hide("screenPause");
    this.state = this.prevState || "ready";
    document.body.dataset.state = this.state;
  },

  // ---------- Katapult & Abschuss ----------
  loadedTheta(p) { return -0.25 - 0.6 * p; },

  seatPos(theta) {
    return {
      x: CAT_X + ARM_LEN * Math.sin(theta),
      y: PIVOT_Y - ARM_LEN * Math.cos(theta) - 22,
    };
  },

  placeWoman() {
    const seat = this.seatPos(this.arm.theta);
    this.body.x = seat.x;
    this.body.y = seat.y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.omega = 0;
    this.body.angle = 0;
    this.body.grounded = false;
  },

  // Anfangsgeschwindigkeit aus Ziel-Winkel und Stärke
  launchVelocity(angle, power) {
    const cat = CATAPULT_STYLES[Save.data.catapult] ? Save.data.catapult : "wood";
    const catPow = (CATAPULTS.find(c => c.id === cat) || CATAPULTS[0]).power;
    const speed = (850 + 1250 * power) * catPow * Save.upgradeEffect("power");
    const boost = Save.upgradeEffect("start");
    return { vx: Math.cos(angle) * speed + boost, vy: -Math.sin(angle) * speed };
  },

  launch() {
    if (this.state !== "ready" || this.run.launched) return;
    const p = MathUtil.clamp(this.aim.power, 0.05, 1);
    const v = this.launchVelocity(this.aim.angle, p);
    const rel = this.seatPos(-0.25);
    this.arm.from = this.arm.theta;
    this.arm.to = -0.25;
    this.arm.anim = 0.0001;
    this.arm.animDur = 0.09;
    this.body.x = rel.x;
    this.body.y = rel.y;
    this.runStart = this.t;
    this.restTime = 0;
    this.body.vx = v.vx;
    this.body.vy = v.vy;
    this.body.omega = MathUtil.rand(-2.2, 2.2);
    this.body.angle = 0;
    this.body.grounded = false;
    this.run.launched = true;
    this.run.startX = CAT_X;
    this.aim.dragging = false;
    this.aim.charging = false;
    this.setState("flight");
    Audio.launch(p);
    Audio.whoosh(v.vx);
    Audio.voice("wee", p);
    Camera.addShake(4 + p * 6);
    UI.hideHint("hudHint");
    UI.flashHint("hudFlight");
    this.particles.burst("dust", rel.x, rel.y + 18, 10, 1.2);
    this.hitT = 0;
  },

  // ---------- Story ----------
  finishStory() {
    document.getElementById("btnSkip").classList.add("hidden");
    this.fadeOut(() => this.beginRound());
  },

  fadeOut(then) {
    this.fadeTarget = 1;
    this.fadeThen = then;
  },

  // ---------- Eingaben ----------
  bindInput() {
    const c = this.canvas;
    const logical = (e) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * this.VW, y: (e.clientY - r.top) / r.height * LOGICAL_H };
    };
    c.addEventListener("pointerdown", (e) => {
      Audio.ensure();
      if (this.state === "story") { this.story.advance(); return; }
      if (this.state === "ready" && !this.run.launched) {
        const p = logical(e);
        this.aim.dragging = true;
        this.aim.pointerId = e.pointerId;
        this.aim.px = p.x; this.aim.py = p.y;
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        this.updateAimFromPointer(p);
      } else if (this.state === "flight") {
        this.input.lift = Save.upgradeEffect("flight");
        UI.hideHint("hudFlight");
      }
    });
    c.addEventListener("pointermove", (e) => {
      if (this.aim.dragging && this.state === "ready") this.updateAimFromPointer(logical(e));
    });
    const up = () => {
      if (this.aim.dragging && this.state === "ready") {
        this.aim.dragging = false;
        if (this.aim.power > 0.06) this.launch();
      }
      this.input.lift = 0;
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (this.state === "story") { this.story.skipAll(); return; }
        if (this.paused) this.resume(); else this.pause();
        return;
      }
      if (this.state === "story" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); this.story.advance(); return; }
      if (this.state === "ready" && !this.run.launched) {
        if (e.key === "ArrowUp") this.aim.angle = MathUtil.clamp(this.aim.angle + 0.05, 0.1, 1.45);
        if (e.key === "ArrowDown") this.aim.angle = MathUtil.clamp(this.aim.angle - 0.05, 0.1, 1.45);
        if (e.key === " " && !this.aim.charging) { this.aim.charging = true; this.aim.dir = this.aim.power > 0.5 ? -1 : 1; this.aim.key = true; e.preventDefault(); }
      } else if (this.state === "flight" && (e.key === " " || e.key === "ArrowUp")) {
        this.input.lift = Save.upgradeEffect("flight");
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === " " && this.aim.key) {
        this.aim.key = false;
        if (this.state === "ready" && this.aim.charging) {
          this.aim.charging = false;
          if (this.aim.power > 0.06) this.launch();
        }
      }
      if (e.key === " " || e.key === "ArrowUp") this.input.lift = 0;
    });
    window.addEventListener("blur", () => { this.input.lift = 0; if (this.state === "flight" || this.state === "ready") this.pause(); });
    document.getElementById("btnPause").addEventListener("click", () => { Audio.ensure(); this.pause(); });
    document.getElementById("btnSkip").addEventListener("click", () => this.story && this.story.skipAll());
  },

  // Zielen: Abstand zum Abschusspunkt bestimmt Stärke, Richtung den Winkel
  updateAimFromPointer(p) {
    const ax = this.seatPos(-0.25).x, ay = this.seatPos(-0.25).y;
    const dx = ax - p.x, dy = ay - p.y;
    const dist = Math.hypot(dx, dy);
    this.aim.power = MathUtil.clamp(dist / 230, 0, 1);
    if (dist > 4) {
      this.aim.angle = MathUtil.clamp(Math.atan2(dy * -1, dx), 0.08, 1.45);
    }
    this.arm.theta = this.loadedTheta(this.aim.power);
  },

  // ---------- Hauptschleife ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.k = h / LOGICAL_H;
    this.VW = w / this.k;
    this.anchorX = this.VW * 0.35;
    const mc = document.getElementById("menuStage");
    if (mc) { /* Menü-Bühne skaliert über CSS */ }
  },

  loop(ts) {
    requestAnimationFrame(t => this.loop(t));
    let dt = this.lastTs ? (ts - this.lastTs) / 1000 : 1 / 60;
    this.lastTs = ts;
    dt = Math.min(dt, 1 / 30);
    this.t += dt;

    // Menüs
    if (this.state === "menu") {
      UI.tickMenu(dt);
      const mc = document.getElementById("menuStage");
      if (mc && mc.getContext) {
        const mctx = mc.getContext("2d");
        UI.drawMenu(mctx, mc.width, mc.height);
      }
    }

    if (this.paused) { this.render(); return; }

    // Hit-Stop: Zeitlupe kurz bei starken Aufprallen
    let sdt = dt;
    if (Camera.hitStop > 0) sdt = dt * 0.25;
    Camera.update(dt);

    if (this.state === "story" && this.story) this.story.update(dt);
    if (this.state === "ready" || this.state === "flight" || this.state === "end") this.update(sdt, dt);

    // Überblenden
    if (this.fadeTarget === 1 && this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 2.2);
      if (this.fade >= 1) { this.fadeTarget = 0; const f = this.fadeThen; this.fadeThen = null; if (f) f(); }
    } else if (this.fadeTarget === 0 && this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 1.8);
    }

    // HUD-Werte aktualisieren
    if (this.run && ["ready", "flight", "end", "result"].includes(this.state)) {
      const sp = this.body ? Math.hypot(this.body.vx, this.body.vy) * 0.36 : 0;
      const dist = Math.floor(this.run.maxDist || 0);
      UI.updateHud(dist, sp, this.run.coins, Math.max(Save.data.best, dist));
    }
    this.render();
  },

  // Spielsimulation
  update(sdt, dt) {
    this.ensureWorld();
    const body = this.body;
    const flying = this.state === "flight";

    // Armanimation (Schwung nach vorn)
    if (this.arm.anim > 0) {
      this.arm.anim += dt;
      const k = MathUtil.clamp(this.arm.anim / this.arm.animDur, 0, 1);
      this.arm.theta = MathUtil.lerp(this.arm.from, this.arm.to, MathUtil.easeOutCubic(k));
      if (k >= 1) this.arm.anim = 0;
    } else if (this.state === "ready" && !this.aim.dragging && !this.aim.charging) {
      // Ruhige Ausgangsposition aus der Stärke
      this.arm.theta = MathUtil.smooth(this.arm.theta, this.loadedTheta(this.aim.power), 8, dt);
    }

    // Tastatur-Ladung
    if (this.state === "ready" && this.aim.charging) {
      this.aim.power = MathUtil.clamp(this.aim.power + this.aim.dir * dt * 0.9, 0, 1);
      if (this.aim.power >= 1 || this.aim.power <= 0.0) this.aim.dir *= -1;
      this.arm.theta = this.loadedTheta(this.aim.power);
    }

    // Ruhige Sitzbewegung im Katapult
    if (this.state === "ready") {
      const seat = this.seatPos(this.arm.theta);
      body.x = seat.x;
      body.y = seat.y + Math.sin(this.t * 3) * 1.5;
    }

    // Objekte: Schweben, Federn
    for (const o of this.objects) {
      if (o.kind === "bread") o.y = o.baseY + Math.sin(this.t * 1.6 + o.phase) * (o.bob || 0);
      o.spring.update(dt);
      o.tilt.update(dt);
    }

    // Münzen anziehen und einsammeln
    const magnet = Save.upgradeEffect("magnet");
    {
      for (const c of this.coins) {
        if (c.taken) continue;
        const dx = body.x - c.x, dy = body.y - c.y;
        const d = Math.hypot(dx, dy);
        if (magnet && d < magnet && d > 1) {
          c.x += (dx / d) * 520 * dt;
          c.y += (dy / d) * 520 * dt;
        }
        if (d < 34 + body.r * 0.5) {
          c.taken = true;
          this.run.coins += c.golden ? 25 : 1;
          Audio.coin(Math.min(12, this.run.coins % 12));
          this.particles.burst("coin", c.x, c.y, 3, 1);
          this.texts.add("+1", c.x, c.y - 10, "#fff3a0", 20);
        }
      }
    }

    // Physik nur im Flug
    if (flying) {
      const h = sdt / Physics.SUBSTEPS;
      this.hitT = Math.max(0, this.hitT - sdt);
      for (let i = 0; i < Physics.SUBSTEPS; i++) {
        Physics.integrate(body, h, this.input);
        const bounceMult = Save.upgradeEffect("bounce");
        // Zielhilfe: sanfter Zug zu nahen Brot- und Baum-Zielen
        for (const o of this.objects) {
          if (Math.abs(o.x - body.x) > 220) continue;
          const dx = o.x - body.x, dy = o.y - body.y;
          const d = Math.hypot(dx, dy);
          const reach = o.r + body.r + 80;
          if (d < reach && d > 1) {
            const k = (1 - d / reach) * 520;
            body.vx += (dx / d) * k * h;
            body.vy += (dy / d) * k * h;
          }
        }
        for (const o of this.objects) {
          if (Math.abs(o.x - body.x) > 140) continue;
          const res = Physics.collideObject(body, o, bounceMult);
          if (res) this.onImpact(res, o);
        }
        const g = Physics.collideGround(body, Save.upgradeEffect("bounce"), h);
        if (g) this.onGroundImpact(g);
      }
      const sp = Math.hypot(body.vx, body.vy);
      this.run.maxSpeed = Math.max(this.run.maxSpeed, sp * 0.36);
      this.updateFlightPose(dt);

      const distM = Math.max(0, (body.x - CAT_X) / PX_PER_M);
      this.run.maxDist = Math.max(this.run.maxDist, distM);
      this.updateBiome(distM);
      Audio.setIntensity(sp / 2500);

      // Rutsch-Geräusch
      if (Math.random() < dt * 4 && sp > 900) Audio.whoosh(sp * 0.4);

      // Ende der Runde
      if (body.grounded) {
        this.restTime = (this.restTime || 0) + dt;
        if (Math.abs(body.vx) < 35 && this.restTime > 0.9) this.endRound();
      } else {
        this.restTime = 0;
      }
      if (this.t - this.runStart > 120) this.endRound();
    }

    // Kamera: folgt der Frau
    if (this.state === "ready") {
      const targetX = 0;
      this.camX = MathUtil.smooth(this.camX, targetX, 4, dt);
      this.camY = MathUtil.smooth(this.camY, 0, 3, dt);
    } else {
      const targetX = Math.max(0, body.x - this.VW * 0.35);
      this.camX = MathUtil.smooth(this.camX, targetX, 5, dt);
      const targetY = MathUtil.clamp(body.y - 380, -420, 0);
      this.camY = MathUtil.smooth(this.camY, targetY, 2.6, dt);
    }
    // Zoom bei starkem Aufprall
    if (this.state === "end") this.endTimer += dt;
    this.particles.update(dt);
    this.texts.update(dt);
  },

  runStart: 0,

  updateFlightPose(dt) {
    const body = this.body;
    if (body.grounded) {
      // Aufrichten am Boden
      body.angle *= Math.exp(-6 * dt);
      body.omega *= Math.exp(-4 * dt);
    }
  },

  // Aufprall auf Brot/Baum/Busch
  onImpact(res, o) {
    const s = res.strength;
    if (s < 40) return;
    const now = this.t;
    this.combo = now - this.lastBounceT < 2.4 ? this.combo + 1 : 1;
    this.lastBounceT = now;
    this.run.bounces++;
    this.hitT = 0.28;

    // Materialabhängige Effekte
    const isTree = o.kind === "tree";
    const isBush = o.kind === "bush";
    const sx = res.x, sy = res.y;
    Audio.bounce(s, o.material);
    if (s > 500) Audio.thud(s);
    if (isTree) {
      this.particles.burst("confetti", sx, sy, 6, 0.8);
      o.tilt.kick(MathUtil.clamp(s / 500, 0.4, 2.5) * (res.nx < 0 ? -1 : 1));
    } else {
      this.particles.burst("crumb", sx, sy, 3 + Math.min(10, Math.floor(s / 150)), 0.8 + Math.min(1, s / 1200));
    }
    if (isBush && !o.secret) o.tilt.kick(1.2);
    o.spring.kick(MathUtil.clamp(s / 700, 0.3, 2.6));

    // Frauen-Squash
    this.body.squashKick = Math.min(1, s / 1200);

    // Kamera-Feedback je nach Stärke
    if (s > 380) Camera.addShake(Math.min(20, s / 65));
    if (s > 800) { Camera.addZoom(0.06); Camera.addHitStop(0.045); }
    if (s > 500) this.particles.burst("star", sx, sy, 6, 1);
    if (s > 620 && Math.random() < 0.45) Audio.voice("yay", s / 1200);
    if (s > 320) this.particles.burst("ring", sx, sy, 1, 1);

    // Anzeigen
    const label = `${this.run.bounces}. Aufprall`;
    if (this.combo >= 3) UI.bounceLabel(`${this.combo}× Kombo · ${label}`);
    else if (s > 360) UI.bounceLabel(`${MATERIAL_NAMES[o.material] || o.material}!`);

    // Schwindel: Spezialobjekte
    // Belohnungen nur einmal pro Objekt
    if (o.material === "golden" && !o.used) {
      o.used = true;
      this.run.golden++;
      Audio.golden();
      Camera.addZoom(0.05);
      this.particles.burst("star", sx, sy, 14, 1.4);
      this.particles.burst("coin", sx, sy, 10, 1.2);
      this.run.coins += 50;
      this.texts.add("+50 Gold!", sx, sy - 40, "#fff0a0", 34);
      UI.toast("Goldenes Brot getroffen!", true);
    }
    if (o.secret && !o.used) {
      o.used = true;
      this.triggerSurprise(o);
    }
  },

  triggerSurprise(o) {
    this.run.secret++;
    const kind = MathUtil.pick(SURPRISES);
    Audio.special();
    Camera.addShake(10);
    this.particles.burst("ring", o.x, o.y, 2, 1.2);
    if (kind === "rain") {
      for (let i = 0; i < 18; i++) {
        this.coins.push({ x: o.x + MathUtil.rand(-160, 160), y: o.y - MathUtil.rand(80, 260), vx: 0, vy: 0, taken: false, golden: i % 4 === 0, phase: i });
      }
      this.texts.add("Münzregen!", o.x, o.y - 80, "#fff0a0", 30);
    } else if (kind === "boost") {
      this.body.vy = Math.min(this.body.vy, -900);
      this.body.vx += 500;
      this.texts.add("Turbo-Brot!", o.x, o.y - 80, "#ffd6a0", 30);
    } else {
      this.run.coins += 100;
      this.texts.add("Fladenbrot-Gruß! +100", o.x, o.y - 80, "#ffe38a", 28);
      Audio.voice("oh", 0.7);
    }
  },

  onGroundImpact(g) {
    if (g.strength < 120) return;
    this.particles.burst("dust", g.x, g.y - 6, 6, Math.min(1.5, g.strength / 800));
    Audio.bounce(g.strength, "ground");
    if (g.strength > 600) { Camera.addShake(Math.min(16, g.strength / 80)); Audio.thud(g.strength); }
    this.body.squashKick = Math.min(1, g.strength / 900);
  },

  // Biome nach Distanz
  updateBiome(distM) {
    let idx = 0;
    for (let i = 0; i < BIOMES.length; i++) if (distM >= BIOMES[i].from) idx = i;
    if (idx !== this.biomeIdx) {
      this.biomeIdx = idx;
      this.biomeBlend = 0;
      UI.toast(`Neue Landschaft: ${BIOMES[idx].name}`);
      Audio.special();
    }
    if (this.biomeBlend < 1) this.biomeBlend = Math.min(1, this.biomeBlend + 0.02);
    this.run.biomeMax = Math.max(this.run.biomeMax, idx);
  },

  // Endgültig gelandet/ausgerollt
  endRound() {
    if (this.state === "end") return;
    this.setState("end");
    this.endTimer = 0;
    const body = this.body;
    body.grounded = true;
    this.run.distance = Math.floor(Math.max(0, (body.x - CAT_X) / PX_PER_M));
    Audio.voice(this.run.distance > 200 ? "yay" : "oh", 0.6);
    this.particles.burst("confetti", body.x, body.y - 20, 22, 1.2);
    setTimeout(() => this.showResult(), 1300);
  },

  showResult() {
    const r = this.run;
    const d = r.distance;
    const s = Save.data;
    const newRecord = d > s.best && d > 0;
    if (newRecord) s.best = d;
    const earned = Math.round(r.coins + d / 5);
    s.coins += earned;
    s.totalCoins += earned;
    s.games += 1;
    s.totalDistance += d;
    s.totalBounces += r.bounces;
    s.golden += r.golden;
    s.secret += r.secret;
    s.maxSpeed = Math.max(s.maxSpeed, r.maxSpeed);
    s.maxBiome = Math.max(s.maxBiome, r.biomeMax);
    const tags = [
      [40, "Autsch! Das war kurz."],
      [150, "Gar nicht schlecht!"],
      [400, "Brotiges Flugtalent!"],
      [900, "Radj hat recht gehabt!"],
      [Infinity, "Legendärer Flug!"],
    ];
    const tag = tags.find(([lim]) => d < lim)[1];
    Save.write();
    const unlocked = Save.unlockAchievements();
    Save.write();
    UI.refreshMenu();
    UI.renderAll();
    UI.showResult({
      distance: d, coins: earned, bounces: r.bounces,
      maxSpeed: r.maxSpeed, golden: r.golden, newRecord, tag,
    });
    UI.setHud(false);
    UI.show("__none__");
    UI.overlay("screenResult");
    this.setState("result");
    unlocked.forEach((a, i) => setTimeout(() => UI.toast(`Erfolg: ${a.name}`, true), 400 + i * 700));
  },

  // ---------- Rendering ----------
  render() {
    const ctx = this.ctx;
    const W = this.VW, H = LOGICAL_H;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (this.state === "menu") {
      // Menü hat eigene Bühne; Hintergrund nur als Grundfarbe
      ctx.fillStyle = "#ffb35c";
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.state === "story") {
      this.story.draw(ctx, W, H);
      this.drawFade(ctx, W, H);
      return;
    }

    const cam = Camera.offset();
    const zoom = 1 + Camera.zoomKick;
    const dusk = MathUtil.clamp((this.run && this.run.maxDist ? this.run.maxDist : 0) / 900, 0, 1);

    // Himmel & Parallax (Bildschirmkoordinaten)
    this.drawSky(ctx, W, H, dusk);
    this.drawBiomeBack(ctx, W, H);

    ctx.save();
    // Kamera mit Zoom um den Abschusspunkt
    const ax = this.anchorX, ay = 420;
    ctx.translate(ax, ay);
    ctx.scale(zoom, zoom);
    ctx.translate(-ax, -ay);
    ctx.translate(cam.x, cam.y);

    ctx.save();
    ctx.translate(-this.camX, -this.camY);
    this.drawGround(ctx, W);

    // Objekte hinter der Frau (Bäume & Büsche)
    for (const o of this.objects) {
      if (o.kind === "tree" || o.kind === "bush") this.drawGroundObject(ctx, o);
    }

    // Münzen
    for (const c of this.coins) {
      if (c.taken) continue;
      const sx = c.x, sy = c.y;
      if (sx < this.camX - 60 || sx > this.camX + W + 60) continue;
      const sc = Math.abs(Math.cos(this.t * 4 + c.phase)) * 0.5 + 0.5;
      ctx.save();
      ctx.translate(sx, sy + Math.sin(this.t * 3 + c.phase) * 3);
      ctx.scale(sc, 1);
      ctx.drawImage(Assets.sprites.coin, -22, -22, 44, 44);
      ctx.restore();
    }

    // Brot-Objekte
    for (const o of this.objects) {
      if (o.kind === "bread") this.drawBread(ctx, o);
    }

    // Vorschau der Flugbahn
    if (this.state === "ready" && !this.run.launched) this.drawAimPreview(ctx);

    // Partikel hinter der Frau
    this.particles.draw(ctx);

    // Katapult
    this.drawCatapult(ctx);

    // Frau
    this.drawWoman(ctx);
    this.texts.draw(ctx);
    ctx.restore();
    ctx.restore();

    // Geschwindigkeitslinien & Licht (Bildschirm)
    if (this.state === "flight" && this.body) {
      const sp = Math.hypot(this.body.vx, this.body.vy);
      drawSpeedLines(ctx, W, H, sp, this.t, MathUtil.clamp((sp - 1200) / 1200, 0, 1));
    }
    this.drawLighting(ctx, W, H, dusk);
    this.drawFade(ctx, W, H);
  },

  drawFade(ctx, W, H) {
    if (this.fade <= 0) return;
    ctx.fillStyle = `rgba(20,10,4,${this.fade})`;
    ctx.fillRect(0, 0, W, H);
  },

  drawSky(ctx, W, H, dusk) {
    const b = BIOMES[this.biomeIdx];
    const prev = BIOMES[Math.max(0, this.biomeIdx - 1)];
    const blend = this.biomeBlend;
    const top = this.mixColor(prev.skyTop, b.skyTop, blend);
    const bot = this.mixColor(prev.skyBot, b.skyBot, blend);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.7, bot);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Abendfarbe
    if (dusk > 0) {
      ctx.fillStyle = `rgba(255,120,70,${dusk * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Sonne mit sanftem Pulsieren
    const sunY = MathUtil.lerp(120, 330, dusk);
    Deco.sun(ctx, W * 0.78, sunY, 46 + Math.sin(this.t * 1.5) * 2);
    // Wolkenfelder
    for (const c of this.clouds) {
      const f = [0.06, 0.14, 0.26][c.layer];
      const period = W + 500;
      const x = ((c.x - this.camX * f) % period + period) % period - 250;
      const w = c.img.width * c.s, h = c.img.height * c.s;
      ctx.globalAlpha = [0.75, 0.9, 1][c.layer];
      ctx.drawImage(c.img, x, c.y - (c.layer === 0 ? 40 : 0), w, h);
      ctx.globalAlpha = 1;
    }
  },

  // Bergketten & Wälder – Parallax
  drawBiomeBack(ctx, W, H) {
    const draw = (bio, alpha) => {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      const far = bio.far, mid = bio.mid, forest = bio.forest;
      const layer = (img, factor, y) => {
        const off = -((this.camX * factor) % img.width);
        for (let x = off - img.width; x < W + img.width; x += img.width) ctx.drawImage(img, x, y);
      };
      layer(far, 0.12, 200);
      layer(mid, 0.22, 300);
      layer(forest, 0.4, GROUND - 140);
      ctx.restore();
    };
    if (this.biomeBlend < 1) {
      const prev = this.bio[Math.max(0, this.biomeIdx - 1)];
      draw(prev, 1 - this.biomeBlend);
    }
    draw(this.bio[this.biomeIdx], this.biomeBlend);
  },

  drawGround(ctx, W) {
    const bio = this.bio[this.biomeIdx];
    const def = BIOMES[this.biomeIdx];
    const y0 = GROUND;
    ctx.save();
    // Erde
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 260);
    g.addColorStop(0, def.ground.base);
    g.addColorStop(0.08, def.earth);
    g.addColorStop(1, "#3b2415");
    ctx.fillStyle = g;
    ctx.fillRect(this.camX - 200, y0, W + 800, 400);
    // Textur
    ctx.globalAlpha = 0.6;
    const pat = ctx.createPattern(bio.tile, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(this.camX - 200, y0 + 6, W + 800, 220);
    ctx.globalAlpha = 1;
    // Grasstreifen oben
    ctx.fillStyle = def.edge;
    ctx.beginPath();
    for (let x = this.camX - 200; x < this.camX + W + 800; x += 18) {
      ctx.lineTo(x, y0 + 4 + Math.sin(x * 0.07) * 3);
    }
    ctx.lineTo(this.camX + W + 800, y0 + 14);
    ctx.lineTo(this.camX - 200, y0 + 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawGroundObject(ctx, o) {
    if (o.x < this.camX - 200 || o.x > this.camX + this.VW + 200) return;
    if (o.kind === "tree") {
      const img = Assets.sprites[o.sprite];
      const a = o.tilt.x * 0.06 + Math.sin(this.t * 1.4 + o.phase) * 0.012;
      ctx.save();
      ctx.translate(o.x, GROUND);
      ctx.rotate(a);
      ctx.drawImage(img, -img.width / 2 + 0, -img.height + 8, img.width, img.height);
      ctx.restore();
    } else {
      const img = o.secret ? Assets.sprites.bush_secret : Assets.sprites.bush;
      const sq = o.spring.x;
      ctx.save();
      ctx.translate(o.x, 514 + img.height * 0.5);
      ctx.scale(1 - sq * 0.12, 1 + sq * 0.12);
      ctx.rotate(o.tilt.x * 0.05);
      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      if (o.secret && !o.used) {
        const k = (this.t * 0.8 + o.phase) % 1;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
        const sp = Assets.sprites.sparkle;
        ctx.drawImage(sp, -sp.width / 2 + 40, -sp.height / 2 - 30, sp.width * 0.6, sp.height * 0.6);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  },

  drawBread(ctx, o) {
    if (o.x < this.camX - 200 || o.x > this.camX + this.VW + 200) return;
    const img = Assets.sprites[o.sprite];
    const sq = o.spring.x;
    const sx = 1 - sq * 0.22, sy = 1 + sq * 0.22;
    const tilt = o.tilt.x * 0.2 + Math.sin(this.t * 1.2 + o.phase) * 0.05;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  },

  drawCatapult(ctx) {
    const style = Save.data.catapult || "wood";
    Catapult.draw(ctx, CAT_X, GROUND, { style, arm: this.arm.theta, t: this.t });
  },

  drawWoman(ctx) {
    const body = this.body;
    const skin = WOMAN_SKINS[Save.data.skin] || WOMAN_SKINS.classic;
    let pose = "idle";
    if (this.state === "ready") pose = "seat";
    else if (this.state === "flight") {
      if (body.grounded) pose = "idle";
      else if (this.hitT > 0) pose = "hit";
      else pose = body.vy < 0 ? "fly" : "fall";
    } else if (this.state === "end") pose = "cheer";
    const sq = this.body.squashKick || 0;
    this.body.squashKick = MathUtil.smooth(sq, 0, 9, 1 / 60);
    const sx = 1 + sq * 0.2 - (pose === "fly" ? 0.04 : 0);
    const sy = 1 - sq * 0.2 + (pose === "fly" ? 0.04 : 0);
    Woman.draw(ctx, body.x, body.y - 4, {
      skin, pose, t: this.t, angle: pose === "seat" ? 0 : body.angle,
      sx, sy, expr: this.state === "end" ? "happy" : undefined,
    });
    // Schatten am Boden
    if (this.state === "flight") {
      const h = Math.max(0, GROUND - body.y - 30);
      const s = MathUtil.clamp(1 - h / 900, 0.25, 1);
      ctx.fillStyle = `rgba(30,15,5,${0.22 * s})`;
      ctx.beginPath();
      ctx.ellipse(body.x, GROUND + 2, 34 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawAimPreview(ctx) {
    const seat = this.seatPos(this.arm.theta);
    const v = this.launchVelocity(this.aim.angle, MathUtil.clamp(this.aim.power, 0.05, 1));
    const pts = Physics.predictTrajectory(seat.x, seat.y, v.vx, v.vy, 80, 1 / 30);
    ctx.save();
    for (let i = 0; i < pts.length; i += 3) {
      const a = 0.85 * (1 - i / pts.length);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 4.2 - (i / pts.length) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,30,10,.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    // Zielanzeige (Winkel & Kraft)
    if (this.aim.dragging || this.aim.charging) {
      ctx.save();
      ctx.font = "900 20px 'Trebuchet MS', system-ui, sans-serif";
      ctx.textAlign = "center";
      const text = `${Math.round(this.aim.angle * 180 / Math.PI)}° · ${Math.round(this.aim.power * 100)} %`;
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(40,20,8,.8)";
      ctx.strokeText(text, seat.x, seat.y - 84);
      ctx.fillStyle = "#fff6d8";
      ctx.fillText(text, seat.x, seat.y - 84);
      ctx.restore();
    }
  },

  // Himmel-Licht & Vignette
  drawLighting(ctx, W, H, dusk) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(40,15,0,${0.28 + dusk * 0.12})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sonnenstrahlen von oben rechts
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const rg = ctx.createLinearGradient(W * 0.9, 0, W * 0.4, H);
    rg.addColorStop(0, "rgba(255,240,190,.45)");
    rg.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  mixColor(a, b, t) {
    const pa = this.hex(a), pb = this.hex(b);
    const r = Math.round(MathUtil.lerp(pa[0], pb[0], t));
    const g = Math.round(MathUtil.lerp(pa[1], pb[1], t));
    const bl = Math.round(MathUtil.lerp(pa[2], pb[2], t));
    return `rgb(${r},${g},${bl})`;
  },
  hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
};

const MATERIAL_NAMES = { bread: "Brot", baguette: "Baguette", toast: "Toast", giant: "Riesenbrot", golden: "Goldbrot", pine: "Pinie", oak: "Eiche", pista: "Pistazie", bush: "Busch", secret: "Geheimnis" };

// ==========================================================================
// Story-Sequenz (Canvas, animierte Figuren, Sprechblasen)
// ==========================================================================
class Story {
  constructor(game) {
    this.game = game;
    this.lines = [
      { who: "narr", text: "Ein gemütlicher Abend. Der Mann sitzt auf dem Sofa und stellt eine wichtige Frage." },
      { who: "man", text: "Sag mal, Schatz … wie heißt Brot eigentlich auf Persisch?", pose: "idle", expr: "neutral" },
      { who: "woman", text: "Radj!", pose: "cheer", expr: "smug", shout: true },
      { who: "man", text: "…Radj?", pose: "doubt", expr: "neutral" },
      { who: "woman", text: "Radj! Ganz sicher!", pose: "smug", expr: "smug" },
      { who: "narr", text: "Er glaubt ihr kein Wort. Also greift er zu dem einzig logischen Mittel." },
      { who: "man", text: "Dann beweis es doch. Mit einem Katapult!", pose: "point", expr: "smug" },
      { who: "woman", text: "WAAAS?!", pose: "fall", expr: "shock", shout: true },
      { who: "narr", text: "Ein Katapult, ein Ziel und ganz viel Brot. Mal sehen, wie weit sie fliegt!" },
    ];
    this.index = 0;
    this.typed = 0;        // Fortschritt 0..1 der aktuellen Zeile
    this.done = false;
    this.t = 0;
    this.shakeT = 0;
    this.endFade = false;
  }

  start() {
    this.index = 0;
    this.typed = 0;
    this.t = 0;
    this.done = false;
  }

  current() { return this.lines[this.index]; }

  advance() {
    if (this.done) return;
    const line = this.current();
    const total = line.text.length;
    if (this.typed < 1) { this.typed = 1; return; }
    this.index++;
    this.typed = 0;
    if (this.index >= this.lines.length) this.finish();
    else if (this.current().shout) this.shakeT = 0.5;
  }

  skipAll() {
    if (this.done) return;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.game.finishStory();
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    const line = this.current();
    if (line) {
      const speed = 38; // Zeichen pro Sekunde
      this.typed = Math.min(1, this.typed + (speed * dt) / Math.max(1, line.text.length));
    }
  }

  draw(ctx, W, H) {
    // Raum: warme Wand, Fenster mit Abendlicht, Holzboden
    const wall = ctx.createLinearGradient(0, 0, 0, 500);
    wall.addColorStop(0, "#7a3e2a");
    wall.addColorStop(1, "#c98a4e");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    // Fenster
    const fx = W * 0.6, fy = 90;
    const sky = ctx.createLinearGradient(0, fy, 0, fy + 220);
    sky.addColorStop(0, "#ffb070");
    sky.addColorStop(1, "#ffe6b0");
    ctx.fillStyle = sky;
    ctx.fillRect(fx, fy, 240, 220);
    Deco.sun(ctx, fx + 150, fy + 150, 28);
    ctx.strokeStyle = "#4a2612";
    ctx.lineWidth = 10;
    ctx.strokeRect(fx, fy, 240, 220);
    ctx.beginPath(); ctx.moveTo(fx + 120, fy); ctx.lineTo(fx + 120, fy + 220); ctx.stroke();

    // Bild an der Wand (Brot-Gemälde)
    const px = W * 0.14, py = 110;
    ctx.fillStyle = "#e6c48a";
    ctx.fillRect(px, py, 180, 130);
    ctx.strokeStyle = "#5a3416";
    ctx.lineWidth = 8;
    ctx.strokeRect(px, py, 180, 130);
    ctx.drawImage(Assets.sprites.bread_round, px + 30, py + 14, 120, 84);

    // Boden
    const floor = ctx.createLinearGradient(0, 480, 0, H);
    floor.addColorStop(0, "#6b3a1e");
    floor.addColorStop(1, "#3c1f0e");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 480, W, H - 480);
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 2;
    for (let y = 510; y < H; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Teppich
    ctx.fillStyle = "rgba(160,40,40,.7)";
    ctx.beginPath(); ctx.ellipse(W * 0.5, 590, W * 0.42, 52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,220,140,.6)"; ctx.lineWidth = 4; ctx.stroke();

    // Sofa (Mann sitzt)
    const shake = this.shakeT > 0 ? Math.sin(this.t * 60) * 4 * (this.shakeT / 0.5) : 0;
    const manX = W * 0.3, manY = 470, womX = W * 0.7, womY = 470;
    ctx.save();
    ctx.translate(shake, 0);
    const line = this.current() || {};
    const s = Math.min(1.9, Math.max(1.5, H / 420));
    const manPose = line.who === "man" ? line.pose : "idle";
    const manExpr = line.who === "man" ? line.expr : "neutral";
    Man.draw(ctx, manX, manY, { pose: manPose === "point" ? "point" : manPose === "doubt" ? "doubt" : manPose === "smug" ? "smug" : "idle", expr: manExpr, s, t: this.t });
    const womPose = line.who === "woman" ? line.pose : "idle";
    const womExpr = line.who === "woman" ? line.expr : "neutral";
    const skin = WOMAN_SKINS[Save.data.skin] || WOMAN_SKINS.classic;
    ctx.save();
    ctx.translate(womX, womY);
    ctx.scale(s, s);
    Woman.draw(ctx, 0, 0, { skin, pose: womPose === "cheer" ? "cheer" : womPose === "fall" ? "fall" : womPose === "smug" ? "idle" : "idle", expr: womExpr, t: this.t });
    ctx.restore();
    ctx.restore();

    // Sprechblase
    if (line.text) {
      const chars = line.text.slice(0, Math.floor(line.text.length * this.typed));
      const size = line.who === "narr" ? 26 : 30;
      if (line.who === "narr") {
        this.drawNarrator(ctx, W, H, line.text, this.typed);
      } else {
        const cx = line.who === "man" ? manX : womX;
        const cy = line.who === "man" ? manY - 68 * s : womY - 66 * s;
        Bubble.draw(ctx, cx, cy - 6, line.text, this.typed, { size, maxWidth: Math.min(520, W * 0.42), tailX: line.who === "man" ? 30 : -30 });
      }
    }

    // Weiter-Hinweis
    const blink = 0.5 + Math.sin(this.t * 4) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.6 + blink * 0.4;
    ctx.font = "700 18px 'Trebuchet MS', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff6e4";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 6;
    ctx.fillText("Klicken oder Leertaste zum Weiter", 20, H - 16);
    ctx.restore();
  }

  drawNarrator(ctx, W, H, text, progress) {
    const chars = text.slice(0, Math.floor(text.length * progress));
    ctx.save();
    const boxW = Math.min(W * 0.8, 880), boxH = 96;
    const bx = (W - boxW) / 2, by = 40;
    ctx.fillStyle = "rgba(24,12,6,.78)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, boxW, boxH, 16) : roundRectPath(ctx, bx, by, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(247,197,72,.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "italic 600 24px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#fff3d2";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lines = Bubble.wrap(ctx, chars, boxW - 40);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, bx + 20, by + boxH / 2 - (lines.length - 1) * 16 + i * 32));
    ctx.restore();
  }
}

// ---------- Start ----------
window.addEventListener("DOMContentLoaded", () => {
  Game.init();
});

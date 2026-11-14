/* ==========================================================================
   ui.js – Fortschritt (localStorage), Shop, Verbesserungen, Erfolge,
   Statistik, Einstellungen und alle DOM-Menüs.
   ========================================================================== */

// ---------- Spieldaten ----------
const UPGRADES = [
  { id: "power",  name: "Katapultkraft",        desc: "Mehr Abschussgeschwindigkeit.",          max: 5, base: 120 },
  { id: "start",  name: "Startgeschwindigkeit", desc: "Zusätzlicher Vortrieb direkt beim Start.", max: 5, base: 110 },
  { id: "bounce", name: "Bounce-Stärke",        desc: "Brote und Bäume federn kräftiger.",      max: 5, base: 150 },
  { id: "flight", name: "Flugkontrolle",        desc: "Halten zum Aufsteigen während des Flugs.", max: 5, base: 130 },
  { id: "magnet", name: "Spezial: Magnet",      desc: "Zieht Münzen aus der Umgebung an.",       max: 3, base: 260 },
];

const CATAPULTS = [
  { id: "wood", name: "Holzkatapult", price: 0,    power: 1.00, desc: "Der Klassiker aus dem Hinterhof." },
  { id: "iron", name: "Eisenkatapult", price: 600,  power: 1.18, desc: "Schwer, stabil, mit blauem Schimmer." },
  { id: "gold", name: "Goldkatapult", price: 2000, power: 1.40, desc: "Für Leute, die es richtig krachen lassen." },
];

const SKIN_LIST = [
  { id: "classic",  name: "Klassisch", price: 0,   desc: "Rotes Kleid, gelbes Kopftuch." },
  { id: "blue",     name: "Azur",      price: 250, desc: "Blaues Kleid, weißer Schal." },
  { id: "festlich", name: "Festlich",  price: 500, desc: "Grün mit goldenem Schal." },
];

const ACHIEVEMENTS = [
  { id: "first",    name: "Erster Flug",        desc: "Absolviere deine erste Runde.",      test: s => s.games >= 1 },
  { id: "d100",     name: "Hundert Meter",      desc: "Erreiche 100 m Distanz.",            test: s => s.best >= 100 },
  { id: "d500",     name: "Fernflieger",        desc: "Erreiche 500 m Distanz.",            test: s => s.best >= 500 },
  { id: "d1000",    name: "Brot-Legende",       desc: "Erreiche 1000 m Distanz.",           test: s => s.best >= 1000 },
  { id: "gold",     name: "Goldhände",          desc: "Triff ein goldenes Brot.",           test: s => s.golden >= 1 },
  { id: "secret",   name: "Geheimnisvoll",      desc: "Finde ein verstecktes Objekt.",      test: s => s.secret >= 1 },
  { id: "bounce50", name: "Bounce-Meister",     desc: "Sammle 50 Aufpralle insgesamt.",     test: s => s.totalBounces >= 50 },
  { id: "coins",    name: "Münzsammler",        desc: "Verdiene insgesamt 1000 Coins.",     test: s => s.totalCoins >= 1000 },
  { id: "biome",    name: "Weltreisende",       desc: "Erreiche die Berglandschaft.",       test: s => s.maxBiome >= 2 },
  { id: "engineer", name: "Ingenieur",          desc: "Maximiere eine Verbesserung.",       test: s => s.maxUpgradeReached },
];

const SAVE_KEY = "radj_brotkatapult_v1";

// ---------- Speicherung ----------
const Save = {
  data: null,
  defaults() {
    return {
      coins: 0,
      best: 0,
      games: 0,
      totalCoins: 0,
      totalBounces: 0,
      totalDistance: 0,
      golden: 0,
      secret: 0,
      maxSpeed: 0,
      maxBiome: 0,
      upgrades: { power: 0, start: 0, bounce: 0, flight: 0, magnet: 0 },
      catapult: "wood",
      skin: "classic",
      ownedCatapults: ["wood"],
      ownedSkins: ["classic"],
      achievements: [],
      settings: { music: true, sfx: true, volume: 80, shake: true },
    };
  },
  load() {
    let d = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) d = JSON.parse(raw);
    } catch (e) { d = null; }
    const base = this.defaults();
    this.data = Object.assign(base, d || {});
    this.data.upgrades = Object.assign(base.upgrades, (d && d.upgrades) || {});
    this.data.settings = Object.assign(base.settings, (d && d.settings) || {});
    return this.data;
  },
  write() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* Speicher nicht verfügbar */ }
  },
  reset() {
    this.data = this.defaults();
    this.write();
  },
  // Upgrade-Kosten: steigen mit Stufe
  upgradeCost(u) {
    const lvl = this.data.upgrades[u.id];
    return Math.round(u.base * (lvl + 1) * (1 + lvl * 0.35));
  },
  upgradeLevel(id) { return this.data.upgrades[id] || 0; },
  upgradeEffect(id) {
    const lvl = this.upgradeLevel(id);
    switch (id) {
      case "power": return 1 + 0.08 * lvl;
      case "start": return 30 * lvl;
      case "bounce": return 1 + 0.05 * lvl;
      case "flight": return lvl ? 220 + 90 * lvl : 0;
      case "magnet": return [0, 90, 150, 220][lvl];
    }
    return 0;
  },
  catapultPower() {
    const c = CATAPULTS.find(c => c.id === this.data.catapult) || CATAPULTS[0];
    return c.power;
  },
  unlockAchievements() {
    const newly = [];
    const s = this.data;
    const maxUp = UPGRADES.some(u => s.upgrades[u.id] >= u.max);
    const stats = Object.assign({}, s, { maxUpgradeReached: maxUp });
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements.includes(a.id) && a.test(stats)) {
        s.achievements.push(a.id);
        newly.push(a);
      }
    }
    return newly;
  },
  // Kauf/Equip-Helfer
  buy(kind, id) {
    const d = this.data;
    const list = kind === "catapult" ? CATAPULTS : SKIN_LIST;
    const item = list.find(i => i.id === id);
    const owned = kind === "catapult" ? d.ownedCatapults : d.ownedSkins;
    if (!item || owned.includes(id)) return false;
    if (d.coins < item.price) return false;
    d.coins -= item.price;
    owned.push(id);
    this.write();
    return true;
  },
  equip(kind, id) {
    if (kind === "catapult") this.data.catapult = id;
    else this.data.skin = id;
    this.write();
  },
};

// ---------- Icons (Canvas) ----------
function makeIcon(kind, id) {
  const c = document.createElement("canvas");
  c.width = 104; c.height = 104;
  const x = c.getContext("2d");
  x.translate(52, 56);
  if (kind === "catapult") {
    x.scale(0.26, 0.26);
    x.translate(0, 120);
    Catapult.draw(x, 0, 0, { style: id, arm: -0.5 });
  } else {
    x.scale(0.8, 0.8);
    Woman.draw(x, 0, -6, { skin: WOMAN_SKINS[id], pose: "idle", t: 1.3 });
  }
  return c;
}

// ---------- Menü-Bühne (animiert) ----------
const MenuStage = {
  t: 0,
  bread: null,
  tick(dt, w, h) {
    this.t += dt;
  },
  draw(ctx, w, h, save) {
    ctx.clearRect(0, 0, w, h);
    const t = this.t;
    const sx = w / 640, sy = h / 260;
    ctx.save();
    ctx.scale(sx, sy);
    // Hintergrund-Bogen
    const g = ctx.createRadialGradient(320, 150, 20, 320, 150, 260);
    g.addColorStop(0, "rgba(255,255,255,.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 260);
    // Boden
    ctx.fillStyle = "rgba(90,40,10,.25)";
    ctx.beginPath(); ctx.ellipse(320, 236, 260, 14, 0, 0, Math.PI * 2); ctx.fill();

    const cat = CATAPULTS.find(c => c.id === save.data.catapult) || CATAPULTS[0];
    const skin = WOMAN_SKINS[save.data.skin] || WOMAN_SKINS.classic;
    // Katapult, Arm wippt leicht
    const arm = -0.55 + Math.sin(t * 1.4) * 0.05;
    ctx.save();
    ctx.translate(180, 0);
    ctx.scale(0.95, 0.95);
    ctx.translate(0, 0);
    Catapult.draw(ctx, 0, 236, { style: cat.id, arm, t });
    ctx.restore();
    // Frau sitzt in der Schale
    Woman.draw(ctx, 180 + Math.sin(t * 4) * 0, 150 + Math.sin(t * 2.2) * 2, { skin, pose: "seat", t, angle: Math.sin(t * 2) * 0.03 });

    // Fliegendes Brot (Schwebe-Animation)
    const bx = 470 + Math.sin(t * 1.1) * 14;
    const by = 62 + Math.cos(t * 1.7) * 14;
    const rot = Math.sin(t * 1.3) * 0.35;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.drawImage(Assets.sprites.bread_round, -Assets.sprites.bread_round.width * .3, -Assets.sprites.bread_round.height * .3, Assets.sprites.bread_round.width * .6, Assets.sprites.bread_round.height * .6);
    ctx.restore();
    // Goldenes Brot
    const gx = 530 + Math.cos(t * 1.4) * 10, gy = 170 + Math.sin(t * 2) * 8;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(Math.cos(t * 2) * 0.2);
    ctx.drawImage(Assets.sprites.bread_golden, -Assets.sprites.bread_golden.width * .3, -Assets.sprites.bread_golden.height * .3, Assets.sprites.bread_golden.width * .6, Assets.sprites.bread_golden.height * .6);
    ctx.restore();
    // Sparkles
    const sp = Assets.sprites.sparkle;
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.7 + i * 0.25) % 1;
      const px = 380 + i * 50, py = 40 + Math.sin(i * 2 + t) * 20;
      ctx.globalAlpha = Math.sin(k * Math.PI) * .9;
      ctx.drawImage(sp, px - 14, py - 14, 28, 28);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },
};

// ---------- UI-Controller ----------
const UI = {
  screens: {},
  current: "screenMenu",
  onAction: null,
  tab: "catapults",

  init(onAction) {
    this.onAction = onAction;
    this.screens = {
      screenMenu: document.getElementById("screenMenu"),
      screenShop: document.getElementById("screenShop"),
      screenUpgrades: document.getElementById("screenUpgrades"),
      screenAchievements: document.getElementById("screenAchievements"),
      screenStats: document.getElementById("screenStats"),
      screenSettings: document.getElementById("screenSettings"),
      screenPause: document.getElementById("screenPause"),
      screenResult: document.getElementById("screenResult"),
    };

    document.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        Audio.ensure();
        Audio.click();
        this.onAction(btn.dataset.action);
      });
      btn.addEventListener("pointerenter", () => { if (window.matchMedia("(hover: hover)").matches) Audio.hover(); });
    });
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        Audio.ensure();
        Audio.click();
        this.tab = tab.dataset.tab;
        document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
        this.renderShop();
      });
    });

    // Einstellungen
    const s = Save.data.settings;
    const bind = (id, key, apply) => {
      const el = document.getElementById(id);
      if (el.type === "checkbox") el.checked = !!s[key];
      else el.value = s[key];
      el.addEventListener("change", () => {
        Audio.ensure();
        s[key] = el.type === "checkbox" ? el.checked : Number(el.value);
        Save.write();
        if (apply) apply(s[key]);
      });
    };
    bind("optMusic", "music", v => Audio.setMusic(v));
    bind("optSfx", "sfx", v => Audio.setSfx(v));
    bind("optShake", "shake", v => Camera.shakeEnabled = v);
    bind("optVolume", "volume", v => Audio.setVolume(v / 100));
    Camera.shakeEnabled = s.shake;

    document.getElementById("btnReset").addEventListener("click", () => {
      if (!confirm("Wirklich den gesamten Fortschritt zurücksetzen?")) return;
      const settings = Save.data.settings;
      Save.reset();
      Save.data.settings = settings;
      Save.write();
      this.refreshMenu();
      this.renderAll();
      this.toast("Fortschritt zurückgesetzt");
    });
  },

  // Zeigt genau diesen Screen (alle anderen werden ausgeblendet)
  show(id) {
    Object.values(this.screens).forEach(el => el.classList.remove("active"));
    this.current = id;
    const el = this.screens[id] || document.getElementById(id);
    if (el) el.classList.add("active");
    this.renderFor(id);
  },

  // Blendet ein Overlay ein, ohne andere Screens zu verdecken
  overlay(id) {
    const el = this.screens[id] || document.getElementById(id);
    if (el) el.classList.add("active");
  },

  hide(id) {
    const el = this.screens[id] || document.getElementById(id);
    if (el) el.classList.remove("active");
  },

  renderFor(id) {
    if (id === "screenShop") this.renderShop();
    if (id === "screenUpgrades") this.renderUpgrades();
    if (id === "screenAchievements") this.renderAchievements();
    if (id === "screenStats") this.renderStats();
    if (id === "screenMenu") this.refreshMenu();
  },

  renderAll() {
    this.renderShop();
    this.renderUpgrades();
    this.renderAchievements();
    this.renderStats();
  },

  refreshMenu() {
    document.getElementById("menuCoins").textContent = Save.data.coins;
    document.getElementById("menuRecord").textContent = `${Save.data.best} m`;
  },

  // Itemliste erzeugen
  renderShop() {
    const list = document.getElementById("shopList");
    document.getElementById("shopCoins").textContent = Save.data.coins;
    list.innerHTML = "";
    const isCat = this.tab === "catapults";
    const items = isCat ? CATAPULTS : SKIN_LIST;
    const owned = isCat ? Save.data.ownedCatapults : Save.data.ownedSkins;
    const equipped = isCat ? Save.data.catapult : Save.data.skin;
    for (const it of items) {
      const isOwned = owned.includes(it.id);
      const isEq = equipped === it.id;
      const row = document.createElement("div");
      row.className = "item" + (isEq ? " equipped" : "") + (!isOwned ? " locked" : "");
      const icon = document.createElement("div");
      icon.className = "item-icon";
      icon.appendChild(makeIcon(isCat ? "catapult" : "skin", it.id));
      const info = document.createElement("div");
      const extra = isCat ? `Kraft ×${it.power.toFixed(2)}` : "";
      info.innerHTML = `<div class="item-title">${it.name}</div><div class="item-desc">${it.desc}${extra ? " · " + extra : ""}</div>`;
      const btn = document.createElement("button");
      btn.className = "item-action";
      if (isEq) { btn.textContent = "Angelegt"; btn.classList.add("done"); btn.disabled = true; }
      else if (isOwned) { btn.textContent = "Anlegen"; btn.classList.add("equip"); btn.onclick = () => this.act(() => Save.equip(isCat ? "catapult" : "skin", it.id), "Ausgerüstet"); }
      else {
        btn.innerHTML = `<span class="item-coin"><span class="hud-coin"></span>${it.price}</span>`;
        btn.classList.add("buy");
        btn.disabled = Save.data.coins < it.price;
        btn.onclick = () => {
          if (Save.buy(isCat ? "catapult" : "skin", it.id)) {
            Audio.coin(4);
            this.act(() => Save.equip(isCat ? "catapult" : "skin", it.id), `${it.name} gekauft`);
          } else {
            this.toast("Nicht genug Coins");
          }
        };
      }
      row.append(icon, info, btn);
      list.appendChild(row);
    }
  },

  act(fn, msg) {
    fn();
    this.renderAll();
    this.refreshMenu();
    if (msg) this.toast(msg);
  },

  renderUpgrades() {
    const list = document.getElementById("upgradeList");
    document.getElementById("upgCoins").textContent = Save.data.coins;
    list.innerHTML = "";
    for (const u of UPGRADES) {
      const lvl = Save.upgradeLevel(u.id);
      const maxed = lvl >= u.max;
      const row = document.createElement("div");
      row.className = "item" + (maxed ? " achieved" : "");
      const icon = document.createElement("div");
      icon.className = "item-icon";
      icon.innerHTML = `<span style="font-size:28px;color:#8a4a1b;font-weight:900">${u.name[0]}</span>`;
      const info = document.createElement("div");
      info.innerHTML = `<div class="item-title">${u.name} <small style="color:#8a4a1b">Stufe ${lvl}/${u.max}</small></div>
        <div class="item-desc">${u.desc}</div>
        <div class="item-bar"><i style="width:${(lvl / u.max) * 100}%"></i></div>`;
      const btn = document.createElement("button");
      btn.className = "item-action";
      if (maxed) { btn.textContent = "Max"; btn.classList.add("done"); btn.disabled = true; }
      else {
        const cost = Save.upgradeCost(u);
        btn.innerHTML = `<span class="item-coin"><span class="hud-coin"></span>${cost}</span>`;
        btn.classList.add("buy");
        btn.disabled = Save.data.coins < cost;
        btn.onclick = () => {
          if (Save.data.coins < cost) return;
          Save.data.coins -= cost;
          Save.data.upgrades[u.id] = lvl + 1;
          Save.write();
          Audio.coin(lvl);
          this.act(() => {}, `${u.name} auf Stufe ${lvl + 1}`);
          this.renderUpgrades();
        };
      }
      row.append(icon, info, btn);
      list.appendChild(row);
    }
  },

  renderAchievements() {
    const list = document.getElementById("achList");
    list.innerHTML = "";
    const got = Save.data.achievements;
    document.getElementById("achCount").textContent = `${got.length}/${ACHIEVEMENTS.length}`;
    for (const a of ACHIEVEMENTS) {
      const done = got.includes(a.id);
      const row = document.createElement("div");
      row.className = "item" + (done ? " achieved" : " locked");
      const icon = document.createElement("div");
      icon.className = "item-icon";
      icon.innerHTML = `<span style="font-size:26px;font-weight:900;color:${done ? "#8a4a1b" : "#b9a88c"}">${done ? "★" : "?"}</span>`;
      const info = document.createElement("div");
      info.innerHTML = `<div class="item-title">${done ? a.name : "Geheimer Erfolg"}</div><div class="item-desc">${done ? a.desc : "Noch nicht freigeschaltet."}</div>`;
      const badge = document.createElement("div");
      badge.className = "badge-check";
      badge.textContent = done ? "Erreicht" : "";
      row.append(icon, info, badge);
      list.appendChild(row);
    }
  },

  renderStats() {
    const s = Save.data;
    const cards = [
      ["Beste Distanz", `${s.best} m`],
      ["Runden gespielt", s.games],
      ["Gesamtdistanz", `${Math.round(s.totalDistance)} m`],
      ["Coins verdient", s.totalCoins],
      ["Aufpralle", s.totalBounces],
      ["Goldene Brote", s.golden],
      ["Versteckte Funde", s.secret],
      ["Höchstes Tempo", `${Math.round(s.maxSpeed)} km/h`],
    ];
    document.getElementById("statsList").innerHTML = cards
      .map(([k, v]) => `<div class="stat-card"><span>${k}</span><strong>${v}</strong></div>`).join("");
  },

  // ---------- HUD ----------
  setHud(visible) { document.getElementById("hud").classList.toggle("hidden", !visible); },
  updateHud(distance, speed, coins, record) {
    document.getElementById("hudDistance").textContent = Math.floor(distance);
    document.getElementById("hudSpeed").textContent = Math.round(speed);
    document.getElementById("hudCoins").textContent = coins;
    document.getElementById("hudRecord").textContent = record;
  },
  flashHint(id) {
    const el = document.getElementById(id);
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  },
  hideHint(id) { document.getElementById(id).classList.add("hidden"); },
  bounceLabel(text) {
    const el = document.getElementById("hudBounce");
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    clearTimeout(this._bt);
    this._bt = setTimeout(() => el.classList.add("hidden"), 1300);
  },

  // Erfolgs-/Hinweis-Toast
  toast(text, trophy = false) {
    const host = document.getElementById("toastHost");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (trophy ? `<span class="toast-trophy">★</span>` : "") + `<span></span>`;
    el.lastChild.textContent = text;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  },

  // Rundenende füllen
  showResult(r) {
    document.getElementById("resDistance").textContent = r.distance;
    document.getElementById("resCoins").textContent = r.coins;
    document.getElementById("resBounces").textContent = r.bounces;
    document.getElementById("resSpeed").textContent = `${Math.round(r.maxSpeed)} km/h`;
    document.getElementById("resGolden").textContent = r.golden;
    document.getElementById("resultTag").textContent = r.tag;
    document.getElementById("resRecord").classList.toggle("hidden", !r.newRecord);
  },

  // Platzhalter für animierte Menüszene
  tickMenu(dt) { MenuStage.tick(dt); },
  drawMenu(ctx, w, h) { MenuStage.draw(ctx, w, h, Save); },
};

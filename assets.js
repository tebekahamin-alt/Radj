/* ==========================================================================
   assets.js – Grafiken per Canvas erzeugt (transparente Sprites)
   Einheitlicher Artstyle: Licht von oben links, dunkle warme Konturen,
   weiche Verläufe, Schattenkanten. Alle Sprites werden einmal gerendert
   und danach nur noch gezeichnet (Performance).
   ========================================================================== */

const OUTLINE = "#3a2014";

const Assets = {
  sprites: {},
  ready: false,

  init() {
    const s = this.sprites;
    s.bread_round = this.drawRoundBread(170, 118, { base: "#e0a24b", dark: "#a8602a", light: "#f6cd82", seeds: false });
    s.bread_giant = this.drawRoundBread(300, 214, { base: "#d88e3c", dark: "#97521f", light: "#f3c477", seeds: true });
    s.bread_baguette = this.drawBaguette();
    s.bread_toast = this.drawToast();
    s.bread_golden = this.drawRoundBread(150, 104, { base: "#f7c548", dark: "#b9770f", light: "#fff3b0", seeds: false, golden: true });
    s.bush = this.drawBush();
    s.bush_secret = this.drawBush(true);
    s.tree_pine = this.drawTree("pine");
    s.tree_oak = this.drawTree("oak");
    s.tree_pista = this.drawTree("pista");
    s.coin = this.drawCoin();
    s.sparkle = this.drawSparkle();
    s.cloud = [this.drawCloud(1), this.drawCloud(2), this.drawCloud(3)];
    s.crumbs = [0, 1, 2, 3].map(i => this.drawCrumb(i));
    s.ui_bread_icon = s.bread_round;
    this.ready = true;
    return this;
  },

  make(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  },

  // Warmer Schatten/Lichtverlauf mit Konturen
  outline(ctx, w = 3) {
    ctx.lineWidth = w;
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = "round";
    ctx.stroke();
  },

  // ---------- Brote ----------
  drawRoundBread(w, h, o) {
    const c = this.make(w + 16, h + 16);
    const x = c.getContext("2d");
    const cx = c.width / 2, cy = c.height / 2;

    // Bodenschatten
    x.save();
    x.fillStyle = "rgba(40,15,0,.22)";
    x.beginPath();
    x.ellipse(cx + 4, cy + h / 2 - 2, w * .42, h * .09, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();

    // Körper
    x.beginPath();
    x.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    const g = x.createRadialGradient(cx - w * .18, cy - h * .25, h * .05, cx, cy, w * .6);
    g.addColorStop(0, o.light);
    g.addColorStop(.45, o.base);
    g.addColorStop(1, o.dark);
    x.fillStyle = g;
    x.fill();
    this.outline(x, 3.5);

    // Krustenrand (innen)
    x.beginPath();
    x.ellipse(cx, cy, w / 2 - 9, h / 2 - 9, 0, Math.PI * .9, Math.PI * 2.05);
    x.strokeStyle = "rgba(90,40,10,.35)";
    x.lineWidth = 5;
    x.stroke();

    // Einschnitte (Sangak-Muster)
    x.strokeStyle = o.dark;
    x.lineWidth = 3;
    x.lineCap = "round";
    const cuts = o.seeds ? 5 : 3;
    for (let i = 0; i < cuts; i++) {
      const t = (i + 1) / (cuts + 1);
      const px = cx - w * .28 + t * w * .56;
      x.beginPath();
      x.moveTo(px - 10, cy - h * .12 + (i % 2) * 6);
      x.quadraticCurveTo(px, cy - h * .3, px + 14, cy - h * .08);
      x.stroke();
    }

    // Highlight
    x.beginPath();
    x.ellipse(cx - w * .18, cy - h * .24, w * .16, h * .08, -.3, 0, Math.PI * 2);
    x.fillStyle = "rgba(255,250,230,.55)";
    x.fill();

    // Sesam/Mehl-Tupfer
    const seedN = o.seeds ? 28 : 12;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < seedN; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * .8;
      const sx = cx + Math.cos(a) * (w / 2) * r * .78;
      const sy = cy + Math.sin(a) * (h / 2) * r * .72 + h * .05;
      x.beginPath();
      x.ellipse(sx, sy, 3.2, 1.8, a, 0, Math.PI * 2);
      x.fillStyle = o.golden ? "#fff8d6" : "rgba(255,240,200,.85)";
      x.fill();
    }

    if (o.golden) {
      // Glanz-Spots
      for (let i = 0; i < 3; i++) {
        x.beginPath();
        x.arc(cx - w * .25 + i * w * .25, cy - h * .18, 4, 0, Math.PI * 2);
        x.fillStyle = "#ffffff";
        x.fill();
      }
      const glow = x.createRadialGradient(cx, cy, w * .4, cx, cy, w * .7);
      glow.addColorStop(0, "rgba(255,240,140,0)");
      glow.addColorStop(1, "rgba(255,230,100,.0)");
      x.fillStyle = glow;
      x.fillRect(0, 0, c.width, c.height);
    }
    return c;
  },

  drawBaguette() {
    const w = 230, h = 74;
    const c = this.make(w + 16, h + 20);
    const x = c.getContext("2d");
    const cx = c.width / 2, cy = c.height / 2;
    x.fillStyle = "rgba(40,15,0,.22)";
    x.beginPath();
    x.ellipse(cx + 4, cy + h / 2 + 2, w * .42, 6, 0, 0, Math.PI * 2);
    x.fill();

    x.beginPath();
    x.moveTo(cx - w / 2 + 14, cy - h / 2 + 6);
    x.quadraticCurveTo(cx, cy - h / 2 - 8, cx + w / 2 - 14, cy - h / 2 + 6);
    x.quadraticCurveTo(cx + w / 2 + 4, cy, cx + w / 2 - 14, cy + h / 2 - 6);
    x.quadraticCurveTo(cx, cy + h / 2 + 8, cx - w / 2 + 14, cy + h / 2 - 6);
    x.quadraticCurveTo(cx - w / 2 - 4, cy, cx - w / 2 + 14, cy - h / 2 + 6);
    x.closePath();
    const g = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, "#f7d28a");
    g.addColorStop(.5, "#d68d3d");
    g.addColorStop(1, "#9a5420");
    x.fillStyle = g;
    x.fill();
    this.outline(x, 3.5);

    // Schnitte
    x.strokeStyle = "#f7e2aa";
    x.lineWidth = 4;
    x.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const px = cx - w * .3 + i * w * .19;
      x.beginPath();
      x.moveTo(px, cy - 10);
      x.lineTo(px + 16, cy - 20);
      x.stroke();
    }
    x.beginPath();
    x.ellipse(cx, cy - h * .2, w * .36, h * .08, 0, 0, Math.PI * 2);
    x.fillStyle = "rgba(255,250,225,.45)";
    x.fill();
    return c;
  },

  drawToast() {
    const w = 96, h = 100;
    const c = this.make(w + 16, h + 16);
    const x = c.getContext("2d");
    const cx = c.width / 2, top = 8, left = cx - w / 2, bottom = top + h;
    x.fillStyle = "rgba(40,15,0,.2)";
    x.beginPath();
    x.ellipse(cx + 3, bottom + 2, w * .4, 5, 0, 0, Math.PI * 2);
    x.fill();

    const path = () => {
      x.beginPath();
      x.moveTo(left, bottom - 10);
      x.lineTo(left, top + 30);
      x.bezierCurveTo(left, top + 6, left + 14, top, cx, top);
      x.bezierCurveTo(cx + w / 2 - 14 + 14, top, left + w, top + 6, left + w, top + 30);
      x.lineTo(left + w, bottom - 10);
      x.quadraticCurveTo(left + w, bottom, left + w - 10, bottom);
      x.lineTo(left + 10, bottom);
      x.quadraticCurveTo(left, bottom, left, bottom - 10);
      x.closePath();
    };
    path();
    const g = x.createLinearGradient(left, top, left + w, bottom);
    g.addColorStop(0, "#f9e6b4");
    g.addColorStop(1, "#e4b26a");
    x.fillStyle = g;
    x.fill();
    // Kruste
    path();
    x.save();
    x.clip();
    x.lineWidth = 9;
    x.strokeStyle = "#b8702e";
    x.stroke();
    x.restore();
    path();
    this.outline(x, 3.5);
    // Porenmuster
    x.fillStyle = "rgba(160,100,40,.35)";
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.arc(left + 18 + (i % 3) * 22, top + 28 + Math.floor(i / 3) * 20 + (i % 2) * 4, 2.2, 0, Math.PI * 2);
      x.fill();
    }
    return c;
  },

  // ---------- Büsche & Bäume ----------
  drawBush(secret = false) {
    const w = 130, h = 92;
    const c = this.make(w, h);
    const x = c.getContext("2d");
    const cx = w / 2, by = h - 6;
    x.fillStyle = "rgba(20,30,10,.25)";
    x.beginPath(); x.ellipse(cx, by + 2, w * .42, 6, 0, 0, Math.PI * 2); x.fill();
    const blobs = [[cx - 34, by - 30, 30], [cx, by - 40, 38], [cx + 34, by - 28, 30], [cx - 12, by - 18, 26], [cx + 18, by - 16, 24]];
    for (const [bx, byy, r] of blobs) {
      const g = x.createRadialGradient(bx - r * .3, byy - r * .35, 2, bx, byy, r);
      g.addColorStop(0, secret ? "#b8e28a" : "#8fd06a");
      g.addColorStop(1, secret ? "#3f8a3b" : "#2f7a3a");
      x.beginPath(); x.arc(bx, byy, r, 0, Math.PI * 2);
      x.fillStyle = g; x.fill();
      this.outline(x, 3);
    }
    // Blüten / Geheimnis-Glitzern
    const dots = secret ? 9 : 5;
    for (let i = 0; i < dots; i++) {
      const a = i * 2.4;
      x.beginPath();
      x.arc(cx + Math.cos(a) * 36, by - 40 + Math.sin(a * 1.7) * 24, 3, 0, Math.PI * 2);
      x.fillStyle = secret ? "#fff3a0" : "#ffd6e7";
      x.fill();
    }
    return c;
  },

  drawTree(kind) {
    const w = 240, h = 320;
    const c = this.make(w, h);
    const x = c.getContext("2d");
    const cx = w / 2, base = h - 8;
    // Schatten
    x.fillStyle = "rgba(20,30,10,.28)";
    x.beginPath(); x.ellipse(cx + 6, base, 72, 10, 0, 0, Math.PI * 2); x.fill();

    // Stamm
    const trunkW = kind === "pine" ? 16 : 22;
    const tg = x.createLinearGradient(cx - trunkW, 0, cx + trunkW, 0);
    tg.addColorStop(0, "#7a4a24"); tg.addColorStop(.5, "#a86a3a"); tg.addColorStop(1, "#5c3517");
    x.fillStyle = tg;
    x.beginPath();
    x.roundRect ? x.roundRect(cx - trunkW / 2, base - 120, trunkW, 124, 6) : x.rect(cx - trunkW / 2, base - 120, trunkW, 124);
    x.fill();
    this.outline(x, 3);

    if (kind === "pine") {
      // Schichten einer Pinie / Zypresse
      const tiers = [[cx, 36, 110, 140], [cx, 90, 98, 110], [cx, 140, 86, 100], [cx, 186, 72, 92]];
      tiers.forEach(([tx, ty, tw, th], i) => {
        const g = x.createLinearGradient(tx - tw, ty - th, tx + tw, ty);
        g.addColorStop(0, "#5fbf7a");
        g.addColorStop(1, "#1f6b48");
        x.beginPath();
        x.moveTo(tx, ty - th + 20);
        x.quadraticCurveTo(tx + tw * .6, ty - th * .2, tx + tw, ty);
        x.quadraticCurveTo(tx, ty + 16, tx - tw, ty);
        x.quadraticCurveTo(tx - tw * .6, ty - th * .2, tx, ty - th + 20);
        x.closePath();
        x.fillStyle = g; x.fill();
        this.outline(x, 3);
      });
      // Zapfen-Highlights
      x.fillStyle = "rgba(200,255,200,.22)";
      x.beginPath(); x.ellipse(cx - 30, 70, 18, 8, -.6, 0, Math.PI * 2); x.fill();
    } else if (kind === "oak") {
      // Ausladende Krone aus Blobs
      const blobs = [[cx - 62, 116, 54], [cx + 60, 118, 54], [cx, 84, 62], [cx - 40, 160, 50], [cx + 42, 160, 48], [cx, 124, 66]];
      for (const [bx, by, r] of blobs) {
        const g = x.createRadialGradient(bx - r * .35, by - r * .4, 6, bx, by, r);
        g.addColorStop(0, "#9ee07d"); g.addColorStop(.6, "#4fa052"); g.addColorStop(1, "#2a6a3a");
        x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fillStyle = g; x.fill();
        this.outline(x, 3);
      }
      x.fillStyle = "rgba(230,255,190,.28)";
      x.beginPath(); x.ellipse(cx - 40, 60, 26, 12, -.4, 0, Math.PI * 2); x.fill();
    } else {
      // Pistazie: lockere, helle Krone mit roten Früchten
      const blobs = [[cx - 52, 120, 48], [cx + 52, 116, 48], [cx, 72, 64], [cx, 150, 56]];
      for (const [bx, by, r] of blobs) {
        const g = x.createRadialGradient(bx - r * .35, by - r * .4, 6, bx, by, r);
        g.addColorStop(0, "#c9e88a"); g.addColorStop(.6, "#7fb35a"); g.addColorStop(1, "#4a7a3a");
        x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fillStyle = g; x.fill();
        this.outline(x, 3);
      }
      const fruits = [[cx - 30, 100], [cx + 14, 92], [cx + 40, 130], [cx - 14, 136], [cx + 2, 60]];
      for (const [fx, fy] of fruits) {
        x.beginPath(); x.arc(fx, fy, 6, 0, Math.PI * 2);
        x.fillStyle = "#d0403a"; x.fill();
        x.lineWidth = 1.5; x.strokeStyle = OUTLINE; x.stroke();
      }
    }
    return c;
  },

  // ---------- Münzen, Effekte ----------
  drawCoin() {
    const s = 44;
    const c = this.make(s, s);
    const x = c.getContext("2d");
    const cx = s / 2;
    const g = x.createRadialGradient(cx - 6, cx - 8, 2, cx, cx, cx);
    g.addColorStop(0, "#fff8cf");
    g.addColorStop(.4, "#ffd84a");
    g.addColorStop(1, "#b97b10");
    x.beginPath(); x.arc(cx, cx, cx - 3, 0, Math.PI * 2);
    x.fillStyle = g; x.fill();
    this.outline(x, 2.5);
    // Prägung: Weizenähre
    x.beginPath(); x.arc(cx, cx, cx - 9, 0, Math.PI * 2);
    x.strokeStyle = "rgba(150,90,10,.7)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#a8650c";
    x.beginPath(); x.ellipse(cx, cx, 4.5, 8, 0, 0, Math.PI * 2); x.fill();
    return c;
  },

  drawSparkle() {
    const s = 64;
    const c = this.make(s, s);
    const x = c.getContext("2d");
    const cx = s / 2;
    const g = x.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(.25, "rgba(255,240,160,.9)");
    g.addColorStop(1, "rgba(255,200,60,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    x.fillStyle = "#fffdf0";
    x.beginPath();
    x.moveTo(cx, 2); x.quadraticCurveTo(cx + 3, cx - 3, s - 2, cx);
    x.quadraticCurveTo(cx + 3, cx + 3, cx, s - 2);
    x.quadraticCurveTo(cx - 3, cx + 3, 2, cx);
    x.quadraticCurveTo(cx - 3, cx - 3, cx, 2);
    x.fill();
    return c;
  },

  drawCrumb(seed) {
    const s = 14;
    const c = this.make(s, s);
    const x = c.getContext("2d");
    const shades = ["#d8913e", "#f2c57a", "#b06a2a", "#ffe1a0"];
    x.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = (i % 2 ? 4.2 : 6) + (seed % 2 ? 0.8 : -0.6) * ((i * 7 + seed) % 3 - 1);
      const px = s / 2 + Math.cos(a) * r, py = s / 2 + Math.sin(a) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fillStyle = shades[seed % shades.length];
    x.fill();
    x.lineWidth = 1.5; x.strokeStyle = "rgba(60,25,8,.7)"; x.stroke();
    return c;
  },

  drawCloud(variant) {
    const w = [300, 380, 240][variant - 1], h = [110, 130, 90][variant - 1];
    const c = this.make(w, h);
    const x = c.getContext("2d");
    const puffs = variant === 1
      ? [[.25, .62, .22], [.45, .42, .3], [.68, .58, .24], [.85, .7, .15], [.5, .72, .2]]
      : variant === 2
        ? [[.2, .6, .2], [.4, .38, .28], [.62, .44, .26], [.8, .62, .2], [.55, .7, .2]]
        : [[.3, .6, .2], [.55, .5, .24], [.78, .65, .16]];
    x.fillStyle = "rgba(255,255,255,1)";
    for (const [px, py, pr] of puffs) {
      const r = pr * h * 1.25;
      x.beginPath(); x.arc(px * w, py * h, r, 0, Math.PI * 2); x.fill();
    }
    // Schattenunterseite
    x.globalCompositeOperation = "source-atop";
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(.6, "rgba(200,190,230,.25)");
    g.addColorStop(1, "rgba(150,130,190,.45)");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "source-over";
    return c;
  },

  // Hintergrund-Ebenen
  // Bergkette mit Schnee und Schattenseite
  mountainLayer(width, height, baseY, color, shade, peaks, seed) {
    const c = this.make(width, height);
    const x = c.getContext("2d");
    let sd = seed;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    x.beginPath();
    x.moveTo(0, height);
    let px = 0;
    while (px <= width + 200) {
      const pw = 140 + rnd() * 220;
      const ph = (0.35 + rnd() * 0.65) * peaks;
      x.lineTo(px + pw * .5, baseY - ph);
      x.lineTo(px + pw, baseY + 10 + rnd() * 20);
      px += pw;
    }
    x.lineTo(width, height);
    x.closePath();
    const g = x.createLinearGradient(0, baseY - peaks, 0, height);
    g.addColorStop(0, color);
    g.addColorStop(1, shade);
    x.fillStyle = g;
    x.fill();
    return c;
  },

  // Waldsilhouette (Baumreihen)
  forestLayer(width, height, color, seed) {
    const c = this.make(width, height);
    const x = c.getContext("2d");
    let sd = seed;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    x.fillStyle = color;
    for (let px = 0; px < width; px += 14 + rnd() * 16) {
      const th = 40 + rnd() * 80;
      const tw = 16 + rnd() * 18;
      x.beginPath();
      x.moveTo(px, height);
      x.lineTo(px + tw / 2, height - th);
      x.lineTo(px + tw, height);
      x.closePath();
      x.fill();
      x.beginPath();
      x.arc(px + tw / 2, height - th * .55, tw * .9, 0, Math.PI * 2);
      x.fill();
    }
    // Geschlossene Waldmasse unten, damit keine Himmelslücken durchscheinen
    x.fillRect(0, height * 0.6, width, height * 0.4);
    return c;
  },

  // Bodenkacheln je Biom (kleine Texturmuster)
  groundTile(colors) {
    const c = this.make(128, 64);
    const x = c.getContext("2d");
    x.fillStyle = colors.base;
    x.fillRect(0, 0, 128, 64);
    let sd = 99;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      x.fillStyle = rnd() > .5 ? colors.light : colors.dark;
      x.globalAlpha = .35;
      x.beginPath();
      x.ellipse(rnd() * 128, rnd() * 64, 2 + rnd() * 6, 1 + rnd() * 3, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
    return c;
  },
};

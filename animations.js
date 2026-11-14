/* ==========================================================================
   animations.js – Charakter-Rigs, Katapult, Partikel, Schwebetexte,
   Kamera-Effekte (Shake, Zoom, Hit-Stop) und Sprechblasen.
   ========================================================================== */

// ---------- Hilfszeichnen ----------
const Draw = {
  limb(ctx, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width + 4;
    ctx.strokeStyle = OUTLINE;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  },
  blob(ctx, x, y, rx, ry, color, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  },
  face(ctx, x, y, expr, flip = 1) {
    // Augen
    ctx.fillStyle = OUTLINE;
    if (expr === "shock") {
      ctx.beginPath(); ctx.arc(x - 4 * flip, y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 * flip, y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + 6, 3.2, 0, Math.PI * 2); ctx.fill();
    } else if (expr === "happy") {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x - 4 * flip, y - 1, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 4 * flip, y - 1, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 3, 4.5, 0, Math.PI); ctx.fillStyle = "#8a2a20"; ctx.fill();
    } else if (expr === "smug") {
      ctx.beginPath(); ctx.arc(x - 4 * flip, y - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 * flip, y - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.quadraticCurveTo(x + 2, y + 7, x + 6, y + 3); ctx.stroke();
    } else if (expr === "scared") {
      ctx.beginPath(); ctx.arc(x - 4 * flip, y - 1, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 * flip, y - 1, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + 5, 3, 4, 0, 0, Math.PI * 2); ctx.fillStyle = "#6a1a14"; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x - 4 * flip, y - 1, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 * flip, y - 1, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 5); ctx.quadraticCurveTo(x, y + 7, x + 3, y + 5); ctx.stroke();
    }
    // Wangen
    ctx.fillStyle = "rgba(255,110,110,.35)";
    ctx.beginPath(); ctx.ellipse(x - 8 * flip, y + 3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 8 * flip, y + 3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  },
};

// ---------- Die Frau ----------
const WOMAN_SKINS = {
  classic: { name: "Klassisch", dress: "#d9574e", dressDark: "#8f2c28", scarf: "#f2c14e", scarfDark: "#b8861c", hair: "#2a1a10", skin: "#f1c59a" },
  blue:    { name: "Azur", dress: "#3f7fd6", dressDark: "#234a8a", scarf: "#f4f1e8", scarfDark: "#bdb6a2", hair: "#1c1410", skin: "#eec08f" },
  festlich:{ name: "Festlich", dress: "#2f9a6a", dressDark: "#1a5c3e", scarf: "#f7c548", scarfDark: "#b47f12", hair: "#2a1a10", skin: "#f0c291" },
};

const Woman = {
  // Zeichnet die Frau; (x, y) = Mittelpunkt des Körpers
  // pose: 'seat' | 'fly' | 'hit' | 'fall' | 'idle' | 'cheer'
  draw(ctx, x, y, o = {}) {
    const skin = o.skin || WOMAN_SKINS.classic;
    const t = o.t || 0;
    const pose = o.pose || "idle";
    const sx = o.sx || 1, sy = o.sy || 1;
    const expr = o.expr || (pose === "fly" ? "shock" : pose === "hit" ? "happy" : "neutral");

    ctx.save();
    ctx.translate(x, y);
    if (o.angle) ctx.rotate(o.angle);
    ctx.scale(sx, sy);

    const bob = pose === "idle" || pose === "seat" ? Math.sin(t * 3) * 1.2 : 0;
    ctx.translate(0, bob);

    // Arme (Pose-abhängig)
    let armL, armR;
    if (pose === "fly") {
      const f = Math.sin(t * 9);
      armL = [-14, -6, -34, -18 + f * 8];
      armR = [14, -6, 34, -20 - f * 8];
    } else if (pose === "cheer") {
      armL = [-14, -6, -30, -36];
      armR = [14, -6, 30, -36];
    } else if (pose === "seat") {
      armL = [-14, -4, -22, 10];
      armR = [14, -4, 22, 10];
    } else if (pose === "hit") {
      armL = [-14, -6, -28, -28];
      armR = [14, -6, 24, -26];
    } else if (pose === "fall") {
      armL = [-14, -6, -30, -10 + Math.sin(t * 6) * 4];
      armR = [14, -6, 30, -6 - Math.sin(t * 6) * 4];
    } else {
      const sw = Math.sin(t * 2) * 3;
      armL = [-14, -4, -22, 10 + sw];
      armR = [14, -4, 22, 10 - sw];
    }

    // Beine
    const legSpread = pose === "fly" ? Math.sin(t * 7) * 6 : 0;
    Draw.limb(ctx, -6, 26, -10 - legSpread, 46, 9, "#2b2b44");
    Draw.limb(ctx, 6, 26, 10 + legSpread, 46, 9, "#2b2b44");
    // Schuhe
    Draw.blob(ctx, -12 - legSpread, 48, 7, 4, "#6b3a1f");
    Draw.blob(ctx, 12 + legSpread, 48, 7, 4, "#6b3a1f");

    // Arme hinter dem Körper
    Draw.limb(ctx, armL[0], armL[1], armL[2], armL[3], 8, skin.skin);
    Draw.limb(ctx, armR[0], armR[1], armR[2], armR[3], 8, skin.skin);

    // Kleid (Trapez mit Schattierung)
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-18, 6, -22, 30);
    ctx.quadraticCurveTo(0, 36, 22, 30);
    ctx.quadraticCurveTo(18, 6, 10, -12);
    ctx.closePath();
    const dg = ctx.createLinearGradient(-20, -12, 20, 30);
    dg.addColorStop(0, skin.dress);
    dg.addColorStop(1, skin.dressDark);
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // Gürtel
    ctx.beginPath();
    ctx.moveTo(-12, -2); ctx.lineTo(12, -2);
    ctx.lineWidth = 3; ctx.strokeStyle = "#f2c14e"; ctx.stroke();

    // Hals + Kopf
    ctx.fillStyle = skin.skin;
    ctx.beginPath(); ctx.ellipse(0, -18, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Haare hinten (Dutt)
    ctx.beginPath(); ctx.arc(0, -34, 16, 0, Math.PI * 2);
    ctx.fillStyle = skin.hair; ctx.fill();
    ctx.beginPath(); ctx.arc(-14, -26, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -52, 7, 0, Math.PI * 2); ctx.fill();

    // Gesicht
    ctx.beginPath(); ctx.ellipse(0, -30, 12, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = skin.skin; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
    Draw.face(ctx, 0, -28, expr);

    // Kopftuch (Schal)
    ctx.beginPath();
    ctx.moveTo(-14, -36);
    ctx.quadraticCurveTo(0, -48, 14, -36);
    ctx.quadraticCurveTo(10, -30, 0, -32);
    ctx.quadraticCurveTo(-10, -30, -14, -36);
    ctx.fillStyle = skin.scarf; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
    // Schal-Zipfel
    ctx.beginPath();
    ctx.moveTo(10, -34); ctx.quadraticCurveTo(20, -30, 18 + Math.sin(t * 8) * 3, -22);
    ctx.lineWidth = 6; ctx.strokeStyle = skin.scarfDark; ctx.lineCap = "round"; ctx.stroke();

    // Hände
    ctx.fillStyle = skin.skin;
    ctx.beginPath(); ctx.arc(armL[2], armL[3], 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(armR[2], armR[3], 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();

    ctx.restore();
  },
};

// ---------- Der Mann ----------
const MAN_LOOK = { shirt: "#4d7fb8", shirtDark: "#2d4e78", hair: "#3a2a1c", skin: "#e9b98a", pants: "#4a3a2c" };

const Man = {
  // pose: 'idle' | 'pull' | 'smug' | 'doubt' | 'shock' | 'point' | 'wind'
  draw(ctx, x, y, o = {}) {
    const t = o.t || 0;
    const pose = o.pose || "idle";
    const s = o.s || 1;
    const expr = o.expr || (pose === "shock" ? "shock" : pose === "smug" ? "smug" : "neutral");
    const c = MAN_LOOK;

    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2.4) * 1.2 * s);
    ctx.scale(s, s);

    // Beine
    Draw.limb(ctx, -7, 30, -10, 60, 12, c.pants);
    Draw.limb(ctx, 7, 30, 10, 60, 12, c.pants);
    Draw.blob(ctx, -12, 62, 9, 5, "#3a2412");
    Draw.blob(ctx, 12, 62, 9, 5, "#3a2412");

    // Arme je nach Pose
    let aL = [-18, -4, -34, 14];
    let aR = [18, -4, 34, 14];
    if (pose === "pull") { aL = [-18, -4, -30, -14]; aR = [18, -4, 6, -18]; }
    if (pose === "point") { aL = [-18, -4, -30, 14]; aR = [18, -4, 42, -30]; }
    if (pose === "doubt") { aL = [-18, -4, -30, 14]; aR = [18, -4, 22, -14]; }
    if (pose === "shock") { aL = [-18, -4, -40, -24]; aR = [18, -4, 40, -24]; }
    if (pose === "smug") { aL = [-18, -4, -30, 14]; aR = [18, -4, 28, 4]; }
    if (pose === "wind") { aL = [-18, -4, -26, -14 + Math.sin(t * 5) * 6]; aR = [18, -4, 26, -14 - Math.sin(t * 5) * 6]; }
    Draw.limb(ctx, aL[0], aL[1], aL[2], aL[3], 11, c.shirtDark);
    Draw.limb(ctx, aR[0], aR[1], aR[2], aR[3], 11, c.shirtDark);

    // Körper
    Draw.blob(ctx, 0, 12, 22, 26, c.shirt);
    // Gürtel
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(-20, 26, 40, 4);

    // Hände
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(aL[2], aL[3], 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(aR[2], aR[3], 5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();

    // Kopf
    ctx.beginPath(); ctx.ellipse(0, -18, 15, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.skin; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
    // Haare & Bart
    ctx.beginPath();
    ctx.moveTo(-15, -22); ctx.quadraticCurveTo(-18, -40, 0, -36); ctx.quadraticCurveTo(16, -40, 15, -22);
    ctx.quadraticCurveTo(8, -28, 0, -28); ctx.quadraticCurveTo(-8, -28, -15, -22);
    ctx.fillStyle = c.hair; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -8, 9, 0, Math.PI); ctx.fillStyle = "rgba(58,42,28,.8)"; ctx.fill();
    Draw.face(ctx, 0, -18, expr);
    // Augenbraue (Zweifel)
    if (pose === "doubt" || expr === "smug") {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-2, -23); ctx.stroke();
    }
    ctx.restore();
  },
};

// ---------- Katapult (Holz / Eisen / Gold) ----------
const CATAPULT_STYLES = {
  wood: { wood: ["#b87a3e", "#7a4420"], metal: "#6f6a62", name: "Holzkatapult", glow: null },
  iron: { wood: ["#8e8f96", "#4b4d55"], metal: "#2f3138", name: "Eisenkatapult", glow: "rgba(120,200,255,.35)" },
  gold: { wood: ["#f7c548", "#b97b10"], metal: "#7a4b08", name: "Goldkatapult", glow: "rgba(255,220,100,.5)" },
};

const Catapult = {
  // (x, y) = Boden-Mitte; arm = Winkel des Wurfarms (0 = ruht, negativ = gespannt)
  draw(ctx, x, y, o = {}) {
    const st = CATAPULT_STYLES[o.style || "wood"];
    const arm = o.arm || 0;
    const t = o.t || 0;
    ctx.save();
    ctx.translate(x, y);

    if (st.glow) {
      const g = ctx.createRadialGradient(0, -60, 10, 0, -60, 120);
      g.addColorStop(0, st.glow); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(-130, -180, 260, 240);
    }

    // Schatten
    ctx.fillStyle = "rgba(30,15,5,.3)";
    ctx.beginPath(); ctx.ellipse(0, 4, 110, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Rahmen (Kufen)
    const wg = ctx.createLinearGradient(0, -10, 0, 0);
    wg.addColorStop(0, st.wood[0]); wg.addColorStop(1, st.wood[1]);
    ctx.fillStyle = wg;
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    roundRectPath(ctx, -100, -18, 200, 16, 6); ctx.fill(); ctx.stroke();
    // Stützen
    ctx.fillStyle = st.wood[0];
    roundRectPath(ctx, -78, -110, 14, 96, 4); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, 64, -110, 14, 96, 4); ctx.fill(); ctx.stroke();
    // Querstrebe
    roundRectPath(ctx, -82, -58, 164, 10, 4); ctx.fill(); ctx.stroke();
    // Räder
    for (const wx of [-74, 74]) {
      ctx.beginPath(); ctx.arc(wx, -2, 13, 0, Math.PI * 2);
      ctx.fillStyle = st.wood[1]; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(wx, -2, 3, 0, Math.PI * 2); ctx.fillStyle = st.metal; ctx.fill();
    }

    // Wurfarm: vom Drehpunkt (0, -110)
    ctx.save();
    ctx.translate(0, -104);
    ctx.rotate(arm);
    const ag = ctx.createLinearGradient(-8, 0, 8, 0);
    ag.addColorStop(0, st.wood[0]); ag.addColorStop(1, st.wood[1]);
    ctx.fillStyle = ag;
    roundRectPath(ctx, -8, -150, 8, 156, 4); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, 0, -150, 8, 156, 4); ctx.fill(); ctx.stroke();
    // Schleuderschale
    ctx.fillStyle = st.metal;
    ctx.beginPath(); ctx.ellipse(0, -150, 40, 14, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Drehpunkt
    ctx.beginPath(); ctx.arc(0, -104, 8, 0, Math.PI * 2);
    ctx.fillStyle = st.metal; ctx.fill(); ctx.stroke();

    // Zusatzdetails (Gold-Ornamente)
    if (o.style === "gold") {
      ctx.fillStyle = "#fff3a0";
      for (const [px, py] of [[-71, -66], [71, -66], [0, -40]]) {
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  },
};

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Partikel ----------
class ParticleSystem {
  constructor(max = 500) {
    this.max = max;
    this.list = [];
  }
  emit(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(Object.assign({ life: 1, age: 0, vx: 0, vy: 0, rot: 0, vr: 0, g: 900, size: 8, sprite: null, color: null, drag: 1.5, grow: 0, alpha: 1 }, p));
  }
  burst(kind, x, y, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = MathUtil.rand(120, 380) * power;
      if (kind === "crumb") {
        this.emit({ kind: "sprite", sprite: MathUtil.pick(Assets.sprites.crumbs), x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180 * power, life: MathUtil.rand(.7, 1.3), vr: MathUtil.rand(-9, 9), size: MathUtil.rand(.8, 1.4) });
      } else if (kind === "dust") {
        this.emit({ kind: "dust", x, y, vx: Math.cos(a) * sp * .6, vy: -Math.abs(Math.sin(a)) * sp * .25, life: MathUtil.rand(.4, .7), size: MathUtil.rand(10, 18), color: "210,190,150", g: 0, drag: 3, grow: 60 });
      } else if (kind === "star") {
        this.emit({ kind: "sprite", sprite: Assets.sprites.sparkle, x, y, vx: Math.cos(a) * sp * .8, vy: Math.sin(a) * sp * .8, life: MathUtil.rand(.5, .9), size: MathUtil.rand(.5, 1), g: 200, drag: 2 });
      } else if (kind === "coin") {
        this.emit({ kind: "sprite", sprite: Assets.sprites.sparkle, x, y, vx: Math.cos(a) * sp * .5, vy: Math.sin(a) * sp * .5 - 80, life: .6, size: .35, g: 0, drag: 3 });
      } else if (kind === "ring") {
        this.emit({ kind: "ring", x, y, life: .5, size: 10, grow: 420, color: "255,240,180", g: 0, drag: 0 });
      } else if (kind === "confetti") {
        const cols = ["255,213,74", "255,140,90", "120,220,200", "255,255,255"];
        this.emit({ kind: "rect", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, life: MathUtil.rand(1.4, 2.2), size: MathUtil.rand(4, 7), color: MathUtil.pick(cols), vr: MathUtil.rand(-12, 12), g: 700, drag: 1.2 });
      }
    }
  }
  update(dt) {
    const out = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.g * dt;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f; p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt * .02;
      out.push(p);
    }
    this.list = out;
  }
  draw(ctx) {
    for (const p of this.list) {
      const k = p.age / p.life;
      const a = (1 - k) * p.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === "sprite" && p.sprite) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size * (p.sprite.width / 16);
        ctx.drawImage(p.sprite, -p.sprite.width * s / 2, -p.sprite.height * s / 2, p.sprite.width * s, p.sprite.height * s);
      } else if (p.kind === "dust") {
        const r = p.size + k * p.grow * .5;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${p.color},${a * .7})`);
        g.addColorStop(1, `rgba(${p.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === "ring") {
        ctx.strokeStyle = `rgba(${p.color},${a})`;
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + k * p.grow, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === "rect") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${p.color},${a})`;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
  }
  clear() { this.list = []; }
}

// ---------- Schwebetexte ----------
class FloatTexts {
  constructor() { this.list = []; }
  add(text, x, y, color = "#fff8ea", size = 26) {
    this.list.push({ text, x, y, age: 0, life: 1.3, color, size });
  }
  update(dt) {
    for (const t of this.list) { t.age += dt; t.y -= 40 * dt; }
    this.list = this.list.filter(t => t.age < t.life);
  }
  draw(ctx) {
    for (const t of this.list) {
      const k = t.age / t.life;
      const pop = k < .15 ? MathUtil.easeOutBack(k / .15) : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.font = `900 ${t.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(58,32,20,.85)";
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
  clear() { this.list = []; }
}

// ---------- Kamera-Effekte ----------
const Camera = {
  shake: 0,        // Stärke (px)
  shakeDecay: 1,
  zoom: 1,
  zoomTarget: 1,
  zoomKick: 0,
  hitStop: 0,      // Sekunden Zeitlupe bei starkem Aufprall
  shakeEnabled: true,

  addShake(strength) {
    if (!this.shakeEnabled) return;
    this.shake = Math.max(this.shake, Math.min(28, strength));
  },
  addZoom(amount) { this.zoomKick = Math.max(this.zoomKick, amount); },
  addHitStop(seconds) { this.hitStop = Math.max(this.hitStop, seconds); },
  update(dt) {
    this.shake *= Math.exp(-7 * dt);
    if (this.shake < .05) this.shake = 0;
    this.zoomKick *= Math.exp(-5 * dt);
    if (this.zoomKick < .0005) this.zoomKick = 0;
    this.hitStop = Math.max(0, this.hitStop - dt);
  },
  offset() {
    if (!this.shake) return { x: 0, y: 0 };
    return { x: (Math.random() * 2 - 1) * this.shake, y: (Math.random() * 2 - 1) * this.shake };
  },
  currentZoom() { return 1 + this.zoomKick; },
};

// ---------- Geschwindigkeitslinien ----------
function drawSpeedLines(ctx, w, h, speed, t, intensity) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${Math.min(.5, intensity * .5)})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const n = 14;
  for (let i = 0; i < n; i++) {
    const y = ((i * 97 + t * 900) % h);
    const x = w - ((i * 151 + t * speed * .9) % (w + 200)) + 100;
    const len = 60 + (speed / 40) % 160;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Sprechblasen (Story) ----------
const Bubble = {
  // Zeichnet eine Sprechblase mit Typewriter-Text (progress 0..1)
  draw(ctx, x, y, text, progress, opts = {}) {
    const chars = Math.floor(text.length * MathUtil.clamp(progress, 0, 1));
    const shown = text.slice(0, chars);
    ctx.save();
    ctx.font = `700 ${opts.size || 26}px "Trebuchet MS", system-ui, sans-serif`;
    const maxW = opts.maxWidth || 460;
    const lines = Bubble.wrap(ctx, shown, maxW);
    const lh = (opts.size || 26) * 1.35;
    const w = Math.max(120, Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width), 60)) + 40);
    const h = lines.length * lh + 26;
    const bx = x - w / 2, by = y - h;
    ctx.fillStyle = "rgba(255,250,236,.97)";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, w, h, 18) : roundRectPath(ctx, bx, by, w, h, 18);
    ctx.fill(); ctx.stroke();
    // Schwanz
    ctx.beginPath();
    ctx.moveTo(x - 12, by + h - 2);
    ctx.lineTo(x + (opts.tailX || 0), y);
    ctx.lineTo(x + 12, by + h - 2);
    ctx.fillStyle = "rgba(255,250,236,.97)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 12, by + h - 2); ctx.lineTo(x + (opts.tailX || 0), y); ctx.lineTo(x + 12, by + h - 2);
    ctx.stroke();
    // Text
    ctx.fillStyle = OUTLINE;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, bx + 20, by + 13 + i * lh));
    ctx.restore();
    return { h, w };
  },
  wrap(ctx, text, maxW) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const wd of words) {
      const test = cur ? cur + " " + wd : wd;
      if (ctx.measureText(test).width > maxW - 40 && cur) { lines.push(cur); cur = wd; }
      else cur = test;
    }
    if (cur || !lines.length) lines.push(cur);
    return lines;
  },
};

// Kleine Verzierungen für Hintergründe
const Deco = {
  sun(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, r * .2, x, y, r * 2.6);
    g.addColorStop(0, "rgba(255,250,220,1)");
    g.addColorStop(.3, "rgba(255,230,160,.55)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  },
};

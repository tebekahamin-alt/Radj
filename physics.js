/* ==========================================================================
   physics.js – eigenes, arcade-orientiertes Physiksystem
   Gravitation, Luftwiderstand, Rotation, Materialien mit Bounce-Eigenschaften,
   Kreis-Kollisionen mit Auflösung, Boden, Federn (Squash & Stretch) und
   Flugbahn-Vorschau.
   ========================================================================== */

const Physics = {
  GRAVITY: 1150,        // px/s²
  AIR_DRAG: 0.06,       // lineares Abbremsen je Sekunde
  AIR_DRAG_SQ: 0.00004, // quadratischer Anteil (hohe Geschwindigkeiten bremsen stärker)
  GROUND_Y: 600,        // Oberfläche des Bodens (Welt-Koordinaten)
  GROUND_E: 0.42,       // Bounce des Bodens
  MAX_SPEED: 3200,
  SUBSTEPS: 4,

  // Materialeigenschaften je Objekttyp
  //  e        : Restitution (Bounce-Stärke)
  //  lift     : zusätzlicher Vertikalimpuls bei starkem Aufprall
  //  push     : zusätzlicher Horizontalimpuls (in Normalenrichtung, gestreckt)
  //  stretchX : Normale wird horizontal verstärkt (Baguette-Bounce)
  //  friction : Tangentialreibung (0 = glatt, 1 = haftend)
  //  spin     : wie viel Tangentialgeschwindigkeit in Rotation übergeht
  MATERIALS: {
    bread:     { e: 0.88, lift: 0,    push: 0,   stretchX: 1.0, friction: 0.25, spin: 0.9, name: "Brot" },
    baguette:  { e: 0.80, lift: 0,    push: 260, stretchX: 2.1, friction: 0.12, spin: 0.6, name: "Baguette" },
    toast:     { e: 1.02, lift: 120,  push: 0,   stretchX: 1.0, friction: 0.35, spin: 1.2, name: "Toast" },
    giant:     { e: 0.72, lift: 820,  push: 0,   stretchX: 1.0, friction: 0.45, spin: 0.4, name: "Riesenbrot" },
    golden:    { e: 0.96, lift: 240,  push: 80,  stretchX: 1.0, friction: 0.10, spin: 1.1, name: "Goldbrot" },
    pine:      { e: 0.62, lift: 40,   push: 0,   stretchX: 1.0, friction: 0.55, spin: 1.5, name: "Pinie" },
    oak:       { e: 0.78, lift: 90,   push: 0,   stretchX: 1.0, friction: 0.35, spin: 0.9, name: "Eiche" },
    pista:     { e: 0.92, lift: 180,  push: 140, stretchX: 1.25, friction: 0.20, spin: 1.0, name: "Pistazie" },
    bush:      { e: 0.30, lift: 0,    push: 0,   stretchX: 1.0, friction: 0.8,  spin: 0.2, name: "Busch" },
    secret:    { e: 1.10, lift: 500,  push: 300, stretchX: 1.0, friction: 0.05, spin: 1.4, name: "Geheim" },
  },

  // Körper: die Frau als Kreis mit Drehung
  createBody(x, y, r = 30) {
    return {
      x, y, r,
      vx: 0, vy: 0,
      angle: 0, omega: 0,
      grounded: false,
      restTime: 0,
      flying: false,
      lastImpact: 0,
    };
  },

  // Eine Physik-Teilmenge: Integrieren von Kräften
  integrate(body, dt, input) {
    const { GRAVITY, AIR_DRAG, AIR_DRAG_SQ } = this;
    const speed = Math.hypot(body.vx, body.vy);
    const dragFactor = Math.max(0, 1 - (AIR_DRAG + AIR_DRAG_SQ * speed) * dt);
    body.vx *= dragFactor;
    body.vy *= dragFactor;

    body.vy += GRAVITY * dt;

    // Flugkontrolle: Auftrieb in Richtung der Körperneigung
    if (input && input.lift > 0 && !body.grounded) {
      const lift = input.lift;
      body.vy -= lift * dt;
      body.vx += Math.cos(body.angle) * lift * 0.12 * dt;
    }

    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.angle += body.omega * dt;
    // Rotation sanft abbremsen (Luftwiderstand)
    body.omega *= Math.max(0, 1 - 0.6 * dt);

    const max = this.MAX_SPEED;
    const sp = Math.hypot(body.vx, body.vy);
    if (sp > max) {
      body.vx *= max / sp;
      body.vy *= max / sp;
    }
  },

  // Boden: liefert Aufprall-Info (oder null)
  collideGround(body, bounceMult, dt, groundEBoost = 1) {
    const floor = this.GROUND_Y - body.r;
    if (body.y < floor) {
      body.grounded = false;
      return null;
    }
    body.y = floor;
    const impact = body.vy;
    let result = null;
    if (impact > 0) {
      const strength = impact;
      body.vy = -impact * this.GROUND_E * bounceMult * groundEBoost;
      body.vx *= 0.9;
      body.omega += body.vx * 0.012;
      result = { strength, type: "ground", x: body.x, y: this.GROUND_Y };
    }
    if (Math.abs(body.vy) < 40) {
      body.vy = 0;
      body.grounded = true;
      // Rollen und Reibung am Boden
      body.vx *= Math.exp(-2.4 * dt);
      body.omega = body.vx / Math.max(1, body.r);
    }
    return result;
  },

  // Kollision mit einem kreisförmigen Objekt
  // Gibt null oder { strength, type, x, y, mat } zurück
  collideObject(body, obj, bounceMult) {
    const mat = this.MATERIALS[obj.material];
    let dx = body.x - obj.x;
    let dy = body.y - obj.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const minDist = body.r + obj.r;
    if (dist >= minDist) return null;

    // Normale, bei gestreckten Brotsorten horizontal verzerrt
    let nx = dx / dist;
    let ny = dy / dist;
    if (mat.stretchX !== 1) {
      nx *= mat.stretchX;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }

    // Eindringen auflösen
    const pen = minDist - dist;
    body.x += nx * pen;
    body.y += ny * pen;

    const vn = body.vx * nx + body.vy * ny;
    if (vn >= 0) return null; // entfernt sich bereits

    const strength = -vn;
    const e = mat.e * bounceMult * (obj.bounceScale || 1);

    // Geschwindigkeit reflektieren
    body.vx -= (1 + e) * vn * nx;
    body.vy -= (1 + e) * vn * ny;

    // Tangentialreibung und Spin
    const tx = -ny, ty = nx;
    const vt = body.vx * tx + body.vy * ty;
    const reduce = vt * mat.friction * 0.35;
    body.vx -= tx * reduce;
    body.vy -= ty * reduce;
    body.omega += vt * 0.0045 * mat.spin * (body.angleSign || 1);

    // Materialeigene Extras (nur bei spürbarem Aufprall)
    const power = Math.min(1, strength / 900);
    if (mat.lift) body.vy -= mat.lift * power;
    if (mat.push) {
      body.vx += nx * mat.push * power;
      body.vy += ny * mat.push * power * 0.3;
    }

    body.grounded = false;
    body.lastImpact = strength;
    return { strength, type: obj.material, x: obj.x + nx * obj.r, y: obj.y + ny * obj.r, nx, ny, obj, mat };
  },

  // Flugbahn-Vorschau (ohne Kollisionen, nur Gravitation & Widerstand)
  predictTrajectory(x, y, vx, vy, steps = 60, dt = 1 / 30) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const speed = Math.hypot(vx, vy);
      const f = Math.max(0, 1 - (this.AIR_DRAG + this.AIR_DRAG_SQ * speed) * dt);
      vx *= f;
      vy = vy * f + this.GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      if (y > this.GROUND_Y) break;
      pts.push({ x, y });
    }
    return pts;
  },
};

// Geschwindigkeitsabhängige Feder (Squash & Stretch, Wackeln, Zurückfedern)
class Spring {
  constructor(stiffness = 220, damping = 14) {
    this.k = stiffness;
    this.d = damping;
    this.x = 0;
    this.v = 0;
  }
  kick(amount) { this.v += amount; }
  update(dt) {
    const a = -this.k * this.x - this.d * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    if (Math.abs(this.x) < 1e-4 && Math.abs(this.v) < 1e-3) { this.x = 0; this.v = 0; }
    return this.x;
  }
}

// Kleine Hilfsfunktionen
const MathUtil = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  smooth(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); },
};

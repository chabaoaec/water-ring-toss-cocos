import { cc } from './engine-bootstrap.js';
import { PEGS, RING_RADIUS, INTAKES } from './physics.js';
const color = (hex, alpha = 255) => {
  const c = new cc.Color(hex);
  c.a = alpha;
  return c;
};
const shade = (hex, f) => {
  const c = new cc.Color(hex);
  return new cc.Color(Math.min(255, c.r * f), Math.min(255, c.g * f), Math.min(255, c.b * f), 255);
};
export class ToyRenderer {
  constructor(g, reduced) {
    this.g = g;
    this.reduced = reduced;
    this.bubbles = Array.from({
      length: 32
    }, (_, i) => ({
      x: 28 + i * 79 % 360,
      y: i * 53 % 510,
      r: 1.3 + i % 3 * .7
    }));
  }
  line(x1, y1, x2, y2, c, width) {
    const g = this.g;
    g.strokeColor = c;
    g.lineWidth = width;
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  ellipse(x, y, rx, ry, c) {
    this.g.fillColor = c;
    this.g.ellipse(x, y, rx, ry);
    this.g.fill();
  }
  rounded(x, y, w, h, r, c) {
    this.g.fillColor = c;
    this.g.roundRect(x, y, w, h, r);
    this.g.fill();
  }
  draw(w) {
    const g = this.g,
      t = w.time;
    g.clear();
    g.lineCap = cc.Graphics.LineCap.ROUND;
    g.lineJoin = cc.Graphics.LineJoin.ROUND;
    // Layered water tint, original softly rolling seabed, and caustic ribbons.
    for (let i = 0; i < 22; i++) this.rounded(0, i * 26.5, 420, 28, 0, color(i < 5 ? '#b2ded1' : i < 12 ? '#c4e7dd' : '#d6efe5'));
    g.fillColor = color('#a0cebf', 100);
    g.moveTo(0, 69);
    g.bezierCurveTo(110, 113, 250, 18, 420, 86);
    g.lineTo(420, 0);
    g.lineTo(0, 0);
    g.close();
    g.fill();
    g.fillColor = color('#dbead2', 150);
    g.moveTo(0, 34);
    g.bezierCurveTo(180, 73, 280, 29, 420, 47);
    g.lineTo(420, 0);
    g.lineTo(0, 0);
    g.close();
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.strokeColor = color('#f2fff3', 70);
      g.lineWidth = 1.8;
      g.moveTo(-20, 440 + i * 29);
      g.bezierCurveTo(90, 470 + i * 24 + Math.sin(t * .6) * 6, 230, 430 + i * 34, 440, 461 + i * 20);
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 91 : 329;
      this.ellipse(x, 31, 23, 8, color('#639d97', 90));
      this.rounded(x - 15, 23, 30, 12, 5, color('#7aaba0'));
      this.ellipse(x, 35, 15, 5, color('#e4f6e9'));
      this.ellipse(x, 35, 7, 2.5, color('#588e88'));
    }
    for (let i = 0; i < PEGS.length; i++) {
      const p = PEGS[i];
      this.ellipse(p.x + 7, p.base - 20, 34, 10, color('#559a93', 35));
      this.rounded(p.x - 29, p.base - 16, 58, 10, 5, color('#86afa0'));
      this.ellipse(p.x, p.base - 5, 29, 9, color('#d5debc'));
      this.ellipse(p.x, p.base - 2, 22, 5, color('#e6ebce'));
    }
    // Separate intake grilles draw tank water back into each released pump.
    for (const [side, inlet] of INTAKES.entries()) {
      const strength = w.jetStates[side].intakeStrength;
      this.rounded(inlet.x - 13, inlet.y - 8, 26, 16, 6, color('#7fa79e', 130));
      this.rounded(inlet.x - 11, inlet.y - 6, 22, 12, 4, color('#d7e7ce', 210));
      for (let slot = -1; slot <= 1; slot++) this.line(inlet.x + slot * 5, inlet.y - 3, inlet.x + slot * 5, inlet.y + 3, color('#6e9991', 180), 2);
      if (strength > 0) {
        // Short converging strokes, not newly emitted tracer particles.
        const drift = (w.time * 1.9) % 1;
        for (const direction of [-1, 1]) {
          const x = inlet.x + direction * (20 - drift * 6);
          this.line(x, inlet.y + 1, x - direction * 4, inlet.y - 1, color('#7aaea6', strength * 95), 1.4);
          this.line(x - direction * 4, inlet.y - 1, x, inlet.y - 3, color('#7aaea6', strength * 95), 1.4);
        }
      }
    }
    // Existing all-domain dye forms soft asymmetric wisps, never concentric
    // bubbles or nozzle-born puffs. Stretch/orientation follow local velocity.
    for (const p of w.tracers.particles) {
      const fade = Math.min(1, p.age / .8, (p.life - p.age) / 1.5);
      const speed = Math.hypot(p.vx, p.vy), phase = p.phase + t * .11;
      const angle = Math.atan2(p.vy + Math.sin(phase) * 4, p.vx + Math.cos(phase) * 4);
      const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
      const length = p.size * (2.7 + Math.min(speed / 100, 1.6));
      const bend = p.size * (.5 + Math.sin(phase) * .3), y = p.y + p.z * .32;
      for (const [width, alpha, offset, tint] of [[1.8,8,2,'#83b7ad'],[1.05,34,0,'#f2fff0'],[.45,25,-1,'#f6fff3']]) {
        g.strokeColor = color(tint, alpha * fade); g.lineWidth = p.size * width;
        const x = p.x + nx * offset, py = y + ny * offset;
        g.moveTo(x - dx * length, py - dy * length);
        g.bezierCurveTo(x - dx * length * .35 + nx * bend, py - dy * length * .35 + ny * bend, x + dx * length * .35 - nx * bend, py + dy * length * .35 - ny * bend, x + dx * length, py + dy * length);
        g.stroke();
      }
    }
    const parts = [];
    for (const p of PEGS) parts.push({
      z: 0,
      draw: () => {
        this.line(p.x + 2, p.base, p.x + 2, p.tip, color('#8caa9a'), 10);
        this.line(p.x - 1, p.base + 1, p.x - 1, p.tip, color('#e4e6bc'), 7);
        this.line(p.x - 2, p.base + 2, p.x - 2, p.tip, color('#fff8d6'), 2);
        this.ellipse(p.x, p.tip, 4.8, 3.8, color('#fdf7d6'));
      }
    });
    // Every torus edge is projected from the Cannon quaternion and depth-sorted against posts.
    for (const r of w.rings) {
      const q = r.body.quaternion,
        points = [];
      for (let i = 0; i <= 48; i++) {
        const a = i * Math.PI / 24;
        const v = q.vmult({
          x: Math.cos(a) * RING_RADIUS,
          y: 0,
          z: Math.sin(a) * RING_RADIUS
        });
        points.push({
          x: r.x + v.x,
          y: r.y + v.y + (r.z + v.z) * .32,
          z: r.z + v.z
        });
      }
      for (let i = 0; i < 48; i += 6) {
        const arc = points.slice(i, i + 7),
          z = arc.reduce((sum, p) => sum + p.z, 0) / arc.length;
        parts.push({
          z,
          draw: () => {
            for (const [dx, dy, width, c] of [[1, -1, 8, shade(r.color, .65)], [0, 0, 6.3, color(r.color)], [-1, 1.5, 1.4, shade(r.color, 1.2)]]) {
              g.strokeColor = c;
              g.lineWidth = width;
              g.moveTo(arc[0].x + dx, arc[0].y + dy);
              for (let j = 1; j < arc.length; j++) g.lineTo(arc[j].x + dx, arc[j].y + dy);
              g.stroke();
            }
          }
        });
      }
    }
    parts.sort((a, b) => a.z - b.z);
    for (const part of parts) part.draw();
    const count = this.reduced ? 10 : this.bubbles.length;
    for (let i = 0; i < count; i++) {
      const b = this.bubbles[i];
      const y = (b.y + t * (5 + i % 4)) % 520 + 28;
      const x = b.x + Math.sin(t * .7 + i) * 4;
      g.strokeColor = color('#f8fff7', 125);
      g.lineWidth = .9;
      g.circle(x, y, b.r);
      g.stroke();
    }
    // Waterline, glass thickness and restrained highlights.
    this.line(16, 551, 404, 551, color('#f8fff4', 160), 2);
    this.line(14, 541, 14, 81, color('#ffffff', 110), 2);
    this.line(405, 522, 405, 363, color('#ffffff', 90), 3);
    this.rounded(26, 399, 5, 99, 2, color('#ffffff', 65));
    this.rounded(26, 511, 5, 17, 2, color('#ffffff', 65));
  }
}

import { cc } from './engine-bootstrap.js?v=57fe74982d38b3f1d351';
import { PEGS, RING_RADIUS, INTAKES } from './physics.js?v=57fe74982d38b3f1d351';
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

  }
  updateMist(tracers, time) {
    if (!this.mistFrame) {
      // A tiny procedural radial texture is uploaded once. Reusing sprite quads
      // avoids rebuilding hundreds of translucent curve meshes every frame.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 29);
      gradient.addColorStop(0, 'rgba(245,255,252,.85)');
      gradient.addColorStop(.16, 'rgba(208,255,249,.62)');
      gradient.addColorStop(.5, 'rgba(105,239,238,.20)');
      gradient.addColorStop(1, 'rgba(105,239,238,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
      // Reflective flake: a white specular diamond, not a dark opaque dust core.
      ctx.fillStyle = 'rgba(255,255,244,.98)';
      ctx.beginPath(); ctx.moveTo(32, 18); ctx.lineTo(35, 29);
      ctx.lineTo(45, 32); ctx.lineTo(35, 35); ctx.lineTo(32, 46);
      ctx.lineTo(29, 35); ctx.lineTo(19, 32); ctx.lineTo(29, 29);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'white'; ctx.fillRect(30, 30, 4, 4);
      const image = new cc.ImageAsset(canvas), texture = new cc.Texture2D();
      texture.image = image;
      this.mistFrame = new cc.SpriteFrame();
      this.mistFrame.packable = false; // Keep this sole64px texture out of a2048px dynamic atlas.
      this.mistFrame.texture = texture;
      this.mistPool = [];
      this.mistColors = Array.from({length: 256}, (_, alpha) => new cc.Color(255,255,255,alpha));
    }
    for (let i = 0; i < tracers.particles.length; i++) {
      const p = tracers.particles[i];
      let entry = this.mistPool[i];
      if (!entry) {
        const node = new cc.Node(`SuspendedMist${i}`);
        node.layer = this.g.node.layer; this.g.node.addChild(node);
        const transform = node.addComponent(cc.UITransform);
        transform.setContentSize(p.size * 2.7, p.size * 2.7);
        const sprite = node.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.mistFrame;
        entry = {node, sprite, alpha: -1}; this.mistPool.push(entry);
      }
      entry.node.active = p.inChamber === null || p.inChamber === undefined;
      if (!entry.node.active) continue;
      entry.node.setPosition(p.x, p.y + p.z * .32, 0);
      const phase = p.phase ?? p.id * 2.399963;
      const shimmer = this.reduced ? .65 : Math.pow(.5 + .5 * Math.sin(time * 1.7 + phase), 4);
      const alpha = Math.round(125 + 125 * shimmer);
      entry.node.setRotationFromEuler(0, 0, phase * 57.29578 + (this.reduced ? 0 : Math.sin(time * .45 + phase) * 12));
      if (entry.alpha !== alpha) {entry.sprite.color = this.mistColors[alpha]; entry.alpha = alpha;}
    }
    for (let i = tracers.particles.length; i < this.mistPool.length; i++) this.mistPool[i].node.active = false;
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
  surfacePolygon(points, tint, stroke = null) {
    if (!points || points.length < 3) return;
    const g = this.g;
    g.moveTo(points[0].x, points[0].y + points[0].z * .32);
    for (const p of points.slice(1)) g.lineTo(p.x, p.y + p.z * .32);
    g.close();
    g.fillColor = tint;
    g.fill();
    if (stroke) {g.strokeColor = stroke; g.lineWidth = 1.3; g.stroke();}
  }
  draw(w) {
    const g = this.g,
      t = w.time;
    const surfaceY = w.getWaterSurfaceY?.() ?? 540;
    const waterSurface = w.getWaterSurface?.();
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
      g.moveTo(-20, surfaceY - 110 + i * 29);
      g.bezierCurveTo(90, surfaceY - 80 + i * 24 + Math.sin(t * .6) * 6, 230, surfaceY - 120 + i * 34, 440, surfaceY - 89 + i * 20);
      g.stroke();
    }
    // The cavity is the dry side of the same volume-preserving plane used by
    // physical buoyancy. It can move to a side when the phone is tilted.
    if (waterSurface) {
      this.surfacePolygon(waterSurface.facePolygon('z', 'max', {water:false}), color('#ecf5eb'));
    } else {
      this.rounded(0, surfaceY + 16.6, 420, Math.max(0, 580 - surfaceY - 16.6), 0, color('#ecf5eb'));
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
    // All-domain suspended mist shares the physical tracer positions. Its cached
    // sprite texture has white specular glints, a pale cyan halo and no dark core.
    this.updateMist(w.tracers, w.time);
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
    // Project the true plane/box section, including forward/backward tilt.
    if (waterSurface) {
      this.surfacePolygon(waterSurface.surfacePolygon3D(), color('#dff7ee', 100), color('#ffffff',190));
    } else {
      this.rounded(0, surfaceY - 16.6, 420, 33.2, 0, color('#dff7ee', 100));
      this.line(0, surfaceY + 16.6, 420, surfaceY + 16.6, color('#ffffff', 190), 1.5);
      this.line(0, surfaceY - 16.6, 420, surfaceY - 16.6, color('#9bcec7', 120), 1);
    }
    // Fixed glass seam and restrained casing highlights.
    this.line(16, 551, 404, 551, color('#f8fff4', 160), 2);
    this.line(14, 541, 14, 81, color('#ffffff', 110), 2);
    this.line(405, 522, 405, 363, color('#ffffff', 90), 3);
    this.rounded(26, 399, 5, 99, 2, color('#ffffff', 65));
    this.rounded(26, 511, 5, 17, 2, color('#ffffff', 65));
  }
}

import * as CANNON from '../vendor/cannon-es.js';
export const PEGS = [{
  x: 143,
  z: 0,
  tip: 322,
  base: 36
}, {
  x: 277,
  z: 0,
  tip: 322,
  base: 36
}];
export const PALETTE = ['#f38b78', '#b69af2', '#f4c95c', '#74cbbb', '#ed8faf', '#91a7ed', '#f5b76e', '#add68e'];
export const RING_RADIUS = 19,
  TUBE_RADIUS = 3.6,
  INNER_RADIUS = RING_RADIUS - TUBE_RADIUS;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function makeRandom(seed = 42) {
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
}
export class WaterWorld {
  constructor(seed = 42) {
    this.reset(seed);
  }
  reset(seed = 42) {
    this.random = makeRandom(seed);
    this.time = 0;
    this.started = false;
    this.elapsed = 0;
    this.pumps = 0;
    this.won = false;
    this.jets = [false, false];
    this.events = [];
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -210, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 14;
    this.world.solver.tolerance = .0001;
    this.world.allowSleep = false;
    this.plastic = new CANNON.Material('wet plastic');
    this.world.defaultContactMaterial.friction = .12;
    this.world.defaultContactMaterial.restitution = .12;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.plastic, this.plastic, {
      friction: .14,
      restitution: .12,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 4
    }));
    const box = (x, y, z, hx, hy, hz) => {
      const b = new CANNON.Body({
        mass: 0,
        material: this.plastic,
        position: new CANNON.Vec3(x, y, z)
      });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      this.world.addBody(b);
      return b;
    };
    box(210, 20, 0, 210, 8, 63);
    box(6, 290, 0, 6, 270, 63);
    box(414, 290, 0, 6, 270, 63);
    box(210, 558, 0, 210, 6, 63);
    box(210, 290, -61, 210, 280, 4);
    box(210, 290, 61, 210, 280, 4);
    for (const peg of PEGS) {
      const b = new CANNON.Body({
        mass: 0,
        material: this.plastic,
        position: new CANNON.Vec3(peg.x, (peg.tip + peg.base) / 2, 0)
      });
      b.addShape(new CANNON.Cylinder(3.7, 4.6, peg.tip - peg.base, 16));
      this.world.addBody(b);
      box(peg.x, peg.base - 7, 0, 29, 5, 27);
    }
    this.rings = PALETTE.map((color, i) => {
      const body = new CANNON.Body({
        mass: 1,
        material: this.plastic,
        position: new CANNON.Vec3(46 + i * 46, 49 + i % 2 * 8, i === 2 || i === 5 ? 34 : (i % 3 - 1) * 17),
        linearDamping: 0,
        angularDamping: .85
      });
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12;
        body.addShape(new CANNON.Sphere(TUBE_RADIUS), new CANNON.Vec3(Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS));
      }
      body.quaternion.setFromEuler((this.random() - .5) * .6, 0, (this.random() - .5) * .4);
      this.world.addBody(body);
      return {
        id: i,
        color,
        body,
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
        peg: null,
        stable: 0,
        scored: false
      };
    });
  }
  setJet(side, active) {
    if (this.jets[side] === active) return;
    this.jets[side] = active;
    if (active && !this.won) {
      this.started = true;
      this.pumps++;
      this.events.push({
        type: 'pump',
        side
      });
    }
  }
  get score() {
    return this.rings.filter(r => r.scored).length;
  }
  // Intersect the vertical post with the actual tilted torus plane, then test its hole.
  threadedPeg(r) {
    const n = r.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    if (Math.abs(n.y) < .22) return null;
    for (let p = 0; p < PEGS.length; p++) {
      const peg = PEGS[p],
        dx = peg.x - r.x,
        dz = peg.z - r.z;
      const y = r.y - (n.x * dx + n.z * dz) / n.y;
      const radial = Math.hypot(dx, y - r.y, dz);
      if (y > peg.base - 2 && y < peg.tip - 3 && radial < INNER_RADIUS - 3.2) return p;
    }
    return null;
  }
  applyWaterForces(r) {
    const b = r.body;
    // Gravity minus displaced-water buoyancy: effective submerged weight is ~35%.
    b.applyForce(new CANNON.Vec3(-b.velocity.x * 1.9, 136 - b.velocity.y * 2.05, -b.velocity.z * 2.4));
    const normal = b.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    const face = normal.y < 0 ? -1 : 1;
    b.torque.x -= normal.z * face * 115;
    b.torque.z += normal.x * face * 115;
    b.torque.x -= b.angularVelocity.x * 85;
    b.torque.y -= b.angularVelocity.y * 30;
    b.torque.z -= b.angularVelocity.z * 85;
    for (let j = 0; j < 2; j++) if (this.jets[j] && !this.won) {
      const nozzle = j === 0 ? 91 : 329;
      const center = nozzle + (j === 0 ? 1 : -1) * Math.min(52, Math.max(0, r.y - 160) * .33);
      const width = 36 + Math.max(0, r.y) * .24;
      const influence = (.18 + .82 * Math.exp(-(((r.x - center) / width) ** 2) - (r.z / 70) ** 2)) * Math.max(.3, 1 - r.y / 850);
      const thrust = 850 * influence;
      const force = new CANNON.Vec3((center - r.x) * 8 * influence + Math.sin(this.time * 6 + r.id) * 12 * influence, thrust, -r.z * 4.3 * influence);
      b.applyForce(force, new CANNON.Vec3(Math.sin(this.time * 2.7 + r.id) * .65, 0, Math.cos(this.time * 2 + r.id) * .45));
    }
  }
  step(dt) {
    this.time += dt;
    if (this.started && !this.won) this.elapsed += dt;
    for (const r of this.rings) this.applyWaterForces(r);
    this.world.step(dt);
    for (const r of this.rings) {
      const b = r.body;
      r.x = b.position.x;
      r.y = b.position.y;
      r.z = b.position.z;
      r.peg = this.threadedPeg(r);
      const stable = r.peg !== null && r.y < PEGS[r.peg].base + 82 && b.velocity.length() < 10 && b.angularVelocity.length() < 1.1;
      if (stable) r.stable += dt;else r.stable = 0;
      const was = r.scored;
      r.scored = r.stable >= .7;
      if (r.scored && !was) this.events.push({
        type: 'capture',
        id: r.id
      });
    }
    if (!this.won && this.score === this.rings.length) {
      this.won = true;
      this.jets = [false, false];
      this.events.push({
        type: 'win'
      });
    }
  }
}

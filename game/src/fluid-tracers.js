// Non-colliding dye/smoke tracers advected by the SAME approximate velocity field
// that pushes the rings. This visualizes a reduced-order model, not a fluid solver.
export class FluidTracers {
  constructor() {
    this.setReducedMotion(false);
    this.reset();
  }
  setReducedMotion(reduced) {
    this.reducedMotion = reduced;
    this.limit = reduced ? 36 : 128;
    this.emissionRate = reduced ? 12 : 42;
    if (this.particles?.length > this.limit) this.particles.splice(0, this.particles.length - this.limit);
  }
  reset() {
    this.particles = [];
    this.emission = [0, 0];
    this.sequence = 0;
  }
  step(dt, world) {
    for (let side = 0; side < 2; side++) {
      const state = world.jetStates[side];
      if (!state.active) { this.emission[side] = 0; continue; }
      this.emission[side] += dt * this.emissionRate * (.5 + state.pressure * .5);
      while (this.emission[side] >= 1) {
        this.emission[side]--;
        const id = this.sequence++;
        const x = (side === 0 ? 91 : 329) + Math.sin(id * 2.4) * 5;
        const z = Math.cos(id * 3.1) * 7;
        const flow = world.sampleFlow(x, 39, z);
        if (this.particles.length >= this.limit) this.particles.shift();
        this.particles.push({id, side, x, y:39, z, vx:flow.x*.8, vy:flow.y*.8, vz:flow.z*.8, age:0, life:3.8, size:2.5+(id%4)*.65});
      }
    }
    for (const p of this.particles) {
      p.age += dt;
      const flow = world.sampleFlow(p.x, p.y, p.z);
      const mix = 1 - Math.exp(-dt * 2.8);
      p.vx += (flow.x - p.vx) * mix;
      p.vy += (flow.y - p.vy) * mix;
      p.vz += (flow.z - p.vz) * mix;
      // Small coherent dispersion; spent plumes lose momentum and slowly fall.
      p.vx += Math.sin(p.id*1.7+world.time*2.3) * 13 * dt;
      p.vz += Math.cos(p.id*2.1+world.time*1.9) * 9 * dt;
      p.vy -= 13 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.x < 20 || p.x > 400) {p.x=Math.max(20,Math.min(400,p.x));p.vx*=-.2;}
      if (p.y > 540) {p.y=540;p.vy=-Math.abs(p.vy)*.15;}
      if (p.y < 32) {p.y=32;p.vy=0;}
      p.z = Math.max(-52, Math.min(52,p.z));
    }
    this.particles = this.particles.filter(p => p.age < p.life);
  }
}

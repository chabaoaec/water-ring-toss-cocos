// Permanent, non-colliding smoke-like dye distributed throughout the tank.
// The same sampleFlow that pushes rings advects these existing wisps. A gentle
// visual return drift and staggered, faded renewal keep the whole tank suspended;
// neither changes the rigid bodies, pump budget, or the fluid velocity sampler.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const noise=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
export class FluidTracers {
  constructor() {this.reducedMotion=false;this.limit=128;this.reset();}
  setReducedMotion(reduced) {
    const limit=reduced?36:128;
    if(this.limit===limit&&this.particles?.length===limit)return;
    this.reducedMotion=reduced;this.limit=limit;this.reset();
  }
  createParticle(id,initial=false) {
    const columns=this.reducedMotion?6:8,rows=this.limit/columns;
    const home={x:24+((id%columns)+.22+.56*noise(id+1))*372/columns,y:38+(Math.floor(id/columns)+.22+.56*noise(id+71))*496/rows,z:(noise(id+131)-.5)*84};
    const life=18+noise(id+181)*12;
    return {id,home,x:home.x,y:home.y,z:home.z,vx:0,vy:0,vz:0,age:initial?life*(.08+.72*noise(id+241)):0,life,size:3.6+noise(id+293)*3,phase:noise(id+349)*Math.PI*2};
  }
  reset() {this.particles=Array.from({length:this.limit},(_,id)=>this.createParticle(id,true));}
  step(dt,world) {
    for(let index=0;index<this.particles.length;index++) {
      let p=this.particles[index];p.age+=dt;
      if(p.age>=p.life) {p=this.createParticle(p.id);this.particles[index]=p;}
      const flow=world.sampleFlow(p.x,p.y,p.z),speed=Math.hypot(flow.x,flow.y,flow.z);
      // Local physical flow dominates whenever a pump is discharging or filling.
      // Away from it, slow resuspension avoids a floor pile or an empty upper tank.
      const quiet=1/(1+speed/16),phase=p.phase+world.time*.18;
      const returnX=clamp((p.home.x-p.x)*.13,-15,15);
      const returnY=clamp((p.home.y-p.y)*.13,-15,15);
      const returnZ=clamp((p.home.z-p.z)*.13,-7,7);
      const targetX=flow.x+quiet*(returnX+Math.sin(phase+p.y*.014)*1.7);
      const targetY=flow.y+quiet*(returnY+Math.cos(phase+p.x*.017)*1.25);
      const targetZ=flow.z+quiet*(returnZ+Math.sin(phase*.8)*.7);
      const mix=1-Math.exp(-dt*1.9);
      p.vx+=(targetX-p.vx)*mix;p.vy+=(targetY-p.vy)*mix;p.vz+=(targetZ-p.vz)*mix;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      if(p.x<20||p.x>400) {p.x=clamp(p.x,20,400);p.vx*=-.18;}
      if(p.y<32||p.y>540) {p.y=clamp(p.y,32,540);p.vy*=-.18;}
      if(p.z< -52||p.z>52) {p.z=clamp(p.z,-52,52);p.vz*=-.18;}
    }
  }
}

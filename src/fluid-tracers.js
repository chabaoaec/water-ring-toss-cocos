import {portCoordinate,nozzleCoordinate,FLOW_INTAKES,INITIAL_TANK_VOLUME,INITIAL_WATER_SURFACE,PUMP_CAPACITY} from './recirculating-flow.js?v=dac88d6e5afbc69b7d8a';
import {reflectWaterParcel} from './water-parcel-boundary.js?v=dac88d6e5afbc69b7d8a';
// Fixed passive marker pool, including water temporarily inside the pump.
// Midpoint RK2 follows the shared tank field; no home force or lifetime renewal.
const noise=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const INTAKES=FLOW_INTAKES;
export class FluidTracers {
  constructor() {this.reducedMotion=false;this.limit=128;this.reset();}
  setReducedMotion(reduced) {
    const limit=reduced?36:128;
    if(this.limit===limit&&this.particles?.length===limit)return;
    this.reducedMotion=reduced;this.limit=limit;this.reset(this.lastWorld);
  }
  createParticle(id,total=this.limit,surfaceY=INITIAL_WATER_SURFACE) {
    const columns=this.reducedMotion?6:8,rows=Math.ceil(total/columns);
    return {id,x:24+((id%columns)+.22+.56*noise(id+1))*372/columns,y:38+(Math.floor(id/columns)+.22+.56*noise(id+71))*(surfaceY-44)/rows,z:(noise(id+131)-.5)*84,vx:0,vy:0,vz:0,inChamber:null,size:3.6+noise(id+293)*3,phase:noise(id+349)*Math.PI*2};
  }
  // An explicit reset/quality toggle may rebuild the visual pool; ordinary
  // simulation never does. Quality changes seed the CURRENT volume/chambers.
  reset(world) {
    this.boundaryFailures=0;
    const surfaceY=world?.water?.surfaceY??INITIAL_WATER_SURFACE,total=world?.water?.total??(INITIAL_TANK_VOLUME+2*PUMP_CAPACITY);
    const remaining=world?.jetStates?.map(s=>s.remaining)??[PUMP_CAPACITY,PUMP_CAPACITY],discharged=world?.water?.discharged??[0,0];
    this.particles=Array.from({length:this.limit},(_,id)=>this.createParticle(id,this.limit,surfaceY));
    // Seed the initial chamber water with the same approximate marker density.
    for(let side=0;side<2;side++) {
      const counts=remaining.map(v=>Math.round(this.limit*v/total)),offset=side===0?0:counts[0];
      const bank=this.particles.filter(p=>{const rank=(p.id*53)%this.limit;return rank>=offset&&rank<offset+counts[side];});
      bank.forEach((p,i)=>Object.assign(p,{inChamber:side,pipeFraction:(i+.5)/bank.length,exitVolume:discharged[side]+remaining[side]*(i+.5)/bank.length}));
    }
    const tank=this.particles.filter(p=>p.inChamber===null);
    tank.forEach((p,i)=>{const seed=this.createParticle(i,tank.length,surfaceY);p.x=seed.x;p.y=seed.y;p.z=seed.z;if(!reflectWaterParcel(p,world?.getWaterSurface?.()))this.boundaryFailures++;});
  }
  step(dt,world) {
    this.lastWorld=world;
    const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
    for(let step=0;step<steps;step++)for(const p of this.particles) {
      let start=step/steps,duration=h;
      if(p.inChamber!==null) {
        const side=p.inChamber,old=world.water?.previousDischarged[side]??0,now=world.water?.discharged[side]??0;
        if(now<p.exitVolume||now<=old)continue;
        const exit=Math.max(start,(p.exitVolume-old)/(now-old));
        if(exit>(step+1)/steps)continue;
        // FIFO parcel exits the represented pipe at its nozzle flux coordinate.
        // This explicit transport changes visibility, never identity or count.
        p.x=nozzleCoordinate(p.pipeFraction,side);p.y=32;p.inChamber=null;
        duration=((step+1)/steps-exit)*dt;start=exit;
      }
      const first=world.sampleFlow(p.x,p.y,p.z,start);
      const mid=world.sampleFlow(p.x+first.x*duration/2,p.y+first.y*duration/2,p.z+first.z*duration/2,start+duration/(2*dt));
      p.vx=mid.x;p.vy=mid.y;p.vz=mid.z;
      p.x+=mid.x*duration;p.y+=mid.y*duration;p.z+=mid.z*duration;
      if(p.y<32&&world.water) {
        const side=p.x<210?0:1;
        if(world.jetStates[side].volumeRate<0) {
          p.inChamber=side;p.pipeFraction=portCoordinate(p.x,side,INTAKES);
          p.exitVolume=world.water.discharged[side]+world.jetStates[side].remaining;
        }
      }
      if(p.inChamber===null&&!reflectWaterParcel(p,world.getWaterSurface?.()))this.boundaryFailures++;
    }
  }
}

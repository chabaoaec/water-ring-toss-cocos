import * as CANNON from '../vendor/cannon-es.js';
import {FluidTracers} from './fluid-tracers.js';
export const PEGS = [{x:143,z:0,tip:322,base:36},{x:277,z:0,tip:322,base:36}];
export const PALETTE = ['#f38b78','#b69af2','#f4c95c','#74cbbb','#ed8faf','#91a7ed','#f5b76e','#add68e'];
export const RING_RADIUS = 19, TUBE_RADIUS = 3.6, INNER_RADIUS = RING_RADIUS - TUBE_RADIUS;
export const JET_CAPACITY = .8, JET_RAMP_SECONDS = .55, JET_MIN_PRESSURE = .42;
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export function makeRandom(seed=42) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function pegRadiusAtY(peg,y) {return 4.6+(3.7-4.6)*clamp((y-peg.base)/(peg.tip-peg.base),0,1);}
const smoothstep = x => x*x*(3-2*x);
export class WaterWorld {
  constructor(seed=42) {this.tracers=new FluidTracers();this.reset(seed);}
  reset(seed=42) {
    this.random=makeRandom(seed);this.time=0;this.started=false;this.elapsed=0;this.pumps=0;this.won=false;
    this.held=[false,false];this.jets=[false,false];this.events=[];this.tracers.reset();
    this.jetStates=[0,1].map(()=>({held:false,active:false,remaining:JET_CAPACITY,elapsed:0,pressure:0,exhausted:false}));
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-210,0)});
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.solver.iterations=14;this.world.solver.tolerance=.0001;this.world.allowSleep=false;
    this.ringMaterial=new CANNON.Material('elastic wet ring');
    this.staticMaterial=new CANNON.Material('wet shell and posts');
    this.world.defaultContactMaterial.friction=.12;this.world.defaultContactMaterial.restitution=.1;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.ringMaterial,this.ringMaterial,{friction:.12,restitution:.52,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.ringMaterial,this.staticMaterial,{friction:.12,restitution:.1,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.supportBases=new Map();
    const box=(x,y,z,hx,hy,hz)=>{const b=new CANNON.Body({mass:0,material:this.staticMaterial,position:new CANNON.Vec3(x,y,z)});b.addShape(new CANNON.Box(new CANNON.Vec3(hx,hy,hz)));this.world.addBody(b);return b;};
    box(210,20,0,210,8,63);box(6,290,0,6,270,63);box(414,290,0,6,270,63);box(210,558,0,210,6,63);box(210,290,-61,210,280,4);box(210,290,61,210,280,4);
    for(const [index,peg] of PEGS.entries()) {
      const post=new CANNON.Body({mass:0,material:this.staticMaterial,position:new CANNON.Vec3(peg.x,(peg.tip+peg.base)/2,0)});
      post.addShape(new CANNON.Cylinder(3.7,4.6,peg.tip-peg.base,16));this.world.addBody(post);
      const platform=box(peg.x,peg.base-7,0,29,5,27);this.supportBases.set(platform.id,index);
    }
    this.rings=PALETTE.map((color,i)=>{
      const body=new CANNON.Body({mass:1,material:this.ringMaterial,position:new CANNON.Vec3(46+i*46,49+(i%2)*8,i===2||i===5?34:(i%3-1)*17),linearDamping:0,angularDamping:.85});
      for(let k=0;k<24;k++){const a=k*Math.PI/12;body.addShape(new CANNON.Sphere(TUBE_RADIUS),new CANNON.Vec3(Math.cos(a)*RING_RADIUS,0,Math.sin(a)*RING_RADIUS));}
      body.quaternion.setFromEuler((this.random()-.5)*.6,0,(this.random()-.5)*.4);this.world.addBody(body);
      return {id:i,color,body,x:body.position.x,y:body.position.y,z:body.position.z,peg:null,supported:false,supportedBy:null,stable:0,scored:false};
    });
  }
  // 'held' is the aggregate input edge, not active flow. Repeated true cannot refill.
  setJet(side,held) {
    const state=this.jetStates[side];
    if(this.held[side]===held)return;
    this.held[side]=held;state.held=held;
    if(!held) {Object.assign(state,{active:false,remaining:JET_CAPACITY,elapsed:0,pressure:0,exhausted:false});this.jets[side]=false;return;}
    if(this.won)return;
    Object.assign(state,{active:true,remaining:JET_CAPACITY,elapsed:0,pressure:JET_MIN_PRESSURE,exhausted:false});
    this.jets[side]=true;this.started=true;this.pumps++;this.events.push({type:'pump',side});
  }
  updateJets(dt) {
    for(let side=0;side<2;side++) {
      const state=this.jetStates[side];
      if(!state.active)continue;
      state.elapsed+=dt;
      state.pressure=JET_MIN_PRESSURE+(1-JET_MIN_PRESSURE)*smoothstep(clamp(state.elapsed/JET_RAMP_SECONDS,0,1));
      state.remaining=Math.max(0,state.remaining-state.pressure*dt);
      if(state.remaining===0||this.won){state.active=false;state.exhausted=state.held;state.pressure=0;this.jets[side]=false;}
    }
  }
  get score() {return this.rings.filter(r=>r.scored).length;}
  // Velocity of the same approximate water field used by force and dye tracers.
  sampleFlow(x,y,z) {
    const flow={x:0,y:0,z:0};
    for(let side=0;side<2;side++) {
      const state=this.jetStates[side];if(!state.active)continue;
      const nozzle=side===0?91:329;
      const center=nozzle+(side===0?1:-1)*Math.min(52,Math.max(0,y-160)*.33);
      const width=36+Math.max(0,y)*.24;
      const plume=Math.exp(-(((x-center)/width)**2)-((z/70)**2));
      const attenuation=Math.max(.3,1-y/850)*state.pressure;
      const influence=(.18+.82*plume)*attenuation;
      // The weak background uplift is not a tank-wide lateral tow; nearby plumes
      // steer rings, while a far-side pulse need not drag a seated opposite stack.
      const lateral=plume*attenuation;
      flow.x+=((center-x)*4.2+Math.sin(this.time*6+x*.03+z*.08)*6)*lateral;
      flow.y+=410*influence;
      flow.z+=(-z*1.8+Math.sin(this.time*2+x*.05)*2)*influence;
    }
    return flow;
  }
  // Conservative circle enclosing the tapered post's elliptical cut by ring plane.
  threadedPeg(r) {
    const n=r.body.quaternion.vmult(new CANNON.Vec3(0,1,0));
    if(Math.abs(n.y)<.22)return null;
    for(let p=0;p<PEGS.length;p++) {
      const peg=PEGS[p],dx=peg.x-r.x,dz=peg.z-r.z;
      const y=r.y-(n.x*dx+n.z*dz)/n.y;
      const radial=Math.hypot(dx,y-r.y,dz);
      const postSection=pegRadiusAtY(peg,y)/Math.abs(n.y);
      if(y>peg.base-2&&y<peg.tip-3&&radial+postSection+.35<INNER_RADIUS)return p;
    }
    return null;
  }
  applyWaterForces(r) {
    const b=r.body;
    b.applyForce(new CANNON.Vec3(-b.velocity.x*1.9,136-b.velocity.y*2.05,-b.velocity.z*2.4));
    const normal=b.quaternion.vmult(new CANNON.Vec3(0,1,0)),face=normal.y<0?-1:1;
    b.torque.x-=normal.z*face*115;b.torque.z+=normal.x*face*115;
    b.torque.x-=b.angularVelocity.x*85;b.torque.y-=b.angularVelocity.y*30;b.torque.z-=b.angularVelocity.z*85;
    const flow=this.sampleFlow(r.x,r.y,r.z);
    b.applyForce(new CANNON.Vec3(flow.x*1.9,flow.y*2.05,flow.z*2.4),new CANNON.Vec3(Math.sin(this.time*2.7+r.id)*.65,0,Math.cos(this.time*2+r.id)*.45));
  }
  // Only actual upward, loaded contacts rooted in that post's platform qualify.
  // Side contacts on posts/walls are never roots; unrooted ring cycles cannot pass.
  resolveSupport() {
    const byBody=new Map(this.rings.map(r=>[r.body.id,r]));
    const rooted=new Map();const edges=[];
    for(const c of this.world.contacts) {
      if(!c.enabled||c.multiplier<=.05)continue;
      for(const [body,other,upward] of [[c.bi,c.bj,-c.ni.y],[c.bj,c.bi,c.ni.y]]) {
        const upper=byBody.get(body.id);if(!upper||upward<.45)continue;
        if(this.supportBases.has(other.id)) {
          const peg=this.supportBases.get(other.id);
          rooted.set(`${upper.id}:${peg}`,{kind:'base',bodyId:other.id,peg});
        }
        const lower=byBody.get(other.id);
        if(lower&&lower.y<upper.y-TUBE_RADIUS*.5)edges.push({upper,lower});
      }
    }
    for(let pass=0;pass<this.rings.length;pass++) {
      let changed=false;
      for(const {upper,lower} of edges)for(let peg=0;peg<PEGS.length;peg++) {
        const key=`${upper.id}:${peg}`;
        if(!rooted.has(key)&&rooted.has(`${lower.id}:${peg}`)) {rooted.set(key,{kind:'ring',ringId:lower.id,peg});changed=true;}
      }
      if(!changed)break;
    }
    const supports=new Map();
    for(const r of this.rings)if(r.peg!==null&&rooted.has(`${r.id}:${r.peg}`))supports.set(r.id,rooted.get(`${r.id}:${r.peg}`));
    return supports;
  }
  step(dt) {
    this.time+=dt;if(this.started&&!this.won)this.elapsed+=dt;
    this.updateJets(dt);
    for(const r of this.rings)this.applyWaterForces(r);
    this.world.step(dt);
    for(const r of this.rings) {const p=r.body.position;r.x=p.x;r.y=p.y;r.z=p.z;r.peg=this.threadedPeg(r);}
    const supports=this.resolveSupport();
    for(const r of this.rings) {
      r.supported=supports.has(r.id);r.supportedBy=supports.get(r.id)??null;
      const stable=r.supported&&r.body.velocity.length()<10&&r.body.angularVelocity.length()<1.1;
      r.stable=stable?r.stable+dt:0;
      const was=r.scored;r.scored=r.stable>=.7;
      if(r.scored&&!was)this.events.push({type:'capture',id:r.id});
    }
    this.tracers.step(dt,this);
    if(!this.won&&this.score===this.rings.length) {
      this.won=true;for(let side=0;side<2;side++)this.setJet(side,false);this.events.push({type:'win'});
    }
  }
}

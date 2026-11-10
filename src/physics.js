import * as CANNON from '../vendor/cannon-es.js?v=4ca47e03e619b998ee99';
import {FluidTracers} from './fluid-tracers.js?v=4ca47e03e619b998ee99';
import {createWaterSurfaceCache} from './water-surface.js?v=4ca47e03e619b998ee99';
import {createWaterInertia,advanceWaterInertia,sampleWaterInertia,boundedAcceleration,GAME_ACCELERATION_PER_MPS2} from './inertial-water.js?v=4ca47e03e619b998ee99';
import {sampleRecirculatingFlow,FLOW_INTAKES,INITIAL_TANK_VOLUME,INITIAL_WATER_SURFACE,PUMP_CAPACITY,WATER_AREA,advanceCirculation,FLOW_BOUNDS} from './recirculating-flow.js?v=4ca47e03e619b998ee99';
export const PEGS = [{x:143,z:0,tip:322,base:36},{x:277,z:0,tip:322,base:36}];
export const INTAKES = FLOW_INTAKES;
export const REFILL_SECONDS = .7;
export const PALETTE = ['#f38b78','#b69af2','#f4c95c','#74cbbb','#ed8faf','#91a7ed','#f5b76e','#add68e'];
// Same ring volume:5% more mass increases density; displaced-water buoyancy stays fixed.
export const RING_MASS = 1.05;
export const RING_RADIUS = 19, TUBE_RADIUS = 3.6, INNER_RADIUS = RING_RADIUS - TUBE_RADIUS;
export const JET_CAPACITY = PUMP_CAPACITY, JET_RAMP_SECONDS = .55, JET_MIN_PRESSURE = .42;
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export function makeRandom(seed=42) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function pegRadiusAtY(peg,y) {return 4.6+(3.7-4.6)*clamp((y-peg.base)/(peg.tip-peg.base),0,1);}
const smoothstep = x => x*x*(3-2*x);
// Circumscribed unit polygon: its affine image encloses the entire post ellipse.
// A convex distance function is maximal at a polygon vertex, not between them.
const POST_SECTION_VERTICES=Array.from({length:32},(_,i)=>{
  const angle=i*Math.PI/16,scale=1/Math.cos(Math.PI/32);
  return [Math.cos(angle)*scale,Math.sin(angle)*scale];
});
export class WaterWorld {
  constructor(seed=42) {this.tracers=new FluidTracers();this.reset(seed);}
  reset(seed=42) {
    this.random=makeRandom(seed);this.time=0;this.started=false;this.elapsed=0;this.pumps=0;this.won=false;this.paused=false;
    this.water={initialTank:INITIAL_TANK_VOLUME,tank:INITIAL_TANK_VOLUME,total:INITIAL_TANK_VOLUME+2*JET_CAPACITY,initialChambers:[JET_CAPACITY,JET_CAPACITY],discharged:[0,0],intaken:[0,0],area:WATER_AREA,surfaceY:INITIAL_WATER_SURFACE,previousSurfaceY:INITIAL_WATER_SURFACE,previousDischarged:[0,0]};
    this.held=[false,false];this.jets=[false,false];this.events=[];this.tracers.reset();
    this.jetStates=[0,1].map(()=>({held:false,active:false,refilling:false,intakeStrength:0,remaining:JET_CAPACITY,elapsed:0,pressure:0,volumeRate:0,circulation:0,intakeCirculation:0,exhausted:false}));
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-210,0)});
    this.gravityDirection={x:0,y:-1,z:0};
    this.deviceAcceleration={x:0,y:0,z:0};this.waterInertia=createWaterInertia();
    this.surfaceCache=createWaterSurfaceCache();this.waterSurface=null;
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.solver.iterations=14;this.world.solver.tolerance=.0001;this.world.allowSleep=false;
    // Thin tank walls and tall posts have very loose bounding spheres. Use
    // Cannon's conservative compound AABBs to skip distant narrowphase work.
    this.world.broadphase.useBoundingBoxes=true;
    // Cannon's friction bounds are used as solver impulses. Bound the aggregate
    // wet static-body contact patch once, rather than giving each torus sphere
    // an independent gravity-sized impulse budget at every120Hz step.
    const solve=this.world.solver.solve.bind(this.world.solver);
    this.world.solver.solve=(dt,world)=>{this.limitWetStaticFriction(dt);return solve(dt,world);};
    this.ringMaterial=new CANNON.Material('elastic wet ring');
    this.staticMaterial=new CANNON.Material('wet shell and posts');
    this.world.defaultContactMaterial.friction=.12;this.world.defaultContactMaterial.restitution=.1;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.ringMaterial,this.ringMaterial,{friction:.12,restitution:.52,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.ringMaterial,this.staticMaterial,{friction:.12,restitution:.1,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.supportBases=new Map();
    const box=(x,y,z,hx,hy,hz)=>{const b=new CANNON.Body({mass:0,material:this.staticMaterial,position:new CANNON.Vec3(x,y,z)});b.addShape(new CANNON.Box(new CANNON.Vec3(hx,hy,hz)));this.world.addBody(b);return b;};
    // All six collider inner faces agree with the fluid box; no dry strips in
    // which a flat or edge-on torus can come to rest outside its water sampler.
    box(210,24,0,210,8,63);box(10,290,0,10,270,63);box(410,290,0,10,270,63);box(210,546,0,210,6,63);box(210,290,-56,210,280,4);box(210,290,56,210,280,4);
    for(const [index,peg] of PEGS.entries()) {
      const post=new CANNON.Body({mass:0,material:this.staticMaterial,position:new CANNON.Vec3(peg.x,(peg.tip+peg.base)/2,0)});
      post.addShape(new CANNON.Cylinder(3.7,4.6,peg.tip-peg.base,16));this.world.addBody(post);
      const platform=box(peg.x,peg.base-7,0,29,5,27);this.supportBases.set(platform.id,index);
    }
    this.rings=PALETTE.map((color,i)=>{
      // Depth28 keeps the two offset rings clear of both posts and ±52 walls.
      const body=new CANNON.Body({mass:RING_MASS,material:this.ringMaterial,position:new CANNON.Vec3(46+i*46,49+(i%2)*8,i===2||i===5?28:(i%3-1)*17),linearDamping:0,angularDamping:.85});
      for(let k=0;k<24;k++){const a=k*Math.PI/12;body.addShape(new CANNON.Sphere(TUBE_RADIUS),new CANNON.Vec3(Math.cos(a)*RING_RADIUS,0,Math.sin(a)*RING_RADIUS));}
      body.quaternion.setFromEuler((this.random()-.5)*.6,0,(this.random()-.5)*.4);this.world.addBody(body);
      return {id:i,color,body,x:body.position.x,y:body.position.y,z:body.position.z,peg:null,supported:false,supportedBy:null,stable:0,scored:false};
    });
  }
  // A new input edge starts a stroke with CURRENT water; neither edge creates it.
  setJet(side,held) {
    const state=this.jetStates[side];
    if(this.held[side]===held||(held&&this.paused))return;
    this.held[side]=held;state.held=held;
    state.elapsed=0;state.pressure=0;state.intakeStrength=0;state.volumeRate=0;
    if(!held) {
      state.active=false;state.exhausted=false;this.jets[side]=false;
      state.refilling=!this.paused&&!this.won&&state.remaining<JET_CAPACITY;
      return;
    }
    state.refilling=false;state.active=!this.won&&state.remaining>1e-10;
    state.exhausted=!state.active;this.jets[side]=state.active;
    if(state.active) {
      state.pressure=JET_MIN_PRESSURE;this.started=true;this.pumps++;
      this.events.push({type:'pump',side});
    }
  }
  setPaused(value) {
    this.paused=value;
    if(value)this.setDeviceAcceleration({x:0,y:0,z:0});
    for(let side=0;side<2;side++) {
      const state=this.jetStates[side];
      if(value) {this.held[side]=false;state.held=false;state.exhausted=false;}
      state.active=false;state.pressure=0;state.intakeStrength=0;state.volumeRate=0;this.jets[side]=false;
      state.refilling=!value&&!state.held&&!this.won&&state.remaining<JET_CAPACITY;
    }
  }
  updateJets(dt) {
    this.water.previousSurfaceY=this.water.surfaceY;
    this.water.previousDischarged=[...this.water.discharged];
    for(let side=0;side<2;side++) {
      const state=this.jetStates[side];
      state.active=false;state.refilling=false;state.pressure=0;state.intakeStrength=0;state.volumeRate=0;
      if(this.won)continue;
      if(state.held) {
        state.elapsed+=dt;
        const requested=JET_MIN_PRESSURE+(1-JET_MIN_PRESSURE)*smoothstep(clamp(state.elapsed/JET_RAMP_SECONDS,0,1));
        const discharged=Math.min(state.remaining,requested*dt);
        state.remaining=Math.max(0,state.remaining-discharged);
        this.water.discharged[side]+=discharged;this.water.tank+=discharged;
        state.active=discharged>1e-12;state.pressure=discharged/dt;state.volumeRate=discharged/dt;
        state.exhausted=state.remaining<=0;
      } else if(state.remaining<JET_CAPACITY) {
        const rate=JET_CAPACITY/REFILL_SECONDS;
        const intaken=Math.min(JET_CAPACITY-state.remaining,rate*dt,this.water.tank);
        state.remaining+=intaken;this.water.tank-=intaken;this.water.intaken[side]+=intaken;
        state.refilling=intaken>1e-12;state.intakeStrength=intaken/(rate*dt);state.volumeRate=-intaken/dt;
        state.exhausted=false;
      }
      this.jets[side]=state.active;
    }
    for(const state of this.jetStates)advanceCirculation(state,dt);
    this.water.surfaceY=32+this.water.tank/this.water.area;
    advanceWaterInertia(this.waterInertia,this.deviceAcceleration,dt);
    this.waterSurface=this.surfaceCache.get({gravity:this.gravityDirection,volume:this.water.tank,area:this.water.area});
  }
  finalizePumpFlows() {
    for(let side=0;side<2;side++) {
      const state=this.jetStates[side];
      if(state.remaining<=0) {state.remaining=0;state.active=false;state.pressure=0;state.volumeRate=0;this.jets[side]=false;}
      if(state.remaining>=JET_CAPACITY) {state.remaining=JET_CAPACITY;state.refilling=false;state.intakeStrength=0;state.volumeRate=0;}
    }
  }
  get score() {return this.rings.filter(r=>r.scored).length;}
  // One bounded incompressible kinematic field for ring drag and passive markers.
  getWaterSurfaceY() {return this.water.surfaceY;}
  getWaterSurface() {
    if(!this.waterSurface)this.waterSurface=this.surfaceCache.get({gravity:this.gravityDirection,volume:this.water.tank,area:this.water.area});
    return this.waterSurface;
  }
  sampleFlow(x,y,z,phase=1) {
    const surface=this.water.previousSurfaceY+(this.water.surfaceY-this.water.previousSurfaceY)*phase;
    const hydrostatic=this.getWaterSurface();
    const flow=sampleRecirculatingFlow(x,y,z,this.jetStates,INTAKES,surface,this.water.area,phase,hydrostatic);
    const inertia=sampleWaterInertia(x,y,z,this.waterInertia,FLOW_BOUNDS,hydrostatic,phase);
    flow.x+=inertia.x;flow.y+=inertia.y;flow.z+=inertia.z;return flow;
  }
  // Contain a conservative post-section ellipse in the actual ring-plane hole.
  // A large enclosing circle loses offset direction and rejects valid tilt poses.
  threadedPeg(r) {
    const n=r.body.quaternion.vmult(new CANNON.Vec3(0,1,0)),ny=Math.abs(n.y);
    if(ny<.22)return null;
    const horizontal=Math.hypot(n.x,n.z),tilt=horizontal/ny,limit=INNER_RADIUS-.35;
    for(let p=0;p<PEGS.length;p++) {
      const peg=PEGS[p],dx=peg.x-r.x,dz=peg.z-r.z;
      const projection=n.x*dx+n.z*dz,y=r.y-projection/n.y;
      if(y<=peg.base-2||y>=peg.tip-3)continue;
      const radial=Math.hypot(dx,y-r.y,dz),slope=Math.abs((3.7-4.6)/(peg.tip-peg.base));
      // r_section <= r_axis + |slope|*r_section*tan(tilt). The true
      // truncated post also has the global radius bound4.6, including its caps.
      const radius=Math.min(4.6,pegRadiusAtY(peg,y)/(1-slope*tilt)),major=radius/ny;
      if(radial+major<limit)return p;
      if(radial+radius>=limit||horizontal<1e-10)continue;
      // Major axis is the vertical direction projected into the ring plane;
      // minor axis is horizontal and perpendicular to the post/normal plane.
      const u=-projection/(horizontal*n.y),v=(n.x*dz-n.z*dx)/horizontal;
      let contained=true;
      for(const [cos,sin]of POST_SECTION_VERTICES) {
        const a=u+major*cos,b=v+radius*sin;
        if(a*a+b*b>=limit*limit){contained=false;break;}
      }
      // The hole-plane test alone misses tube thickness at steep tilt. Only
      // newly accepted poses also need all24actual spheres to clear a round
      // tapered frustum enclosing the16-sided Cannon post. The circle fast
      // path uses the stronger taper bound too; the extra3D clearance guarantee
      // applies only to this new directional branch. No body positions change.
      if(contained&&this.postClearsRing(r,peg))return p;
    }
    return null;
  }
  postClearsRing(r,peg) {
    const slope=(3.7-4.6)/(peg.tip-peg.base),intercept=4.6-slope*peg.base;
    const point=new CANNON.Vec3();
    for(const local of r.body.shapeOffsets) {
      r.body.quaternion.vmult(local,point);
      const y0=r.y+point.y,rho=Math.hypot(r.x+point.x-peg.x,r.z+point.z-peg.z);
      // Closest point in the closed frustum's radial-height section. The
      // objective is max(rho-r(y),0)^2+(y-y0)^2, convex and piecewise quadratic.
      const projected=clamp((y0+slope*(rho-intercept))/(1+slope*slope),peg.base,peg.tip);
      let minimum=Infinity;
      for(const y of [peg.base,peg.tip,clamp(y0,peg.base,peg.tip),projected]) {
        const outside=Math.max(0,rho-intercept-slope*y);
        minimum=Math.min(minimum,outside*outside+(y-y0)*(y-y0));
      }
      if(minimum<TUBE_RADIUS*TUBE_RADIUS)return false;
    }
    return true;
  }
  setGravityDirection(direction) {
    const {x,y,z}=direction??{},length=Math.hypot(x,y,z);
    if(!Number.isFinite(length)||length<1e-8)return false;
    this.gravityDirection={x:x/length,y:y/length,z:z/length};
    this.world.gravity.set(210*x/length,210*y/length,210*z/length);
    this.waterSurface=null;
    return true;
  }
  setDeviceAcceleration(acceleration) {
    this.deviceAcceleration=boundedAcceleration(acceleration);
  }
  limitWetStaticFriction(dt) {
    const patches=new Map(),key=(a,b)=>a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`;
    for(const c of this.world.contacts) {
      if((c.bi.invMass>0&&c.bj.invMass>0)||!c.enabled)continue;
      const inverseMass=c.bi.invMass+c.bj.invMass;if(inverseMass<=0)continue;
      const pair=key(c.bi,c.bj),patch=patches.get(pair)??{count:0,load:0,mass:1/inverseMass};
      // Gravity has already been added to body.force before solver.solve.
      const ax=c.bi.force.x*c.bi.invMass-c.bj.force.x*c.bj.invMass;
      const ay=c.bi.force.y*c.bi.invMass-c.bj.force.y*c.bj.invMass;
      const az=c.bi.force.z*c.bi.invMass-c.bj.force.z*c.bj.invMass;
      patch.load+=Math.max(0,(ax*c.ni.x+ay*c.ni.y+az*c.ni.z)*patch.mass);patch.count++;
      patches.set(pair,patch);
    }
    const gravity=(this.world.frictionGravity??this.world.gravity).length();
    for(const f of this.world.frictionEquations) {
      const patch=patches.get(key(f.bi,f.bj));if(!patch||gravity<=0)continue;
      const mu=f.maxForce/(gravity*patch.mass);
      const impulse=mu*(patch.load/patch.count)*dt/patch.count;
      f.maxForce=impulse;f.minForce=-impulse;
    }
  }
  applyWaterForces(r) {
    const b=r.body,g=this.gravityDirection;
    const normal=b.quaternion.vmult(new CANNON.Vec3(0,1,0));
    const up=new CANNON.Vec3(-g.x,-g.y,-g.z),face=normal.dot(up)<0?-1:1;
    const surface=this.getWaterSurface(),alignment=normal.dot(surface.normal);
    const extent=RING_RADIUS*Math.sqrt(Math.max(0,1-alignment*alignment))+TUBE_RADIUS;
    const wet=clamp((surface.signedDepth(b.position)+extent)/(2*extent),0,1);
    const restoring=normal.cross(up).scale(face*115*wet);
    b.torque.vadd(restoring,b.torque);
    b.torque.x-=b.angularVelocity.x*85*wet;b.torque.y-=b.angularVelocity.y*30*wet;b.torque.z-=b.angularVelocity.z*85*wet;
    const flow=this.sampleFlow(r.x,r.y,r.z,.5);
    b.applyForce(new CANNON.Vec3((-g.x*136-b.velocity.x*1.9)*wet,(-g.y*136-b.velocity.y*2.05)*wet,(-g.z*136-b.velocity.z*2.4)*wet));
    // In the accelerating container frame use -a; pressure buoyancy displaces
    // the submerged fluid mass, leaving the density-contrast response.
    const accelerationMass=b.mass-(136/210)*wet,device=this.deviceAcceleration;
    b.applyForce(new CANNON.Vec3(-device.x*GAME_ACCELERATION_PER_MPS2*accelerationMass,-device.y*GAME_ACCELERATION_PER_MPS2*accelerationMass,-device.z*GAME_ACCELERATION_PER_MPS2*accelerationMass));
    // Centre-sampled bulk drag acts at the centre of mass. Collisions and
    // restoring water torque still rotate the ring; no arbitrary lever pumps spin.
    b.applyForce(new CANNON.Vec3(flow.x*1.9*wet,flow.y*2.05*wet,flow.z*2.4*wet));
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
    if(this.paused)return;
    this.time+=dt;if(this.started&&!this.won)this.elapsed+=dt;
    this.updateJets(dt);
    for(const r of this.rings)this.applyWaterForces(r);
    this.world.step(dt);
    for(const r of this.rings) {
      const p=r.body.position,previousPeg=r.peg;r.x=p.x;r.y=p.y;r.z=p.z;r.peg=this.threadedPeg(r);
      // A captured ring remains captured through numerical contact-chain gaps;
      // only genuinely leaving that post clears its capture and qualification.
      if(r.peg!==previousPeg){r.stable=0;r.scored=false;}
    }
    const supports=this.resolveSupport();
    for(const r of this.rings) {
      r.supported=supports.has(r.id);r.supportedBy=supports.get(r.id)??null;
      const stable=r.supported&&r.body.velocity.length()<10&&r.body.angularVelocity.length()<1.1;
      r.stable=stable?r.stable+dt:0;
      const was=r.scored;r.scored=r.peg!==null&&(was||r.stable>=.7);
      if(r.scored&&!was)this.events.push({type:'capture',id:r.id});
    }
    this.tracers.step(dt,this);
    this.finalizePumpFlows();
    if(!this.won&&this.score===this.rings.length) {
      this.won=true;for(let side=0;side<2;side++){this.setJet(side,false);Object.assign(this.jetStates[side],{active:false,refilling:false,pressure:0,intakeStrength:0,volumeRate:0});this.jets[side]=false;}this.events.push({type:'win'});
    }
  }
}

// Bounded kinematic water approximation, not a CFD/free-surface solver.
// Units are game length units/s. The constant-cross-section water height follows
// the chamber ledger exactly. The surface stays horizontal even with gravity
// tilt: no hydrostatic tilted plane, slosh, viscosity, or resolved fluid obstacles.
export const FLOW_INTAKES=Object.freeze([{x:42,y:74,z:0},{x:378,y:74,z:0}]);
export const FLOW_BOUNDS=Object.freeze({left:20,right:400,bottom:32,top:540,back:-52,front:52});
export const INITIAL_TANK_VOLUME=48,INITIAL_WATER_SURFACE=520,PUMP_CAPACITY=.8;
export const WATER_AREA=INITIAL_TANK_VOLUME/(INITIAL_WATER_SURFACE-FLOW_BOUNDS.bottom);
export const BULK_ATTACK_SECONDS=.12,BULK_DECAY_SECONDS=.65;
export const INTAKE_ATTACK_SECONDS=.08,INTAKE_DECAY_SECONDS=.4;
// These bounded circulation amplitudes retain momentum, not extra pump volume.
// Analytic first-order relaxation is a low-dimensional dissipation approximation,
// not a pressure/momentum PDE. A zero-input mode loses ~99.9% in4.5s.
export function advanceCirculation(state,dt) {
  for(const [name,target,attack,decay] of [['circulation',state.pressure,BULK_ATTACK_SECONDS,BULK_DECAY_SECONDS],['intakeCirculation',state.intakeStrength,INTAKE_ATTACK_SECONDS,INTAKE_DECAY_SECONDS]]) {
    const start=state[name]??0,tau=target>start?attack:decay;
    state[name+'Start']=start;state[name+'Target']=target;state[name+'Tau']=tau;
    state[name]=target+(start-target)*Math.exp(-dt/tau);
  }
  state.circulationStep=dt;
}
export function circulationAt(state,name,phase=1) {
  if(state[name+'Start']===undefined)return state[name]??(name==='circulation'?(state.active?state.pressure:0):(state.refilling?state.intakeStrength:0));
  return state[name+'Target']+(state[name+'Start']-state[name+'Target'])*Math.exp(-state.circulationStep*phase/state[name+'Tau']);
}
const W=380,PLUME_WIDTH=120,PLUME_SPEED=650;
// Integral of the compact C2 bump (1-q²)^3. Its derivative is bump(q).
const bump=q=>Math.abs(q)<1?(1-q*q)**3:0;
const primitive=q=>q<=-1?-16/35:q>=1?16/35:q-q**3+3*q**5/5-q**7/7;
const wall=(p,lo,hi)=>{
  const a=Math.exp(-(p-lo)/10),b=Math.exp(-(hi-p)/10);
  return [(1-a)*(1-b),(a-b)/10];
};
export function sampleRecirculatingFlow(x,y,z,states,intakes,surfaceY=INITIAL_WATER_SURFACE,area=WATER_AREA,phase=1) {
  const flow={x:0,y:0,z:0};
  // Solid tank: callers may sample a rigid-body centre slightly outside it.
  if(x<20||x>400||y<28||y>surfaceY+4||z< -52||z>52)return flow;
  const X=(x-20)/W;
  const bottom=Math.max(0,Math.min(1,(y-32)/20)),low=bottom*bottom*(3-2*bottom),dLow=6*bottom*(1-bottom)/20,high=Math.exp(-(surfaceY-y)/65);
  const h=low*(1-high),dh=dLow*(1-high)-low*high/65;
  // Smooth plume bend toward the two pegs, with no derivative discontinuity.
  const t=Math.max(0,Math.min(1,(y-350)/100)),bend=t*t*(3-2*t),dbend=6*t*(1-t)/100;
  for(let side=0;side<2;side++) {
    const state=states[side];
    const bulk=circulationAt(state,'circulation',phase),intake=circulationAt(state,'intakeCirculation',phase);
    if(bulk>0) {
      const sign=side===0?1:-1,centre=(side===0?91:329)+sign*52*bend,dc=sign*52*dbend;
      const q=(x-centre)/PLUME_WIDTH,q0=(20-centre)/PLUME_WIDTH,q1=(400-centre)/PLUME_WIDTH;
      const g=bump(q),g0=bump(q0),g1=bump(q1);
      const integral=PLUME_WIDTH*(primitive(q1)-primitive(q0));
      const f=PLUME_WIDTH*(primitive(q)-primitive(q0))-integral*X;
      const dfdy=dc*(-g+g0-(g0-g1)*X);
      const speed=PLUME_SPEED*bulk;
      // u=∂ψ/∂y, v=-∂ψ/∂x, ψ=-speed*h*f. The upward
      // compact plume has a compensating descending return, including at top.
      flow.x-=speed*(dh*f+h*dfdy);
      flow.y+=speed*h*(g-integral/W);
      // A second curl supplies weak depth entrainment into the plume, balanced
      // by lateral spreading. It centres rings and markers alike, not just rings.
      const [bx,dbx]=wall(x,20,400),dg=Math.abs(q)<1?-6*q*(1-q*q)**2/PLUME_WIDTH:0;
      const G=bx*g,dG=dbx*g+bx*dg,Z=z*(1-(z/52)**2),dZ=1-3*(z/52)**2,k=1.8*bulk;
      flow.x+=k*(x-centre)*G*h*dZ;
      flow.z-=k*(G+(x-centre)*dG)*h*Z;
    }
    // Real volume displacement: divergence-free source/return through bottom
    // ports, uniform moving free surface. The visible y=74 intake is connected
    // by an approximate unresolved conduit to its x-aligned floor port.
    const rate=state.volumeRate||0;
    if(rate!==0) {
      const port=rate>0?(side===0?91:329):intakes[side].x,width=rate>0?24:20;
      const q=(x-port)/width,g=bump(q),integral=width*32/35;
      const f=width*(primitive(q)+16/35)-integral*X,mean=integral/W;
      const rise=rate/area;
      const tail=Math.exp(-(surfaceY-32)/60),layer=Math.exp(-(y-32)/60);
      const blend=(layer-tail)/(1-tail),dBlend=-layer/(60*(1-tail));
      flow.x-=rise*dBlend*f/mean;
      flow.y+=rise*(1+blend*(g/mean-1));
    }
    if(intake>0) {
      const inlet=intakes[side],dx=x-inlet.x,dy=y-inlet.y;
      const [bx,dbx]=wall(x,20,400),[by,dby]=wall(y,32,surfaceY);
      const e=Math.exp(-(dx*dx+dy*dy)/(75*75));
      const g=e*bx*by,gx=e*by*(dbx-bx*2*dx/(75*75)),gy=e*bx*(dby-by*2*dy/(75*75));
      const Z=z*(1-(z/52)**2),dZ=1-3*(z/52)**2,k=2*intake;
      // Curl of two vector potentials: locally draw XY water toward the actual
      // separate intake, turn it out through depth, and recirculate at depth.
      // Divergence cancels analytically and normal wall flux is zero. This is
      // an intake APPROACH circulation, not itself a mass sink. The separate
      // exchange-port component above carries actual volume and FIFO markers
      // through the unresolved pipe; there is no random marker renewal.
      flow.x-=k*dx*g*dZ;flow.y-=k*dy*g*dZ;
      flow.z+=k*(2*g+dx*gx+dy*gy)*Z;
    }
  }
  return flow;
}

export function portCoordinate(x,side,intakes) {
  return Math.max(0,Math.min(1,(primitive((x-intakes[side].x)/20)+16/35)/(32/35)));
}
export function nozzleCoordinate(fraction,side) {
  let low=-1,high=1;
  for(let i=0;i<24;i++){const q=(low+high)/2;if((primitive(q)+16/35)/(32/35)<fraction)low=q;else high=q;}
  return (side===0?91:329)+24*(low+high)/2;
}

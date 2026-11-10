// A damped, closed-tank circulation mode driven by container acceleration.
// This is a game approximation to water inertia, not a pressure/slosh solver.
export const GAME_ACCELERATION_PER_MPS2 = 210 / 9.81;
export const WATER_INERTIA_SECONDS = .65;
export const MAX_DEVICE_ACCELERATION = 3 * 9.81;
export function boundedAcceleration(value) {
  if (!value || !['x', 'y', 'z'].every(k => Number.isFinite(value[k]))) return {x:0,y:0,z:0};
  const length=Math.hypot(value.x,value.y,value.z), scale=length>MAX_DEVICE_ACCELERATION?MAX_DEVICE_ACCELERATION/length:1;
  return {x:value.x*scale,y:value.y*scale,z:value.z*scale};
}
export function createWaterInertia() {
  return {velocity:{x:0,y:0,z:0},start:{x:0,y:0,z:0},target:{x:0,y:0,z:0},dt:0};
}
export function advanceWaterInertia(state,acceleration,dt) {
  if (!(dt>0) || !Number.isFinite(dt)) return;
  const input=boundedAcceleration(acceleration), decay=Math.exp(-dt/WATER_INERTIA_SECONDS);
  state.dt=dt;
  for (const k of ['x','y','z']) {
    state.start[k]=state.velocity[k];
    // Specific linear acceleration of the container gives opposite water motion.
    state.target[k]=-input[k]*GAME_ACCELERATION_PER_MPS2*WATER_INERTIA_SECONDS;
    state.velocity[k]=state.target[k]+(state.start[k]-state.target[k])*decay;
  }
}
function windowAt(value,low,high) {
  const length=high-low,q=(value-low)/length;
  if(q<=0||q>=1)return [0,0];
  const angle=Math.PI*q;
  return [Math.sin(angle)**2,Math.PI*Math.sin(2*angle)/length];
}
export function sampleWaterInertia(x,y,z,state,bounds,surface=null,phase=1) {
  const {left,right,bottom,top,back,front}=bounds;
  if(x<left||x>right||y<bottom||y>top||z<back||z>front)return {x:0,y:0,z:0};
  const [bx,dx]=windowAt(x,left,right),[by,dy]=windowAt(y,bottom,top),[bz,dz]=windowAt(z,back,front);
  const X=x-(left+right)/2,Y=y-(bottom+top)/2;
  const velocity={};
  const decay=Math.exp(-state.dt*Math.max(0,Math.min(1,phase))/WATER_INERTIA_SECONDS);
  for(const k of ['x','y','z'])velocity[k]=state.target[k]+(state.start[k]-state.target[k])*decay;
  // Vector potential A=(0, Uz*X*B, (Ux*Y-Uy*X)*B).
  // Its curl gives interior motion with compensating returns and zero normal
  // flux at solid walls. Rings and markers must sample this exact same field.
  const B=bx*by*bz,Bx=dx*by*bz,By=bx*dy*bz,Bz=bx*by*dz;
  const potential={x:0,y:velocity.z*X*B,z:(velocity.x*Y-velocity.y*X)*B};
  const flow={x:velocity.x*B+(velocity.x*Y-velocity.y*X)*By-velocity.z*X*Bz,y:velocity.y*B-(velocity.x*Y-velocity.y*X)*Bx,z:velocity.z*(B+X*Bx)};
  if(!surface)return flow;
  const depth=surface.signedDepth({x,y,z});
  if(depth<=0)return {x:0,y:0,z:0};
  // Multiplying A by a C1 free-surface envelope keeps its curl tangent to the
  // water plane without a particle-specific force or an artificial inward pull.
  const q=Math.min(1,depth/28),weight=q*q*(3-2*q),slope=q<1?6*q*(1-q)/28:0;
  const n=surface.normal,grad={x:-n.x*slope,y:-n.y*slope,z:-n.z*slope};
  return {x:weight*flow.x+grad.y*potential.z-grad.z*potential.y,y:weight*flow.y+grad.z*potential.x-grad.x*potential.z,z:weight*flow.z+grad.x*potential.y-grad.y*potential.x};
}

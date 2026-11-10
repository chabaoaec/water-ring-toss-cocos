import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld,TUBE_RADIUS} from '../src/physics.js';
import {FLOW_BOUNDS,sampleRecirculatingFlow} from '../src/recirculating-flow.js';
import {createWaterSurface} from '../src/water-surface.js';
const dt=1/120;
function isolate(w,x,y,z,orientation='flat') {
  const r=w.rings[0];for(const other of w.rings.slice(1))w.world.removeBody(other.body);w.rings=[r];
  r.body.position.set(x,y,z);r.body.velocity.set(0,0,0);r.body.angularVelocity.set(0,0,0);
  r.body.quaternion.setFromEuler(orientation==='depth'?Math.PI/2:0,0,orientation==='side'?Math.PI/2:0);Object.assign(r,{x,y,z});return r;
}
function assertInitialLegal(r) {
  for(const offset of r.body.shapeOffsets) {
    const p=r.body.quaternion.vmult(offset);p.vadd(r.body.position,p);
    assert.ok(p.x-TUBE_RADIUS>=20-1e-6&&p.x+TUBE_RADIUS<=400+1e-6);
    assert.ok(p.y-TUBE_RADIUS>=32-1e-6&&p.y+TUBE_RADIUS<=540+1e-6);
    assert.ok(p.z-TUBE_RADIUS>=-52-1e-6&&p.z+TUBE_RADIUS<=52+1e-6);
  }
}
test('normal reset rings start completely inside the actual six fluid-aligned solid walls',()=>{for(const seed of[42,43])for(const r of new WaterWorld(seed).rings)assertInitialLegal(r);});
test('eight legal floor/side/depth corner poses reach the lift stream using ordinary finite strokes',()=>{
  const cases=[['left-floor',43,35.6,0,'flat',0],['right-floor',377,35.6,0,'flat',1],['left-depth',43,35.6,29.3,'flat',0],['right-depth',377,35.6,-29.3,'flat',1],['left-edgeon',23.6,55,0,'side',0],['right-edgeon',396.4,55,0,'side',1],['front-edgeon',43,55,48.4,'depth',0],['back-edgeon',377,55,-48.4,'depth',1]],records=[];
  for(const [name,x,y,z,orientation,side]of cases) {
    const w=new WaterWorld(),r=isolate(w,x,y,z,orientation);assertInitialLegal(r);
    let maximumY=r.y,closest=Infinity,maxError=0;
    for(let i=0;i<960;i++) {
      w.setJet(side,i%228<132);w.step(dt);maximumY=Math.max(maximumY,r.y);closest=Math.min(closest,Math.abs(r.x-(side===0?91:329)));
      maxError=Math.max(maxError,Math.abs(w.water.tank+w.jetStates.reduce((n,s)=>n+s.remaining,0)-w.water.total));
      assert.ok(Number.isFinite(r.x+r.y+r.z));
    }
    assert.ok(maximumY>150,`${name}: lift ${maximumY}`);assert.ok(closest<20,`${name}: closest ${closest}`);assert.ok(w.pumps<=5);assert.ok(maxError<1e-9);
    records.push({name,maximumY,closest,pumps:w.pumps,maxWaterError:maxError});
  }
  console.log(JSON.stringify({cornerRecovery:records}));
});
test('normal10/20/30degree gravity tilts move a grounded wet ring without pump or special nudges',()=>{
  const records=[];
  for(const angle of[10,20,30]) {
    const w=new WaterWorld(),r=isolate(w,210,35.6,0);w.setGravityDirection({x:Math.sin(angle*Math.PI/180),y:-Math.cos(angle*Math.PI/180),z:0});
    for(let i=0;i<240;i++)w.step(dt);
    const distance=r.x-210;assert.ok(distance>(angle===10?1:angle===20?7:12),`${angle}: ${distance}`);assert.equal(w.pumps,0);assert.equal(w.water.discharged[0],0);records.push({angle,distance,velocity:r.body.velocity.x});
  }
  console.log(JSON.stringify({groundTilt:records}));
});
test('closed pump/intake curls stay divergence free and tangent to oblique hydrostatic surfaces',()=>{
  const states=[{circulation:.8,intakeCirculation:.4,volumeRate:0},{circulation:.3,intakeCirculation:.6,volumeRate:0}],surface=createWaterSurface({gravity:{x:.5,y:-1,z:.3},volume:48}),n=surface.normal,e=.001;
  const sample=(x,y,z)=>sampleRecirculatingFlow(x,y,z,states,[{x:42,y:74,z:0},{x:378,y:74,z:0}],520,48/488,1,surface);let divergence=0,normal=0;
  for(let x=25;x<400;x+=29)for(let y=38;y<538;y+=31)for(const z of[-40,0,40]) {
    if(surface.signedDepth({x,y,z})<2)continue;
    const value=(sample(x+e,y,z).x-sample(x-e,y,z).x+sample(x,y+e,z).y-sample(x,y-e,z).y+sample(x,y,z+e).z-sample(x,y,z-e).z)/(2*e);divergence=Math.max(divergence,Math.abs(value));
  }
  for(let x=40;x<390;x+=17)for(const z of[-45,0,45]){const y=(surface.offset-n.x*x-n.z*z)/n.y;if(y<32||y>540)continue;const v=sample(x,y,z);normal=Math.max(normal,Math.abs(v.x*n.x+v.y*n.y+v.z*n.z));}
  assert.ok(divergence<2e-5,`divergence ${divergence}`);assert.ok(normal<1e-8,`normal ${normal}`);console.log(JSON.stringify({obliqueClosedDivergence:divergence,obliqueNormalFlux:normal}));
});
test('device acceleration preserves magnitude/sign, moves ring and shared water, freezes on pause and clears on reset',()=>{
  const w=new WaterWorld(),r=isolate(w,210,250,0),before=w.water.tank;w.setDeviceAcceleration({x:9.81,y:0,z:0});
  for(let i=0;i<24;i++)w.step(dt);assert.ok(r.body.velocity.x< -10);assert.ok(w.sampleFlow(210,250,0).x< -1);assert.equal(w.water.tank,before);assert.equal(w.pumps,0);
  w.setDeviceAcceleration({x:100,y:0,z:0});assert.ok(Math.abs(w.deviceAcceleration.x-29.43)<1e-9);w.setDeviceAcceleration({x:0,y:0,z:0});
  const mode=Math.abs(w.waterInertia.velocity.x);w.setPaused(true);const frozen=JSON.stringify(w.waterInertia);for(let i=0;i<240;i++)w.step(dt);assert.equal(JSON.stringify(w.waterInertia),frozen);w.setPaused(false);for(let i=0;i<120;i++)w.step(dt);assert.ok(Math.abs(w.waterInertia.velocity.x)<mode*.22);
  w.reset();assert.deepEqual(w.deviceAcceleration,{x:0,y:0,z:0});assert.equal(w.waterInertia.velocity.x,0);assert.equal(w.sampleFlow(210,250,0).x,0);
});

test('short physical shakes move airborne and grounded rings relative to no-motion and advect shared markers during coast',()=>{
  const records=[];
  for(const [pose,y]of[['air',535],['floor',35.6]]) {
    const shaken=new WaterWorld(),still=new WaterWorld(),a=isolate(shaken,210,y,0),b=isolate(still,210,y,0);
    shaken.setDeviceAcceleration({x:8,y:0,z:0});
    for(let i=0;i<24;i++){shaken.step(dt);still.step(dt);}
    const pulseDistance=a.x-b.x;assert.ok(pulseDistance<-(pose==='air'?2:.5),`${pose}: ${pulseDistance}`);
    shaken.setDeviceAcceleration({x:0,y:0,z:0});const before=shaken.tracers.particles.map(p=>({x:p.x,y:p.y,z:p.z,inChamber:p.inChamber}));
    for(let i=0;i<36;i++){shaken.step(dt);still.step(dt);}
    const coastMarkers=shaken.tracers.particles.filter((p,i)=>p.inChamber===null&&before[i].inChamber===null&&Math.hypot(p.x-before[i].x,p.y-before[i].y,p.z-before[i].z)>.5).length;
    assert.ok(coastMarkers>20,`${pose} coast markers ${coastMarkers}`);records.push({pose,pulseDistance,afterCoastDistance:a.x-b.x,coastMarkers,coastField:shaken.sampleFlow(210,250,0).x});
    shaken.setDeviceAcceleration({x:-8,y:0,z:0});for(let i=0;i<24;i++)shaken.step(dt);assert.ok(shaken.waterInertia.target.x>0);
  }
  console.log(JSON.stringify({physicalShake:records}));
});

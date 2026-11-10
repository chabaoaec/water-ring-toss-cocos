import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld,RING_MASS} from '../src/physics.js';
const dt=1/120;
// Cannon derives compound inertia from its current AABB. Match construction
// order (identity while adding shapes, initial orientation applied afterwards).
function worldAtUnitMassReference(){const w=new WaterWorld(43);for(const r of w.rings){const orientation=r.body.quaternion.clone();r.body.quaternion.set(0,0,0,1);r.body.mass=1;r.body.updateMassProperties();r.body.quaternion.copy(orientation);}return w;}
function isolate(w,y=400){const r=w.rings[0];for(const other of w.rings.slice(1))w.world.removeBody(other.body);w.rings=[r];r.body.position.set(210,y,0);r.body.velocity.set(0,0,0);r.body.angularVelocity.set(0,0,0);r.body.quaternion.set(0,0,0,1);Object.assign(r,{x:210,y,z:0});return r;}
test('same-volume denser rings retain geometry, acquire consistent inertia and sink only modestly faster',()=>{
  const denser=new WaterWorld(43),reference=worldAtUnitMassReference(),a=isolate(denser),b=isolate(reference);
  assert.equal(a.body.mass,RING_MASS);assert.equal(a.body.mass/b.body.mass,1.05);assert.equal(a.body.shapes.length,24);
  assert.deepEqual(a.body.shapeOffsets,b.body.shapeOffsets);assert.deepEqual(a.body.shapes.map(s=>s.radius),b.body.shapes.map(s=>s.radius));
  for(const axis of ['x','y','z'])assert.ok(Math.abs(a.body.inertia[axis]/b.body.inertia[axis]-1.05)<1e-12);
  denser.step(dt);reference.step(dt);assert.ok(a.body.velocity.y<b.body.velocity.y);assert.ok(Math.abs(a.body.velocity.y/dt-(-210+136/1.05))<1e-10);
  for(let i=1;i<120;i++){denser.step(dt);reference.step(dt);}
  const ratio=(400-a.y)/(400-b.y);assert.ok(ratio>1.05&&ratio<1.2,`one-second sink ratio ${ratio}`);
});
test('density contrast changes submerged shake response while air acceleration and the pump water/marker simulation stay identical',()=>{
  for(const y of[400,535]) {
    const denser=new WaterWorld(43),reference=worldAtUnitMassReference(),a=isolate(denser,y),b=isolate(reference,y);
    denser.setDeviceAcceleration({x:8,y:0,z:0});reference.setDeviceAcceleration({x:8,y:0,z:0});denser.applyWaterForces(a);reference.applyWaterForces(b);
    const responseA=a.body.force.x/a.body.mass,responseB=b.body.force.x/b.body.mass;
    if(y===400){assert.ok(responseA<responseB);assert.ok(Math.abs(responseA/responseB-1)<.15);assert.equal(a.body.force.y,b.body.force.y);}
    else assert.ok(Math.abs(responseA-responseB)<1e-12);
  }
  const denser=new WaterWorld(43),reference=worldAtUnitMassReference();denser.setJet(0,true);reference.setJet(0,true);
  for(let i=0;i<120;i++){if(i===72){denser.setJet(0,false);reference.setJet(0,false);}denser.step(dt);reference.step(dt);}
  assert.deepEqual(denser.water,reference.water);assert.deepEqual(denser.jetStates,reference.jetStates);assert.deepEqual(denser.tracers.particles,reference.tracers.particles);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld,INTAKES,JET_CAPACITY} from '../src/physics.js';
import {sampleRecirculatingFlow} from '../src/recirculating-flow.js';
const dt=1/120,run=(w,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)w.step(dt);};
const state=(pressure=0,rate=0)=>({active:pressure>0,pressure,volumeRate:rate,refilling:rate<0,intakeStrength:rate<0?1:0});
test('combined curls and displacement are divergence free and match moving-surface/port flux',()=>{
  let maxDivergence=0,maxSpeed=0;
  for(const states of [[state(1,1),state(1,1)],[state(1,1),state(0,-.8/.7)],[state(0,-.8/.7),state(0,-.8/.7)]]) {
    const surface=528,area=48/488,sample=(x,y,z)=>sampleRecirculatingFlow(x,y,z,states,INTAKES,surface,area),epsilon=.001;
    for(let x=24;x<400;x+=13)for(let y=36;y<surface-4;y+=17)for(const z of [-45,-17,0,23,48]) {
      const a=sample(x+epsilon,y,z),b=sample(x-epsilon,y,z),c=sample(x,y+epsilon,z),d=sample(x,y-epsilon,z),e=sample(x,y,z+epsilon),f=sample(x,y,z-epsilon);
      const divergence=(a.x-b.x+c.y-d.y+e.z-f.z)/(2*epsilon);
      maxDivergence=Math.max(maxDivergence,Math.abs(divergence));maxSpeed=Math.max(maxSpeed,Math.hypot(...Object.values(sample(x,y,z))));
    }
    const rate=states.reduce((n,s)=>n+s.volumeRate,0),rise=rate/area;
    for(let i=0;i<=50;i++) {
      const x=20+380*i/50,y=32+(surface-32)*i/50;
      assert.ok(Math.abs(sample(20,y,0).x)<1e-9);assert.ok(Math.abs(sample(400,y,0).x)<1e-9);
      assert.ok(Math.abs(sample(x,surface,0).y-rise)<1e-9);
      assert.ok(Math.abs(sample(x,y,-52).z)<1e-9);assert.ok(Math.abs(sample(x,y,52).z)<1e-9);
    }
    // Integrate real exchange-port flux through the bottom; ledger-volume units.
    let flux=0;const n=3800,dx=380/n;
    for(let i=0;i<n;i++)flux+=sample(20+(i+.5)*dx,32,0).y*dx;
    assert.ok(Math.abs(flux/380*area-rate)<1e-8,`${flux/380*area} != ${rate}`);
  }
  assert.ok(maxDivergence<2e-5,`divergence ${maxDivergence}`);
  assert.ok(maxSpeed<7000,`bounded grid speed ${maxSpeed}`);
  console.log(JSON.stringify({maxDivergence,maxGridSpeed:maxSpeed}));
});
test('60s real repeated pumps retain marker identity, upward/downward paths and water-volume distribution',()=>{
  const w=new WaterWorld(),pool=w.tracers.particles.slice(),previous=pool.map(p=>p.inChamber),up=new Set(),down=new Set(),records=[];
  let maxOutside=0,maxWaterError=0,entries=0,exits=0;const start=performance.now();
  for(let i=0;i<7200;i++) {
    const held=i%228<132;for(let side=0;side<2;side++)w.setJet(side,held);w.step(dt);
    assert.equal(w.tracers.particles.length,128);
    const visible=pool.filter(p=>p.inChamber===null),height=w.water.surfaceY-32;
    pool.forEach((p,id)=>{
      assert.equal(w.tracers.particles[id],p);assert.equal(p.id,id);
      if(p.inChamber!==previous[id]){if(p.inChamber===null)exits++;else entries++;previous[id]=p.inChamber;}
      if(p.inChamber===null){if(p.vy>20)up.add(id);if(p.vy< -20)down.add(id);maxOutside=Math.max(maxOutside,20-p.x,p.x-400,32-p.y,p.y-w.water.surfaceY,Math.abs(p.z)-52);}
      else assert.ok(p.inChamber===0||p.inChamber===1);
    });
    maxWaterError=Math.max(maxWaterError,Math.abs(w.water.tank+w.jetStates.reduce((n,s)=>n+s.remaining,0)-w.water.total));
    assert.ok(Math.abs((w.water.surfaceY-32)*w.water.area-w.water.tank)<1e-10);
    if(i%120===119){const bins=[0,1,2,3].map(k=>visible.filter(p=>p.y>=32+height*k/4&&p.y<32+height*(k+1)/4).length),top5=visible.filter(p=>p.y>w.water.surfaceY-5).length;assert.ok(bins.every(n=>n>visible.length*.07),JSON.stringify(bins));assert.ok(bins[3]<visible.length*.48,JSON.stringify(bins));assert.ok(top5<visible.length*.12);if(i%600===599)records.push({seconds:(i+1)/120,surfaceY:w.water.surfaceY,visible:visible.length,bins,top5});}
  }
  assert.ok(maxOutside<1e-5,`boundary error ${maxOutside}`);assert.ok(maxWaterError<1e-9);
  assert.ok(up.size>80&&down.size>80,`up ${up.size}, down ${down.size}`);assert.ok(entries>100&&exits>100);
  console.log(JSON.stringify({records,maxOutside,maxWaterError,up:up.size,down:down.size,entries,exits,wallMs:performance.now()-start}));
});
test('surface displacement, dry-body forces, gravity, pause and reset obey their contracts',()=>{
  const w=new WaterWorld();assert.equal(w.water.surfaceY,520);w.setJet(0,true);w.setJet(1,true);run(w,1.4);
  assert.ok(Math.abs(w.getWaterSurfaceY()-(520+1.6/(48/488)))<1e-8);assert.equal(w.jetStates[0].remaining,0);
  w.setJet(0,false);w.setJet(1,false);run(w,.2);w.setPaused(true);
  const before=JSON.stringify({water:w.water,tracers:w.tracers.particles,time:w.time});run(w,2);assert.equal(JSON.stringify({water:w.water,tracers:w.tracers.particles,time:w.time}),before);
  w.setPaused(false);run(w,.7);assert.ok(Math.abs(w.getWaterSurfaceY()-520)<1e-8);
  assert.equal(w.setGravityDirection({x:3,y:-4,z:0}),true);assert.ok(Math.abs(w.world.gravity.length()-210)<1e-10);assert.equal(w.setGravityDirection({x:0,y:0,z:0}),false);
  const r=w.rings[0];r.body.position.set(210,200,0);Object.assign(r,{x:210,y:200,z:0});r.body.velocity.set(0,0,0);r.body.force.set(0,0,0);w.applyWaterForces(r);assert.ok(r.body.force.x<0&&r.body.force.y>0);
  r.body.position.y=545;r.y=545;r.body.force.set(0,0,0);r.body.velocity.set(30,20,10);w.applyWaterForces(r);assert.equal(r.body.force.length(),0);
  w.reset();assert.equal(w.getWaterSurfaceY(),520);assert.deepEqual(w.gravityDirection,{x:0,y:-1,z:0});assert.equal(w.tracers.particles.length,128);assert.equal(w.jetStates[0].remaining,JET_CAPACITY);
});

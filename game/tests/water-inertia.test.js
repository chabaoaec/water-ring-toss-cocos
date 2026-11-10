import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld,INTAKES} from '../src/physics.js';
import {advanceCirculation,circulationAt,BULK_DECAY_SECONDS,INTAKE_DECAY_SECONDS,sampleRecirculatingFlow,WATER_AREA,INITIAL_WATER_SURFACE} from '../src/recirculating-flow.js';
const run=(w,s)=>{for(let i=0;i<Math.round(s*120);i++)w.step(1/120);};
const ledger=w=>JSON.stringify({tank:w.water.tank,discharged:w.water.discharged,intaken:w.water.intaken,remaining:w.jetStates.map(s=>s.remaining)});
test('empty held pump stops exchange but shared bulk water and persistent tracers coast then decay',()=>{
  const w=new WaterWorld();w.setJet(0,true);run(w,1.2);const s=w.jetStates[0];assert.equal(s.remaining,0);assert.equal(s.volumeRate,0);assert.equal(s.active,false);
  const start=w.sampleFlow(91,200,0).y,volume=ledger(w),pool=w.tracers.particles.slice(),positions=pool.map(p=>({...p})),amplitude=s.circulation;
  assert.ok(start>100,`coasting water ${start}`);assert.equal(w.sampleFlow(91,32,0).y,0);
  run(w,.5);assert.equal(ledger(w),volume);assert.ok(Math.abs(s.circulation/amplitude-Math.exp(-.5/BULK_DECAY_SECONDS))<1e-12);
  assert.ok(w.sampleFlow(91,200,0).y>start*.4);
  const moving=pool.filter((p,i)=>p.inChamber===null&&positions[i].inChamber===null&&Math.hypot(p.x-positions[i].x,p.y-positions[i].y,p.z-positions[i].z)>2).length;
  assert.ok(moving>40,`coasting markers ${moving}`);pool.forEach((p,i)=>assert.equal(w.tracers.particles[i],p));
  run(w,1);assert.ok(w.sampleFlow(91,200,0).y>start*.09);run(w,3.5);assert.ok(w.sampleFlow(91,200,0).y<start*.0005);assert.equal(ledger(w),volume);
  console.log(JSON.stringify({emptyField:start,after5s:w.sampleFlow(91,200,0).y,moving,amplitude}));
});
test('release and completed refill keep dissipating circulation, pause freezes it and reset clears it',()=>{
  const w=new WaterWorld();w.setJet(0,true);run(w,.7);const before=w.jetStates[0].circulation;w.setJet(0,false);run(w,1/120);assert.ok(w.jetStates[0].circulation>before*.97);
  run(w,.7);const s=w.jetStates[0];assert.equal(s.remaining,.8);assert.equal(s.intakeStrength,0);assert.equal(s.volumeRate,0);assert.ok(s.intakeCirculation>.1);
  const intake=s.intakeCirculation;run(w,.5);assert.ok(Math.abs(s.intakeCirculation/intake-Math.exp(-.5/INTAKE_DECAY_SECONDS))<1e-12);
  w.setPaused(true);const frozen=JSON.stringify({states:w.jetStates,particles:w.tracers.particles,water:w.water,time:w.time});run(w,2);assert.equal(JSON.stringify({states:w.jetStates,particles:w.tracers.particles,water:w.water,time:w.time}),frozen);
  w.setPaused(false);run(w,.5);assert.ok(s.circulation<before*.2);w.reset();assert.equal(w.jetStates[0].circulation,0);assert.equal(w.jetStates[0].intakeCirculation,0);assert.equal(w.sampleFlow(91,200,0).y,0);
});
test('analytic momentum interpolation is timestep consistent and residual curls have no net flux',()=>{
  const a={pressure:1,intakeStrength:0,circulation:0,intakeCirculation:0},b={...a};advanceCirculation(a,.24);advanceCirculation(b,.12);advanceCirculation(b,.12);assert.ok(Math.abs(a.circulation-b.circulation)<1e-12);
  a.pressure=0;const initial=a.circulation;advanceCirculation(a,.3);assert.ok(Math.abs(circulationAt(a,'circulation',.5)-initial*Math.exp(-.15/BULK_DECAY_SECONDS))<1e-12);
  const states=[{active:false,pressure:0,volumeRate:0,circulation:.8,intakeCirculation:.6},{active:false,pressure:0,volumeRate:0,circulation:.2,intakeCirculation:.1}],sample=(x,y,z)=>sampleRecirculatingFlow(x,y,z,states,INTAKES,INITIAL_WATER_SURFACE,WATER_AREA),e=.001;let maximum=0;
  for(let x=25;x<400;x+=29)for(let y=36;y<518;y+=31)for(const z of [-35,0,30]){const d=(sample(x+e,y,z).x-sample(x-e,y,z).x+sample(x,y+e,z).y-sample(x,y-e,z).y+sample(x,y,z+e).z-sample(x,y,z-e).z)/(2*e);maximum=Math.max(maximum,Math.abs(d));}
  assert.ok(maximum<2e-5,`residual divergence ${maximum}`);for(let x=20;x<=400;x+=20){assert.ok(Math.abs(sample(x,32,0).y)<1e-10);assert.ok(Math.abs(sample(x,520,0).y)<1e-10);}console.log(JSON.stringify({residualMaxDivergence:maximum}));
});

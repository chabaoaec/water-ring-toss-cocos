import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterInertia,advanceWaterInertia,sampleWaterInertia,boundedAcceleration} from '../src/inertial-water.js';
const bounds={left:20,right:400,bottom:32,top:540,back:-52,front:52};
test('linear shake retains magnitude, reverses direction and decays after input stops',()=>{
 const a=createWaterInertia(),b=createWaterInertia();
 for(let i=0;i<24;i++){advanceWaterInertia(a,{x:8,y:0,z:0},1/120);advanceWaterInertia(b,{x:-4,y:0,z:0},1/120);}
 const u=sampleWaterInertia(210,286,0,a,bounds),v=sampleWaterInertia(210,286,0,b,bounds);
 assert.ok(u.x< -20);assert.ok(v.x>10);assert.ok(Math.abs(u.x+2*v.x)<1e-9);
 const before=a.velocity.x;for(let i=0;i<120;i++)advanceWaterInertia(a,{x:0,y:0,z:0},1/120);
 assert.ok(Math.abs(a.velocity.x-before*Math.exp(-1/.65))<1e-9);
});
test('inertial field has zero normal wall flux and divergence for all three shake axes',()=>{
 const s=createWaterInertia();advanceWaterInertia(s,{x:7,y:-5,z:3},.1);
 for(const x of [20,400])assert.ok(Math.abs(sampleWaterInertia(x,200,10,s,bounds).x)<1e-12);
 for(const y of [32,540])assert.ok(Math.abs(sampleWaterInertia(120,y,10,s,bounds).y)<1e-12);
 for(const z of [-52,52])assert.ok(Math.abs(sampleWaterInertia(120,200,z,s,bounds).z)<1e-12);
 const h=.001,p={x:132,y:211,z:14};let div=0;
 for(const k of ['x','y','z']){const a={...p,[k]:p[k]+h},b={...p,[k]:p[k]-h};div+=(sampleWaterInertia(a.x,a.y,a.z,s,bounds)[k]-sampleWaterInertia(b.x,b.y,b.z,s,bounds)[k])/(2*h);}
 assert.ok(Math.abs(div)<1e-7,`${div}`);
});
test('free-plane envelope is tangent and divergence-free; bad accelerations cannot poison state',()=>{
 assert.deepEqual(boundedAcceleration({x:NaN,y:1,z:0}),{x:0,y:0,z:0});
 assert.ok(Math.hypot(...Object.values(boundedAcceleration({x:100,y:100,z:100})))<=3*9.81+1e-9);
 const s=createWaterInertia();advanceWaterInertia(s,{x:7,y:-5,z:3},.1);
 const n={x:.6,y:.8,z:0},offset=300,surface={normal:n,signedDepth:p=>offset-n.x*p.x-n.y*p.y};
 const f=(x,y,z)=>sampleWaterInertia(x,y,z,s,bounds,surface);
 assert.deepEqual(f(180,300,0),{x:0,y:0,z:0});
 const p={x:180,y:(offset-.6*180-12)/.8,z:14},h=.001;let div=0;
 for(const k of ['x','y','z']){const a={...p,[k]:p[k]+h},b={...p,[k]:p[k]-h};div+=(f(a.x,a.y,a.z)[k]-f(b.x,b.y,b.z)[k])/(2*h);}
 assert.ok(Math.abs(div)<1e-6,`${div}`);
});

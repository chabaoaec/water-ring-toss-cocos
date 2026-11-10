import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterSurface} from '../src/water-surface.js';
import {reflectWaterParcel} from '../src/water-parcel-boundary.js';
test('crossing a free plane reflects parcels inside without putting all at one depth',()=>{
 const s=createWaterSurface(),points=[{x:120,y:522,z:0},{x:140,y:525,z:0},{x:160,y:532,z:0}];
 for(const p of points){assert.ok(reflectWaterParcel(p,s));assert.ok(s.contains(p));}
 assert.deepEqual(points.map(p=>Math.round(s.signedDepth(p))),[2,5,12]);
});
test('bounded reflections retain distinct finite positions inside tilted and inverted water boxes',()=>{
 let seed=19;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
 const gravities=[{x:.6,y:-.8,z:0},{x:-.8,y:-.3,z:.5},{x:.2,y:.9,z:-.3},{x:0,y:1,z:0},{x:1,y:0,z:0}];
 for(const gravity of gravities){const s=createWaterSurface({gravity});const positions=new Set();
  for(let i=0;i<2000;i++){const p={x:10+random()*400,y:20+random()*540,z:-62+random()*124};assert.ok(reflectWaterParcel(p,s));assert.ok(s.contains(p,1e-7));positions.add([p.x,p.y,p.z].join(','));}
  assert.equal(positions.size,2000);
 }
});

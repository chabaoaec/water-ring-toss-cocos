import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterSurface,createWaterSurfaceCache,DEFAULT_WATER_BOUNDS,DEFAULT_WATER_AREA} from '../src/water-surface.js';
const axes=['x','y','z'];
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function clippedVolume(surface) {
  // Independent geometric volume: triangulate the clipped convex box boundary
  // into tetrahedra about an interior point. No projection CDF is used here.
  const faces=axes.flatMap(axis=>['min','max'].map(side=>surface.facePolygon(axis,side)));
  faces.push(surface.surfacePolygon3D());
  const vertices=faces.flat();if(!vertices.length)return 0;
  const center={x:0,y:0,z:0};for(const p of vertices)for(const a of axes)center[a]+=p[a]/vertices.length;
  let volume=0;
  for(const face of faces)for(let i=1;i+1<face.length;i++)volume+=Math.abs(dot(minus(face[0],center),cross(minus(face[i],center),minus(face[i+1],center))))/6;
  return volume;
}
function boxVolume(bounds) {return axes.reduce((v,a)=>v*(bounds.max[a]-bounds.min[a]),1);}
function polygonAreaXY(points) {
  let twice=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twice+=a.x*b.y-a.y*b.x;}return Math.abs(twice)/2;
}
test('upright nominal water is exactly y520, proper depth, capacity and empty/full behavior',()=>{
  const s=createWaterSurface();assert.equal(s.offset,520);assert.deepEqual(s.normal,{x:0,y:1,z:0});
  close(s.signedDepth({x:210,y:510,z:0}),10);close(s.signedDepth({x:210,y:530,z:0}),-10);
  assert.equal(s.contains({x:210,y:510,z:0}),true);assert.equal(s.contains({x:5,y:510,z:0}),false);
  assert.equal(s.contains({x:210,y:530,z:0}),false);assert.equal(s.frontFaceLine().length,2);
  assert.ok(s.frontFaceLine().every(p=>p.y===520));close(s.capacity,DEFAULT_WATER_AREA*508);
  const empty=createWaterSurface({volume:-10}),full=createWaterSurface({volume:1e6});
  assert.equal(empty.fraction,0);assert.equal(empty.contains({x:210,y:32,z:0}),false);assert.deepEqual(empty.frontFacePolygon(),[]);
  assert.equal(full.fraction,1);assert.equal(full.contains({x:210,y:540,z:0}),true);assert.equal(full.surfacePolygon3D().length,0);
});
test('analytic equilibrium conserves clipped box volume under oblique and inverted gravity',()=>{
  const directions=[{x:0,y:-1,z:0},{x:0,y:1,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:-1},
    {x:1,y:-1,z:0},{x:1,y:-.3,z:.8},{x:.2,y:.9,z:-.7},{x:-1,y:-1,z:-1},
    {x:1e-14,y:-1,z:1e-18},{x:1,y:1e-15,z:-1e-16},{x:1e-15,y:1e-16,z:1}];
  let maximumError=0;
  for(const gravity of directions)for(const fraction of [0,.0001,.01,.2,.5,.91,.9606299212598426,.9999,1]) {
    const s=createWaterSurface({gravity,volume:fraction*DEFAULT_WATER_AREA*508});
    const geometric=clippedVolume(s)/boxVolume(s.bounds),error=Math.abs(geometric-fraction);
    maximumError=Math.max(maximumError,error);close(geometric,fraction,2e-12);close(s.volumeFractionAt(s.offset),fraction,2e-12);
  }
  console.log(JSON.stringify({maximumIndependentGeometricFractionError:maximumError,cases:directions.length*9}));
});
test('deterministic varied planes conserve volume without near-axis cancellation',()=>{
  let seed=1977,maximumError=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<300;i++) {
    const gravity={x:2*random()-1,y:2*random()-1,z:2*random()-1};
    if(i%3===0)gravity.x*=1e-12;if(i%5===0)gravity.y*=1e-10;
    const fraction=random(),s=createWaterSurface({gravity,volume:fraction*DEFAULT_WATER_AREA*508});
    const error=Math.abs(clippedVolume(s)/boxVolume(s.bounds)-fraction);maximumError=Math.max(maximumError,error);
    assert.ok(error<3e-12,`case ${i} relative volume error ${error}`);
  }
  console.log(JSON.stringify({variedPlanes:300,maximumIndependentGeometricFractionError:maximumError}));
});
test('arbitrary rectangular bounds retain the upright volume-to-height convention',()=>{
  const bounds={min:{x:-13,y:-47,z:29},max:{x:100,y:153,z:36}};
  const s=createWaterSurface({bounds,area:.25,volume:20});assert.equal(s.offset,33);
  for(const gravity of [{x:1,y:2,z:3},{x:-4,y:.1,z:-8}]) {
    const tilted=createWaterSurface({bounds,gravity,area:.25,volume:20});close(clippedVolume(tilted)/boxVolume(bounds),.4,2e-12);
  }
});
test('mirrored gravity mirrors plane and inverted gravity exchanges water and air',()=>{
  const a=createWaterSurface({gravity:{x:.7,y:-1,z:.3},volume:27});
  const b=createWaterSurface({gravity:{x:-.7,y:-1,z:-.3},volume:27});
  const opposite=createWaterSurface({gravity:{x:-.7,y:1,z:-.3},volume:a.capacity-a.volume});
  for(const p of [{x:34,y:200,z:17},{x:300,y:470,z:-30},{x:180,y:510,z:0}]) {
    close(a.signedDepth(p),b.signedDepth({x:420-p.x,y:p.y,z:-p.z}),2e-10);
    close(a.signedDepth(p),-opposite.signedDepth(p),2e-10);
  }
});
test('wet and air face clipping partitions the face and surface polygon stays planar and bounded',()=>{
  for(const gravity of [{x:.8,y:-1,z:.2},{x:0,y:1,z:0},{x:1,y:0,z:0},{x:0,y:0,z:1}]) {
    const s=createWaterSurface({gravity,volume:24});
    const wet=s.frontFacePolygon(),air=s.frontFacePolygon(52,{water:false});
    close(polygonAreaXY(wet)+polygonAreaXY(air),380*508,1e-7);
    for(const p of wet){assert.equal(s.inBounds(p),true);assert.ok(s.signedDepth(p)>=-1e-8);}
    for(const p of air){assert.equal(s.inBounds(p),true);assert.ok(s.signedDepth(p)<=1e-8);}
    const surface=s.surfacePolygon3D();assert.ok(surface.length>=3&&surface.length<=6);
    for(const p of surface){assert.equal(s.inBounds(p),true);close(s.signedDepth(p),0,1e-8);}
    const projected=surface.map(p=>({x:p.x,y:p.y+.32*p.z}));
    for(const p of projected){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=20-1e-8&&p.x<=400+1e-8);assert.ok(p.y>=32-16.64-1e-8&&p.y<=540+16.64+1e-8);}
  }
});
test('cached resolver skips unchanged solves and freezes caller-owned input snapshots',()=>{
  const cache=createWaterSurfaceCache(),gravity={x:0,y:-1,z:0},bounds=structuredClone(DEFAULT_WATER_BOUNDS);
  const a=cache.get({gravity,bounds}),b=cache.get({gravity:{x:0,y:-2,z:0},bounds});assert.equal(a,b);
  gravity.x=1;bounds.min.x=21;assert.equal(a.normal.x,0);assert.equal(a.bounds.min.x,20);
  const c=cache.get({gravity,bounds});assert.notEqual(c,a);assert.notEqual(cache.get({volume:47}),c);
  cache.clear();assert.notEqual(cache.get(),a);
});
test('invalid gravity, area, volume and bounds fail explicitly',()=>{
  for(const options of [{gravity:{x:0,y:0,z:0}},{gravity:{x:NaN,y:1,z:0}},{area:0},{volume:NaN},{bounds:{min:{x:0,y:0,z:0},max:{x:0,y:2,z:3}}}])assert.throws(()=>createWaterSurface(options),RangeError);
});

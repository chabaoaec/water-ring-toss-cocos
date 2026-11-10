import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld} from '../src/physics.js';

// Compare the former bounding-sphere policy with the optimized conservative
// compound AABBs. Body/constraint IDs differ between worlds; compare geometry,
// material contacts and gameplay state in stable world-body order instead.
const vec=v=>[v.x,v.y,v.z];
function snapshot(w) {
  return {
    rings:w.rings.map(r=>({position:vec(r.body.position),velocity:vec(r.body.velocity),angular:vec(r.body.angularVelocity),q:[...vec(r.body.quaternion),r.body.quaternion.w],peg:r.peg,supported:r.supported,stable:r.stable,scored:r.scored})),
    contacts:w.world.contacts.map(c=>({a:w.world.bodies.indexOf(c.bi),b:w.world.bodies.indexOf(c.bj),normal:vec(c.ni),ri:vec(c.ri),rj:vec(c.rj),enabled:c.enabled,multiplier:c.multiplier,restitution:c.restitution})),
    score:w.score,won:w.won,pumps:w.pumps,water:w.water,tracers:w.tracers.particles,events:w.events
  };
}
function pair(seed=42) {const old=new WaterWorld(seed),optimized=new WaterWorld(seed);old.world.broadphase.useBoundingBoxes=false;return [old,optimized];}
function checkStep(worlds,control=()=>{}) {
  for(const w of worlds){control(w);w.step(1/120);}
  assert.deepEqual(snapshot(worlds[0]),snapshot(worlds[1]));
  for(const w of worlds)w.events.splice(0);
}
function place(r,x,y,z=0,rotation=[0,0,0]) {
  r.body.position.set(x,y,z);r.body.velocity.set(0,0,0);r.body.angularVelocity.set(0,0,0);r.body.quaternion.setFromEuler(...rotation);r.x=x;r.y=y;r.z=z;
  // Teleport fixtures must invalidate cached AABBs, as normal integrate() does.
  r.body.aabbNeedsUpdate=true;
}
test('AABB broadphase retains exact contacts at tank faces, rotated post/ring rims and supported seats',()=>{
  const fixtures=[
    ['floor',w=>place(w.rings[0],70,35.5)],
    ['ceiling',w=>place(w.rings[0],210,536.5)],
    ['left wall',w=>place(w.rings[0],42.5,120)],
    ['right wall',w=>place(w.rings[0],377.5,120)],
    ['front wall',w=>place(w.rings[0],210,120,29.5)],
    ['back wall',w=>place(w.rings[0],210,120,-29.5)],
    ['post rim',w=>place(w.rings[0],116.5,230)],
    ['rotated rim',w=>place(w.rings[0],38,80,0,[.6,.2,.3])],
    ['ring impact',w=>{place(w.rings[0],70,80);place(w.rings[1],112,80)}],
    ['supported seat',w=>place(w.rings[0],143,39)]
  ];
  for(const [label,setup] of fixtures){const worlds=pair();for(const w of worlds)setup(w);let contacts=0;for(let i=0;i<120;i++){checkStep(worlds);contacts+=worlds[0].world.contacts.filter(c=>c.bi===worlds[0].rings[0].body||c.bj===worlds[0].rings[0].body).length;}assert.ok(contacts>0,`${label}: fixture must exercise real ring contacts`)}
});
test('AABB broadphase keeps multi-seed finite pumps, tilt/shake, coasting and scoring bit-for-bit equivalent',()=>{
  for(const seed of [42,43,97]){const worlds=pair(seed);for(let i=0;i<120*24;i++)checkStep(worlds,w=>{
    const t=i/120;
    // Includes seed43's ordinary left1.1s stroke and20s coast scoring path.
    w.setJet(0,seed===43?t<1.1:(t<12&&(t%2.4)<1.2));
    w.setJet(1,seed===43?false:(t<12&&((t+.6)%2.4)<1.2));
    if(seed!==43&&i%4===0){w.setGravityDirection({x:Math.sin(t*.9)*.4,y:-1,z:Math.cos(t*.7)*.2});w.setDeviceAcceleration({x:t<10?Math.sin(t*3)*2:0,y:0,z:t<10?Math.cos(t*2):0})}
  });if(seed===43)assert.ok(worlds[1].score>=1,'normal finite stroke must retain true supported scoring');}
});

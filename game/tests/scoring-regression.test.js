import test from 'node:test';
import assert from 'node:assert/strict';
import {WaterWorld,PEGS,RING_RADIUS,TUBE_RADIUS,INNER_RADIUS} from '../src/physics.js';
const dt=1/120;
function pose(r,x,y,z=0,tilt=0){r.body.position.set(x,y,z);r.body.velocity.set(0,0,0);r.body.angularVelocity.set(0,0,0);r.body.quaternion.setFromEuler(0,0,tilt);Object.assign(r,{x,y,z});}
test('an offset tilted ring with proven post clearance is threaded, but near-rim overlap and tip/floor poses remain rejected',()=>{
  const w=new WaterWorld(),r=w.rings[0];pose(r,277,220,8,Math.PI/3);
  // Every one of the24physical spheres clears even an infinite radius4.6
  // cylinder. The post axis crosses the inside of this ring at height220.
  for(const offset of r.body.shapeOffsets){const q=r.body.quaternion.vmult(offset);assert.ok(Math.hypot(q.x,q.z+8)-4.6-TUBE_RADIUS>0);}
  assert.equal(w.threadedPeg(r),1);
  pose(r,277,220,-8,-Math.PI/3);assert.equal(w.threadedPeg(r),1);
  // An ellipse may clear the infinitely thin hole plane while the actual
  // thick tube intersects the post. This steep-tilt pose must remain rejected.
  pose(r,277,80,8,Math.acos(.4));assert.equal(w.postClearsRing(r,PEGS[1]),false);assert.equal(w.threadedPeg(r),null);
  pose(r,289,40);assert.equal(w.threadedPeg(r),null);
  pose(r,277,340);assert.equal(w.threadedPeg(r),null);pose(r,277,20);assert.equal(w.threadedPeg(r),null);
});
test('thick-tube clearance uses closed post caps and rejects spheres inside the post',()=>{
  const w=new WaterWorld(),r=w.rings[0],peg=PEGS[1];
  // One sphere is on the post axis; the others share its height. These are
  // artificial geometric queries, not score/physical gameplay fixtures.
  for(const [height,clear]of [[peg.tip+4,true],[peg.tip+3,false],[peg.base-4,true],[peg.base-3,false],[200,false]]){
    pose(r,peg.x+RING_RADIUS,height);assert.equal(w.postClearsRing(r,peg),clear,`height ${height}`);
  }
});
test('accepted section ellipses always fit inside the hole in an independent dense tapered-post sample',()=>{
  const w=new WaterWorld(),r=w.rings[0],peg=PEGS[1],slope=(3.7-4.6)/(peg.tip-peg.base),intercept=4.6-slope*peg.base;let accepted=0;
  for(const angle of[0,.2,.5,.8,1.05,1.25])for(const x of[-12,-8,-4,0,4,8,12])for(const z of[-12,-8,-4,0,4,8,12]) {
    pose(r,peg.x+x,220,z,angle);if(w.threadedPeg(r)!==1)continue;accepted++;
    const n=r.body.quaternion.vmult({x:0,y:1,z:0});
    for(let i=0;i<256;i++){
      const c=Math.cos(i*Math.PI/128),s=Math.sin(i*Math.PI/128),project=n.x*c+n.z*s,d=n.x*(-x)+n.z*(-z);
      const y=(n.y*r.y-d-intercept*project)/(n.y+slope*project),radius=intercept+slope*y;
      assert.ok(Math.hypot(-x+radius*c,y-r.y,-z+radius*s)<INNER_RADIUS-.35+1e-10);
    }
  }
  assert.ok(accepted>80,`accepted ${accepted}`);assert.equal(RING_RADIUS-TUBE_RADIUS,INNER_RADIUS);
});
test('real capture remains while threaded through contact gaps and clears after physically leaving the post',()=>{
  const w=new WaterWorld();for(const r of w.rings)pose(r,277,350+r.id*25);
  let captured=0,observedFirstCapture=0,retainedWithoutStable=false;
  for(let i=0;i<3000;i++){
    w.step(dt);
    for(const r of w.rings){const mask=1<<r.id;if(r.scored&&!(observedFirstCapture&mask)){assert.ok(r.supported);assert.ok(r.stable>=.7);observedFirstCapture|=mask;}if(captured&mask&&r.peg===1)assert.equal(r.scored,true);if(r.scored&&r.stable<.7)retainedWithoutStable=true;if(r.scored)captured|=mask;}
  }
  assert.equal(captured,255);assert.equal(w.score,8);assert.equal(observedFirstCapture,255);assert.ok(retainedWithoutStable);
  // Explicit artificial removal tests bookkeeping, not natural gameplay.
  const r=w.rings[7];pose(r,210,220);w.step(dt);assert.equal(r.peg,null);assert.equal(r.scored,false);assert.equal(r.stable,0);
});
test('a never-captured freely falling ring already through the post still needs the existing support qualification',()=>{
  const w=new WaterWorld(),r=w.rings[0];for(const other of w.rings.slice(1))w.world.removeBody(other.body);w.rings=[r];pose(r,277,220);
  for(let i=0;i<120;i++){w.step(dt);assert.equal(r.peg,1);assert.equal(r.supported,false);assert.equal(r.scored,false);}
});

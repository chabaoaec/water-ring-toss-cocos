// Bounded QA search: only real press/release input; never moves bodies or scores.
import {WaterWorld} from '../src/physics.js';
import fs from 'node:fs';
const w=new WaterWorld(42),trace=[],results=[];
const run=seconds=>{for(let i=0;i<Math.round(seconds*120);i++)w.step(1/120);};
for(let cycle=0;cycle<10&&!w.won;cycle++) {
  const side=cycle%2, pulses=cycle%3===1?4:3;
  for(let k=0;k<pulses;k++) {w.setJet(side,true);run(.9);w.setJet(side,false);run(.08);trace.push({side,hold:.9,release:.08});}
  run(18);trace.push({wait:18});
  const result={cycle,score:w.score,won:w.won,rings:w.rings.map(r=>({id:r.id,x:Math.round(r.x),y:Math.round(r.y),peg:r.peg,supported:r.supported,stable:r.stable,scored:r.scored}))};
  results.push(result);console.log(JSON.stringify(result));
}
fs.writeFileSync('evidence/v2/finite-pulse-search.json',JSON.stringify({seed:42,maximumCycles:10,trace,results,won:w.won},null,2)+'\n');

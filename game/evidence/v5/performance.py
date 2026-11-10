from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os
out=Path(__file__).parent
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':900});page.goto(os.environ.get('GAME_URL','http://127.0.0.1:8790/'));page.wait_for_function('window.__waterToy?.ready')
 result=page.evaluate('''async()=>{const w=__waterToy.world,results=[];for(const mode of ['idle','both']){w.reset(42);const frames=[],steps=[];const original=w.step.bind(w);w.step=function(dt){const t=performance.now();original(dt);steps.push(performance.now()-t)};let last=performance.now(),start=last;await new Promise(resolve=>{function frame(now){const elapsed=(now-start)/1000;if(mode==='both'){w.setJet(0,elapsed%1.9<1.1);w.setJet(1,elapsed%1.9<1.1)}frames.push(now-last);last=now;if(elapsed<6)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});w.setJet(0,false);w.setJet(1,false);w.step=original;const sorted=frames.slice(2).sort((a,b)=>a-b),ss=steps.sort((a,b)=>a-b);results.push({mode,frames:sorted.length,fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),frameMedian:sorted[Math.floor(sorted.length*.5)],frameP95:sorted[Math.floor(sorted.length*.95)],stepMedian:ss[Math.floor(ss.length*.5)],stepP95:ss[Math.floor(ss.length*.95)]})}return {renderer:document.createElement('canvas').getContext('webgl2')?.getParameter(0x1F01),results}}''')
 b.close()
result['limits']='Single bounded Chromium/SwiftShader 2CPU run, 6s idle/6s cycles, no concurrent model review; not user Brave/mobile hardware FPS or controlled v4 comparison.'
(out/'performance.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

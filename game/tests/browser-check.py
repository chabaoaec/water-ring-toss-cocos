# Independent final-ZIP browser probe. Adapt only documented public QA fields after
# source freeze; do not mistake synthetic stepping for real browser input.
from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os
out=Path(__file__).parent
url=os.environ.get('GAME_URL','http://127.0.0.1:8080/?build=v4')
report={'url':url,'page_errors':[],'cases':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for mobile,width,height in [(True,390,844),(False,1280,900)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile);page=c.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)));page.on('console',lambda m: report['page_errors'].append(m.text) if m.type=='error' else None);page.goto(url);page.wait_for_function('window.__waterToy?.ready')
  assert 'DEMO v4' in page.locator('.toy-badge').inner_text()
  def state():return page.evaluate('({time:__waterToy.world.time,states:__waterToy.world.jetStates,held:__waterToy.world.held,jets:__waterToy.world.jets,pumps:__waterToy.world.pumps,water:__waterToy.world.water,particles:__waterToy.world.tracers.particles.map(p=>({x:p.x,y:p.y,z:p.z}))})')
  def wait_sim(t):
   start=page.evaluate('__waterToy.world.time');page.wait_for_function('(v)=>__waterToy.world.time>=v[0]+v[1]',arg=[start,t],timeout=45000)
  page.wait_for_function('__waterToy.graphics.node.children.length===128')
  renderer=page.evaluate("""async()=>{const {cc}=await import('./src/engine-bootstrap.js');const w=__waterToy.world,g=__waterToy.graphics;const before=g.node.children.length;for(let i=0;i<4;i++)w.reset(42);w.tracers.setReducedMotion(true);return {before,particles:w.tracers.particles.length};}""")
  page.wait_for_function('__waterToy.graphics.node.children.filter(n=>n.active).length===36',timeout=10000)
  renderer['reduced_active']=page.evaluate("__waterToy.graphics.node.children.filter(n=>n.active).length");assert renderer['reduced_active']==36
  page.evaluate('__waterToy.world.tracers.setReducedMotion(false)');page.wait_for_function('__waterToy.graphics.node.children.filter(n=>n.active).length===128',timeout=10000)
  renderer['normal_active']=page.evaluate("__waterToy.graphics.node.children.filter(n=>n.active).length");renderer['pool']=page.evaluate('__waterToy.graphics.node.children.length');assert renderer['normal_active']==128 and renderer['pool']==128 and renderer['before']==128
  page.locator('#menu').click();page.locator('#menu-panel').evaluate('(e)=>e.style.visibility="hidden"');page.wait_for_timeout(100)
  visible=page.screenshot();page.evaluate('()=>{for(const n of __waterToy.graphics.node.children)n.active=false}');page.wait_for_timeout(100);hidden=page.screenshot()
  import base64
  renderer['pixel_diff']=page.evaluate("""async(data)=>{const arrays=[];for(const b64 of data){const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);arrays.push(x.getImageData(0,0,c.width,c.height).data)}let different=0,max=0;for(let i=0;i<arrays[0].length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(arrays[0][i+k]-arrays[1][i+k])));if(d)different++;max=Math.max(max,d)}return {different,max};}""",[base64.b64encode(x).decode() for x in [visible,hidden]])
  assert renderer['pixel_diff']['different']>500 and renderer['pixel_diff']['max']>2
  page.evaluate('()=>{for(const n of __waterToy.graphics.node.children)n.active=true}');page.locator('#menu-panel').evaluate('(e)=>e.style.visibility=""');page.keyboard.press('Escape')
  report.setdefault('renderer',[]).append({'mobile':mobile,**renderer})
  initial=state();assert len(initial['particles'])>=36
  xs=[p['x'] for p in initial['particles']];ys=[p['y'] for p in initial['particles']];assert min(xs)<80 and max(xs)>340 and min(ys)<100 and max(ys)>470
  (out/f"{'mobile' if mobile else 'desktop'}-idle.png").write_bytes(page.screenshot(full_page=True))
  wait_sim(1.0);assert len(state()['particles'])>=36
  page.keyboard.down('a');wait_sim(.1);short=page.evaluate('__waterToy.world.sampleFlow(91,60,0).y');wait_sim(.5);long=page.evaluate('__waterToy.world.sampleFlow(91,60,0).y');assert long>short*1.5
  (out/f"{'mobile' if mobile else 'desktop'}-press.png").write_bytes(page.screenshot(full_page=True))
  page.wait_for_function('__waterToy.world.jetStates[0].exhausted');assert state()['held'][0] and not state()['jets'][0]
  wait_sim(.3);assert state()['states'][0]['remaining']==0
  page.keyboard.down('ArrowLeft');page.keyboard.up('a');wait_sim(.2);assert state()['held'][0] and state()['states'][0]['remaining']==0
  page.keyboard.up('ArrowLeft');released=state();assert released['states'][0]['remaining']<.08
  wait_sim(.25);partial=state();assert 0<partial['states'][0]['remaining']<.8
  inlet_check=page.evaluate('''async()=>{const {INTAKES}=await import('./src/physics.js');const p=INTAKES[0],q={x:p.x+35,y:p.y+50,z:p.z+10};const f=__waterToy.world.sampleFlow(q.x,q.y,q.z);return {flow:f,towardDot:f.x*(p.x-q.x)+f.y*(p.y-q.y)+f.z*(p.z-q.z)};}''');assert inlet_check['towardDot']>0
  (out/f"{'mobile' if mobile else 'desktop'}-refill.png").write_bytes(page.screenshot(full_page=True))
  page.keyboard.down('a');repress=state();assert repress['states'][0]['remaining']<.8
  page.wait_for_function('__waterToy.world.jetStates[0].exhausted');page.keyboard.up('a')
  wait_sim(1.0);assert abs(state()['states'][0]['remaining']-.8)<1e-8
  page.keyboard.down('a');wait_sim(.2);page.locator('#menu').click();page.keyboard.up('a');paused=state();page.wait_for_timeout(300);assert state()==paused
  page.keyboard.press('Escape');wait_sim(.2)
  current=state();total=current['water']['tank']+sum(v['remaining'] for v in current['states']);initial_total=initial['water']['tank']+sum(v['remaining'] for v in initial['states']);assert abs(total-initial_total)<1e-8
  report['cases'].append({'mobile':mobile,'initial_particles':len(initial['particles']),'initial_x_range':[min(xs),max(xs)],'initial_y_range':[min(ys),max(ys)],'short_flow':short,'long_flow':long,'remaining_immediately_after_release':released['states'][0]['remaining'],'remaining_after_partial_refill':partial['states'][0]['remaining'],'pause_freezes':True,'intake_toward_dot':inlet_check['towardDot'],'water_balance_error':total-initial_total})
  c.close()
 b.close()
assert not report['page_errors'];(out/'browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

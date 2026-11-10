# Browser QA against an already-served Web build. GAME_URL selects the server.
# No forced scoring or synthetic physics stepping; limitations are in the report.
from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os
out=Path(__file__).resolve().parents[1]/'evidence/v3';out.mkdir(exist_ok=True,parents=True)
url=os.environ.get('GAME_URL','http://127.0.0.1:8080/?build=v3')
report={'url':url,'page_errors':[],'cases':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for mobile,width,height in [(True,390,844),(False,1280,900)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile);page=c.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)));page.goto(url);page.wait_for_function('window.__waterToy?.ready')
  assert 'DEMO v3' in page.locator('.toy-badge').inner_text()
  def state():return page.evaluate('({time:__waterToy.world.time,states:__waterToy.world.jetStates,held:__waterToy.world.held,jets:__waterToy.world.jets,pumps:__waterToy.world.pumps,water:__waterToy.world.water,particles:__waterToy.world.tracers.particles.map(p=>({x:p.x,y:p.y,z:p.z}))})')
  def wait_sim(t):
   start=page.evaluate('__waterToy.world.time');page.wait_for_function('(v)=>__waterToy.world.time>=v[0]+v[1]',arg=[start,t],timeout=45000)
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

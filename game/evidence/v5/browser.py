from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os
out=Path(__file__).parent
errors=[]; result={'scope':'Actual Chromium/SwiftShader UI with synthetic sensor events, not physical phone or Brave hardware','cases':[]}
url=os.environ.get('GAME_URL','http://127.0.0.1:8790/')
mock='''window.__permissionCalls=0; window.__permissionResult='denied';
for(const name of ['DeviceMotionEvent','DeviceOrientationEvent']) {
 window[name]=class { static requestPermission(){window.__permissionCalls++;return Promise.resolve(window.__permissionResult)} };
}'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def open_page(width,height,permission=False,reduced=False):
  c=b.new_context(viewport={'width':width,'height':height},reduced_motion='reduce' if reduced else 'no-preference')
  if permission:c.add_init_script(mock)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(url);page.wait_for_function('window.__waterToy?.ready');return c,page
 c,page=open_page(390,844,True)
 state=lambda:page.evaluate('__waterToy.gravityInput.getState()')
 assert state()['enabled'] and not state()['active'] and state()['state']=='permission'
 assert page.evaluate('__permissionCalls')==0
 page.locator('#menu').click();page.locator('#gravity-authorize').click()
 page.wait_for_function('__waterToy.gravityInput.getState().state === "denied"')
 assert page.evaluate('__permissionCalls')==2
 page.evaluate("__permissionResult='granted'");page.locator('#gravity-authorize').click()
 page.wait_for_function('__waterToy.gravityInput.getState().state === "waiting"')
 assert page.evaluate('__permissionCalls')==4
 page.locator('#resume').click()
 def motion(x,y,z,n=1):
  page.evaluate('''async([x,y,z,n])=>{for(let i=0;i<n;i++) {window.dispatchEvent(Object.assign(new Event('devicemotion'),{accelerationIncludingGravity:{x,y,z}}));await new Promise(r=>setTimeout(r,17));}}''',[x,y,z,n])
 motion(0,9.81,0);assert state()['active']
 motion(-5.886,7.848,0,75)
 direction=page.evaluate('__waterToy.world.gravityDirection')
 assert direction['x']>.5 and direction['y']<-.7,direction
 page.locator('#menu').click()
 frozen=page.evaluate('({time:__waterToy.world.time,direction:{...__waterToy.world.gravityDirection}})')
 motion(5.886,7.848,0,25)
 after=page.evaluate('({time:__waterToy.world.time,direction:{...__waterToy.world.gravityDirection}})')
 assert frozen==after
 page.locator('#gravity-calibrate').click()
 assert abs(page.evaluate('__waterToy.world.gravityDirection.x'))<1e-9
 page.locator('#gravity-toggle').click();assert not state()['enabled'] and not state()['active']
 page.locator('#gravity-toggle').click();assert state()['enabled']
 page.locator('#resume').click();motion(0,9.81,0);motion(-5.886,7.848,0,70)
 direction=page.evaluate('({...__waterToy.world.gravityDirection})')
 page.evaluate('__waterToy.reset()')
 restored=page.evaluate('({...__waterToy.world.gravityDirection})');assert direction==restored
 page.locator('#menu').click();page.locator('#gravity-toggle').click();page.locator('#resume').click()
 page.evaluate('__waterToy.world.reset(42)')
 page.wait_for_timeout(300)
 (out/'v5-mobile-idle.png').write_bytes(page.screenshot(full_page=True))
 water=lambda:page.evaluate('({t:__waterToy.world.time,water:__waterToy.world.water.tank,surface:__waterToy.world.water.surfaceY,remaining:__waterToy.world.jetStates.map(s=>s.remaining),total:__waterToy.world.tracers.particles.length,visible:__waterToy.graphics.node.children.filter(n=>n.active).length})')
 idle=water();assert abs(idle['surface']-450)<1e-7
 page.keyboard.down('a');page.keyboard.down('d')
 page.wait_for_function('__waterToy.world.jetStates.every(s=>s.exhausted)',timeout=20000)
 full=water();assert abs(full['surface']-533.6)<1e-7 and full['visible']==128
 (out/'v5-mobile-pumped.png').write_bytes(page.screenshot(full_page=True))
 page.keyboard.up('a');page.keyboard.up('d')
 page.wait_for_function('__waterToy.world.jetStates.every(s=>s.remaining>=.8)',timeout=20000)
 refill=water();assert abs(refill['surface']-450)<1e-7
 assert abs(refill['water']+sum(refill['remaining'])-9.6)<1e-8
 (out/'v5-mobile-refill.png').write_bytes(page.screenshot(full_page=True))
 result['cases'].append({'name':'permission-denied-retry-granted/synthetic-motion/pause/calibrate/off-on/reset/pump-waterline','direction':direction,'idle':idle,'full':full,'refill':refill})
 c.close()
 c,page=open_page(1280,900)
 page.wait_for_timeout(3700)
 desktop=page.evaluate('__waterToy.gravityInput.getState()');assert desktop['enabled'] and not desktop['active']
 assert page.evaluate('__waterToy.graphics.node.children.length')==128
 (out/'v5-desktop.png').write_bytes(page.screenshot(full_page=True))
 # Independent physical input protocol, advance the actual world between renders.
 protocol=page.evaluate('''async()=>{const {cc}=await import('./src/engine-bootstrap.js');cc.game.pause();const w=__waterToy.world;w.reset(42);for(let i=0;i<Math.round(17.9*120);i++){const t=i/120;w.setJet(0,t<1.1||(t>=1.8&&t<1.9));w.step(1/120)}const result={score:w.score,pumps:w.pumps,supported:w.rings.filter(r=>r.scored).map(r=>({id:r.id,supported:r.supported,peg:r.peg}))};cc.game.resume();return result;}''')
 assert protocol['score']>=1 and protocol['pumps']==2,protocol
 page.wait_for_timeout(250)
 (out/'v5-desktop-supported-score.png').write_bytes(page.screenshot(full_page=True))
 result['cases'].append({'name':'desktop-no-data/actual-world-button-score','sensor':desktop,'protocol':protocol});c.close()
 c,page=open_page(390,844,reduced=True)
 assert page.evaluate('__waterToy.world.tracers.particles.length')==36
 page.wait_for_function('__waterToy.graphics.node.children.length===36')
 result['cases'].append({'name':'reduced-motion','total':36});c.close()
 b.close()
result['errors']=errors
(out/'browser-result.json').write_text(json.dumps(result,indent=2));assert not errors,errors
print('COMPLETE',json.dumps(result))

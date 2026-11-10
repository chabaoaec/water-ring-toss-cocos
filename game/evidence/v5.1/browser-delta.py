from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os,math
out=Path(__file__).parent;errors=[];url=os.environ.get('GAME_URL','http://127.0.0.1:8791/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(url);page.wait_for_function('window.__waterToy?.ready && __waterToy.graphics.node.children.length===128')
 def sample():return page.evaluate('''()=>{const w=__waterToy.world;return {time:w.time,surface:w.getWaterSurfaceY(),tank:w.water.tank,total:w.water.total,remaining:w.jetStates.map(s=>s.remaining),rates:w.jetStates.map(s=>s.volumeRate),flow:w.sampleFlow(91,210,0),particles:w.tracers.particles.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,inChamber:p.inChamber}))}}''')
 def until_time(target):page.wait_for_function('__waterToy.world.time >= '+str(target),timeout=45000)
 initial=sample();assert abs(initial['surface']-520)<1e-6;assert abs(initial['total']-49.6)<1e-6
 (out/'v51-initial-small-air.png').write_bytes(page.screenshot(full_page=True))
 page.keyboard.down('a');page.wait_for_function('__waterToy.world.jetStates[0].exhausted',timeout=20000)
 exhausted=sample();assert exhausted['remaining'][0]==0 and exhausted['rates'][0]==0
 assert math.hypot(*exhausted['flow'].values())>100
 (out/'v51-exhausted-coasting.png').write_bytes(page.screenshot(full_page=True))
 until_time(exhausted['time']+.5);coast=sample()
 moving=sum(math.dist((p['x'],p['y'],p['z']),(q['x'],q['y'],q['z']))>2 for p,q in zip(exhausted['particles'],coast['particles']) if p['inChamber'] is None and q['inChamber'] is None)
 assert moving>60,moving
 assert coast['remaining'][0]==0 and abs(coast['tank']-exhausted['tank'])<1e-8
 (out/'v51-coast-half-second.png').write_bytes(page.screenshot(full_page=True))
 until_time(exhausted['time']+5);settled=sample()
 speed=lambda s:math.hypot(*s['flow'].values())
 assert speed(settled)<speed(exhausted)*.002,(speed(exhausted),speed(settled))
 page.keyboard.up('a');page.wait_for_function('__waterToy.world.jetStates.every(s=>s.remaining>=.8)',timeout=15000)
 page.keyboard.down('a');page.keyboard.down('d');page.wait_for_function('__waterToy.world.jetStates.every(s=>s.exhausted)',timeout=20000)
 full=sample();assert abs(full['surface']-536.2666666667)<1e-6
 (out/'v51-full-small-air.png').write_bytes(page.screenshot(full_page=True))
 page.keyboard.up('a');page.keyboard.up('d');page.locator('#menu').click()
 frozen=sample();page.wait_for_timeout(400);assert frozen==sample()
 page.locator('#resume').click();page.wait_for_function('__waterToy.world.jetStates.every(s=>s.remaining>=.8)',timeout=15000)
 refill=sample();assert abs(refill['surface']-520)<1e-6
 assert abs(refill['tank']+sum(refill['remaining'])-49.6)<1e-8
 page.evaluate('__waterToy.reset()');reset=sample();assert abs(reset['surface']-520)<1e-6 and speed(reset)==0
 assert page.evaluate('__waterToy.gravityInput.getState().enabled')
 b.close()
summary={'scope':'actual Chromium/SwiftShader v5.1 delta, no model process overlap/hardware claim','initial_surface':initial['surface'],'full_surface':full['surface'],'early_flow':exhausted['flow'],'half_second_flow':coast['flow'],'five_second_flow':settled['flow'],'visible_moved_over2px_after_empty':moving,'empty_tank_volume_unchanged':True,'refill_surface':refill['surface'],'reset_speed':speed(reset),'pause_frozen':True,'errors':errors}
(out/'browser-result.json').write_text(json.dumps(summary,indent=2));assert not errors;print(json.dumps(summary))

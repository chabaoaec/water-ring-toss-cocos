from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json
out=Path(__file__).parent;url='https://chabaoaec.github.io/water-ring-toss-cocos/?build=v5.1';errors=[];failed=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda r:failed.append(r.url))
 page.goto(url);page.wait_for_function('window.__waterToy?.ready && __waterToy.graphics.node.children.length===128',timeout=45000)
 assert 'DEMO v5.1' in page.locator('body').inner_text()
 state=page.evaluate('({secure:isSecureContext,engine:__waterToy.engine,surface:__waterToy.world.getWaterSurfaceY(),sensor:__waterToy.gravityInput.getState(),url:location.href})')
 assert state['secure'] and state['engine']=='3.8.7' and state['surface']==520 and state['sensor']['enabled']
 (out/'v51-online-initial.png').write_bytes(page.screenshot(full_page=True))
 page.keyboard.down('a');page.wait_for_function('__waterToy.world.jetStates[0].exhausted',timeout=20000)
 before=page.evaluate('({time:__waterToy.world.time,flow:__waterToy.world.sampleFlow(91,210,0).y,water:__waterToy.world.water.tank,q:__waterToy.world.jetStates[0].volumeRate})')
 page.wait_for_function('__waterToy.world.time >= '+str(before['time']+.5),timeout=20000)
 after=page.evaluate('({flow:__waterToy.world.sampleFlow(91,210,0).y,water:__waterToy.world.water.tank,q:__waterToy.world.jetStates[0].volumeRate})')
 assert 1<after['flow']<before['flow'] and before['water']==after['water'] and before['q']==after['q']==0
 (out/'v51-online-coast.png').write_bytes(page.screenshot(full_page=True));page.keyboard.up('a');b.close()
assert not errors and not failed,(errors,failed)
result={'url':url,'startup':state,'empty_coasting_before':before,'after_half_second':after,'errors':errors,'failed_requests':failed,'limits':'actual anonymous HTTPS Cocos Chromium/SwiftShader; not physical phone/Brave FPS'}
(out/'online-browser-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,urllib.request
out=Path(__file__).parent
url='http://127.0.0.1:8086/?build=v5'
with urllib.request.urlopen(url) as response:
 headers=dict(response.headers);assert response.headers['X-Pocket-Tide-Version']=='v5';assert 'no-store' in response.headers['Cache-Control']
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);page.wait_for_function('window.__waterToy?.ready && __waterToy.graphics.node.children.length===128')
 assert 'DEMO v5' in page.locator('body').inner_text()
 state=page.evaluate('({engine:__waterToy.engine,total:__waterToy.world.tracers.particles.length,visible:__waterToy.graphics.node.children.filter(n=>n.active).length,surface:__waterToy.world.getWaterSurfaceY(),gravity:__waterToy.gravityInput.getState()})')
 assert state['engine']=='3.8.7' and state['total']==128 and state['gravity']['enabled'] and state['surface']==450
 (out/'v5-final-zip.png').write_bytes(page.screenshot(full_page=True));b.close()
assert not errors
(out/'zip-browser-result.json').write_text(json.dumps({'url':url,'headers':headers,'state':state,'errors':errors},indent=2));print('PASS fresh ZIP browser')

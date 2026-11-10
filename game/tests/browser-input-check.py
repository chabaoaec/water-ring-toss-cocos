from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil,json,os
out=Path(__file__).resolve().parents[1]/'evidence/v3';out.mkdir(exist_ok=True,parents=True)
url=os.environ.get('GAME_URL','http://127.0.0.1:8080/?build=v3')
report={'page_errors':[],'cases':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=c.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)));page.goto(url);page.wait_for_function('window.__waterToy?.ready')
 rect=page.locator('#left-jet').bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2;cdp=c.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-4,'y':y,'id':1},{'x':x+4,'y':y,'id':2}]});page.wait_for_function('__waterToy.world.jetStates[0].exhausted')
 assert page.evaluate('__waterToy.world.jetStates[0].remaining===0&&__waterToy.world.held[0]&&!__waterToy.world.jets[0]')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert page.evaluate('!__waterToy.world.held[0]&&__waterToy.world.jetStates[0].remaining<.08')
 start=page.evaluate('__waterToy.world.time');page.wait_for_function('(t)=>__waterToy.world.time>t+.2',arg=start);partial=page.evaluate('__waterToy.world.jetStates[0].remaining');assert 0<partial<.8
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':3}]});assert page.evaluate('__waterToy.world.jets[0]&&__waterToy.world.jetStates[0].remaining<.8')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});assert page.evaluate('__waterToy.world.held.every(v=>!v)&&__waterToy.world.jets.every(v=>!v)')
 page.evaluate("window.dispatchEvent(new Event('blur'))");assert page.locator('#menu-panel').is_visible();before=page.evaluate('JSON.stringify({time:__waterToy.world.time,water:__waterToy.world.water,states:__waterToy.world.jetStates})');page.wait_for_timeout(350);assert before==page.evaluate('JSON.stringify({time:__waterToy.world.time,water:__waterToy.world.water,states:__waterToy.world.jetStates})')
 page.keyboard.press('Escape');assert not page.locator('#menu-panel').is_visible();report['cases'].append({'real_CDP_two_touch_full_release_refill':True,'partial_water':partial,'real_CDP_cancel_stops_jet':True,'synthetic_blur_enters_menu_and_freezes_water':True,'escape_resumes':True,'limitation':'No physical phone or real partial CDP touchEnd; blur is dispatched application event.'});c.close()
 c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=c.new_page();page.goto(url);page.wait_for_function('window.__waterToy?.ready');assert page.evaluate('__waterToy.world.tracers.particles.length===36');report['cases'].append({'prefers_reduced_motion_initial_population':36});(out/'reduced-motion.png').write_bytes(page.screenshot());c.close();b.close()
assert not report['page_errors'];(out/'input-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

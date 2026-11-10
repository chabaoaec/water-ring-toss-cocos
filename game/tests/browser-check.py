from playwright.sync_api import sync_playwright
import shutil,json,pathlib,time,os
root=pathlib.Path(__file__).resolve().parents[1]
(root/'evidence').mkdir(exist_ok=True)
base_url=os.environ.get('GAME_URL','http://127.0.0.1:8080')
result={'checks':[],'console_errors':[],'page_errors':[],'webgl_warnings':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1','--num-raster-threads=1'])
 for name,width,height,mobile in [('desktop',1280,900,False),('mobile',390,844,True)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page=ctx.new_page();page.on('pageerror',lambda e:result['page_errors'].append(str(e)))
  page.on('console',lambda m:result['console_errors'].append(m.text) if m.type=='error' else result['webgl_warnings'].append(m.text) if 'GL_INVALID' in m.text else None)
  page.goto(base_url);page.wait_for_function('window.__waterToy?.ready');page.wait_for_timeout(800)
  state=page.evaluate('''()=>({engine:__waterToy.engine,physics:__waterToy.physics,component:__waterToy.graphics.constructor.name,children:__waterToy.scene.children.length,bodyCount:__waterToy.world.world.bodies.length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,buttonsVisible:document.querySelector('#right-jet').getBoundingClientRect().bottom<innerHeight,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()})''')
  result['checks'].append({'name':name,**state})
  if not mobile:
   before=page.evaluate('__waterToy.world.rings[0].y');start_time=page.evaluate('__waterToy.world.time');page.keyboard.down('a');page.wait_for_function('(start)=>__waterToy.world.time>=start+1.7',arg=start_time,timeout=45000);assert page.evaluate('__waterToy.world.jets[0]')
   after=page.evaluate('__waterToy.world.rings[0].y');page.keyboard.up('a');assert not page.evaluate('__waterToy.world.jets[0]');assert after>before+50
   page.keyboard.down('ArrowLeft');page.keyboard.down('d');assert page.evaluate('__waterToy.world.jets.every(Boolean)');page.keyboard.up('ArrowLeft');assert page.evaluate('!__waterToy.world.jets[0]&&__waterToy.world.jets[1]');page.evaluate("window.dispatchEvent(new Event('blur'))");assert page.evaluate('__waterToy.world.jets.every(x=>!x)')
   page.keyboard.up('d');page.locator('#menu').click();page.get_by_role('button',name='重新开始',exact=True).click();assert page.evaluate('__waterToy.world.score===0&&__waterToy.world.pumps===0&&!__waterToy.world.won')
   page.keyboard.down('a');assert page.evaluate('__waterToy.world.jets[0]');page.locator('#menu').click();assert page.evaluate('__waterToy.world.jets.every(x=>!x)');page.keyboard.up('a');paused_time=page.evaluate('__waterToy.world.time');page.wait_for_timeout(250);assert page.evaluate('__waterToy.world.time')==paused_time;page.keyboard.down('a');assert not page.evaluate('__waterToy.world.jets[0]');page.keyboard.up('a');page.locator('#resume').click();page.wait_for_function('(t)=>__waterToy.world.time>t',arg=paused_time);
   result['checks'].append({'name':'menu releases jets / freezes physics / blocks jets / resume','pass':True})
   result['checks'].append({'name':'keyboard jets / lift / simultaneous input / blur release / reset','pass':True,'liftBefore':before,'liftAfter':after})
  else:
   box=page.locator('#left-jet').bounding_box();cdp=ctx.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}]});assert page.evaluate('__waterToy.world.jets[0]');cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});assert not page.evaluate('__waterToy.world.jets[0]')
   assert not page.locator('#reset').is_visible();page.locator('#menu').click();assert page.locator('#reset').is_visible();page.get_by_role('button',name='重新开始',exact=True).click();assert not page.locator('#menu-panel').is_visible();result['checks'].append({'name':'touch pointer cancellation / menu-only explicit restart','pass':True})
  (root/'evidence'/f'{name}.png').write_bytes(page.screenshot(full_page=True));ctx.close()
 browser.close()
assert not result['console_errors'],result['console_errors'];assert not result['page_errors'],result['page_errors'];assert not result['webgl_warnings'],result['webgl_warnings']
(root/'evidence'/'browser-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))

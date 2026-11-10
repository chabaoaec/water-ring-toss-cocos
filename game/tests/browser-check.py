from playwright.sync_api import sync_playwright
import shutil,json,pathlib,os,datetime
root=pathlib.Path(__file__).resolve().parents[1]
(root/'evidence/v2').mkdir(exist_ok=True,parents=True)
base_url=os.environ.get('GAME_URL','http://127.0.0.1:8080')
result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':base_url,'checks':[],'console_errors':[],'page_errors':[],'webgl_warnings':[]}
args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1','--num-raster-threads=1']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=args)
 result['browser_version']=browser.version
 for name,width,height,mobile in [('desktop',1280,900,False),('mobile',390,844,True)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page=ctx.new_page();page.on('pageerror',lambda e:result['page_errors'].append(str(e)))
  page.on('console',lambda m:result['console_errors'].append(m.text) if m.type=='error' else result['webgl_warnings'].append(m.text) if 'GL_INVALID' in m.text else None)
  page.goto(base_url);page.wait_for_function('window.__waterToy?.ready');page.wait_for_timeout(300)
  def sim_wait(seconds):
   start=page.evaluate('__waterToy.world.time')
   page.wait_for_function('(start)=>__waterToy.world.time>=start[0]+start[1]',arg=[start,seconds],timeout=45000)
  state=page.evaluate('''()=>({engine:__waterToy.engine,physics:__waterToy.physics,component:__waterToy.graphics.constructor.name,bodyCount:__waterToy.world.world.bodies.length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,buttonsVisible:document.querySelector('#right-jet').getBoundingClientRect().bottom<innerHeight,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()})''')
  assert not state['horizontalOverflow'];assert state['buttonsVisible'];result['checks'].append({'name':name,**state})
  if not mobile:
   before=page.evaluate('__waterToy.world.rings[0].y');page.keyboard.down('a');sim_wait(.65)
   assert page.evaluate('__waterToy.world.jets[0]');after=page.evaluate('__waterToy.world.rings[0].y');assert after>before+25
   assert page.evaluate('__waterToy.world.tracers.particles.length>5')
   (root/'evidence/v2'/'desktop-flow.png').write_bytes(page.screenshot(full_page=True))
   sim_wait(.6);assert page.evaluate('__waterToy.world.held[0]&&!__waterToy.world.jets[0]&&__waterToy.world.jetStates[0].exhausted')
   assert '耗尽' in page.locator('#left-feedback').inner_text()
   pumps=page.evaluate('__waterToy.world.pumps')
   for _ in range(4):page.keyboard.down('a')
   page.keyboard.down('ArrowLeft');page.keyboard.up('a');sim_wait(.1)
   assert page.evaluate('__waterToy.world.held[0]&&!__waterToy.world.jets[0]')
   assert page.evaluate('__waterToy.world.pumps')==pumps
   page.keyboard.down('d');assert page.evaluate('__waterToy.world.jets[1]&&!__waterToy.world.jets[0]')
   page.keyboard.up('ArrowLeft');assert page.evaluate('!__waterToy.world.held[0]&&__waterToy.world.jetStates[0].remaining===.8')
   page.keyboard.down('a');assert page.evaluate('__waterToy.world.jets[0]');assert page.evaluate('__waterToy.world.pumps')==pumps+2
   page.evaluate("window.dispatchEvent(new Event('blur'))");assert page.evaluate('__waterToy.world.held.every(x=>!x)&&__waterToy.world.jets.every(x=>!x)')
   page.keyboard.up('a');page.keyboard.up('d')
   page.locator('#left-jet').focus();page.keyboard.down('Enter');sim_wait(1.2);pumps=page.evaluate('__waterToy.world.pumps')
   page.keyboard.down('Enter');assert page.evaluate('__waterToy.world.held[0]&&!__waterToy.world.jets[0]');assert page.evaluate('__waterToy.world.pumps')==pumps;page.keyboard.up('Enter')
   page.keyboard.down('a');page.locator('#menu').click();assert page.evaluate('__waterToy.world.held.every(x=>!x)');page.keyboard.up('a')
   paused_time=page.evaluate('__waterToy.world.time');page.wait_for_timeout(180);assert page.evaluate('__waterToy.world.time')==paused_time
   page.keyboard.down('a');assert not page.evaluate('__waterToy.world.jets[0]');page.keyboard.up('a');page.keyboard.press('Escape');sim_wait(.05)
   assert not page.locator('#menu-panel').is_visible();assert not page.locator('#reset').is_visible()
   page.locator('#menu').click();page.locator('#menu').click();assert not page.locator('#menu-panel').is_visible()
   page.locator('#menu').click();page.get_by_role('button',name='重新开始',exact=True).click()
   assert page.evaluate('__waterToy.world.pumps===0&&__waterToy.world.score===0&&__waterToy.world.tracers.particles.length===0')
   result['checks'].append({'name':'finite pressure / same-side A+Left aggregation / autorepeat / independent right / full release refill / Enter hold / blur / menu Escape return reset','pass':True,'lift_before':before,'lift_after':after})
  else:
   box=page.locator('#left-jet').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
   cdp=ctx.new_cdp_session(page)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-8,'y':y,'id':1},{'x':x+8,'y':y,'id':2}]})
   sim_wait(1.15);assert page.evaluate('__waterToy.world.held[0]&&!__waterToy.world.jets[0]')
   # CDP's touchEnd contract requires no remaining points. Check real two-touch
   # full release separately; do not call injected PointerEvents a true gesture.
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   assert page.evaluate('!__waterToy.world.held[0]&&__waterToy.world.jetStates[0].remaining===.8')
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':3}]});assert page.evaluate('__waterToy.world.jets[0]')
   cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});assert page.evaluate('__waterToy.world.held.every(x=>!x)')
   # Controller-level pointer aggregation, marked as synthetic. Capturing stub
   # applies only to these untrusted test events, then immediately restored.
   page.evaluate('''()=>{const b=document.querySelector('#left-jet');window.__capture=b.setPointerCapture;b.setPointerCapture=()=>{};for(const id of [101,102])b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,bubbles:true}));b.setPointerCapture=window.__capture;}''')
   sim_wait(1.15);page.locator('#left-jet').dispatch_event('pointerup',{'pointerId':101});assert page.evaluate('__waterToy.world.held[0]&&!__waterToy.world.jets[0]')
   page.locator('#left-jet').dispatch_event('pointerup',{'pointerId':102});assert not page.evaluate('__waterToy.world.held[0]')
   page.locator('#menu').click();page.get_by_role('button',name='重新开始',exact=True).click()
   result['checks'].append({'name':'real CDP two-touch held/exhaustion/full pointerup / next touch refill / cancellation','pass':True})
   result['checks'].append({'name':'synthetic controller same-side partial pointerup retains exhaustion until last pointerup','pass':True,'limitation':'controller-injected PointerEvents; not a real partial CDP touchEnd or physical-device observation'})
   # Leave actual field-driven smoke visible in the outgoing mobile screenshot.
   for _ in range(3):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':4}]});sim_wait(.75);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});sim_wait(.08)
   result['checks'].append({'name':'smoke tracer bound','particles':page.evaluate('__waterToy.world.tracers.particles.length'),'limit':page.evaluate('__waterToy.world.tracers.limit')})
  (root/'evidence/v2'/f'{name}.png').write_bytes(page.screenshot(full_page=True));ctx.close()
 browser.close()
assert not result['console_errors'],result['console_errors'];assert not result['page_errors'],result['page_errors'];assert not result['webgl_warnings'],result['webgl_warnings']
(root/'evidence/v2'/'browser-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))

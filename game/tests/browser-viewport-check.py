from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
import threading,shutil,json,traceback,time,os
out=Path(os.environ.get('OUT_DIR',Path(__file__).parent));out.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=os.environ.get('GAME_DIR',str(Path(__file__).resolve().parents[1]/'dist'))))
thread=threading.Thread(target=server.serve_forever);thread.start()
report={'scope':'Actual Chromium/Cocos layout and trusted browser input at emulated viewport sizes. Synthetic visualViewport-only height event separately identified. Not a real mobile Edge browser-toolbar/hardware test.','cases':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'started':time.time()}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  try:
   for width,height,mobile in [(320,568,True),(390,844,True),(430,932,True),(844,390,True),(1280,720,False),(1280,900,False)]:
    c=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
    page=c.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)));page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
    page.goto('http://127.0.0.1:'+str(server.server_port));page.wait_for_function('window.__waterToy?.ready',timeout=45000);page.wait_for_timeout(100)
    def layout():return page.evaluate('''()=>{const r=id=>{const e=document.querySelector(id),b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom,display:getComputedStyle(e).display};};return {inner:{width:innerWidth,height:innerHeight},visual:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},scrollY,scrollX,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,toy:r('.toy'),canvas:r('#GameCanvas'),stage:r('.water-stage'),left:r('#left-jet'),right:r('#right-jet'),menu:r('#menu'),shell:r('.shell-bottom'),viewportStyle:document.documentElement.style.getPropertyValue('--viewport-height')};}''')
    item={'width':width,'height':height,'mobile':mobile,'initial':layout()};report['cases'].append(item)
    item['engineMapping']=page.evaluate('''async()=>{const m=await(await fetch('./build-manifest.json')).json(),{cc}=await import('./src/engine-bootstrap.js?v='+m.assetRevision);return {design:cc.cclegacy.view.getDesignResolutionSize(),visible:cc.cclegacy.view.getVisibleSize(),viewport:cc.cclegacy.view.getViewportRect(),cameraHeight:__waterToy.camera.orthoHeight,canvasPixels:{width:document.querySelector('#GameCanvas').width,height:document.querySelector('#GameCanvas').height}}}''')
    assert item['engineMapping']['design']=={'width':420,'height':580},item
    assert abs(item['engineMapping']['visible']['width']-420)<1e-9 and abs(item['engineMapping']['visible']['height']-580)<1e-9,item
    assert abs(item['engineMapping']['cameraHeight']-290)<1e-8,item
    for name in ['toy','canvas','left','right','menu','shell']:
     box=item['initial'][name];assert box['x']>=-.1 and box['y']>=-.1 and box['right']<=width+.1 and box['bottom']<=height+.1,(name,item)
    assert item['initial']['left']['width']>=44 and item['initial']['left']['height']>=44,item
    assert abs(item['initial']['canvas']['width']/item['initial']['canvas']['height']-420/580)<.0002,item
    assert item['initial']['scrollY']==0 and item['initial']['scrollHeight']==height,item
    assert item['initial']['toy']['width']<=680,item
    page.screenshot(path=str(out/f'{width}x{height}-initial.png'),full_page=True)
    # Actual mouse/touch pointer to physical controls, no direct world mutations.
    start_pumps=page.evaluate('__waterToy.world.pumps')
    for side in ['left','right']:
     box=page.locator('#'+side+'-jet').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
     if mobile:
      session=c.new_cdp_session(page);session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
     else:page.mouse.move(x,y);page.mouse.down()
     page.wait_for_function('(s)=>__waterToy.world.held[s]',arg=0 if side=='left' else 1)
     if mobile:session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
     else:page.mouse.up()
     page.wait_for_function('(s)=>!__waterToy.world.held[s]',arg=0 if side=='left' else 1)
    item['pointerPumpsAdded']=page.evaluate('__waterToy.world.pumps')-start_pumps;assert item['pointerPumpsAdded']==2
    page.mouse.move(2,20);page.mouse.wheel(0,700);page.wait_for_timeout(50)
    page.evaluate('window.scrollTo(0,500)');item['afterWheelScroll']=layout();assert item['afterWheelScroll']['scrollY']==0
    if mobile:
     session=c.new_cdp_session(page);session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':2,'y':height-30,'id':4}]});session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':2,'y':40,'id':4}]});session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach();page.wait_for_timeout(50)
     item['afterTouchScroll']=layout();assert item['afterTouchScroll']['scrollY']==0
    page.locator('#menu').click();page.wait_for_function('!document.querySelector("#menu-panel").hidden')
    if page.locator('#gravity-authorize').is_visible():page.locator('#gravity-authorize').click()
    page.wait_for_function('__waterToy.gravityInput.getState().state!=="requesting"')
    page.locator('#resume').click()
    page.evaluate("window.dispatchEvent(Object.assign(new Event('devicemotion'),{acceleration:{x:0,y:0,z:0},accelerationIncludingGravity:{x:0,y:9.81,z:0}}))")
    page.locator('#menu').click();page.wait_for_timeout(100)
    item['menu']={'client':page.locator('#menu-panel').evaluate('(e)=>e.clientHeight'),'scrollHeight':page.locator('#menu-panel').evaluate('(e)=>e.scrollHeight'),'buttons':{}}
    if item['menu']['scrollHeight']>item['menu']['client']+2:
     page.locator('#menu-panel').evaluate('(e)=>e.scrollTop=0');panel=page.locator('#menu-panel').bounding_box();page.mouse.move(panel['x']+panel['width']/2,panel['y']+panel['height']-20);page.mouse.wheel(0,150);page.wait_for_timeout(100)
     item['menu']['wheelScrollTop']=page.locator('#menu-panel').evaluate('(e)=>e.scrollTop');assert item['menu']['wheelScrollTop']>0,item
     if mobile:
      page.locator('#menu-panel').evaluate('(e)=>e.scrollTop=0');session=c.new_cdp_session(page);x=panel['x']+8;start_y=panel['y']+panel['height']-25
      session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':start_y,'id':9}]})
      for i in range(1,6):
       page.wait_for_timeout(25);session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':start_y-i*20,'id':9}]})
      session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach();page.wait_for_timeout(100)
      item['menu']['touchScrollTop']=page.locator('#menu-panel').evaluate('(e)=>e.scrollTop');assert item['menu']['touchScrollTop']>0,item
    for name in ['resume','reset','gravity-toggle','gravity-calibrate']:
     e=page.locator('#'+name);e.scroll_into_view_if_needed();box=e.bounding_box();panel=page.locator('#menu-panel').bounding_box()
     item['menu']['buttons'][name]={'box':box,'disabled':e.is_disabled(),'visible':e.is_visible(),'panel':panel}
     assert box['y']>=panel['y']-.2 and box['y']+box['height']<=panel['y']+panel['height']+.2,(name,item)
     assert box['x']>=-.2 and box['x']+box['width']<=width+.2,(name,item)
    assert not page.locator('#gravity-calibrate').is_disabled(),item
    page.locator('#gravity-calibrate').click();item['menu']['calibrateClicked']=True
    page.locator('#reset').click();assert page.locator('#menu-panel').is_hidden();assert page.evaluate('__waterToy.world.pumps')==0
    page.locator('#menu').click();page.locator('#resume').click();assert page.locator('#menu-panel').is_hidden()
    item['menu']['resetAndResumeClicked']=True
    page.locator('#menu').click();page.locator('#menu-panel').evaluate('(e)=>e.scrollTop=0');item['menu']['topReached']=page.locator('#menu-panel p').bounding_box();assert item['menu']['topReached']['y']>=page.locator('#menu-panel').bounding_box()['y']-.1
    page.locator('.menu-help').scroll_into_view_if_needed();help_box=page.locator('.menu-help').bounding_box();panel_box=page.locator('#menu-panel').bounding_box();item['menu']['helpReached']=help_box;assert help_box['y']+help_box['height']<=panel_box['y']+panel_box['height']+.2
    page.locator('#gravity-calibrate').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{width}x{height}-menu.png'),full_page=True);page.locator('#resume').click()
    if (width,height)==(390,844):
     # A toolbar-only visual viewport change, without window resize. The browser
     # object height getter is temporarily controlled solely for this branch.
     page.evaluate("window.__qaVisibleHeight=700;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.__qaVisibleHeight});visualViewport.dispatchEvent(new Event('resize'))")
     page.wait_for_function('document.documentElement.style.getPropertyValue("--viewport-height")==="700px"');item['visualViewportOnly']=layout()
     assert item['visualViewportOnly']['left']['bottom']<=700 and item['visualViewportOnly']['right']['bottom']<=700,item
     page.screenshot(path=str(out/'390x844-visible700.png'),full_page=True)
     page.evaluate("delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))")
     page.wait_for_function('document.documentElement.style.getPropertyValue("--viewport-height")==="844px"')
     page.set_viewport_size({'width':390,'height':620});page.wait_for_function('document.documentElement.style.getPropertyValue("--viewport-height")==="620px"');item['nativeResize']=layout()
     assert item['nativeResize']['left']['bottom']<=620 and item['nativeResize']['right']['bottom']<=620,item
     beforeZoom=page.evaluate('document.documentElement.style.getPropertyValue("--viewport-height")')
     session=c.new_cdp_session(page);session.send('Emulation.setPageScaleFactor',{'pageScaleFactor':1.5});page.wait_for_function('visualViewport.scale>1.4');page.wait_for_timeout(50)
     item['pinchZoom']={'scale':page.evaluate('visualViewport.scale'),'fittedHeight':page.evaluate('document.documentElement.style.getPropertyValue("--viewport-height")'),'meta':page.locator('meta[name="viewport"]').get_attribute('content')}
     assert item['pinchZoom']['fittedHeight']==beforeZoom and 'user-scalable=no' not in item['pinchZoom']['meta'] and 'maximum-scale' not in item['pinchZoom']['meta'],item
     session.send('Emulation.setPageScaleFactor',{'pageScaleFactor':1});session.detach()
    item['finalScrollY']=page.evaluate('scrollY');assert item['finalScrollY']==0
    c.close()
   report['passed']=True
  finally:b.close()
except Exception as error:
 report['failure']=str(error);report['traceback']=traceback.format_exc();raise
finally:
 server.shutdown();server.server_close();thread.join();report['finished']=time.time();(out/'browser-result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

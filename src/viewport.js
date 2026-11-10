// Fit the complete toy to the current visible browser viewport. Canvas sizing
// preserves its design aspect ratio; CSS, controls and physical coordinates keep
// their existing relationship. This module does not intercept browser zoom.
export function bindViewportFit(windowObject=window,documentObject=document) {
  const root=documentObject.documentElement,stage=documentObject.querySelector('.water-stage');
  if(!stage)return ()=>{};
  let frame=0,lastHeight=-1,lastStageWidth=-1,lastStageHeight=-1,disposed=false;
  const update=()=>{
    frame=0;
    if(disposed)return;
    const viewport=windowObject.visualViewport;
    // Reflow for browser toolbars/keyboard, not for the user's pinch zoom.
    if(viewport&&Math.abs(viewport.scale-1)>.01)return;
    const height=Math.max(1,Math.floor(viewport?.height||windowObject.innerHeight));
    if(height!==lastHeight){root.style.setProperty('--viewport-height',`${height}px`);lastHeight=height;}
    const rect=stage.getBoundingClientRect();
    const tankHeight=Math.max(0,Math.min(rect.height-12,(rect.width-12)*580/420));
    stage.querySelector('.glass-rim').style.setProperty('--tank-height',`${tankHeight}px`);
    if(Math.abs(rect.width-lastStageWidth)>.5||Math.abs(rect.height-lastStageHeight)>.5){
      lastStageWidth=rect.width;lastStageHeight=rect.height;
      // Cocos listens for browser resizing. A toolbar-only visualViewport change
      // may resize our stage without emitting that event itself.
      windowObject.dispatchEvent(new Event('resize'));
    }
  };
  const schedule=()=>{if(!frame&&!disposed)frame=windowObject.requestAnimationFrame(update);};
  windowObject.addEventListener('resize',schedule);
  windowObject.visualViewport?.addEventListener('resize',schedule);
  const observer=new ResizeObserver(schedule);observer.observe(stage);
  schedule();
  return ()=>{
    disposed=true;if(frame)windowObject.cancelAnimationFrame(frame);observer.disconnect();
    windowObject.removeEventListener('resize',schedule);
    windowObject.visualViewport?.removeEventListener('resize',schedule);
  };
}
if(typeof window!=='undefined'&&typeof document!=='undefined')bindViewportFit();

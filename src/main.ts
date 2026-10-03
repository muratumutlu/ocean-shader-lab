import {createDemo} from './runtime/demo';
import {bindControls} from './ui/controls';
import {isTrustedMessage,PARENT_ORIGIN,postParent} from './bridge/messages';
import type {DemoController} from './types';
import './styles.css';
let controller:DemoController|null=null,cleanupUI:(()=>void)|null=null,observer:ResizeObserver|null=null;
let userPaused=matchMedia('(prefers-reduced-motion:reduce)').matches,hostPaused=false;
const fallback=document.querySelector<HTMLElement>('#fallback')!,status=document.querySelector<HTMLElement>('#scene-status')!,toolbar=document.querySelector<HTMLElement>('#toolbar')!;
function shutdown(){observer?.disconnect();observer=null;cleanupUI?.();cleanupUI=null;controller?.dispose();controller=null;}
function fail(error:Error){shutdown();fallback.hidden=false;toolbar.hidden=true;status.textContent='STILL VIEW';document.querySelector('#fallback-message')!.textContent=error.message+' You can retry the live scene below.';}
function start(){
 shutdown();fallback.hidden=true;toolbar.hidden=false;status.textContent='Preparing the coast…';
 const old=document.querySelector<HTMLCanvasElement>('#ocean')!,canvas=old.cloneNode(false) as HTMLCanvasElement;old.replaceWith(canvas);
 try{
  controller=createDemo(canvas,{reducedMotion:userPaused||hostPaused,quality:(document.querySelector<HTMLSelectElement>('#quality')!.value as 'auto'|'low'|'balanced'|'high'),onFatal:fail});
  controller.setControls({swell:Number(document.querySelector<HTMLInputElement>('#swell')!.value),tide:Number(document.querySelector<HTMLInputElement>('#tide')!.value),sunAzimuth:Number(document.querySelector<HTMLInputElement>('#light')!.value)});
  cleanupUI=bindControls({paused:userPaused,onPause(value){userPaused=value;controller?.setPaused(userPaused||hostPaused);status.textContent=userPaused?'PAUSED / COASTAL STUDY':'LIVE / COASTAL STUDY';},onControls:patch=>controller?.setControls(patch),onQuality:mode=>controller?.setQuality(mode),onReset:()=>controller?.resetCamera()});
  observer=new ResizeObserver(()=>{controller?.resize(canvas.clientWidth,canvas.clientHeight,devicePixelRatio);});observer.observe(canvas);
  status.textContent=userPaused?'PAUSED / COASTAL STUDY':'LIVE / COASTAL STUDY';postParent('ready');
 }catch(error){fail(error instanceof Error?error:new Error('The live coast could not start.'));}
}
document.querySelector('#retry')!.addEventListener('click',start);
window.addEventListener('message',event=>{
 if(!isTrustedMessage(event,PARENT_ORIGIN,window.parent))return;
 if(event.data.type==='dispose')shutdown();
 if(event.data.type==='pause'){hostPaused=event.data.paused;controller?.setPaused(userPaused||hostPaused);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&window.parent!==window){event.preventDefault();postParent('dispose');}});
window.addEventListener('pagehide',shutdown);
window.addEventListener('pageshow',event=>{if(event.persisted)start();});
start();

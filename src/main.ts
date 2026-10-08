import {createDemo} from './runtime/demo';
import {bindControls} from './ui/controls';
import {isTrustedMessage,PARENT_ORIGIN,postParent} from './bridge/messages';
import type {DemoController,TurtleRoutineStatus} from './types';
import './styles.css';
import {createGameExtension,isGameMode,prepareGamePage} from './game/game-mode';
const gameMode=isGameMode();
/** iPhone, iPad (iPadOS reports a Mac platform but has touch points). */
const isAppleTouchDevice=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(gameMode)prepareGamePage();
let controller:DemoController|null=null,uiBindings:ReturnType<typeof bindControls>|null=null,observer:ResizeObserver|null=null;
let currentMode:'camera'|'turtle'='camera';
let turtleRoutineStatus:TurtleRoutineStatus={enabled:false,phase:'off',message:'Preparing turtle…'};
function setTurtleRoutineStatus(next:TurtleRoutineStatus){turtleRoutineStatus=next;uiBindings?.setTurtleRoutine(next);}
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
let userPaused=reducedMotion.matches&&!gameMode,hostPaused=false;
const fallback=document.querySelector<HTMLElement>('#fallback')!,status=document.querySelector<HTMLElement>('#scene-status')!,toolbar=document.querySelector<HTMLElement>('#toolbar')!;
function shutdown(){observer?.disconnect();observer=null;uiBindings?.dispose();uiBindings=null;controller?.dispose();controller=null;turtleRoutineStatus={enabled:false,phase:'off',message:'Preparing turtle…'};}
function setUserPaused(value:boolean){
 userPaused=value;controller?.setPaused(userPaused||hostPaused);uiBindings?.setPaused(userPaused);
 if(controller)status.textContent=userPaused?'PAUSED / COASTAL STUDY':'LIVE / COASTAL STUDY';
}
// Game mode recovers on its own (e.g. the GPU context drops when an iPhone Duo folds); after three quick
// failures it shows a simple retry card instead of the technical message.
let gameRetries=0,retryReset=0;
function fail(error:Error){
 if(gameMode&&gameRetries<3){gameRetries++;shutdown();window.setTimeout(start,700);return;}
 shutdown();fallback.hidden=false;
 if(gameMode){toolbar.hidden=true;document.querySelector('#fallback-message')!.textContent='Something interrupted the cove. Tap to bring it back.';return;}toolbar.hidden=true;status.textContent='STILL VIEW';document.querySelector('#fallback-message')!.textContent=error.message+' You can retry the live scene below.';}
function start(){
 shutdown();currentMode='camera';document.querySelector('#mode-camera')!.setAttribute('aria-pressed','true');document.querySelector('#mode-turtle')!.setAttribute('aria-pressed','false');document.querySelector<HTMLButtonElement>('#mode-turtle')!.disabled=true;document.querySelector<HTMLElement>('#return-turtle')!.hidden=true;document.querySelector<HTMLElement>('#turtle-touch')!.hidden=true;document.querySelector<HTMLElement>('#turtle-retry')!.hidden=true;fallback.hidden=true;toolbar.hidden=false;status.textContent='Preparing the coast…';
 const old=document.querySelector<HTMLCanvasElement>('#ocean')!,canvas=old.cloneNode(false) as HTMLCanvasElement;old.replaceWith(canvas);
 try{
  controller=createDemo(canvas,{onTurtleRoutine:setTurtleRoutineStatus,extend:gameMode?createGameExtension(document.querySelector<HTMLElement>('#app')!):undefined,ambientTurtle:gameMode,pixelRatioCaps:gameMode?{low:1.5,balanced:2,high:3}:undefined,autoQualityStart:gameMode?'high':undefined,
   // On iOS/iPadOS WebKit the sun's shadow map never fills, which leaves the whole beach in shadow; skip it there.
   shadows:!(gameMode&&isAppleTouchDevice()),onTurtle(ready,error){const button=document.querySelector<HTMLButtonElement>('#mode-turtle')!;button.disabled=!ready;button.title=ready?'Control the turtle':error??'Preparing turtle';const routineButton=document.querySelector<HTMLButtonElement>('#turtle-routine')!;routineButton.disabled=!ready;routineButton.title=ready?'Watch the turtle explore the cove':error??'Preparing turtle';setTurtleRoutineStatus(ready?turtleRoutineStatus:{enabled:false,phase:'off',message:error?'The turtle is unavailable. Retry the turtle to continue.':'Preparing turtle…'});document.querySelector<HTMLElement>('#turtle-retry')!.hidden=!error;},onTurtleState(state){if(currentMode==='turtle')document.querySelector('#navigation-status')!.textContent=(state==='crawl'?'On the beach':state==='shore'?'At the shoreline':state==='idle'?'Resting':'Swimming')+' · WASD / arrows · Q/E in water';},reducedMotion:userPaused||hostPaused,quality:(document.querySelector<HTMLSelectElement>('#quality')!.value as 'auto'|'low'|'balanced'|'high'),onFatal:fail,onNavigation(ready,error){const hint=document.querySelector<HTMLElement>('#navigation-status')!;hint.textContent=ready?'Drag to orbit · Scroll to zoom · Arrows / WASD to move · Q / E to rise / dive':error??'Preparing navigation…';document.querySelector<HTMLButtonElement>('#navigation-retry')!.hidden=!error;}});
  controller.setControls({swell:Number(document.querySelector<HTMLInputElement>('#swell')!.value),tide:Number(document.querySelector<HTMLInputElement>('#tide')!.value),sunAzimuth:Number(document.querySelector<HTMLInputElement>('#light')!.value)});
  uiBindings=bindControls({labels:gameMode?{play:'Play waves',pause:'Pause waves'}:undefined,onTurtleRoutine:enabled=>controller?.setTurtleRoutine(enabled),onMode(mode){currentMode=mode;controller?.setMode(mode);document.querySelector('#navigation-status')!.textContent=mode==='turtle'?'WASD / arrows to move · Q/E to dive / rise':'Drag to orbit · Scroll to zoom · Arrows / WASD to move · Q / E to rise / dive';},onReturnTurtle:()=>controller?.resetTurtle(),onTouch:(code,pressed)=>controller?.setTouchControl(code,pressed),paused:userPaused,onPause:setUserPaused,onControls:patch=>controller?.setControls(patch),onQuality:mode=>controller?.setQuality(mode),onReset:()=>controller?.resetCamera(),onInputBlocked:value=>controller?.setInputBlocked(value)});
  uiBindings.setTurtleRoutine(turtleRoutineStatus);
  observer=new ResizeObserver(()=>{controller?.resize(canvas.clientWidth,canvas.clientHeight,devicePixelRatio);});observer.observe(canvas);
  status.textContent=userPaused?'PAUSED / COASTAL STUDY':'LIVE / COASTAL STUDY';postParent('ready');
  window.clearTimeout(retryReset);retryReset=window.setTimeout(()=>{gameRetries=0;},15_000);
 }catch(error){fail(error instanceof Error?error:new Error('The live coast could not start.'));}
}
document.querySelector('#retry')!.addEventListener('click',()=>{gameRetries=0;start();});
document.querySelector('#navigation-retry')!.addEventListener('click',()=>document.querySelector('#ocean')!.dispatchEvent(new Event('retrynavigation')));
document.querySelector('#turtle-retry')!.addEventListener('click',()=>document.querySelector('#ocean')!.dispatchEvent(new Event('retryturtle')));
window.addEventListener('message',event=>{
 if(!isTrustedMessage(event,PARENT_ORIGIN,window.parent))return;
 if(event.data.type==='dispose')shutdown();
 if(event.data.type==='pause'){hostPaused=event.data.paused;controller?.setPaused(userPaused||hostPaused);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&window.parent!==window){event.preventDefault();postParent('dispose');}});
window.addEventListener('pagehide',shutdown);
window.addEventListener('pageshow',event=>{if(event.persisted)start();});
reducedMotion.addEventListener('change',event=>{if(event.matches)setUserPaused(true);});
start();

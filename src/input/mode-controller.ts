import type {ControlMode} from '../types';
export type InputSnapshot={mode:ControlMode;forward:number;right:number;vertical:number;fast:boolean;active:boolean;pointerActive:boolean};
const movement=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight']);
export function inputVector(keys:Set<string>){
 const has=(...k:string[])=>Number(k.some(x=>keys.has(x))),forward=has('ArrowUp','KeyW')-has('ArrowDown','KeyS'),right=has('ArrowRight','KeyD')-has('ArrowLeft','KeyA'),vertical=has('KeyE')-has('KeyQ');
 return {forward,right,vertical,fast:!!has('ShiftLeft','ShiftRight'),active:!!(forward||right||vertical)};
}
export function bindModeInput(canvas:HTMLCanvasElement,onActivity:(active:boolean)=>void){
 const abort=new AbortController(),signal=abort.signal,keys=new Set<string>();let mode:ControlMode='camera',blocked=false,pointerActive=false;
 canvas.tabIndex=0;
 const notify=()=>onActivity(!blocked&&(inputVector(keys).active||pointerActive));
 const clear=()=>{keys.clear();pointerActive=false;notify();};
 const visibility=()=>{if(document.hidden)clear();};
 canvas.addEventListener('keydown',e=>{if(blocked||document.activeElement!==canvas||!movement.has(e.code))return;e.preventDefault();keys.add(e.code);notify();},{signal});
 canvas.addEventListener('keyup',e=>{if(!movement.has(e.code))return;keys.delete(e.code);if(document.activeElement===canvas&&!blocked)e.preventDefault();notify();},{signal});
 canvas.addEventListener('pointerdown',()=>{if(blocked)return;canvas.focus({preventScroll:true});pointerActive=true;notify();},{signal});
 window.addEventListener('pointerup',()=>{pointerActive=false;notify();},{signal});window.addEventListener('pointercancel',clear,{signal});
 canvas.addEventListener('blur',clear,{signal});window.addEventListener('blur',clear,{signal});document.addEventListener('visibilitychange',visibility,{signal});
 canvas.addEventListener('cameraactivity',notify,{signal});
 return {snapshot():InputSnapshot{return {mode,...(blocked?inputVector(new Set()):inputVector(keys)),pointerActive:!blocked&&pointerActive};},setMode(next:ControlMode){mode=next;clear();},setBlocked(next:boolean){blocked=next;if(next)clear();},dispose(){clear();document.removeEventListener('visibilitychange',visibility);abort.abort();}};
}

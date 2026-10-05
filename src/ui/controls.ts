import type {DemoControls,QualityMode,TurtleRoutineStatus} from '../types';
export function bindControls(options:{paused:boolean;onPause(value:boolean):void;onControls(patch:Partial<DemoControls>):void;onQuality(mode:QualityMode):void;onReset():void;onInputBlocked?(blocked:boolean):void;onMode?(mode:'camera'|'turtle'):void;onReturnTurtle?():void;onTurtleRoutine?(enabled:boolean):void;onTouch?(code:string,pressed:boolean):void}){
 const abort=new AbortController(),signal=abort.signal;
 const listen=(element:Element,type:string,fn:EventListener)=>element.addEventListener(type,fn,{signal});
 const play=document.querySelector<HTMLButtonElement>('#play')!;
 const routineButton=document.querySelector<HTMLButtonElement>('#turtle-routine')!,routineStatus=document.querySelector<HTMLElement>('#turtle-routine-status')!;
 let routineEnabled=false;
 const setTurtleRoutine=(status:TurtleRoutineStatus)=>{
  routineEnabled=status.enabled;routineButton.setAttribute('aria-pressed',String(status.enabled));
  routineButton.textContent=routineButton.disabled?'Preparing turtle':status.enabled?'Stop turtle routine':'Observe turtle routine';
  routineStatus.textContent=status.message||(routineButton.disabled?'Preparing turtle…':status.enabled?'The turtle is exploring the cove.':'Watch the turtle explore the cove.');
 };
 setTurtleRoutine({enabled:false,phase:'off',message:''});
 listen(routineButton,'click',()=>{if(!routineButton.disabled)options.onTurtleRoutine?.(!routineEnabled);});

 let paused=options.paused;
 const update=()=>{play.textContent=paused?'▶ Play waves':'Ⅱ Pause waves';play.setAttribute('aria-label',paused?'Play waves':'Pause waves');play.setAttribute('aria-pressed',String(!paused));};
 for(const mode of ['camera','turtle'] as const)listen(document.querySelector('#mode-'+mode)!,'click',()=>{for(const name of ['camera','turtle'])document.querySelector('#mode-'+name)!.setAttribute('aria-pressed',String(name===mode));document.querySelector<HTMLElement>('#return-turtle')!.hidden=mode!=='turtle';document.querySelector<HTMLElement>('#turtle-touch')!.hidden=mode!=='turtle';options.onMode?.(mode);});
 listen(document.querySelector('#return-turtle')!,'click',()=>options.onReturnTurtle?.());
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-turtle-key]')){
  listen(button,'pointerdown',e=>{const event=e as PointerEvent;event.preventDefault();button.setPointerCapture(event.pointerId);options.onTouch?.(button.dataset.turtleKey!,true);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,()=>options.onTouch?.(button.dataset.turtleKey!,false));
 }
 update();listen(play,'click',()=>{paused=!paused;update();options.onPause(paused);});
 const settings=document.querySelector<HTMLButtonElement>('#settings')!,panel=document.querySelector<HTMLElement>('#settings-panel')!;
 listen(settings,'click',()=>{panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',String(!panel.hidden));options.onInputBlocked?.(!panel.hidden);});
 for(const [id,key] of [['swell','swell'],['tide','tide'],['light','sunAzimuth']] as const){
  const input=document.querySelector<HTMLInputElement>('#'+id)!;
  listen(input,'input',()=>{const value=Number(input.value);options.onControls({[key]:value});document.querySelector('#'+id+'-value')!.textContent=id==='tide'?(value>=0?'+':'')+value.toFixed(2):id==='light'?Math.round(value)+'°':Math.round(value*100)+'%';});
 }
 listen(document.querySelector('#quality')!,'change',event=>options.onQuality((event.target as HTMLSelectElement).value as QualityMode));
 listen(document.querySelector('#reset')!,'click',()=>options.onReset());
 listen(document.querySelector('#fullscreen')!,'click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector<HTMLElement>('#app')!.requestFullscreen();}
  catch{const link=document.querySelector<HTMLAnchorElement>('#full-screen-link')!;link.href=location.href;link.hidden=false;link.focus();}
 });
 return {setTurtleRoutine,dispose(){abort.abort();routineButton.disabled=true;routineButton.title='Preparing turtle';setTurtleRoutine({enabled:false,phase:'off',message:'Preparing turtle…'});},setPaused(value:boolean){paused=value;update();}};
}

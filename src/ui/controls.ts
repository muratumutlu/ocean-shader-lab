import type {DemoControls,QualityMode} from '../types';
export function bindControls(options:{paused:boolean;onPause(value:boolean):void;onControls(patch:Partial<DemoControls>):void;onQuality(mode:QualityMode):void;onReset():void}){
 const abort=new AbortController(),signal=abort.signal;
 const listen=(element:Element,type:string,fn:EventListener)=>element.addEventListener(type,fn,{signal});
 const play=document.querySelector<HTMLButtonElement>('#play')!;
 let paused=options.paused;
 const update=()=>{play.textContent=paused?'▶ Play waves':'Ⅱ Pause waves';play.setAttribute('aria-label',paused?'Play waves':'Pause waves');play.setAttribute('aria-pressed',String(!paused));};
 update();listen(play,'click',()=>{paused=!paused;update();options.onPause(paused);});
 const settings=document.querySelector<HTMLButtonElement>('#settings')!,panel=document.querySelector<HTMLElement>('#settings-panel')!;
 listen(settings,'click',()=>{panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',String(!panel.hidden));});
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
 return {dispose:()=>abort.abort(),setPaused(value:boolean){paused=value;update();}};
}

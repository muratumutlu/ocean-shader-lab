// Wires host, scene director and HUD together for `?mode=game`.
import type * as THREE from 'three';
import type {CoveResources} from '../scene/cove';
import type {SceneContext,SceneExtension} from '../runtime/demo';
import {createHost,type Host} from './host';
import {createNativeHost,nativeBridge} from './native-host';
import {createFishingScene} from './fishing-scene';
import {createHud} from './hud';
import {setCameraHome} from '../scene/camera';

// game.html (used by the native apps) is game-only; index.html?mode=game opts in on the website.
export const isGameMode=()=>document.body.classList.contains('game-mode')||new URLSearchParams(location.search).get('mode')==='game';

export function prepareGamePage(){
 document.body.classList.add('game-mode');
 // Frame the boat and the beach stall, leaving room for the HUD on the right.
 // Portrait screens (phones, iPhone Duo inner screen) look along the cove so boat and stall stack vertically.
 // At startup inside WKWebView the viewport may not be laid out yet; fall back to the screen's shape.
 const width=innerWidth||screen.width,height=innerHeight||screen.height;
 if(width/height<1)setCameraHome({x:3.4,y:19,z:21.5},{x:-.3,y:0,z:1.2});
 else setCameraHome({x:9.5,y:11,z:14},{x:1.8,y:.2,z:.4});
 document.title='Ocean Focus';
 // The coast controls move into the HUD's settings gear; give them short game labels there.
 const label=(id:string,text:string)=>{const node=document.querySelector(`label[for="${id}"]`);if(node?.firstChild)node.firstChild.textContent=text+' ';};
 label('swell','Waves');label('tide','Water level');label('light','Sun');label('quality','Quality');
 document.querySelector('#reset')!.textContent='Reset camera';
 document.querySelector('#fullscreen')!.textContent='⛶ Full screen';
 const quality:Record<string,string>={auto:'Auto',low:'Low',balanced:'Balanced',high:'High'};
 for(const option of document.querySelectorAll<HTMLOptionElement>('#quality option'))option.textContent=quality[option.value]??option.textContent;
}

export function createGameExtension(app:HTMLElement){
 const speed=Number(new URLSearchParams(location.search).get('speed')??'1')||1;
 // Inside the native app Swift owns the timer; in a plain browser the page hosts it itself.
 const bridge=nativeBridge();
 const host:Host=bridge?createNativeHost(bridge):createHost({speed});
 const hud=createHud(host,app);
 // Dev-only handle for visual QA (e.g. finishing a session on demand). Stripped from production builds.
 if(import.meta.env.DEV)(window as unknown as {oceanFocus:unknown}).oceanFocus={host,finish(){const a=host.save.active;if(a){a.endsAt=a.startedAt;host.tick();}}};
 return (context:SceneContext):SceneExtension=>{
  const scene=createFishingScene(context);context.group.add(scene.group);
  if(import.meta.env.DEV)Object.assign((window as unknown as {oceanFocus:object}).oceanFocus,{scene});
  const unsubscribe=host.subscribe(event=>scene.handle(event));
  scene.resume(host.save,host.progress(),host.expectedFish());
  // Settle only after the scene listens, so a session that ended while the page was closed still plays its sale.
  // The interval keeps the timer honest when the render loop is paused or the tab is hidden.
  const interval=window.setInterval(()=>{host.tick();hud.frame();},500);
  return {
   update(time,delta,controls){host.tick();scene.setProgress(host.progress(),host.expectedFish());scene.update(time,delta,controls);hud.frame();},
   dispose(){unsubscribe();window.clearInterval(interval);hud.dispose();context.group.remove(scene.group);scene.dispose();},
  };
 };
}

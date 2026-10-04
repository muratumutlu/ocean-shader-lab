import * as THREE from 'three';
import {createCove} from '../scene/cove';
import {createCamera} from '../scene/camera';
import {createCameraRig} from '../camera/camera-rig';
import {bindModeInput} from '../input/mode-controller';
import {createPhysicsWorld,type PhysicsWorld} from '../physics/world';
import {createWater} from '../water/water';
import {createFrameLoop} from './frame-loop';
import {createQualityController} from './quality';
import {createRenderPacer} from './render-pacer';
import {DEFAULT_CONTROLS} from '../types';
import type {DemoController,DemoControls,QualityMode,QualityProfile} from '../types';
export function createDemo(canvas:HTMLCanvasElement,options:{reducedMotion:boolean;quality:QualityMode;onFatal(error:Error):void;onNavigation?(ready:boolean,error?:string):void}):DemoController{
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable on this browser.');
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x3b4350);
 let renderer:THREE.WebGLRenderer|null=null,cove:ReturnType<typeof createCove>|null=null,water:ReturnType<typeof createWater>|null=null;
 const initialCamera=createCamera(canvas.clientWidth/canvas.clientHeight);let camera=initialCamera.camera,rig:ReturnType<typeof createCameraRig>|null=null,world:PhysicsWorld|null=null,input:ReturnType<typeof bindModeInput>|null=null,loop:ReturnType<typeof createFrameLoop>|null=null;
 let paused=options.reducedMotion,disposed=false,initializing=true,time=0,previousRender:number|null=null,startupError:Error|null=null,blocked=false,loading=false;
 let controls:DemoControls={...DEFAULT_CONTROLS};
 const targetFps=matchMedia('(pointer:coarse)').matches||canvas.clientWidth<768?30:60,pacer=createRenderPacer(targetFps);
 const activity=()=>loop?.setActivity({paused,visible:!document.hidden,inputActive:!!(input?.snapshot().active||input?.snapshot().pointerActive||rig?.hasPending())});
 const visibility=()=>{previousRender=null;pacer.reset();activity();};
 const render=()=>{if(disposed||!renderer||!water)return;try{water.update(time,controls);water.render(renderer,scene,camera);}catch(error){if(initializing)throw error;options.onFatal(error instanceof Error?error:Error('The graphics device stopped rendering.'));}};
 const lost=(event:Event)=>{event.preventDefault();if(!disposed)options.onFatal(Error('The graphics context was interrupted. Try the live scene again.'));};
 const navigation=async()=>{
  if(disposed||loading||!cove||rig)return;loading=true;canvas.setAttribute('aria-busy','true');options.onNavigation?.(false);
  try{
   const next=await createPhysicsWorld(cove.data);if(disposed){next.dispose();return;}world=next;rig=createCameraRig(canvas,cove,world);rig.camera.position.copy(camera.position);rig.camera.quaternion.copy(camera.quaternion);camera=rig.camera;
   rig.setEnabled(!blocked);input?.setBlocked(blocked);canvas.setAttribute('aria-busy','false');options.onNavigation?.(true);render();activity();
  }catch(error){if(!disposed){world?.dispose();world=null;input?.setBlocked(true);canvas.setAttribute('aria-busy','false');options.onNavigation?.(false,'Navigation could not load. The coast is still available.');}}
  finally{loading=false;}
 };
 const retryNavigation=()=>void navigation();
 const dispose=()=>{if(disposed)return;disposed=true;loop?.dispose();input?.dispose();rig?.dispose();world?.dispose();canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('retrynavigation',retryNavigation);document.removeEventListener('visibilitychange',visibility);water?.dispose();cove?.dispose();initialCamera.dispose();renderer?.renderLists.dispose();renderer?.dispose();if(renderer)renderer.forceContextLoss();else gl.getExtension('WEBGL_lose_context')?.loseContext();scene.clear();};
 try{
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  cove=createCove(7);water=createWater(cove);scene.add(cove.group,water.mesh,new THREE.HemisphereLight(0xdff4ff,0x746a56,1));
  const sun=new THREE.DirectionalLight(0xfff1db,3.4);sun.position.set(Math.cos(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22,25,Math.sin(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  const applyQuality=(profile:QualityProfile)=>{if(disposed)return;water!.setDetail(profile);cove!.setQuality(profile);renderer!.setPixelRatio(Math.min(devicePixelRatio,{low:1,balanced:1.5,high:2}[profile]));renderer!.setSize(canvas.clientWidth,canvas.clientHeight,false);canvas.dataset.quality=profile;render();};
  const quality=createQualityController(options.quality,targetFps,applyQuality);
  input=bindModeInput(canvas,activity);input.setBlocked(true);
  loop=createFrameLoop({now:()=>performance.now(),request:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id)},(elapsed,_simulationDelta,inputDelta)=>{
   time=elapsed;const snapshot=input!.snapshot(),changed=rig?.update(snapshot,null,inputDelta)??false,now=performance.now();
   if(changed||pacer.shouldRender(now)){render();if(previousRender!==null&&!paused)quality.observe(now-previousRender);previousRender=now;}activity();
  });
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('retrynavigation',retryNavigation);document.addEventListener('visibilitychange',visibility);
  renderer.debug.onShaderError=()=>{const error=Error('The water shader could not compile on this graphics device.');startupError=error;queueMicrotask(()=>{if(!disposed)options.onFatal(error);});};
  applyQuality(quality.current().profile);if(startupError)throw startupError;initializing=false;visibility();void navigation();
  return {setPaused(value){paused=value;visibility();render();},setControls(patch){controls={swell:Math.max(0,Math.min(1,patch.swell??controls.swell)),tide:Math.max(-.35,Math.min(.35,patch.tide??controls.tide)),sunAzimuth:Math.max(0,Math.min(360,patch.sunAzimuth??controls.sunAzimuth))};const az=controls.sunAzimuth*Math.PI/180;sun.position.set(Math.cos(az)*22,25,Math.sin(az)*22);renderer!.shadowMap.needsUpdate=true;render();},setQuality:mode=>quality.setMode(mode),setInputBlocked(value){blocked=value;input?.setBlocked(value||!rig);rig?.setEnabled(!value);activity();},
   resetCamera(){if(disposed)return;if(rig)rig.reset();else initialCamera.reset();activity();render();},
   resize(width,height,dpr){if(disposed||width<=0||height<=0)return;if(rig)rig.resize(width/height);else initialCamera.resize(width/height);renderer!.setPixelRatio(Math.min(dpr,{low:1,balanced:1.5,high:2}[quality.current().profile]));renderer!.setSize(width,height,false);activity();render();},dispose};
 }catch(error){dispose();throw error;}
}

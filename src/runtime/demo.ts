import * as THREE from 'three';
import {createCove} from '../scene/cove';
import {createCamera} from '../scene/camera';
import {createCameraRig} from '../camera/camera-rig';
import {bindModeInput} from '../input/mode-controller';
import {createPhysicsWorld,type PhysicsWorld} from '../physics/world';
import {createTurtleView,type TurtleView} from '../turtle/view';
import {createTurtleController} from '../turtle/controller';
import {TURTLE_ASSET} from '../turtle/asset';
import {createWater} from '../water/water';
import {createFrameLoop} from './frame-loop';
import {createQualityController} from './quality';
import {createRenderPacer} from './render-pacer';
import {DEFAULT_CONTROLS} from '../types';
import type {DemoController,DemoControls,QualityMode,QualityProfile,ControlMode} from '../types';
export function createDemo(canvas:HTMLCanvasElement,options:{reducedMotion:boolean;quality:QualityMode;onFatal(error:Error):void;onNavigation?(ready:boolean,error?:string):void;onTurtle?(ready:boolean,error?:string):void;onTurtleState?(state:string):void}):DemoController{
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable on this browser.');
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x3b4350);
 let renderer:THREE.WebGLRenderer|null=null,cove:ReturnType<typeof createCove>|null=null,water:ReturnType<typeof createWater>|null=null;
 const initialCamera=createCamera(canvas.clientWidth/canvas.clientHeight);let camera=initialCamera.camera,rig:ReturnType<typeof createCameraRig>|null=null,world:PhysicsWorld|null=null,input:ReturnType<typeof bindModeInput>|null=null,loop:ReturnType<typeof createFrameLoop>|null=null;
 let paused=options.reducedMotion,disposed=false,initializing=true,time=0,previousRender:number|null=null,startupError:Error|null=null,blocked=false,loading=false;
 const dynamicGroup=new THREE.Group(),assetAbort=new AbortController();dynamicGroup.name='coastal-life';
 let turtle:TurtleView|null=null,turtleController:ReturnType<typeof createTurtleController>|null=null,turtleLoading=false,mode:ControlMode='camera',accumulator=0,currentProfile:QualityProfile='balanced',lastLocomotion='';
 let controls:DemoControls={...DEFAULT_CONTROLS};
 const targetFps=matchMedia('(pointer:coarse)').matches||canvas.clientWidth<768?30:60,pacer=createRenderPacer(targetFps);
 const activity=()=>loop?.setActivity({paused,visible:!document.hidden,inputActive:!!(input?.snapshot().active||input?.snapshot().pointerActive||rig?.hasPending())});
 const visibility=()=>{accumulator=0;previousRender=null;pacer.reset();activity();};
 const render=()=>{if(disposed||!renderer||!water)return;try{water.update(time,controls);water.render(renderer,scene,camera,paused);}catch(error){if(initializing)throw error;options.onFatal(error instanceof Error?error:Error('The graphics device stopped rendering.'));}};
 const lost=(event:Event)=>{event.preventDefault();if(!disposed)options.onFatal(Error('The graphics context was interrupted. Try the live scene again.'));};
 const loadTurtle=async()=>{
  if(disposed||turtleLoading||turtle||!world||!cove)return;turtleLoading=true;options.onTurtle?.(false);
  try{const next=await createTurtleView('/assets/turtle.glb',assetAbort.signal);if(disposed){next.dispose();return;}try{turtleController=createTurtleController(cove,world,TURTLE_ASSET.proxy,TURTLE_ASSET);}catch(error){next.dispose();throw error;}
   turtle=next;turtle.setQuality(currentProfile);turtle.apply(turtleController.state,0);dynamicGroup.add(turtle.group);options.onTurtle?.(true);render();activity();
  }catch(error){if(!disposed)options.onTurtle?.(false,'Turtle could not load. You can keep exploring or retry.');}finally{turtleLoading=false;}
 };
 const retryTurtle=()=>void loadTurtle();
 const navigation=async()=>{
  if(disposed||loading||!cove||rig)return;loading=true;canvas.setAttribute('aria-busy','true');options.onNavigation?.(false);
  try{
   const next=await createPhysicsWorld(cove.data);if(disposed){next.dispose();return;}world=next;rig=createCameraRig(canvas,cove,world);rig.camera.position.copy(camera.position);rig.camera.quaternion.copy(camera.quaternion);camera=rig.camera;
   rig.setEnabled(!blocked);input?.setBlocked(blocked);await loadTurtle();if(disposed)return;canvas.setAttribute('aria-busy','false');options.onNavigation?.(true);render();activity();
  }catch(error){if(!disposed){world?.dispose();world=null;input?.setBlocked(true);canvas.setAttribute('aria-busy','false');options.onNavigation?.(false,'Navigation could not load. The coast is still available.');}}
  finally{loading=false;}
 };
 const retryNavigation=()=>void navigation();
 const dispose=()=>{if(disposed)return;disposed=true;assetAbort.abort();turtleController?.dispose();turtle?.dispose();loop?.dispose();input?.dispose();rig?.dispose();world?.dispose();canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('retrynavigation',retryNavigation);canvas.removeEventListener('retryturtle',retryTurtle);document.removeEventListener('visibilitychange',visibility);water?.dispose();cove?.dispose();initialCamera.dispose();renderer?.renderLists.dispose();renderer?.dispose();if(renderer)renderer.forceContextLoss();else gl.getExtension('WEBGL_lose_context')?.loseContext();scene.clear();};
 try{
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  cove=createCove(7);water=createWater(cove);water.setDynamicGroup(dynamicGroup);scene.add(cove.group,water.mesh,dynamicGroup,new THREE.HemisphereLight(0xdff4ff,0x746a56,1));
  const sun=new THREE.DirectionalLight(0xfff1db,3.4);sun.position.set(Math.cos(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22,25,Math.sin(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  const applyQuality=(profile:QualityProfile)=>{if(disposed)return;currentProfile=profile;turtle?.setQuality(profile);water!.setDetail(profile);cove!.setQuality(profile);renderer!.setPixelRatio(Math.min(devicePixelRatio,{low:1,balanced:1.5,high:2}[profile]));renderer!.setSize(canvas.clientWidth,canvas.clientHeight,false);canvas.dataset.quality=profile;render();};
  const quality=createQualityController(options.quality,targetFps,applyQuality);
  input=bindModeInput(canvas,activity);input.setBlocked(true);
  loop=createFrameLoop({now:()=>performance.now(),request:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id)},(elapsed,simulationDelta,inputDelta)=>{
   time=elapsed;const snapshot=input!.snapshot();
   if(turtleController&&turtle&&simulationDelta>0){accumulator+=Math.min(.1,simulationDelta);const forward=new THREE.Vector3();camera.getWorldDirection(forward);let steps=0;
    while(accumulator+1e-9>=1/60&&steps<6){turtleController.step(mode==='turtle'?snapshot:{...snapshot,forward:0,right:0,vertical:0,active:false},forward,controls.tide,1/60);accumulator-=1/60;steps++;}
    if(steps===6)accumulator=Math.max(0,accumulator%(1/60));turtle.apply(turtleController.state,simulationDelta);
    if(lastLocomotion!==turtleController.state.locomotion){lastLocomotion=turtleController.state.locomotion;options.onTurtleState?.(lastLocomotion);}
   }
   const changed=rig?.update(snapshot,mode==='turtle'&&turtleController?turtleController.state.position:null,inputDelta)??false,now=performance.now();
   if(changed||pacer.shouldRender(now)){render();if(previousRender!==null&&!paused)quality.observe(now-previousRender);previousRender=now;}activity();
  });
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('retrynavigation',retryNavigation);canvas.addEventListener('retryturtle',retryTurtle);document.addEventListener('visibilitychange',visibility);
  renderer.debug.onShaderError=()=>{const error=Error('The water shader could not compile on this graphics device.');startupError=error;queueMicrotask(()=>{if(!disposed)options.onFatal(error);});};
  applyQuality(quality.current().profile);if(startupError)throw startupError;initializing=false;visibility();void navigation();
  return {setMode(next){if(disposed||next==='turtle'&&(!turtleController||!turtle))return;mode=next;input?.setMode(next);rig?.setMode(next);rig?.update(input!.snapshot(),next==='turtle'?turtleController!.state.position:null,0);canvas.focus({preventScroll:true});activity();render();},setTouchControl(code,pressed){input?.setTouch(code,pressed);},resetTurtle(){if(disposed||!turtleController||!turtle)return;turtleController.reset();turtle.apply(turtleController.state,0);if(mode==='turtle'){rig?.reset();rig?.update(input!.snapshot(),turtleController.state.position,0);}activity();render();},setPaused(value){paused=value;visibility();render();},setControls(patch){controls={swell:Math.max(0,Math.min(1,patch.swell??controls.swell)),tide:Math.max(-.35,Math.min(.35,patch.tide??controls.tide)),sunAzimuth:Math.max(0,Math.min(360,patch.sunAzimuth??controls.sunAzimuth))};const az=controls.sunAzimuth*Math.PI/180;sun.position.set(Math.cos(az)*22,25,Math.sin(az)*22);renderer!.shadowMap.needsUpdate=true;render();},setQuality:mode=>quality.setMode(mode),setInputBlocked(value){blocked=value;input?.setBlocked(value||!rig);rig?.setEnabled(!value);activity();},
   resetCamera(){if(disposed)return;if(rig)rig.reset();else initialCamera.reset();activity();render();},
   resize(width,height,dpr){if(disposed||width<=0||height<=0)return;if(rig)rig.resize(width/height);else initialCamera.resize(width/height);renderer!.setPixelRatio(Math.min(dpr,{low:1,balanced:1.5,high:2}[quality.current().profile]));renderer!.setSize(width,height,false);activity();render();},dispose};
 }catch(error){dispose();throw error;}
}

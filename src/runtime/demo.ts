import * as THREE from 'three';
import {createCove} from '../scene/cove';
import {createSeabedProps} from '../scene/seabed';
import {createCamera} from '../scene/camera';
import {createCameraRig} from '../camera/camera-rig';
import {bindModeInput} from '../input/mode-controller';
import {createPhysicsWorld,type PhysicsWorld} from '../physics/world';
import {createTurtleView,type TurtleView} from '../turtle/view';
import {createTurtleController} from '../turtle/controller';
import {TURTLE_ASSET} from '../turtle/asset';
import {createTurtleTrails} from '../turtle/trails';
import {createContactTrails} from '../turtle/contact-trails';
import {createTurtleContactMotion} from './turtle-contact-motion';
import {createWater} from '../water/water';
import {createOrbitWaterResponse,stepOrbitWaterResponse} from '../water/orbit-response';
import {createTurtleRoutine,PRODUCTION_TURTLE_ROUTINE_PROFILE} from './turtle-activities';
import {createFrameLoop} from './frame-loop';
import {createTurtleWander} from './turtle-wander';
import {createQualityController} from './quality';
import {createRenderPacer} from './render-pacer';
import {DEFAULT_CONTROLS} from '../types';
import type {DemoController,DemoControls,QualityMode,QualityProfile,ControlMode,TurtleRoutineStatus} from '../types';
export type SceneExtension={update(time:number,delta:number,controls:DemoControls):void;dispose():void};
/** What a page mode may change in the scene: its own dynamic objects plus a few environment knobs. */
export type SceneContext={group:THREE.Group;cove:ReturnType<typeof createCove>;setBackground(background:THREE.ColorRepresentation|THREE.Texture):void;setWaterTint(color:THREE.ColorRepresentation):void;setSand(tint:[number,number,number]):void;setPalmsVisible(visible:boolean):void};
export function createDemo(canvas:HTMLCanvasElement,options:{reducedMotion:boolean;quality:QualityMode;onFatal(error:Error):void;onNavigation?(ready:boolean,error?:string):void;onTurtle?(ready:boolean,error?:string):void;onTurtleState?(state:string):void;onTurtleRoutine?(status:TurtleRoutineStatus):void;extend?(context:SceneContext):SceneExtension;ambientTurtle?:boolean;pixelRatioCaps?:Record<QualityProfile,number>;autoQualityStart?:QualityProfile;shadows?:boolean}):DemoController{
 // Device-pixel-ratio ceiling per quality profile; the study page keeps its lighter defaults.
 const pixelRatioCaps=options.pixelRatioCaps??{low:1,balanced:1.5,high:2};
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable on this browser.');
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xeeeae5);
 let renderer:THREE.WebGLRenderer|null=null,cove:ReturnType<typeof createCove>|null=null,water:ReturnType<typeof createWater>|null=null;
 const initialCamera=createCamera(canvas.clientWidth/canvas.clientHeight);let camera=initialCamera.camera,rig:ReturnType<typeof createCameraRig>|null=null,world:PhysicsWorld|null=null,input:ReturnType<typeof bindModeInput>|null=null,loop:ReturnType<typeof createFrameLoop>|null=null;
 let paused=options.reducedMotion,disposed=false,initializing=true,time=0,previousRender:number|null=null,startupError:Error|null=null,blocked=false,loading=false;
 const dynamicGroup=new THREE.Group(),assetAbort=new AbortController();dynamicGroup.name='coastal-life';
 let trails:ReturnType<typeof createTurtleTrails>|null=null,seabed:ReturnType<typeof createSeabedProps>|null=null;
 let contactMotion:ReturnType<typeof createTurtleContactMotion>|null=null,contactTrails:ReturnType<typeof createContactTrails>|null=null;
 let orbitResponse=createOrbitWaterResponse(),orbitRevision=-1;
 const resetOrbitResponse=()=>{orbitResponse=createOrbitWaterResponse();orbitRevision=rig?.orbitState().revision??-1;water?.setOrbitResponse(0);};
 let turtle:TurtleView|null=null,turtleController:ReturnType<typeof createTurtleController>|null=null,turtleLoading=false,mode:ControlMode='camera',accumulator=0,currentProfile:QualityProfile='balanced',lastLocomotion='';
 let controls:DemoControls={...DEFAULT_CONTROLS};
 let turtleRoutine:ReturnType<typeof createTurtleRoutine>|null=null,lastRoutineStatus='',routineInitializationFailed=false,extension:SceneExtension|null=null,wander:ReturnType<typeof createTurtleWander>|null=null;
 const publishRoutine=(startReason?:string)=>{
  const state=turtleRoutine?.diagnostics(),phase=state?.phase??'off';let message='';
  if(startReason||routineInitializationFailed)message=startReason==='paused'?'Play the scene to start the routine.':startReason==='nest-present'?'Return the turtle to reset the nest before starting another routine.':startReason==='no-safe-route'?'Move the turtle into clear water and try again.':'The turtle routine is not ready yet.';
  else if(state?.stage==='finished')message='The turtle has returned to the sea.';
  else if(state?.stage==='cancelled')message=state.reason==='manual-control'?'Routine stopped. You have control.':'Routine stopped. The turtle can be controlled normally.';
  else if(state?.enabled){
   const labels:Record<string,string>={rest:'Settling into position.',feed:'Feeding on the seabed.',dig:'Digging a nest.',lay:'Laying eggs.',cover:'Covering the nest.'};
   message=labels[phase]??(state.stage==='feeding'?(phase==='leave'?'Heading toward the shore.':'Swimming to the feeding spot.'):(phase==='leave'?'Returning to the sea.':'Coming ashore.'));
  }
  const status:TurtleRoutineStatus={enabled:!!state?.enabled,phase,message},key=JSON.stringify(status);
  if(key!==lastRoutineStatus){lastRoutineStatus=key;options.onTurtleRoutine?.(status);}
 };
 const targetFps=matchMedia('(pointer:coarse)').matches||canvas.clientWidth<768?30:60,pacer=createRenderPacer(targetFps);
 const activity=()=>loop?.setActivity({paused,visible:!document.hidden,inputActive:!!(input?.snapshot().active||input?.snapshot().pointerActive||rig?.hasPending())});
 const visibility=()=>{resetOrbitResponse();accumulator=0;previousRender=null;pacer.reset();activity();};
 const render=()=>{if(disposed||!renderer||!water)return;try{water.update(time,controls);water.render(renderer,scene,camera,paused);}catch(error){if(initializing)throw error;options.onFatal(error instanceof Error?error:Error('The graphics device stopped rendering.'));}};
 const lost=(event:Event)=>{event.preventDefault();if(!disposed)options.onFatal(Error('The graphics context was interrupted. Try the live scene again.'));};
 const loadTurtle=async()=>{
  if(disposed||turtleLoading||turtle||!world||!cove)return;turtleLoading=true;options.onTurtle?.(false);
  try{const next=await createTurtleView('/assets/turtle.glb',assetAbort.signal);if(disposed){next.dispose();return;}try{turtleController=createTurtleController(cove,world,TURTLE_ASSET.proxy,TURTLE_ASSET);}catch(error){next.dispose();throw error;}
   turtle=next;turtle.setQuality(currentProfile);turtle.apply(turtleController.state,0);dynamicGroup.add(turtle.group);
   // Keep the original view/trails as a fallback if the production-specific
   // contact adapter cannot be initialized for this loaded asset.
   let candidateMotion:ReturnType<typeof createTurtleContactMotion>|null=null,candidateTrails:ReturnType<typeof createContactTrails>|null=null;
   try{
    candidateMotion=createTurtleContactMotion({view:turtle,cove,asset:TURTLE_ASSET});
    if(candidateMotion.diagnostics().ready){
     candidateTrails=createContactTrails(cove);candidateMotion.setPaused(paused);candidateTrails.setPaused(paused);candidateTrails.setTide(controls.tide);
     dynamicGroup.add(candidateTrails.group);contactMotion=candidateMotion;contactTrails=candidateTrails;
     if(trails){dynamicGroup.remove(trails.group);trails.dispose();trails=null;}
    }else candidateMotion.dispose();
   }catch{candidateMotion?.dispose();if(candidateTrails){dynamicGroup.remove(candidateTrails.group);candidateTrails.dispose();}contactMotion=null;contactTrails=null;}
   // An optional routine failure must not disable the successfully loaded turtle.
   let candidateRoutine:ReturnType<typeof createTurtleRoutine>|null=null;
   try{candidateRoutine=createTurtleRoutine({cove,controller:turtleController,view:turtle,asset:TURTLE_ASSET,restProfile:PRODUCTION_TURTLE_ROUTINE_PROFILE});dynamicGroup.add(candidateRoutine.group);candidateRoutine.setPaused(paused);turtleRoutine=candidateRoutine;routineInitializationFailed=false;}
   catch{if(candidateRoutine){dynamicGroup.remove(candidateRoutine.group);candidateRoutine.dispose();}routineInitializationFailed=true;}
   publishRoutine();options.onTurtle?.(true);render();activity();
  }catch(error){if(!disposed)options.onTurtle?.(false,'Turtle could not load. You can keep exploring or retry.');}finally{turtleLoading=false;}
 };
 const retryTurtle=()=>void loadTurtle();
 const navigation=async()=>{
  if(disposed||loading||!cove||rig)return;loading=true;canvas.setAttribute('aria-busy','true');options.onNavigation?.(false);
  try{
   const next=await createPhysicsWorld(cove.data);if(disposed){next.dispose();return;}world=next;rig=createCameraRig(canvas,cove,world);rig.camera.position.copy(camera.position);rig.camera.quaternion.copy(camera.quaternion);camera=rig.camera;
   rig.setEnabled(!blocked);resetOrbitResponse();input?.setBlocked(blocked);await loadTurtle();if(disposed)return;canvas.setAttribute('aria-busy','false');options.onNavigation?.(true);render();activity();
  }catch(error){if(!disposed){world?.dispose();world=null;input?.setBlocked(true);canvas.setAttribute('aria-busy','false');options.onNavigation?.(false,'Navigation could not load. The coast is still available.');}}
  finally{loading=false;}
 };
 const retryNavigation=()=>void navigation();
 const dispose=()=>{if(disposed)return;disposed=true;assetAbort.abort();extension?.dispose();extension=null;contactMotion?.dispose();contactTrails?.dispose();turtleRoutine?.dispose();turtleController?.dispose();turtle?.dispose();trails?.dispose();seabed?.dispose();loop?.dispose();input?.dispose();rig?.dispose();world?.dispose();canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('retrynavigation',retryNavigation);canvas.removeEventListener('retryturtle',retryTurtle);document.removeEventListener('visibilitychange',visibility);water?.dispose();cove?.dispose();initialCamera.dispose();renderer?.renderLists.dispose();renderer?.dispose();if(renderer)renderer.forceContextLoss();else gl.getExtension('WEBGL_lose_context')?.loseContext();scene.clear();};
 try{
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.shadowMap.enabled=options.shadows??true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  cove=createCove(7);seabed=createSeabedProps(7,cove.data);trails=createTurtleTrails(cove);dynamicGroup.add(trails.group);water=createWater(cove);water.setDynamicGroup(dynamicGroup);scene.add(cove.group,seabed.group,water.mesh,dynamicGroup,new THREE.HemisphereLight(0xdff4ff,0x746a56,1));
  if(options.extend)extension=options.extend({group:dynamicGroup,cove,
   setBackground(background){
    // Colours keep the shared Color instance; a texture (painted sky) replaces it, disposing the previous one.
    const previous=scene.background;
    if(background instanceof THREE.Texture)scene.background=background;
    else if(previous instanceof THREE.Color)previous.set(background);else scene.background=new THREE.Color(background);
    if(previous instanceof THREE.Texture&&previous!==scene.background)previous.dispose();
    water?.setDynamicGroup(dynamicGroup);render();
   },
   setSand(tint){
    // Multiplies the beach's original vertex colours per channel (values above 1 lift that channel), so a
    // region can whiten or grey its sand on top of the yellowish sand texture.
    const ground=cove?.group.children.find(o=>o instanceof THREE.Mesh&&o.geometry.getAttribute('coastMoss')) as THREE.Mesh|undefined;
    if(!ground)return;const attribute=ground.geometry.getAttribute('color') as THREE.BufferAttribute;
    const original=(ground.userData.originalColors??=Float32Array.from(attribute.array as Float32Array)) as Float32Array;
    const out=attribute.array as Float32Array;
    for(let i=0;i<attribute.count;i++)for(let k=0;k<3;k++)out[i*3+k]=original[i*3+k]*tint[k];
    attribute.needsUpdate=true;water?.setDynamicGroup(dynamicGroup);render();
   },
   setWaterTint(color){water?.setTint(color);render();},
   // The static coast is cached, so refresh the capture after changing it.
   setPalmsVisible(visible){const palms=cove?.group.getObjectByName('cove-mint-palms');if(palms){palms.visible=visible;renderer!.shadowMap.needsUpdate=true;water?.setDynamicGroup(dynamicGroup);render();}}});
  if(options.ambientTurtle)wander=createTurtleWander(cove.sampleHeight);
  const sun=new THREE.DirectionalLight(0xfff1db,3.4);sun.position.set(Math.cos(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22,25,Math.sin(DEFAULT_CONTROLS.sunAzimuth*Math.PI/180)*22);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  const applyQuality=(profile:QualityProfile)=>{if(disposed)return;currentProfile=profile;turtle?.setQuality(profile);seabed?.setQuality(profile);water!.setDetail(profile);cove!.setQuality(profile);renderer!.shadowMap.needsUpdate=true;renderer!.setPixelRatio(Math.min(devicePixelRatio,pixelRatioCaps[profile]));renderer!.setSize(canvas.clientWidth,canvas.clientHeight,false);canvas.dataset.quality=profile;render();};
  const quality=createQualityController(options.quality,targetFps,applyQuality,options.autoQualityStart);
  input=bindModeInput(canvas,activity);input.setBlocked(true);
  loop=createFrameLoop({now:()=>performance.now(),request:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id)},(elapsed,simulationDelta,inputDelta)=>{
   time=elapsed;const snapshot=input!.snapshot();
   if(turtleController&&turtle){
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);
    let manual=mode==='turtle'?snapshot:{...snapshot,forward:0,right:0,vertical:0,active:false};
    // Ambient mode lets the turtle roam the water on its own while the camera is free.
    if(wander&&mode!=='turtle'&&simulationDelta>0){const roam=wander.step(turtleController.state.position,controls.tide,simulationDelta);manual={...roam.input,mode:snapshot.mode};forward.set(roam.forward.x,roam.forward.y,roam.forward.z);}
    // Observe manual takeover even while the simulation is paused.
    turtleRoutine?.resolveInput(manual,forward,controls.tide,paused);
    if(simulationDelta>0){accumulator+=Math.min(.1,simulationDelta);let steps=0;
     while(accumulator+1e-9>=1/60&&steps<6){
      const movement=turtleRoutine?.resolveInput(manual,forward,controls.tide,paused)??{input:manual,cameraForward:forward};
      turtleController.step(movement.input,movement.cameraForward,controls.tide,1/60);turtleRoutine?.afterStep(controls.tide,1/60,paused);
      if(!contactMotion)trails?.update(turtleController.state,time,controls.tide);accumulator-=1/60;steps++;
     }
     if(steps===6)accumulator=Math.max(0,accumulator%(1/60));
     const routinePose=turtleRoutine?.diagnostics(),poseEnabled=!routinePose?.enabled||!['rest','feed','dig','lay','cover'].includes(routinePose.phase);
     if(contactMotion)contactMotion.apply(turtleController.state,simulationDelta,{poseEnabled});else turtle.apply(turtleController.state,simulationDelta);
     turtleRoutine?.applyPose();
     // Observe the final weighted pose once per displayed frame, after all overlays.
     if(contactMotion&&contactTrails)contactTrails.update(contactMotion.sampleContacts(turtleController.state,time,controls.tide));
     if(lastLocomotion!==turtleController.state.locomotion){lastLocomotion=turtleController.state.locomotion;options.onTurtleState?.(lastLocomotion);}
    }
    publishRoutine();
   }
   extension?.update(time,simulationDelta,controls);
   const changed=rig?.update(snapshot,mode==='turtle'&&turtleController?turtleController.state.position:null,inputDelta)??false,now=performance.now();
   const orbitPose=rig?.orbitState();
   // The live paused state already includes user, host, and reduced-motion pauses.
   if(!orbitPose||paused||blocked||document.hidden)resetOrbitResponse();
   else{
    if(orbitPose.revision!==orbitRevision){orbitResponse=createOrbitWaterResponse();orbitRevision=orbitPose.revision;}
    orbitResponse=stepOrbitWaterResponse(orbitResponse,{...orbitPose,timeSeconds:now/1000,active:orbitPose.active&&!snapshot.active});
    water!.setOrbitResponse(orbitResponse.amplitude);
   }
   if(changed||pacer.shouldRender(now)){render();if(previousRender!==null&&!paused)quality.observe(now-previousRender);previousRender=now;}activity();
  });
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('retrynavigation',retryNavigation);canvas.addEventListener('retryturtle',retryTurtle);document.addEventListener('visibilitychange',visibility);
  renderer.debug.onShaderError=()=>{const error=Error('The water shader could not compile on this graphics device.');startupError=error;queueMicrotask(()=>{if(!disposed)options.onFatal(error);});};
  applyQuality(quality.current().profile);if(startupError)throw startupError;initializing=false;visibility();void navigation();
  return {setMode(next){if(disposed||next==='turtle'&&(!turtleController||!turtle))return;mode=next;input?.setMode(next);rig?.setMode(next);resetOrbitResponse();rig?.update(input!.snapshot(),next==='turtle'?turtleController!.state.position:null,0);canvas.focus({preventScroll:true});activity();render();},setTouchControl(code,pressed){input?.setTouch(code,pressed);},resetTurtle(){if(disposed||!turtleController||!turtle)return;resetOrbitResponse();turtleRoutine?.reset();publishRoutine();turtleController.reset();trails?.reset();contactMotion?.reset();contactTrails?.reset();turtle.apply(turtleController.state,0);if(mode==='turtle'){rig?.reset();rig?.update(input!.snapshot(),turtleController.state.position,0);}activity();render();},setTurtleRoutine(value){if(disposed)return;if(!turtleRoutine){publishRoutine('missing-rig');return;}const result=turtleRoutine.setEnabled(value,controls.tide);publishRoutine(result.ready?undefined:result.reason);activity();render();},setPaused(value){paused=value;contactMotion?.setPaused(value);contactTrails?.setPaused(value);turtleRoutine?.setPaused(value);publishRoutine();visibility();render();},setControls(patch){controls={swell:Math.max(0,Math.min(1,patch.swell??controls.swell)),tide:Math.max(-.35,Math.min(.35,patch.tide??controls.tide)),sunAzimuth:Math.max(0,Math.min(360,patch.sunAzimuth??controls.sunAzimuth))};turtleRoutine?.afterStep(controls.tide,0,paused);contactTrails?.setTide(controls.tide);publishRoutine();const az=controls.sunAzimuth*Math.PI/180;sun.position.set(Math.cos(az)*22,25,Math.sin(az)*22);renderer!.shadowMap.needsUpdate=true;render();},setQuality:mode=>quality.setMode(mode),setInputBlocked(value){blocked=value;resetOrbitResponse();input?.setBlocked(value||!rig);rig?.setEnabled(!value);activity();},
   resetCamera(){if(disposed)return;resetOrbitResponse();if(rig)rig.reset();else initialCamera.reset();activity();render();},
   resize(width,height,dpr){if(disposed||width<=0||height<=0)return;if(rig)rig.resize(width/height);else initialCamera.resize(width/height);renderer!.setPixelRatio(Math.min(dpr,pixelRatioCaps[quality.current().profile]));renderer!.setSize(width,height,false);activity();render();},dispose};
 }catch(error){dispose();throw error;}
}

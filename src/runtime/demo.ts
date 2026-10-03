import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createTerrain} from '../scene/terrain';
import {createCamera,CAMERA_TARGET,CAMERA_ORBIT_LIMITS} from '../scene/camera';
import {Sky} from 'three/addons/objects/Sky.js';
import {createWater} from '../water/water';
import {createFrameLoop} from './frame-loop';
import {createQualityController} from './quality';
import {createRenderPacer} from './render-pacer';
import {DEFAULT_CONTROLS} from '../types';
import type {DemoController,DemoControls,QualityMode,QualityProfile} from '../types';
export function createDemo(canvas:HTMLCanvasElement,options:{reducedMotion:boolean;quality:QualityMode;onFatal(error:Error):void}):DemoController{
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 is unavailable on this browser.');
 let renderer:THREE.WebGLRenderer|null=null,terrain:ReturnType<typeof createTerrain>|null=null,water:ReturnType<typeof createWater>|null=null,cameraResources:ReturnType<typeof createCamera>|null=null,orbit:OrbitControls|null=null,loop:ReturnType<typeof createFrameLoop>|null=null,sky:Sky|null=null;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x171c20);
 let paused=options.reducedMotion,disposed=false,initializing=true,time=0,previousRender:number|null=null,startupError:Error|null=null;
 let controls:DemoControls={...DEFAULT_CONTROLS};
 const targetFps=matchMedia('(pointer:coarse)').matches||canvas.clientWidth<768?30:60,pacer=createRenderPacer(targetFps);
 const lost=(event:Event)=>{event.preventDefault();if(!disposed)options.onFatal(new Error('The graphics context was interrupted. Try the live scene again.'));};
 const visibility=()=>{previousRender=null;pacer.reset();loop?.setActivity({paused,visible:!document.hidden});};
 const render=()=>{if(disposed||!renderer||!water||!cameraResources)return;try{water.update(time,controls);water.render(renderer,scene,cameraResources.camera);}catch(error){if(initializing)throw error;options.onFatal(error instanceof Error?error:new Error('The graphics device stopped rendering.'));}};
 const dispose=()=>{if(disposed)return;disposed=true;loop?.dispose();canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);orbit?.removeEventListener('change',render);orbit?.dispose();cameraResources?.dispose();water?.dispose();terrain?.dispose();sky?.geometry.dispose();sky?.material.dispose();renderer?.renderLists.dispose();renderer?.dispose();if(renderer)renderer.forceContextLoss();else gl.getExtension('WEBGL_lose_context')?.loseContext();scene.clear();};
 try{
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,preserveDrawingBuffer:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  sky=new Sky();sky.scale.setScalar(1000);sky.material.fragmentShader=sky.material.fragmentShader.replace('vec4( texColor, 1.0 )','vec4( texColor * 0.08, 1.0 )');sky.material.uniforms.cloudCoverage.value=.58;sky.material.uniforms.cloudScale.value=.0007;sky.material.uniforms.cloudDensity.value=.7;sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.7;sky.material.uniforms.mieCoefficient.value=.003;sky.material.uniforms.sunPosition.value.set(-18,25,-15);scene.add(sky);
  terrain=createTerrain(7);water=createWater(terrain);scene.add(terrain.group,water.mesh);
  scene.add(new THREE.HemisphereLight(0xdff4ff,0x746a56,1.0));const sun=new THREE.DirectionalLight(0xfff1db,3.4);sun.position.set(-18,25,-15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  cameraResources=createCamera(canvas.clientWidth/canvas.clientHeight);const camera=cameraResources.camera;
  orbit=new OrbitControls(camera,canvas);orbit.enablePan=false;orbit.enableDamping=false;orbit.target.copy(CAMERA_TARGET);Object.assign(orbit,CAMERA_ORBIT_LIMITS);orbit.update();
  const applyQuality=(profile:QualityProfile)=>{if(disposed)return;water!.setDetail(profile);renderer!.setPixelRatio(Math.min(devicePixelRatio,{low:1,balanced:1.5,high:2}[profile]));renderer!.setSize(canvas.clientWidth,canvas.clientHeight,false);canvas.dataset.quality=profile;render();};
  const quality=createQualityController(options.quality,targetFps,applyQuality);
  loop=createFrameLoop({now:()=>performance.now(),request:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id)},elapsed=>{
   time=elapsed;const now=performance.now();if(!pacer.shouldRender(now))return;render();if(previousRender!==null)quality.observe(now-previousRender);previousRender=now;
  });
  canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);orbit.addEventListener('change',render);
  renderer.debug.onShaderError=()=>{const error=new Error('The water shader could not compile on this graphics device.');startupError=error;queueMicrotask(()=>{if(!disposed)options.onFatal(error);});};
  applyQuality(quality.current().profile);if(startupError)throw startupError;initializing=false;visibility();
  return {setPaused(value){paused=value;visibility();render();},setControls(patch){controls={swell:Math.max(0,Math.min(1,patch.swell??controls.swell)),tide:Math.max(-.35,Math.min(.35,patch.tide??controls.tide)),sunAzimuth:Math.max(0,Math.min(360,patch.sunAzimuth??controls.sunAzimuth))};const az=controls.sunAzimuth*Math.PI/180;sun.position.set(Math.cos(az)*22,25,Math.sin(az)*22);sky!.material.uniforms.sunPosition.value.copy(sun.position);renderer!.shadowMap.needsUpdate=true;render();},setQuality:mode=>quality.setMode(mode),
  resetCamera(){if(disposed)return;cameraResources!.reset();orbit!.target.copy(CAMERA_TARGET);orbit!.update();render();},
  resize(width,height,dpr){if(disposed||width<=0||height<=0)return;cameraResources!.resize(width/height);orbit!.maxDistance=23;renderer!.setPixelRatio(Math.min(dpr,{low:1,balanced:1.5,high:2}[quality.current().profile]));renderer!.setSize(width,height,false);orbit!.update();render();},dispose};
 }catch(error){dispose();throw error;}
}

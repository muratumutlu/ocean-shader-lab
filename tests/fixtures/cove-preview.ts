import {createTurtleView} from '../../src/turtle/view';
import {createTurtleController,turtleRotation} from '../../src/turtle/controller';
import {TURTLE_ASSET} from '../../src/turtle/asset';
import {createCameraRig} from '../../src/camera/camera-rig';
import * as THREE from 'three';
import {createCove} from '../../src/scene/cove';
import {createWater} from '../../src/water/water';
import {createPhysicsWorld,type PhysicsWorld} from '../../src/physics/world';
import {resolveCameraMove} from '../../src/camera/collision';
import {nearPlaneRadius} from '../../src/camera/free-camera';
import {createCamera} from '../../src/scene/camera';
const canvas=document.querySelector<HTMLCanvasElement>('#cove')!,renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Number(new URLSearchParams(location.search).get('dpr'))||1);renderer.setSize(innerWidth,innerHeight,false);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x3b4350);
const coveStart=performance.now();const cove=createCove(7);cove.setQuality('balanced');const coveCreateMs=performance.now()-coveStart;const water=createWater(cove),camera=createCamera(innerWidth/innerHeight).camera;
scene.add(cove.group,water.mesh,new THREE.HemisphereLight(0xdff4ff,0x746a56,1));
const sun=new THREE.DirectionalLight(0xfff1db,3.4);sun.position.set(Math.cos(225*Math.PI/180)*22,25,Math.sin(225*Math.PI/180)*22);scene.add(sun);
const probe=new THREE.Mesh(new THREE.BoxGeometry(.55,1,.55),new THREE.MeshBasicMaterial({color:0xff351c}));probe.visible=false;
let world:PhysicsWorld|null=null,overlay:THREE.LineSegments|null=null,navigation:Promise<void>|null=null,disposed=false;
let turtle:Awaited<ReturnType<typeof createTurtleView>>|null=null,turtleController:ReturnType<typeof createTurtleController>|null=null;
let profile='balanced';let time=0;const controls={swell:.55,tide:0,sunAzimuth:225};
const dynamic=new THREE.Group();scene.add(dynamic);water.setDynamicGroup(dynamic);dynamic.add(probe);
const render=()=>{water.update(time,controls);water.render(renderer,scene,camera);};
const named:Record<string,{eye:number[];target:number[]}>= {
 cutOverview:{eye:[24,7,20],target:[5,-2,0]},
 cutFront:{eye:[0,3,20],target:[0,-4.9,12]},
 cutWest:{eye:[-24,8,-1],target:[-16,-2.7,-1]},
 cutEast:{eye:[24,8,0],target:[16,-2.7,0]},
 cutRear:{eye:[0,9.5,-20],target:[0,-2.6,-12]},
 ceramicDetail:{eye:[-17.05,cove.sampleHeight(-16,-4.8)-.91,-4.98],target:[-16.02,cove.sampleHeight(-16,-4.8)-1.17,-4.8]},
 ceramicMouth:{eye:[-16.63,cove.sampleHeight(-16,-4.8)-.56,-5.13],target:[-15.97,cove.sampleHeight(-16,-4.8)-1.08,-4.8]},

 skeleton:{eye:[-6,cove.sampleHeight(-6,-12)-2.83,-14.4],target:[-6,cove.sampleHeight(-6,-12)-3.1,-12]},
 skull:{eye:[-6.73,cove.sampleHeight(-6,-12)-3.00,-12.68],target:[-6.72,cove.sampleHeight(-6,-12)-3.1,-12.04]},
 skeletonOblique:{eye:[-7.2,cove.sampleHeight(-6,-12)-2.64,-13.2],target:[-6.1,cove.sampleHeight(-6,-12)-3.1,-12]},

 ceramicWest:{eye:[-19.5,cove.sampleHeight(-16,-4.8)-1.12,-4.8],target:[-16,cove.sampleHeight(-16,-4.8)-1.22,-4.8]},
 ceramicRear:{eye:[5.2,cove.sampleHeight(5.2,-12)-2.3,-15.7],target:[5.2,cove.sampleHeight(5.2,-12)-2.55,-12]},
 bronzeEast:{eye:[19.4,cove.sampleHeight(16,2.5)-1,2.5],target:[16,cove.sampleHeight(16,2.5)-1.1,2.5]},
 bronzeFront:{eye:[-6,cove.sampleHeight(-6,12)-2.4,15.5],target:[-6,cove.sampleHeight(-6,12)-2.65,12]},
 probeFront:{eye:[3,2,8],target:[0,0,3]},
 probeRear:{eye:[-3,1,-2],target:[0,0,3]},
 probeBelow:{eye:[0,-.7,5],target:[0,0,3]},
 overview:{eye:[20.85,12,32.64],target:[0,2.22,1.48]},
 west:{eye:[-5,3.1,8],target:[-10,.1,1.9]},
 east:{eye:[6.4,3.3,4],target:[9.6,.1,-.5]},
 offshore:{eye:[2.2,1.9,10],target:[5.8,-1.5,6.4]},
 rear:{eye:[-18,8,-22],target:[0,0,0]},
 surfaceBelow:{eye:[0,-.65,5],target:[2,1,3]},
 submergedRock:{eye:[6,-.45,4],target:[9,-.35,1]},
 underwater:{eye:[0,-1.25,6],target:[6,-1.2,1]},
 portrait:{eye:[29,19,45],target:[0,0,0]}
};
const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
(window as any).__cove={ready:true,async prepareTurtle(){await this.prepareNavigation();if(!turtle){turtle=await createTurtleView('/assets/turtle.glb',new AbortController().signal);turtleController=createTurtleController(cove,world!,TURTLE_ASSET.proxy,TURTLE_ASSET);dynamic.add(turtle.group);turtle.apply(turtleController.state,0);render();}},stepTurtle(input:any,forward:number[],steps=1){if(!turtleController||!turtle)throw Error('Prepare turtle first');for(let i=0;i<steps;i++)turtleController.step(input,{x:forward[0],y:forward[1],z:forward[2]},controls.tide,1/60);turtle.apply(turtleController.state,steps/60);render();return structuredClone(turtleController.state);},turtleState(){return turtleController?structuredClone(turtleController.state):null;},turtleView(kind:string){if(!turtleController)throw Error('Prepare turtle');const p=turtleController.state.position,offset=kind==='front'?[0,.6,-2.4]:kind==='rear'?[0,.5,2.4]:kind==='underwater'?[1,-.15,1.8]:[1.6,.65,1.5];this.setPose([p.x+offset[0],p.y+offset[1],p.z+offset[2]],[p.x,p.y+.14,p.z]);},turtleContact(){if(!turtle)return null;turtle.group.updateMatrixWorld(true);let min=Infinity,max=-Infinity;const point=new THREE.Vector3();turtle.group.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||!o.parent?.visible)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=3){point.fromBufferAttribute(p,i);o.applyBoneTransform(i,point);point.applyMatrix4(o.matrixWorld);const gap=point.y-cove.sampleHeight(point.x,point.z);min=Math.min(min,gap);max=Math.max(max,gap);}});return {min,max};},frame(t:number,eye:number[]|null,target:number[]){time=t;if(eye){if(!world)throw Error('Prepare navigation first');const p=resolveCameraMove(world,camera.position,{x:eye[0],y:eye[1],z:eye[2]},nearPlaneRadius(camera.near,camera.fov,camera.aspect),false);camera.position.set(p.x,p.y,p.z);camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateMatrixWorld();}render();},async prepareNavigation(){if(!navigation)navigation=createPhysicsWorld(cove.data).then(w=>{if(disposed){w.dispose();return;}world=w;});await navigation;},movePose(eye:number[],target:number[]){if(!world)throw Error('Prepare navigation first');const p=resolveCameraMove(world,camera.position,{x:eye[0],y:eye[1],z:eye[2]},nearPlaneRadius(camera.near,camera.fov,camera.aspect),false);camera.position.set(p.x,p.y,p.z);camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateMatrixWorld();render();},setCollisionOverlay(enabled:boolean){if(!world)throw Error('Prepare navigation first');if(!overlay){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(world.debugLines(),3));overlay=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe39845,transparent:true,opacity:.5}));dynamic.add(overlay);}overlay.visible=enabled;render();},dispose(){if(disposed)return;disposed=true;turtleController?.dispose();turtle?.dispose();world?.dispose();overlay?.geometry.dispose();(overlay?.material as THREE.Material|undefined)?.dispose();probe.geometry.dispose();(probe.material as THREE.Material).dispose();water.dispose();cove.dispose();renderer.dispose();},setProbe(position:number[]){probe.visible=true;probe.position.fromArray(position);render();},hideProbe(){probe.visible=false;render();},readWorldPixel(p:number[]){camera.updateMatrixWorld();const q=new THREE.Vector3().fromArray(p).project(camera),size=new THREE.Vector2();renderer.getDrawingBufferSize(size);const pixels=new Uint8Array(100);gl.readPixels(Math.round((q.x+1)*size.x/2)-2,Math.round((q.y+1)*size.y/2)-2,5,5,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const mean=[0,0,0];for(let i=0;i<25;i++)for(let c=0;c<3;c++)mean[c]+=pixels[i*4+c]/25;return mean;},views:Object.keys(named),render,setPose(eye:number[],target:number[]){camera.position.fromArray(eye);camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateMatrixWorld();render();},async zoomOrbit(delta:number){if(!world)await this.prepareNavigation();const rig=createCameraRig(renderer.domElement,cove,world!);try{renderer.domElement.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true}));rig.update({mode:'camera',forward:0,right:0,vertical:0,fast:false,active:false,pointerActive:false},null,0);camera.copy(rig.camera);render();return {distance:camera.position.distanceTo(new THREE.Vector3(0,.5,0)),far:camera.far,eye:camera.position.toArray()};}finally{rig.dispose();}},setView(name:string){if(name==='sweep'){if(!world)throw Error('Prepare navigation first');const r=cove.data.rocks[4],y=cove.sampleHeight(r.x,r.z)+.5;this.setPose([r.x-5,y,r.z],[r.x,y,r.z]);this.movePose([r.x+40,y,r.z],[r.x,y,r.z]);return;}const p=named[name];if(!p)throw Error('Unknown view');probe.visible=name.startsWith('probe');probe.position.set(0,0,3);this.setPose(p.eye,p.target);},setTime(v:number){time=v;render();},setTide(v:number){controls.tide=v;render();},setQuality(p:any){profile=p;water.setDetail(p);cove.setQuality(p);render();},metadata(){return {seed:7,time,profile,coveCreateMs,controls,diagnostics:water.diagnostics(),eye:camera.position.toArray(),backend:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],dpr:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls};},diagnostics(){return (water as any).diagnostics?.()??{};},water,cove,camera,scene,renderer,dynamic};
render();

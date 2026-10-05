import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {TurtleState} from './state';
import {turtleRotation} from './controller';
import {solveFrontFlipper,solveRearFlipper} from './crawl-pose';
import type {QualityProfile} from '../types';
export type TurtleView={group:THREE.Group;apply(state:TurtleState,dt:number):void;setQuality(profile:QualityProfile):void;dispose():void};
export async function createTurtleView(url:string,signal:AbortSignal):Promise<TurtleView>{
 const response=await fetch(url,{signal});if(!response.ok)throw Error('Turtle asset could not load.');
 const data=await response.arrayBuffer();if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const model=await new GLTFLoader().parseAsync(data,new URL('.',new URL(url,location.href)).href);
 const group=new THREE.Group();group.name='living-cove-player';group.add(model.scene);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
 model.scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}o.receiveShadow=true;}if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});
 const mixer=new THREE.AnimationMixer(model.scene),actions=model.animations.map(c=>mixer.clipAction(c));actions.forEach(a=>a.play());
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.6)');gradient.addColorStop(.55,'rgba(0,0,0,.3)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const shadowTexture=new THREE.CanvasTexture(canvas),shadowGeometry=new THREE.PlaneGeometry(1.12,1.48),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.65,depthWrite:true,alphaTest:.01,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false}),shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.name='turtle-contact-shadow';group.add(shadow);
 let disposed=false;
 const api:TurtleView={group,apply(state,_dt){if(disposed)return;group.position.set(state.position.x,state.position.y,state.position.z);model.scene.quaternion.copy(turtleRotation(state));
  const rest=state.restBlend,swim=state.transition;
  for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){material.roughness=THREE.MathUtils.lerp(.98,.76,swim);material.color.setScalar(1-.075*swim);}
  actions.forEach(a=>a.setEffectiveWeight(a.getClip().name==='Swim'?swim:a.getClip().name==='Crawl'?(1-rest)*(1-swim):rest*(1-swim)));
  actions.forEach(a=>{const duration=a.getClip().duration;a.time=((a.getClip().name==='Crawl'?state.crawlPhase:state.animationPhase)%duration+duration)%duration;});mixer.update(0);group.updateMatrixWorld(true);
  const body=model.scene.getObjectByName('Body')!;
  for(const foot of state.feet){const goal=body.worldToLocal(new THREE.Vector3(foot.position.x,foot.position.y,foot.position.z)),rear=foot.limb==='rear',pose=rear?solveRearFlipper(foot.side,goal):solveFrontFlipper(foot.side,goal),name=(rear?'Hind':'Front')+(foot.side<0?'L':'R');model.scene.getObjectByName(name)!.quaternion.slerp(pose.shoulder,1-swim);model.scene.getObjectByName(name+'Tip')!.quaternion.slerp(pose.tip,1-swim);}
  group.updateMatrixWorld(true);shadow.visible=state.previousLocomotion==='crawl';shadow.position.y=state.groundHeight-state.position.y+.008;
  shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(state.groundNormal.x,state.groundNormal.y,state.groundNormal.z));shadow.material.opacity=.62*(1-swim);
 },setQuality(profile){model.scene.getObjectByName('TurtleHigh')!.visible=profile!=='low';model.scene.getObjectByName('TurtleLow')!.visible=profile==='low';},dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model.scene);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());textures.forEach(t=>{t.dispose();const ownedImage=t.image as {close?:()=>void}|undefined;ownedImage?.close?.();});shadowGeometry.dispose();shadowMaterial.dispose();shadowTexture.dispose();group.clear();}};
 if(signal.aborted){api.dispose();throw new DOMException('Aborted','AbortError');}api.setQuality('balanced');return api;
}

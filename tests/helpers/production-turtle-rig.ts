import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {turtleRotation} from '../../src/turtle/controller';
import {solveFrontFlipper,solveRearFlipper} from '../../src/turtle/crawl-pose';
import type {TurtleState} from '../../src/turtle/state';
import type {QualityProfile} from '../../src/types';
export {default as productionTurtleManifest} from '../../assets/turtle/manifest.json';

// Original production hierarchy, indices, weights, inverse binds and animations.
// Texture decoding and GPU work are unnecessary for physical skin/contact tests.
const glb=readFileSync(new URL('../../public/assets/turtle.glb',import.meta.url)),jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.toString('utf8',20,20+jsonLength)),binaryStart=28+jsonLength;
function accessor(index:number){
 const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16} as Record<string,number>)[a.type],formats:Record<number,[number,string,number]>={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]},[size,read,scale]=formats[a.componentType],stride=v.byteStride??size*width,offset=binaryStart+(v.byteOffset??0)+(a.byteOffset??0);
 return Array.from({length:a.count*width},(_,i)=>(glb as any)[read](offset+Math.floor(i/width)*stride+i%width*size)/(a.normalized?scale:1));
}
export function createProductionTurtleRig(){
 const group=new THREE.Group(),model=new THREE.Group(),boneIndices=new Set<number>(gltf.skins.flatMap((skin:any)=>skin.joints)),meshes:THREE.SkinnedMesh[]=[];
 const nodes:THREE.Object3D[]=gltf.nodes.map((n:any,i:number)=>{
  let object:THREE.Object3D;
  if(n.mesh!==undefined){const primitive=gltf.meshes[n.mesh].primitives[0],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(accessor(primitive.attributes.POSITION),3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(accessor(primitive.attributes.JOINTS_0),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(accessor(primitive.attributes.WEIGHTS_0),4));geometry.setIndex(accessor(primitive.indices));const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());meshes.push(mesh);object=mesh;}
  else object=boneIndices.has(i)?new THREE.Bone():new THREE.Group();
  object.name=n.name;if(n.translation)object.position.fromArray(n.translation);if(n.rotation)object.quaternion.fromArray(n.rotation);if(n.scale)object.scale.fromArray(n.scale);return object;
 });
 gltf.nodes.forEach((n:any,i:number)=>n.children?.forEach((child:number)=>nodes[i].add(nodes[child])));group.add(model);model.add(nodes[0]);group.updateMatrixWorld(true);
 gltf.nodes.forEach((n:any,i:number)=>{if(n.skin===undefined)return;const skin=gltf.skins[n.skin],inverse=accessor(skin.inverseBindMatrices),skeleton=new THREE.Skeleton(skin.joints.map((id:number)=>nodes[id] as THREE.Bone),skin.joints.map((_:number,j:number)=>new THREE.Matrix4().fromArray(inverse,j*16)));(nodes[i] as THREE.SkinnedMesh).bind(skeleton,new THREE.Matrix4());});
 const mixer=new THREE.AnimationMixer(model),clips=gltf.animations.map((a:any)=>new THREE.AnimationClip(a.name,-1,a.channels.map((channel:any)=>{const sampler=a.samplers[channel.sampler],times=accessor(sampler.input),values=accessor(sampler.output),name=nodes[channel.target.node].name;return channel.target.path==='rotation'?new THREE.QuaternionKeyframeTrack(name+'.quaternion',times,values):new THREE.VectorKeyframeTrack(name+'.position',times,values);}))),actions:THREE.AnimationAction[]=clips.map((clip:THREE.AnimationClip)=>mixer.clipAction(clip));actions.forEach(a=>a.play());
 const api={group,meshes,apply(state:TurtleState,_dt=0){
  group.position.set(state.position.x,state.position.y,state.position.z);model.quaternion.copy(turtleRotation(state));
  actions.forEach(a=>{a.setEffectiveWeight(a.getClip().name==='Swim'?state.transition:a.getClip().name==='Crawl'?(1-state.restBlend)*(1-state.transition):state.restBlend*(1-state.transition));a.time=((a.getClip().name==='Crawl'?state.crawlPhase:state.animationPhase)%a.getClip().duration+a.getClip().duration)%a.getClip().duration;});mixer.update(0);group.updateMatrixWorld(true);
  const body=group.getObjectByName('Body')!;
  for(const foot of state.feet){const goal=body.worldToLocal(new THREE.Vector3(foot.position.x,foot.position.y,foot.position.z)),rear=foot.limb==='rear',pose=rear?solveRearFlipper(foot.side,goal):solveFrontFlipper(foot.side,goal),name=(rear?'Hind':'Front')+(foot.side<0?'L':'R');group.getObjectByName(name)!.quaternion.slerp(pose.shoulder,1-state.transition);group.getObjectByName(name+'Tip')!.quaternion.slerp(pose.tip,1-state.transition);}
  group.updateMatrixWorld(true);
 },setQuality(profile:QualityProfile){group.getObjectByName('TurtleHigh')!.visible=profile!=='low';group.getObjectByName('TurtleLow')!.visible=profile==='low';},dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);for(const mesh of meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.skeleton.dispose();}group.clear();}};
 api.setQuality('balanced');return api;
}

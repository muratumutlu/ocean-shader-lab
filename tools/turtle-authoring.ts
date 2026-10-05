import * as T from 'three';
import {crawlPad,rearPad,solveFrontFlipper,solveRearFlipper,crawlWeightShift} from '../src/turtle/crawl-pose';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {anatomyTextures,bodyAnatomy,carapaceAnatomy,flipperAnatomy,flipperClaws,facialAnatomy,anatomicalInfluences} from './turtle-anatomy';
export function createAuthoredTurtle(){
 const root=new T.Group();root.name='LivingCoveTurtle';
 const bone=(name:string,x:number,y:number,z:number,parent?:T.Bone)=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);parent?.add(b);return b;};
 const rig=bone('Root',0,0,0),body=bone('Body',0,0,0,rig),neck=bone('Neck',0,.01,.50,body),head=bone('Head',0,.012,.15,neck),fl=bone('FrontL',-.28,-.02,.32,body),fr=bone('FrontR',.28,-.02,.32,body),hl=bone('HindL',-.24,-.02,-.40,body),hr=bone('HindR',.24,-.02,-.40,body),tail=bone('Tail',0,-.014,-.54,body);
 const flTip=bone('FrontLTip',-.16,-.030,-.068,fl),frTip=bone('FrontRTip',.16,-.030,-.068,fr);
 const hlTip=bone('HindLTip',-.07,-.016,-.05,hl),hrTip=bone('HindRTip',.07,-.016,-.05,hr);
 const bones=[rig,body,neck,head,fl,fr,hl,hr,tail,flTip,frTip,hlTip,hrTip];root.add(rig);root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);
 const maps=anatomyTextures();
 const shellMat=new T.MeshStandardMaterial({map:maps.shellColor,normalMap:maps.shellNormal,normalScale:new T.Vector2(.60,.60),roughnessMap:maps.shellRoughness,roughness:.96,vertexColors:true}),bodyMat=new T.MeshStandardMaterial({map:maps.skinColor,normalMap:maps.skinNormal,normalScale:new T.Vector2(.48,.48),roughnessMap:maps.skinRoughness,roughness:.98,vertexColors:true});shellMat.name='CarettaRuddyBrownFifteenScuteCarapace';bodyMat.name='AnatomicalScaledSkinAndPlastron';
 const decorate=(g:T.BufferGeometry,boneId:number,color:T.Color)=>{
  const p=g.attributes.position,c:number[]=[],i:number[]=[],w:number[]=[];for(let k=0;k<p.count;k++){c.push(color.r,color.g,color.b);const blend=anatomicalInfluences(boneId,p.getX(k),p.getZ(k));i.push(...blend.indices);w.push(...blend.weights);}
  g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(i,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));return g;
 };
 for(const low of [false,true]){
  const lod=new T.Group();lod.name=low?'TurtleLow':'TurtleHigh';root.add(lod);const parts:T.BufferGeometry[]=[];
  parts.push(decorate(bodyAnatomy(low),-1,new T.Color(0xffffff)));
  for(const face of facialAnatomy(low))parts.push(decorate(face,3,new T.Color(0xffffff)));
  for(const sign of [-1,1]){
   parts.push(decorate(flipperAnatomy(sign,true,low),sign<0?4:5,new T.Color(0xffffff)));
   parts.push(decorate(flipperAnatomy(sign,false,low),sign<0?6:7,new T.Color(0xffffff)));
   for(const front of [true,false])for(const claw of flipperClaws(sign,front))parts.push(decorate(claw,front?(sign<0?4:5):(sign<0?6:7),new T.Color(0xffffff)));
  }
  const tg=new T.ConeGeometry(.026,.14,low?8:14);tg.rotateX(-Math.PI/2);tg.scale(1,.48,1);tg.translate(0,-.025,-.628);const tailUV=tg.attributes.uv;for(let k=0;k<tailUV.count;k++)tailUV.setXY(k,.60+tailUV.getX(k)*.20,.52+tailUV.getY(k)*.08);parts.push(decorate(tg,8,new T.Color(0xffffff)));
  const geo=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const skin=new T.SkinnedMesh(geo,bodyMat);skin.name=lod.name+'Body';skin.castShadow=skin.receiveShadow=true;lod.add(skin);
  const carapace=new T.SkinnedMesh(decorate(carapaceAnatomy(low),1,new T.Color(0xffffff)),shellMat);carapace.name=lod.name+'Shell';carapace.castShadow=carapace.receiveShadow=true;lod.add(carapace);
  root.updateMatrixWorld(true);skin.bind(skeleton);carapace.bind(skeleton);
 }
 const clips:T.AnimationClip[]=[];
 for(const name of ['Swim','Crawl','Idle']){
  const duration=name==='Swim'?2.4:name==='Crawl'?3.2:5,tracks:T.KeyframeTrack[]=[],times=Array.from({length:33},(_,i)=>i/32*duration);
  const rotations=(b:T.Bone,axis:'x'|'y'|'z',f:(phase:number)=>number)=>{
   const values:number[]=[];for(const t of times){const e=new T.Euler();e[axis]=f(t/duration*Math.PI*2);const q=new T.Quaternion().setFromEuler(e);values.push(q.x,q.y,q.z,q.w);}tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));
  };
  for(const [b,sign,front] of [[fl,-1,true],[fr,1,true],[hl,-1,false],[hr,1,false]] as const){
   const values:number[]=[];for(const t of times){const p=t/duration*Math.PI*2;
    if(name!=='Swim'){const phase=name==='Crawl'?t:0,q=front?solveFrontFlipper(sign,crawlPad(phase,sign)).shoulder:solveRearFlipper(sign,rearPad(phase,sign)).shoulder;values.push(q.x,q.y,q.z,q.w);continue;}
    const flap=name==='Swim'?sign*(Math.sin(p+(front?0:.6))*(front?.58:.10)+(front?.035:.02)):name==='Crawl'?sign*Math.max(0,Math.sin(p-.8))*.12:sign*Math.sin(p)*.009;
    const sweep=name==='Crawl'?sign*Math.sin(p-.3)*.22:sign*Math.sin(p+.6)*(front?.14:.035);
    const q=new T.Quaternion().setFromEuler(new T.Euler(0,sweep,flap));values.push(q.x,q.y,q.z,q.w);
   }tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));
  }
  for(const [b,sign,front] of [[flTip,-1,true],[frTip,1,true],[hlTip,-1,false],[hrTip,1,false]] as const){
   if(name==='Swim')rotations(b,'z',p=>sign*(front?.05:.025)*Math.sin(p-.6));
   else {const values:number[]=[];for(const t of times){const phase=name==='Crawl'?t:0,q=front?solveFrontFlipper(sign,crawlPad(phase,sign)).tip:solveRearFlipper(sign,rearPad(phase,sign)).tip;values.push(q.x,q.y,q.z,q.w);}tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));}
  }
  const bodyRotations:number[]=[];for(const t of times){const w=name==='Crawl'?crawlWeightShift(t):{pitch:0,roll:0},q=new T.Quaternion().setFromEuler(new T.Euler(w.pitch,name==='Crawl'?Math.sin(t/duration*Math.PI*2)*.028:0,w.roll));bodyRotations.push(q.x,q.y,q.z,q.w);}tracks.push(new T.QuaternionKeyframeTrack('Body.quaternion',times,bodyRotations));
  // A neutral raised rostrum lets the torso carry the body on an uphill beach.
  // Downward head pitch previously made the beak the highest support constraint.
  rotations(neck,'x',()=>name==='Swim'?0:.010);
  const headRotations:number[]=[];for(const t of times){const p=t/duration*Math.PI*2,q=new T.Quaternion().setFromEuler(new T.Euler(name==='Swim'?0:.020,Math.sin(p)*(name==='Swim'?.035:.016),0));headRotations.push(q.x,q.y,q.z,q.w);}tracks.push(new T.QuaternionKeyframeTrack('Head.quaternion',times,headRotations));rotations(tail,'y',p=>Math.sin(p-.4)*.05);
  const positions:number[]=[];for(const t of times)positions.push(name==='Crawl'?crawlWeightShift(t).shift:0,name==='Swim'?.22+Math.sin(t/duration*Math.PI*2)*.005:name==='Crawl'?crawlWeightShift(t).lift:0,0);
  tracks.push(new T.VectorKeyframeTrack('Body.position',times,positions));clips.push(new T.AnimationClip(name,duration,tracks));
 }
 // Keep low LOD available to exporter; runtime adapter chooses one.
 return {root,clips,skeleton};
}
export async function buildTurtleAsset():Promise<ArrayBuffer>{const {root,clips}=createAuthoredTurtle();return await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false,maxTextureSize:1024}) as ArrayBuffer;}
(window as any).__turtleAuthor={ready:true,build:async()=>{const b=new Uint8Array(await buildTurtleAsset());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}};

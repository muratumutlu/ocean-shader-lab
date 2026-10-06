import * as THREE from 'three';
import {crawlLimbPhase,CRAWL_DURATION,CRAWL_FRONT_LIFT,CRAWL_REAR_LIFT,type CrawlFoot} from '../turtle/crawl-pose';
import {turtleRotation} from '../turtle/controller';
import type {TurtleState} from '../turtle/state';
import type {TurtleView} from '../turtle/view';
import type {TurtleAssetInfo} from '../turtle/asset';
import type {Vec3} from '../scene/cove-data';

export const PRODUCTION_CONTACT_MOTION_PROFILE=Object.freeze({
 assetFileSha256:'aac6c43d7238a3035f57efdd57b71385249c861ede3e9f7dfb18983d384cade4',
 frontStance:.58,rearStance:.28,frontLift:CRAWL_FRONT_LIFT,rearLift:CRAWL_REAR_LIFT,
 maxStanceCorrection:.012,maxRecoveryCorrection:.04,maxRestCorrection:.04,targetGap:.003,
});
export type TurtleSkinContact=Readonly<{key:string;plantId:string;limb:'front'|'rear';side:-1|1;position:Readonly<Vec3>;skinPosition:Readonly<Vec3>;heading:number;gap:number;minimumLimbGap:number;samples:number;stance:boolean}>;
export type TurtleContactFrame=Readonly<{time:number;tide:number;paused:boolean;discontinuity:boolean;contacts:readonly TurtleSkinContact[]}>;
type Options={view:Pick<TurtleView,'group'|'apply'>;cove:{sampleHeight(x:number,z:number):number};asset:TurtleAssetInfo};
type LimbCache={mesh:THREE.SkinnedMesh;affected:number[];patch:number[]};
type Measurement={gap:number;minimum:number;position:THREE.Vector3;heading:number;samples:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const keyOf=(foot:CrawlFoot)=>(foot.limb==='rear'?'rear':'front')+foot.side;
const component=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,i:number,k:number)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
const copyPoint=(p:Vec3)=>Object.freeze({x:p.x,y:p.y,z:p.z});
const visible=(o:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;};
/** Zero lift velocity at touchdown/liftoff, preserving the original peak lift. */
export const smoothRecoveryArc=(u:number)=>Math.sin(Math.PI*clamp(u,0,1))**2;

/** A copied-foot-goal wrapper around the original view. It never assigns controller
 * state, root transforms, animation clocks or world anchors. Call sampleContacts
 * AFTER any routine overlay, so imprints describe the pose that will be rendered.
 */
export function createTurtleContactMotion({view,cove,asset}:Options){
 const profile=PRODUCTION_CONTACT_MOTION_PROFILE,cache=new Map<string,LimbCache[]>();
 const identity=(asset as TurtleAssetInfo&{fileSha256?:string}).fileSha256===profile.assetFileSha256;
 for(const limb of ['front','rear'] as const)for(const side of [-1,1] as const){
  const name=(limb==='front'?'Front':'Hind')+(side<0?'L':'R'),entries:LimbCache[]=[];
  view.group.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||!/^Turtle(?:High|Low)Body$/.test(o.name))return;
   const joints=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight');if(!joints||!weights)return;
   const affected:number[]=[],patch:number[]=[];
   for(let i=0;i<joints.count;i++){let influence=0,tip=0;for(let k=0;k<4;k++){const n=o.skeleton.bones[component(joints,i,k)]?.name,w=component(weights,i,k);if(n===name||n===name+'Tip')influence+=w;if(n===name+'Tip')tip+=w;}if(influence>1e-4)affected.push(i);if(tip>=.6)patch.push(i);}
   if(affected.length&&patch.length)entries.push({mesh:o,affected,patch});
  });cache.set(limb+side,entries);
 }
 const ready=identity&&[...cache.values()].every(entries=>entries.length>0);
 let disposed=false,paused=false,previousTime:number|null=null,previousPosition:Vec3|null=null,acceptedCorrections=0,rejectedCorrections=0,lastRecoveryCorrection=0,lastStanceCorrection=0,lastRestCorrection=0,groundedSeconds=0;
 let measurements:readonly Readonly<{key:string;gap:number;minimumLimbGap:number;samples:number;accepted:boolean}>[]=Object.freeze([]);
 let lastFrame:TurtleContactFrame=Object.freeze({time:0,tide:0,paused:false,discontinuity:true,contacts:Object.freeze([])});
 const touching=new Set<string>(),point=new THREE.Vector3();
 function measure(key:string):Measurement|null{
  let minimum=Infinity,gap=Infinity;const vertices:{position:THREE.Vector3;gap:number}[]=[];
  for(const entry of cache.get(key)??[]){if(!visible(entry.mesh))continue;
   for(const index of entry.affected){entry.mesh.getVertexPosition(index,point);point.applyMatrix4(entry.mesh.matrixWorld);minimum=Math.min(minimum,point.y-cove.sampleHeight(point.x,point.z));}
   for(const index of entry.patch){entry.mesh.getVertexPosition(index,point);point.applyMatrix4(entry.mesh.matrixWorld);const height=point.y-cove.sampleHeight(point.x,point.z);gap=Math.min(gap,height);vertices.push({position:point.clone(),gap:height});}
  }
  if(!Number.isFinite(gap+minimum))return null;
  const support=vertices.filter(v=>v.gap<=gap+.004),position=new THREE.Vector3();for(const vertex of support)position.add(vertex.position);position.multiplyScalar(1/support.length);
  const side=key.endsWith('-1')?-1:1,rear=key.startsWith('rear'),tip=view.group.getObjectByName((rear?'Hind':'Front')+(side<0?'L':'R')+'Tip')!,axis=new THREE.Vector3(side*(rear?.23:.40),rear?-.054:-.075,rear?-.16:-.192).transformDirection(tip.matrixWorld);
  return {gap,minimum,position,heading:Math.atan2(axis.x,axis.z),samples:support.length};
 }
 function apply(state:TurtleState,dt:number,options:{poseEnabled?:boolean}={}){
  if(disposed)return;view.apply(state,dt);lastRecoveryCorrection=lastStanceCorrection=lastRestCorrection=0;
  // The legacy view slerps partial IK from current bones. Re-evaluating it at
  // an unchanged animation phase can compound that blend, so corrections start
  // only after the transition reaches exactly grounded; ramp in without a snap.
  if(!ready||options.poseEnabled===false||state.previousLocomotion!=='crawl'||state.transition!==0){groundedSeconds=0;return;}
  if(!paused&&Number.isFinite(dt)&&dt>0)groundedSeconds=Math.min(.25,groundedSeconds+Math.min(.1,dt));
  if(groundedSeconds===0)return;
  view.group.updateMatrixWorld(true);
  const originals=new Map<string,Measurement>(),fade=THREE.MathUtils.smoothstep(groundedSeconds,0,.25),rest=1-clamp(state.restBlend,0,1),rotation=turtleRotation(state);let changed=false;
  const feet=state.feet.map(foot=>{
   const key=keyOf(foot),baseline=measure(key);if(!baseline)return foot;originals.set(key,baseline);
   const position={...foot.position};let deltaY=0,deltaX=0,deltaZ=0;
   if(foot.stance){deltaY=clamp(profile.targetGap-baseline.gap,-profile.maxStanceCorrection,profile.maxStanceCorrection)*fade;lastStanceCorrection=Math.max(lastStanceCorrection,Math.abs(deltaY));}
   else if(rest>0){
    const rear=foot.limb==='rear',stance=(rear?profile.rearStance:profile.frontStance)*CRAWL_DURATION,p=crawlLimbPhase(state.crawlPhase,foot.side);
    if(p>=stance){const u=(p-stance)/(CRAWL_DURATION-stance),difference=(smoothRecoveryArc(u)-Math.sin(Math.PI*u))*rest*fade;
     deltaY=(rear?profile.rearLift:profile.frontLift)*difference;
     const lateral=new THREE.Vector3(foot.side*(rear?.025:.045)*difference,0,0).applyQuaternion(rotation);deltaX=lateral.x;deltaZ=lateral.z;
     lastRecoveryCorrection=Math.max(lastRecoveryCorrection,Math.hypot(deltaX,deltaY,deltaZ));
    }
   }
   if(Math.hypot(deltaX,deltaY,deltaZ)<1e-6)return foot;
   position.x+=deltaX;position.y+=deltaY;position.z+=deltaZ;changed=true;return {...foot,position};
  });
  const applyFeet=()=>{view.apply({...state,feet},0);view.group.updateMatrixWorld(true);};
  if(changed){
   // IK still runs in the original view against the original animated Body frame.
   applyFeet();let rejected=false;
   for(let i=0;i<feet.length;i++){if(feet[i]===state.feet[i])continue;const key=keyOf(feet[i]),before=originals.get(key)!,after=measure(key);
    if(!after||after.minimum<Math.min(.002,before.minimum)-.0005){feet[i]=state.feet[i];rejectedCorrections++;rejected=true;}else acceptedCorrections++;
   }
   if(rejected)applyFeet();
  }
  // Rest lowers recovery goals while the animated body also settles. The old
  // no-worsening guard cannot repair a baseline that already intersects sand.
  // Keep measured clearance through the recovery -> rested-stance handoff;
  // ordinary moving poses (restBlend=0) retain the original correction path.
  const restLift=profile.maxRestCorrection*clamp(state.restBlend,0,1)*fade;
  if(restLift<1e-6)return;
  for(let i=0;i<feet.length;i++){
   const foot=feet[i],original=state.feet[i],key=keyOf(foot),before=measure(key);
   if(!before||before.minimum>=profile.targetGap-.0005)continue;
   const dx=foot.position.x-original.position.x,dz=foot.position.z-original.position.z;
   // Bound the COMPLETE copied-goal displacement, including recovery smoothing.
   const remaining=profile.maxRestCorrection**2*fade**2-dx*dx-dz*dz;
   if(remaining<=0)continue;
   let low=foot.position.y,high=Math.min(low+restLift,original.position.y+Math.sqrt(remaining));
   if(high<=low+1e-6)continue;
   const probe=(y:number)=>{feet[i]={...foot,position:{...foot.position,y}};applyFeet();return measure(key);};
   const upper=probe(high);
   if(!upper||upper.minimum<profile.targetGap){feet[i]=foot;applyFeet();rejectedCorrections++;continue;}
   let best=feet[i];
   // A bounded search avoids assuming a metre of IK-goal lift is a metre of
   // skin clearance on sloped sand. Retain the lowest verified clear pose.
   for(let step=0;step<8;step++){
    const middle=(low+high)/2,result=probe(middle);
    if(result&&result.minimum>=profile.targetGap){high=middle;best=feet[i];}else low=middle;
   }
   feet[i]=best;applyFeet();const settled=measure(key);
   // A proximal vertex clearing terrain must not leave a planted pad floating.
   if(!settled||settled.minimum<profile.targetGap||original.stance&&settled.gap>.012){feet[i]=foot;applyFeet();rejectedCorrections++;continue;}
   acceptedCorrections++;
   const correction=Math.hypot(dx,best.position.y-original.position.y,dz);
   lastRestCorrection=Math.max(lastRestCorrection,correction);
   if(!original.stance)lastRecoveryCorrection=Math.max(lastRecoveryCorrection,correction);
  }
 }
 function sampleContacts(state:TurtleState,time:number,tide:number):TurtleContactFrame{
  if(disposed)return lastFrame;
  const finite=Number.isFinite(time+tide+state.position.x+state.position.y+state.position.z),elapsed=previousTime===null?0:time-previousTime;
  const jump=previousPosition?Math.hypot(state.position.x-previousPosition.x,state.position.y-previousPosition.y,state.position.z-previousPosition.z):0;
  const discontinuity=previousTime===null||elapsed<0||elapsed>.2||jump>.35||!finite;
  if(discontinuity)touching.clear();
  const currentFeet=new Set(state.feet.map(keyOf));for(const key of touching)if(!currentFeet.has(key))touching.delete(key);
  const contacts:TurtleSkinContact[]=[],observed:{key:string;gap:number;minimumLimbGap:number;samples:number;accepted:boolean}[]=[];view.group.updateMatrixWorld(true);
  if(!disposed&&ready&&finite&&state.previousLocomotion==='crawl'&&state.transition<=.35){
   for(const foot of state.feet){const key=keyOf(foot),sample=measure(key),limit=touching.has(key)?.012:.008;
    const accepted=!!sample&&sample.gap>=-.002&&sample.minimum>=-.002&&sample.gap<=limit&&cove.sampleHeight(sample.position.x,sample.position.z)>tide+.08;
    if(sample)observed.push(Object.freeze({key,gap:sample.gap,minimumLimbGap:sample.minimum,samples:sample.samples,accepted}));
    if(!accepted||!sample){touching.delete(key);continue;}
    touching.add(key);contacts.push(Object.freeze({key,plantId:foot.plantId,limb:foot.limb==='rear'?'rear':'front',side:foot.side,position:copyPoint({x:sample.position.x,y:cove.sampleHeight(sample.position.x,sample.position.z),z:sample.position.z}),skinPosition:copyPoint(sample.position),heading:sample.heading,gap:sample.gap,minimumLimbGap:sample.minimum,samples:sample.samples,stance:foot.stance}));
   }
  }else touching.clear();
  if(finite){previousTime=time;previousPosition={...state.position};}
  measurements=Object.freeze(observed);lastFrame=Object.freeze({time:finite?time:lastFrame.time,tide:finite?tide:lastFrame.tide,paused,discontinuity,contacts:Object.freeze(contacts)});return lastFrame;
 }
 return {apply,sampleContacts,setPaused(value:boolean){if(!disposed)paused=value;},reset(){if(disposed)return;touching.clear();previousTime=null;previousPosition=null;acceptedCorrections=rejectedCorrections=lastRecoveryCorrection=lastStanceCorrection=lastRestCorrection=groundedSeconds=0;measurements=Object.freeze([]);lastFrame=Object.freeze({time:0,tide:0,paused,discontinuity:true,contacts:Object.freeze([])});},diagnostics(){return {ready,identity,paused,disposed,acceptedCorrections,rejectedCorrections,lastRecoveryCorrection,lastStanceCorrection,lastRestCorrection,groundedSeconds,measurements,frame:lastFrame};},dispose(){if(disposed)return;disposed=true;cache.clear();touching.clear();previousTime=null;previousPosition=null;measurements=Object.freeze([]);lastFrame=Object.freeze({...lastFrame,paused:true,discontinuity:true,contacts:Object.freeze([])});}};
}

import {afterAll,describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createProductionTurtleRig,productionTurtleManifest as asset} from '../helpers/production-turtle-rig';
import {createTurtleContactMotion,PRODUCTION_CONTACT_MOTION_PROFILE} from '../../src/runtime/turtle-contact-motion';
import {createTurtleController} from '../../src/turtle/controller';
import {createPhysicsWorld} from '../../src/physics/world';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import type {CoveResources} from '../../src/scene/cove';
import type {TurtleState} from '../../src/turtle/state';
import type {InputSnapshot} from '../../src/input/mode-controller';

// Recorded current-GLB capture: gait-review-2026-10-06T11-42-18.772Z.
// Only checkpoint numbers are retained here; tests do not depend on ignored QA files.
const CURRENT_GLB='aac6c43d7238a3035f57efdd57b71385249c861ede3e9f7dfb18983d384cade4';
const checkpoints={
 30:{setupFrames:388,stopPosition:[1.32218337059021,.9355429787712097,-5.947767734527588],phase:13.7590899590413,restBlend:.8111243971624383,unwrappedRearGap:-.007471417582272211},
 60:{setupFrames:775,stopPosition:[1.3189769983291626,.9325482626037598,-5.935891628265381],phase:13.72233719667682,restBlend:.8220389327966945,unwrappedRearGap:-.009461760718050716},
} as const;
const data=createCoveData(7),cove={
 data,sampleHeight:(x:number,z:number)=>sampleGrid(data,x,z),
 sampleNormal:(x:number,z:number)=>{
  const dx=(sampleGrid(data,x+.1,z)-sampleGrid(data,x-.1,z))/.2,dz=(sampleGrid(data,x,z+.1)-sampleGrid(data,x,z-.1))/.2,length=Math.hypot(dx,1,dz);
  return {x:-dx/length,y:1/length,z:-dz/length};
 },
};
const forward={x:0,y:0,z:-1},turnForward={x:.5,y:0,z:-Math.sqrt(.75)};
const moving:InputSnapshot={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};
const stopped:InputSnapshot={...moving,forward:0,active:false};
type Hz=30|60;
type Frame={segment:'setup'|'straight'|'turn'|'stop'|'settled'|'restart';time:number;state:TurtleState};
type Rig=ReturnType<typeof createProductionTurtleRig>;
const replays=new Map<Hz,Promise<Frame[]>>();
const diagnostics:unknown[]=[];
afterAll(()=>{
 const path=process.env.TURTLE_STOP_DIAGNOSTICS;
 if(path)writeFileSync(path,JSON.stringify({
  runtimeSha256:createHash('sha256').update(readFileSync('src/runtime/turtle-contact-motion.ts')).digest('hex'),
  assetSha256:CURRENT_GLB,results:diagnostics,
 },null,2)+'\n');
});

async function replay(hz:Hz){
 let cached=replays.get(hz);if(cached)return cached;
 cached=(async()=>{
  const world=await createPhysicsWorld(data),controller=createTurtleController(cove as CoveResources,world,asset.proxy,asset);
  const frames:Frame[]=[];let time=0;
  const update=(segment:Frame['segment'],input=moving,basis=forward)=>{
   for(let i=0;i<60/hz;i++)controller.step(input,basis,0,1/60);
   time+=1/hz;frames.push({segment,time,state:structuredClone(controller.state)});
  };
  try{
   for(let i=0;i<checkpoints[hz].setupFrames;i++)update('setup');
   const initialPhase=controller.state.crawlPhase;
   for(let i=0;controller.state.crawlPhase-initialPhase<6.4;i++){
    if(i>=hz*18)throw Error('Could not replay two straight gait cycles');
    update('straight');
   }
   for(let i=0;i<hz;i++)update('turn',moving,turnForward);
   // Matches the captured 1.8-second stop, then continues through full rest.
   for(let i=0;i<Math.ceil(hz*1.8);i++)update('stop',stopped);
   for(let i=0;i<hz*2;i++)update('settled',stopped);
   const restartPhase=controller.state.crawlPhase;
   for(let i=0;controller.state.crawlPhase-restartPhase<6.4;i++){
    if(i>=hz*18)throw Error('Could not replay two moving cycles after full rest');
    update('restart');
   }
   return frames;
  }finally{controller.dispose();world.dispose();}
 })();replays.set(hz,cached);return cached;
}

const boneName=(limb:'front'|'rear',side:-1|1)=>(limb==='front'?'Front':'Hind')+(side<0?'L':'R');
const keyOf=(foot:TurtleState['feet'][number])=>(foot.limb==='rear'?'rear':'front')+foot.side;
// Independent test-side scan of every influenced vertex. It never consults the
// adapter's accepted-contact array and therefore includes rejected recovery skin.
function skinProbe(rig:Rig,quality:'high'|'low'){
 const mesh=rig.meshes.find(mesh=>mesh.name===(quality==='high'?'TurtleHighBody':'TurtleLowBody'))!;
 const position=mesh.geometry.getAttribute('position'),weights=mesh.geometry.getAttribute('skinWeight'),joints=mesh.geometry.getAttribute('skinIndex');
 const groups=new Map<string,{indices:number[];pad:Set<number>}>();
 for(const limb of ['front','rear'] as const)for(const side of [-1,1] as const){
  const name=boneName(limb,side),indices:number[]=[],pad=new Set<number>();
  for(let i=0;i<position.count;i++){
   let influence=0,tipInfluence=0;
   for(let k=0;k<4;k++){
    const joint=joints.getComponent(i,k),weight=weights.getComponent(i,k),n=mesh.skeleton.bones[joint].name;
    if(n===name||n===name+'Tip')influence+=weight;
    if(n===name+'Tip')tipInfluence+=weight;
   }
   if(influence>0)indices.push(i);
   if(tipInfluence>=.6)pad.add(i);
  }
  expect(indices.length).toBeGreaterThan(30);expect(pad.size).toBeGreaterThan(0);groups.set(limb+side,{indices,pad});
 }
 const point=new THREE.Vector3();
 return ()=>{
  rig.group.updateMatrixWorld(true);
  const result=new Map<string,{minimum:number;padMinimum:number;vertex:number;point:number[];sampleCount:number;padSamples:number}>();
  for(const [key,{indices,pad}] of groups){
   let minimum=Infinity,padMinimum=Infinity,vertex=-1,lowest:number[]=[];
   for(const index of indices){
    point.fromBufferAttribute(position,index);mesh.applyBoneTransform(index,point);point.applyMatrix4(mesh.matrixWorld);
    const gap=point.y-cove.sampleHeight(point.x,point.z);
    if(gap<minimum){minimum=gap;vertex=index;lowest=point.toArray();}
    if(pad.has(index))padMinimum=Math.min(padMinimum,gap);
   }
   result.set(key,{minimum,padMinimum,vertex,point:lowest,sampleCount:indices.length,padSamples:pad.size});
  }
  return result;
 };
}
function endpoint(rig:Rig,foot:TurtleState['feet'][number]){
 const rear=foot.limb==='rear',bone=rig.group.getObjectByName(boneName(rear?'rear':'front',foot.side)+'Tip')!;
 return bone.localToWorld(new THREE.Vector3(foot.side*(rear?.23:.40),rear?-.054:-.075,rear?-.16:-.192));
}

describe('production turtle clearance during stopping and full rest',()=>{
 it('pins the real production binary and reconstructs the recorded unwrapped stop defect',async()=>{
  expect(createHash('sha256').update(readFileSync('public/assets/turtle.glb')).digest('hex')).toBe(CURRENT_GLB);
  expect(asset.fileSha256).toBe(CURRENT_GLB);expect(PRODUCTION_CONTACT_MOTION_PROFILE.assetFileSha256).toBe(CURRENT_GLB);
  const view=createProductionTurtleRig(),measure=skinProbe(view,'high');
  try{
   for(const hz of [30,60] as const){
    const frames=await replay(hz),state=frames.filter(f=>f.segment==='stop').at(-1)!.state,record=checkpoints[hz];
    expect([state.position.x,state.position.y,state.position.z]).toEqual(record.stopPosition);
    expect(state.crawlPhase).toBeCloseTo(record.phase,10);expect(state.restBlend).toBeCloseTo(record.restBlend,10);
    expect(state.feet.find(f=>keyOf(f)==='rear1')).toMatchObject({plantId:'25',stance:false});
    view.apply(state,0);const skin=measure(),rear=skin.get('rear1')!;
    diagnostics.push({kind:'unwrapped-recorded-stop',hz,state,skin:Object.fromEntries(skin)});
    expect(rear.minimum).toBeCloseTo(record.unwrappedRearGap,7);
    expect(rear.minimum).toBeLessThan(-.007);
   }
  }finally{view.dispose();}
 },15000);

 for(const hz of [30,60] as const)for(const quality of ['high','low'] as const){
  it(hz+'Hz '+quality+' keeps every skinned limb clear through stopping, full rest and two restart cycles',async()=>{
   const frames=await replay(hz),view=createProductionTurtleRig(),reference=createProductionTurtleRig();
   view.setQuality(quality);reference.setQuality(quality);
   const scan=skinProbe(view,quality),scanReference=skinProbe(reference,quality);
   let expected:TurtleState|null=null,maximumGoalCorrection=0,maximumStanceGoalXZ=0,viewApplyCalls=0;
   const motion=createTurtleContactMotion({cove,asset,view:{group:view.group,apply(candidate,dt){
    viewApplyCalls++;
    if(expected)for(let i=0;i<candidate.feet.length;i++){
     const original=expected.feet[i],goal=candidate.feet[i].position;
     expect(Number.isFinite(goal.x+goal.y+goal.z)).toBe(true);
     const distance=Math.hypot(goal.x-original.position.x,goal.y-original.position.y,goal.z-original.position.z);
     maximumGoalCorrection=Math.max(maximumGoalCorrection,distance);
     if(original.stance)maximumStanceGoalXZ=Math.max(maximumStanceGoalXZ,Math.hypot(goal.x-original.position.x,goal.z-original.position.z));
    }
    view.apply(candidate,dt);
   }}});
   const minimumBySegment=new Map<string,number>(),violations:unknown[]=[];
   const timingBySegment=new Map<Frame['segment'],{milliseconds:number;viewApplyCalls:number}[]>();
   let maximumStancePadGap=-Infinity,maximumStanceEndpointMovement=0,reachableStanceComparisons=0,groundedFrames=0,straightFrames=0,restartFrames=0,stanceCount=0,settled=false;
   try{
    expect(motion.diagnostics().ready).toBe(true);
    for(const frame of frames){
     const state=frame.state,unchanged=JSON.stringify(state);expected=state;
     reference.apply(state,1/hz);
     const baseline=state.previousLocomotion==='crawl'&&state.transition===0?scanReference():null;
     const planted=state.feet.filter(f=>f.stance).map(foot=>({foot,before:endpoint(reference,foot)}));
     const callsBefore=viewApplyCalls,started=performance.now();
     motion.apply(state,1/hz);
     const timing=timingBySegment.get(frame.segment)??[];
     timing.push({milliseconds:performance.now()-started,viewApplyCalls:viewApplyCalls-callsBefore});timingBySegment.set(frame.segment,timing);
     motion.sampleContacts(state,frame.time,0);
     expect(JSON.stringify(state)).toBe(unchanged);
     // Check the final frame after the wrapper's accepted/rejected corrections,
     // not a rejected candidate and not the filtered list of track contacts.
     if(frame.segment==='setup'||state.transition!==0||state.previousLocomotion!=='crawl')continue;
     const measured=scan();groundedFrames++;if(frame.segment==='straight')straightFrames++;if(frame.segment==='restart')restartFrames++;
     for(const [key,result] of measured){
      expect(Number.isFinite(result.minimum)&&Number.isFinite(result.padMinimum)).toBe(true);
      minimumBySegment.set(frame.segment,Math.min(minimumBySegment.get(frame.segment)??Infinity,result.minimum));
      if(result.minimum<-.002)violations.push({segment:frame.segment,time:frame.time,key,gap:result.minimum,restBlend:state.restBlend,baselineGap:baseline!.get(key)!.minimum,stance:state.feet.find(f=>keyOf(f)===key)?.stance});
      if(state.feet.find(f=>keyOf(f)===key)?.stance){maximumStancePadGap=Math.max(maximumStancePadGap,result.padMinimum);stanceCount++;}
     }
     for(const {foot,before} of planted){
      if(Math.hypot(before.x-foot.position.x,before.z-foot.position.z)<.002){
       reachableStanceComparisons++;
       const actual=endpoint(view,foot);
       maximumStanceEndpointMovement=Math.max(maximumStanceEndpointMovement,Math.hypot(actual.x-before.x,actual.z-before.z));
      }
     }
     // Pose correction must remain local to limbs, preserving the body's real
     // animated weight transfer, head and root during ordinary crawl and rest.
     for(const name of ['Body','Neck','Head']){
      const a=view.group.getObjectByName(name)!,b=reference.group.getObjectByName(name)!;
      expect(a.position.toArray()).toEqual(b.position.toArray());expect(a.quaternion.toArray()).toEqual(b.quaternion.toArray());
      expect(a.matrixWorld.elements).toEqual(b.matrixWorld.elements);
     }
     expect(view.group.matrixWorld.elements).toEqual(reference.group.matrixWorld.elements);
     if(frame.segment==='settled'&&state.restBlend>.995){
      settled=true;expect(state.feet.every(f=>f.stance)).toBe(true);
     }
    }
    const summary=(values:number[])=>{
     const sorted=[...values].sort((a,b)=>a-b);
     return {count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};
    };
    const timing=Object.fromEntries([...timingBySegment].map(([segment,samples])=>[segment,{
     motionApplyMilliseconds:summary(samples.map(s=>s.milliseconds)),viewApplyCalls:summary(samples.map(s=>s.viewApplyCalls)),
    }]));
    const restartPhaseSpan=frames.at(-1)!.state.crawlPhase-frames.filter(f=>f.segment==='settled').at(-1)!.state.crawlPhase;
    diagnostics.push({kind:'wrapped-sequence',hz,quality,groundedFrames,straightFrames,restartFrames,restartPhaseSpan,finalRestBlend:frames.at(-1)!.state.restBlend,minimumBySegment:Object.fromEntries(minimumBySegment),maximumStancePadGap,maximumGoalCorrection,maximumStanceGoalXZ,maximumStanceEndpointMovement,reachableStanceComparisons,settled,violationCount:violations.length,violations,
     timingNote:'Node test-proxy CPU only, including candidate-call invariant assertions; excludes final sampleContacts, independent scans, rendering and GPU. viewApplyCalls includes the original view call and all candidate/rejection evaluations. Diagnostic only; no performance assertion.',timing});
    expect(groundedFrames).toBeGreaterThan(hz*14);expect(straightFrames).toBeGreaterThan(hz*6);
    expect(restartFrames).toBeGreaterThan(hz*6);expect(restartPhaseSpan).toBeGreaterThanOrEqual(6.4);
    expect(frames.at(-1)!.state.restBlend,'restart must cover the return to ordinary moving gait').toBeLessThan(1e-6);
    expect(settled).toBe(true);expect(stanceCount).toBeGreaterThan(hz*4);
    expect(reachableStanceComparisons,'reachable planted endpoints must actually be checked').toBeGreaterThan(hz*2);
    expect(maximumGoalCorrection,'bounded copied-foot correction envelope').toBeLessThanOrEqual(.04+1e-8);
    expect(maximumStanceGoalXZ,'controller stance anchors must remain fixed in XZ').toBeLessThan(1e-10);
    expect(maximumStanceEndpointMovement,'reachable planted endpoint must remain fixed in XZ').toBeLessThan(.002);
    expect(maximumStancePadGap,'distal stance pad must remain near terrain even if proximal skin touches').toBeLessThanOrEqual(.012);
    expect(Math.min(...minimumBySegment.values()),'all weighted limb skin must remain above the -2mm floor, including rejected contacts').toBeGreaterThanOrEqual(-.002);
   }finally{motion.dispose();view.dispose();reference.dispose();}
  },30000);
 }
});

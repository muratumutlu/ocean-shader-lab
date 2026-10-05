import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createTurtleRoutine,PRODUCTION_TURTLE_ROUTINE_PROFILE} from '../../src/runtime/turtle-activities';
import {createContactTrails} from '../../src/turtle/contact-trails';
import {createTurtleContactMotion,smoothRecoveryArc} from '../../src/runtime/turtle-contact-motion';
import {createProductionTurtleRig,productionTurtleManifest as asset} from '../helpers/production-turtle-rig';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import {createPhysicsWorld} from '../../src/physics/world';
import {createTurtleController} from '../../src/turtle/controller';
import type {TurtleState} from '../../src/turtle/state';
const data=createCoveData(7),cove={data,sampleHeight:(x:number,z:number)=>sampleGrid(data,x,z),sampleNormal:(x:number,z:number)=>{const dx=(sampleGrid(data,x+.1,z)-sampleGrid(data,x-.1,z))/.2,dz=(sampleGrid(data,x,z+.1)-sampleGrid(data,x,z-.1))/.2,n=Math.hypot(dx,1,dz);return{x:-dx/n,y:1/n,z:-dz/n};}};
const input={mode:'turtle' as const,forward:1,right:0,vertical:0,fast:false,active:true,pointerActive:false};
let states:TurtleState[]|null=null;
async function walkingStates(){
 if(states)return states;const world=await createPhysicsWorld(data),controller=createTurtleController(cove as any,world,asset.proxy,asset);states=[];
 try{for(let i=0;i<2000;i++){controller.step(input,{x:0,y:0,z:-1},0,1/60);if(controller.state.previousLocomotion==='crawl'&&controller.state.transition<.01&&controller.state.position.z< -3&&i%5===0)states.push(structuredClone(controller.state));if(states.length>=90)break;}return states;}finally{controller.dispose();world.dispose();}
}
describe('actual posed turtle contact motion',()=>{
 it('settles actual high/low skinned stance pads without moving controller anchors and never worsens skin penetration',async()=>{
  const poses=await walkingStates();expect(poses.length).toBeGreaterThan(30);const view=createProductionTurtleRig(),motion=createTurtleContactMotion({view,cove,asset});expect(motion.diagnostics().ready).toBe(true);
  try{let improved=0,contacts=0,recovery=0;
   for(const quality of ['high','low'] as const){view.setQuality(quality);for(const [i,state] of poses.entries()){
    const before=JSON.stringify(state);view.apply(state,1/60);motion.sampleContacts(state,i/12,0);const original=motion.diagnostics().measurements;
    const endpoints=state.feet.filter(f=>f.stance).map(f=>{const rear=f.limb==='rear',bone=view.group.getObjectByName((rear?'Hind':'Front')+(f.side<0?'L':'R')+'Tip')!,local=new THREE.Vector3(f.side*(rear?.23:.40),rear?-.054:-.075,rear?-.16:-.192);return {foot:f,bone,local,before:bone.localToWorld(local.clone())};});
    motion.apply(state,1/60);const frame=motion.sampleContacts(state,i/12,0),after=motion.diagnostics();expect(JSON.stringify(state)).toBe(before);
    for(const endpoint of endpoints){const moved=endpoint.bone.localToWorld(endpoint.local.clone()),originalDistance=Math.hypot(endpoint.before.x-endpoint.foot.position.x,endpoint.before.z-endpoint.foot.position.z);if(originalDistance<.002)expect(Math.hypot(moved.x-endpoint.before.x,moved.z-endpoint.before.z),'planted endpoint XZ moved').toBeLessThan(.002);}
    for(const sample of after.measurements){const base=original.find(m=>m.key===sample.key)!;expect(sample.minimumLimbGap).toBeGreaterThanOrEqual(Math.min(.002,base.minimumLimbGap)-.000501);const stance=state.feet.find(f=>(f.limb==='rear'?'rear':'front')+f.side===sample.key)?.stance;if(stance&&base.gap>.008&&sample.gap<.006)improved++;}
    contacts+=frame.contacts.length;recovery=Math.max(recovery,after.lastRecoveryCorrection);
    for(const contact of frame.contacts){expect(contact.gap).toBeGreaterThanOrEqual(-.002);expect(contact.gap).toBeLessThanOrEqual(.012);expect(contact.minimumLimbGap).toBeGreaterThanOrEqual(-.002);expect(contact.samples).toBeGreaterThan(0);}
   }}
   expect(improved).toBeGreaterThan(10);expect(contacts).toBeGreaterThan(30);expect(recovery).toBeGreaterThan(.01);expect(recovery).toBeLessThan(.04);
  }finally{motion.dispose();view.dispose();}
 },30000);
 it('does not compound partial transition IK and pauses its grounded correction ramp',async()=>{
  const state=(await walkingStates())[20],view=createProductionTurtleRig(),reference=createProductionTurtleRig(),motion=createTurtleContactMotion({view,cove,asset});
  try{for(const transition of [.19,.1,.04,.001]){const s={...state,transition};reference.apply(s,1/60);motion.apply(s,1/60);for(const name of ['FrontL','FrontLTip','FrontR','FrontRTip','HindL','HindLTip','HindR','HindRTip'])expect(view.group.getObjectByName(name)!.quaternion.toArray()).toEqual(reference.group.getObjectByName(name)!.quaternion.toArray());expect(motion.diagnostics().acceptedCorrections).toBe(0);}
   const grounded={...state,transition:0};motion.apply(grounded,1/60);const ramp=motion.diagnostics().groundedSeconds;expect(ramp).toBeGreaterThan(0);expect(ramp).toBeLessThan(.25);motion.setPaused(true);motion.apply(grounded,10);expect(motion.diagnostics().groundedSeconds).toBe(ramp);motion.reset();expect(motion.diagnostics().groundedSeconds).toBe(0);
  }finally{motion.dispose();view.dispose();reference.dispose();}
 });

 it('eliminates authored recovery endpoint lift velocity while preserving peak and boundary height',()=>{
  const delta=1e-4;expect(smoothRecoveryArc(0)).toBe(0);expect(smoothRecoveryArc(1)).toBeLessThan(1e-20);expect(smoothRecoveryArc(.5)).toBe(1);
  const originalSpeed=Math.sin(Math.PI*delta)/delta,newSpeed=smoothRecoveryArc(delta)/delta;expect(newSpeed).toBeLessThan(originalSpeed*.001);expect((smoothRecoveryArc(1)-smoothRecoveryArc(1-delta))/delta).toBeGreaterThan(-originalSpeed*.001);
 });
 it('rejects stance-labelled floating and penetrating skin, and clears continuity after gaps/reset',async()=>{
  const state=structuredClone((await walkingStates())[25]),view=createProductionTurtleRig(),motion=createTurtleContactMotion({view,cove,asset});
  try{motion.apply(state,1/60);motion.sampleContacts(state,1,0);
   const floating={...state,position:{...state.position,y:state.position.y+1}};motion.apply(floating,1/60,{poseEnabled:false});const up=motion.sampleContacts(floating,1.02,0);expect(up.contacts).toHaveLength(0);expect(up.discontinuity).toBe(true);expect(motion.diagnostics().measurements.some(m=>m.gap>.2)).toBe(true);
   const penetrating={...state,position:{...state.position,y:state.position.y-.5}};motion.apply(penetrating,1/60,{poseEnabled:false});expect(motion.sampleContacts(penetrating,1.04,0).contacts).toHaveLength(0);
   motion.apply(state,0);expect(motion.sampleContacts(state,2,0).discontinuity).toBe(true);motion.setPaused(true);expect(motion.sampleContacts(state,2,0).paused).toBe(true);motion.reset();expect(motion.diagnostics().measurements).toHaveLength(0);expect(motion.sampleContacts(state,2,0).discontinuity).toBe(true);
  }finally{motion.dispose();view.dispose();}
 });
 it('preserves the actual feeding/nesting routine with fixed physics and one final posed-contact sample per rendered frame',async()=>{
  const world=await createPhysicsWorld(data),controller=createTurtleController(cove as any,world,asset.proxy,asset),view=createProductionTurtleRig();view.apply(controller.state,0);
  const routine=createTurtleRoutine({view,controller,cove,asset,restProfile:PRODUCTION_TURTLE_ROUTINE_PROFILE}),motion=createTurtleContactMotion({view,cove,asset}),trails=createContactTrails(cove),manual={...input,forward:0,active:false};
  try{expect(routine.setEnabled(true,0)).toEqual({ready:true});let frames=0;
   for(let i=0;i<15000;i++){
    const move=routine.resolveInput(manual,{x:0,y:0,z:-1},0);controller.step(move.input,move.cameraForward,0,1/60);routine.afterStep(0,1/60);
    // Reproduce the intended real demo ordering: two fixed substeps per 30 Hz
    // rendered pose; stationary routine overlays retain exclusive pose ownership.
    if(i%2===1){const d=routine.diagnostics(),poseEnabled=!d.enabled||!['rest','feed','dig','lay','cover'].includes(d.phase);motion.apply(controller.state,1/30,{poseEnabled});routine.applyPose();trails.update(motion.sampleContacts(controller.state,(i+1)/60,0));frames++;}
    if(!routine.diagnostics().enabled)break;
   }
   expect(routine.diagnostics()).toMatchObject({stage:'finished',eggs:6,coverage:1,feedingContactSeconds:4});expect(frames).toBeGreaterThan(100);expect(trails.diagnostics().stamps).toBeGreaterThan(8);expect(trails.diagnostics().active).toBeLessThanOrEqual(144);expect(motion.diagnostics().acceptedCorrections).toBeGreaterThan(0);
  }finally{trails.dispose();motion.dispose();routine.dispose();view.dispose();controller.dispose();world.dispose();}
 },30000);

 it('leaves routine-disabled and swim poses exactly as the original view and rejects replacement assets',async()=>{
  const state=(await walkingStates())[10],view=createProductionTurtleRig(),reference=createProductionTurtleRig(),motion=createTurtleContactMotion({view,cove,asset});
  try{for(const s of [state,{...state,previousLocomotion:'swim' as const,transition:1,feet:[]}]){reference.apply(s,0);motion.apply(s,0,{poseEnabled:false});view.group.traverse(o=>{if(o instanceof THREE.Bone){const other=reference.group.getObjectByName(o.name)!;expect(o.quaternion.toArray()).toEqual(other.quaternion.toArray());expect(o.position.toArray()).toEqual(other.position.toArray());}});}
   const wrong=createTurtleContactMotion({view,cove,asset:{...asset,fileSha256:'different'}});expect(wrong.diagnostics().ready).toBe(false);wrong.apply(state,0);expect(wrong.sampleContacts(state,0,0).contacts).toHaveLength(0);wrong.dispose();expect(view.group.getObjectByName('Head')).toBeDefined();
  }finally{motion.dispose();view.dispose();reference.dispose();}
 });
});

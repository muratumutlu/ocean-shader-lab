import {Vector3,Quaternion,Matrix4} from 'three';
import type {Vec3} from '../scene/cove-data';
export type CrawlLimb='front'|'rear';
export type CrawlFoot={side:-1|1;limb?:CrawlLimb;position:Vec3;stance:boolean;plantId:string};
export const CRAWL_DURATION=3.2;
export const CRAWL_SPEED=.35;
export const CRAWL_FRONT_LIFT=.110;
export const CRAWL_REAR_LIFT=.055;
const SPEED=CRAWL_SPEED,FRONT_STANCE=CRAWL_DURATION*.58,REAR_STANCE=CRAWL_DURATION*.28;
const phaseOf=(phase:number)=>((phase%CRAWL_DURATION)+CRAWL_DURATION)%CRAWL_DURATION;
const offset=(side:-1|1)=>side>0?CRAWL_DURATION/2:0;
export const crawlLimbPhase=(phase:number,side:-1|1)=>phaseOf(phase+offset(side));
// Adult Timmy release footage shows progression with each alternating push.
// These bounded force/weight profiles are authored, not calibrated biomechanics.
export function crawlPush(phase:number,side:-1|1){const p=crawlLimbPhase(phase,side);return p<FRONT_STANCE?Math.sin(Math.PI*p/FRONT_STANCE)**2:0;}
export function crawlDrive(phase:number){return .42+.78*Math.max(crawlPush(phase,-1),crawlPush(phase,1));}
export function crawlWeightShift(phase:number){const left=crawlPush(phase,-1),right=crawlPush(phase,1);return {roll:(left-right)*.050,pitch:(left+right)*.016-.003,shift:(right-left)*.016,lift:.002+.004*Math.max(left,right)};}
// Loggerheads alternate sides on land (NPS Everglades / Fort Matanzas).
// Timing and reach remain authored approximations, not measured biological data.
export function crawlPad(phase:number,side:-1|1):Vec3{
 const p=crawlLimbPhase(phase,side);
 if(p<FRONT_STANCE)return {x:side*.60,y:-.10,z:.72-SPEED*p};
 const u=(p-FRONT_STANCE)/(CRAWL_DURATION-FRONT_STANCE),ease=u*u*(3-2*u);
 return {x:side*(.60+.045*Math.sin(Math.PI*u)),y:-.10+CRAWL_FRONT_LIFT*Math.sin(Math.PI*u),z:.72-SPEED*FRONT_STANCE+SPEED*FRONT_STANCE*ease};
}
export function rearPad(phase:number,side:-1|1):Vec3{
 const p=crawlLimbPhase(phase,side);
 if(p<REAR_STANCE)return {x:side*.49,y:-.095,z:-.245-SPEED*p};
 const u=(p-REAR_STANCE)/(CRAWL_DURATION-REAR_STANCE),ease=u*u*(3-2*u);
 return {x:side*(.49+.025*Math.sin(Math.PI*u)),y:-.095+CRAWL_REAR_LIFT*Math.sin(Math.PI*u),z:-.245-SPEED*REAR_STANCE+SPEED*REAR_STANCE*ease};
}
// A blade frame preserves its dorsal normal. Vector-only shortest-arc rotation
// leaves twist unconstrained and can turn a whole flipper edge-on during a turn.
function bladeOrientation(bind:Vector3,direction:Vector3,normal:Vector3){
 const frame=(axis:Vector3,up:Vector3)=>{const x=axis.clone().normalize(),y=up.clone().addScaledVector(x,-up.dot(x));if(y.lengthSq()<1e-8)y.set(0,0,1).addScaledVector(x,-x.z);y.normalize();return new Matrix4().makeBasis(x,y,new Vector3().crossVectors(x,y).normalize());};
 const rest=frame(bind,new Vector3(0,1,0)),desired=frame(direction,normal);
 return new Quaternion().setFromRotationMatrix(desired.multiply(rest.invert()));
}
export function limbReachLimits(rear:boolean){
 const a=new Vector3(rear?.07:.16,rear?-.016:-.030,rear?-.05:-.068).length(),b=new Vector3(rear?.23:.40,rear?-.054:-.075,rear?-.16:-.192).length();
 // Authored virtual-joint fold bound, not a measured anatomical angle.
 const flex=(rear?130:145)*Math.PI/180;
 return {min:Math.sqrt(a*a+b*b+2*a*b*Math.cos(flex)),max:a+b-1e-5};
}
function solveLimb(side:-1|1,goal:Vec3,rear:boolean){
 const shoulder=new Vector3(side*(rear?.24:.28),-.02,rear?-.40:.32),bind1=new Vector3(side*(rear?.07:.16),rear?-.016:-.030,rear?-.05:-.068),bind2=new Vector3(side*(rear?.23:.40),rear?-.054:-.075,rear?-.16:-.192);
 const l1=bind1.length(),l2=bind2.length(),reach=limbReachLimits(rear),delta=new Vector3(goal.x,goal.y,goal.z).sub(shoulder),length=Math.max(reach.min,Math.min(reach.max,delta.length())),direction=delta.normalize();
 const cosine=Math.max(-1,Math.min(1,(l1*l1+length*length-l2*l2)/(2*l1*length)));
 const pole=new Vector3(side*.30,.02,1),bend=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize();
 const first=direction.clone().multiplyScalar(cosine).addScaledVector(bend,Math.sqrt(1-cosine*cosine)).multiplyScalar(l1);
 const up=new Vector3(0,1,0),a=bladeOrientation(bind1,first,up),inverse=a.clone().invert();
 const second=direction.clone().multiplyScalar(length).sub(first).applyQuaternion(inverse).normalize();
 return {shoulder:a,tip:bladeOrientation(bind2,second,up.applyQuaternion(inverse))};
}
export const solveFrontFlipper=(side:-1|1,goal:Vec3)=>solveLimb(side,goal,false);
export const solveRearFlipper=(side:-1|1,goal:Vec3)=>solveLimb(side,goal,true);
export function createCrawlContacts(height:(x:number,z:number)=>number){
 type Pad={cycle:number;anchor:Vector3|null;plantId:string;rested:boolean};
 const pads=new Map<string,Pad>();let serial=0;
 const fresh=()=>String(++serial);
 const worldGoal=(p:Vec3,root:Vec3,q:Quaternion)=>new Vector3(p.x,p.y,p.z).applyQuaternion(q).add(new Vector3(root.x,root.y,root.z));
 return {reset(){pads.clear();},update(phase:number,root:Vec3,q:Quaternion,restBlend:number):CrawlFoot[]{
  return (['front','rear'] as const).flatMap(limb=>([-1,1] as const).map(side=>{
   const rear=limb==='rear',stance=rear?REAR_STANCE:FRONT_STANCE,p=crawlLimbPhase(phase,side),cycle=Math.floor((phase+offset(side))/CRAWL_DURATION),inStance=p<stance,key=limb+side;
   let pad=pads.get(key);if(!pad){pad={cycle,anchor:null,plantId:fresh(),rested:false};pads.set(key,pad);}
   const goal=worldGoal(rear?rearPad(phase,side):crawlPad(phase,side),root,q);
   if(inStance){
    // A turn releases an unreachable anchor rather than stretching a limb.
    const local=pad.anchor?.clone().sub(new Vector3(root.x,root.y,root.z)).applyQuaternion(q.clone().invert()).sub(new Vector3(side*(rear?.24:.28),-.02,rear?-.40:.32));
    if(!pad.anchor||pad.cycle!==cycle||local&&(local.length()>(rear?.368:.615)||local.length()<limbReachLimits(rear).min+.003||local.x*side<.08)){pad.anchor=goal.clone();pad.anchor.y=height(goal.x,goal.z)+.014;pad.plantId=fresh();}
    pad.cycle=cycle;pad.rested=false;
    return {side,limb,position:{x:pad.anchor.x,y:pad.anchor.y,z:pad.anchor.z},stance:true,plantId:pad.plantId};
   }
   if(!pad.anchor){pad.anchor=goal.clone();pad.anchor.y=height(goal.x,goal.z)+.014;}
   const u=(p-stance)/(CRAWL_DURATION-stance),ease=u*u*(3-2*u),startPhase=-offset(side),ahead=worldGoal(rear?rearPad(startPhase,side):crawlPad(startPhase,side),root,q),position=pad.anchor.clone().lerp(ahead,ease);
   const rested=restBlend>.995;
   // Match the authored recovery's outward arc. Without this component the
   // goal cuts inside the bounded fold radius midway through recovery.
   position.add(new Vector3(side*(rear?.025:.045)*Math.sin(Math.PI*u)*(1-Math.max(0,Math.min(1,restBlend))),0,0).applyQuaternion(q));
   position.y=height(position.x,position.z)+.014+(rested?0:(rear?CRAWL_REAR_LIFT:CRAWL_FRONT_LIFT)*Math.sin(Math.PI*u)*(1-Math.max(0,Math.min(1,restBlend))));
   if(rested&&!pad.rested)pad.plantId=fresh();pad.rested=rested;
   return {side,limb,position:{x:position.x,y:position.y,z:position.z},stance:rested,plantId:pad.plantId};
  }));
 }};
}

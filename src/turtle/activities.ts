import type {Vec3} from '../scene/cove-data';
import type {TurtleState} from './state';

type Point=Readonly<Vec3>;
export type TurtleActivityPose=Readonly<{position:Point;heading:number}>;
export type TurtleActivityPlan=Readonly<{
 /** A command ID, not a food/site ID. Repeating the current command is rejected. */
 id:string;
 target:TurtleActivityPose;
 /** Caller-validated root destination in water; actual arrival finishes the episode. */
 leavePosition:Point;
}> & (Readonly<{kind:'feed';foodPosition:Point}>|Readonly<{kind:'nest';nestCenter:Point;eggCount:number}>);
export type TurtleActivityPhase='idle'|'approach'|'rest'|'feed'|'dig'|'lay'|'cover'|'leave'|'complete'|'cancelled';
export type TurtleActivityHabitat='underwater'|'dry-ground'|'shore';
export type TurtleActivityObservation=Readonly<{
 turtle:Readonly<Pick<TurtleState,'position'|'heading'|'velocity'>>;
 /** Derived from actual body clearance/support by the adapter, not root Y alone. */
 habitat:TurtleActivityHabitat;
 /** Route/support/interaction safety; completed food consumption alone is not site loss. */
 siteValid:boolean;
 /** Turtle movement takeover; camera-only movement should not set this flag. */
 manualInputActive:boolean;
 paused:boolean;
}>;
export type TurtleActivityTimings=Readonly<{
 approachTimeout:number;leaveTimeout:number;rest:number;feed:number;dig:number;eggInterval:number;cover:number;
}>;
/** Time-compressed authored demo timings, not biological duration estimates. */
export const DEFAULT_TURTLE_ACTIVITY_TIMINGS:TurtleActivityTimings=Object.freeze({approachTimeout:30,leaveTimeout:30,rest:1.5,feed:4,dig:6,eggInterval:.6,cover:5});
export const TURTLE_ACTIVITY_LIMITS=Object.freeze({maxEggs:128,maxStepSeconds:.1,arrivalRadius:.25,headingTolerance:.20,settledSpeed:.08});
export type TurtleActivityEgg=Readonly<{id:string;index:number}>;
export type TurtleActivityCancellation='manual-control'|'site-unavailable'|'invalid-observation'|'habitat-changed'|'pose-lost'|'approach-timeout'|'leave-timeout'|'disabled'|'cancelled';
export type TurtleActivitySnapshot=Readonly<{
 enabled:boolean;phase:TurtleActivityPhase;plan:TurtleActivityPlan|null;episode:number|null;
 phaseElapsed:number;elapsed:number;feedingProgress:number;
 /** Current episode only. Retain this immutable result to persist a completed world nest. */
 eggs:readonly TurtleActivityEgg[];coverage:number;reason:TurtleActivityCancellation|null;
}>;
type StatePatch={-readonly [K in keyof TurtleActivitySnapshot]?:TurtleActivitySnapshot[K]};
export type TurtleActivityIntent=
 | Readonly<{kind:'none'}>
 | Readonly<{kind:'navigate';position:Point;heading:number|null;arrivalHabitat:TurtleActivityHabitat;arrivalRadius:number;headingTolerance:number;pace:'careful'}>
 | Readonly<{kind:'pose';action:'rest'|'feed'|'dig'|'lay'|'cover';anchor:TurtleActivityPose;focus:Point;progress:number}>;
export type TurtleActivityRequestResult={accepted:true}|{accepted:false;reason:'disabled'|'busy'|'duplicate'|'invalid-plan'|'episode-limit'};

const finitePoint=(point:Point|undefined)=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z);
const copyPoint=(point:Point):Point=>Object.freeze({x:point.x,y:point.y,z:point.z});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const headingDifference=(a:number,b:number)=>{const x=Math.atan2(Math.sin(a),Math.cos(a))-Math.atan2(Math.sin(b),Math.cos(b));return Math.abs(Math.atan2(Math.sin(x),Math.cos(x)));};
const terminal=(phase:TurtleActivityPhase)=>phase==='idle'||phase==='complete'||phase==='cancelled';
const stationary=(phase:TurtleActivityPhase)=>phase==='rest'||phase==='feed'||phase==='dig'||phase==='lay'||phase==='cover';
const empty=(enabled:boolean):TurtleActivitySnapshot=>Object.freeze({enabled,phase:'idle',plan:null,episode:null,phaseElapsed:0,elapsed:0,feedingProgress:0,eggs:Object.freeze([]),coverage:0,reason:null});
const EPSILON=1e-9;
function copyPlan(plan:TurtleActivityPlan):TurtleActivityPlan{
 const common={id:plan.id.trim(),target:Object.freeze({position:copyPoint(plan.target.position),heading:plan.target.heading}),leavePosition:copyPoint(plan.leavePosition)};
 return plan.kind==='feed'?Object.freeze({...common,kind:'feed',foodPosition:copyPoint(plan.foodPosition)}):Object.freeze({...common,kind:'nest',nestCenter:copyPoint(plan.nestCenter),eggCount:plan.eggCount});
}
function validPlan(plan:TurtleActivityPlan){
 return !!plan&&typeof plan.id==='string'&&plan.id.trim().length>0&&plan.id.length<=120&&finitePoint(plan.target?.position)&&Number.isFinite(plan.target?.heading)&&finitePoint(plan.leavePosition)&&
  (plan.kind==='feed'?finitePoint(plan.foodPosition):plan.kind==='nest'&&finitePoint(plan.nestCenter)&&Number.isInteger(plan.eggCount)&&plan.eggCount>=1&&plan.eggCount<=TURTLE_ACTIVITY_LIMITS.maxEggs);
}

/** One explicitly requested episode at a time. No locomotion, timers, I/O or key bindings.
 * Snapshots are immutable; reset/new requests replace the current result, while callers
 * may retain earlier snapshots. Episode numbering survives reset so egg IDs are not reused.
 */
export function createTurtleActivities(options:{enabled?:boolean;namespace?:string;timings?:Partial<TurtleActivityTimings>}={}){
 const namespace=options.namespace??'turtle-activity';
 if(!namespace.trim()||namespace.length>120)throw new RangeError('Activity namespace must contain 1-120 characters.');
 const timings=Object.freeze({...DEFAULT_TURTLE_ACTIVITY_TIMINGS,...options.timings});
 for(const [key,value] of Object.entries(timings)){
  const max=key==='approachTimeout'||key==='leaveTimeout'?120:key==='eggInterval'?2:30;
  if(!Number.isFinite(value)||value<.05||value>max)throw new RangeError(`Invalid activity timing: ${key}`);
 }
 let state=empty(options.enabled??false),serial=0;
 const commit=(patch:StatePatch)=>{state=Object.freeze({...state,...patch});return state;};
 const cancel=(reason:TurtleActivityCancellation='cancelled')=>terminal(state.phase)?state:commit({phase:'cancelled',phaseElapsed:0,reason});
 const requiredHabitat=(plan:TurtleActivityPlan):TurtleActivityHabitat=>plan.kind==='feed'?'underwater':'dry-ground';
 const duration=(phase:TurtleActivityPhase,plan:TurtleActivityPlan)=>phase==='lay'&&plan.kind==='nest'?timings.eggInterval*plan.eggCount:timings[phase as 'rest'|'feed'|'dig'|'cover'];
 const changePhase=(phase:TurtleActivityPhase)=>commit({phase,phaseElapsed:0});
 const poseReady=(observation:TurtleActivityObservation,pose:TurtleActivityPose,loose=false)=>
  distance(observation.turtle.position,pose.position)<=TURTLE_ACTIVITY_LIMITS.arrivalRadius*(loose?1.8:1)&&
  headingDifference(observation.turtle.heading,pose.heading)<=TURTLE_ACTIVITY_LIMITS.headingTolerance*(loose?1.8:1)&&
  Math.hypot(observation.turtle.velocity.x,observation.turtle.velocity.y,observation.turtle.velocity.z)<=TURTLE_ACTIVITY_LIMITS.settledSpeed*(loose?2:1);
 const api={
  get state(){return state;},
  request(plan:TurtleActivityPlan):TurtleActivityRequestResult{
   if(!state.enabled)return {accepted:false,reason:'disabled'};
   if(!terminal(state.phase))return {accepted:false,reason:'busy'};
   if(!validPlan(plan))return {accepted:false,reason:'invalid-plan'};
   const copied=copyPlan(plan);
   if(copied.id===state.plan?.id)return {accepted:false,reason:'duplicate'};
   if(serial>=Number.MAX_SAFE_INTEGER)return {accepted:false,reason:'episode-limit'};
   state=Object.freeze({...empty(state.enabled),phase:'approach',plan:copied,episode:++serial});return {accepted:true};
  },
  setEnabled(enabled:boolean){
   if(!enabled)cancel('disabled');return commit({enabled});
  },
  cancel,
  reset(){state=empty(state.enabled);return state;},
  intent():TurtleActivityIntent{
   const plan=state.plan;if(!plan||terminal(state.phase))return {kind:'none'};
   if(state.phase==='approach'||state.phase==='leave')return {kind:'navigate',position:state.phase==='approach'?plan.target.position:plan.leavePosition,heading:state.phase==='approach'?plan.target.heading:null,arrivalHabitat:state.phase==='approach'?requiredHabitat(plan):'underwater',arrivalRadius:TURTLE_ACTIVITY_LIMITS.arrivalRadius,headingTolerance:TURTLE_ACTIVITY_LIMITS.headingTolerance,pace:'careful'};
   return {kind:'pose',action:state.phase as 'rest'|'feed'|'dig'|'lay'|'cover',anchor:plan.target,focus:plan.kind==='feed'?plan.foodPosition:plan.nestCenter,progress:Math.min(1,state.phaseElapsed/duration(state.phase,plan))};
  },
  step(observation:TurtleActivityObservation,rawDt:number):TurtleActivitySnapshot{
   if(terminal(state.phase))return state;
   // Human takeover and invalidated world state cancel even while simulation is paused.
   if(observation.manualInputActive)return cancel('manual-control');
   const turtle=observation.turtle;
   if(!finitePoint(turtle.position)||!finitePoint(turtle.velocity)||!Number.isFinite(turtle.heading)||!['underwater','dry-ground','shore'].includes(observation.habitat))return cancel('invalid-observation');
   if(!observation.siteValid)return cancel('site-unavailable');
   const plan=state.plan!;
   const validatePose=()=>{
    if(observation.habitat!==requiredHabitat(plan)){cancel('habitat-changed');return false;}
    if(!poseReady(observation,plan.target,true)){cancel('pose-lost');return false;}
    return true;
   };
   if(stationary(state.phase)&&!validatePose())return state;
   if(observation.paused||!Number.isFinite(rawDt)||rawDt<=0)return state;
   let remaining=Math.min(TURTLE_ACTIVITY_LIMITS.maxStepSeconds,rawDt);
   // At most seven phases exist; strictly positive validated durations bound this loop.
   for(let transitions=0;remaining>EPSILON&&!terminal(state.phase)&&transitions<8;transitions++){
    if(state.phase==='approach'||state.phase==='leave'){
     const arriving=state.phase==='approach';
     const arrived=arriving?observation.habitat===requiredHabitat(plan)&&poseReady(observation,plan.target):
      observation.habitat==='underwater'&&distance(turtle.position,plan.leavePosition)<=TURTLE_ACTIVITY_LIMITS.arrivalRadius;
     if(arrived){changePhase(arriving?'rest':'complete');continue;}
     // Transit can legitimately cross habitats. Only arrival and stationary phases gate it.
     const timeout=arriving?timings.approachTimeout:timings.leaveTimeout,take=Math.min(remaining,timeout-state.phaseElapsed);
     commit({phaseElapsed:state.phaseElapsed+take,elapsed:state.elapsed+take});remaining-=take;
     if(state.phaseElapsed+EPSILON>=timeout)cancel(arriving?'approach-timeout':'leave-timeout');
     continue;
    }
    if(!validatePose())break;
    const phase=state.phase,total=duration(phase,plan),take=Math.min(remaining,total-state.phaseElapsed),phaseElapsed=state.phaseElapsed+take;
    const atEnd=phaseElapsed+EPSILON>=total;
    const patch:StatePatch={phaseElapsed:atEnd?total:phaseElapsed,elapsed:state.elapsed+take};
    if(phase==='feed')patch.feedingProgress=atEnd?1:phaseElapsed/total;
    if(phase==='lay'&&plan.kind==='nest'){
     const count=atEnd?plan.eggCount:Math.min(plan.eggCount,Math.floor((phaseElapsed+EPSILON)/timings.eggInterval));
     if(count>state.eggs.length)patch.eggs=Object.freeze([...state.eggs,...Array.from({length:count-state.eggs.length},(_,i)=>{const index=state.eggs.length+i;return Object.freeze({id:`${namespace}:${state.episode}:egg:${index}`,index});})]);
    }
    if(phase==='cover')patch.coverage=atEnd?1:phaseElapsed/total;
    commit(patch);remaining-=take;
    if(atEnd){
     if(phase==='rest')changePhase(plan.kind==='feed'?'feed':'dig');
     else if(phase==='dig')changePhase('lay');
     else if(phase==='lay')changePhase('cover');
     else changePhase('leave');
    }
   }
   return state;
  },
 };
 return api;
}

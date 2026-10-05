import {Vector3,Matrix4,Quaternion,Euler} from 'three';
import {createTurtleState,type TurtleState} from './state';
import type {TurtleAssetInfo} from './asset';
import type {CoveResources} from '../scene/cove';
import type {PhysicsWorld,TurtleProxy} from '../physics/world';
import type {Vec3} from '../scene/cove-data';
import type {InputSnapshot} from '../input/mode-controller';
import {createCrawlContacts,crawlDrive,CRAWL_SPEED} from './crawl-pose';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function selectLocomotion(previous:'swim'|'crawl',meanDepth:number,grounded:boolean){return meanDepth>.60?'swim':meanDepth<.35&&grounded?'crawl':previous;}
export function turtleRotation(state:Pick<TurtleState,'heading'|'groundNormal'|'pitch'|'transition'>){
 const up=new Vector3(state.groundNormal.x,state.groundNormal.y,state.groundNormal.z).normalize(),forward=new Vector3(Math.sin(state.heading),0,Math.cos(state.heading)).projectOnPlane(up).normalize(),right=new Vector3().crossVectors(up,forward).normalize();
 const q=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,forward));
 return q.multiply(new Quaternion().setFromEuler(new Euler(state.pitch*state.transition,0,0)));
}
export function createTurtleController(cove:CoveResources,world:PhysicsWorld,proxy:TurtleProxy,asset?:Partial<TurtleAssetInfo>){
 const swimProxy=asset?.swimProxy??proxy,groundSamples=asset?.groundSamples??[[[0,-.13,0]]],state=createTurtleState({x:1.2,y:-.5,z:6});
 let disposed=false,configured:'swim'|'crawl'='swim',restBlend=0;
 const contacts=createCrawlContacts((x,z)=>cove.sampleHeight(x,z));
 const findSpawn=()=>{
  for(const z of [6,7,8,9,5])for(const x of [1.2,0,2.4,-1.2]){
   const p={x,y:Math.max(-.50,cove.sampleHeight(x,z)+swimProxy.halfHeight-swimProxy.offset.y+.04),z};world.configureTurtle(swimProxy,p);
   if(world.isValidTurtlePose(p))return p;
  }throw Error('No clear water spawn was found.');
 };
 const reset=()=>{contacts.reset();restBlend=0;const spawn=findSpawn();Object.assign(state,createTurtleState(spawn));state.groundHeight=cove.sampleHeight(spawn.x,spawn.z);configured='swim';};reset();
 function supportY(x:number,z:number,swimming=false){
  const rotation=turtleRotation(state),p=new Vector3();
  const required=(samplesByPhase:number[][][],time:number,duration:number)=>{
   const phase=((time%duration)+duration)%duration/duration*32,index=Math.floor(phase)%32,next=(index+1)%samplesByPhase.length;let y=-Infinity;
   for(const samples of [samplesByPhase[index%samplesByPhase.length],samplesByPhase[next]])for(const sample of samples){p.fromArray(sample).applyQuaternion(rotation);y=Math.max(y,cove.sampleHeight(x+p.x,z+p.z)-p.y+.019);}return y;
  };
  if(swimming)return required(asset?.swimGroundSamples??groundSamples,state.animationPhase,2.4);
  const crawl=required(asset?.bodyGroundSamples??groundSamples,state.crawlPhase,3.2);
  return asset?.idleBodyGroundSamples?crawl+(required(asset.idleBodyGroundSamples,state.animationPhase,5)-crawl)*restBlend:crawl;
 }
 const api={state,reset,step(input:InputSnapshot,cameraForward:Vec3,tide:number,rawDt:number){
  if(disposed||!Number.isFinite(rawDt)||rawDt<=0)return;const dt=Math.min(.1,rawDt),floor=cove.sampleHeight(state.position.x,state.position.z),meanDepth=tide-floor,clearance=swimProxy.halfHeight-swimProxy.offset.y+.02;
  // A model's conservative cylinder can touch the slope before its skin does.
  // Use the independently sampled animated skin to recognize actual shore contact.
  const grounded=configured==='crawl'||meanDepth<.35&&state.position.y<=supportY(state.position.x,state.position.z,true)+.06;
  const selected=selectLocomotion(state.previousLocomotion,meanDepth,grounded);
  if(selected!==configured){contacts.reset();restBlend=0;state.crawlPhase=0;state.feet=[];world.configureTurtle(selected==='swim'?swimProxy:proxy,state.position);configured=selected;}state.previousLocomotion=selected;
  const desiredBlend=selected==='swim'?1:0;state.transition+=clamp(desiredBlend-state.transition,-dt/.45,dt/.45);
  const n=cove.sampleNormal(state.position.x,state.position.z),landWeight=1-state.transition;
  const normal=new Vector3(0,1,0).lerp(new Vector3(n.x,n.y,n.z),landWeight).normalize();state.groundNormal={x:normal.x,y:normal.y,z:normal.z};state.groundHeight=floor;
  const forward=new Vector3(cameraForward.x,0,cameraForward.z);if(forward.lengthSq()<1e-6)forward.set(Math.sin(state.heading),0,Math.cos(state.heading));forward.normalize();
  const move=forward.clone().multiplyScalar(input.forward).add(new Vector3(-forward.z,0,forward.x).multiplyScalar(input.right));if(move.lengthSq()>1)move.normalize();
  const speed=selected==='swim'?1.2:CRAWL_SPEED*crawlDrive(state.crawlPhase),target=move.multiplyScalar(speed),vertical=selected==='swim'?input.vertical*.6:0;
  const decay=Math.exp(-dt/.3),old={...state.velocity};state.velocity={x:target.x+(old.x-target.x)*decay,y:vertical+(old.y-vertical)*decay,z:target.z+(old.z-target.z)*decay};
  let dx=target.x*dt+(old.x-target.x)*.3*(1-decay),dz=target.z*dt+(old.z-target.z)*.3*(1-decay);
  const x=clamp(state.position.x+dx,-16+proxy.radius,16-proxy.radius),z=clamp(state.position.z+dz,-12+proxy.radius,12-proxy.radius);
  if(selected==='crawl'&&cove.sampleNormal(x,z).y<Math.cos(25*Math.PI/180)){dx=dz=0;}
  const horizontal=Math.hypot(state.velocity.x,state.velocity.z);if(horizontal>.015){const wanted=Math.atan2(state.velocity.x,state.velocity.z),difference=Math.atan2(Math.sin(wanted-state.heading),Math.cos(wanted-state.heading));state.heading+=difference*(1-Math.exp(-dt/.18));}
  const wantedPitch=selected==='swim'?clamp(-Math.atan2(state.velocity.y,Math.max(horizontal,.4)),-Math.PI/15,Math.PI/15):0;state.pitch+=(wantedPitch-state.pitch)*(1-Math.exp(-dt/.2));
  let desiredY=state.position.y+vertical*dt+(old.y-vertical)*.3*(1-decay);
  const footprintFloor=Math.max(floor,cove.sampleHeight(x+swimProxy.radius,z),cove.sampleHeight(x-swimProxy.radius,z),cove.sampleHeight(x,z+swimProxy.radius),cove.sampleHeight(x,z-swimProxy.radius));
  const envelopeBottom=state.position.y+swimProxy.offset.y-swimProxy.halfHeight;
  const terrainHandled=selected==='crawl'||meanDepth<.65||footprintFloor+.025>envelopeBottom;
  if(selected==='swim'){const minimum=terrainHandled?supportY(x,z,true):cove.sampleHeight(x,z)+clearance;desiredY=clamp(desiredY,minimum,Math.max(minimum,tide-.25));}
  else desiredY=supportY(x,z);
  // The full yaw-safe envelope still handles rocks/edges. The shared heightfield
  // supplies exact foot support on land, avoiding empty bounding-box space.
  const previous={...state.position},result=world.moveTurtle({x:dx,y:desiredY-state.position.y,z:dz},selected,dt,terrainHandled);state.position=result.position;
  if(selected==='crawl'){const y=supportY(state.position.x,state.position.z);if(Math.abs(y-state.position.y)>.001)state.position=world.moveTurtle({x:0,y:y-state.position.y,z:0},'crawl',dt,true).position;}
  const distance=Math.hypot(state.position.x-previous.x,state.position.z-previous.z),moving=distance>.00006||selected==='swim'&&Math.abs(state.position.y-previous.y)>.0001;
  state.animationPhase+=dt*(selected==='swim'?Math.max(.18,distance/(dt*1.2)):distance/(dt*CRAWL_SPEED));
  state.crawlPhase+=selected==='crawl'?distance/CRAWL_SPEED:0;
  restBlend+=(Number(!moving)-restBlend)*(1-Math.exp(-dt/.28));state.restBlend=restBlend;
  state.groundHeight=cove.sampleHeight(state.position.x,state.position.z);
  state.feet=selected==='crawl'?contacts.update(state.crawlPhase,state.position,turtleRotation(state),restBlend):[];
  state.locomotion=state.transition>.001&&state.transition<.999?'shore':moving?selected:'idle';
  if(!Number.isFinite(state.position.x+state.position.y+state.position.z))reset();
 },dispose(){disposed=true;}};return api;
}

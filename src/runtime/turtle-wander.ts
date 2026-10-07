// Ambient wandering for the turtle when nobody controls it: pick random deep-water waypoints
// and feed the controller the same input a player would.
import type {InputSnapshot} from '../input/mode-controller';
import type {Vec3} from '../scene/cove-data';

export function createTurtleWander(sampleHeight:(x:number,z:number)=>number,random:()=>number=Math.random){
 let target:Vec3|null=null,timer=0;
 const pick=(tide:number):Vec3=>{
  for(let i=0;i<40;i++){const x=-11+random()*20,z=.5+random()*9.5,floor=sampleHeight(x,z);if(floor<tide-.8)return {x,y:(floor+tide)/2,z};}
  return {x:-2,y:-.8,z:6};
 };
 return {
  /** Returns a synthetic input and the direction it is relative to (used as the camera forward). */
  step(position:Vec3,tide:number,dt:number):{input:InputSnapshot;forward:Vec3}{
   timer-=dt;
   if(!target||timer<=0||Math.hypot(target.x-position.x,target.z-position.z)<1.2){target=pick(tide);timer=10+random()*10;}
   const dx=target.x-position.x,dz=target.z-position.z,len=Math.hypot(dx,dz)||1;
   const vertical=Math.max(-1,Math.min(1,(target.y-position.y)*1.2));
   return {input:{mode:'turtle',forward:.75,right:0,vertical,fast:false,active:true,pointerActive:false},forward:{x:dx/len,y:0,z:dz/len}};
  },
 };
}

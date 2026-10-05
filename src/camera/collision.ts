import type {PhysicsWorld} from '../physics/world';
import type {Vec3} from '../scene/cove-data';
export function resolveCameraMove(world:PhysicsWorld,from:Vec3,to:Vec3,radius:number,excludeTurtle:boolean,scope:'free'|'orbit'='free'):Vec3{
 let bounded={x:Math.max(-24,Math.min(24,to.x)),y:Math.max(-3.4,Math.min(45,to.y)),z:Math.max(-20,Math.min(20,to.z))};
 if(scope==='orbit'){const length=Math.hypot(to.x,to.y,to.z),scale=Math.min(1,200/Math.max(length,.001));bounded={x:to.x*scale,y:Math.max(-3.4,to.y*scale),z:to.z*scale};}
 return world.sweepSphere(from,bounded,radius,excludeTurtle).position;
}

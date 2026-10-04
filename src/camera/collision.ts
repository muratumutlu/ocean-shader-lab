import type {PhysicsWorld} from '../physics/world';
import type {Vec3} from '../scene/cove-data';
export function resolveCameraMove(world:PhysicsWorld,from:Vec3,to:Vec3,radius:number,excludeTurtle:boolean):Vec3{
 const bounded={x:Math.max(-24,Math.min(24,to.x)),y:Math.max(-3.4,Math.min(45,to.y)),z:Math.max(-20,Math.min(20,to.z))};
 return world.sweepSphere(from,bounded,radius,excludeTurtle).position;
}

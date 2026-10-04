import RAPIER from '@dimforge/rapier3d-compat';
import type {CoveData,Vec3} from '../scene/cove-data';
export type TurtleProxy={radius:number;halfHeight:number;offset:Vec3};
export type SweepResult={position:Vec3;hit:boolean};
export type MoveResult={position:Vec3;grounded:boolean};
export type PhysicsWorld={sweepSphere(from:Vec3,to:Vec3,radius:number,excludeTurtle:boolean):SweepResult;configureTurtle(proxy:TurtleProxy,root:Vec3):void;moveTurtle(delta:Vec3,mode:'swim'|'crawl',dt:number):MoveResult;isValidTurtlePose(root:Vec3):boolean;resetTurtle(root:Vec3):void;debugLines():Float32Array;dispose():void};
let initialization:Promise<void>|null=null;
const identity={x:0,y:0,z:0,w:1},add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export async function createPhysicsWorld(data:CoveData):Promise<PhysicsWorld>{
 if(!initialization)initialization=RAPIER.init().catch(e=>{initialization=null;throw e;});await initialization;
 const world=new RAPIER.World({x:0,y:0,z:0});let disposed=false,body:RAPIER.RigidBody|null=null,collider:RAPIER.Collider|null=null,proxy:TurtleProxy|null=null;
 const controller=world.createCharacterController(.02);controller.setUp({x:0,y:1,z:0});controller.setSlideEnabled(true);controller.setMaxSlopeClimbAngle(25*Math.PI/180);controller.setMinSlopeSlideAngle(25*Math.PI/180);controller.setApplyImpulsesToDynamicBodies(false);
 for(const spec of data.colliders){
  let desc:RAPIER.ColliderDesc|null=null;
  if(spec.kind==='heightfield')desc=RAPIER.ColliderDesc.heightfield(spec.rows,spec.cols,spec.heights,spec.scale);
  if(spec.kind==='convex'){desc=RAPIER.ColliderDesc.convexHull(spec.vertices);desc?.setRotation(spec.rotation);}
  if(spec.kind==='trimesh')desc=RAPIER.ColliderDesc.trimesh(spec.vertices,spec.indices);
  if(spec.kind==='cuboid')desc=RAPIER.ColliderDesc.cuboid(spec.halfExtents.x,spec.halfExtents.y,spec.halfExtents.z);
  if(!desc){world.free();throw Error('Invalid static collider');}desc.setTranslation(spec.translation.x,spec.translation.y,spec.translation.z);world.createCollider(desc);
 }
 world.step();
 const sync=()=>{world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();};
 const alive=()=>{if(disposed)throw Error('Physics world is disposed');};
 const root=()=>sub(body!.translation(),proxy!.offset);
 const within=(p:Vec3)=>!!proxy&&Number.isFinite(p.x+p.y+p.z)&&p.x+proxy.offset.x-proxy.radius>=-16&&p.x+proxy.offset.x+proxy.radius<=16&&p.z+proxy.offset.z-proxy.radius>=-12&&p.z+proxy.offset.z+proxy.radius<=12&&p.y+proxy.offset.y-proxy.halfHeight>=-3.5;
 const api:PhysicsWorld={
  sweepSphere(from,to,radius,excludeTurtle){alive();const delta=sub(to,from),length=Math.hypot(delta.x,delta.y,delta.z);
   if(length<1e-7)return {position:{...from},hit:false};
   const contact=world.castShape(from,identity,delta,new RAPIER.Ball(radius),1,true,undefined,undefined,excludeTurtle?collider??undefined:undefined);
   if(!contact)return {position:{...to},hit:false};
   const t=Math.max(0,contact.toi-.02/length);return {position:add(from,{x:delta.x*t,y:delta.y*t,z:delta.z*t}),hit:true};
  },
  configureTurtle(next,position){alive();if(body)world.removeRigidBody(body);proxy={...next,offset:{...next.offset}};
   const center=add(position,proxy.offset);body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x,center.y,center.z));collider=world.createCollider(RAPIER.ColliderDesc.cylinder(proxy.halfHeight,proxy.radius),body);world.step();sync();
  },
  moveTurtle(delta,mode,dt){alive();if(!body||!collider||!proxy)throw Error('Turtle proxy not configured');
   if(mode==='crawl'){controller.enableAutostep(.08,.2,false);controller.enableSnapToGround(.08);}else{controller.disableAutostep();controller.disableSnapToGround();}
   world.timestep=Math.min(.1,Math.max(1e-5,dt));const before=root(),desired=add(before,delta);
   desired.x=Math.max(-16+proxy.radius-proxy.offset.x,Math.min(16-proxy.radius-proxy.offset.x,desired.x));desired.z=Math.max(-12+proxy.radius-proxy.offset.z,Math.min(12-proxy.radius-proxy.offset.z,desired.z));desired.y=Math.max(-3.5+proxy.halfHeight-proxy.offset.y,desired.y);
   const change=sub(desired,before),steps=Math.max(1,Math.min(512,Math.ceil(Math.hypot(change.x,change.y,change.z)/Math.min(.1,proxy.radius*.5))));
   const increment={x:change.x/steps,y:change.y/steps,z:change.z/steps};let grounded=false;
   for(let i=0;i<steps;i++){
    controller.computeColliderMovement(collider,increment);const next=add(body.translation(),controller.computedMovement());body.setTranslation(next,true);body.setNextKinematicTranslation(next);sync();grounded=controller.computedGrounded();
   }
   return {position:root(),grounded};
  },
  isValidTurtlePose(position){alive();if(!proxy||!collider||!within(position))return false;let intersects=false;world.intersectionsWithShape(add(position,proxy.offset),identity,new RAPIER.Cylinder(proxy.halfHeight,proxy.radius),()=>{intersects=true;return false;},undefined,undefined,collider);return !intersects;},
  resetTurtle(position){alive();if(!body||!proxy)throw Error('Turtle proxy not configured');const center=add(position,proxy.offset);body.setTranslation(center,true);body.setNextKinematicTranslation(center);sync();},
  debugLines(){alive();return world.debugRender().vertices;},
  dispose(){if(disposed)return;disposed=true;world.removeCharacterController(controller);world.free();body=null;collider=null;proxy=null;}
 };
 return api;
}

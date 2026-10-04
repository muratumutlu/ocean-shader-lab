import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {cameraTranslation,nearPlaneRadius} from '../../src/camera/free-camera';
import {resolveCameraMove} from '../../src/camera/collision';
import {createPhysicsWorld} from '../../src/physics/world';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
const input={mode:'camera' as const,forward:1,right:1,vertical:0,fast:false,active:true,pointerActive:false};
describe('free camera motion',()=>{
 it('normalizes diagonals and matches 60 and 30 fps movement',()=>{
  const run=(fps:number)=>{const p=new Vector3();for(let i=0;i<fps;i++)p.add(cameraTranslation(input,new Vector3(0,0,-1),10,1/fps));return p;};
  expect(run(60).distanceTo(run(30))).toBeLessThan(.01);expect(run(60).length()).toBeCloseTo(2);
  expect(cameraTranslation({...input,fast:true},new Vector3(0,0,-1),10,1).length()).toBeCloseTo(4);
 });
 it('protects near-plane corners across wide and portrait views',()=>{
  expect(nearPlaneRadius(.03,34.73,.46)).toBeGreaterThanOrEqual(.15);expect(nearPlaneRadius(1,90,3)).toBeGreaterThan(3);
 });
 it('stops large scroll and clamps world limits before committing a pose',async()=>{
  const d=createCoveData(7),w=await createPhysicsWorld(d);try{
   const rock=d.rocks[4],y=sampleGrid(d,rock.x,rock.z)+.5;
   const p=resolveCameraMove(w,{x:rock.x-5,y,z:rock.z},{x:rock.x+40,y,z:rock.z},.15,false);
   expect(p.x).toBeLessThan(rock.x);expect(p.x).toBeGreaterThan(rock.x-5);
   const bound=resolveCameraMove(w,{x:0,y:20,z:0},{x:100,y:100,z:100},.15,false);expect(bound.x).toBeLessThanOrEqual(24);expect(bound.y).toBeLessThanOrEqual(45);expect(bound.z).toBeLessThanOrEqual(20);
  }finally{w.dispose();}
 });
});

it('orbit zoom can leave the near navigation box while preserving collision sweeps and a finite outer bound',()=>{
 const world={sweepSphere:(from:any,to:any)=>({position:to})} as any;
 const p=resolveCameraMove(world,{x:22,y:24,z:20},{x:100,y:80,z:90},.15,false,'orbit');expect(p).toEqual({x:100,y:80,z:90});
 const q=resolveCameraMove(world,p,{x:1000,y:900,z:800},.15,false,'orbit');expect(Math.hypot(q.x,q.y,q.z)).toBeLessThanOrEqual(200.00001);
 const close=resolveCameraMove(world,{x:0,y:20,z:0},{x:100,y:100,z:100},.15,false);expect(close).toEqual({x:24,y:45,z:20});
});

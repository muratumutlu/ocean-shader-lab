import {describe,it,expect} from 'vitest';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import {createPhysicsWorld} from '../../src/physics/world';
describe('shared collision world',()=>{
 it('sweep stops at closed floor even for a fifty unit jump',async()=>{
  const w=await createPhysicsWorld(createCoveData(7));try{
   const r=w.sweepSphere({x:0,y:-8,z:0},{x:0,y:42,z:0},.15,false);expect(r.hit).toBe(true);expect(r.position.y).toBeLessThan(-7.6);
  }finally{w.dispose();w.dispose();}
 });
 it('sweep stops at transformed rock and agrees with terrain',async()=>{
  const d=createCoveData(7),w=await createPhysicsWorld(d);try{
   for(const x of [-4,1,4]){const z=-5,h=sampleGrid(d,x,z),r=w.sweepSphere({x,y:8,z},{x,y:-3,z},.15,false);expect(r.hit).toBe(true);expect(r.position.y).toBeCloseTo(h+.17,1);}
   const rock=d.rocks[4],h=sampleGrid(d,rock.x,rock.z);
   const r=w.sweepSphere({x:rock.x-5,y:h+.6,z:rock.z},{x:rock.x+30,y:h+.6,z:rock.z},.15,false);
   expect(r.hit).toBe(true);expect(r.position.x).toBeLessThan(rock.x);
  }finally{w.dispose();}
 });
 it('kinematic body moves and slides without tunneling and preserves root offset',async()=>{
  const d=createCoveData(7),w=await createPhysicsWorld(d);try{
   const proxy={radius:.42,halfHeight:.22,offset:{x:0,y:.25,z:0}},spawn={x:1,y:-.3,z:5};w.configureTurtle(proxy,spawn);
   expect(w.isValidTurtlePose(spawn)).toBe(true);
   const r=w.moveTurtle({x:0,y:0,z:-50},'swim',1/60);expect(r.position.z).toBeGreaterThan(-5);expect(r.position.y+proxy.offset.y-proxy.halfHeight).toBeGreaterThanOrEqual(sampleGrid(d,r.position.x,r.position.z)-.025);expect(Number.isFinite(r.position.y)).toBe(true);
   expect(w.isValidTurtlePose(r.position)).toBe(true);
   w.resetTurtle(spawn);const reset=w.moveTurtle({x:0,y:0,z:0},'swim',1/60).position;expect(reset.x).toBeCloseTo(spawn.x,5);expect(reset.y).toBeCloseTo(spawn.y,5);expect(reset.z).toBeCloseTo(spawn.z,5);
  }finally{w.dispose();}
 });
});

import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import {createPhysicsWorld} from '../../src/physics/world';
import {createTurtleController,selectLocomotion} from '../../src/turtle/controller';
import manifest from '../../assets/turtle/manifest.json';
const input={mode:'turtle' as const,forward:1,right:0,vertical:0,fast:false,active:true,pointerActive:false};
it('uses mean-depth hysteresis and real ground contact',()=>{
 expect(selectLocomotion('crawl',.61,true)).toBe('swim');expect(selectLocomotion('swim',.34,true)).toBe('crawl');
 expect(selectLocomotion('swim',.50,true)).toBe('swim');expect(selectLocomotion('crawl',.50,true)).toBe('crawl');expect(selectLocomotion('swim',.34,false)).toBe('swim');
});
it('actual Rapier motion follows the safe shore corridor, grounds the model root, and returns to swimming',async()=>{
 const data=createCoveData(7),cove={data,sampleHeight:(x:number,z:number)=>sampleGrid(data,x,z),sampleNormal:(x:number,z:number)=>{const a=(sampleGrid(data,x+.1,z)-sampleGrid(data,x-.1,z))/.2,b=(sampleGrid(data,x,z+.1)-sampleGrid(data,x,z-.1))/.2;return {x:-a/Math.hypot(a,1,b),y:1/Math.hypot(a,1,b),z:-b/Math.hypot(a,1,b)};}},world=await createPhysicsWorld(data);
 const c=createTurtleController(cove as any,world,manifest.proxy,manifest);try{
  for(let i=0;i<1400;i++)c.step(input,{x:0,y:0,z:-1},0,1/60);
  expect(c.state.previousLocomotion,JSON.stringify({state:c.state,floor:cove.sampleHeight(c.state.position.x,c.state.position.z)})).toBe('crawl');expect(c.state.position.z).toBeLessThan(-1);expect(c.state.position.y-cove.sampleHeight(c.state.position.x,c.state.position.z)).toBeLessThan(.3);
  const resting={...input,forward:0,active:false};for(let i=0;i<200;i++)c.step(resting,{x:0,y:0,z:-1},0,1/60);
  const land={...c.state.position};for(let i=0;i<120;i++)c.step({...resting,vertical:1,active:true},{x:0,y:0,z:-1},0,1/60);
  expect(c.state.position.x).toBeCloseTo(land.x,5);expect(c.state.position.y).toBeCloseTo(land.y,5);expect(c.state.position.z).toBeCloseTo(land.z,5);
  for(let i=0;i<120;i++)c.step({...resting,vertical:-1,active:true},{x:0,y:0,z:-1},0,1/60);expect(c.state.position.y).toBeCloseTo(land.y,5);
  for(let i=0;i<2600;i++)c.step(input,{x:0,y:0,z:1},0,1/60);
  expect(c.state.previousLocomotion).toBe('swim');expect(c.state.position.z).toBeLessThan(12-manifest.proxy.radius+.001);expect(c.state.position.y).toBeLessThan(.4);expect(Number.isFinite(c.state.position.x+c.state.position.y+c.state.position.z)).toBe(true);
  c.reset();expect(world.isValidTurtlePose(c.state.position)).toBe(true);
 }finally{c.dispose();world.dispose();}
});
it('normalizes diagonal speed, bounds a large delta and preserves phase with zero delta',async()=>{
 const data=createCoveData(7),world=await createPhysicsWorld(data),cove={data,sampleHeight:(x:number,z:number)=>sampleGrid(data,x,z),sampleNormal:()=>({x:0,y:1,z:0})};
 const c=createTurtleController(cove as any,world,manifest.proxy,manifest);try{
  const before=new Vector3(c.state.position.x,c.state.position.y,c.state.position.z);c.step({...input,right:1},{x:0,y:0,z:-1},.35,100);
  const after=new Vector3(c.state.position.x,c.state.position.y,c.state.position.z);expect(after.distanceTo(before)).toBeLessThan(.13);
  const phase=c.state.animationPhase,position={...c.state.position};c.step(input,{x:0,y:0,z:-1},-.35,0);expect(c.state.animationPhase).toBe(phase);expect(c.state.position).toEqual(position);
 }finally{c.dispose();world.dispose();}
});

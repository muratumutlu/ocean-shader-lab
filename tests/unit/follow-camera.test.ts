import {it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {createFollowCamera} from '../../src/camera/follow-camera';
it('uses bounded follow distances, default reset and collision-first target sweeps',()=>{
 const c=new PerspectiveCamera(34.73,1.6,.03,320),calls:any[]=[];
 const world={sweepSphere:(from:any,to:any,radius:number,exclude:boolean)=>{calls.push({from,to,radius,exclude});return {position:to};}} as any,follow=createFollowCamera(c,world),target={x:0,y:1,z:0};
 follow.setDistance(0);follow.update(target,1);expect(c.position.distanceTo(new Vector3(0,1,0))).toBeCloseTo(1.4);
 follow.setDistance(999);follow.update(target,1);expect(c.position.distanceTo(new Vector3(0,1,0))).toBeCloseTo(12);
 follow.reset();follow.update(target,1);expect(c.position.distanceTo(new Vector3(0,1,0))).toBeCloseTo(4.5);expect(calls.at(-1).exclude).toBe(true);expect(calls.at(-1).radius).toBeGreaterThanOrEqual(.15);
 follow.dispose();expect(follow.update(target,1)).toBe(false);
});
it('pulls the follow camera forward when scenery obstructs the desired orbit',()=>{
 const c=new PerspectiveCamera(34.73,1.6,.03,320),world={sweepSphere:(a:any,b:any)=>({position:{x:a.x+(b.x-a.x)*.4,y:a.y+(b.y-a.y)*.4,z:a.z+(b.z-a.z)*.4}})} as any,follow=createFollowCamera(c,world);
 follow.update({x:0,y:1,z:0},1);expect(c.position.distanceTo(new Vector3(0,1,0))).toBeCloseTo(1.8);follow.dispose();
});

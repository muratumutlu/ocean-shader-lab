import {it,expect} from 'vitest';
import {Vector3,Quaternion} from 'three';
import {crawlPad,rearPad,solveFrontFlipper,solveRearFlipper,createCrawlContacts,CRAWL_FRONT_LIFT} from '../../src/turtle/crawl-pose';
it('both short proximal joints reach their paddles through ground push and lifted recovery',()=>{
 for(const rear of [false,true])for(const side of [-1,1] as const)for(const phase of [.12,.8,1.6,2.4,3.15]){
  const goal=rear?rearPad(phase,side):crawlPad(phase,side),p=rear?solveRearFlipper(side,goal):solveFrontFlipper(side,goal),shoulder=new Vector3(side*(rear?.24:.28),-.02,rear?-.40:.32),first=new Vector3(side*(rear?.07:.16),rear?-.016:-.030,rear?-.05:-.068).applyQuaternion(p.shoulder),end=new Vector3(side*(rear?.23:.40),rear?-.054:-.075,rear?-.16:-.192).applyQuaternion(p.tip).applyQuaternion(p.shoulder).add(first).add(shoulder);
  expect(end.distanceTo(new Vector3(goal.x,goal.y,goal.z))).toBeLessThan(.002);
 }
 const a=crawlPad(.3,-1),b=crawlPad(1.4,-1);expect(a.z-b.z).toBeCloseTo(.35*1.1,4);
});
it('loggerhead sides alternate their power strokes rather than recovering together',()=>{
 for(const phase of [.8,2.4]){const left=crawlPad(phase,-1),right=crawlPad(phase,1);expect(Math.max(left.y,right.y)-Math.min(left.y,right.y)).toBeGreaterThan(CRAWL_FRONT_LIFT*.9);expect(Math.min(left.y,right.y)).toBeCloseTo(-.10);}
 for(const phase of [.1,.8,1.6,2.4,3.1]){const l=crawlPad(phase,-1),r=crawlPad(phase+1.6,1);expect(l.x+r.x).toBeCloseTo(0);expect(l.y).toBeCloseTo(r.y);expect(l.z).toBeCloseTo(r.z);}
});
it('holds the planted side on sloping sand, alternates recovery and lowers all four paddles at rest',()=>{
 const height=(x:number,z:number)=>-.02*x-.18*z,contacts=createCrawlContacts(height),q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),root={x:0,y:.15,z:0};
 const a=contacts.update(.1,root,q,0),b=contacts.update(.9,{...root,z:-.35*.8},q,0),left=a.find(f=>f.limb==='front'&&f.side===-1)!,held=b.find(f=>f.limb==='front'&&f.side===-1)!;
 expect(held.stance).toBe(true);expect(held.position).toEqual(left.position);expect(held.plantId).toBe(left.plantId);expect(held.position.y-height(held.position.x,held.position.z)).toBeCloseTo(.014);
 expect(b.find(f=>f.limb==='front'&&f.side===1)!.stance).toBe(false);expect(b.length).toBe(4);
 const rest=contacts.update(2.5,{...root,z:-.35*2.4},q,1);for(const f of rest){expect(f.stance).toBe(true);expect(f.position.y-height(f.position.x,f.position.z)).toBeCloseTo(.014);}
 contacts.reset();expect(contacts.update(.1,root,q,0)[0].plantId).not.toBe(b[0].plantId);
});

it('paddle frames retain their dorsal surface through reachable forward, side and turn goals',()=>{
 for(const rear of [false,true])for(const side of [-1,1] as const)for(const phase of [.1,.8,1.6,2.4,3.1]){
  const goal=rear?rearPad(phase,side):crawlPad(phase,side),pose=rear?solveRearFlipper(side,goal):solveFrontFlipper(side,goal),up=new Vector3(0,1,0).applyQuaternion(pose.tip).applyQuaternion(pose.shoulder);
  expect(up.y).toBeGreaterThan(.78);
 }
});

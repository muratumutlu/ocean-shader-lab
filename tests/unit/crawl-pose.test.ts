import {it,expect} from 'vitest';
import {Vector3,Quaternion} from 'three';
import {crawlPad,solveFrontFlipper,createCrawlContacts} from '../../src/turtle/crawl-pose';
it('bind-space two-joint flippers reach the pad with an obvious ground push and lifted recovery',()=>{
 for(const side of [-1,1] as const)for(const phase of [.12,.8,1.6,2.4,3.15]){const goal=crawlPad(phase,side),p=solveFrontFlipper(side,goal);const shoulder=new Vector3(side*.28,-.02,.32),first=new Vector3(side*.36,-.067,-.167).applyQuaternion(p.shoulder),end=new Vector3(side*.20,-.038,-.093).applyQuaternion(p.tip).applyQuaternion(p.shoulder).add(first).add(shoulder);expect(end.distanceTo(new Vector3(goal.x,goal.y,goal.z))).toBeLessThan(.002);}
 expect(crawlPad(.2,1).y).toBeCloseTo(-.14);expect(crawlPad(2.5,1).y).toBeGreaterThan(-.06);
 const a=crawlPad(.3,1),b=crawlPad(1.4,1);expect(a.z-b.z).toBeCloseTo(.35*1.1,4);
});
it('holds both planted world pads while the body advances on sloped sand and lowers recovery pads at rest',()=>{
 const height=(x:number,z:number)=>-.02*x-.18*z,contacts=createCrawlContacts(height),q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),root={x:0,y:.25,z:0};const a=contacts.update(.1,root,q,0),b=contacts.update(.9,{...root,z:-.35*.8},q,0);
 expect(a.every(f=>f.stance)).toBe(true);for(let i=0;i<2;i++){expect(b[i].position).toEqual(a[i].position);expect(b[i].position.y-height(b[i].position.x,b[i].position.z)).toBeCloseTo(.014);}
 const rest=contacts.update(2.5,{...root,z:-.35*2.4},q,1);for(const f of rest)expect(f.position.y-height(f.position.x,f.position.z)).toBeCloseTo(.014);
 contacts.reset();expect(contacts.update(.1,root,q,0)[0].plantId).not.toBe(b[0].plantId);
});

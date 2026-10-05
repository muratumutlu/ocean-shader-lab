import {it,expect} from 'vitest';
import {createTurtleTrails} from '../../src/turtle/trails';
import {createTurtleState} from '../../src/turtle/state';
it('imprints actual dry contacts once, bounds GPU instances, freezes duplicate states, and clears on reset/dispose',()=>{
 const t=createTurtleTrails({sampleHeight:()=>1,sampleNormal:()=>({x:0,y:1,z:0})} as any),s=createTurtleState({x:0,y:1.18,z:0});s.previousLocomotion='crawl';s.locomotion='crawl';s.transition=0;s.feet=[{side:1,position:{x:.6,y:1.014,z:.72},stance:true,plantId:'1'}];
 t.update(s,0,0);const first=t.diagnostics().active;expect(first).toBeGreaterThan(0);for(let i=0;i<30;i++)t.update(s,0,0);expect(t.diagnostics().active).toBe(first);
 for(let i=0;i<250;i++){s.feet[0].plantId=String(i+2);s.position.z+=.2;t.update(s,i*.016,0);}expect(t.diagnostics().active).toBeLessThanOrEqual(96);expect(t.group.children.length).toBe(1);
 t.reset();expect(t.diagnostics().active).toBe(0);s.previousLocomotion='swim';t.update(s,10,0);expect(t.diagnostics().active).toBe(0);t.dispose();t.dispose();expect(t.diagnostics().disposed).toBe(true);
});

it('front and rear contact identities remain distinct and rear tracks originate at their own ground contacts',()=>{
 const t=createTurtleTrails({sampleHeight:()=>1,sampleNormal:()=>({x:0,y:1,z:0})} as any),s=createTurtleState({x:0,y:1.15,z:0});
 s.previousLocomotion='crawl';s.locomotion='crawl';s.transition=0;
 s.feet=[{side:1,limb:'front',position:{x:.60,y:1.014,z:.72},stance:true,plantId:'same'}, {side:1,limb:'rear',position:{x:.49,y:1.014,z:-.245},stance:true,plantId:'same'}];
 try{
  t.update(s,0,0);expect(t.diagnostics().active).toBe(2);
  const mesh=t.group.children[0] as any,values=mesh.instanceMatrix.array;
  expect(values[12]).toBeCloseTo(.60);expect(values[14]).toBeCloseTo(.72);expect(values[28]).toBeCloseTo(.49);expect(values[30]).toBeCloseTo(-.245);
  t.update(s,1,0);expect(t.diagnostics().active).toBe(2);
  s.feet[1].stance=false;s.feet[1].plantId='lifted';t.update(s,2,0);expect(t.diagnostics().active).toBe(2);
  s.position.y=1.5;s.position.z=.25;s.feet=[];t.update(s,3,0);expect(t.diagnostics().active).toBe(2);
 }finally{t.dispose();}
});


it('joins consecutive near-ground contact positions and breaks the trace across raised recovery',()=>{
 const t=createTurtleTrails({sampleHeight:()=>1,sampleNormal:()=>({x:0,y:1,z:0})} as any),s=createTurtleState({x:0,y:1.3,z:0});s.previousLocomotion='crawl';s.transition=0;
 s.feet=[{side:1,limb:'rear',position:{x:.49,y:1.014,z:0},stance:true,plantId:'press'}];
 try{
  t.update(s,0,0);s.feet[0].stance=false;s.feet[0].position.z=.05;t.update(s,.05,0);expect(t.diagnostics().active).toBe(2);
  const mesh=t.group.children[0] as any,values=mesh.instanceMatrix.array;expect(values[28]).toBeCloseTo(.49);expect(values[30]).toBeCloseTo(.025);expect(mesh.geometry.attributes.imprint.getY(1)).toBe(4);
  s.feet[0].position.y=1.14;s.feet[0].position.z=.10;t.update(s,.1,0);expect(t.diagnostics().active).toBe(2);
  s.feet[0].position.y=1.014;s.feet[0].position.z=.15;t.update(s,.15,0);expect(t.diagnostics().active).toBe(2);
  s.feet[0].position.z=.20;t.update(s,.20,0);expect(t.diagnostics().active).toBe(3);
 }finally{t.dispose();}
});

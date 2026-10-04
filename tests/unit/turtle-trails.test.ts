import {it,expect} from 'vitest';
import {createTurtleTrails} from '../../src/turtle/trails';
import {createTurtleState} from '../../src/turtle/state';
it('imprints actual dry contacts once, bounds GPU instances, freezes duplicate states, and clears on reset/dispose',()=>{
 const t=createTurtleTrails({sampleHeight:()=>1,sampleNormal:()=>({x:0,y:1,z:0})} as any),s=createTurtleState({x:0,y:1.18,z:0});s.previousLocomotion='crawl';s.locomotion='crawl';s.transition=0;s.feet=[{side:1,position:{x:.6,y:1.014,z:.72},stance:true,plantId:'1'}];
 t.update(s,0,0);const first=t.diagnostics().active;expect(first).toBeGreaterThan(0);for(let i=0;i<30;i++)t.update(s,0,0);expect(t.diagnostics().active).toBe(first);
 for(let i=0;i<250;i++){s.feet[0].plantId=String(i+2);s.position.z+=.2;t.update(s,i*.016,0);}expect(t.diagnostics().active).toBeLessThanOrEqual(96);expect(t.group.children.length).toBe(1);
 t.reset();expect(t.diagnostics().active).toBe(0);s.previousLocomotion='swim';t.update(s,10,0);expect(t.diagnostics().active).toBe(0);t.dispose();t.dispose();expect(t.diagnostics().disposed).toBe(true);
});

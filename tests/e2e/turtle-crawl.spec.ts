import {test,expect} from '@playwright/test';
const input={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};
test('actual loggerhead rig holds the planted side while the opposite front paddle recovers',async({page})=>{
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 await page.evaluate(i=>{const a=window.__cove;a.stepTurtle(i,[0,0,-1],1500);for(let n=0;n<250;n++){const p=a.turtleState().crawlPhase%3.2;if(p>.60&&p<.66)break;a.stepTurtle(i,[0,0,-1]);}},input);
 const before=await page.evaluate(()=>({state:window.__cove.turtleState(),feet:window.__cove.turtleFeet()}));
 expect(before.state.previousLocomotion).toBe('crawl');expect(before.feet.length).toBe(4);
 const left=before.feet.find((f:any)=>f.limb==='front'&&f.side===-1),right=before.feet.find((f:any)=>f.limb==='front'&&f.side===1);
 expect(left.stance).toBe(true);expect(right.stance).toBe(false);for(const f of before.feet)expect(f.error).toBeLessThan(.008);
 await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,-1],24),input);
 const after=await page.evaluate(()=>({feet:window.__cove.turtleFeet(),contact:window.__cove.turtleContact()}));
 const held=after.feet.find((f:any)=>f.limb==='front'&&f.side===-1);expect(held.plantId).toBe(left.plantId);expect(held.goal).toEqual(left.goal);expect(held.height).toBeCloseTo(.014,2);for(const f of after.feet)expect(f.error).toBeLessThan(.008);
 await page.evaluate(i=>{const a=window.__cove;for(let n=0;n<260;n++){a.stepTurtle(i,[0,0,-1]);const phase=a.turtleState().crawlPhase%3.2;if(phase>2.45&&phase<2.51)break;}},input);
 const recovery=await page.evaluate(()=>({feet:window.__cove.turtleFeet(),contact:window.__cove.turtleContact()}));
 const lifted=recovery.feet.find((f:any)=>f.limb==='front'&&f.side===-1),planted=recovery.feet.find((f:any)=>f.limb==='front'&&f.side===1);
 expect(lifted.stance).toBe(false);expect(lifted.height).toBeGreaterThan(.09);expect(planted.stance).toBe(true);expect(planted.height).toBeCloseTo(.014,2);for(const f of recovery.feet)expect(f.error).toBeLessThan(.008);
 expect(recovery.contact.min).toBeGreaterThan(-.018);expect(recovery.contact.min).toBeLessThan(.06);
});
test('real dry sand imprints are visible, bounded, pause-stable and cleared by reset and reload',async({page})=>{
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const result=await page.evaluate(i=>{const a=window.__cove;a.stepTurtle(i,[0,0,-1],1650);const mesh=a.trails.group.children[0],m=mesh.instanceMatrix.array,n=Math.max(0,mesh.count-1),marker={x:m[n*16+12],y:m[n*16+13],z:m[n*16+14]};a.stepTurtle(i,[0,0,-1],400);const h=a.cove.sampleHeight(marker.x,marker.z);a.setPose([marker.x,h+3.8,marker.z+1],[marker.x,h,marker.z]);a.render();const point=[marker.x,h+.005,marker.z],withTrails=a.readWorldPixel(point),before=a.trails.diagnostics();a.trails.group.visible=false;a.render();const without=a.readWorldPixel(point);a.trails.group.visible=true;a.render();return {withTrails,without,before,renderer:a.metadata(),point};},input);
 expect(result.before.active).toBeGreaterThan(0);expect(result.before.active).toBeLessThanOrEqual(96);
 const marked=result.withTrails.reduce((a:number,b:number)=>a+b,0),sand=result.without.reduce((a:number,b:number)=>a+b,0);expect(marked).toBeLessThan(sand-5);expect(marked).toBeGreaterThan(sand*.6);
 await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,-1],0),input);expect(await page.evaluate(()=>window.__cove.trails.diagnostics().active)).toBe(result.before.active);
 await page.evaluate(()=>window.__cove.resetTurtle());expect(await page.evaluate(()=>window.__cove.trails.diagnostics().active)).toBe(0);
 await page.reload();await page.waitForFunction(()=>window.__cove?.ready);expect(await page.evaluate(()=>window.__cove.trails.diagnostics().active)).toBe(0);
});

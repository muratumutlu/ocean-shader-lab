import {test,expect} from '@playwright/test';
test('current capture cache, finite underwater path and owned target budget',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);
 const first=await page.evaluate(()=>window.__cove.diagnostics());expect(first.coastCaptures).toBeGreaterThan(0);await page.evaluate(()=>window.__cove.render());const fixed=await page.evaluate(()=>window.__cove.diagnostics());expect(fixed.coastCaptures).toBe(first.coastCaptures);
 await page.evaluate(()=>window.__cove.setPose([21.05,12,32.64],[0,2.22,1.48]));const moved=await page.evaluate(()=>window.__cove.diagnostics());expect(moved.coastCaptures).toBe(fixed.coastCaptures+1);
 await page.evaluate(()=>window.__cove.setView('underwater'));const submerged=await page.evaluate(()=>window.__cove.diagnostics());expect(submerged.underwaterFrames).toBeGreaterThan(0);expect(submerged.targetBytes).toBeLessThanOrEqual(96*1024*1024);expect(submerged.drawCalls).toBeLessThanOrEqual(20);expect(errors).toEqual([]);
});

test('a moving half submerged opaque object retains current dry and wet depth',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);
 await page.evaluate(()=>{window.__cove.setPose([3,2,8],[0,0,3]);window.__cove.setProbe([0,0,3]);});
 const c=page.locator('#cove'),before=await c.screenshot(),d=await page.evaluate(()=>window.__cove.diagnostics());
 const dry=await page.evaluate(()=>window.__cove.readWorldPixel([0,.25,3.27]));expect(dry[0]).toBeGreaterThan(dry[1]*1.4);
 await page.evaluate(()=>window.__cove.setProbe([1,0,3]));const after=await page.evaluate(()=>window.__cove.diagnostics());expect(after.coastCaptures).toBe(d.coastCaptures);expect(after.dynamicCaptures).toBeGreaterThan(d.dynamicCaptures);expect((await c.screenshot()).equals(before)).toBe(false);
 await page.evaluate(()=>window.__cove.setView('underwater'));expect((await page.evaluate(()=>window.__cove.diagnostics())).submerged).toBe(true);
 await page.evaluate(()=>window.__cove.setPose([0,.5,6],[0,0,0]));expect((await page.evaluate(()=>window.__cove.diagnostics())).submerged).toBe(false);expect(errors).toEqual([]);
});

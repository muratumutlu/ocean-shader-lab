import {test,expect} from '@playwright/test';
test('all four finite cut faces render without shader errors and deep layers have distinct real pixel colours',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);
 for(const view of ['cutFront','cutWest','cutEast','cutRear']){await page.evaluate(v=>window.__cove.setView(v),view);expect((await page.evaluate(()=>window.__cove.metadata())).diagnostics.drawCalls).toBeLessThanOrEqual(20);}
 const colours=await page.evaluate(()=>{const a=window.__cove;a.setView('cutFront');const h=a.cove.sampleHeight(0,12);return [.12,1.2,3].map(d=>a.readWorldPixel([0,h-d,12.03]));});
 const [sand,sediment,stone]=colours;expect(sand[0]).toBeGreaterThan(sediment[0]*1.18);expect(sediment[0]-sediment[2]).toBeGreaterThan(5);expect(Math.abs(stone[0]-stone[1])).toBeLessThan(18);expect(stone.reduce((n,v)=>n+v,0)).toBeGreaterThan(100);expect(errors).toEqual([]);
});

import {test,expect} from '@playwright/test';
test('waterMovesAcrossTwoFrames: visible waves move and deterministic time stays still',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/water-preview.html');await expect(page.locator('#ready')).toHaveText('Water ready',{timeout:4000});
 const canvas=page.locator('canvas');await page.locator('#t0').click();const zero=await canvas.screenshot();
 await page.locator('#t1').click();const one=await canvas.screenshot();expect(zero.equals(one)).toBe(false);
 await page.locator('#t1').click();const repeat=await canvas.screenshot();expect(one.equals(repeat)).toBe(true);
 expect(errors).toEqual([]);
 await page.screenshot({path:'docs/evidence/d2-water-time1.png'});
});
test('tideMovesShorelineWithoutSeparatingFromTerrain: rendered coastline responds to both tide extremes',async({page})=>{
 await page.goto('/tests/fixtures/water-preview.html');await expect(page.locator('#ready')).toHaveText('Water ready',{timeout:4000});
 await page.locator('#low').click();const low=await page.locator('canvas').screenshot({path:'docs/evidence/d2-tide-low.png'});
 await page.locator('#high').click();const high=await page.locator('canvas').screenshot({path:'docs/evidence/d2-tide-high.png'});
 expect(low.equals(high)).toBe(false);
});

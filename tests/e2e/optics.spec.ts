import {createHash} from 'node:crypto';
import {test,expect} from '@playwright/test';
test('submerged color remains visible through refracting surface at fixed time',async({page})=>{
 await page.goto('/tests/fixtures/water-preview.html');await expect(page.locator('#ready')).toHaveText('Water ready');
 await page.getByRole('button',{name:'Red seabed'}).click();const red=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());
 await page.getByRole('button',{name:'Blue seabed'}).click();const blue=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());
 expect(createHash('sha256').update(red).digest('hex')).not.toBe(createHash('sha256').update(blue).digest('hex'));
 await page.getByRole('button',{name:'Red seabed'}).click();expect(await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).toBe(red);
});

test('static coast is not redrawn for every moving water frame',async({page})=>{
 await page.addInitScript(()=>{let calls=0;for(const name of ['drawElements','drawArrays'] as const){const original=WebGL2RenderingContext.prototype[name];(WebGL2RenderingContext.prototype as any)[name]=function(...args:any[]){calls++;return (original as any).apply(this,args);};}Object.defineProperty(window,'__opticsDrawCalls',{get:()=>calls});});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Coast settings'}).click();await page.getByLabel('Quality').selectOption('low');await page.getByRole('button',{name:'Play waves',exact:true}).click();
 const stats=await page.evaluate(async()=>{let last=(window as any).__opticsDrawCalls,max=0,frames=0,start=performance.now();await new Promise<void>(resolve=>{const sample=(now:number)=>{const next=(window as any).__opticsDrawCalls;if(next!==last){max=Math.max(max,next-last);frames++;last=next;}if(now-start<700)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample);});return {max,frames};});
 expect(stats.frames).toBeGreaterThan(1);expect(stats.max).toBeLessThanOrEqual(4);
});

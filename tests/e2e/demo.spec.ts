import {test,expect} from '@playwright/test';
test('reduced motion starts still, Play moves and Pause freezes the real canvas',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.getByRole('button',{name:'Play waves',exact:true})).toBeVisible();
 const canvas=page.locator('#ocean');const a=await canvas.screenshot();await page.waitForTimeout(120);const b=await canvas.screenshot();expect(a.equals(b)).toBe(true);
 await page.getByRole('button',{name:'Play waves',exact:true}).click();await page.waitForTimeout(150);const c=await canvas.screenshot();expect(b.equals(c)).toBe(false);
 await page.getByRole('button',{name:'Pause waves',exact:true}).click();const d=await canvas.screenshot();await page.waitForTimeout(150);const e=await canvas.screenshot();expect(d.equals(e)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:'docs/evidence/demo-desktop.png'});
});
test('controls work on mobile and high quality survives resize',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Coast settings'}).click();
 await page.getByLabel('Quality').selectOption('high');await page.setViewportSize({width:430,height:880});await expect(page.getByLabel('Quality')).toHaveValue('high');
 await page.getByLabel('Water level').fill('0.35');await expect(page.locator('#tide-value')).toHaveText('+0.35');
 await page.getByRole('button',{name:'Coast settings'}).click();await page.screenshot({path:'docs/evidence/demo-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('WebGL absence provides a readable fallback',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(type==='webgl2')return null;return (original as any).call(this,type,...args);} as any;});
 await page.goto('/');await expect(page.locator('#fallback')).toBeVisible();await expect(page.getByRole('button',{name:'Try the live scene again'})).toBeVisible();await page.screenshot({path:'docs/evidence/demo-fallback.png'});
});
test('context loss stops the scene and retry creates a working scene',async({page})=>{
 await page.goto('/');await expect(page.locator('#scene-status')).toContainText('LIVE');
 await page.locator('#ocean').evaluate((canvas:HTMLCanvasElement)=>{const gl=canvas.getContext('webgl2');gl?.getExtension('WEBGL_lose_context')?.loseContext();});
 await expect(page.locator('#fallback')).toBeVisible();await page.getByRole('button',{name:'Try the live scene again'}).click();await expect(page.locator('#fallback')).toBeHidden();await expect(page.locator('#scene-status')).toContainText('LIVE');
});

import {createHash} from 'node:crypto';
import {test,expect} from '@playwright/test';
const pixels=async(page:any)=>createHash('sha256').update(await page.locator('#ocean').evaluate((el:HTMLCanvasElement)=>el.toDataURL())).digest('hex');
test('a missing turtle asset leaves the rendered coast and free controls available with Retry',async({page})=>{
 await page.route('**/assets/turtle.glb',r=>r.fulfill({status:404,body:''}));await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await expect(page.locator('#ocean')).toHaveAttribute('aria-busy','false');await expect(page.locator('#mode-turtle')).toBeDisabled();await expect(page.locator('#turtle-retry')).toBeVisible();await expect(page.locator('#fallback')).toBeHidden();
 expect(await pixels(page)).toHaveLength(64);
});
test('turtle mode, pause and reset use real controls without losing the free camera',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#mode-turtle')).toBeEnabled();const c=page.locator('#ocean');
 const free=await pixels(page);await page.locator('#mode-turtle').click();await expect(page.locator('#mode-turtle')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#return-turtle')).toBeVisible();await c.click({position:{x:600,y:350}});
 const paused=await pixels(page);await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');expect(await pixels(page)).toBe(paused);
 await page.locator('#play').click();await c.focus();await page.keyboard.down('KeyW');await page.waitForTimeout(450);await page.keyboard.up('KeyW');expect(await pixels(page)).not.toBe(paused);
 await page.locator('#play').click();for(let i=0;i<5;i++){await page.locator('#return-turtle').click();await page.locator('#mode-camera').click();await page.locator('#mode-turtle').click();}
 await page.locator('#mode-camera').click();await expect(page.locator('#mode-camera')).toHaveAttribute('aria-pressed','true');expect(await pixels(page)).not.toBe(paused);await expect(page.locator('#fallback')).toBeHidden();expect(free).toHaveLength(64);
});
test('touch movement is available on a narrow coarse-pointer viewport and pause freezes it',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();try{
 await page.goto('/');await expect(page.locator('#mode-turtle')).toBeEnabled();await expect(page.locator('#mode-turtle')).toBeVisible();await page.locator('#mode-turtle').click();await expect(page.locator('#turtle-touch')).toBeVisible();
 const before=await pixels(page);await page.locator('#play').click();const box=await page.getByRole('button',{name:'Swim or crawl forward',exact:true}).boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();await page.locator('#play').click();
 expect(await pixels(page)).not.toBe(before);const stopped=await pixels(page);await page.waitForTimeout(150);expect(await pixels(page)).toBe(stopped);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
test('a failed actual WASM initialization leaves a coast and Retry restores navigation',async({page})=>{
 await page.addInitScript(()=>{const original=WebAssembly.instantiate;let first=true;(WebAssembly as any).instantiate=(...args:any[])=>{if(first){first=false;return Promise.reject(Error('QA initialization failure'));}return (original as any).apply(WebAssembly,args);};});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#navigation-retry')).toBeVisible();await expect(page.locator('#mode-turtle')).toBeDisabled();await expect(page.locator('#fallback')).toBeHidden();
 const before=await pixels(page);await page.locator('#ocean').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');expect(await pixels(page)).toBe(before);
 await page.locator('#navigation-retry').click();await expect(page.locator('#mode-turtle')).toBeEnabled();await expect(page.locator('#navigation-retry')).toBeHidden();
});
test('real turtle geometry moves with fixed water phase and keeps its dry skin above the shared beach',async({page})=>{
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const input={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};
 const a=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,-1],120),input);const b=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());expect(createHash('sha256').update(a).digest('hex')).not.toBe(createHash('sha256').update(b).digest('hex'));expect(await page.evaluate(()=>window.__cove.metadata().time)).toBe(0);
 await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,-1],1280),input);const state=await page.evaluate(()=>window.__cove.turtleState()),contact=await page.evaluate(()=>window.__cove.turtleContact());expect(state.previousLocomotion).toBe('crawl');expect(contact.min).toBeGreaterThanOrEqual(-.015);expect(contact.min).toBeLessThan(.045);
});
test('a dry contact shadow is blended onto cached sand instead of disappearing in opaque depth composition',async({page})=>{
 await page.goto('/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const result=await page.evaluate(()=>{const a=window.__cove,input={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};a.stepTurtle(input,[0,0,-1],1400);const s=a.turtleState(),p=s.position; a.setPose([p.x,p.y+3,p.z],[p.x,p.y,p.z]);a.render();const probe=[p.x+.50,a.cove.sampleHeight(p.x+.50,p.z),p.z],withShadow=a.readWorldPixel(probe),before=a.diagnostics();a.scene.getObjectByName('turtle-contact-shadow').visible=false;a.render();return {withShadow,withoutShadow:a.readWorldPixel(probe),before,after:a.diagnostics()};});
 expect(result.before.coastCaptures).toBe(result.after.coastCaptures);const shade=result.withShadow.reduce((a:number,b:number)=>a+b,0),sand=result.withoutShadow.reduce((a:number,b:number)=>a+b,0);expect(shade).toBeLessThan(sand-5);expect(shade).toBeGreaterThan(sand*.65);
});

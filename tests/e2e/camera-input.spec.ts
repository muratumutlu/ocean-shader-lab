import {test,expect,type Locator} from '@playwright/test';
const pixels=(canvas:Locator)=>canvas.evaluate(el=>(el as HTMLCanvasElement).toDataURL());
test.beforeEach(async({page},info)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(new URL(r.url()).pathname+': '+r.failure()?.errorText));try{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#ocean')).toHaveAttribute('aria-busy','false');}finally{await info.attach('startup-errors',{body:JSON.stringify(errors),contentType:'application/json'});}});
test('focused arrows move the paused view and blur clears held movement',async({page})=>{
 const c=page.locator('#ocean');await c.click({position:{x:640,y:350}});const before=await pixels(c);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');expect(await pixels(c)).not.toBe(before);
 await page.keyboard.down('KeyW');await page.locator('#settings').focus();const stopped=await pixels(c);await page.waitForTimeout(350);expect(await pixels(c)).toBe(stopped);await page.keyboard.up('KeyW');
 await expect(page.locator('#fallback')).toBeHidden();
});
test('forms keep native arrows and a wheel outside the scene does not zoom',async({page})=>{
 await page.locator('#settings').click();await page.locator('#tide').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#tide')).toHaveValue('0.01');
 await page.locator('#settings').click();await page.locator('#settings').focus();const c=page.locator('#ocean'),before=await pixels(c);const r=await page.locator('h1').boundingBox();await page.mouse.move(r!.x+5,r!.y+5);await page.mouse.wheel(0,400);expect(await pixels(c)).toBe(before);
});
test('deep scroll and rear orbit render valid pixels',async({page})=>{
 const c=page.locator('#ocean');await c.click({position:{x:640,y:350}});const initial=await pixels(c);await page.mouse.wheel(0,-1800);await page.waitForTimeout(150);expect(await pixels(c)).not.toBe(initial);
 await page.mouse.move(700,300);await page.mouse.down();await page.mouse.move(1150,300,{steps:10});await page.mouse.up();await page.waitForTimeout(100);await expect(page.locator('#fallback')).toBeHidden();
});

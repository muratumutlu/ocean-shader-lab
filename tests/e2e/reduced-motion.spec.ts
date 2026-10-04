import {test,expect,type Page} from '@playwright/test';

async function canvasPixels(page:Page){return page.locator('#ocean').evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL());}

test('enabling reduced motion during playback pauses actual canvas and explicit Play overrides it',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');
 await expect(page.getByRole('button',{name:'Pause waves',exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play waves',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Play waves',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#scene-status')).toContainText('PAUSED');
 const paused=await canvasPixels(page);await page.waitForTimeout(200);expect(await canvasPixels(page)).toBe(paused);
 await page.getByRole('button',{name:'Play waves',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause waves',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#scene-status')).toContainText('LIVE');
 await expect.poll(()=>canvasPixels(page)).not.toBe(paused);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await expect(page.getByRole('button',{name:'Pause waves',exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play waves',exact:true})).toBeVisible();
 const pausedAgain=await canvasPixels(page);await page.waitForTimeout(200);expect(await canvasPixels(page)).toBe(pausedAgain);
});

test('removing reduced motion preserves manual pause and explicit resume survives scene retry',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await page.getByRole('button',{name:'Play waves',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause waves',exact:true})).toBeVisible();
 await page.locator('#ocean').evaluate((canvas:HTMLCanvasElement)=>canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
 await expect(page.locator('#fallback')).toBeVisible();await page.getByRole('button',{name:'Try the live scene again'}).click();
 await expect(page.locator('#fallback')).toBeHidden();await expect(page.getByRole('button',{name:'Pause waves',exact:true})).toBeVisible();
 await expect(page.locator('#scene-status')).toContainText('LIVE');
 const resumed=await canvasPixels(page);await expect.poll(()=>canvasPixels(page)).not.toBe(resumed);
 await page.getByRole('button',{name:'Pause waves',exact:true}).click();
 await page.emulateMedia({reducedMotion:'no-preference'});
 await expect(page.getByRole('button',{name:'Play waves',exact:true})).toHaveAttribute('aria-pressed','false');
 const paused=await canvasPixels(page);await page.waitForTimeout(200);expect(await canvasPixels(page)).toBe(paused);
});

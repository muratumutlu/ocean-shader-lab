import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
test('persisted history restoration rebuilds a scene that still responds to Play',async({page})=>{
 await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.drawElements;let count=0;WebGL2RenderingContext.prototype.drawElements=function(...args){count++;return original.apply(this,args);};Object.defineProperty(window,'__historyRenders',{get:()=>count});});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Play waves',exact:true}).waitFor();await page.waitForTimeout(100);const initial=await page.evaluate(()=>(window as any).__historyRenders);
 await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await expect.poll(()=>page.evaluate(()=>(window as any).__historyRenders)).toBeGreaterThan(initial);const before=await page.locator('#ocean').screenshot();await page.getByRole('button',{name:'Play waves',exact:true}).click();await page.waitForTimeout(200);const after=await page.locator('#ocean').screenshot();expect(before.equals(after)).toBe(false);
});
test('first GPU render exception unwinds canvas and visibility listeners before fallback',async({page})=>{
 await page.addInitScript(()=>{
  const entries:{target:EventTarget;type:string;fn:any}[]=[];const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener=function(type,fn,options){if((this instanceof HTMLCanvasElement&&type.startsWith('webglcontext'))||(this===document&&type==='visibilitychange'))entries.push({target:this,type,fn});return add.call(this,type,fn,options);};
  EventTarget.prototype.removeEventListener=function(type,fn,options){for(let i=entries.length-1;i>=0;i--)if(entries[i].target===this&&entries[i].type===type&&entries[i].fn===fn)entries.splice(i,1);return remove.call(this,type,fn,options);};
  Object.defineProperty(window,'__graphicsListeners',{get:()=>entries.length});
  const draw=WebGL2RenderingContext.prototype.drawElements;let first=true;
  WebGL2RenderingContext.prototype.drawElements=function(...args){if(first){first=false;throw new Error('Injected first GPU render failure');}return draw.apply(this,args);};
 });
 await page.goto('/');await expect(page.locator('#fallback')).toBeVisible();expect(await page.evaluate(()=>(window as any).__graphicsListeners)).toBe(0);
 await page.getByRole('button',{name:'Try the live scene again'}).click();await expect(page.locator('#fallback')).toBeHidden();
});
test('retry reapplies current tide, swell and sunlight to the rendered scene',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Coast settings'}).click();await page.getByLabel('Water level').fill('0.35');await page.getByLabel('Wave swell').fill('0.8');await page.getByLabel('Sun direction').fill('35');await page.getByRole('button',{name:'Coast settings'}).click();
 await expect(page.locator('#ocean')).toHaveAttribute('aria-busy','false');const before=createHash('sha256').update(await page.locator('#ocean').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).digest('hex');
 await page.locator('#ocean').evaluate((c:HTMLCanvasElement)=>c.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());await expect(page.locator('#fallback')).toBeVisible();await page.getByRole('button',{name:'Try the live scene again'}).click();await expect(page.locator('#fallback')).toBeHidden();
 await expect(page.locator('#ocean')).toHaveAttribute('aria-busy','false');const after=createHash('sha256').update(await page.locator('#ocean').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).digest('hex');expect(after).toBe(before);
});
test('graphics fallback retains prompt navigation',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(type==='webgl2')return null;return (get as any).call(this,type,...args);} as any;});
 await page.goto('/');await expect(page.locator('#fallback')).toBeVisible();await expect(page.getByRole('link',{name:'Read the full prompt'})).toHaveAttribute('href','/PROMPT.md');await expect(page.getByRole('link',{name:'View source on GitHub ↗'})).toBeVisible();
});
test('shader compilation failure presents fallback and retry recovers',async({page})=>{
 await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.shaderSource;let first=true;WebGL2RenderingContext.prototype.shaderSource=function(shader,source){if(first){first=false;return original.call(this,shader,'invalid shader source');}return original.call(this,shader,source);};});
 await page.goto('/');await expect(page.locator('#fallback')).toBeVisible();await page.getByRole('button',{name:'Try the live scene again'}).click();await expect(page.locator('#fallback')).toBeHidden();
});
test('fullscreen rejection offers a user-clickable standalone link',async({page})=>{
 await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Fullscreen denied'));});
 await page.goto('/');await page.getByRole('button',{name:'Full screen',exact:true}).click();await expect(page.getByRole('link',{name:'Open the standalone view'})).toBeVisible();
});

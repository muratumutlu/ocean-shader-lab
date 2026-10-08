import {test,expect,type Page} from '@playwright/test';

// Buys every upgrade through the real HUD with human-speed clicks, including during the break that
// follows a session (when the timer repaints every second). Regression for lost shop clicks.
type Save={version:1;currentRegionId:string;regions:Record<string,{money:number;owned:string[]}>;unlocked:string[];active:null;history:[]};
async function start(page:Page,save:Save){
 await page.goto('/game.html');
 await page.evaluate(s=>localStorage.setItem('ocean-focus-save-v1',JSON.stringify(s)),save);
 await page.reload();
 await page.waitForFunction(()=>(window as unknown as {oceanFocus?:{scene?:unknown}}).oceanFocus?.scene,null,{timeout:20000});
}
async function humanClick(page:Page,selector:string){
 const box=await page.locator(selector).first().boundingBox();
 if(!box)throw Error('Nothing to click: '+selector);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();
}
const owned=(page:Page,region:string)=>page.evaluate(r=>(window as unknown as {oceanFocus:{host:{save:Save}}}).oceanFocus.host.save.regions[r]?.owned.length??0,region);
async function finishSessionIntoBreak(page:Page){
 await page.evaluate(()=>{const o=(window as unknown as {oceanFocus:{host:{startFocus(m:number):void};finish():void}}).oceanFocus;o.host.startFocus(15);o.finish();});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {oceanFocus:{host:{save:{active:{kind:string}|null}}}}).oceanFocus.host.save.active?.kind)).toBe('break');
}
async function buyEverything(page:Page,region:string,total:number){
 await page.locator('.focus-upgrades-toggle').click();
 // Let the panel's pop-in animation settle so measured button positions are final.
 await page.waitForTimeout(500);
 for(let bought=await owned(page,region);bought<total;){
  await humanClick(page,'.focus-shop .focus-price:not([disabled])');
  await expect.poll(()=>owned(page,region)).toBe(bought+1);bought++;
 }
 await expect(page.locator('.focus-shop .focus-price')).toHaveCount(0);
 await expect(page.locator('.focus-shop')).toContainText('You own everything here!');
}

test('every Mediterranean and Arctic upgrade can be bought during a break',async({page})=>{
 test.setTimeout(90_000);
 await start(page,{version:1,currentRegionId:'med',regions:{med:{money:20_000,owned:[]}},unlocked:['med'],active:null,history:[]});
 await finishSessionIntoBreak(page);
 await buyEverything(page,'med',18);
 // Move north with the coins left and do it again.
 await humanClick(page,'.focus-shop .focus-item:has-text("Arctic") .focus-go');
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {oceanFocus:{host:{save:Save}}}).oceanFocus.host.save.currentRegionId)).toBe('arctic');
 await page.evaluate(()=>{const o=(window as unknown as {oceanFocus:{host:{save:Save}}}).oceanFocus;o.host.save.regions.arctic.money=40_000;});
 await page.locator('.focus-upgrades-toggle').click();
 await buyEverything(page,'arctic',18);
});

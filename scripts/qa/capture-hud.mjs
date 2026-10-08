// HUD audit: captures every HUD state at desktop and phone sizes for a consistency review.
import {chromium} from '@playwright/test';
const out=process.argv[2]??'output/hud-qa';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
for(const [label,viewport] of [['desk',{width:1280,height:800}],['phone',{width:430,height:900}]]){
 const page=await browser.newPage({viewport,deviceScaleFactor:label==='phone'?2:1});
 page.on('pageerror',e=>console.error('pageerror',e.message));
 await page.goto('http://127.0.0.1:4173/game.html');
 await page.evaluate(()=>localStorage.removeItem('ocean-focus-save-v1'));await page.reload();
 await page.waitForFunction(()=>window.oceanFocus?.scene,null,{timeout:20000});await page.waitForTimeout(2500);
 const shot=name=>page.screenshot({path:`${out}/${label}-${name}.png`});
 await page.evaluate(()=>{oceanFocus.host.save.regions.med.money=260;oceanFocus.host.buy('med.eq.sturdy-line');});await page.waitForTimeout(400);
 await shot('1-idle');
 await page.click('.focus-gear');await page.waitForTimeout(400);await shot('2-settings');await page.click('.focus-gear');
 await page.click('.focus-upgrades-toggle');await page.waitForTimeout(400);await shot('3-shop');await page.click('.focus-upgrades-toggle');
 await page.click('.focus-go');await page.waitForTimeout(900);await shot('4-fishing');
 await page.click('.focus-giveup');await page.waitForTimeout(300);await shot('5-confirm');
 await page.click('.focus-confirm .focus-go');
 await page.evaluate(()=>oceanFocus.finish());await page.waitForTimeout(1200);await shot('6-break-toast');
 await page.close();
}
await browser.close();

// Visual QA for the fishing game: drives a session through catch, sale and spill and saves frames.
// Usage: node scripts/qa/capture-game.mjs [outDir]   (dev server on 127.0.0.1:4173)
import {chromium} from '@playwright/test';
const out=process.argv[2]??'output/game-qa';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>console.error('pageerror',e.message));
await page.goto('http://127.0.0.1:4173/?mode=game');
await page.evaluate(()=>localStorage.removeItem('ocean-focus-save-v1'));
await page.reload();
await page.waitForFunction(()=>window.oceanFocus?.scene,null,{timeout:20000});
await page.waitForTimeout(2500);
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});console.log('saved',name,JSON.stringify(await page.evaluate(()=>oceanFocus.scene.debug())));};
await shot('01-idle');
await page.click('.focus-gear');await page.waitForTimeout(300);await shot('01c-settings');await page.click('.focus-gear');
await page.evaluate(()=>{oceanFocus.host.save.regions.med.money=400;});await page.click('.focus-top .focus-round');await page.waitForTimeout(300);await shot('01d-shop');await page.click('.focus-top .focus-round');
await page.waitForTimeout(4000);await shot('01b-life');
await page.evaluate(()=>oceanFocus.host.startFocus(25));
await page.waitForTimeout(1600);await shot('02-cast');
// Fast-forward to 60% so several fish are caught.
await page.evaluate(()=>{const a=oceanFocus.host.save.active;const span=a.endsAt-a.startedAt;a.startedAt-=span*.6;a.endsAt-=span*.6;});
await page.waitForTimeout(700);await shot('03-catch-arc');
await page.waitForTimeout(4500);await shot('04-bucket');
await page.evaluate(()=>oceanFocus.finish());
await page.waitForTimeout(1600);await shot('05-sailing');
await page.waitForTimeout(2200);await shot('06-landing');
await page.waitForTimeout(900);await shot('07-fish-to-stall');
await page.waitForTimeout(1200);await shot('08-coins');
await page.waitForTimeout(6000);await shot('09-back');
// Spill: abandon a session after some catches.
await page.evaluate(()=>{oceanFocus.host.abandon();oceanFocus.host.startFocus(25);});
await page.waitForTimeout(1500);
await page.evaluate(()=>{const a=oceanFocus.host.save.active;const span=a.endsAt-a.startedAt;a.startedAt-=span*.5;a.endsAt-=span*.5;});
await page.waitForTimeout(5000);
await page.evaluate(()=>oceanFocus.host.abandon());
await page.waitForTimeout(900);await shot('10-spill');
await page.waitForTimeout(1200);await shot('11-splash');
// Upgrades: fund the save and buy everything in catalog order, capturing each boat tier.
await page.waitForTimeout(3000);
await page.evaluate(()=>{oceanFocus.host.abandon();oceanFocus.host.save.regions.med.money=20000;});
const buyAll=async(prefix,limit)=>page.evaluate(([prefix,limit])=>{let n=0;while(n<limit){const next=oceanFocus.host.shop().find(item=>item.upgrade.id.startsWith(prefix)&&item.affordable);if(!next)break;oceanFocus.host.buy(next.upgrade.id);n++;}return n;},[prefix,limit]);
for(const [step,name] of [[2,'12-rowboat'],[2,'13-cabin'],[2,'14-gulet-sail']]){
 await buyAll('med.boat.',step);await buyAll('med.crew.',1);await buyAll('med.eq.',4);await page.waitForTimeout(800);await shot(name);
}
// High tide and swell: the boat interior must stay dry.
await page.evaluate(()=>{for(const [id,v] of [['tide','0.35'],['swell','1']]){const el=document.querySelector('#'+id);el.value=v;el.dispatchEvent(new Event('input'));}});
await page.waitForTimeout(1500);await shot('15-high-tide');
// Arctic: save up, move north, fish and upgrade.
await page.evaluate(()=>{for(const [id,v] of [['tide','0'],['swell','0.55']]){const el=document.querySelector('#'+id);el.value=v;el.dispatchEvent(new Event('input'));}oceanFocus.host.save.regions.med.money=5000;oceanFocus.host.unlockRegion('arctic');});
await page.waitForTimeout(2500);await shot('20-arctic');
await page.evaluate(()=>oceanFocus.host.startFocus(25));await page.waitForTimeout(1500);
await page.evaluate(()=>{const a=oceanFocus.host.save.active;const span=a.endsAt-a.startedAt;a.startedAt-=span*.5;a.endsAt-=span*.5;});
await page.waitForTimeout(3000);await shot('21-arctic-fishing');
await page.evaluate(()=>{oceanFocus.host.abandon();oceanFocus.host.save.regions.arctic.money=30000;});
for(let i=0;i<4;i++){await buyAll('arctic.boat.',2);await buyAll('arctic.crew.',1);await buyAll('arctic.eq.',3);}
await page.waitForTimeout(1500);await shot('22-arctic-upgraded');
await browser.close();

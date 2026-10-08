// Captures every region fishing (basic boat) and fully upgraded, for visual review.
import {chromium} from '@playwright/test';
const out=process.argv[2]??'output/region-qa';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>console.error('pageerror',e.message));
for(const region of ['med','arctic','indian','atlantic']){
 const save={version:1,currentRegionId:region,regions:{[region]:{money:0,owned:[]}},unlocked:['med','arctic','indian','atlantic'],active:null,history:[]};
 await page.goto('http://127.0.0.1:4173/game.html');
 await page.evaluate(s=>localStorage.setItem('ocean-focus-save-v1',JSON.stringify(s)),save);await page.reload();
 await page.waitForFunction(()=>window.oceanFocus?.scene,null,{timeout:20000});await page.waitForTimeout(2500);
 await page.evaluate(()=>oceanFocus.host.startFocus(25));await page.waitForTimeout(1500);
 await page.evaluate(()=>{const a=oceanFocus.host.save.active;const span=a.endsAt-a.startedAt;a.startedAt-=span*.5;a.endsAt-=span*.5;});
 await page.waitForTimeout(3500);await page.screenshot({path:`${out}/${region}-1-fishing.png`});
 await page.evaluate(r=>{oceanFocus.host.abandon();oceanFocus.host.save.regions[r].money=200000;for(let i=0;i<40;i++){const next=oceanFocus.host.shop().find(x=>x.affordable);if(!next)break;oceanFocus.host.buy(next.upgrade.id);}},region);
 await page.waitForTimeout(4000);await page.screenshot({path:`${out}/${region}-2-upgraded.png`});
}
await browser.close();

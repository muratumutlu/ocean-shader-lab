import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4175/');await page.waitForSelector('#mode-turtle:not([disabled])');
 const pixels=async()=>createHash('sha256').update(await page.locator('#ocean').evaluate(c=>c.toDataURL())).digest('hex');
 const sequence=[];const sample=async(tag)=>sequence.push({tag,pixels:await pixels()});
 await sample('free');await page.locator('#play').click();await page.waitForTimeout(180);await page.locator('#play').click();await sample('paused0');await page.waitForTimeout(180);await sample('paused180');
 await page.locator('#mode-turtle').click();await sample('mode0');await page.locator('#ocean').click({position:{x:600,y:350}});await sample('click');await page.waitForTimeout(180);await sample('settled');
 await page.keyboard.down('KeyW');await sample('w0');await page.waitForTimeout(180);await sample('w180');await page.keyboard.up('KeyW');await sample('up');await page.waitForTimeout(180);await sample('end');
 console.log(JSON.stringify({sequence,errors},null,2));
}finally{await browser.close();}

import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),checkpoint=args[args.indexOf('--checkpoint')+1];if(!checkpoint||!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex'),browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[],responses=[],jobs=[],poses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.url().endsWith('/assets/turtle.glb'))jobs.push(r.body().then(b=>responses.push({url:r.url(),status:r.status(),sha256:sha(b),bytes:b.length})));});
 await page.addInitScript(()=>{window.__qaKeyEvents=[];for(const type of ['keydown','keyup'])document.addEventListener(type,e=>window.__qaKeyEvents.push({type,code:e.code,trusted:e.isTrusted,target:e.target.id}),true);});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await page.waitForSelector('#mode-turtle:not([disabled])');await page.locator('#mode-turtle').click();await page.locator('#play').click();await page.locator('#ocean').focus();
 const snap=async label=>{await page.screenshot({path:resolve(dir,label+'.png')});const p={label,profile:await page.locator('#ocean').getAttribute('data-quality'),status:await page.locator('#navigation-status').textContent()};poses.push(p);console.log(JSON.stringify(p));};
 await page.keyboard.down('KeyW');await page.waitForTimeout(5000);await snap('swim-normal');await page.waitForTimeout(14000);await page.keyboard.up('KeyW');await page.waitForTimeout(4000);await snap('land-normal');await page.locator('#play').click();
 await page.mouse.move(720,450);await page.mouse.wheel(0,-1000);await page.waitForTimeout(250);await snap('land-close-rear');
 const orbit=async(dx,dy)=>{await page.mouse.move(600,400);await page.mouse.down();await page.mouse.move(600+dx,400+dy,{steps:30});await page.mouse.up();await page.waitForTimeout(150);};
 await orbit(225,-32);await snap('land-close-side');await orbit(225,0);await snap('land-close-front');await orbit(70,16);await snap('land-close-threequarter');
 await Promise.all(jobs);const diskSha256=sha(await readFile('public/assets/turtle.glb')),actualManifest=await page.request.get('http://127.0.0.1:4175/assets/turtle/manifest.json'),manifest=await actualManifest.json();
 const record={capturedAt:new Date().toISOString(),method:'Actual production page; trusted normal W for19 real seconds then release/rest for4seconds. Close views use ordinary mouse wheel and orbit drag after user Pause button. No fixture, teleport, direct pose setter or scripted animation; same production GLB URL. Playwright headless Metal.',url:page.url(),diskSha256,actualResponses:responses,actualManifestSha256:manifest.fileSha256,keyEvents:await page.evaluate(()=>window.__qaKeyEvents),poses,errors};
 await writeFile(resolve(dir,'capture.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));if(errors.length||!responses.some(r=>r.sha256===diskSha256)||manifest.fileSha256!==diskSha256)throw Error('Production anatomy evidence gate failed');
}finally{await browser.close();}

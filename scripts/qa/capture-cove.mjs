import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1];
const checkpoint=arg('--checkpoint');if(!checkpoint||!/^[a-zA-Z0-9_-]+$/.test(checkpoint))throw Error('A unique checkpoint name is required');
await mkdir(resolve('docs/evidence/living-cove'),{recursive:true});const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{
 const width=Number(arg('--width'))||1440,height=Number(arg('--height'))||900,dpr=Number(arg('--dpr'))||1;
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:4175/tests/fixtures/cove-preview.html?dpr=${dpr}`);await page.waitForFunction(()=>window.__cove?.ready);if(args.includes('--overlay'))await page.evaluate(async()=>{await window.__cove.prepareNavigation();window.__cove.setCollisionOverlay(true);});const records=[];
 for(const view of (arg('--views')||'overview,west,east,offshore').split(',')){await page.evaluate(v=>{window.__cove.setView(v);window.__cove.render();},view);await page.screenshot({path:resolve(dir,view+'.png')});records.push({view,...await page.evaluate(()=>window.__cove.metadata())});}
 await writeFile(resolve(dir,'capture.json'),JSON.stringify({capturedAt:new Date().toISOString(),records,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(dir);
}finally{await browser.close();}

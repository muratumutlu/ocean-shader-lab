import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),checkpoint=args[args.indexOf('--checkpoint')+1];if(!checkpoint||!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const capture=async(view,label)=>{await page.evaluate(v=>{window.__cove.turtleView(v);window.__cove.render();},view);await page.screenshot({path:resolve(dir,label+'.png')});records.push({label,...await page.evaluate(()=>({state:window.__cove.turtleState(),contact:window.__cove.turtleContact(),metadata:window.__cove.metadata()}))});};
 for(const view of ['front','rear','underwater'])await capture(view,'swim-'+view);
 const input={mode:'turtle',forward:1,right:0,vertical:0,fast:false,active:true,pointerActive:false};
 let shoreSteps=0;while(shoreSteps<750){const state=await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,-1],10),input);shoreSteps+=10;if(state.locomotion==='shore')break;}await capture('side','shore-side');
 await page.evaluate(({i,n})=>window.__cove.stepTurtle(i,[0,0,-1],n),{i:input,n:1400-shoreSteps});for(const view of ['front','rear','side'])await capture(view,'crawl-'+view);
 const crawl=await page.evaluate(i=>{const before=window.__cove.turtleState();window.__cove.stepTurtle({...i,forward:0,vertical:1},[0,0,-1],180);return {before,after:window.__cove.turtleState(),contact:window.__cove.turtleContact()};},input);await capture('side','land-idle');
 await page.evaluate(i=>window.__cove.stepTurtle(i,[0,0,1],2600),input);await capture('underwater','return-swim');
 const metadata={capturedAt:new Date().toISOString(),assetSha256:createHash('sha256').update(await readFile('public/assets/turtle.glb')).digest('hex'),records,crawl,errors};await writeFile(resolve(dir,'capture.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify({dir,errors,poses:records.map(x=>({label:x.label,position:x.state.position,locomotion:x.state.locomotion,phase:x.state.animationPhase,contact:x.contact})),landVerticalDelta:crawl.after.position.y-crawl.before.position.y},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}

import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),checkpoint=args[args.indexOf('--checkpoint')+1];if(!checkpoint||!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[],events=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4175/');await page.waitForSelector('#mode-turtle:not([disabled])');await page.locator('#mode-turtle').click();await page.locator('#play').click();await page.locator('#ocean').focus();
 await page.evaluate(()=>{const canvas=document.querySelector('#ocean'),stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};window.__qaRecording={stream,recorder,parts,start:performance.now()};recorder.start();});
 const snap=async(label)=>{events.push({label,elapsedSeconds:await page.evaluate(()=>(performance.now()-window.__qaRecording.start)/1000),status:await page.locator('#navigation-status').textContent()});await page.screenshot({path:resolve(dir,label+'.png')});};
 await page.keyboard.down('KeyW');for(const [label,delay] of [['swimming',5000],['shoreline',7000],['crawl',14000]]){await page.waitForTimeout(delay);await snap(label);}await page.keyboard.up('KeyW');await page.waitForTimeout(500);await snap('rest');
 await page.keyboard.down('KeyS');for(const [label,delay] of [['return-shore',14000],['return-swim',15000]]){await page.waitForTimeout(delay);await snap(label);}await page.keyboard.up('KeyS');await page.waitForTimeout(500);
 const result=await page.evaluate(async()=>{const r=window.__qaRecording;const stopped=new Promise(resolve=>{r.recorder.onstop=resolve;});r.recorder.stop();await stopped;r.stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(r.parts,{type:'video/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),wallSeconds:(performance.now()-r.start)/1000};});
 await writeFile(resolve(dir,'turtle-controlled.webm'),Buffer.from(result.base64,'base64'));delete result.base64;await page.locator('#play').click();await writeFile(resolve(dir,'record.json'),JSON.stringify({recordedAt:new Date().toISOString(),assetSha256:createHash('sha256').update(await readFile('public/assets/turtle.glb')).digest('hex'),...result,events,errors,method:'Real-time keyboard W then S; production controller and follow camera; canvas captureStream30. Screenshots add wall-time overhead; no accelerated simulation or model teleports.',measurement:false},null,2));console.log(JSON.stringify({dir,...result,events,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}

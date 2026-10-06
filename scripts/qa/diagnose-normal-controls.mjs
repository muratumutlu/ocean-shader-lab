import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),checkpoint=args.includes('--checkpoint')?args[args.indexOf('--checkpoint')+1]:'b13-normal-production-controls';if(!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const includeTurns=args.includes('--turns');
const dir=resolve('docs/evidence/living-cove',checkpoint);
await mkdir(dir,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[],responses=[],jobs=[],scripts=[],events=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.url().endsWith('/assets/turtle.glb'))jobs.push(r.body().then(b=>responses.push({url:r.url(),status:r.status(),bytes:b.length,sha256:sha(b),headers:r.headers()})));});
 await page.addInitScript(()=>{
  window.__qaKeyEvents=[];
  for(const type of ['keydown','keyup'])document.addEventListener(type,e=>window.__qaKeyEvents.push({type,code:e.code,trusted:e.isTrusted,target:e.target.id,active:document.activeElement?.id,time:performance.now()}),true);
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Debugger.enable');
 cdp.on('Debugger.scriptParsed',p=>{if(p.url.includes('/src/turtle/controller.ts'))scripts.push(p);});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 await page.waitForSelector('#mode-turtle:not([disabled])');
 const script=scripts.at(-1);if(!script)throw Error('Actual served controller script not found');
 const compiled=(await cdp.send('Debugger.getScriptSource',{scriptId:script.scriptId})).scriptSource;
 await writeFile(resolve(dir,'served-controller.js'),compiled);
 const lines=compiled.split('\n'),line=lines.findIndex(s=>s.includes('state.locomotion ='));
 if(line<0)throw Error('Controller sample point missing');
 const condition="((window.__qaProbeTick=(window.__qaProbeTick||0)+1)%30===0&&((window.__qaNormalSamples??=[]).push({t:performance.now(),position:{...state.position},heading:state.heading,locomotion:state.locomotion,transition:state.transition,phase:state.crawlPhase,feet:state.feet.map(f=>({...f,position:{...f.position}})),groundHeight:state.groundHeight,groundNormal:{...state.groundNormal},distance,moving,restBlend,drive:typeof crawlDrive==='function'?crawlDrive(state.crawlPhase):null,input:{...input},cameraForward:{...cameraForward}})),false)";
 const breakpoint=await cdp.send('Debugger.setBreakpointByUrl',{url:script.url,lineNumber:line,condition});
 await page.locator('#mode-turtle').click();await page.locator('#play').click();await page.locator('#ocean').focus();
 await page.evaluate(()=>{const canvas=document.querySelector('#ocean'),stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};window.__qaRecording={stream,recorder,parts,start:performance.now()};recorder.start();});
 const snap=async(label)=>{const e={label,wallSeconds:await page.evaluate(()=>(performance.now()-window.__qaRecording.start)/1000),status:await page.locator('#navigation-status').textContent()};events.push(e);await page.screenshot({path:resolve(dir,label+'.png')});console.log(JSON.stringify(e));};
 await snap('initial');
 await page.keyboard.down('KeyW');
 for(const [label,delay]of [['swimming',5000],['shore',7000],['crawl',14000]]){await page.waitForTimeout(delay);await snap(label);}
 await page.keyboard.up('KeyW');await page.waitForTimeout(4000);await snap('rest');
 if(includeTurns){await page.keyboard.down('KeyD');await page.waitForTimeout(2200);await snap('turn-right');await page.keyboard.up('KeyD');await page.waitForTimeout(650);await page.keyboard.down('KeyA');await page.waitForTimeout(2200);await snap('turn-left');await page.keyboard.up('KeyA');await page.waitForTimeout(3000);await snap('turn-rest');}
 await page.keyboard.down('KeyS');
 for(const [label,delay]of [['return-shore',14000],['return-swim',15000]]){await page.waitForTimeout(delay);await snap(label);}
 await page.keyboard.up('KeyS');await page.waitForTimeout(500);
 const result=await page.evaluate(async()=>{const r=window.__qaRecording;const stopped=new Promise(resolve=>{r.recorder.onstop=resolve;});r.recorder.stop();await stopped;r.stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(r.parts,{type:'video/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),recordingStart:r.start,wallSeconds:(performance.now()-r.start)/1000,keyEvents:window.__qaKeyEvents,samples:window.__qaNormalSamples??[]};});
 await writeFile(resolve(dir,'normal-controls.webm'),Buffer.from(result.base64,'base64'));delete result.base64;
 await Promise.all(jobs);
 const disk=await readFile('public/assets/turtle.glb'),manifest=JSON.parse(await readFile('assets/turtle/manifest.json','utf8'));
 await page.locator('#play').click();await cdp.send('Debugger.removeBreakpoint',{breakpointId:breakpoint.breakpointId});
 const record={capturedAt:new Date().toISOString(),url:page.url(),headless:true,includeTurns,backend:await page.evaluate(()=>{const gl=document.querySelector('#ocean').getContext('webgl2'),d=gl.getExtension('WEBGL_debug_renderer_info');return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}),qualityProfile:await page.locator('#ocean').getAttribute('data-quality'),method:'Production page, trusted Playwright keyboard events on focused canvas, default user follow camera, real wall time. CDP samples existing local controller state only; no state mutation, teleport, QA fixture, forced camera basis or wave freeze.',controllerURL:script.url,controllerCompiledSha256:sha(Buffer.from(compiled)),breakpointLocations:breakpoint.locations,asset:{diskBytes:disk.length,diskSha256:sha(disk),manifestSha256:manifest.fileSha256,actualPageResponses:responses},...result,events,errors};
 await writeFile(resolve(dir,'diagnostic.json'),JSON.stringify(record,null,2));
 console.log(JSON.stringify({dir,wallSeconds:record.wallSeconds,asset:record.asset,sampleCount:record.samples.length,events,errors},null,2));
 if(errors.length||!responses.some(r=>r.sha256===sha(disk))||!record.samples.length)throw Error('Diagnostic evidence gate failed');
}finally{await browser.close();}

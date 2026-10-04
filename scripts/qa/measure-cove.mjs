import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1],checkpoint=arg('--checkpoint');
if(!checkpoint||!/^[a-zA-Z0-9_-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
await mkdir(resolve('docs/evidence/living-cove'),{recursive:true});const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(async()=>{await window.__cove.prepareNavigation();window.__cove.setQuality('balanced');});
 const results=[];
 for(const scenario of ['still','above','underwater']){
  const r=await page.evaluate(async scenario=>{
   const a=window.__cove;a.hideProbe();a.setCollisionOverlay(false);a.setPose(scenario==='underwater'?[0,-1.2,6]:scenario==='above'?[0,3,8]:[20.85,12,32.64],[0,0,0]);
   let start=performance.now(),last=0,deltas=[],calls=[],bytes=[],samples=0;
   await new Promise(resolve=>{function tick(now){const t=(now-start)/1000,angle=t*.3,eye=scenario==='still'?null:scenario==='above'?[Math.sin(angle)*4,3.4,8+Math.cos(angle)]:[Math.sin(angle)*1.3,-1.2,6+Math.cos(angle)*.7];
    a.frame(t,eye,scenario==='underwater'?[6,-1,0]:[0,0,0]);
    if(t>=3.4){if(last)deltas.push(now-last);const d=a.diagnostics();calls.push(d.drawCalls);bytes.push(d.targetBytes);samples++;}last=now;
    if(t<13.4)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
   const sorted=deltas.toSorted((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
   return {scenario,samples,meanFrameMs:deltas.reduce((n,v)=>n+v,0)/deltas.length,p50FrameMs:q(.5),p95FrameMs:q(.95),maxDrawCalls:Math.max(...calls),maxTargetBytes:Math.max(...bytes),metadata:a.metadata(),warmupSeconds:3.4,sampleSeconds:10,readbackDuringSample:false,recordingDuringSample:false};
  },scenario);results.push(r);console.log(JSON.stringify({scenario:r.scenario,p95FrameMs:r.p95FrameMs,maxDrawCalls:r.maxDrawCalls,maxTargetBytes:r.maxTargetBytes}));
 }
 await writeFile(resolve(dir,'measure.json'),JSON.stringify({measuredAt:new Date().toISOString(),results,errors,physicalPhoneEvidence:false},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(dir);
}finally{await browser.close();}

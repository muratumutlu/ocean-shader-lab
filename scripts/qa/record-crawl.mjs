import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const checkpoint=process.argv[process.argv.indexOf('--checkpoint')+1];if(!checkpoint||!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 await page.evaluate(()=>{const a=window.__cove,i={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};a.stepTurtle(i,[0,0,-1],1000);a.turtleView('side');a.render();});
 const initial=await page.evaluate(()=>({state:window.__cove.turtleState(),feet:window.__cove.turtleFeet(),trails:window.__cove.trails.diagnostics()}));await page.screenshot({path:resolve(dir,'initial.png')});
 const recording=await page.evaluate(async()=>{
  const a=window.__cove,canvas=a.renderer.domElement,stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000}),parts=[],samples=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};const ended=new Promise(resolve=>recorder.onstop=resolve);let start=performance.now(),last=start,accumulator=0,frames=0,steps=0,nextSample=0;recorder.start();
  await new Promise(resolve=>{const frame=now=>{const t=(now-start)/1000,dt=Math.min(.1,(now-last)/1000);last=now;accumulator+=dt;const i={mode:'turtle',forward:t<7?1:0,right:0,vertical:0,active:t<7,fast:false,pointerActive:false};let count=0;while(accumulator+1e-9>=1/60&&count<6){accumulator-=1/60;count++;steps++;}if(count)a.stepTurtle(i,[0,0,-1],count);const s=a.turtleState(),p=s.position;a.setPose([p.x+1.85,p.y+.85,p.z-1.55],[p.x,p.y+.14,p.z+.05]);frames++;if(t>=nextSample){samples.push({t,phase:s.crawlPhase,locomotion:s.locomotion,position:s.position,feet:a.turtleFeet(),trails:a.trails.diagnostics(),contact:a.turtleContact()});nextSample+=.4;}if(t<10)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  recorder.stop();await ended;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(parts,{type:'video/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),wallSeconds:(performance.now()-start)/1000,frames,steps,samples,metadata:a.metadata()};
 });
 await writeFile(resolve(dir,'crawl-and-trails.webm'),Buffer.from(recording.base64,'base64'));delete recording.base64;await page.screenshot({path:resolve(dir,'rest.png')});
 await writeFile(resolve(dir,'record.json'),JSON.stringify({recordedAt:new Date().toISOString(),browserMode:'headless',assetSha256:createHash('sha256').update(await readFile('public/assets/turtle.glb')).digest('hex'),initial,...recording,errors,measurement:false,method:'Production controller, physics, GLB and trail system in QA fixture. Initial shore position reached through1000 fixed simulation steps before recording. Ten-second real-time RAF/60Hz accumulator recording: forward7s then rest3s; fixed water phase; no teleports or accelerated motion during recording.'},null,2));
 console.log(JSON.stringify({dir,wallSeconds:recording.wallSeconds,frames:recording.frames,steps:recording.steps,backend:recording.metadata.backend,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}

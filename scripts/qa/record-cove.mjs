import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1],checkpoint=arg('--checkpoint');
if(!checkpoint||!/^[a-zA-Z0-9_-]+$/.test(checkpoint))throw Error('Unique checkpoint required');const route=arg('--route')||'free';if(!['free','geology'].includes(route))throw Error('Unknown camera route');
await mkdir(resolve('docs/evidence/living-cove'),{recursive:true});const dir=resolve('docs/evidence/living-cove',checkpoint);await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(async route=>{await window.__cove.prepareNavigation();window.__cove.setQuality('balanced');window.__cove.setPose(route==='geology'?[0,4,20]:[0,.6,6],route==='geology'?[0,-2.8,0]:[5,-.4,0]);},route);
 const result=await page.evaluate(async route=>{
  const a=window.__cove,canvas=document.querySelector('canvas'),stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];
  recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};const ended=new Promise(resolve=>{recorder.onstop=resolve;});recorder.start();const start=performance.now();let frames=0,submergedFrames=0;
  await new Promise(resolve=>{function tick(now){const t=(now-start)/1000,y=.15+.85*Math.cos(t/18*Math.PI*2);if(route==='geology'){const angle=t/18*Math.PI*2;a.frame(t,[Math.sin(angle)*24,4+Math.sin(angle)*.6,Math.cos(angle)*20],[0,-2.8,0]);}else a.frame(t,[Math.sin(t*.2)*1.1,y,6+Math.sin(t*.24)*.5],[6,-.3,0]);frames++;if(a.diagnostics().submerged)submergedFrames++;if(t<18.3)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
  recorder.stop();await ended;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(parts,{type:'video/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),frames,submergedFrames,durationSeconds:(performance.now()-start)/1000,metadata:a.metadata()};
 },route);
 await writeFile(resolve(dir,route+'-camera.webm'),Buffer.from(result.base64,'base64'));delete result.base64;await page.screenshot({path:resolve(dir,'end.png')});await writeFile(resolve(dir,'record.json'),JSON.stringify({recordedAt:new Date().toISOString(),route,...result,errors,measurement:false},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(dir);
}finally{await browser.close();}

import {chromium} from '@playwright/test';
import {mkdir,writeFile,mkdtemp,copyFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyTurtleAsset} from './verify-turtle.mjs';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
 await page.goto((process.env.TURTLE_AUTHOR_URL??'http://127.0.0.1:4173')+'/tools/turtle-authoring.html');await page.waitForLoadState('networkidle');try{await page.waitForFunction(()=>window.__turtleAuthor?.ready);}catch(error){throw Error('Authoring page did not become ready: '+JSON.stringify(errors));}
 const data=await page.evaluate(()=>window.__turtleAuthor.build());if(errors.length)throw Error(errors.join('\n'));
 const staging=await mkdtemp(join(tmpdir(),'ocean-turtle-export-'));let manifest;
 try{const candidate=join(staging,'turtle.glb'),bytes=Buffer.from(data,'base64');console.log(JSON.stringify({candidateBytes:bytes.length}));await writeFile(candidate,bytes);manifest=await verifyTurtleAsset(candidate);await mkdir('public/assets',{recursive:true});await copyFile(candidate,'public/assets/.turtle-verified.glb');await writeFile('assets/turtle/.manifest-verified.json',JSON.stringify(manifest,null,2)+'\n');await rename('public/assets/.turtle-verified.glb','public/assets/turtle.glb');await rename('assets/turtle/.manifest-verified.json','assets/turtle/manifest.json');}finally{await rm(staging,{recursive:true,force:true});}
 console.log(JSON.stringify({...manifest,groundSamples:manifest.groundSamples.length+' verified neutral Crawl samples',swimGroundSamples:manifest.swimGroundSamples.length+' verified neutral Swim samples',bodyGroundSamples:manifest.bodyGroundSamples.length+' verified body Crawl samples',idleBodyGroundSamples:manifest.idleBodyGroundSamples.length+' verified body Idle samples'},null,2));
}finally{await browser.close();}

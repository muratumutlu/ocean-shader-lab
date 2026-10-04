import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {verifyTurtleAsset} from './verify-turtle.mjs';
const browser=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
 await page.goto('http://127.0.0.1:4175/tools/turtle-authoring.html');try{await page.waitForFunction(()=>window.__turtleAuthor?.ready);}catch(error){throw Error('Authoring page did not become ready: '+JSON.stringify(errors));}
 const data=await page.evaluate(()=>window.__turtleAuthor.build());if(errors.length)throw Error(errors.join('\n'));
 await mkdir('public/assets',{recursive:true});await writeFile('public/assets/turtle.glb',Buffer.from(data,'base64'));
 const manifest=await verifyTurtleAsset('public/assets/turtle.glb');await writeFile('assets/turtle/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...manifest,groundSamples:manifest.groundSamples.length+' verified neutral Crawl samples',swimGroundSamples:manifest.swimGroundSamples.length+' verified neutral Swim samples'},null,2));
}finally{await browser.close();}

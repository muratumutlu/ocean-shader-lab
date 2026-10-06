import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),checkpoint=args[args.indexOf('--checkpoint')+1];if(!checkpoint||!/^[\w-]+$/.test(checkpoint))throw Error('Unique checkpoint required');
const dir='docs/evidence/living-cove/'+checkpoint;await mkdir(dir,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const record=await page.evaluate(()=>{
  const a=window.__cove,input={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};a.stepTurtle(input,[0,0,-1],1400);
  const contact=a.turtleContact(),feet=a.turtleFeet(),state=a.turtleState();a.turtleView('side');
  const r=[];for(const profile of ['balanced','low']){a.setQuality(profile);a.scene.getObjectByName('TurtleHigh').visible=profile!=='low';a.scene.getObjectByName('TurtleLow').visible=profile==='low';a.render();a.render();const selected=[];a.scene.traverse(o=>{if(o.isSkinnedMesh&&o.parent.visible)selected.push({name:o.name,triangles:o.geometry.index.count/3,bones:o.skeleton.bones.length});});r.push({profile,metadata:a.metadata(),rendererMemory:{...a.renderer.info.memory},selected,trails:a.trails.diagnostics()});}
  const beforeReset=a.trails.diagnostics();a.resetTurtle();const afterReset=a.trails.diagnostics();a.dispose();return {contact,feet,state,r,beforeReset,afterReset,afterDispose:a.trails.diagnostics()};
 });
 const bytes=await readFile('public/assets/turtle.glb');
 const result={capturedAt:new Date().toISOString(),method:'Private deterministic terrain fixture; actual skinned plastron/feet, selected LOD geometry, warmed draw/target/trail counts, reset/disposal. LOD selected only in this fixture. No frame-time, phone or full GPU-memory claim.',assetSha256:createHash('sha256').update(bytes).digest('hex'),...record,errors};
 await writeFile(dir+'/budget.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(errors.length||record.contact.plastronMin>=.035||record.contact.min<-.015||record.feet.some(f=>f.error>=.008)||record.afterReset.active!==0||!record.afterDispose.disposed)throw Error('Current budget/contact gate failed');
}finally{await browser.close();}

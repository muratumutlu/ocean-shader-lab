import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const base=process.env.QA_URL??'http://127.0.0.1:4173';
const dir=resolve(process.env.QA_OUTPUT??'docs/evidence/living-cove/release-review-20261005');
const mode=process.argv[2]??'anatomy';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const errors=[];
async function reviewProduction(page){
 for(const size of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/');await page.waitForSelector('#mode-turtle:not([disabled])');
  if((await page.title())!=='Ocean Shader Lab — a study in motion'||await page.locator('#fallback').isVisible())throw Error('Production page identity/fallback gate failed');
  await page.screenshot({path:resolve(dir,'production-'+size.width+'.png')});
  await page.locator('#settings').click();await page.screenshot({path:resolve(dir,'settings-'+size.width+'.png')});
  await page.locator('#play').click();await page.locator('#turtle-routine').click();
  if(await page.locator('#turtle-routine').getAttribute('aria-pressed')!=='true')throw Error('Production routine did not start');
  await page.locator('#turtle-routine').click();await page.locator('#settings').click();
  await page.locator('#mode-turtle').click();await page.locator('#return-turtle').click();
  if(await page.locator('#mode-turtle').getAttribute('aria-pressed')!=='true')throw Error('Production turtle control mode failed');
 }
}
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(mode==='production') {await reviewProduction(page);}
 else if(mode==='anatomy') {
  await page.goto(base+'/tests/fixtures/turtle-preview.html');
  await page.waitForFunction(()=>window.__turtle?.ready);
  for(const view of ['front','side','top','threeQuarter']) {
   await page.evaluate(view=>{const a=window.__turtle;a.pose('Idle',0);a.setView(view);},view);
   await page.screenshot({path:resolve(dir,'anatomy-'+view+'.png')});
  }
 } else {
  await page.goto(base+'/tests/fixtures/cove-preview.html');
  await page.waitForFunction(()=>window.__cove?.ready);
  await page.evaluate(async()=>{
   const [S,V,C,P,M,T,R,A]=await Promise.all([
    import('/src/scene/seabed.ts'),import('/src/turtle/view.ts'),import('/src/turtle/controller.ts'),import('/src/physics/world.ts'),
    import('/src/runtime/turtle-contact-motion.ts'),import('/src/turtle/contact-trails.ts'),import('/src/runtime/turtle-activities.ts'),import('/src/turtle/asset.ts')
   ]);
   const a=window.__cove,bed=S.createSeabedProps(7,a.cove.data);a.scene.add(bed.group);
   const world=await P.createPhysicsWorld(a.cove.data),view=await V.createTurtleView('/assets/turtle.glb',new AbortController().signal);
   const controller=C.createTurtleController(a.cove,world,A.TURTLE_ASSET.proxy,A.TURTLE_ASSET);
   const motion=M.createTurtleContactMotion({view,cove:a.cove,asset:A.TURTLE_ASSET}),trails=T.createContactTrails(a.cove);
   const routine=R.createTurtleRoutine({view,cove:a.cove,controller,asset:A.TURTLE_ASSET,restProfile:R.PRODUCTION_TURTLE_ROUTINE_PROFILE});
   a.dynamic.add(view.group,trails.group,routine.group);
   const manual={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};let time=0;
   const pose=()=>{const d=routine.diagnostics();motion.apply(controller.state,1/60,{poseEnabled:!d.enabled||!['rest','feed','dig','lay','cover'].includes(d.phase)});routine.applyPose();trails.update(motion.sampleContacts(controller.state,time,0));};
   const step=(count,input=manual,forward={x:0,y:0,z:-1})=>{for(let i=0;i<count;i++){
    const move=routine.resolveInput(input,forward,0,false);controller.step(move.input,move.cameraForward,0,1/60);routine.afterStep(0,1/60,false);time+=1/60;pose();
   }return structuredClone(controller.state);};
   const reset=()=>{routine.reset();controller.reset();motion.reset();trails.reset();time=0;pose();};
   window.__release={a,view,controller,motion,trails,routine,bed,step,reset,pose,manual};pose();
  });
  for(const view of ['overview','cutFront','cutWest','cutEast','cutRear','ceramicMouth','skeletonOblique','skull','underwater','submergedRock']) {
   await page.evaluate(view=>window.__cove.setView(view),view);
   await page.screenshot({path:resolve(dir,'scene-'+view+'.png')});
  }
  const contact=await page.evaluate(()=>{const r=window.__release;r.step(1500);return {state:r.controller.state,motion:r.motion.diagnostics(),trails:r.trails.diagnostics()};});
  if(!contact.motion.ready||contact.state.previousLocomotion!=='crawl')throw Error('Production contact adapter not ready on dry sand');
  const samples=[];
  for(let i=0;i<16;i++){
   samples.push(await page.evaluate(()=>{const r=window.__release;r.step(12);const p=r.controller.state.position;r.a.setPose([p.x+1.8,p.y+.75,p.z+1.4],[p.x,p.y+.10,p.z]);return {phase:r.controller.state.crawlPhase,position:{...p},feet:structuredClone(r.controller.state.feet),contacts:r.motion.diagnostics().frame.contacts};}));
   await page.screenshot({path:resolve(dir,'crawl-'+String(i+1).padStart(2,'0')+'.png')});
  }
  await writeFile(resolve(dir,'crawl-samples.json'),JSON.stringify(samples,null,2));
  const video=await page.evaluate(async()=>{
   const r=window.__release,stream=r.a.renderer.domElement.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2500000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(resolve=>recorder.onstop=resolve);
   let last=performance.now(),accumulator=0;const start=last;recorder.start();
   await new Promise(resolve=>{const tick=now=>{accumulator+=Math.min(.1,(now-last)/1000);last=now;let steps=0;while(accumulator>=1/60&&steps<6){accumulator-=1/60;steps++;}r.step(steps);const p=r.controller.state.position;r.a.setPose([p.x+2.2,p.y+.95,p.z+1.8],[p.x,p.y+.10,p.z]);if(now-start<8000)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);
  });
  await writeFile(resolve(dir,'adult-crawl.webm'),Buffer.from(video,'base64'));
  await page.evaluate(()=>{const r=window.__release,p=r.controller.state.position;r.a.setPose([p.x,p.y+3.2,p.z+2.2],[p.x,p.y-.04,p.z+2]);});
  await page.screenshot({path:resolve(dir,'sand-tracks.png')});
  await page.evaluate(()=>{window.__release.reset();const r=window.__release;const s=r.routine.setEnabled(true,0);if(!s.ready)throw Error(JSON.stringify(s));});
  const routineFrames=[];let previous='';
  for(let i=0;i<650;i++){
   const d=await page.evaluate(()=>{const r=window.__release;r.step(15,{...r.manual,forward:0,active:false});return {state:r.controller.state,diagnostics:r.routine.diagnostics()};});
   const tag=d.diagnostics.phase+'-'+d.diagnostics.eggs;
   if(tag!==previous&&['feed','dig','lay','cover','complete','cancelled'].includes(d.diagnostics.phase)){
    previous=tag;await page.evaluate(()=>{const r=window.__release,p=r.controller.state.position,n=r.routine.diagnostics().nestCenter;if(n)r.a.setPose([n.x+1.65,n.y+1.65,n.z+1.85],[n.x,n.y+.15,n.z-.40]);else r.a.setPose([p.x+1.8,p.y+.8,p.z-1.8],[p.x,p.y-.02,p.z]);});
    await page.screenshot({path:resolve(dir,'routine-'+tag+'.png')});routineFrames.push(d.diagnostics);
   }
   if(['finished','cancelled'].includes(d.diagnostics.stage))break;
  }
  const routine=await page.evaluate(()=>window.__release.routine.diagnostics());
  await writeFile(resolve(dir,'routine-review.json'),JSON.stringify({routine,routineFrames},null,2));
  if(routine.stage!=='finished'||routine.eggs!==6||routine.coverage!==1||routine.feedingContactSeconds<3.99)throw Error('Routine completion gate: '+JSON.stringify(routine));
  await reviewProduction(page);
 }
 const result={capturedAt:new Date().toISOString(),base,mode,errors};
 await writeFile(resolve(dir,mode+'-capture.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}

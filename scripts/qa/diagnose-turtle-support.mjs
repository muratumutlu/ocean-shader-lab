import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),output=args[args.indexOf('--output')+1];if(!output||!/^docs\/evidence\/living-cove\/[\w-]+\/[\w-]+\.json$/.test(output))throw Error('Unique evidence output required');
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4175/tests/fixtures/cove-preview.html');await page.waitForFunction(()=>window.__cove?.ready);await page.evaluate(()=>window.__cove.prepareTurtle());
 const record=await page.evaluate(async()=>{
  const a=window.__cove,input={mode:'turtle',forward:1,right:0,vertical:0,active:true,fast:false,pointerActive:false};a.stepTurtle(input,[0,0,-1],1400);
  const {turtleRotation}=await import('/src/turtle/controller.ts'),{TURTLE_ASSET}=await import('/src/turtle/asset.ts'),THREE=await import('/node_modules/three/build/three.module.js');
  const state=a.turtleState(),q=turtleRotation(state),phase=((state.crawlPhase%3.2)+3.2)%3.2/3.2*32,idx=Math.floor(phase),all=[];
  const supports=TURTLE_ASSET.bodyGroundSamples??TURTLE_ASSET.groundSamples;
  for(const samples of [supports[idx],supports[(idx+1)%supports.length]])for(const sample of samples){const p=new THREE.Vector3().fromArray(sample).applyQuaternion(q);all.push({source:sample,required:a.cove.sampleHeight(state.position.x+p.x,state.position.z+p.z)-p.y+.019});}
  all.sort((a,b)=>b.required-a.required);
  const vertices=[];a.scene.updateMatrixWorld(true);a.scene.traverse(o=>{if(!o.isSkinnedMesh||!o.parent?.visible)return;const pos=o.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);o.applyBoneTransform(i,p);p.applyMatrix4(o.matrixWorld);vertices.push({name:o.name,index:i,source:[pos.getX(i),pos.getY(i),pos.getZ(i)],gap:p.y-a.cove.sampleHeight(p.x,p.z)});}});vertices.sort((a,b)=>a.gap-b.gap);
  return {state,contact:a.turtleContact(),feet:a.turtleFeet(),topSupport:all.slice(0,12),torsoSupport:all.filter(p=>p.source[2]>-.5&&p.source[2]<.45&&Math.abs(p.source[0])<.32).slice(0,8),lowestSkin:vertices.slice(0,10),lowestPlastron:vertices.filter(p=>p.source[1]<-.07&&Math.abs(p.source[0])<.30&&p.source[2]>-.40&&p.source[2]<.35).slice(0,10)};
 });
 await writeFile(output,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
}finally{await browser.close();}

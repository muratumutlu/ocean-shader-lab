import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {solveFrontFlipper,solveRearFlipper} from '../../src/turtle/crawl-pose';
import {createTurtleRoutine,PRODUCTION_TURTLE_ROUTINE_PROFILE} from '../../src/runtime/turtle-activities';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import {createPhysicsWorld} from '../../src/physics/world';
import {createTurtleController,turtleRotation} from '../../src/turtle/controller';
import type {TurtleState} from '../../src/turtle/state';
import manifest from '../../assets/turtle/manifest.json';

const still={mode:'turtle' as const,forward:0,right:0,vertical:0,fast:false,active:false,pointerActive:false};
const data=createCoveData(7);
const cove={data,sampleHeight:(x:number,z:number)=>sampleGrid(data,x,z),sampleNormal:(x:number,z:number)=>{
 const dx=(sampleGrid(data,x+.1,z)-sampleGrid(data,x-.1,z))/.2,dz=(sampleGrid(data,x,z+.1)-sampleGrid(data,x,z-.1))/.2,n=Math.hypot(dx,1,dz);return {x:-dx/n,y:1/n,z:-dz/n};
}};
// Decode only hierarchy and animation accessors from the frozen GLB. No textures,
// GPU or browser are needed; this exercises the actual production animation tracks.
const glb=readFileSync(new URL('../../public/assets/turtle.glb',import.meta.url)),jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.toString('utf8',20,20+jsonLength)),binaryStart=28+jsonLength;
const accessor=(index:number)=>{const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16} as Record<string,number>)[a.type],formats:Record<number,[number,string,number]>={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]},[size,read,scale]=formats[a.componentType];if(!width)throw Error('Unexpected GLB accessor');const stride=v.byteStride??size*width,offset=binaryStart+(v.byteOffset??0)+(a.byteOffset??0);return Array.from({length:a.count*width},(_,i)=>(glb as any)[read](offset+Math.floor(i/width)*stride+i%width*size)/(a.normalized?scale:1));};
function actualSkinTriangles(view:ReturnType<typeof testView>){
 view.group.updateMatrixWorld(true);const triangles:THREE.Triangle[]=[];
 // Both quality meshes use their own actual inverse binds and vertex weights.
 for(const index of [15,16,18,19]){
  const node=gltf.nodes[index],primitive=gltf.meshes[node.mesh].primitives[0],skin=gltf.skins[node.skin],positions=accessor(primitive.attributes.POSITION),weights=accessor(primitive.attributes.WEIGHTS_0),joints=accessor(primitive.attributes.JOINTS_0),indices=accessor(primitive.indices),inverse=accessor(skin.inverseBindMatrices);
  const matrices=skin.joints.map((n:number,j:number)=>view.group.getObjectByName(gltf.nodes[n].name)!.matrixWorld.clone().multiply(new THREE.Matrix4().fromArray(inverse,j*16))),vertices:THREE.Vector3[]=[];
  for(let i=0;i<positions.length/3;i++){const source=new THREE.Vector3().fromArray(positions,i*3),world=new THREE.Vector3();for(let j=0;j<4;j++)if(weights[i*4+j])world.addScaledVector(source.clone().applyMatrix4(matrices[joints[i*4+j]]),weights[i*4+j]);vertices.push(world);}
  for(let i=0;i<indices.length;i+=3)triangles.push(new THREE.Triangle(vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]]));
 }
 return triangles;
}
function sphereSkinClearance(triangles:THREE.Triangle[],center:THREE.Vector3,radius:number){const closest=new THREE.Vector3();let distance=Infinity;for(const t of triangles){t.closestPointToPoint(center,closest);const d=closest.distanceTo(center);if(Number.isFinite(d))distance=Math.min(distance,d);else expect(t.getArea()).toBeLessThan(1e-12);}return distance-radius;}

function testView(){
 const group=new THREE.Group(),model=new THREE.Group(),nodes:THREE.Object3D[]=gltf.nodes.map((n:any)=>{const bone=new THREE.Bone();bone.name=n.name;if(n.translation)bone.position.fromArray(n.translation);if(n.rotation)bone.quaternion.fromArray(n.rotation);return bone;});
 gltf.nodes.forEach((n:any,i:number)=>n.children?.forEach((child:number)=>nodes[i].add(nodes[child])));group.add(model);model.add(nodes[0]);
 const mixer=new THREE.AnimationMixer(model),clips=gltf.animations.map((a:any)=>new THREE.AnimationClip(a.name,-1,a.channels.map((channel:any)=>{const sampler=a.samplers[channel.sampler],times=accessor(sampler.input),values=accessor(sampler.output),name=nodes[channel.target.node].name;return channel.target.path==='rotation'?new THREE.QuaternionKeyframeTrack(name+'.quaternion',times,values):new THREE.VectorKeyframeTrack(name+'.position',times,values);}))),actions=clips.map((clip:THREE.AnimationClip)=>mixer.clipAction(clip));actions.forEach((a:THREE.AnimationAction)=>a.play());
 const base=new Map<string,THREE.Quaternion>();
 return {group,base,apply(state:TurtleState,_dt=0){
  group.position.set(state.position.x,state.position.y,state.position.z);model.quaternion.copy(turtleRotation(state));
  actions.forEach((a:THREE.AnimationAction)=>{a.setEffectiveWeight(a.getClip().name==='Swim'?state.transition:a.getClip().name==='Crawl'?(1-state.restBlend)*(1-state.transition):state.restBlend*(1-state.transition));a.time=((a.getClip().name==='Crawl'?state.crawlPhase:state.animationPhase)%a.getClip().duration+a.getClip().duration)%a.getClip().duration;});mixer.update(0);group.updateMatrixWorld(true);
  const body=group.getObjectByName('Body')!;
  for(const foot of state.feet){const goal=body.worldToLocal(new THREE.Vector3(foot.position.x,foot.position.y,foot.position.z)),rear=foot.limb==='rear',pose=rear?solveRearFlipper(foot.side,goal):solveFrontFlipper(foot.side,goal),name=(rear?'Hind':'Front')+(foot.side<0?'L':'R');group.getObjectByName(name)!.quaternion.slerp(pose.shoulder,1-state.transition);group.getObjectByName(name+'Tip')!.quaternion.slerp(pose.tip,1-state.transition);}
  group.updateMatrixWorld(true);for(const name of ['Neck','Head','HindL','HindR','HindLTip','HindRTip'])base.set(name,group.getObjectByName(name)!.quaternion.clone());
 }};
}
function moundSkinClearance(view:ReturnType<typeof testView>,mound:THREE.Mesh){
 const triangles=actualSkinTriangles(view),cells=new Map<string,THREE.Triangle[]>(),cellSize=.05;
 for(const triangle of triangles){const vertices=[triangle.a,triangle.b,triangle.c],minX=Math.floor(Math.min(...vertices.map(p=>p.x))/cellSize),maxX=Math.floor(Math.max(...vertices.map(p=>p.x))/cellSize),minZ=Math.floor(Math.min(...vertices.map(p=>p.z))/cellSize),maxZ=Math.floor(Math.max(...vertices.map(p=>p.z))/cellSize);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+','+z,bucket=cells.get(key)??[];bucket.push(triangle);cells.set(key,bucket);}
 }
 mound.updateMatrixWorld(true);const positions=mound.geometry.attributes.position,vertices=Array.from({length:positions.count},(_,i)=>mound.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i))),samples=[...vertices],indices=mound.geometry.index!;
 // Include each cover triangle's interior, not only a conservative outline.
 for(let i=0;i<indices.count;i+=3)samples.push(vertices[indices.getX(i)].clone().add(vertices[indices.getX(i+1)]).add(vertices[indices.getX(i+2)]).multiplyScalar(1/3));
 const ray=new THREE.Ray(),up=new THREE.Vector3(0,1,0),hit=new THREE.Vector3();let clearance=Infinity;
 for(const p of samples){const bed=cove.sampleHeight(p.x,p.z),bucket=cells.get(Math.floor(p.x/cellSize)+','+Math.floor(p.z/cellSize))??[];ray.set(new THREE.Vector3(p.x,bed-.001,p.z),up);
  for(const t of bucket)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit))clearance=Math.min(clearance,hit.y-p.y);
 }
 return {clearance,samples:samples.length};
}
async function setup(){
 const world=await createPhysicsWorld(data),controller=createTurtleController(cove as any,world,manifest.proxy,manifest),view=testView();view.apply(controller.state);
 const routine=createTurtleRoutine({cove,controller,view,asset:manifest,restProfile:PRODUCTION_TURTLE_ROUTINE_PROFILE,namespace:'test-routine'});
 const step=(dt=1/60,paused=false,input=still)=>{
  const before={...controller.state.position},heading=controller.state.heading;
  const resolved=routine.resolveInput(input,{x:1,y:0,z:0},0,paused);
  expect(controller.state.position).toEqual(before);expect(controller.state.heading).toBe(heading);
  if(!paused)controller.step(resolved.input,resolved.cameraForward,0,dt);
  const committed={...controller.state.position},committedHeading=controller.state.heading;
  routine.afterStep(0,paused?0:dt,paused);view.apply(controller.state);routine.applyPose();
  expect(controller.state.position).toEqual(committed);expect(controller.state.heading).toBe(committedHeading);
 };
 return {world,controller,view,routine,step,dispose(){routine.dispose();controller.dispose();world.dispose();}};
}

describe('collision-aware observed turtle routine',()=>{
 it('moves through feeding, actual dry nesting and actual return to water through the existing controller',async()=>{
  const f=await setup();try{
   expect(f.routine.setEnabled(true,0)).toEqual({ready:true});const phases=new Set<string>(),modes=new Set<string>(),animationOnly=testView();let maxStep=0,maxPose=0,maxHeadPose=0,maxHorizontalStep=0,nestChecked=false,moundChecked=false;
   for(let i=0;i<21000;i++){
    const before={...f.controller.state.position};f.step();const d=f.routine.diagnostics();phases.add(d.phase);modes.add(f.controller.state.previousLocomotion);
    maxHorizontalStep=Math.max(maxHorizontalStep,Math.hypot(before.x-f.controller.state.position.x,before.z-f.controller.state.position.z));
    maxStep=Math.max(maxStep,Math.hypot(before.x-f.controller.state.position.x,before.y-f.controller.state.position.y,before.z-f.controller.state.position.z));
    animationOnly.apply(f.controller.state);
    for(const name of ['Neck','Head','HindL','HindR','HindLTip','HindRTip'])maxPose=Math.max(maxPose,animationOnly.group.getObjectByName(name)!.quaternion.angleTo(f.view.group.getObjectByName(name)!.quaternion));
    if(d.phase==='feed')maxHeadPose=Math.max(maxHeadPose,animationOnly.group.getObjectByName('Head')!.quaternion.angleTo(f.view.group.getObjectByName('Head')!.quaternion));
    if(!nestChecked&&d.eggs===6){
     expect(d.nestAnchorPhase).toBe('dig');expect(d.nestRearOffset).toBe(.72);expect(d.nestCenter).not.toBeNull();expect(d.nestFootprintMinimumHeight!).toBeGreaterThan(.07);
     const center=new THREE.Vector3(d.nestCenter!.x,d.nestCenter!.y,d.nestCenter!.z),anchor=d.nestAnchorPosition!,heading=d.nestAnchorHeading!,target=d.nestApproachTarget!;
     // The legal short arrival that caused the original overlap is exercised.
     expect(Math.hypot(anchor.x-target.x,anchor.z-target.z)).toBeGreaterThan(.10);
     expect(center.x).toBeCloseTo(anchor.x-Math.sin(heading)*.72,9);expect(center.z).toBeCloseTo(anchor.z-Math.cos(heading)*.72,9);
     const triangles=actualSkinTriangles(f.view),eggs=f.routine.group.getObjectByName('turtle-nest-eggs') as THREE.InstancedMesh,m=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();
     for(let egg=0;egg<6;egg++){eggs.getMatrixAt(egg,m);m.decompose(position,q,scale);eggs.localToWorld(position);expect(sphereSkinClearance(triangles,position,scale.x),`egg ${egg} intersects actual high/low skinned triangles`).toBeGreaterThan(.010);}
     // Independent old-plan reproduction intersects skin, so this test cannot
     // pass merely because the fixture has no underside or ignores skinning.
     const oldCenter=new THREE.Vector3(target.x-Math.sin(heading)*.52,0,target.z-Math.cos(heading)*.52);let oldMinimum=Infinity;
     for(let egg=0;egg<6;egg++){const a=egg*Math.PI/3,x=oldCenter.x+Math.cos(a)*.058,z=oldCenter.z+Math.sin(a)*.058;oldMinimum=Math.min(oldMinimum,sphereSkinClearance(triangles,new THREE.Vector3(x,cove.sampleHeight(x,z)+.025,z),.023));}
     expect(oldMinimum).toBeLessThan(0);nestChecked=true;
    }
    if(!moundChecked&&d.coverage===1){
     const mound=f.routine.group.getObjectByName('turtle-covered-nest') as THREE.Mesh,result=moundSkinClearance(f.view,mound);
     expect(result.samples).toBeGreaterThan(12000);expect(result.clearance,'final cover intersects actual posed high/low turtle skin').toBeGreaterThan(.001);moundChecked=true;
    }
    if(!d.enabled)break;
   }
   const result=f.routine.diagnostics();expect(result.feedingContactSeconds,JSON.stringify({result,state:f.controller.state,phases:[...phases]})).toBeCloseTo(4,8);expect(result.closestFoodGap).not.toBeNull();expect(Math.abs(result.closestFoodGap!)).toBeLessThan(.035);expect(result.feedingFailure).toBeNull();expect(result.stage,JSON.stringify({result,state:f.controller.state,phases:[...phases]})).toBe('finished');
   expect(phases).toEqual(new Set(['approach','rest','feed','leave','dig','lay','cover','complete']));expect(modes).toEqual(new Set(['swim','crawl']));
   expect(nestChecked).toBe(true);expect(moundChecked).toBe(true);expect(result.eggs).toBe(6);expect(result.coverage).toBe(1);expect(maxHorizontalStep).toBeLessThan(.025);expect(result.peakControllerStepDistance).toBe(maxStep);expect(maxHeadPose).toBeGreaterThan(6*Math.PI/180);expect(maxPose).toBeLessThanOrEqual(result.maxPoseAngle+1e-7);
   expect(f.controller.state.position.z).toBeGreaterThan(6.6);expect(f.controller.state.previousLocomotion).toBe('swim');
  }finally{f.dispose();}
 },30000);

 it('freezes under pause and yields immediately to manual movement without changing that input',async()=>{
  const f=await setup();try{
   f.routine.setPaused(true);expect(f.routine.setEnabled(true,0)).toEqual({ready:false,reason:'paused'});f.routine.setPaused(false);expect(f.routine.setEnabled(true,0)).toEqual({ready:true});
   for(let i=0;i<30;i++)f.step();const position={...f.controller.state.position},before=f.routine.diagnostics();
   for(let i=0;i<20;i++)f.step(10,true);expect(f.controller.state.position).toEqual(position);expect(f.routine.diagnostics().elapsed).toBe(before.elapsed);
   const manual={...still,forward:1,vertical:1,active:true},forward={x:1,y:0,z:0};const resolved=f.routine.resolveInput(manual,forward,0,true);
   expect(resolved.input).toBe(manual);expect(resolved.cameraForward).toBe(forward);expect(f.routine.diagnostics()).toMatchObject({enabled:false,stage:'cancelled',reason:'manual-control'});
  }finally{f.dispose();}
 });

 it('terminates a blocked approach rather than teleporting or claiming arrival',async()=>{
  const f=await setup();try{
   expect(f.routine.setEnabled(true,0)).toEqual({ready:true});const before={...f.controller.state.position};
   // Deliberately omit controller.step to emulate a collision that prevents progress.
   for(let i=0;i<100;i++){f.routine.resolveInput(still,{x:0,y:0,z:-1},0,false);f.routine.afterStep(0,.1,false);}
   expect(f.controller.state.position).toEqual(before);expect(f.routine.diagnostics()).toMatchObject({enabled:false,stage:'cancelled',reason:'site-unavailable',eggs:0});
  }finally{f.dispose();}
 });

 it('keeps fixed small food on the seabed and cannot eat it from an unreachable head pose',async()=>{
  const f=await setup();try{
   expect(f.routine.setEnabled(true,0)).toEqual({ready:true});
   const food=f.routine.group.getObjectByName('turtle-feeding-bivalves') as THREE.Mesh,positions=food.geometry.attributes.position;
   food.updateMatrixWorld(true);let highest=0;
   for(let i=0;i<positions.count;i++){
    const p=food.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i)),above=p.y-cove.sampleHeight(p.x,p.z);highest=Math.max(highest,above);expect(above).toBeGreaterThanOrEqual(-1e-7);expect(above).toBeLessThanOrEqual(.054001);
   }
   expect(highest).toBeGreaterThan(.05);expect(food.scale.toArray()).toEqual([1,1,1]);
   // The named rig is present but its beak has become physically unreachable.
   // This tests contact gating independently of successful route arrival.
   f.view.group.getObjectByName('Head')!.position.y+=.6;
   for(let i=0;i<5000&&f.routine.diagnostics().enabled;i++)f.step();
   expect(f.routine.diagnostics()).toMatchObject({stage:'cancelled',reason:'site-unavailable',feedingFailure:'food-unreachable',feedingProgress:0,feedingContactSeconds:0,eggs:0});
  }finally{f.dispose();}
 });

 it('rechecks committed physics pose contact on every fixed substep and freezes contact progress while paused',async()=>{
  const f=await setup();try{
   expect(f.routine.setEnabled(true,0)).toEqual({ready:true});
   for(let i=0;i<3000&&!f.routine.diagnostics().foodContact;i++)f.step();
   expect(f.routine.diagnostics().foodContact).toBe(true);const before=f.routine.diagnostics();
   for(let i=0;i<15;i++)f.step(1,true);expect(f.routine.diagnostics().feedingContactSeconds).toBe(before.feedingContactSeconds);expect(f.routine.diagnostics().feedPoseTime).toBe(before.feedPoseTime);
   // Move through the actual controller without updating the view: each following
   // afterStep must sample current animation and the new committed root pose.
   let missed=false;
   for(let i=0;i<20;i++){
    f.controller.step({...still,vertical:1,active:true},{x:0,y:0,z:-1},0,1/60);const prior=f.routine.diagnostics().feedingContactSeconds;f.routine.afterStep(0,1/60,false);
    const d=f.routine.diagnostics();if(!d.foodContact){missed=true;expect(d.feedingContactSeconds).toBe(prior);break;}
   }
   expect(missed).toBe(true);f.routine.reset();expect(f.routine.diagnostics()).toMatchObject({stage:'off',feedingProgress:0,feedingContactSeconds:0,feedPoseTime:0,foodContact:false,eggs:0,coverage:0});
  }finally{f.dispose();}
 });

 it('cancels before laying when the committed mound footprint becomes wet',async()=>{
  const f=await setup();try{
   expect(f.routine.setEnabled(true,0)).toEqual({ready:true});
   for(let i=0;i<12000&&f.routine.diagnostics().nestAnchorPhase===null;i++)f.step();
   const committed=f.routine.diagnostics();expect(committed.nestAnchorPhase).toBe('dig');expect(committed.eggs).toBe(0);
   // Raise only the external tide observation above the validated dry margin.
   f.routine.afterStep(committed.nestFootprintMinimumHeight!-.06,1/60,false);
   expect(f.routine.diagnostics()).toMatchObject({enabled:false,stage:'cancelled',reason:'site-unavailable',eggs:0});
   f.routine.reset();expect(f.routine.diagnostics()).toMatchObject({nestCenter:null,nestAnchorPosition:null,nestAnchorPhase:null,nestFootprintMinimumHeight:null,eggs:0});
  }finally{f.dispose();}
 },30000);

 it('rejects a different asset fingerprint and frees only its own render resources',async()=>{
  const f=await setup();try{
   const other=createTurtleRoutine({cove,controller:f.controller,view:f.view,asset:{...manifest,fileSha256:'different'},restProfile:PRODUCTION_TURTLE_ROUTINE_PROFILE});
   expect(other.setEnabled(true,0)).toEqual({ready:false,reason:'invalid-profile'});other.dispose();
   const objects=[...f.routine.group.children] as THREE.Mesh[],geometries=objects.map(m=>m.geometry),materials=objects.map(m=>m.material as THREE.Material);let releases=0;
   for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>releases++);
   f.routine.dispose();f.routine.dispose();expect(releases).toBe(6);expect(f.routine.group.children).toHaveLength(0);expect(f.view.group.getObjectByName('Head')).toBeDefined();
  }finally{f.dispose();}
 });
});

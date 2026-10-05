import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCameraRig} from '../../src/camera/camera-rig';
import {createTerrain} from '../../src/scene/terrain';
import {createWater} from '../../src/water/water';
import {createOrbitWaterResponse,stepOrbitWaterResponse,ORBIT_WATER_MAX_SLOPE} from '../../src/water/orbit-response';
import {waterHeightAt} from '../../src/water/waves';
import {DEFAULT_CONTROLS} from '../../src/types';

// Real OrbitControls on a small event surface; no DOM renderer or GPU is needed.
function surface(){
 const ownerDocument=Object.assign(new EventTarget(),{defaultView:new EventTarget(),hidden:false});
 const canvas=Object.assign(new EventTarget(),{ownerDocument,clientWidth:800,clientHeight:600,style:{} as Record<string,string>,
  getRootNode:()=>ownerDocument,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),setPointerCapture:()=>{},releasePointerCapture:()=>{}});
 return {canvas,ownerDocument};
}
function pointer(target:EventTarget,type:string,patch:Record<string,unknown>={}){
 const event=Object.assign(new Event(type,{cancelable:true}),{pointerId:1,pointerType:'mouse',button:0,buttons:1,clientX:300,clientY:300,pageX:300,pageY:300,shiftKey:false,ctrlKey:false,metaKey:false,...patch});
 target.dispatchEvent(event);
}
const input={mode:'camera' as const,forward:0,right:0,vertical:0,fast:false,active:false,pointerActive:false};
function setup(){
 const ui=surface(),world={sweepSphere:(_from:unknown,to:THREE.Vector3)=>({position:to})};
 const rig=createCameraRig(ui.canvas as unknown as HTMLCanvasElement,{group:new THREE.Group()} as any,world as any);
 return {...ui,rig};
}

describe('orbit response integration contracts',()=>{
 it('detects mouse and pen primary orbiting and exposes the angle change from actual controls',()=>{
  for(const pointerType of ['mouse','pen']){const {rig,canvas,ownerDocument}=setup();try{
   pointer(canvas,'pointerdown',{pointerType});const before=rig.orbitState();expect(before.active).toBe(true);
   let response=stepOrbitWaterResponse(createOrbitWaterResponse(),{...before,timeSeconds:0});
   pointer(ownerDocument,'pointermove',{pointerType,clientX:315,pageX:315});rig.update(input,null,1/60);
   const after=rig.orbitState();expect(after.azimuth).not.toBe(before.azimuth);
   response=stepOrbitWaterResponse(response,{...after,timeSeconds:1/60});expect(response.amplitude).toBeGreaterThan(0);
   pointer(ownerDocument,'pointerup',{pointerType});expect(rig.orbitState().active).toBe(false);
  }finally{rig.dispose();}}
 });

 it('retains the pointer-down rotation mode while modifiers are pressed and released mid-drag',()=>{
  for(const pointerType of ['mouse','pen'])for(const modifier of ['shiftKey','ctrlKey','metaKey']){
   const {rig,canvas,ownerDocument}=setup();try{
    pointer(canvas,'pointerdown',{pointerType});const start=rig.orbitState();
    let response=stepOrbitWaterResponse(createOrbitWaterResponse(),{...start,timeSeconds:0});
    for(const [i,pressed] of [false,true,false].entries()){
     const before=rig.orbitState(),x=305+i*5;
     pointer(ownerDocument,'pointermove',{pointerType,[modifier]:pressed,clientX:x,pageX:x});rig.update(input,null,1/60);
     const after=rig.orbitState();expect(after.azimuth).not.toBe(before.azimuth);expect(after.active).toBe(true);expect(after.revision).toBe(start.revision);
     const next=stepOrbitWaterResponse(response,{...after,timeSeconds:(i+1)/60});expect(next.amplitude).toBeGreaterThan(response.amplitude);response=next;
    }
   }finally{rig.dispose();}
  }
 });

 it('clears mouse and pen rotation when the primary button is released before pointer-up',()=>{
  for(const pointerType of ['mouse','pen']){const {rig,canvas,ownerDocument}=setup();try{
   pointer(canvas,'pointerdown',{pointerType});const before=rig.orbitState();expect(before.active).toBe(true);
   // Another button can remain held, so the browser may not emit pointer-up yet.
   pointer(ownerDocument,'pointermove',{pointerType,buttons:2,clientX:315,pageX:315});
   expect(rig.orbitState().active).toBe(false);expect(rig.orbitState().revision).toBeGreaterThan(before.revision);
  }finally{rig.dispose();}}
 });

 it('excludes middle/right drags and modified primary drags without disabling those controls',()=>{
  for(const patch of [{button:1,buttons:4},{button:2,buttons:2},{shiftKey:true},{ctrlKey:true},{metaKey:true}]){
   const {rig,canvas,ownerDocument}=setup();try{
    const previous=rig.camera.position.clone();pointer(canvas,'pointerdown',patch);
    pointer(ownerDocument,'pointermove',{...patch,clientX:325,clientY:320,pageX:325,pageY:320});
    expect(rig.orbitState().active).toBe(false);rig.update(input,null,1/60);
    expect(rig.camera.position.distanceTo(previous)).toBeGreaterThan(0);
    pointer(ownerDocument,'pointerup',patch);
   }finally{rig.dispose();}
  }
 });

 it('distinguishes one touch from pinch/pan even when a second touch begins and ends between frames',()=>{
  const {rig,canvas,ownerDocument}=setup();try{
   pointer(canvas,'pointerdown',{pointerType:'touch'});expect(rig.orbitState().active).toBe(true);const revision=rig.orbitState().revision;
   pointer(canvas,'pointerdown',{pointerType:'touch',pointerId:2,clientX:400,pageX:400});expect(rig.orbitState().active).toBe(false);
   pointer(ownerDocument,'pointerup',{pointerType:'touch',pointerId:2});
   expect(rig.orbitState().active).toBe(true);expect(rig.orbitState().revision).toBeGreaterThan(revision);
   pointer(ownerDocument,'pointerup',{pointerType:'touch'});expect(rig.orbitState().active).toBe(false);
  }finally{rig.dispose();}
 });

 it('rebaselines wheel zoom without marking it as a rotation',()=>{
  const {rig,canvas}=setup();try{
   const before=rig.orbitState(),distance=rig.camera.position.length();
   canvas.dispatchEvent(Object.assign(new Event('wheel',{cancelable:true}),{deltaY:100,deltaMode:0,clientX:300,clientY:300,ctrlKey:false}));
   rig.update(input,null,1/60);const after=rig.orbitState();
   expect(after.active).toBe(false);expect(after.revision).toBeGreaterThan(before.revision);
   expect(rig.camera.position.length()).not.toBeCloseTo(distance);
  }finally{rig.dispose();}
 });

 it('clears eligible gestures and changes the reset revision across camera and input discontinuities',()=>{
  const actions=[
   ({rig}:ReturnType<typeof setup>)=>rig.focus({x:1,y:0,z:0}),
   ({rig}:ReturnType<typeof setup>)=>rig.reset(),
   ({rig}:ReturnType<typeof setup>)=>rig.setMode('turtle'),
   ({rig}:ReturnType<typeof setup>)=>rig.setEnabled(false),
   ({canvas}:ReturnType<typeof setup>)=>canvas.dispatchEvent(new Event('blur')),
   ({ownerDocument}:ReturnType<typeof setup>)=>ownerDocument.dispatchEvent(new Event('visibilitychange')),
   ({canvas}:ReturnType<typeof setup>)=>pointer(canvas,'pointercancel'),
  ];
  for(const action of actions){const ui=setup();try{
   pointer(ui.canvas,'pointerdown');const revision=ui.rig.orbitState().revision;expect(ui.rig.orbitState().active).toBe(true);
   action(ui);expect(ui.rig.orbitState().active).toBe(false);expect(ui.rig.orbitState().revision).toBeGreaterThan(revision);
  }finally{ui.rig.dispose();}}
 });

 it('tracks the selected follow orbit but does not classify autonomous following as user rotation',()=>{
  const {rig,canvas,ownerDocument}=setup();try{
   rig.setMode('turtle');rig.update({...input,mode:'turtle'},{x:0,y:0,z:0},1/60);
   const before=rig.orbitState();expect(before.active).toBe(false);
   rig.update({...input,mode:'turtle'},{x:1,y:.1,z:1},1/60);expect(rig.orbitState().active).toBe(false);
   expect(rig.orbitState().azimuth).toBeCloseTo(before.azimuth,12);
   pointer(canvas,'pointerdown');pointer(ownerDocument,'pointermove',{clientX:315,pageX:315});
   rig.update({...input,mode:'turtle'},{x:1,y:.1,z:1},1/60);
   expect(rig.orbitState().active).toBe(true);expect(rig.orbitState().azimuth).not.toBeCloseTo(before.azimuth,8);
  }finally{rig.dispose();}
 });

 it('releases its observation listeners on disposal',()=>{
  const {rig,canvas,ownerDocument}=setup();rig.dispose();const revision=rig.orbitState().revision;
  pointer(canvas,'pointerdown');pointer(ownerDocument,'pointermove');pointer(ownerDocument,'pointerup');
  ownerDocument.dispatchEvent(new Event('visibilitychange'));canvas.dispatchEvent(new Event('wheel'));
  expect(rig.orbitState().active).toBe(false);expect(rig.orbitState().revision).toBe(revision);
 });

 it('clamps the visual uniform while leaving water geometry, depth maps, cutaway and CPU heights unchanged',()=>{
  const terrain=createTerrain(7),water=createWater(terrain);try{
   const surface=water.mesh.geometry.attributes.position.array.slice(),side=(water.mesh.children[0] as THREE.Mesh).geometry.attributes.position.array.slice();
   const bed=(terrain.heightTexture.image.data as Float32Array).slice(),height=waterHeightAt(1,2,3,.55,0,terrain.sampleHeight(1,2));
   water.setOrbitResponse(1);expect(water.diagnostics().orbitResponse).toBe(ORBIT_WATER_MAX_SLOPE);
   water.update(3,DEFAULT_CONTROLS);
   expect(water.mesh.geometry.attributes.position.array).toEqual(surface);
   expect((water.mesh.children[0] as THREE.Mesh).geometry.attributes.position.array).toEqual(side);
   expect(terrain.heightTexture.image.data).toEqual(bed);
   expect(waterHeightAt(1,2,3,.55,0,terrain.sampleHeight(1,2))).toBe(height);
   for(const invalid of [-1,NaN,Infinity]){water.setOrbitResponse(invalid);expect(water.diagnostics().orbitResponse).toBe(0);}
  }finally{water.dispose();terrain.dispose();}
 });
});

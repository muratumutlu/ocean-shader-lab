import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createContactTrails,CONTACT_TRAIL_LIMITS} from '../../src/turtle/contact-trails';
import type {TurtleContactFrame,TurtleSkinContact} from '../../src/runtime/turtle-contact-motion';

const cove={sampleHeight:()=>1,sampleNormal:()=>({x:0,y:1,z:0})};
const contact=(patch:Partial<TurtleSkinContact>={}):TurtleSkinContact=>({key:'front1',plantId:'plant-1',limb:'front',side:1,position:{x:.6,y:1,z:0},skinPosition:{x:.6,y:1.003,z:0},heading:.7,gap:.003,minimumLimbGap:.001,samples:4,stance:true,...patch});
const at=(z:number,patch:Partial<TurtleSkinContact>={})=>contact({position:{x:.6,y:1,z},skinPosition:{x:.6,y:1.003,z},...patch});
const frame=(time:number,contacts:readonly TurtleSkinContact[]=[contact()],patch:Partial<TurtleContactFrame>={}):TurtleContactFrame=>({time,tide:0,paused:false,discontinuity:false,contacts,...patch});
const meshOf=(trails:ReturnType<typeof createContactTrails>)=>trails.group.children[0] as THREE.InstancedMesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;

describe('observed skinned-contact trails',()=>{
 it('aligns the blade axis to its terrain-plane projection on sloping sand',()=>{
  const normal=new THREE.Vector3(-.13,1,-.21).normalize(),terrain={sampleHeight:(x:number,z:number)=>1+.13*x+.21*z,sampleNormal:()=>normal},trails=createContactTrails(terrain);
  try{
   trails.update(frame(0));const matrix=new THREE.Matrix4();meshOf(trails).getMatrixAt(0,matrix);
   const along=new THREE.Vector3().setFromMatrixColumn(matrix,1).normalize(),up=new THREE.Vector3().setFromMatrixColumn(matrix,2).normalize(),expected=new THREE.Vector3(Math.sin(.7),0,Math.cos(.7)).projectOnPlane(normal).normalize();
   expect(along.distanceTo(expected)).toBeLessThan(1e-6);expect(up.distanceTo(normal)).toBeLessThan(1e-6);expect(matrix.elements[13]).toBeCloseTo(terrain.sampleHeight(.6,0)+.005);
  }finally{trails.dispose();}
 });

 it('stamps the measured world contact and blade heading once without mutating input or adding body trails',()=>{
  const trails=createContactTrails(cove),c=contact();Object.freeze(c.position);Object.freeze(c.skinPosition);Object.freeze(c);const f=Object.freeze(frame(0,Object.freeze([c])));
  try{
   trails.update(f);const mesh=meshOf(trails),matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
   expect(matrix.elements[12]).toBeCloseTo(.6);expect(matrix.elements[13]).toBeCloseTo(1.005);expect(matrix.elements[14]).toBe(0);
   const bladeAlong=new THREE.Vector3().setFromMatrixColumn(matrix,1).normalize();expect(bladeAlong.x).toBeCloseTo(Math.sin(.7));expect(bladeAlong.z).toBeCloseTo(Math.cos(.7));
   for(let i=0;i<20;i++)trails.update(f);trails.update(frame(.1));
   expect(trails.diagnostics()).toMatchObject({active:1,emitted:1,stamps:1,segments:0});
   trails.update(frame(.2,[]));expect(trails.diagnostics().active).toBe(1);expect(trails.diagnostics().trackedContacts).toBe(0);
  }finally{trails.dispose();}
 });

 it('rejects floating, penetrating, wet and invalid contacts even when labelled stance',()=>{
  const trails=createContactTrails(cove);
  try{
   const invalid=[contact({gap:.01201}),contact({gap:-.00201}),contact({minimumLimbGap:-.00201}),contact({gap:NaN}),contact({heading:Infinity}),contact({samples:0}),contact({position:{x:NaN,y:1,z:0}}),contact({skinPosition:{x:0,y:Infinity,z:0}}),contact({key:'unbounded-key'})];
   invalid.forEach((c,i)=>trails.update(frame(i*.01,[c])));trails.update(frame(.1,[contact()],{tide:.92}));
   expect(trails.diagnostics().active).toBe(0);expect(trails.diagnostics().trackedContacts).toBe(0);
   trails.update(frame(.11,[contact({gap:-.002,minimumLimbGap:-.002})]));expect(trails.diagnostics().active).toBe(1);
   trails.update(frame(.12,[contact({plantId:'boundary',gap:.012})]));expect(trails.diagnostics().active).toBe(2);
  }finally{trails.dispose();}
 });

 it('keeps limb identities distinct and retains a nearby plant stamp across contact dropout',()=>{
  const trails=createContactTrails(cove),rear=contact({key:'rear1',limb:'rear',position:{x:.4,y:1,z:-.5}});
  try{
   trails.update(frame(0,[contact(),rear]));expect(trails.diagnostics().stamps).toBe(2);
   trails.update(frame(.05,[contact(),rear,contact()]));expect(trails.diagnostics().stamps).toBe(2);
   trails.update(frame(.1,[rear]));trails.update(frame(.15,[contact(),rear]));expect(trails.diagnostics().stamps).toBe(2);
   trails.update(frame(.2,[contact({plantId:'new-plant'}),rear]));expect(trails.diagnostics().stamps).toBe(3);expect(trails.diagnostics().segments).toBe(0);
  }finally{trails.dispose();}
 });

 it('suppresses 100 frames of same-plant contact jitter but permits a genuinely displaced or newly identified plant',()=>{
  const trails=createContactTrails(cove);
  try{
   for(let i=0;i<100;i++)trails.update(frame(i*.01,[at(.02,{gap:i%2===0?.003:.02})]));
   expect(trails.diagnostics()).toMatchObject({stamps:1,segments:0,rememberedStamps:1});
   trails.update(frame(1,[at(.20)]));expect(trails.diagnostics().stamps).toBe(2);
   trails.update(frame(1.01,[]));trails.update(frame(1.02,[at(.21)]));expect(trails.diagnostics()).toMatchObject({stamps:2,segments:0});
   trails.update(frame(1.03,[at(.21,{plantId:'new'})]));expect(trails.diagnostics().stamps).toBe(3);
   trails.reset();expect(trails.diagnostics().rememberedStamps).toBe(0);trails.update(frame(0,[at(.21,{plantId:'new'})]));expect(trails.diagnostics().stamps).toBe(1);
  }finally{trails.dispose();expect(trails.diagnostics().rememberedStamps).toBe(0);}
 });

 it('accumulates meaningful motion and never bridges raised recovery, large jumps, clock gaps or discontinuities',()=>{
  const trails=createContactTrails(cove);
  try{
   trails.update(frame(0,[at(0)]));trails.update(frame(.03,[at(.01)]));expect(trails.diagnostics().segments).toBe(0);
   trails.update(frame(.06,[at(.026)]));expect(trails.diagnostics().segments).toBe(1);
   const m=new THREE.Matrix4();meshOf(trails).getMatrixAt(1,m);expect(m.elements[14]).toBeCloseTo(.013);
   trails.update(frame(.09,[at(.30)]));expect(trails.diagnostics().segments).toBe(1);
   trails.update(frame(.12,[at(.34)]));expect(trails.diagnostics().segments).toBe(2);
   trails.update(frame(.15,[]));trails.update(frame(.18,[at(.40)]));expect(trails.diagnostics()).toMatchObject({segments:2,stamps:2});
   trails.update(frame(.60,[at(.45)]));expect(trails.diagnostics().segments).toBe(2);
   trails.update(frame(.65,[at(.49)]));expect(trails.diagnostics().segments).toBe(3);
   trails.update(frame(.70,[at(.55)],{discontinuity:true}));expect(trails.diagnostics().segments).toBe(3);
   trails.update(frame(.20,[at(.59)]));expect(trails.diagnostics().segments).toBe(3);
   trails.update(frame(.25,[at(.63)]));expect(trails.diagnostics().segments).toBe(4);
  }finally{trails.dispose();}
 });

 it('freezes mark geometry and age while paused, keeps tide masking responsive, and resumes without bridging paused motion',()=>{
  const trails=createContactTrails(cove);
  try{
   trails.update(frame(0));const mesh=meshOf(trails),matrices=Array.from(mesh.instanceMatrix.array),metadata=Array.from(mesh.geometry.getAttribute('imprint').array);
   trails.setPaused(true);trails.update(frame(4,[at(.4)],{tide:.4}));
   expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);expect(Array.from(mesh.geometry.getAttribute('imprint').array)).toEqual(metadata);expect(mesh.material.uniforms.uNow.value).toBe(0);expect(mesh.material.uniforms.uTide.value).toBe(.4);
   const beforeTide=trails.diagnostics();trails.setTide(.6);trails.setTide(Infinity);
   expect(mesh.material.uniforms.uTide.value).toBe(.6);expect(mesh.material.uniforms.uNow.value).toBe(0);expect(trails.diagnostics()).toEqual(beforeTide);expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);expect(Array.from(mesh.geometry.getAttribute('imprint').array)).toEqual(metadata);
   trails.setPaused(false);trails.update(frame(4.01,[at(.4)]));expect(trails.diagnostics()).toMatchObject({stamps:1,segments:0});
   trails.update(frame(4.05,[at(.44)]));expect(trails.diagnostics().segments).toBe(1);
   const before=trails.diagnostics().emitted;trails.update(frame(5,[at(.8)],{paused:true}));trails.update(frame(5.01,[at(.8)]));expect(trails.diagnostics().emitted).toBe(before);
  }finally{trails.dispose();}
 });

 it('holds a bounded ring buffer and resets contact history and marks together',()=>{
  const trails=createContactTrails(cove);
  try{
   for(let i=0;i<400;i++)trails.update(frame(i*.01,[contact({plantId:String(i)})]));
   expect(trails.diagnostics()).toMatchObject({active:CONTACT_TRAIL_LIMITS.capacity,emitted:400,stamps:400,trackedContacts:1});
   expect(meshOf(trails).instanceMatrix.count).toBe(CONTACT_TRAIL_LIMITS.capacity);
   trails.reset();expect(trails.diagnostics()).toMatchObject({active:0,emitted:0,trackedContacts:0});expect(meshOf(trails).visible).toBe(false);
   trails.update(frame(0));expect(trails.diagnostics().stamps).toBe(1);
  }finally{trails.dispose();}
 });

 it('rejects a wet segment midpoint and clears history on invalid frame data',()=>{
  const terrain={...cove,sampleHeight:(_x:number,z:number)=>z>.014&&z<.026?0:1},trails=createContactTrails(terrain);
  try{
   trails.update(frame(0,[at(0)]));trails.update(frame(.05,[at(.04)]));expect(trails.diagnostics().segments).toBe(0);
   trails.update(frame(NaN));expect(trails.diagnostics().trackedContacts).toBe(0);
   trails.update(frame(.1,[at(.08)]));expect(trails.diagnostics().emitted).toBe(1);
   trails.update(frame(.15,[at(.08)]));expect(trails.diagnostics().stamps).toBe(1);
  }finally{trails.dispose();}
 });

 it('owns only its mesh, geometry and material and leaves the borrowed terrain texture alive',()=>{
  const texture=new THREE.DataTexture(new Float32Array([1]),1,1,THREE.RedFormat,THREE.FloatType),trails=createContactTrails({...cove,heightTexture:texture}),mesh=meshOf(trails);
  let meshes=0,geometries=0,materials=0,textures=0;mesh.addEventListener('dispose',()=>meshes++);mesh.geometry.addEventListener('dispose',()=>geometries++);mesh.material.addEventListener('dispose',()=>materials++);texture.addEventListener('dispose',()=>textures++);
  expect(trails.diagnostics().terrainConforming).toBe(true);expect(mesh.material.uniforms.uHeight.value).toBe(texture);
  trails.dispose();trails.dispose();trails.update(frame(0));trails.reset();trails.setPaused(true);
  expect([meshes,geometries,materials,textures]).toEqual([1,1,1,0]);expect(trails.group.children).toHaveLength(0);expect(trails.diagnostics().disposed).toBe(true);texture.dispose();
 });
});

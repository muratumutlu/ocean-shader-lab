import {it,expect} from 'vitest';
import {Vector3,Quaternion} from 'three';
import {readFile} from 'node:fs/promises';
// The independent verifier reads the actual binary, not only its authoring manifest.
import {verifyTurtleAsset} from '../../scripts/assets/verify-turtle.mjs';
it('original GLB has bounded animated geometry, a complete rig and all locomotion clips',async()=>{
 const m=await verifyTurtleAsset('public/assets/turtle.glb');
 expect(m.byteLength).toBeLessThanOrEqual(3*1024*1024);expect(m.triangles.high).toBeLessThanOrEqual(8000);expect(m.triangles.low).toBeLessThanOrEqual(3000);expect(m.bones).toBeLessThanOrEqual(16);expect(m.materials).toBeLessThanOrEqual(2);
 expect(m.clips.map(c=>c.name).sort()).toEqual(['Crawl','Idle','Swim']);expect(m.sampledPoses).toBeGreaterThan(100);expect(m.proxy.radius).toBeGreaterThan(.5);expect(m.proxy.halfHeight).toBeGreaterThan(.1);
 const saved=JSON.parse(await readFile('assets/turtle/manifest.json','utf8'));expect(saved.fileSha256).toBe(m.fileSha256);expect(saved.byteLength).toBe(m.byteLength);expect(saved.proxy).toEqual(m.proxy);expect(m.bodyGroundSamples).toHaveLength(33);expect(m.bodyGroundSamples.every(p=>p.length>0)).toBe(true);expect(saved.bodyGroundSamples).toEqual(m.bodyGroundSamples);expect(m.idleBodyGroundSamples).toHaveLength(33);expect(saved.idleBodyGroundSamples).toEqual(m.idleBodyGroundSamples);
});
it('actual carapace has a descending rim joining the torso instead of an open floating lid',async()=>{
 const file=await readFile('public/assets/turtle.glb'),jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
 const node=doc.nodes.find((n:any)=>n.name==='TurtleHighShell'),primitive=doc.meshes[node.mesh].primitives[0],accessor=doc.accessors[primitive.attributes.POSITION],view=doc.bufferViews[accessor.bufferView];let rimMin=Infinity;
 for(let i=0;i<accessor.count;i++){const start=binStart+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12),x=file.readFloatLE(start),y=file.readFloatLE(start+4),z=file.readFloatLE(start+8);if(Math.hypot(x/.43,z/.65)>.82)rimMin=Math.min(rimMin,y);}
 expect(rimMin).toBeLessThan(-.035);
});

it('actual Caretta Crawl binary alternates long ground strokes with lifted recovery',async()=>{
 const file=await readFile('public/assets/turtle.glb'),jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength,crawl=doc.animations.find((a:any)=>a.name==='Crawl');
 const read=(index:number)=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],stride=v.byteStride??16,out=[];for(let i=0;i<a.count;i++){const offset=binStart+(v.byteOffset??0)+(a.byteOffset??0)+i*stride;out.push(new Quaternion(file.readFloatLE(offset),file.readFloatLE(offset+4),file.readFloatLE(offset+8),file.readFloatLE(offset+12)));}return out;};
 const pad=(side:number,frame:number)=>{const suffix=side<0?'L':'R',shoulder=doc.nodes.findIndex((n:any)=>n.name==='Front'+suffix),tip=doc.nodes.findIndex((n:any)=>n.name==='Front'+suffix+'Tip'),channel=(id:number)=>crawl.channels.find((c:any)=>c.target.node===id&&c.target.path==='rotation'),a=read(crawl.samplers[channel(shoulder).sampler].output)[frame],b=read(crawl.samplers[channel(tip).sampler].output)[frame];return new Vector3(side*.40,-.075,-.192).applyQuaternion(b).applyQuaternion(a).add(new Vector3(...doc.nodes[tip].translation).applyQuaternion(a)).add(new Vector3(...doc.nodes[shoulder].translation));};
 const front=pad(-1,2),back=pad(-1,17),lifted=pad(-1,25);
 expect(Math.abs(pad(-1,0).z-pad(1,0).z)).toBeGreaterThan(.5);
 expect(front.z-back.z).toBeGreaterThan(.48);expect(lifted.y-front.y).toBeGreaterThan(.10);
 for(const frame of [2,10,17,25]){const l=pad(-1,frame),r=pad(1,(frame+16)%32);expect(l.x+r.x).toBeCloseTo(0,4);expect(l.y).toBeCloseTo(r.y,4);expect(l.z).toBeCloseTo(r.z,4);}
});

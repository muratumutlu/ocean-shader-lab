import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
// The independent verifier reads the actual binary, not only its authoring manifest.
import {verifyTurtleAsset} from '../../scripts/assets/verify-turtle.mjs';
it('original GLB has bounded animated geometry, a complete rig and all locomotion clips',async()=>{
 const m=await verifyTurtleAsset('public/assets/turtle.glb');
 expect(m.byteLength).toBeLessThanOrEqual(3*1024*1024);expect(m.triangles.high).toBeLessThanOrEqual(8000);expect(m.triangles.low).toBeLessThanOrEqual(3000);expect(m.bones).toBeLessThanOrEqual(16);expect(m.materials).toBeLessThanOrEqual(2);
 expect(m.clips.map(c=>c.name).sort()).toEqual(['Crawl','Idle','Swim']);expect(m.sampledPoses).toBeGreaterThan(100);expect(m.proxy.radius).toBeGreaterThan(.5);expect(m.proxy.halfHeight).toBeGreaterThan(.1);
 const saved=JSON.parse(await readFile('assets/turtle/manifest.json','utf8'));expect(saved.fileSha256).toBe(m.fileSha256);expect(saved.byteLength).toBe(m.byteLength);expect(saved.proxy).toEqual(m.proxy);
});
it('actual carapace has a descending rim joining the torso instead of an open floating lid',async()=>{
 const file=await readFile('public/assets/turtle.glb'),jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
 const node=doc.nodes.find((n:any)=>n.name==='TurtleHighShell'),primitive=doc.meshes[node.mesh].primitives[0],accessor=doc.accessors[primitive.attributes.POSITION],view=doc.bufferViews[accessor.bufferView];let rimMin=Infinity;
 for(let i=0;i<accessor.count;i++){const start=binStart+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12),x=file.readFloatLE(start),y=file.readFloatLE(start+4),z=file.readFloatLE(start+8);if(Math.hypot(x/.43,z/.65)>.82)rimMin=Math.min(rimMin,y);}
 expect(rimMin).toBeLessThan(-.035);
});

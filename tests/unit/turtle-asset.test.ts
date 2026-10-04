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

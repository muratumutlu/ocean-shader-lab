import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createTerrain} from '../../src/scene/terrain';
import {createCamera} from '../../src/scene/camera';
import {Vector3} from 'three';
const sha=(data:Float32Array)=>createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
describe('dry-land volume with held shoreline',()=>{
 it('western crest spans a broad raised volume instead of peaking at the tile corner',()=>{
  const terrain=createTerrain(7);
  try{
   expect(terrain.sampleHeight(-16,-12)).toBeLessThan(1.4);
   expect(terrain.sampleHeight(-11,-12)).toBeGreaterThan(1.65);
   expect(terrain.sampleHeight(-7,-12)).toBeGreaterThan(2.1);
   const ground=terrain.group.children[0] as any,position=ground.geometry.attributes.position;
   // The shared CPU height must be represented in actual ground vertices.
   for(let i=0;i<position.count;i+=257)expect(position.getY(i)).toBeCloseTo(terrain.sampleHeight(position.getX(i),position.getZ(i)),5);
  }finally{terrain.dispose();}
 });
 it('projects a long uneven upper line and extended right shoulder at measured reference points',()=>{
  const terrain=createTerrain(7),{camera}=createCamera(2996/1870);camera.updateMatrixWorld();
  try{
   // Native reference boundary: existing camera, y grows down, edge uncertainty about3px.
   for(const [x,y] of [[-11.25,726],[-8.1,711],[-4.2,714],[-.7,752],[2.7,762]]){
    const projected=new Vector3(x,terrain.sampleHeight(x,-12),-12).project(camera);
    expect(Math.abs((1-projected.y)*1870/2-y)).toBeLessThan(5);
   }
  }finally{terrain.dispose();}
 });
 it('foreground tide band and middle/front ridge stay byte-identical to the frozen baseline',()=>{
  const terrain=createTerrain(7);
  try{
   const data=terrain.heightTexture.image.data as Float32Array;
   expect(sha(data.slice(129*30))).toBe('5ee11fdb1a50ef83a260e2f1d387e86dc96d47bba2b4710023d8ed9292f31283');
   const group=terrain.group.children.find(child=>child.children.some(mesh=>mesh.name==='layered-ridge'))!;
   const ridge=group.children.find(mesh=>mesh.name==='layered-ridge') as any;
   // Rear dry vertices may follow the newly joined hill; row105 starts at z−6.2333.
   expect(sha(ridge.geometry.attributes.position.array.slice(105*97*3))).toBe('65db57132e3564020ba96b4ae5148a92f4d08052c76e66fb4e9ecd904265cd96');
  }finally{terrain.dispose();}
 });
});

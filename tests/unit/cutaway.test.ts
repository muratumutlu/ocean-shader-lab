import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createTerrain} from '../../src/scene/terrain';
import {createWater} from '../../src/water/water';
it('land and water expose the same finite cutaway footprint and owned side faces',()=>{
 const terrain=createTerrain(7),water=createWater(terrain);
 try{
  water.mesh.geometry.computeBoundingBox();const wb=water.mesh.geometry.boundingBox!;
  const ground=terrain.group.children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh;ground.geometry.computeBoundingBox();const gb=ground.geometry.boundingBox!;
  expect(wb.min.x).toBeCloseTo(-16);expect(wb.max.x).toBeCloseTo(16);expect(wb.min.z).toBeCloseTo(-12);expect(wb.max.z).toBeCloseTo(12);
  expect(gb.min.x).toBeCloseTo(wb.min.x);expect(gb.max.z).toBeCloseTo(wb.max.z);
  expect(water.mesh.children.length).toBeGreaterThan(0);
  expect(terrain.group.getObjectByName('soil-cutaway')).toBeDefined();
 }finally{water.dispose();terrain.dispose();}
});
it('water releases its bed atlas once while the terrain retains its shared albedo map',()=>{
 const terrain=createTerrain(7),water=createWater(terrain);
 const ground=terrain.group.children.find(o=>o instanceof THREE.Mesh&&o.geometry.getAttribute('color')) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;
 const side=water.mesh.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 const atlas=side.material.uniforms.uBedVertexColor.value as THREE.DataTexture,sharedMap=ground.material.map!;
 let atlasReleases=0,mapReleases=0;
 atlas.addEventListener('dispose',()=>atlasReleases++);sharedMap.addEventListener('dispose',()=>mapReleases++);
 try{
  expect(side.material.uniforms.uBedMap.value).toBe(sharedMap);
  expect(atlas.image.width*atlas.image.height).toBe(ground.geometry.attributes.color.count);
  water.dispose();water.dispose();
  expect(atlasReleases).toBe(1);expect(mapReleases).toBe(0);
 }finally{water.dispose();terrain.dispose();}
 expect(mapReleases).toBe(1);
});

 it('closes the rear cut edge for full azimuth exploration',()=>{
  const terrain=createTerrain(7),water=createWater(terrain);try{const p=(water.mesh.children[0] as THREE.Mesh).geometry.attributes.position;let rear=0;for(let i=0;i<p.count;i++)if(p.getZ(i)===-12)rear++;expect(rear).toBeGreaterThan(160*5);}finally{water.dispose();terrain.dispose();}
 });

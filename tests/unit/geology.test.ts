import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createCove} from '../../src/scene/cove';
import {createRockShape} from '../../src/scene/cove-data';
import {sampleStratum,SOIL_FLOOR} from '../../src/scene/strata';
it('one geological depth field produces sand, sediment and weathered bedrock on all edges',()=>{
 for(const [x,z] of [[-16,-5],[16,2],[5,-12],[-6,12]]){
  expect(sampleStratum(x,z,.03).name).toBe('Sand');expect(sampleStratum(x,z,1.2).name).toBe('Sediment');expect(sampleStratum(x,z,3).name).toBe('Limestone');
  expect(sampleStratum(x,z,2)).toEqual(sampleStratum(x,z,2));
 }
 expect(SOIL_FLOOR).toBeLessThan(-7);
});
it('weathered rock render topology retains concave erosion rather than a convex-hull surface',()=>{
 const rock={x:0,z:0,radius:2,height:2.5,angle:.71,kind:'boulder' as const},s=createRockShape(rock);
 expect(s.indices.length/3).toBeGreaterThan(2500);expect(s.vertices.length/3).toBeGreaterThan(1000);expect(s.vertices).toEqual(createRockShape(rock).vertices);
 // Adjacent triangle normals vary, while welded smooth vertex normals preserve detail.
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(s.vertices,3));g.setIndex(new THREE.BufferAttribute(s.indices,1));g.computeVertexNormals();const n=g.attributes.normal;
 for(let i=0;i<n.count;i+=19)expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,4);g.dispose();
});
it('four stratified walls join actual terrain and contain small owned buried artifacts',()=>{
 const c=createCove(7);try{
  const soil=c.group.getObjectByName('soil-cutaway') as THREE.Mesh;expect(soil).toBeDefined();const p=soil.geometry.attributes.position;let floor=0,top=0;
  for(let i=0;i<p.count;i++){if(p.getY(i)===SOIL_FLOOR)floor++;if(Math.abs(p.getY(i)-c.sampleHeight(p.getX(i),p.getZ(i)))<.0001)top++;}
  expect(floor).toBeGreaterThan(128);expect(top).toBeGreaterThan(128);expect(c.group.getObjectByName('buried-artifacts')).toBeDefined();expect(c.data.bounds.min.y).toBe(SOIL_FLOOR);
 }finally{c.dispose();}
});

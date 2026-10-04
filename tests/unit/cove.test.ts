import {describe,it,expect} from 'vitest';
import {createCoveData,sampleGrid,createRockVertices} from '../../src/scene/cove-data';
import {createCove} from '../../src/scene/cove';
describe('original shared cove',()=>{
 it('same seed produces identical world and collision data',()=>{
  const a=createCoveData(7),b=createCoveData(7);
  expect(a.heights).toEqual(b.heights);expect(a.colliders).toEqual(b.colliders);
  expect(a.heights.length).toBe(129*129);expect(a.bounds.min.x).toBe(-16);expect(a.bounds.max.z).toBe(12);
  expect(createCoveData(8).rocks).not.toEqual(a.rocks);
 });
 it('render CPU and water grid agree across the entire tile',()=>{
  const c=createCove(7);try{
   for(let z=0;z<129;z++)for(let x=0;x<129;x++)expect(c.sampleHeight(-16+x/4,-12+z*24/128)).toBeCloseTo(c.data.heights[z*129+x],5);
   const g=(c.group.children[0] as any).geometry.attributes.position;
   for(let i=0;i<g.count;i+=113)expect(g.getY(i)).toBeCloseTo(c.sampleHeight(g.getX(i),g.getZ(i)),5);
   expect(c.data.colliders.filter(x=>x.kind==='convex')).toHaveLength(c.data.rocks.length);
  }finally{c.dispose();}
 });
 it('has a two unit clear swim to beach corridor with a gentle continuous slope',()=>{
  const d=createCoveData(7),c=createCove(7);try{
   expect(d.shoreRoute[0].y).toBeLessThan(-.95);expect(d.shoreRoute.at(-1)!.y).toBeGreaterThan(.65);
   for(const p of d.shoreRoute){
    for(const dx of [-1,0,1])expect(c.sampleOccupancy(p.x+dx,p.z)).toBeLessThan(.1);
    const n=c.sampleNormal(p.x,p.z);expect(Math.acos(n.y)).toBeLessThan(25*Math.PI/180);
   }
   const rocks=c.group.getObjectByName('cove-rocks')!;let triangles=0;const materials=new Set();
   rocks.traverse((x:any)=>{if(x.isMesh){triangles+=(x.geometry.index?.count??x.geometry.attributes.position.count)/3;materials.add(x.material);}});
   expect(triangles).toBeLessThanOrEqual(35000);expect(materials.size).toBeLessThanOrEqual(3);
   const before=sampleGrid(d,d.shoreRoute[0].x,d.shoreRoute[0].z);c.setQuality('low');expect(c.sampleHeight(d.shoreRoute[0].x,d.shoreRoute[0].z)).toBe(before);
  }finally{c.dispose();}
 });
});

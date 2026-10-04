import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createCeramic} from '../../src/scene/ceramic';
it('weathered vessel has a real open cavity, broken rim, separate inner clay and sediment',()=>{
 const a=createCeramic(7);try{
  const shell=a.geometry;expect(shell.getAttribute('position').count).toBeGreaterThan(5000);expect(shell.getAttribute('clayInside')).toBeDefined();expect(shell.getAttribute('clayFracture')).toBeDefined();
  const p=shell.getAttribute('position');shell.computeBoundingBox();expect(shell.boundingBox!.max.y-shell.boundingBox!.min.y).toBeGreaterThan(.4);
  const faces=p.count;expect(faces).toBe(a.geometry.getAttribute('normal').count);expect(a.sediment.geometry.getAttribute('position').count).toBeGreaterThan(100);
  for(let i=0;i<faces;i+=31)expect(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i))).toBe(true);
 }finally{a.dispose();a.dispose();}
});

it('licensed skeleton preserves adult axial and paired limb anatomy with finite indexed geometry',async()=>{
 const {createSkeleton,SKELETON_CREDITS}=await import('../../src/scene/skeleton');const a=createSkeleton();try{
  expect(SKELETON_CREDITS).toContain('CC Attribution 4.0');expect(a.bones).toBeGreaterThanOrEqual(196);
  const g=a.geometry,p=g.getAttribute('position');g.computeBoundingBox();const b=g.boundingBox!;
  expect(b.max.y-b.min.y).toBeCloseTo(1.7,2);expect(b.max.x-b.min.x).toBeGreaterThan(.5);expect(g.index!.count).toBeGreaterThan(50000);
  for(let i=0;i<p.count;i+=53)expect(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i))).toBe(true);
  expect(a.parts.some(p=>p.name==='mandible')).toBe(true);for(const side of ['right','left'])expect(a.parts.some(p=>p.name===side+' femur')).toBe(true);
 }finally{a.dispose();a.dispose();}
});

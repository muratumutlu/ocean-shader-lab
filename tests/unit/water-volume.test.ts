import {describe,it,expect} from 'vitest';
import {waterHeightAt,updateSubmerged} from '../../src/water/waves';
describe('finite water volume',()=>{
 it('uses the same bounded wave field and terrain depth fade',()=>{
  expect(waterHeightAt(1,2,0,.85,.35,.35)).toBe(.35);
  for(let t=0;t<20;t+=.1){const y=waterHeightAt(2,3,t,.85,-.35,-3);expect(Number.isFinite(y)).toBe(true);expect(Math.abs(y+.35)).toBeLessThanOrEqual((.028+.85*.11)*1.7+1e-6);}
 });
 it('keeps a deadband around the actual surface and exits dry or bounded volume',()=>{
  expect(updateSubmerged(false,{x:0,y:-1,z:5},0,-2)).toBe(true);
  expect(updateSubmerged(true,{x:0,y:.02,z:5},0,-2)).toBe(true);
  expect(updateSubmerged(false,{x:0,y:-.02,z:5},0,-2)).toBe(false);
  expect(updateSubmerged(true,{x:17,y:-1,z:5},0,-2)).toBe(false);
  expect(updateSubmerged(true,{x:0,y:-1,z:5},0,.2)).toBe(false);
 });
});

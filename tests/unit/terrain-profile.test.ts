import {it,expect} from 'vitest';
import {createCove} from '../../src/scene/cove';
it('original asymmetrical dunes join a continuous broad beach',()=>{
 const c=createCove(7);try{
  expect(c.sampleHeight(-6,-10)).toBeGreaterThan(c.sampleHeight(0,-10));
  expect(c.sampleHeight(0,-10)).toBeGreaterThan(1);
  expect(c.sampleHeight(0,10)).toBeLessThan(-1);
  for(const p of c.data.shoreRoute)expect(c.sampleNormal(p.x,p.z).y).toBeGreaterThan(Math.cos(25*Math.PI/180));
 }finally{c.dispose();}
});

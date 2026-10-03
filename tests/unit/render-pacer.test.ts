import {it,expect} from 'vitest';
import {createQualityController} from '../../src/runtime/quality';
const path='../../src/runtime/render-pacer.ts';const api=await import(path).catch(()=>({}));
it('preserves timing remainder near the mobile budget instead of halving the frame rate',()=>{
 expect(api.createRenderPacer).toBeTypeOf('function');const pacer=api.createRenderPacer(30),q=createQualityController('auto',30,()=>{});
 let count=0,last:number|null=null;for(let now=0;now<=6000;now+=30)if(pacer.shouldRender(now)){count++;if(last!==null)q.observe(now-last);last=now;}
 expect(count).toBeGreaterThanOrEqual(175);expect(count).toBeLessThanOrEqual(182);expect(q.current().profile).toBe('balanced');
});
it('actual slow render cadence lowers Auto and reset allows an immediate resumed render',()=>{
 expect(api.createRenderPacer).toBeTypeOf('function');const pacer=api.createRenderPacer(30),q=createQualityController('auto',30,()=>{});let last:number|null=null;
 for(let now=0;now<=4000;now+=50)if(pacer.shouldRender(now)){if(last!==null)q.observe(now-last);last=now;}
 expect(q.current().profile).toBe('low');pacer.reset();expect(pacer.shouldRender(4500)).toBe(true);
});

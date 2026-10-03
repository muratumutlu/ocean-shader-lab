import {it,expect} from 'vitest';
const modulePath='../../src/runtime/quality.ts';const api=await import(modulePath).catch(()=>({}));
it('Auto reduces sustained slow frames, while a manual profile is retained',()=>{
 expect(api.createQualityController).toBeTypeOf('function');const q=api.createQualityController('auto',60,()=>{});
 for(let i=0;i<50;i++)q.observe(65);expect(q.current().profile).toBe('low');
 q.setMode('high');for(let i=0;i<100;i++)q.observe(65);expect(q.current().profile).toBe('high');
 q.setMode('auto');expect(q.current().profile).toBe('balanced');
});
it('a single slow frame does not lower quality',()=>{expect(api.createQualityController).toBeTypeOf('function');const q=api.createQualityController('auto',60,()=>{});q.observe(200);for(let i=0;i<200;i++)q.observe(16);expect(q.current().profile).toBe('balanced');});

import {describe,it,expect} from 'vitest';
const modulePath='../../src/runtime/frame-loop.ts';const api=await import(modulePath).catch(()=>({}));
function clock(){let now=0,id=0;const jobs=new Map<number,(time:number)=>void>();return {now:()=>now,request:(fn:(time:number)=>void)=>{jobs.set(++id,fn);return id;},cancel:(key:number)=>jobs.delete(key),pending:()=>jobs.size,tick:(ms:number)=>{now+=ms;const current=[...jobs.values()];jobs.clear();current.forEach(fn=>fn(now));}};}
describe('frame lifecycle',()=>{
 it('paused start does not animate; repeated resume owns one pending frame',()=>{
  expect(api.createFrameLoop).toBeTypeOf('function');const c=clock(),frames:number[]=[];const loop=api.createFrameLoop(c,(t:number)=>frames.push(t));
  loop.setActivity({paused:true,visible:true});expect(c.pending()).toBe(0);loop.setActivity({paused:false,visible:true});loop.setActivity({paused:false,visible:true});expect(c.pending()).toBe(1);c.tick(16);expect(frames).toEqual([0]);expect(c.pending()).toBe(1);loop.dispose();
 });
 it('hidden interval never jumps time and disposed loops never render',()=>{
  expect(api.createFrameLoop).toBeTypeOf('function');const c=clock(),deltas:number[]=[];const loop=api.createFrameLoop(c,(_t:number,d:number)=>deltas.push(d));
  loop.setActivity({paused:false,visible:true});c.tick(16);c.tick(16);loop.setActivity({paused:false,visible:false});expect(c.pending()).toBe(0);c.tick(120000);loop.setActivity({paused:false,visible:true});c.tick(16);c.tick(1000);
  expect(deltas).toEqual([0,.016,0,.05]);loop.dispose();loop.setActivity({paused:false,visible:true});c.tick(1000);expect(c.pending()).toBe(0);expect(deltas).toHaveLength(4);
 });
});

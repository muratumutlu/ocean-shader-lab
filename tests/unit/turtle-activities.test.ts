import {describe,expect,it} from 'vitest';
import {createTurtleActivities,TURTLE_ACTIVITY_LIMITS,type TurtleActivityPlan,type TurtleActivityObservation} from '../../src/turtle/activities';

const timings={approachTimeout:.3,leaveTimeout:.3,rest:.1,feed:.2,dig:.2,eggInterval:.1,cover:.2};
const nest:TurtleActivityPlan={id:'nest-command',kind:'nest',target:{position:{x:1,y:.2,z:-1},heading:Math.PI},leavePosition:{x:1,y:-.5,z:6},nestCenter:{x:1,y:-.1,z:-.6},eggCount:3};
const feed:TurtleActivityPlan={id:'feed-command',kind:'feed',target:{position:{x:0,y:-.5,z:3},heading:0},leavePosition:{x:1,y:-.5,z:6},foodPosition:{x:0,y:-.75,z:3.7}};
function observation(plan:TurtleActivityPlan=nest):TurtleActivityObservation{
 return {turtle:{position:{...plan.target.position},heading:plan.target.heading,velocity:{x:0,y:0,z:0}},habitat:plan.kind==='nest'?'dry-ground':'underwater',siteValid:true,manualInputActive:false,paused:false};
}
const create=()=>createTurtleActivities({enabled:true,namespace:'fixture',timings});
function advance(model:ReturnType<typeof createTurtleActivities>,obs:TurtleActivityObservation,seconds:number,dt=.05){
 let left=seconds;while(left>1e-12){const take=Math.min(left,dt);model.step(obs,take);left-=take;}return model.state;
}

describe('explicit turtle activity episodes',()=>{
 it('requires opt-in and a command, and never writes the supplied turtle pose',()=>{
  const model=createTurtleActivities({timings}),obs=observation();
  expect(model.request(nest)).toEqual({accepted:false,reason:'disabled'});model.step(obs,.1);expect(model.intent().kind).toBe('none');
  model.setEnabled(true);expect(model.state.phase).toBe('idle');expect(model.request(nest)).toEqual({accepted:true});
  Object.freeze(obs.turtle.position);Object.freeze(obs.turtle.velocity);Object.freeze(obs.turtle);Object.freeze(obs);
  const before=JSON.stringify(obs);model.step(obs,.05);expect(model.state.phase).toBe('rest');expect(JSON.stringify(obs)).toBe(before);
  expect(model.request(feed)).toEqual({accepted:false,reason:'busy'});
 });

 it('requires observed arrival, wrapped heading alignment and settling before any stationary action',()=>{
  const model=create();model.request(nest);
  const far={...observation(),habitat:'underwater' as const,turtle:{...observation().turtle,position:{x:1,y:-.5,z:5}}};
  model.step(far,.05);expect(model.state.phase).toBe('approach');expect(model.intent()).toMatchObject({kind:'navigate',arrivalHabitat:'dry-ground',heading:Math.PI});
  const wrongHeading={...observation(),turtle:{...observation().turtle,heading:0}};
  model.step(wrongHeading,.05);expect(model.state.phase).toBe('approach');
  const moving={...observation(),turtle:{...observation().turtle,velocity:{x:.2,y:0,z:0}}};
  model.step(moving,.05);expect(model.state.phase).toBe('approach');
  const wrapped={...observation(),turtle:{...observation().turtle,heading:-Math.PI+.01}};
  model.step(wrapped,.05);expect(model.state.phase).toBe('rest');expect(model.intent()).toMatchObject({kind:'pose',action:'rest'});
 });

 it('performs feeding only underwater and completes only after actual departure',()=>{
  const model=create();model.request(feed);const obs=observation(feed);
  model.step({...obs,habitat:'shore'},.05);expect(model.state.phase).toBe('approach');
  advance(model,obs,.3);expect(model.state.phase).toBe('leave');expect(model.state.feedingProgress).toBe(1);expect(model.state.eggs).toHaveLength(0);
  model.step(obs,.05);expect(model.state.phase).toBe('leave');
  model.step({...obs,turtle:{...obs.turtle,position:feed.leavePosition}},.05);
  expect(model.state.phase).toBe('complete');expect(model.intent().kind).toBe('none');
  const completed=model.state;model.step(obs,1);expect(model.state).toBe(completed);
 });

 it('lays each egg exactly once, covers them, then requests a real return to water',()=>{
  const model=create();model.request(nest);const obs=observation();
  advance(model,obs,.3);expect(model.state.phase).toBe('lay');expect(model.state.eggs).toHaveLength(0);
  model.step(obs,.1);expect(model.state.eggs.map(e=>e.index)).toEqual([0]);
  model.step(obs,.1);expect(model.state.eggs.map(e=>e.index)).toEqual([0,1]);
  model.step(obs,.1);expect(model.state.phase).toBe('cover');expect(model.state.eggs.map(e=>e.index)).toEqual([0,1,2]);expect(model.state.coverage).toBe(0);
  model.step(obs,.1);expect(model.state.coverage).toBeCloseTo(.5);const partlyCovered=model.state;
  model.step(obs,.1);expect(model.state.phase).toBe('leave');expect(model.state.coverage).toBe(1);expect(partlyCovered.coverage).toBeCloseTo(.5);
  model.step({...obs,habitat:'shore',turtle:{...obs.turtle,position:{x:1,y:0,z:2}}},.05);expect(model.state.phase).toBe('leave');
  model.step({...obs,habitat:'underwater',turtle:{...obs.turtle,position:nest.leavePosition}},.05);expect(model.state.phase).toBe('complete');
  expect(new Set(model.state.eggs.map(e=>e.id)).size).toBe(3);
 });

 it('freezes all progress during ordinary pause, including just before the next egg',()=>{
  const model=create();model.request(nest);const obs=observation();advance(model,obs,.39);const before=model.state;
  model.step({...obs,paused:true},100);expect(model.state).toBe(before);expect(model.state.eggs).toHaveLength(0);
  model.step(obs,.01);expect(model.state.eggs).toHaveLength(1);
  const one=model.state;for(const dt of [0,-1,NaN,Infinity]){model.step(obs,dt);expect(model.state).toBe(one);}
 });

 it('gives human takeover and invalid sites priority over pause without creating a pending egg',()=>{
  for(const [patch,reason] of [[{manualInputActive:true},'manual-control'],[{siteValid:false},'site-unavailable']] as const){
   const model=create();model.request(nest);const obs=observation();advance(model,obs,.39);
   model.step({...obs,...patch,paused:true},0);expect(model.state.phase).toBe('cancelled');expect(model.state.reason).toBe(reason);expect(model.state.eggs).toHaveLength(0);
  }
 });

 it('preserves laid eggs and partial cover on cancellation, including disabling while paused',()=>{
  const model=create();model.request(nest);const obs=observation();advance(model,obs,.7);const before=model.state;
  model.setEnabled(false);expect(model.state.phase).toBe('cancelled');expect(model.state.reason).toBe('disabled');
  expect(model.state.eggs).toBe(before.eggs);expect(model.state.coverage).toBe(before.coverage);expect(model.intent().kind).toBe('none');
  model.step({...obs,paused:true},100);expect(model.state.eggs).toHaveLength(3);
  expect(model.request(feed)).toEqual({accepted:false,reason:'disabled'});
 });

 it('cancels habitat loss or drift during stationary stages but permits shore transit',()=>{
  const model=create();model.request(nest);const obs=observation();
  model.step({...obs,habitat:'underwater',turtle:{...obs.turtle,position:{x:1,y:-.5,z:4}}},.05);
  model.step({...obs,habitat:'shore',turtle:{...obs.turtle,position:{x:1,y:0,z:1}}},.05);expect(model.state.phase).toBe('approach');
  advance(model,obs,.45);expect(model.state.eggs).toHaveLength(1);
  model.step({...obs,habitat:'shore',paused:true},.1);expect(model.state.reason).toBe('habitat-changed');expect(model.state.eggs).toHaveLength(1);
  const drifting=create();drifting.request(feed);drifting.step(observation(feed),.05);
  drifting.step({...observation(feed),turtle:{...observation(feed).turtle,velocity:{x:.3,y:0,z:0}}},.05);
  expect(drifting.state.reason).toBe('pose-lost');
 });

 it('bounds blocked approach and leave, and does not fast-forward a large delta',()=>{
  const model=create();model.request(nest);const obs=observation();
  const far={...obs,turtle:{...obs.turtle,position:{x:4,y:.2,z:5}}};model.step(far,100);
  expect(model.state.elapsed).toBe(TURTLE_ACTIVITY_LIMITS.maxStepSeconds);expect(model.state.phase).toBe('approach');
  advance(model,far,.2);expect(model.state.reason).toBe('approach-timeout');expect(model.state.eggs).toHaveLength(0);
  const leaving=create();leaving.request(nest);advance(leaving,obs,.8);advance(leaving,obs,.3);
  expect(leaving.state.reason).toBe('leave-timeout');expect(leaving.state.eggs).toHaveLength(3);expect(leaving.state.coverage).toBe(1);
 });

 it('preserves timing remainder and produces equivalent outcomes at different valid step sizes',()=>{
  const run=(dt:number)=>{const model=create();model.request(nest);advance(model,observation(),.73,dt);return model.state;};
  const expected=run(1/60);for(const dt of [1/30,1/144,.07,.1]){
   const actual=run(dt);expect(actual.phase).toBe(expected.phase);expect(actual.eggs).toEqual(expected.eggs);
   expect(actual.phaseElapsed).toBeCloseTo(expected.phaseElapsed,10);expect(actual.elapsed).toBeCloseTo(expected.elapsed,10);expect(actual.coverage).toBeCloseTo(expected.coverage,10);
  }
 });

 it('supports the maximum finite clutch without duplicate or excess eggs',()=>{
  const model=createTurtleActivities({enabled:true,timings:{...timings,eggInterval:.05}});model.request({...nest,kind:'nest',nestCenter:{x:1,y:-.1,z:-.6},eggCount:128});
  advance(model,observation(),6.9,.1);expect(model.state.phase).toBe('leave');expect(model.state.eggs).toHaveLength(128);
  expect(model.state.eggs.at(-1)!.index).toBe(127);expect(new Set(model.state.eggs.map(e=>e.id)).size).toBe(128);expect(model.state.coverage).toBe(1);
  advance(model,observation(),1,.1);expect(model.state.eggs).toHaveLength(128);expect(model.state.reason).toBe('leave-timeout');
 });

 it('copies plans, freezes historical snapshots and does not reuse egg IDs after reset',()=>{
  const model=create(),plan=structuredClone(nest);model.request(plan);
  (plan.target.position as {x:number}).x=99;expect(model.state.plan!.target.position.x).toBe(1);
  advance(model,observation(),.5);const first=model.state,firstId=first.eggs[0].id;
  expect(Object.isFrozen(first)).toBe(true);expect(Object.isFrozen(first.plan!.target.position)).toBe(true);expect(Object.isFrozen(first.eggs)).toBe(true);expect(Object.isFrozen(first.eggs[0])).toBe(true);
  model.cancel();expect(model.request(nest)).toEqual({accepted:false,reason:'duplicate'});
  model.reset();expect(model.state.enabled).toBe(true);expect(model.state.eggs).toHaveLength(0);expect(model.state.phase).toBe('idle');
  model.request(nest);advance(model,observation(),.4);expect(model.state.eggs[0].id).not.toBe(firstId);expect(first.eggs).toHaveLength(2);
 });

 it('rejects invalid plans/timings and terminates unsafe observations without emitting eggs',()=>{
  const model=create();
  for(const plan of [{...nest,eggCount:0},{...nest,eggCount:1.5},{...nest,eggCount:129},{...nest,id:''},{...nest,target:{position:{x:NaN,y:0,z:0},heading:0}},{...feed,foodPosition:{x:Infinity,y:0,z:0}}])expect(model.request(plan)).toEqual({accepted:false,reason:'invalid-plan'});
  for(const value of [0,-1,NaN,Infinity,31])expect(()=>createTurtleActivities({timings:{dig:value}})).toThrow(RangeError);
  model.request(nest);model.step({...observation(),turtle:{...observation().turtle,heading:NaN}},.1);
  expect(model.state.reason).toBe('invalid-observation');expect(model.state.eggs).toHaveLength(0);
 });
});

import type {EnvironmentSnapshot} from '../types';
export function createSimulationClock(){
 let waterPhase=0,lifePhase=0,accumulator=0;
 return {get waterPhase(){return waterPhase;},get lifePhase(){return lifePhase;},resetAccumulator(){accumulator=0;},advance(rawDelta:number,paused:boolean,environment:EnvironmentSnapshot,step:(dt:number)=>void){
  if(paused){accumulator=0;return;}const dt=Number.isFinite(rawDelta)?Math.max(0,Math.min(.1,rawDelta)):0;waterPhase+=dt*environment.waveSpeed;lifePhase+=dt*environment.flow;accumulator+=dt;let steps=0;
  while(accumulator+1e-9>=1/60&&steps<6){step(1/60);accumulator-=1/60;steps++;}if(steps===6)accumulator=Math.max(0,accumulator%(1/60));
 }};
}

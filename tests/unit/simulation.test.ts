import {it,expect} from 'vitest';
import {createSimulationClock} from '../../src/runtime/simulation';
import {DEFAULT_SETTINGS} from '../../src/runtime/settings';
import {resolveEnvironment} from '../../src/runtime/environment';
it('uses bounded fixed steps and continuous independent phase increments across settings and pauses',()=>{
 const c=createSimulationClock(),b=resolveEnvironment(DEFAULT_SETTINGS),a=resolveEnvironment({...DEFAULT_SETTINGS,seaState:'active'});let calls=0;c.advance(.03,false,b,dt=>{expect(dt).toBe(1/60);calls++;});expect(calls).toBe(1);expect(c.waterPhase).toBeCloseTo(.03);
 c.advance(.02,false,a,()=>calls++);expect(c.waterPhase).toBeCloseTo(.056);expect(c.lifePhase).toBeCloseTo(.041);const before=c.waterPhase;c.advance(999,true,a,()=>calls++);expect(c.waterPhase).toBe(before);
 c.resetAccumulator();const previous=calls;c.advance(999,false,a,()=>calls++);expect(calls-previous).toBe(6);expect(c.waterPhase-before).toBeCloseTo(.13);
 c.advance(NaN,false,a,()=>calls++);expect(Number.isFinite(c.waterPhase)).toBe(true);c.resetAccumulator();c.advance(.001,false,b,()=>calls++);expect(calls-previous).toBe(6);
});

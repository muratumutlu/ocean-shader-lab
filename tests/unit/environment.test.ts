import {it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../../src/runtime/settings';
import {resolveEnvironment} from '../../src/runtime/environment';
it('resolves bounded daylight and exact sea-state controls for one shared sun',()=>{
 const noon=resolveEnvironment({...DEFAULT_SETTINGS,hour:12}),early=resolveEnvironment({...DEFAULT_SETTINGS,hour:6}),late=resolveEnvironment({...DEFAULT_SETTINGS,hour:20});
 expect(early.controls.sunAzimuth).toBe(90);expect(late.controls.sunAzimuth).toBe(270);expect(noon.sun.y).toBeGreaterThan(early.sun.y);expect(noon.sun.y).toBeGreaterThan(late.sun.y);expect(early.sun.y).toBeGreaterThan(0);expect(noon.sunColor).not.toBe(early.sunColor);
 for(const [sea,swell,speed,flow] of [['calm',.25,.65,.35],['breezy',.55,1,.70],['active',.85,1.3,1]] as const){const e=resolveEnvironment({...DEFAULT_SETTINGS,seaState:sea,tide:.35});expect(e.controls).toMatchObject({swell,tide:.35});expect(e.waveSpeed).toBe(speed);expect(e.flow).toBe(flow);expect((Math.atan2(e.sun.z,e.sun.x)*180/Math.PI+360)%360).toBeCloseTo(e.controls.sunAzimuth,5);}
});

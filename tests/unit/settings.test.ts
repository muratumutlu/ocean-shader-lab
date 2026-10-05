import {it,expect} from 'vitest';
import {DEFAULT_SETTINGS,normalizeSettings,parseSettings,serializeSettings} from '../../src/runtime/settings';
it('roundtrips only normalized versioned scenery, never pose or time',()=>{
 expect(serializeSettings(DEFAULT_SETTINGS)).toBe('#v=1&seed=7&hour=15&sea=breezy&tide=0&marine=1&density=0.5&quality=auto&mode=camera');expect(parseSettings(serializeSettings(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
 const n=normalizeSettings({hour:99,tide:-9,density:Infinity,controlMode:'eval',seed:-100});expect(n).toMatchObject({hour:20,tide:-.35,density:.5,controlMode:'camera',seed:0});
 expect(parseSettings('#v=1&camera=script&seed=NaN&hour=Infinity')).toEqual(DEFAULT_SETTINGS);expect(parseSettings('#v=99&seed=8')).toEqual(DEFAULT_SETTINGS);expect(parseSettings('#'+Array(4100).fill('a').join(''))).toEqual(DEFAULT_SETTINGS);
 expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);expect(normalizeSettings({hour:2,tide:5,seed:1e30})).toMatchObject({hour:6,tide:.35,seed:4294967295});
 expect(serializeSettings({...DEFAULT_SETTINGS,time:1,camera:'x'} as any)).not.toMatch(/time|camera=x/);
});

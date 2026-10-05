import {Color} from 'three';
import type {CoveSettings,EnvironmentSnapshot} from '../types';
import {normalizeSettings} from './settings';
export function resolveEnvironment(input:CoveSettings):EnvironmentSnapshot{
 const s=normalizeSettings(input),tuples={calm:[.25,.65,.35],breezy:[.55,1,.70],active:[.85,1.3,1]},[swell,waveSpeed,flow]=tuples[s.seaState];
 const azimuth=90+(s.hour-6)/14*180,elevation=8+54*Math.cos((s.hour-12)/(s.hour<=12?6:8)*Math.PI/2),az=azimuth*Math.PI/180,el=elevation*Math.PI/180,day=Math.max(0,Math.min(1,(elevation-8)/54)),color=new Color(0xffc391).lerp(new Color(0xfff1db),day);
 return {controls:{swell,tide:s.tide,sunAzimuth:azimuth},sun:{x:Math.cos(az)*Math.cos(el)*32,y:Math.sin(el)*32,z:Math.sin(az)*Math.cos(el)*32},sunColor:color.getHex(),sunIntensity:2.5+.9*day,ambientIntensity:.55+.45*day,waveSpeed,flow};
}

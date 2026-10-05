import type {CoveSettings} from '../types';
export const DEFAULT_SETTINGS:CoveSettings={version:1,seed:7,hour:15,seaState:'breezy',tide:0,marineEnabled:true,density:.5,quality:'auto',controlMode:'camera'};
export function normalizeSettings(input:unknown):CoveSettings{
 const x=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const num=(key:keyof CoveSettings,min:number,max:number)=>typeof x[key]==='number'&&Number.isFinite(x[key])?Math.max(min,Math.min(max,x[key] as number)):DEFAULT_SETTINGS[key] as number;
 const choice=<K extends keyof CoveSettings>(key:K,values:readonly string[]):CoveSettings[K]=>values.includes(x[key] as string)?x[key] as CoveSettings[K]:DEFAULT_SETTINGS[key];
 return {version:1,seed:Math.trunc(num('seed',0,4294967295)),hour:num('hour',6,20),seaState:choice('seaState',['calm','breezy','active']),tide:num('tide',-.35,.35),marineEnabled:typeof x.marineEnabled==='boolean'?x.marineEnabled:DEFAULT_SETTINGS.marineEnabled,density:num('density',0,1),quality:choice('quality',['auto','low','balanced','high']),controlMode:choice('controlMode',['camera','turtle'])};
}
export function parseSettings(fragment:string):CoveSettings{
 if(typeof fragment!=='string'||fragment.length>4096)return {...DEFAULT_SETTINGS};const p=new URLSearchParams(fragment.replace(/^#/,''));if(p.get('v')!=='1')return {...DEFAULT_SETTINGS};
 const n=(key:string)=>p.has(key)&&p.get(key)!==''?Number(p.get(key)):undefined;
 return normalizeSettings({seed:n('seed'),hour:n('hour'),seaState:p.get('sea'),tide:n('tide'),marineEnabled:p.get('marine')==='1'?true:p.get('marine')==='0'?false:undefined,density:n('density'),quality:p.get('quality'),controlMode:p.get('mode')});
}
export function serializeSettings(input:CoveSettings):string{
 const s=normalizeSettings(input);return '#'+new URLSearchParams({v:'1',seed:String(s.seed),hour:String(s.hour),sea:s.seaState,tide:String(s.tide),marine:s.marineEnabled?'1':'0',density:String(s.density),quality:s.quality,mode:s.controlMode}).toString();
}

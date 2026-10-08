import type {QualityMode,QualityProfile} from '../types';
/** `autoStart` is where Auto begins; it only ever steps down when frames run slow. */
export function createQualityController(initial:QualityMode,targetFps:30|60,onProfile:(profile:QualityProfile)=>void,autoStart:QualityProfile='balanced'){
 let mode=initial,profile:QualityProfile=mode==='auto'?autoStart:mode,total=0,count=0;
 return {current:()=>({mode,profile}),setMode(next:QualityMode){mode=next;profile=next==='auto'?autoStart:next;total=0;count=0;onProfile(profile);},
 observe(frameMs:number){if(mode!=='auto'||!Number.isFinite(frameMs)||frameMs<=0)return;total+=frameMs;count++;if(total<3000)return;const slow=total/count>(1000/targetFps)*1.35;total=0;count=0;if(slow&&profile!=='low'){profile=profile==='high'?'balanced':'low';onProfile(profile);}}};
}

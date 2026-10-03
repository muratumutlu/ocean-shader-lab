import type {QualityMode,QualityProfile} from '../types';
export function createQualityController(initial:QualityMode,targetFps:30|60,onProfile:(profile:QualityProfile)=>void){
 let mode=initial,profile:QualityProfile=mode==='auto'?'balanced':mode,total=0,count=0;
 return {current:()=>({mode,profile}),setMode(next:QualityMode){mode=next;profile=next==='auto'?'balanced':next;total=0;count=0;onProfile(profile);},
 observe(frameMs:number){if(mode!=='auto'||!Number.isFinite(frameMs)||frameMs<=0)return;total+=frameMs;count++;if(total<3000)return;const slow=total/count>(1000/targetFps)*1.35;total=0;count=0;if(slow&&profile!=='low'){profile=profile==='high'?'balanced':'low';onProfile(profile);}}};
}

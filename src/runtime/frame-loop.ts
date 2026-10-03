export type FrameClock={now():number;request(callback:(time:number)=>void):number;cancel(id:number):void};
export function createFrameLoop(clock:FrameClock,onFrame:(elapsed:number,delta:number)=>void){
 let paused=true,visible=true,disposed=false,pending:number|null=null,last:number|null=null,elapsed=0;
 const active=()=>!disposed&&!paused&&visible;
 const schedule=()=>{if(active()&&pending===null)pending=clock.request(frame);};
 function frame(time:number){pending=null;if(!active())return;const delta=last===null?0:Math.min(.05,Math.max(0,(time-last)/1000));last=time;elapsed+=delta;onFrame(elapsed,delta);schedule();}
 return {setActivity(next:{paused:boolean;visible:boolean}){if(disposed)return;paused=next.paused;visible=next.visible;if(!active()){if(pending!==null)clock.cancel(pending);pending=null;last=null;}else schedule();},
 dispose(){if(disposed)return;disposed=true;if(pending!==null)clock.cancel(pending);pending=null;last=null;}};
}

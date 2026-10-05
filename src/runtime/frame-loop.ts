export type FrameClock={now():number;request(callback:(time:number)=>void):number;cancel(id:number):void};
export function createFrameLoop(clock:FrameClock,onFrame:(elapsed:number,simulationDelta:number,inputDelta:number)=>void){
 let paused=true,visible=true,inputActive=false,disposed=false,pending:number|null=null,last:number|null=null,elapsed=0;
 const active=()=>!disposed&&visible&&(!paused||inputActive);
 const schedule=()=>{if(active()&&pending===null)pending=clock.request(frame);};
 function frame(time:number){pending=null;if(!active())return;const inputDelta=last===null?0:Math.min(.1,Math.max(0,(time-last)/1000));last=time;const simulationDelta=paused?0:inputDelta;elapsed+=simulationDelta;onFrame(elapsed,simulationDelta,inputDelta);schedule();}
 return {setActivity(next:{paused:boolean;visible:boolean;inputActive?:boolean}){if(disposed)return;paused=next.paused;visible=next.visible;inputActive=next.inputActive??false;if(!active()){if(pending!==null)clock.cancel(pending);pending=null;last=null;}else schedule();},dispose(){if(disposed)return;disposed=true;if(pending!==null)clock.cancel(pending);pending=null;last=null;}};
}

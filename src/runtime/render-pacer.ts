export function createRenderPacer(targetFps:30|60){
 const period=1000/targetFps;let previous:number|null=null,carry=0;
 return {shouldRender(now:number){if(previous===null){previous=now;return true;}carry+=Math.max(0,now-previous);previous=now;if(carry+1e-6<period)return false;carry=Math.max(0,carry-Math.floor((carry+1e-6)/period)*period);return true;},reset(){previous=null;carry=0;}};
}

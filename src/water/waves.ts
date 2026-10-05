import type {Vec3} from '../scene/cove-data';
export function waterHeightAt(x:number,z:number,time:number,swell:number,tide:number,bed:number){
 const u=Math.max(0,Math.min(1,(tide-bed)/1.1)),fade=u*u*(3-2*u),a=(.028+swell*.11)*fade;let h=0;
 for(const [dx,dz,frequency,speed,amplitude] of [[.22,-1,.85,1.1,1],[-.61,-1,1.75,1.62,.47],[.81,-.5,3.5,1.92,.23]]){
  const n=Math.hypot(dx,dz),q=(dx*x+dz*z)/n*frequency+Math.sin(x*.17+z*.11)*.8+Math.sin(z*.23-x*.09)*.7-time*speed;h+=Math.sin(q)*a*amplitude;
 }
 return tide+h;
}
export function updateSubmerged(previous:boolean,p:Vec3,level:number,bed:number){
 if(p.x<-16||p.x>16||p.z<-12||p.z>12||p.y<=bed+.015||bed>=level)return false;
 return previous?p.y<level+.04:p.y<level-.04;
}

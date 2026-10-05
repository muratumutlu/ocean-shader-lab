import {Vector3} from 'three';
import type {InputSnapshot} from '../input/mode-controller';
export function nearPlaneRadius(near:number,fovDegrees:number,aspect:number){return Math.max(.15,.08+near*Math.sqrt(1+Math.tan(fovDegrees*Math.PI/360)**2*(1+aspect**2)));}
export function cameraTranslation(input:InputSnapshot,forward:Vector3,distance:number,dt:number){
 const f=new Vector3(forward.x,0,forward.z);if(f.lengthSq()<1e-8)f.set(0,0,-1);f.normalize();const right=new Vector3(-f.z,0,f.x),move=f.multiplyScalar(input.forward).addScaledVector(right,input.right);move.y=input.vertical;
 const speed=Math.max(.25,Math.min(2,distance*.4))*(input.fast?2:1);if(move.lengthSq()>0)move.normalize().multiplyScalar(speed*dt);return move;
}

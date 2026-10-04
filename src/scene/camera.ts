import * as THREE from 'three';
export const CAMERA_TARGET=new THREE.Vector3(0,2.22,1.48);
export const CAMERA_ORBIT_LIMITS={minAzimuthAngle:-.9,maxAzimuthAngle:.9,minPolarAngle:55*Math.PI/180,maxPolarAngle:80*Math.PI/180,minDistance:30,maxDistance:70};
const fit=(aspect:number)=>Math.max(1,1.60214/aspect);
export const cameraOrbitLimits=(aspect:number)=>({...CAMERA_ORBIT_LIMITS,minDistance:30*fit(aspect),maxDistance:70*fit(aspect)});
export function createCamera(aspect:number){
 const camera=new THREE.PerspectiveCamera(34.73,aspect,.1,350);
 const reset=()=>{const scale=fit(camera.aspect);camera.position.set(20.85*scale,2.22+9.78*scale,1.48+31.16*scale);camera.lookAt(CAMERA_TARGET);camera.updateProjectionMatrix();};reset();
 return {camera,reset,resize(next:number){camera.aspect=next;reset();},dispose(){}};
}

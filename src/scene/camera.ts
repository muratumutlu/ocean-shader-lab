import * as THREE from 'three';
export const CAMERA_TARGET=new THREE.Vector3(0,.5,0);
export const CAMERA_ORBIT_LIMITS={minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,minPolarAngle:.05,maxPolarAngle:Math.PI-.05,minDistance:.45,maxDistance:80};
export const cameraOrbitLimits=(_aspect:number)=>({...CAMERA_ORBIT_LIMITS});
export function createCamera(aspect:number){
 const camera=new THREE.PerspectiveCamera(34.73,aspect,.03,160);
 const reset=()=>{camera.position.set(22,24,20);camera.lookAt(CAMERA_TARGET);camera.updateProjectionMatrix();};reset();
 return {camera,reset,resize(next:number){camera.aspect=next;camera.updateProjectionMatrix();},dispose(){}};
}

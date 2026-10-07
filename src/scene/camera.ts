import * as THREE from 'three';
export const CAMERA_TARGET=new THREE.Vector3(0,.5,0);
const CAMERA_HOME=new THREE.Vector3(22,24,20);
/** Lets a page mode (e.g. the fishing game) choose its default framing before the scene starts. */
export function setCameraHome(position:THREE.Vector3Like,target:THREE.Vector3Like){CAMERA_HOME.copy(position);CAMERA_TARGET.copy(target);}
export const CAMERA_ORBIT_LIMITS={minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,minPolarAngle:.05,maxPolarAngle:Math.PI-.05,minDistance:.45,maxDistance:180};
export const cameraOrbitLimits=(_aspect:number)=>({...CAMERA_ORBIT_LIMITS});
export function createCamera(aspect:number){
 const camera=new THREE.PerspectiveCamera(34.73,aspect,.03,320);
 const reset=()=>{camera.position.copy(CAMERA_HOME);camera.lookAt(CAMERA_TARGET);camera.updateProjectionMatrix();};reset();
 return {camera,reset,resize(next:number){camera.aspect=next;camera.updateProjectionMatrix();},dispose(){}};
}

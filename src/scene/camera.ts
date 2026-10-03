import * as THREE from 'three';
export const CAMERA_TARGET=new THREE.Vector3(0,.35,-3.5);
export const CAMERA_ORBIT_LIMITS={minAzimuthAngle:-.9,maxAzimuthAngle:.9,minPolarAngle:45*Math.PI/180,maxPolarAngle:83*Math.PI/180,minDistance:8,maxDistance:23};
export function createCamera(aspect:number){
 const camera=new THREE.PerspectiveCamera(49,aspect,.1,250);
 const reset=()=>{camera.position.set(camera.aspect<.9?3.0:4.0,camera.aspect<.9?3.3:3.5,camera.aspect<.9?11.0:11.5);camera.lookAt(CAMERA_TARGET);camera.updateProjectionMatrix();};reset();
 return {camera,reset,resize(next:number){camera.aspect=next;reset();},dispose(){}};
}

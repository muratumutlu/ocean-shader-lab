import {it,expect} from 'vitest';
import * as THREE from 'three';
import * as cameraAPI from '../../src/scene/camera';
import {createTerrain} from '../../src/scene/terrain';
it('reachable orbit envelope stays above the actual dunes and highest tide',()=>{
 const limits=(cameraAPI as any).CAMERA_ORBIT_LIMITS??{minAzimuthAngle:-Math.PI,maxAzimuthAngle:Math.PI,minPolarAngle:Math.PI/4,maxPolarAngle:83*Math.PI/180,minDistance:8,maxDistance:23};
 const terrain=createTerrain(7);
 try{for(const azimuth of [limits.minAzimuthAngle,0,limits.maxAzimuthAngle])for(const polar of [limits.minPolarAngle,limits.maxPolarAngle])for(const radius of [limits.minDistance,limits.maxDistance]){
  const eye=new THREE.Vector3().setFromSphericalCoords(radius,polar,azimuth).add(cameraAPI.CAMERA_TARGET);
  expect(eye.y,`eye at ${eye.toArray()}`).toBeGreaterThan(Math.max(.35,terrain.sampleHeight(eye.x,eye.z))+.2);
 }}finally{terrain.dispose();}
});

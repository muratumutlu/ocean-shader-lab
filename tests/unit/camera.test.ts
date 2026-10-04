import {it,expect} from 'vitest';
import {createCamera,CAMERA_ORBIT_LIMITS} from '../../src/scene/camera';
it('allows full orbit and deep zoom; resizing preserves the selected pose',()=>{
 const c=createCamera(1.6);c.camera.position.set(1,2,3);const rotation=c.camera.quaternion.clone();c.resize(.46);
 expect(c.camera.position.toArray()).toEqual([1,2,3]);expect(c.camera.quaternion.equals(rotation)).toBe(true);
 expect(c.camera.near).toBe(.03);expect(c.camera.far).toBe(160);expect(CAMERA_ORBIT_LIMITS.minDistance).toBe(.45);expect(CAMERA_ORBIT_LIMITS.maxDistance).toBe(80);expect(CAMERA_ORBIT_LIMITS.maxAzimuthAngle).toBe(Infinity);
});

import {it,expect} from 'vitest';
import {createCamera,CAMERA_ORBIT_LIMITS} from '../../src/scene/camera';
it('allows full orbit and deep zoom; resizing preserves the selected pose',()=>{
 const c=createCamera(1.6);c.camera.position.set(1,2,3);const rotation=c.camera.quaternion.clone();c.resize(.46);
 expect(c.camera.position.toArray()).toEqual([1,2,3]);expect(c.camera.quaternion.equals(rotation)).toBe(true);
 expect(c.camera.near).toBe(.03);expect(c.camera.far).toBe(320);expect(CAMERA_ORBIT_LIMITS.minDistance).toBe(.45);expect(CAMERA_ORBIT_LIMITS.maxDistance).toBe(180);expect(CAMERA_ORBIT_LIMITS.maxAzimuthAngle).toBe(Infinity);
});

it('reset keeps the established framing inside the extended orbit range',()=>{const c=createCamera(1.6);c.camera.position.set(140,100,90);c.reset();expect(c.camera.position.toArray()).toEqual([22,24,20]);expect(c.camera.position.length()).toBeLessThan(CAMERA_ORBIT_LIMITS.maxDistance);expect(c.camera.far).toBeGreaterThan(CAMERA_ORBIT_LIMITS.maxDistance+40);});

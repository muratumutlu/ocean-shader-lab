import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCamera,CAMERA_TARGET,cameraOrbitLimits} from '../scene/camera';
import {cameraTranslation,nearPlaneRadius} from './free-camera';
import {resolveCameraMove} from './collision';
import type {PhysicsWorld} from '../physics/world';
import type {CoveResources} from '../scene/cove';
import type {InputSnapshot} from '../input/mode-controller';
import type {ControlMode} from '../types';
import type {Vec3} from '../scene/cove-data';
export function createCameraRig(canvas:HTMLCanvasElement,cove:CoveResources,world:PhysicsWorld){
 const resources=createCamera(canvas.clientWidth/canvas.clientHeight),camera=resources.camera,proposal=camera.clone();
 const orbit=new OrbitControls(proposal,canvas);orbit.target.copy(CAMERA_TARGET);Object.assign(orbit,cameraOrbitLimits(camera.aspect));orbit.enablePan=true;orbit.enableDamping=false;orbit.zoomSpeed=.85;orbit.update();
 let dirty=false,disposed=false,committing=false,mode:ControlMode='camera';const abort=new AbortController();
 const changed=()=>{if(disposed||committing)return;dirty=true;canvas.dispatchEvent(new Event('cameraactivity'));};orbit.addEventListener('change',changed);
 canvas.addEventListener('dblclick',e=>{const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObject(cove.group,true)[0];if(hit)api.focus(hit.point);},{signal:abort.signal});
 const api={camera,hasPending:()=>dirty,setEnabled(value:boolean){orbit.enabled=value;},
  update(input:InputSnapshot,_target:Vec3|null,inputDelta:number){if(disposed)return false;let changedPose=dirty;const previous=camera.position.clone();
   if(mode==='camera'&&input.active){const forward=new THREE.Vector3();camera.getWorldDirection(forward);const delta=cameraTranslation(input,forward,proposal.position.distanceTo(orbit.target),inputDelta);proposal.position.add(delta);orbit.target.add(delta);changedPose=true;}
   if(!changedPose)return false;
   const next=resolveCameraMove(world,previous,proposal.position,nearPlaneRadius(camera.near,camera.fov,camera.aspect),false);camera.position.set(next.x,next.y,next.z);camera.quaternion.copy(proposal.quaternion);camera.updateMatrixWorld();proposal.position.copy(camera.position);
   committing=true;orbit.update();committing=false;camera.quaternion.copy(proposal.quaternion);camera.updateMatrixWorld();dirty=false;return true;
  },
  setMode(next:ControlMode){mode=next;orbit.enablePan=next==='camera';},
  focus(point:Vec3){orbit.target.set(point.x,point.y,point.z);orbit.update();changed();},
  reset(){resources.reset();proposal.position.copy(camera.position);proposal.quaternion.copy(camera.quaternion);orbit.target.copy(CAMERA_TARGET);committing=true;orbit.update();committing=false;dirty=true;changed();},
  resize(aspect:number){resources.resize(aspect);proposal.aspect=aspect;proposal.updateProjectionMatrix();},
  dispose(){if(disposed)return;disposed=true;abort.abort();orbit.removeEventListener('change',changed);orbit.dispose();resources.dispose();}
 };
 return api;
}

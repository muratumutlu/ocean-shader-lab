import * as THREE from 'three';
import {createFollowCamera,FOLLOW_LIMITS} from './follow-camera';
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
 const followProposal=camera.clone(),followOrbit=new OrbitControls(followProposal,canvas),follow=createFollowCamera(camera,world);Object.assign(followOrbit,{minDistance:FOLLOW_LIMITS.minDistance,maxDistance:FOLLOW_LIMITS.maxDistance,minPolarAngle:.08,maxPolarAngle:Math.PI-.08,enablePan:false,enableDamping:false,zoomSpeed:.85});followOrbit.enabled=false;
 let dirty=false,disposed=false,committing=false,mode:ControlMode='camera',enabled=true,followInitialized=false;const abort=new AbortController();
 const changed=()=>{if(disposed||committing)return;dirty=true;canvas.dispatchEvent(new Event('cameraactivity'));};orbit.addEventListener('change',changed);followOrbit.addEventListener('change',changed);
 canvas.addEventListener('dblclick',e=>{if(mode!=='camera')return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObject(cove.group,true)[0];if(hit)api.focus(hit.point);},{signal:abort.signal});
 const api={camera,hasPending:()=>dirty,setEnabled(value:boolean){enabled=value;orbit.enabled=value&&mode==='camera';followOrbit.enabled=value&&mode==='turtle';},
  update(input:InputSnapshot,_target:Vec3|null,inputDelta:number){if(disposed)return false;
   if(mode==='turtle'&&_target){
    const nextTarget=new THREE.Vector3(_target.x,_target.y+.22,_target.z),delta=nextTarget.clone().sub(followOrbit.target);committing=true;
    if(!followInitialized){followProposal.position.copy(nextTarget).add(new THREE.Vector3(0,Math.cos(1.15)*4.5,Math.sin(1.15)*4.5));followInitialized=true;}else followProposal.position.add(delta);
    followOrbit.target.copy(nextTarget);followOrbit.update();committing=false;follow.setOrbit(followOrbit.getAzimuthalAngle(),followOrbit.getPolarAngle());follow.setDistance(followProposal.position.distanceTo(followOrbit.target));
    const result=follow.update(nextTarget,inputDelta);dirty=false;return result;
   }let changedPose=dirty;const previous=camera.position.clone();
   if(mode==='camera'&&input.active){const forward=new THREE.Vector3();camera.getWorldDirection(forward);const delta=cameraTranslation(input,forward,proposal.position.distanceTo(orbit.target),inputDelta);proposal.position.add(delta);orbit.target.add(delta);changedPose=true;}
   if(!changedPose)return false;
   const next=resolveCameraMove(world,previous,proposal.position,nearPlaneRadius(camera.near,camera.fov,camera.aspect),false,(!input.active||Math.abs(previous.x)>24||Math.abs(previous.z)>20||previous.y>45)?'orbit':'free');camera.position.set(next.x,next.y,next.z);camera.quaternion.copy(proposal.quaternion);camera.updateMatrixWorld();proposal.position.copy(camera.position);
   committing=true;orbit.update();committing=false;camera.quaternion.copy(proposal.quaternion);camera.updateMatrixWorld();dirty=false;return true;
  },
  setMode(next:ControlMode){if(next===mode)return;mode=next;orbit.enabled=enabled&&next==='camera';followOrbit.enabled=enabled&&next==='turtle';if(next==='camera'){camera.position.copy(proposal.position);camera.quaternion.copy(proposal.quaternion);}else followInitialized=false;dirty=true;changed();},
  focus(point:Vec3){orbit.target.set(point.x,point.y,point.z);orbit.update();changed();},
  reset(){if(mode==='turtle'){follow.reset();followInitialized=false;dirty=true;changed();return;}resources.reset();proposal.position.copy(camera.position);proposal.quaternion.copy(camera.quaternion);orbit.target.copy(CAMERA_TARGET);committing=true;orbit.update();committing=false;dirty=true;changed();},
  resize(aspect:number){resources.resize(aspect);proposal.aspect=aspect;proposal.updateProjectionMatrix();followProposal.aspect=aspect;followProposal.updateProjectionMatrix();},
  dispose(){if(disposed)return;disposed=true;abort.abort();orbit.removeEventListener('change',changed);followOrbit.removeEventListener('change',changed);orbit.dispose();followOrbit.dispose();follow.dispose();resources.dispose();}
 };
 return api;
}

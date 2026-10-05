import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createTurtleActivities,DEFAULT_TURTLE_ACTIVITY_TIMINGS,type TurtleActivityPlan,type TurtleActivityHabitat} from '../turtle/activities';
import {turtleRotation,type createTurtleController} from '../turtle/controller';
import type {TurtleAssetInfo} from '../turtle/asset';
import type {TurtleView} from '../turtle/view';
import type {CoveResources} from '../scene/cove';
import type {Vec3} from '../scene/cove-data';
import {fbm,noise2} from '../scene/textures';
import type {InputSnapshot} from '../input/mode-controller';

/** Three contact probes measured in the named bones' local rest frame. They must
 * be supplied for the verified model; this adapter does not guess replacement anatomy.
 */
export type TurtleRoutineRestProfile={assetFileSha256:string;mouth:Vec3;hindLeft:Vec3;hindRight:Vec3;nestRearOffset:number};
/** Production aac6c43: measured from >65%-weighted high-body vertices transformed
 * through the corresponding inverse bind matrix. A replacement needs its own profile.
 */
export const PRODUCTION_TURTLE_ROUTINE_PROFILE:TurtleRoutineRestProfile=Object.freeze({
 assetFileSha256:'aac6c43d7238a3035f57efdd57b71385249c861ede3e9f7dfb18983d384cade4',
 // Authored clearance envelope for this GLB, not an anatomical cloaca claim.
 // Exact animated skin regression: six 23 mm eggs clear the posterior skin.
 nestRearOffset:.72,
 mouth:Object.freeze({x:0,y:-.026999999769032,z:.34390002489089966}),
 hindLeft:Object.freeze({x:-.23000001907348633,y:-.055820003151893616,z:-.1600000262260437}),
 hindRight:Object.freeze({x:.23000001907348633,y:-.055820003151893616,z:-.1600000262260437}),
});
export type TurtleRoutineOptions={
 cove:Pick<CoveResources,'data'|'sampleHeight'|'sampleNormal'>;
 controller:Pick<ReturnType<typeof createTurtleController>,'state'>;
 view:Pick<TurtleView,'group'|'apply'>;asset:TurtleAssetInfo;
 restProfile:TurtleRoutineRestProfile;namespace?:string;
};
export type TurtleRoutineStart={ready:true}|{ready:false;reason:'disposed'|'paused'|'missing-rig'|'invalid-profile'|'nest-present'|'no-safe-route'};
const UP=new THREE.Vector3(0,1,0),MAX_EGGS=6,MAX_POSE_ANGLE=10*Math.PI/180,NECK_POSE_ANGLE=4*Math.PI/180,HIND_POSE_ANGLE=.035;
const FOOD_TOP=.054,CONTACT_GAP=.035,CONTACT_TIMEOUT=14;
const finite=(p:Vec3)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const horizontal=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=(p:Vec3)=>new THREE.Vector3(p.x,p.y,p.z);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const silent=(input:InputSnapshot):InputSnapshot=>({...input,forward:0,right:0,vertical:0,fast:false,active:false,pointerActive:false});

/** Original low cockle-like bivalves. The inset seam joins two rounded valves;
 * growth increments and broad radial flutes are geometry, not painted stripes.
 * The contact envelope remains exactly 0–54 mm above the sampled bed.
 */
function createRoutineFoodGeometry(){
 const valves:THREE.BufferGeometry[]=[];
 for(const [shell,[cx,cz]] of [[-.065,-.045],[.068,.035],[0,.135]].entries()){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],angular=96,radial=24;
  const base=new THREE.Color([0x958674,0x817867,0xaa9880][shell]);
  const vertex=(r:number,side:number,seam=false)=>{
   for(let j=0;j<angular;j++){
    const a=j/angular*Math.PI*2,phase=14*a+1.2*Math.sin(a+.4*shell),flute=.5+.5*Math.cos(phase);
    const hinge=Math.exp(-Math.pow(Math.atan2(Math.sin(a+Math.PI/2),Math.cos(a+Math.PI/2))/.42,2));
    const outline=1.025+.018*Math.sin(3*a+shell)+.012*Math.cos(5*a-.6)-.025*hinge;
    const lobe=1+.018*Math.cos(phase)*Math.pow(r,3),inset=seam?.978:1;
    const x=cx+Math.cos(a)*.076*r*outline*lobe*inset;
    const z=cz+Math.sin(a)*.084*r*outline*lobe*inset;
    // Uneven growth increments converge towards the umbo. Both kinds of relief
    // taper at the pole and valve edge so the paired contour stays continuous.
    const envelope=Math.sin(Math.PI*r),growth=Math.sin(r*16*Math.PI+.75*Math.sin(a)+.25*Math.sin(3*a));
    const relief=(.00125*(flute-.35)+.00048*growth)*envelope;
    const rim=.027+.0011*Math.sin(2*a+.7*shell)*(r*r)+.0005*Math.sin(5*a)*r*r;
    const dome=.027*Math.pow(Math.max(0,1-r*r),side>0?.18:.68);
    const y=seam?rim:clamp(rim+side*(dome+.0009*r*r+relief),0,FOOD_TOP);
    positions.push(x,y,z);
    const tint=seam?.39:(.88+.13*flute+.07*growth+.035*Math.sin(a*3+shell));
    const c=base.clone().multiplyScalar(tint);if(!seam&&r>.94)c.lerp(new THREE.Color(0xd4c5ac),.23);
    colors.push(c.r,c.g,c.b);
   }
  };
  // One indexed vertex per pole and a small first ring keep the umbo rounded
  // while preserving a closed surface without duplicated seam vertices.
  positions.push(cx,FOOD_TOP,cz);colors.push(base.r,base.g,base.b);
  for(let k=1;k<=radial;k++)vertex(k/radial,1);
  vertex(1,0,true);
  for(let k=radial;k>=1;k--)vertex(k/radial,-1);
  const bottom=positions.length/3;positions.push(cx,0,cz);colors.push(base.r*.8,base.g*.8,base.b*.8);
  for(let j=0;j<angular;j++){const n=(j+1)%angular;indices.push(0,1+n,1+j);}
  const rings=radial*2+1;
  for(let k=0;k<rings-1;k++)for(let j=0;j<angular;j++){
   const n=(j+1)%angular,a=1+k*angular+j,b=1+k*angular+n,c=a+angular,d=b+angular;
   indices.push(a,b,c,b,d,c);
  }
  const last=1+(rings-1)*angular;
  for(let j=0;j<angular;j++)indices.push(last+j,last+(j+1)%angular,bottom);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();valves.push(geometry);
 }
 const geometry=mergeGeometries(valves);valves.forEach(g=>g.dispose());return geometry;
}

/** A radial patch with an irregular, terrain-seated edge. Independent radial
 * samples keep both the shallow crown and feathered skirt smooth in close view.
 */
function createRoutineSandGeometry(){
 const positions=[0,0,0],colors=[1,1,1],indices:number[]=[],angular=128,radial=32;
 for(let k=1;k<=radial;k++)for(let j=0;j<angular;j++){
  const a=j/angular*Math.PI*2,r=.305*k/radial*(1+.065*Math.sin(a*3+.4)+.038*Math.sin(a*7-1.2));
  positions.push(Math.cos(a)*r,0,Math.sin(a)*r*1.04);colors.push(1,1,1);
 }
 for(let j=0;j<angular;j++)indices.push(0,1+(j+1)%angular,1+j);
 for(let k=0;k<radial-1;k++)for(let j=0;j<angular;j++){
  const n=(j+1)%angular,a=1+k*angular+j,b=1+k*angular+n,c=a+angular,d=b+angular;indices.push(a,b,c,b,d,c);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);return geometry;
}
function updateRoutineSandGeometry(geometry:THREE.BufferGeometry,sampleHeight:(x:number,z:number)=>number,center:Vec3,coverage:number){
 const p=geometry.attributes.position,color=geometry.attributes.color,sand=new THREE.Color(0xfff4db),wet=new THREE.Color(0xb6a788);
 const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z/1.04,x),edge=.305*(1+.065*Math.sin(a*3+.4)+.038*Math.sin(a*7-1.2));
  const r=Math.hypot(x,z/1.04),t=clamp(r/edge,0,1),skirt=1-smooth(.25,1,t),core=1-smooth(.065,.285,r);
  // Protect the entire 81 mm egg footprint. Disturbance stays outside it:
  // shallow curved hind-flipper sweeps and their soft displaced-sand shoulders.
  const sweep=Math.exp(-Math.pow((r-.18-.012*Math.sin(2*a))/.055,2))*Math.sin(43*r+2.4*Math.sin(a)+.7);
  const relief=(.0018*sweep+.00045*(noise2(x*95,z*95,83)-.5))*smooth(.095,.14,r)*skirt;
  const height=Math.max(0,.062*Math.pow(core,1.35)+relief)*coverage*(1-smooth(.78,1,t));
  const worldX=center.x+x,worldZ=center.z+z,bed=sampleHeight(worldX,worldZ);
  // At the final ring the patch meets the bed; the tiny interior separation
  // prevents flicker while preserving a visually feathered boundary.
  p.setY(i,bed-center.y+height+.0003*skirt);
  const c=sand.clone().lerp(wet,clamp(-bed*.19,0,.4)).multiplyScalar(.89+.16*fbm(worldX*.17,worldZ*.17,31));
  // Match the cove sand map's mean linear red and dry-sand desaturation. Fine
  // grain is supplied analytically below, without allocating another texture.
  const mapRed=.626,dry=smooth(.035,.30,bed),red=c.r*mapRed;
  c.multiply(new THREE.Color().setRGB(mapRed,.539,.366));c.lerp(new THREE.Color().setRGB(red*.98,red,red*.985),dry);
  c.multiplyScalar(.81+.19*smooth(-.02,.25,bed));color.setXYZ(i,c.r,c.g,c.b);
 }
 p.needsUpdate=true;color.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
}
function createRoutineSandMaterial(){
 // Depth bias only resolves the feathered skirt against the separate ground
 // triangulation; it does not lift the mound or change its coverage geometry.
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoutineSandWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvRoutineSandWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vRoutineSandWorld;
   float routineSandHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float routineSandNoise(vec2 p){vec2 q=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(routineSandHash(q),routineSandHash(q+vec2(1,0)),f.x),mix(routineSandHash(q+vec2(0,1)),routineSandHash(q+vec2(1,1)),f.x),f.y);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float routineGrain=routineSandNoise(vRoutineSandWorld.xz*210.0);
   float routineFine=routineSandNoise(vRoutineSandWorld.xz*55.0);
   diffuseColor.rgb*=.956+.072*routineGrain+.016*routineFine;
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Fade unresolved grain before differentiation; color grain remains intact.
   vec2 routineFootprint=vec2(length(dFdx(vRoutineSandWorld.xz)),length(dFdy(vRoutineSandWorld.xz)));
   float routinePixelWidth=max(routineFootprint.x,routineFootprint.y);
   float routineGrainFade=1.0-smoothstep(.30,.85,routinePixelWidth*210.0);
   float routineFineFade=1.0-smoothstep(.30,.85,routinePixelWidth*55.0);
   float routineHeightDx=.0003*dFdx(routineGrain)*routineGrainFade+.00045*dFdx(routineFine)*routineFineFade;
   float routineHeightDy=.0003*dFdy(routineGrain)*routineGrainFade+.00045*dFdy(routineFine)*routineFineFade;
   vec3 routineDx=dFdx(-vViewPosition),routineDy=dFdy(-vViewPosition);
   vec3 routineR1=cross(routineDy,normal),routineR2=cross(normal,routineDx);
   float routineDet=dot(routineDx,routineR1);
   float routineDetFloor=max(length(routineDx)*length(routineDy)*.05,1e-12);
   vec3 routineGradient=sign(routineDet)*(routineHeightDx*routineR1+routineHeightDy*routineR2)/max(abs(routineDet),routineDetFloor);
   // At the silhouette a smooth normal can approach the derivative tangent
   // plane. Bound the perturbation to 6.85 degrees and fade it at grazing view.
   routineGradient*=min(1.0,.12/max(length(routineGradient),1e-8));
   float routineGrazing=smoothstep(.12,.40,clamp(dot(normal,normalize(vViewPosition)),0.0,1.0));
   normal=normalize(normal-routineGradient*routineGrazing);
  `);
 };
 material.customProgramCacheKey=()=> 'routine-sand-grain-v2';return material;
}

/** Finite opt-in feed -> nest -> return adapter. The caller owns controller.step;
 * this module never assigns controller position, heading, velocity or physics state.
 */
export function createTurtleRoutine({cove,controller,view,asset,restProfile,namespace='cove-routine'}:TurtleRoutineOptions){
 const activity=createTurtleActivities({namespace,timings:{approachTimeout:120,leaveTimeout:120}});
 const group=new THREE.Group();group.name='turtle-routine-details';
 const eggGeometry=new THREE.SphereGeometry(1,16,12),eggMaterial=new THREE.MeshStandardMaterial({color:0xe5ddc4,roughness:.74});
 const eggs=new THREE.InstancedMesh(eggGeometry,eggMaterial,MAX_EGGS);eggs.name='turtle-nest-eggs';eggs.count=0;eggs.castShadow=true;eggs.receiveShadow=true;eggs.frustumCulled=false;group.add(eggs);
 const sandGeometry=createRoutineSandGeometry(),sandMaterial=createRoutineSandMaterial(),sand=new THREE.Mesh(sandGeometry,sandMaterial);sand.name='turtle-covered-nest';sand.visible=false;sand.castShadow=true;sand.receiveShadow=true;group.add(sand);
 const foodGeometry=createRoutineFoodGeometry(),foodRest=Array.from(foodGeometry.attributes.position.array);
 const foodMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87}),food=new THREE.Mesh(foodGeometry,foodMaterial);food.name='turtle-feeding-bivalves';food.visible=false;food.castShadow=true;food.receiveShadow=true;group.add(food);
 const foodRay=new THREE.Raycaster();foodRay.near=0;foodRay.far=.65;
 const names=['Neck','Head','HindL','HindR','HindLTip','HindRTip'] as const;
 const bones=Object.fromEntries(names.map(name=>[name,view.group.getObjectByName(name)])) as Record<typeof names[number],THREE.Object3D|undefined>;
 const profileValid=!!restProfile&&Number.isFinite(restProfile.nestRearOffset)&&restProfile.nestRearOffset>=.65&&restProfile.nestRearOffset<=1&&restProfile.assetFileSha256===(asset as TurtleAssetInfo&{fileSha256?:string}).fileSha256&&[restProfile.mouth,restProfile.hindLeft,restProfile.hindRight].every(p=>finite(p)&&Math.hypot(p.x,p.y,p.z)<=2);
 const probes=profileValid?[{bone:bones.Head,local:point(restProfile.mouth)},{bone:bones.HindLTip,local:point(restProfile.hindLeft)},{bone:bones.HindRTip,local:point(restProfile.hindRight)}]:[];
 const profileReady=names.every(name=>!!bones[name]);
 const overlays=new Map<THREE.Object3D,{base:THREE.Quaternion;applied:THREE.Quaternion}>();
 let enabled=false,paused=false,disposed=false,run=0,peakControllerStepDistance=0,stage:'off'|'feeding'|'nesting'|'finished'|'cancelled'='off';
 let feedPlan:TurtleActivityPlan|null=null,nestPlan:TurtleActivityPlan|null=null,route:Vec3[]=[],routeIndex=0,lastPhase='',stallTime=0,lastPosition={...controller.state.position},lastTide=0;
 let approachFeed:Vec3[]=[],approachNest:Vec3[]=[],leaveFeed:Vec3[]=[],leaveNest:Vec3[]=[],nestCenter:Vec3|null=null,coverage=0;
 let nestAnchorPosition:Vec3|null=null,nestAnchorHeading:number|null=null,nestAnchorPhase:'dig'|null=null,nestFootprintMinimumHeight:number|null=null,nestFailure:'unsafe-site'|'unsafe-exit'|null=null;
 let feedPoseTime=0,foodContact=false,foodGap:number|null=null,closestFoodGap:number|null=null,feedingContactSeconds=0,feedingFailure:'food-unreachable'|null=null;
 const laid=new Map<string,number>(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
 const resetContact=()=>{feedPoseTime=0;foodContact=false;foodGap=null;closestFoodGap=null;feedingContactSeconds=0;feedingFailure=null;};
 function measureFoodContact(){
  foodContact=false;foodGap=null;if(!food.visible||!profileReady||!profileValid)return;
  view.group.updateMatrixWorld(true);group.updateMatrixWorld(true);
  const mouth=bones.Head!.localToWorld(probes[0].local.clone());
  foodRay.set(mouth.clone().addScaledVector(UP,.15),UP.clone().negate());
  const hit=foodRay.intersectObject(food,false)[0];if(!hit)return;
  foodGap=mouth.y-hit.point.y;
  if(closestFoodGap===null||Math.abs(foodGap)<Math.abs(closestFoodGap))closestFoodGap=foodGap;
  foodContact=foodGap>=-.005&&foodGap<=CONTACT_GAP;
 }
 const active=()=>enabled&&!disposed;
 const restorePose=()=>{for(const [bone,pose] of overlays)if(bone.quaternion.equals(pose.applied))bone.quaternion.copy(pose.base);overlays.clear();view.group.updateMatrixWorld(true);};
 const habitat=():TurtleActivityHabitat=>{
  const s=controller.state;
  if(s.previousLocomotion==='swim'&&s.transition>.95&&s.position.y+asset.swimProxy.offset.y+asset.swimProxy.halfHeight<lastTide-.025)return 'underwater';
  if(s.previousLocomotion==='crawl'&&s.transition<.05&&cove.sampleHeight(s.position.x,s.position.z)>lastTide+.07)return 'dry-ground';
  return 'shore';
 };
 const safeFootprint=(p:Vec3)=>{
  const r=asset.proxy.radius+.12;if(Math.abs(p.x)+r>15.8||Math.abs(p.z)+r>11.8)return false;
  if(cove.data.rocks.some(rock=>Math.hypot(p.x-rock.x,p.z-rock.z)<rock.radius+r))return false;
  return cove.sampleNormal(p.x,p.z).y>=Math.cos(24*Math.PI/180);
 };
 const safeSegment=(a:Vec3,b:Vec3)=>{
  const steps=Math.max(1,Math.ceil(horizontal(a,b)/.2));
  for(let i=0;i<=steps;i++){const f=i/steps;if(!safeFootprint({x:a.x+(b.x-a.x)*f,y:0,z:a.z+(b.z-a.z)*f}))return false;}
  return true;
 };
 const dryFootprint=(p:Vec3,margin=0)=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,r=asset.proxy.radius+margin;return cove.sampleHeight(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r);}).every(y=>y>lastTide+.07);
 function groundRoot(p:Vec3,heading:number){
  const normal=cove.sampleNormal(p.x,p.z),q=turtleRotation({heading,groundNormal:normal,pitch:0,transition:0});
  const samples=asset.idleBodyGroundSamples??asset.bodyGroundSamples??asset.groundSamples;let y=-Infinity;const v=new THREE.Vector3();
  for(const phase of samples)for(const sample of phase){v.fromArray(sample).applyQuaternion(q);y=Math.max(y,cove.sampleHeight(p.x+v.x,p.z+v.z)-v.y+.019);}
  return {x:p.x,y,z:p.z};
 }
 function waterRoot(p:Vec3){return {x:p.x,y:Math.min(lastTide-asset.swimProxy.offset.y-asset.swimProxy.halfHeight-.09,cove.sampleHeight(p.x,p.z)+asset.swimProxy.halfHeight-asset.swimProxy.offset.y+.10),z:p.z};}
 function preparePlans(){
  const shore=cove.data.shoreRoute;if(shore.length<20||!profileReady||!profileValid)return false;
  const nestIndex=shore.findIndex((p,i)=>i>24&&p.y>lastTide+.28&&dryFootprint(p,.30)&&safeFootprint(p));if(nestIndex<0)return false;
  const feedIndex=Math.min(18,nestIndex-12),feeding=waterRoot(shore[feedIndex]);
  if(cove.sampleHeight(feeding.x,feeding.z)>lastTide-2*asset.swimProxy.halfHeight-.25)return false;
  let entry=0,best=Infinity;for(let i=0;i<=feedIndex;i++){const d=horizontal(controller.state.position,shore[i]);if(d<best){entry=i;best=d;}}
  // The initial connector is checked, never replaced by a teleport to the route.
  if(!safeSegment(controller.state.position,shore[entry]))return false;
  const targetLand=groundRoot(shore[nestIndex],Math.PI),heading=Math.atan2(shore[nestIndex].x-shore[nestIndex-6].x,shore[nestIndex].z-shore[nestIndex-6].z);
  targetLand.y=groundRoot(shore[nestIndex],heading).y;
  const feedHeading=Math.atan2(shore[feedIndex].x-shore[feedIndex-6].x,shore[feedIndex].z-shore[feedIndex-6].z);
  view.group.updateMatrixWorld(true);const mouth=bones.Head!.localToWorld(probes[0].local.clone()).sub(point(controller.state.position)).applyAxisAngle(UP,-controller.state.heading).applyAxisAngle(UP,feedHeading).add(point(feeding));
  const foodPosition={x:mouth.x,y:cove.sampleHeight(mouth.x,mouth.z)+FOOD_TOP,z:mouth.z};
  const feedExit=waterRoot(shore[Math.min(feedIndex+3,nestIndex-8)]),seaExit=waterRoot(shore[0]);
  nestCenter={x:targetLand.x-Math.sin(heading)*.52,y:0,z:targetLand.z-Math.cos(heading)*.52};nestCenter.y=cove.sampleHeight(nestCenter.x,nestCenter.z);
  feedPlan={id:`routine-${run}-feed`,kind:'feed',target:{position:feeding,heading:feedHeading},foodPosition,leavePosition:feedExit};
  nestPlan={id:`routine-${run}-nest`,kind:'nest',target:{position:targetLand,heading},nestCenter:{...nestCenter},eggCount:MAX_EGGS,leavePosition:seaExit};
  approachFeed=shore.slice(entry,feedIndex+1).map(waterRoot);approachFeed[approachFeed.length-1]=feeding;
  leaveFeed=[feedExit];approachNest=shore.slice(feedIndex+3,nestIndex+1).map(p=>({x:p.x,y:waterRoot(p).y,z:p.z}));approachNest[approachNest.length-1]=targetLand;
  // A short real walking detour takes the outgoing body around its new sand mound.
  const detour=[{x:targetLand.x+1.4,y:targetLand.y,z:targetLand.z},{x:targetLand.x+1.4,y:targetLand.y,z:targetLand.z+1.4}];
  leaveNest=[...detour,...shore.slice(0,nestIndex-6).reverse().map(waterRoot)];leaveNest[leaveNest.length-1]=seaExit;
  for(const path of [approachFeed,leaveFeed,approachNest,leaveNest])for(let i=0;i<path.length;i++)if(!safeFootprint(path[i])||i>0&&!safeSegment(path[i-1],path[i]))return false;
  const bed=cove.sampleHeight(foodPosition.x,foodPosition.z),positions=foodGeometry.attributes.position;
  // Align the small cluster with the approach and seat every valve on the bed.
  for(let i=0;i<positions.count;i++){
   const local=new THREE.Vector3(foodRest[i*3],foodRest[i*3+1],foodRest[i*3+2]).applyAxisAngle(UP,feedHeading);
   positions.setXYZ(i,local.x,local.y+cove.sampleHeight(foodPosition.x+local.x,foodPosition.z+local.z)-bed,local.z);
  }
  positions.needsUpdate=true;foodGeometry.computeVertexNormals();foodGeometry.computeBoundingSphere();foodGeometry.computeBoundingBox();
  food.position.set(foodPosition.x,bed,foodPosition.z);food.visible=true;
  return true;
 }
 const switchRoute=()=>{
  const phase=activity.state.phase;if(phase===lastPhase)return;
  lastPhase=phase;routeIndex=0;stallTime=0;
  route=(phase==='approach'?(stage==='feeding'?approachFeed:approachNest):phase==='leave'?(stage==='feeding'?leaveFeed:leaveNest):[]).map(p=>({...p}));
 };
 const stop=(reason?:'manual-control'|'site-unavailable')=>{if(reason)activity.cancel(reason);else activity.setEnabled(false);enabled=false;stage='cancelled';food.visible=false;foodContact=false;restorePose();};
 function commitNest(){
  // Commit only after rest has settled at the real controller arrival. The
  // route target is an intention and may be up to 25 cm from that actual pose.
  const s=controller.state,center={x:s.position.x-Math.sin(s.heading)*restProfile.nestRearOffset,y:0,z:s.position.z-Math.cos(s.heading)*restProfile.nestRearOffset};center.y=cove.sampleHeight(center.x,center.z);
  const positions=sandGeometry.attributes.position;let minimum=Infinity,radius=0,valid=true;
  for(let i=0;i<positions.count;i++){
   const dx=positions.getX(i),dz=positions.getZ(i),x=center.x+dx,z=center.z+dz;radius=Math.max(radius,Math.hypot(dx,dz));minimum=Math.min(minimum,cove.sampleHeight(x,z));
   if(Math.abs(x)>15.8||Math.abs(z)>11.8||cove.sampleNormal(x,z).y<Math.cos(24*Math.PI/180))valid=false;
  }
  // Every egg lies within this mesh footprint; a conservative enclosing radius
  // rejects any rock overlap, including between the sampled boundary vertices.
  valid=valid&&Number.isFinite(minimum)&&minimum>lastTide+.07&&!cove.data.rocks.some(rock=>Math.hypot(center.x-rock.x,center.z-rock.z)<rock.radius+radius+.025);
  if(!valid){nestFailure='unsafe-site';activity.cancel('site-unavailable');return false;}
  const proposed=[{x:s.position.x+1.4,y:s.position.y,z:s.position.z},{x:s.position.x+1.4,y:s.position.y,z:s.position.z+1.4},...leaveNest.slice(2)];
  if(!safeSegment(s.position,proposed[0])||proposed.some((p,i)=>!safeFootprint(p)||i>0&&!safeSegment(proposed[i-1],p))){nestFailure='unsafe-exit';activity.cancel('site-unavailable');return false;}
  nestCenter=center;nestAnchorPosition={...s.position};nestAnchorHeading=s.heading;nestAnchorPhase='dig';nestFootprintMinimumHeight=minimum;leaveNest=proposed;return true;
 }
 function syncNest(){
  if(!nestCenter||!nestAnchorPosition)return;
  for(const egg of activity.state.eggs){if(laid.has(egg.id)||laid.size>=MAX_EGGS)continue;const index=laid.size,a=index*Math.PI/3,x=nestCenter.x+Math.cos(a)*.058,z=nestCenter.z+Math.sin(a)*.058;
   matrix.compose(new THREE.Vector3(x,cove.sampleHeight(x,z)+.025,z),rotation.identity(),new THREE.Vector3(.023,.023,.023));eggs.setMatrixAt(index,matrix);laid.set(egg.id,index);eggs.count=laid.size;eggs.instanceMatrix.needsUpdate=true;
  }
  if(activity.state.coverage!==coverage){coverage=activity.state.coverage;updateRoutineSandGeometry(sandGeometry,cove.sampleHeight,nestCenter,coverage);
   sand.position.set(nestCenter.x,nestCenter.y,nestCenter.z);sand.visible=coverage>0;
  }
 }
 const api={group,
  setEnabled(value:boolean,tide:number):TurtleRoutineStart{
   if(disposed)return {ready:false,reason:'disposed'};
   if(!value){stop();return {ready:true};}
   if(enabled)return {ready:true};if(paused)return {ready:false,reason:'paused'};
   if(!profileReady)return {ready:false,reason:'missing-rig'};if(!profileValid)return {ready:false,reason:'invalid-profile'};
   if(laid.size)return {ready:false,reason:'nest-present'};
   nestAnchorPosition=null;nestAnchorHeading=null;nestAnchorPhase=null;nestFootprintMinimumHeight=null;nestFailure=null;
   lastTide=tide;run++;if(!Number.isFinite(tide)||!preparePlans())return {ready:false,reason:'no-safe-route'};
   resetContact();activity.reset();activity.setEnabled(true);activity.request(feedPlan!);enabled=true;stage='feeding';lastPhase='';lastPosition={...controller.state.position};switchRoute();return {ready:true};
  },
  setPaused(value:boolean){paused=value;},
  resolveInput(manual:InputSnapshot,cameraForward:Vec3,tide:number,isPaused=paused):{input:InputSnapshot;cameraForward:Vec3}{
   lastTide=tide;paused=isPaused;
   if(disposed||!enabled)return {input:manual,cameraForward};
   if(manual.active){stop('manual-control');return {input:manual,cameraForward};}
   if(paused)return {input:silent(manual),cameraForward};
   switchRoute();const intent=activity.intent();if(intent.kind!=='navigate'){
    const input=silent(manual);
    // A slow, collision-constrained depth correction may bring the beak closer.
    // No vertical movement is requested if the actual ray misses the food.
    if(intent.kind==='pose'&&intent.action==='feed'&&controller.state.previousLocomotion==='swim'&&foodGap!==null&&foodGap>.014){input.vertical=-Math.min(.10,(foodGap-.010)*1.5);input.active=true;}
    return {input,cameraForward};
   }
   const s=controller.state;
   while(routeIndex<route.length-1&&horizontal(s.position,route[routeIndex])<.28)routeIndex++;
   const final=routeIndex>=route.length-1,target=route[routeIndex]??intent.position,dx=target.x-s.position.x,dz=target.z-s.position.z,d=Math.hypot(dx,dz);
   const throttle=clamp((d-(final?.075:0))/.85,0,.72),vertical=s.previousLocomotion==='swim'?clamp((target.y-s.position.y)*2,-1,1):0;
   const direction=d>.001?{x:dx/d,y:0,z:dz/d}:cameraForward;
   return {input:{...silent(manual),mode:'turtle',forward:throttle,vertical:Math.abs(target.y-s.position.y)<.025?0:vertical,active:throttle>1e-5||Math.abs(vertical)>1e-5},cameraForward:direction};
  },
  afterStep(tide:number,dt:number,isPaused=paused){
   lastTide=tide;paused=isPaused;if(!active())return;
   const s=controller.state;
   if(!paused)peakControllerStepDistance=Math.max(peakControllerStepDistance,Math.hypot(s.position.x-lastPosition.x,s.position.y-lastPosition.y,s.position.z-lastPosition.z));
   const plan=activity.state.plan,siteValid=Number.isFinite(tide)&&!!plan&&safeFootprint(plan.target.position)&&(plan.kind!=='nest'||dryFootprint(plan.target.position))&&(nestFootprintMinimumHeight===null||nestFootprintMinimumHeight>tide+.07);
   const feeding=activity.state.phase==='feed',validDt=Number.isFinite(dt)&&dt>0?Math.min(.1,dt):0;
   if(feeding&&!paused){
    feedPoseTime+=validDt;
    // Contact is evaluated at this fixed step's actual animated pose. view.apply
    // samples absolute controller phases; zero dt never advances animation twice.
    view.apply(s,0);api.applyPose();
   }
   let activityDt=feeding&&!foodContact?0:dt;
   // Do not let a rest -> feed transition spend leftover time before first contact.
   if(plan?.kind==='feed'&&activity.state.phase==='rest')activityDt=Math.min(validDt,Math.max(0,DEFAULT_TURTLE_ACTIVITY_TIMINGS.rest-activity.state.phaseElapsed));
   const priorProgress=activity.state.feedingProgress;
   const snapshot=activity.step({turtle:s,habitat:habitat(),siteValid,manualInputActive:false,paused},activityDt);
   if(!paused&&stage==='nesting'&&snapshot.phase==='dig'&&!nestAnchorPosition)commitNest();
   syncNest();
   feedingContactSeconds+=Math.max(0,snapshot.feedingProgress-priorProgress)*DEFAULT_TURTLE_ACTIVITY_TIMINGS.feed;
   if(feeding&&!paused&&feedPoseTime>CONTACT_TIMEOUT&&activity.state.phase==='feed'){feedingFailure='food-unreachable';activity.cancel('site-unavailable');}
   if(!paused&&Number.isFinite(dt)&&dt>0&&activity.intent().kind==='navigate'){
    const moved=horizontal(s.position,lastPosition)+Math.abs(s.position.y-lastPosition.y);
    stallTime=moved<.00005?stallTime+Math.min(.1,dt):0;
    if(stallTime>8)activity.cancel('site-unavailable');
   }
   lastPosition={...s.position};
   if(snapshot.feedingProgress>=1){food.visible=false;foodContact=false;}
   if(activity.state.phase==='complete'){
    if(stage==='feeding'){activity.request(nestPlan!);stage='nesting';lastPhase='';switchRoute();}
    else{enabled=false;stage='finished';restorePose();}
   }else if(activity.state.phase==='cancelled'){enabled=false;stage='cancelled';food.visible=false;foodContact=false;restorePose();}
  },
  applyPose(){
   restorePose();foodContact=false;if(!active()||!profileReady||!profileValid)return;
   const intent=activity.intent();if(intent.kind!=='pose'||!['feed','dig','cover'].includes(intent.action))return;
   const p=intent.progress,window=Math.sin(Math.PI*p)**2,offsets:{bone:THREE.Object3D;axis:THREE.Vector3;angle:number}[]=[];
   if(intent.action==='feed'){const pulse=Math.min(1,feedPoseTime/.6)*(.92+.08*Math.sin(feedPoseTime*Math.PI*3));offsets.push({bone:bones.Neck!,axis:new THREE.Vector3(1,0,0),angle:NECK_POSE_ANGLE*pulse},{bone:bones.Head!,axis:new THREE.Vector3(1,0,0),angle:MAX_POSE_ANGLE*pulse});}
   else for(const [side,root,tip] of [[-1,bones.HindL!,bones.HindLTip!],[1,bones.HindR!,bones.HindRTip!]] as const){const pulse=window*(.5+.5*Math.sin(p*Math.PI*8+side*Math.PI/2));offsets.push({bone:root,axis:new THREE.Vector3(0,0,1),angle:side*HIND_POSE_ANGLE*pulse},{bone:tip,axis:new THREE.Vector3(0,0,1),angle:side*HIND_POSE_ANGLE*.6*pulse});}
   const base=offsets.map(x=>x.bone.quaternion.clone()),clearances=probes.map(p=>{const w=p.bone!.localToWorld(p.local.clone());return w.y-cove.sampleHeight(w.x,w.z);});
   let gain=1,valid=false,safeGain=0,unsafeGain=1;
   for(let attempt=0;attempt<9;attempt++){
    offsets.forEach((o,i)=>o.bone.quaternion.copy(base[i]).multiply(new THREE.Quaternion().setFromAxisAngle(o.axis,o.angle*gain)));view.group.updateMatrixWorld(true);
    valid=probes.every((probe,i)=>{const w=probe.bone!.localToWorld(probe.local.clone());return w.y-cove.sampleHeight(w.x,w.z)>=Math.min(.002,clearances[i])-.001;});
    if(intent.action==='feed'){measureFoodContact();valid=valid&&(foodGap===null||foodGap>=-.003);}
    if(valid){safeGain=gain;if(gain===1)break;}else unsafeGain=gain;
    gain=(safeGain+unsafeGain)*.5;
   }
   // Retain the greatest sampled safe amplitude, not a coarse half-angle step.
   offsets.forEach((o,i)=>{o.bone.quaternion.copy(base[i]);if(safeGain>0){o.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(o.axis,o.angle*safeGain));overlays.set(o.bone,{base:base[i],applied:o.bone.quaternion.clone()});}});view.group.updateMatrixWorld(true);if(intent.action==='feed')measureFoodContact();else foodContact=false;
  },
  reset(){restorePose();resetContact();activity.reset();activity.setEnabled(false);enabled=false;stage='off';peakControllerStepDistance=0;route=[];routeIndex=0;lastPhase='';stallTime=0;laid.clear();eggs.count=0;coverage=0;sand.visible=false;food.visible=false;nestCenter=null;nestAnchorPosition=null;nestAnchorHeading=null;nestAnchorPhase=null;nestFootprintMinimumHeight=null;nestFailure=null;},
  diagnostics(){return {enabled,paused,stage,phase:activity.state.phase,reason:activity.state.reason,eggs:laid.size,coverage,routeIndex,waypoints:route.length,elapsed:activity.state.elapsed,poseReady:profileReady&&profileValid,peakControllerStepDistance,maxPoseAngle:MAX_POSE_ANGLE,feedingProgress:activity.state.feedingProgress,foodContact,foodGap,closestFoodGap,feedingContactSeconds,feedPoseTime,feedingFailure,nestCenter:nestAnchorPosition&&nestCenter?{...nestCenter}:null,nestAnchorPosition:nestAnchorPosition?{...nestAnchorPosition}:null,nestAnchorHeading,nestAnchorPhase,nestRearOffset:restProfile.nestRearOffset,nestApproachTarget:nestPlan?{...nestPlan.target.position}:null,nestFootprintMinimumHeight,nestFailure,disposed};},
  dispose(){if(disposed)return;api.reset();disposed=true;eggGeometry.dispose();eggMaterial.dispose();eggs.dispose();sandGeometry.dispose();sandMaterial.dispose();foodGeometry.dispose();foodMaterial.dispose();group.clear();},
 };
 return api;
}

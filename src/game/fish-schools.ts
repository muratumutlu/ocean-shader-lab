// Ambient fish schools that roam the cove's deeper water, purely decorative.
import * as THREE from 'three';
import type {CoveResources} from '../scene/cove';
import {createFish,disposeTree} from './models';

const TINTS=[0x8fb2c4,0xf2b544,0xe0785a,0x9fa9c9,0x7fc3a8,0xd9d2c0];
type School={center:THREE.Vector3;target:THREE.Vector3;velocity:THREE.Vector3;timer:number;members:{fish:THREE.Group;offset:THREE.Vector3;phase:number}[]};

export function createFishSchools(cove:CoveResources,count=6,random:()=>number=Math.random){
 const group=new THREE.Group();group.name='fish-schools';
 const pick=(tide:number)=>{for(let i=0;i<40;i++){const x=-12+random()*24,z=.5+random()*10.5,floor=cove.sampleHeight(x,z);if(floor<tide-.7&&cove.sampleOccupancy(x,z)<.3)return new THREE.Vector3(x,THREE.MathUtils.lerp(floor+.3,tide-.25,random()),z);}return new THREE.Vector3(-2,-.7,7);};
 const schools:School[]=[];
 for(let s=0;s<count;s++){
  const center=pick(0),tint=TINTS[s%TINTS.length],size=4+Math.floor(random()*5),scale=.9+random()*.5;
  const school:School={center,target:pick(0),velocity:new THREE.Vector3(),timer:0,members:[]};
  for(let i=0;i<size;i++){const fish=createFish(tint);fish.scale.setScalar(scale*(.85+random()*.3));group.add(fish);
   school.members.push({fish,offset:new THREE.Vector3((random()-.5)*1.2,(random()-.5)*.3,(random()-.5)*1.2),phase:random()*Math.PI*2});}
  schools.push(school);
 }
 const desired=new THREE.Vector3(),ahead=new THREE.Vector3();
 return {
  group,
  update(time:number,dt:number,tide:number){
   const step=Math.min(dt,.1);
   for(const school of schools){
    school.timer-=step;
    if(school.timer<=0||school.center.distanceTo(school.target)<1){school.target=pick(tide);school.timer=8+random()*10;}
    desired.subVectors(school.target,school.center).setLength(.75);
    school.velocity.lerp(desired,Math.min(1,step*.8));
    // Turn away from shallows and rocks before reaching them.
    ahead.copy(school.center).addScaledVector(school.velocity,1.5);
    if(cove.sampleHeight(ahead.x,ahead.z)>tide-.5||cove.sampleOccupancy(ahead.x,ahead.z)>.4){school.target=pick(tide);school.velocity.multiplyScalar(.5);}
    school.center.addScaledVector(school.velocity,step);
    const heading=Math.atan2(school.velocity.x,school.velocity.z);
    for(const m of school.members){
     const wobble=Math.sin(time*1.3+m.phase);
     const local=m.offset.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP,heading);
     m.fish.position.set(school.center.x+local.x+wobble*.08,Math.min(tide-.18,school.center.y+m.offset.y+Math.sin(time*.9+m.phase)*.05),school.center.z+local.z);
     // The fish model points along +X; rotate so it faces the school's heading, with a tail wiggle.
     m.fish.rotation.set(0,heading-Math.PI/2+Math.sin(time*9+m.phase)*.12,0);
    }
   }
  },
  /** Recolours every school, e.g. when moving to a region with different species. */
  setTints(tints:number[]){schools.forEach((school,i)=>{for(const m of school.members)m.fish.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.MeshStandardMaterial).color.getHex()!==0x111111)(o.material as THREE.MeshStandardMaterial).color.setHex(tints[i%tints.length]);});});},
  dispose(){disposeTree(group);},
 };
}

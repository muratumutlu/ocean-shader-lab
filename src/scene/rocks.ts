import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createSurfaceTextures,fbm} from './textures';
export type Rock={x:number;z:number;radius:number;height:number;angle:number};
export function rockLayout(seed:number):Rock[]{
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const rocks:Rock[]=[];
 for(let i=0;i<11;i++)rocks.push({x:7.3+i*.38,z:-6.8+i*.8,radius:1.15+random()*1.05,height:.9+random()*2.0,angle:random()*6.28});
 for(let i=0;i<23;i++)rocks.push({x:-13+random()*26,z:-6+random()*15,radius:.18+random()*.6,height:.32+random()*.75,angle:random()*6.28});return rocks;
}
export function createRocks(rocks:Rock[],sampleHeight:(x:number,z:number)=>number){
 const group=new THREE.Group(),textures=createSurfaceTextures('stone');
 textures.map.repeat.set(2,2);textures.bumpMap.repeat.set(2,2);textures.roughnessMap.repeat.set(2,2);
 const geometries=[0,1,2].map(seed=>{const raw=new THREE.IcosahedronGeometry(1,8),g=mergeVertices(raw);raw.dispose();const p=g.attributes.position;for(let n=0;n<p.count;n++){const x=p.getX(n),y=p.getY(n),z=p.getZ(n),a=.82+fbm(x*2+seed*8,z*2+y*1.7,19+seed)*.42;p.setXYZ(n,x*a,y*(.92+fbm(x*4,z*4,seed)*.13),z*a);}g.computeVertexNormals();return g;});
 const materials=[0xd3c5ae,0xafa38e,0xc5b99e].map(color=>new THREE.MeshStandardMaterial({color,map:textures.map,bumpMap:textures.bumpMap,bumpScale:.045,roughnessMap:textures.roughnessMap,roughness:1}));
 rocks.forEach((r,i)=>{const mesh=new THREE.Mesh(geometries[i%3],materials[i%3]),bed=sampleHeight(r.x,r.z);mesh.position.set(r.x,Math.max(bed,-1)+r.height*.23,r.z);mesh.scale.set(r.radius,r.height*.72,r.radius*.8);mesh.rotation.set(.12*Math.sin(i),r.angle,.14*Math.cos(i));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);});
 return {group,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.dispose();group.clear();}};
}

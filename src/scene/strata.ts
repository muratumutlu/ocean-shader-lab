import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm} from './textures';
import {createCeramic} from './ceramic';
import {createSkeleton} from './skeleton';
export const SOIL_FLOOR=-7.5;
export function sampleStratum(x:number,z:number,depth:number){
 const warp=(fbm(x*.26,z*.26,81)-.47)*.20,d=depth+warp;
 return {name:d<.30?'Sand':d<.87?'Packed sand':d<1.8?'Sediment':'Limestone',depth:d};
}
const shaderNoise=`
float sHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float sNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(sHash(i),sHash(i+vec3(1,0,0)),f.x),mix(sHash(i+vec3(0,1,0)),sHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(sHash(i+vec3(0,0,1)),sHash(i+vec3(1,0,1)),f.x),mix(sHash(i+vec3(0,1,1)),sHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float sFbm(vec3 p){return sNoise(p)*.60+sNoise(p*2.07+7.1)*.27+sNoise(p*4.19-3.2)*.13;}`;
export function createStrata(sampleHeight:(x:number,z:number)=>number){
 const group=new THREE.Group();group.name='geological-cutaway';const parts:THREE.BufferGeometry[]=[];
 const skeletonY=sampleHeight(-6,-12)-3.1;
 const pockets=[{x:-16,z:-4.8,y:sampleHeight(-16,-4.8)-1.22,w:.26,h:.34,d:.11},{x:5.2,z:-12,y:sampleHeight(5.2,-12)-2.55,w:.27,h:.35,d:.12},{x:-6,z:-12,y:skeletonY,w:.96,h:.35,d:.065}];
 const edges=[[-16,-12,16,-12],[16,-12,16,12],[16,12,-16,12],[-16,12,-16,-12]];
 for(const [x0,z0,x1,z1] of edges){
  const positions:number[]=[],depths:number[]=[],contacts:number[]=[],indices:number[]=[],nx=(z1-z0)/Math.hypot(x1-x0,z1-z0),nz=-(x1-x0)/Math.hypot(x1-x0,z1-z0);
  for(let k=0;k<=256;k++)for(let j=0;j<=64;j++){
   const x=x0+(x1-x0)*k/256,z=z0+(z1-z0)*k/256,h=sampleHeight(x,z),depth=(h-SOIL_FLOOR)*j/64,y=h-depth;
   const weather=(fbm(x*2.8+y*.4,z*2.8-y*.7,83)-.5)*.055;
   const bedding=Math.pow(Math.max(0,Math.sin(depth*8+fbm(x*.5,z*.5,97)*2)),6)*.025;
   let relief=(weather-bedding)*Math.min(1,depth/.16)*Math.min(1,(y-SOIL_FLOOR)/.20);
   let contact=0;
   for(const pocket of pockets){
    if(Math.abs(nx)>.5?Math.abs(x-pocket.x)>.02:Math.abs(z-pocket.z)>.02)continue;
    const horizontal=Math.abs(nx)>.5?z-pocket.z:x-pocket.x,dx=horizontal/pocket.w,dy=(y-pocket.y)/pocket.h,r2=dx*dx+dy*dy;
    const bowl=Math.max(0,1-r2);
    const excavation=pocket.w>.5?.36+.64*fbm(x*14+y*2,y*14-x*2,113):.65+.35*fbm(x*27+y,y*23+z,117);
    relief-=pocket.d*bowl*bowl*excavation;
    if(pocket.w>.5){const covered=(.5+.5*Math.sin((horizontal+.12)*15+Math.sin(dy*4)))*.022;relief+=covered*bowl;}
    else relief+=.052*bowl*Math.max(0,-dy-.22);
    contact=Math.max(contact,Math.exp(-r2*2)*.28+Math.exp(-Math.pow((r2-.76)*5,2))*.14);
   }
   positions.push(x+nx*relief,y,z+nz*relief);depths.push(depth);contacts.push(contact);
   if(k<256&&j<64){const a=k*65+j,b=a+65;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('soilDepth',new THREE.Float32BufferAttribute(depths,1));g.setAttribute('soilContact',new THREE.Float32BufferAttribute(contacts,1));g.setIndex(indices);g.computeVertexNormals();parts.push(g);
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,side:THREE.DoubleSide});
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vSoilWorld;varying float vSoilDepth,vSoilContact;attribute float soilDepth,soilContact;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSoilWorld=(modelMatrix*vec4(position,1.)).xyz;vSoilDepth=soilDepth;vSoilContact=soilContact;');
  s.fragmentShader='varying vec3 vSoilWorld;varying float vSoilDepth,vSoilContact;\n'+shaderNoise+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float warpedDepth=vSoilDepth+(sFbm(vSoilWorld*vec3(.26,.03,.26))-.47)*.20;
   float sediment=smoothstep(.27,.34,warpedDepth),silt=smoothstep(.80,.93,warpedDepth),bedrock=smoothstep(1.70,1.90,warpedDepth);
   vec3 soil=mix(vec3(.65,.56,.40),vec3(.41,.30,.18),sediment);soil=mix(soil,vec3(.32,.28,.22),silt);soil=mix(soil,vec3(.39,.41,.37),bedrock);
   float folds=warpedDepth*8.7+sFbm(vSoilWorld*.6)*2.1,lamina=pow(.5+.5*sin(folds),10.);
   float mineral=sFbm(vSoilWorld*4.),grain=sNoise(vSoilWorld*66.);float grainFade=1.-smoothstep(.35,1.1,max(length(dFdx(vSoilWorld*66.)),length(dFdy(vSoilWorld*66.))));
   soil*=.89+mineral*.22-lamina*mix(.09,.22,bedrock)+(grain-.5)*.12*grainFade;
   float fossils=1.-smoothstep(.03,.14,abs(sin(vSoilWorld.x*4.2+vSoilWorld.z*3.1+sFbm(vSoilWorld*1.7)*4.)));
   soil=mix(soil,soil*vec3(.84,.82,.69),fossils*bedrock*.26);diffuseColor.rgb=soil*(1.-vSoilContact);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float relief=sFbm(vSoilWorld*9.)*.015+sNoise(vSoilWorld*66.)*.0015*grainFade-lamina*.012;
   vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);
   normal=normalize(normal-sign(det)*(dFdx(relief)*a+dFdy(relief)*b)/max(abs(det),.000001));`);
 };
 const soil=new THREE.Mesh(geometry,material);soil.name='soil-cutaway';soil.receiveShadow=true;group.add(soil);
 const artifacts=new THREE.Group();artifacts.name='buried-artifacts';group.add(artifacts);
 const bronze=new THREE.MeshStandardMaterial({color:0x949a70,roughness:.79,metalness:.16});
 const metalParts:THREE.BufferGeometry[]=[];
 const ceramics=[createCeramic(7),createCeramic(13)];
 const transforms=[[-15.91,sampleHeight(-16,-4.8)-1.22,-4.8,Math.PI/2],[5.2,sampleHeight(5.2,-12)-2.55,-11.91,0]];
 for(let i=0;i<ceramics.length;i++){
  const [x,y,z,angle]=transforms[i],c=ceramics[i],m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(angle?.10:-.38,angle,angle?.38:.08,'ZYX')),new THREE.Vector3(1,1,1));
  c.geometry.applyMatrix4(m);c.sediment.geometry.applyMatrix4(m);
 }
 const clayGeo=mergeGeometries(ceramics.map(c=>c.geometry))!,sedimentGeo=mergeGeometries(ceramics.map(c=>c.sediment.geometry))!;
 const pottery=new THREE.Mesh(clayGeo,ceramics[0].material);pottery.name='buried-ceramics';pottery.castShadow=true;pottery.receiveShadow=true;
 const sediment=new THREE.Mesh(sedimentGeo,ceramics[0].sediment.material);sediment.name='ceramic-sediment';artifacts.add(pottery,sediment);
 const skeleton=createSkeleton();
 const cranial=/mandible|frontal bone|occipital|sphenoid|ethmoid|temporal bone|parietal|zygomatic|lacrimal|nasal bone|maxilla|palatine|vomer|^atlas$/;
 const headVertices=new Set<number>(),ix=skeleton.geometry.index!;
 for(const part of skeleton.parts)if(cranial.test(part.name))for(let i=part.indexStart;i<part.indexStart+part.indexCount;i++)headVertices.add(ix.getX(i));
 const positions=skeleton.geometry.attributes.position,pivot=new THREE.Vector3(0,.66,0),yaw=new THREE.Matrix4().makeRotationY(.69),point=new THREE.Vector3();
 for(const i of headVertices){point.fromBufferAttribute(positions,i).sub(pivot).applyMatrix4(yaw).add(pivot);positions.setXYZ(i,point.x,point.y,point.z);}
 skeleton.geometry.computeVertexNormals();skeleton.geometry.rotateY(.24);skeleton.geometry.rotateZ(Math.PI/2);skeleton.geometry.rotateX(Math.PI);skeleton.geometry.translate(-6,skeletonY,-12.045);
 const bones=new THREE.Mesh(skeleton.geometry,skeleton.material);bones.name='buried-skeleton';bones.castShadow=true;bones.receiveShadow=true;artifacts.add(bones);
 for(const [x,z,d,angle] of [[16.015,2.5,1.1,Math.PI/2],[-6,12.015,2.65,0]])for(let i=0;i<3;i++){
  const coin=new THREE.CylinderGeometry(.071,.068,.012,24);coin.rotateX(Math.PI/2);coin.rotateY(angle);coin.rotateZ(i*.23);
  const y=sampleHeight(x,z)-d+(i-1)*.035;coin.translate(x+(angle?0:(i-1)*.065),y,z+(angle?(i-1)*.065:0));metalParts.push(coin);
 }
 const metalGeo=mergeGeometries(metalParts)!;metalParts.forEach(g=>g.dispose());
 const coins=new THREE.Mesh(metalGeo,bronze);coins.name='buried-bronze';artifacts.add(coins);
 let disposed=false;return {group,dispose(){if(disposed)return;disposed=true;[geometry,clayGeo,sedimentGeo,metalGeo].forEach(g=>g.dispose());[material,bronze].forEach(m=>m.dispose());ceramics.forEach(c=>c.dispose());skeleton.dispose();group.clear();}};
}

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm} from './textures';
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
 const edges=[[-16,-12,16,-12],[16,-12,16,12],[16,12,-16,12],[-16,12,-16,-12]];
 for(const [x0,z0,x1,z1] of edges){
  const positions:number[]=[],depths:number[]=[],indices:number[]=[],nx=(z1-z0)/Math.hypot(x1-x0,z1-z0),nz=-(x1-x0)/Math.hypot(x1-x0,z1-z0);
  for(let k=0;k<=128;k++)for(let j=0;j<=32;j++){
   const x=x0+(x1-x0)*k/128,z=z0+(z1-z0)*k/128,h=sampleHeight(x,z),depth=(h-SOIL_FLOOR)*j/32,y=h-depth;
   const weather=(fbm(x*2.8+y*.4,z*2.8-y*.7,83)-.5)*.055;
   const bedding=Math.pow(Math.max(0,Math.sin(depth*8+fbm(x*.5,z*.5,97)*2)),6)*.025;
   const relief=(weather-bedding)*Math.min(1,depth/.16)*Math.min(1,(y-SOIL_FLOOR)/.20);
   positions.push(x+nx*relief,y,z+nz*relief);depths.push(depth);
   if(k<128&&j<32){const a=k*33+j,b=a+33;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('soilDepth',new THREE.Float32BufferAttribute(depths,1));g.setIndex(indices);g.computeVertexNormals();parts.push(g);
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,side:THREE.DoubleSide});
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vSoilWorld;varying float vSoilDepth;attribute float soilDepth;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSoilWorld=(modelMatrix*vec4(position,1.)).xyz;vSoilDepth=soilDepth;');
  s.fragmentShader='varying vec3 vSoilWorld;varying float vSoilDepth;\n'+shaderNoise+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float warpedDepth=vSoilDepth+(sFbm(vSoilWorld*vec3(.26,.03,.26))-.47)*.20;
   float sediment=smoothstep(.27,.34,warpedDepth),silt=smoothstep(.80,.93,warpedDepth),bedrock=smoothstep(1.70,1.90,warpedDepth);
   vec3 soil=mix(vec3(.65,.56,.40),vec3(.41,.30,.18),sediment);soil=mix(soil,vec3(.32,.28,.22),silt);soil=mix(soil,vec3(.39,.41,.37),bedrock);
   float folds=warpedDepth*8.7+sFbm(vSoilWorld*.6)*2.1,lamina=pow(.5+.5*sin(folds),10.);
   float mineral=sFbm(vSoilWorld*4.),grain=sNoise(vSoilWorld*66.);float grainFade=1.-smoothstep(.35,1.1,max(length(dFdx(vSoilWorld*66.)),length(dFdy(vSoilWorld*66.))));
   soil*=.89+mineral*.22-lamina*mix(.09,.22,bedrock)+(grain-.5)*.12*grainFade;
   float fossils=1.-smoothstep(.03,.14,abs(sin(vSoilWorld.x*4.2+vSoilWorld.z*3.1+sFbm(vSoilWorld*1.7)*4.)));
   soil=mix(soil,soil*vec3(.84,.82,.69),fossils*bedrock*.26);diffuseColor.rgb=soil;`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float relief=sFbm(vSoilWorld*9.)*.015+sNoise(vSoilWorld*66.)*.0015*grainFade-lamina*.012;
   vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);
   normal=normalize(normal-sign(det)*(dFdx(relief)*a+dFdy(relief)*b)/max(abs(det),.000001));`);
 };
 const soil=new THREE.Mesh(geometry,material);soil.name='soil-cutaway';soil.receiveShadow=true;group.add(soil);
 const artifacts=new THREE.Group();artifacts.name='buried-artifacts';group.add(artifacts);
 const clay=new THREE.MeshStandardMaterial({color:0x996148,roughness:.91}),bronze=new THREE.MeshStandardMaterial({color:0x949a70,roughness:.79,metalness:.16});
 clay.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vClayWorld;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClayWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader='varying vec3 vClayWorld;\n'+shaderNoise+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.83+sFbm(vClayWorld*39.)*.26;');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float relief=sFbm(vClayWorld*87.)*.0008;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);normal=normalize(normal-sign(det)*(dFdx(relief)*a+dFdy(relief)*b)/max(abs(det),.000001));`);
 };
 const clayParts:THREE.BufferGeometry[]=[],metalParts:THREE.BufferGeometry[]=[];
 const place=(g:THREE.BufferGeometry,x:number,y:number,z:number,angle:number)=>{g.rotateY(angle);g.translate(x,y,z);return g;};
 const amphora=(x:number,z:number,d:number,angle:number)=>{
  const y=sampleHeight(x,z)-d;const points=[[0,-.23],[.07,-.21],[.145,-.12],[.16,-.03],[.13,.08],[.057,.14],[.052,.21],[.071,.23]].map(([r,h])=>new THREE.Vector2(r,h));
  clayParts.push(place(new THREE.LatheGeometry(points,32,.16,Math.PI*1.86),x,y,z,angle));
  const rim=new THREE.TorusGeometry(.064,.009,6,28,Math.PI*1.8);rim.rotateX(Math.PI/2);rim.translate(0,.22,0);clayParts.push(place(rim,x,y,z,angle));
  for(const side of [-1,1]){const handle=new THREE.TorusGeometry(.044,.012,6,16);handle.scale(.75,1.25,1);handle.translate(side*.103,.117,0);clayParts.push(place(handle,x,y,z,angle));}
 };
 amphora(-15.955,-4.8,1.22,Math.PI/2);amphora(5.2,-11.955,2.55,0);
 for(const [x,z,d,angle] of [[16.015,2.5,1.1,Math.PI/2],[-6,12.015,2.65,0]])for(let i=0;i<3;i++){
  const coin=new THREE.CylinderGeometry(.071,.068,.012,24);coin.rotateX(Math.PI/2);coin.rotateY(angle);coin.rotateZ(i*.23);
  const y=sampleHeight(x,z)-d+(i-1)*.035;coin.translate(x+(angle?0:(i-1)*.065),y,z+(angle?(i-1)*.065:0));metalParts.push(coin);
 }
 const clayGeo=mergeGeometries(clayParts)!,metalGeo=mergeGeometries(metalParts)!;[...clayParts,...metalParts].forEach(g=>g.dispose());
 const pottery=new THREE.Mesh(clayGeo,clay);pottery.name='buried-ceramics';const coins=new THREE.Mesh(metalGeo,bronze);coins.name='buried-bronze';artifacts.add(pottery,coins);
 let disposed=false;return {group,dispose(){if(disposed)return;disposed=true;[geometry,clayGeo,metalGeo].forEach(g=>g.dispose());[material,clay,bronze].forEach(m=>m.dispose());group.clear();}};
}

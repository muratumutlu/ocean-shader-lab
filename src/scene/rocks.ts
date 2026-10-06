import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRockShape,type ColliderSpec} from './cove-data';
import type {QualityProfile} from '../types';
export type Rock={x:number;z:number;radius:number;height:number;angle:number;kind?:'ridge'|'boulder'|'shelf'|'pebble'};
export function createRocks(layout:Rock[],sampleHeight:(x:number,z:number)=>number){
 const group=new THREE.Group();group.name='cove-rocks';
 const tide={value:0},detail={value:1};
 const material=new THREE.MeshStandardMaterial({color:0xc1b19b,roughness:.91});
 material.onBeforeCompile=shader=>{
  shader.uniforms.rockTide=tide;shader.uniforms.rockDetail=detail;
  shader.vertexShader='varying vec3 vRockWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=`varying vec3 vRockWorld;uniform float rockTide,rockDetail;
  float rHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float rNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(rHash(i),rHash(i+vec3(1,0,0)),f.x),mix(rHash(i+vec3(0,1,0)),rHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rHash(i+vec3(0,0,1)),rHash(i+vec3(1,0,1)),f.x),mix(rHash(i+vec3(0,1,1)),rHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float rFbm(vec3 p){return rNoise(p)*.57+rNoise(p*2.07+7.1)*.28+rNoise(p*4.19-3.2)*.15;}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float mineral=rFbm(vRockWorld*1.2),fine=rNoise(vRockWorld*57.);
  float fractureField=abs(rFbm(vRockWorld*1.23+vec3(7.4,3.1,-2.8))-.49);
  float fracture=(1.-smoothstep(.0015,.008+fwidth(fractureField),fractureField))*smoothstep(.32,.62,rNoise(vRockWorld*.87+9.1));
  float bedding=abs(vRockWorld.y*.27+rFbm(vRockWorld*vec3(.64,.25,.64))*.44-.61);
  float seam=1.-smoothstep(.004,.018+fwidth(bedding),bedding);
  vec3 limestone=mix(vec3(.35,.32,.31),vec3(.64,.60,.53),smoothstep(.23,.78,mineral));
  float quartz=smoothstep(.60,.76,rFbm(vRockWorld*8.3+4.7));
  limestone=mix(limestone,vec3(.74,.70,.62),quartz*.22);
  limestone*=1.-fracture*.14-seam*.07;
  limestone=mix(limestone,vec3(.24,.245,.18),rNoise(vRockWorld*5.7)*.10*(1.-smoothstep(.0,.35,vRockWorld.y-rockTide)));
  float grainFade=1.-smoothstep(.3,1.,max(length(dFdx(vRockWorld*57.)),length(dFdy(vRockWorld*57.))));limestone*=.93+(fine-.5)*.07*rockDetail*grainFade;
  float dry=smoothstep(-.04,.23,vRockWorld.y-rockTide);
  diffuseColor.rgb=limestone*mix(.52,1.,dry);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  roughnessFactor=mix(.32,.91,smoothstep(-.04,.23,vRockWorld.y-rockTide));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  float relief=(rFbm(vRockWorld*8.7)*.036+rFbm(vRockWorld*24.)*.009+rNoise(vRockWorld*65.)*.0015*grainFade-fracture*.005-seam*.004)*rockDetail;
  vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);
  normal=normalize(normal-sign(det)*(dFdx(relief)*a+dFdy(relief)*b)/max(abs(det),.000001));`);
 };
 const parts:THREE.BufferGeometry[]=[],colliders:ColliderSpec[]=[];
 for(const rock of layout){
  const shape=createRockShape(rock),vertices=shape.vertices,geometry=new THREE.BufferGeometry(),y=sampleHeight(rock.x,rock.z)-.08-rock.height*.18;
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices.slice(),3));geometry.setIndex(new THREE.BufferAttribute(shape.indices,1));geometry.computeVertexNormals();
  geometry.rotateY(rock.angle);geometry.translate(rock.x,y,rock.z);parts.push(geometry);
  colliders.push({kind:'convex',vertices,translation:{x:rock.x,y,z:rock.z},rotation:{x:0,y:Math.sin(rock.angle/2),z:0,w:Math.cos(rock.angle/2)}});
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name='limestone-masses';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);let disposed=false;
 return {group,colliders,setQuality(profile:QualityProfile){detail.value={low:.45,balanced:.75,high:1}[profile];},updateOptics(next:number){tide.value=next;},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();group.clear();}};
}

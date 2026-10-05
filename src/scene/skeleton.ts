import * as THREE from 'three';
import {BONE_POSITIONS,BONE_INDICES,BONE_PARTS} from './skeleton-data';
export const SKELETON_CREDITS='BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International';
const NL=String.fromCharCode(10);
function decode(s:string){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a.buffer;}
export function createSkeleton(){
 const quantized=new Int16Array(decode(BONE_POSITIONS)),position=new Float32Array(quantized.length);for(let i=0;i<position.length;i++)position[i]=quantized[i]*.00005;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(decode(BONE_INDICES)),1));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,side:THREE.DoubleSide});
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vBoneWorld;'+NL+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>'+NL+'vBoneWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=[
   'varying vec3 vBoneWorld;',
   'float bHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}',
   'float bNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(bHash(i),bHash(i+vec3(1,0,0)),f.x),mix(bHash(i+vec3(0,1,0)),bHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(bHash(i+vec3(0,0,1)),bHash(i+vec3(1,0,1)),f.x),mix(bHash(i+vec3(0,1,1)),bHash(i+vec3(1,1,1)),f.x),f.y),f.z);}',
   'float bFbm(vec3 p){return bNoise(p)*.58+bNoise(p*2.07+7.1)*.28+bNoise(p*4.19-3.2)*.14;}'
  ].join(NL)+NL+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',[
   '#include <color_fragment>',
   'float patina=bFbm(vBoneWorld*29.),earth=smoothstep(.40,.70,bFbm(vBoneWorld*13.+17.)),pores=bNoise(vBoneWorld*330.);',
   'float boneFade=1.-smoothstep(.4,1.3,max(length(dFdx(vBoneWorld*330.)),length(dFdy(vBoneWorld*330.))));',
   'vec3 bone=mix(vec3(.49,.42,.29),vec3(.75,.70,.56),patina);bone=mix(bone,vec3(.30,.25,.17),earth*.48);bone*=.97+(pores-.5)*.12*boneFade;diffuseColor.rgb=bone;'
  ].join(NL));
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',[
   '#include <normal_fragment_maps>',
   'float boneRelief=bFbm(vBoneWorld*100.)*.0006+bNoise(vBoneWorld*330.)*.00022*boneFade;',
   'vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);normal=normalize(normal-sign(det)*(dFdx(boneRelief)*a+dFdy(boneRelief)*b)/max(abs(det),.000001));'
  ].join(NL));
 };
 let disposed=false;return {geometry,material,bones:BONE_PARTS.length,parts:BONE_PARTS,dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();}};
}

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm,noise2} from './textures';
const NL=String.fromCharCode(10),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const profile=[[-.24,.012],[-.205,.081],[-.14,.153],[-.045,.185],[.065,.157],[.135,.071],[.205,.053],[.254,.067],[.270,.073]];
function radius(y:number){for(let i=0;i<profile.length-1;i++){const [a,ra]=profile[i],[b,rb]=profile[i+1];if(y<=b){const t=THREE.MathUtils.clamp((y-a)/(b-a),0,1),p=profile[Math.max(0,i-1)],q=profile[Math.min(profile.length-1,i+2)],m0=(rb-p[1])/(b-p[0]),m1=(q[1]-ra)/(q[0]-a),t2=t*t,t3=t2*t;return Math.max(.005,(2*t3-3*t2+1)*ra+(t3-2*t2+t)*(b-a)*m0+(-2*t3+3*t2)*rb+(t3-t2)*(b-a)*m1);}}return .073;}
export function createCeramic(seed:number){
 const vertices:number[]=[],uv:number[]=[],inside:number[]=[],fracture:number[]=[],indices:number[]=[],segments=96,rings=42;
 const rim=(theta:number)=>{const d=(a:number)=>Math.atan2(Math.sin(theta-a),Math.cos(theta-a));return .263-.192*Math.exp(-Math.pow(d(.72+seed*.03)/.44,4))-.062*Math.exp(-Math.pow(d(4.6)/.26,4))+Math.sin(theta*43+seed)*.0008+Math.sin(theta*79)*.0004;};
 for(let inner=0;inner<=1;inner++)for(let i=0;i<=segments;i++)for(let j=0;j<=rings;j++){
  const theta=i/segments*Math.PI*2,top=rim(theta),y=mix(inner?-.214:-.238,top,j/rings),turn=Math.sin(y*176+theta*.17)*.00062,wear=(fbm(Math.cos(theta)*4+y*2,Math.sin(theta)*4-y*3,seed)-.48)*.0065;
  const r=Math.max(.005,radius(y)-inner*(.015+.003*noise2(theta*6,y*31,seed))+wear+turn);
  vertices.push(Math.cos(theta)*r*(1+.028*Math.sin(theta*3+seed)),y,Math.sin(theta)*r);uv.push(i/segments,j/rings);inside.push(inner);fracture.push(0);
  if(i<segments&&j<rings){const a=inner*(segments+1)*(rings+1)+i*(rings+1)+j,b=a+rings+1;indices.push(...(inner?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
 }
 const rimStart=vertices.length/3;
 for(let i=0;i<=segments;i++)for(let inner=0;inner<=1;inner++){
  const n=(inner*(segments+1)*(rings+1)+i*(rings+1)+rings)*3;vertices.push(vertices[n],vertices[n+1],vertices[n+2]);uv.push(i/segments,inner);inside.push(.55);fracture.push(1);
  if(i<segments&&inner===0){const a=rimStart+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 }
 const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));surface.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));surface.setAttribute('clayInside',new THREE.Float32BufferAttribute(inside,1));surface.setAttribute('clayFracture',new THREE.Float32BufferAttribute(fracture,1));surface.setIndex(indices);surface.computeVertexNormals();
 const parts=[surface];for(const side of [-1,1]){
  const points=[new THREE.Vector3(side*.06,.204,0),new THREE.Vector3(side*.109,.207,-.01),new THREE.Vector3(side*.145,.153,-.005),new THREE.Vector3(side*.150,.104,0)];
  const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.012,10,false);tube.setAttribute('clayInside',new THREE.Float32BufferAttribute(new Float32Array(tube.attributes.position.count),1));tube.setAttribute('clayFracture',new THREE.Float32BufferAttribute(new Float32Array(tube.attributes.position.count),1));parts.push(tube);
 }
 const merged=mergeGeometries(parts)!,geometry=merged.toNonIndexed();merged.dispose();parts.forEach(p=>p.dispose());
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,side:THREE.DoubleSide});
 material.onBeforeCompile=s=>{
  s.vertexShader='attribute float clayInside,clayFracture;varying float vClayInside,vClayFracture;varying vec3 vClayWorld;'+NL+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>'+NL+'vClayInside=clayInside;vClayFracture=clayFracture;vClayWorld=(modelMatrix*vec4(position,1.)).xyz;');
  const noise=[
   'varying float vClayInside,vClayFracture;varying vec3 vClayWorld;',
   'float cHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}',
   'float cNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(cHash(i),cHash(i+vec3(1,0,0)),f.x),mix(cHash(i+vec3(0,1,0)),cHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(cHash(i+vec3(0,0,1)),cHash(i+vec3(1,0,1)),f.x),mix(cHash(i+vec3(0,1,1)),cHash(i+vec3(1,1,1)),f.x),f.y),f.z);}',
   'float cFbm(vec3 p){return cNoise(p)*.58+cNoise(p*2.07+7.1)*.28+cNoise(p*4.19-3.2)*.14;}'
  ].join(NL);
  s.fragmentShader=noise+NL+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',[
   '#include <color_fragment>',
   'float mineral=cFbm(vClayWorld*32.),salt=smoothstep(.55,.73,cFbm(vClayWorld*61.+17.)),grain=cNoise(vClayWorld*240.);',
   'float footprint=max(length(dFdx(vClayWorld*240.)),length(dFdy(vClayWorld*240.))),grainFade=1.-smoothstep(.35,1.,footprint);',
   'float crackField=abs(cFbm(vClayWorld*17.+3.1)-.47),crack=(1.-smoothstep(.001,.006+fwidth(crackField),crackField))*smoothstep(.38,.61,cNoise(vClayWorld*13.));',
   'vec3 clay=mix(vec3(.25,.18,.12),vec3(.43,.33,.23),mineral);clay=mix(clay,vec3(.54,.50,.41),salt*.48);',
   'clay*=.91+(grain-.5)*.18*grainFade-crack*.075;clay=mix(clay,clay*vec3(.76,.77,.73),vClayInside*.64);clay=mix(clay,vec3(.43,.32,.21)*(.86+grain*.13),vClayFracture);diffuseColor.rgb=clay;'
  ].join(NL));
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',[
   '#include <normal_fragment_maps>',
   'float relief=cFbm(vClayWorld*71.)*.0026+cNoise(vClayWorld*240.)*.00042*grainFade-crack*.00025;',
   'vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),a=cross(sy,normal),b=cross(normal,sx);float det=dot(sx,a);normal=normalize(normal-sign(det)*(dFdx(relief)*a+dFdy(relief)*b)/max(abs(det),.000001));'
  ].join(NL));
 };
 const sedimentGeo=new THREE.SphereGeometry(.144,36,18);sedimentGeo.scale(1,.11,1);sedimentGeo.translate(0,.022,0);const sp=sedimentGeo.attributes.position;
 for(let i=0;i<sp.count;i++)sp.setY(i,sp.getY(i)+(fbm(sp.getX(i)*64,sp.getZ(i)*64,seed)-.47)*.009);sedimentGeo.computeVertexNormals();
 const sedimentMaterial=new THREE.MeshStandardMaterial({color:0x807264,roughness:1}),sediment=new THREE.Mesh(sedimentGeo,sedimentMaterial);
 let disposed=false;return {geometry,material,sediment,dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();sedimentGeo.dispose();sedimentMaterial.dispose();}};
}

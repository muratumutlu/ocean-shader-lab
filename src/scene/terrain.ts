import * as THREE from 'three';
import type {TerrainResources} from '../types';
import {createRocks,rockLayout} from './rocks';
import {createSurfaceTextures,fbm,noise2} from './textures';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const SIZE=129, WIDTH=32, DEPTH=24;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function createTerrain(seed:number):TerrainResources{
  const group=new THREE.Group(), heights=new Float32Array(SIZE*SIZE), masks=new Float32Array(SIZE*SIZE);
  const rocks=rockLayout(seed);
  for(let j=0;j<SIZE;j++)for(let i=0;i<SIZE;i++){
    const x=-16+i/(SIZE-1)*WIDTH,z=-12+j/(SIZE-1)*DEPTH;
    const shore=-1.4+1.05*Math.sin(x*.22)+.48*Math.sin(x*.64+.8);
    const d=shore-z;
    const dune=Math.max(0,Math.min(1,(d-2)/5))*(.7+.65*Math.sin(x*.29+z*.25)**2);
    const ripple=(fbm(x*1.2,z*1.2,seed)-.5)*.022;
    heights[j*SIZE+i]=clamp(d*.24+dune+ripple,-3,3.8);
    let mask=0;for(const rock of rocks) mask=Math.max(mask,Math.exp(-((x-rock.x)**2+(z-rock.z)**2)/(rock.radius**2*.9)));
    masks[j*SIZE+i]=mask;
  }
  const texture=(data:Float32Array)=>{const t=new THREE.DataTexture(data,SIZE,SIZE,THREE.RedFormat,THREE.FloatType);t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;};
  const heightTexture=texture(heights),rockMaskTexture=texture(masks);
  const sampleHeight=(x:number,z:number)=>{
    const u=clamp((x+16)/WIDTH*(SIZE-1),0,SIZE-1),v=clamp((z+12)/DEPTH*(SIZE-1),0,SIZE-1);
    const i=Math.floor(u),j=Math.floor(v),i1=Math.min(i+1,SIZE-1),j1=Math.min(j+1,SIZE-1),a=u-i,b=v-j;
    return (heights[j*SIZE+i]*(1-a)+heights[j*SIZE+i1]*a)*(1-b)+(heights[j1*SIZE+i]*(1-a)+heights[j1*SIZE+i1]*a)*b-Math.max(z-12,0)*.12;
  };
  const geometry=new THREE.PlaneGeometry(64,48,256,192);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;const colors=new Float32Array(positions.count*3);
  const sand=new THREE.Color(0xfff4db),grass=new THREE.Color(0x82946a),wet=new THREE.Color(0xb6a788);
  for(let n=0;n<positions.count;n++){
    const h=sampleHeight(positions.getX(n),positions.getZ(n));positions.setY(n,h);
    const c=sand.clone().lerp(wet,clamp(-h*.19,0,.4)).lerp(grass,clamp((h-1.55)*1.1+(fbm(positions.getX(n)*.31,positions.getZ(n)*.31,17)-.5)*1.4,0,1));
    c.multiplyScalar(.89+.16*fbm(positions.getX(n)*.17,positions.getZ(n)*.17,31));
    c.toArray(colors,n*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
  const textures=createSurfaceTextures('sand');for(const t of [textures.map,textures.bumpMap,textures.roughnessMap])t.repeat.set(16,12);
  const optics={coastTime:{value:0},coastTide:{value:0}};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:textures.map,bumpMap:textures.bumpMap,bumpScale:.052,roughnessMap:textures.roughnessMap,roughness:1});
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,optics);shader.vertexShader='varying vec3 vCoastWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoastWorld=(modelMatrix*vec4(position,1)).xyz;');shader.fragmentShader='varying vec3 vCoastWorld;uniform float coastTime,coastTide;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat under=max(coastTide-vCoastWorld.y,0.);float p=sin(vCoastWorld.x*5.+sin(vCoastWorld.z*3.+coastTime*.7))*sin(vCoastWorld.z*4.7-sin(vCoastWorld.x*2.5-coastTime*.65));float c=pow(1.-abs(p),17.);diffuseColor.rgb+=vec3(.045,.055,.035)*c*exp(-under*.7)*smoothstep(.02,.2,under);diffuseColor.rgb*=mix(.81,1.,smoothstep(-.02,.25,vCoastWorld.y-coastTide));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(.60,1.,smoothstep(-.04,.25,vCoastWorld.y-coastTide));');};
  const terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;group.add(terrain);
  // Closed, visible tile sides; each upper edge consumes the same height sampler.
  const sideVertices:number[]=[], sideColors:number[]=[];
  const edges=[[-16,-12,16,-12],[16,-12,16,12],[16,12,-16,12],[-16,12,-16,-12]];
  for(const [x0,z0,x1,z1] of edges) for(let k=0;k<128;k++){
    const a=k/128,b=(k+1)/128,xa=x0+(x1-x0)*a,za=z0+(z1-z0)*a,xb=x0+(x1-x0)*b,zb=z0+(z1-z0)*b;
    const points=[[xa,sampleHeight(xa,za),za],[xb,sampleHeight(xb,zb),zb],[xa,-3.5,za],[xb,sampleHeight(xb,zb),zb],[xb,-3.5,zb],[xa,-3.5,za]];
    for(const q of points){sideVertices.push(...q);const c=new THREE.Color(q[1]<-2?0x6a5d47:0xb9a17a);c.toArray(sideColors,sideColors.length);}
  }
  const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sideVertices,3));sideGeo.setAttribute('color',new THREE.Float32BufferAttribute(sideColors,3));sideGeo.computeVertexNormals();
  const sideMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,emissive:0x556737,emissiveIntensity:.18});// Natural camera has no exposed tile cutaway.
  const rockResources=createRocks(rocks,sampleHeight);group.add(rockResources.group);
  const bladeGeo=new THREE.PlaneGeometry(.065,.52,1,4);const bp=bladeGeo.attributes.position;for(let i=0;i<bp.count;i++){const h=(bp.getY(i)+.26)/.52;bp.setXYZ(i,bp.getX(i)*(1-h*.96),bp.getY(i),h*h*.11);}bladeGeo.computeVertexNormals();const parts=[0,Math.PI/3,Math.PI*2/3].map(a=>bladeGeo.clone().rotateY(a));const tuftGeo=mergeGeometries(parts);parts.forEach(p=>p.dispose());const bladeMat=new THREE.MeshStandardMaterial({color:0x85936a,roughness:1,side:THREE.DoubleSide,emissive:0x556737,emissiveIntensity:.18});
  const blades=new THREE.InstancedMesh(tuftGeo,bladeMat,1600),dummy=new THREE.Object3D();
  let state=(seed+99)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<1600;i++){
    const x=-31.6+random()*63.2,z=-23.6+random()*18.5,h=sampleHeight(x,z),patch=noise2(x*.48,z*.48,seed),scale=.28+random()*.65;
    dummy.position.set(x,h+.12*scale,z);dummy.scale.setScalar(h>1.6&&patch>.43?scale:0);dummy.rotation.set(.2*random(),random()*6.28,.2*random());dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);
    blades.setColorAt(i,new THREE.Color().setHSL(.18+random()*.04,.25,.3+random()*.17));
  }
  blades.instanceMatrix.needsUpdate=true;group.add(blades);
  let disposed=false;
  return {group,heightTexture,rockMaskTexture,sampleHeight,updateOptics(time:number,tide:number){optics.coastTime.value=time;optics.coastTide.value=tide;},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();textures.dispose();sideGeo.dispose();sideMat.dispose();bladeGeo.dispose();tuftGeo.dispose();bladeMat.dispose();blades.dispose();rockResources.dispose();heightTexture.dispose();rockMaskTexture.dispose();group.clear();}};
}

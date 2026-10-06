import * as THREE from 'three';
import type {TerrainResources} from '../types';
import {createRocks} from './rocks';
import {createPalms} from './palms';
import {createCove} from './cove';
import {sampleGrid,type CoveData} from './cove-data';
import {createStrata} from './strata';
import {createSurfaceTextures,fbm,noise2} from './textures';
const SIZE=129, WIDTH=32, DEPTH=24;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
function mossCoverage(x:number,z:number,h:number){
 const patch=fbm(x*.6,z*.7,17),edge=-8.1+.55*Math.sin(x*.39);
 return smooth(.8,1.2,h)*(1-smooth(edge-.8,edge+.5,z))*(.60+.40*smooth(.25,.65,patch));
}
export function createTerrain(seed:number):TerrainResources{return createCove(seed);}
export function createTerrainFromData(data:CoveData):TerrainResources & {setQuality:ReturnType<typeof createRocks>['setQuality']}{
  const group=new THREE.Group(),heights=data.heights,masks=data.rockMask,rocks=data.rocks,seed=data.seed;
  const texture=(data:Float32Array)=>{const t=new THREE.DataTexture(data,SIZE,SIZE,THREE.RedFormat,THREE.FloatType);t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;};
  const heightTexture=texture(heights),rockMaskTexture=texture(masks);
  const sampleHeight=(x:number,z:number)=>sampleGrid(data,x,z);
  const geometry=new THREE.PlaneGeometry(32,24,256,192);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;const colors=new Float32Array(positions.count*3),moss=new Float32Array(positions.count);
  const sand=new THREE.Color(0xffe5b5),wet=new THREE.Color(0xc5b28b);
  for(let n=0;n<positions.count;n++){
    const h=sampleHeight(positions.getX(n),positions.getZ(n));positions.setY(n,h);
    const c=sand.clone().lerp(wet,clamp(-h*.19,0,.4));
    moss[n]=mossCoverage(positions.getX(n),positions.getZ(n),h);
    c.multiplyScalar(.89+.16*fbm(positions.getX(n)*.17,positions.getZ(n)*.17,31));
    c.toArray(colors,n*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('coastMoss',new THREE.BufferAttribute(moss,1));geometry.computeVertexNormals();
  const textures=createSurfaceTextures('sand');for(const t of [textures.map,textures.bumpMap,textures.roughnessMap])t.repeat.set(16,12);
  // A material mask resolves rounded contours independently of ground triangles.
  const mossWidth=256,mossDepth=192,mossPixels=new Uint8Array(mossWidth*mossDepth);
  for(let j=0;j<mossDepth;j++)for(let i=0;i<mossWidth;i++){
    const x=-16+(i+.5)/mossWidth*WIDTH,z=-12+(j+.5)/mossDepth*DEPTH;
    mossPixels[j*mossWidth+i]=Math.round(mossCoverage(x,z,sampleHeight(x,z))*255);
  }
  const mossTexture=new THREE.DataTexture(mossPixels,mossWidth,mossDepth,THREE.RedFormat,THREE.UnsignedByteType);
  mossTexture.magFilter=THREE.LinearFilter;mossTexture.minFilter=THREE.LinearMipmapLinearFilter;mossTexture.generateMipmaps=true;mossTexture.needsUpdate=true;
  const optics={coastTime:{value:0},coastTide:{value:0},coastMossMap:{value:mossTexture}};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:textures.map,bumpMap:textures.bumpMap,bumpScale:.052,roughnessMap:textures.roughnessMap,roughness:1});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,optics);
    shader.vertexShader='varying vec3 vCoastWorld;varying float vCoastMoss;attribute float coastMoss;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoastWorld=(modelMatrix*vec4(position,1)).xyz;vCoastMoss=coastMoss;');
    shader.fragmentShader=`varying vec3 vCoastWorld;varying float vCoastMoss;uniform float coastTime,coastTide;uniform sampler2D coastMossMap;
    float coastHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float coastNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(coastHash(i),coastHash(i+vec2(1,0)),f.x),mix(coastHash(i+vec2(0,1)),coastHash(i+vec2(1,1)),f.x),f.y);}
    float coastFbm(vec2 p){return coastNoise(p)*.58+coastNoise(p*2.07+7.1)*.28+coastNoise(p*4.19-3.2)*.14;}
    float coastLocalGrain(vec2 p,vec2 cell){
      float angle=coastHash(cell+vec2(13.7,-8.2))*6.2831853;
      float cs=cos(angle),sn=sin(angle);vec2 q=p-cell*5.;
      q=mat2(cs,-sn,sn,cs)*q+vec2(coastHash(cell+3.1),coastHash(cell-9.7))*17.;
      return coastNoise(q);
    }
    float coastClusterGrain(vec2 p){
      vec2 cell=floor(p/5.),f=fract(p/5.);f=f*f*(3.-2.*f);
      vec4 w=vec4((1.-f.x)*(1.-f.y),f.x*(1.-f.y),(1.-f.x)*f.y,f.x*f.y);
      vec4 grain=vec4(coastLocalGrain(p,cell),coastLocalGrain(p,cell+vec2(1,0)),coastLocalGrain(p,cell+vec2(0,1)),coastLocalGrain(p,cell+vec2(1,1)));
      return clamp(.5+dot(w,grain-vec4(.5))/sqrt(dot(w,w)),0.,1.);
    }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float mossCover=texture2D(coastMossMap,(vCoastWorld.xz+vec2(16.,12.))/vec2(32.,24.)).r;
    float dry=smoothstep(.035,.30,vCoastWorld.y);
    vec3 drySand=diffuseColor.r*vec3(1.,.76,.44);
    diffuseColor.rgb=mix(diffuseColor.rgb,drySand,dry);
    float largePatch=coastFbm(vCoastWorld.xz*.72+vec2(19.3,-5.1));
    float mossDensity=smoothstep(.24,.70,largePatch);
    vec2 clumpWarp=vec2(coastNoise(vCoastWorld.xz*1.1+2.7),coastNoise(vCoastWorld.xz*1.3-4.2));
    float sparseClumps=smoothstep(.43,.66,coastFbm(vCoastWorld.xz*2.6+clumpWarp*.7));
    mossDensity+=(1.-mossDensity)*sparseClumps*.38;
    float tuftClusters=smoothstep(.34,.64,coastFbm(vCoastWorld.xz*6.+clumpWarp*1.1));
    mossDensity+=(1.-mossDensity)*tuftClusters*.58;
    float mossClump=coastFbm(vCoastWorld.xz*10.5);
    float mossGrain=coastNoise(vCoastWorld.xz*73.);
    float fineTone=mix(.5,smoothstep(.24,.76,mossClump),mix(.12,1.,mossDensity));
    vec3 mossTint=mix(vec3(.09,.20,.13),vec3(.25,.42,.29),fineTone);
    mossTint*=.98+(mossGrain-.5)*mix(.04,.21,mossDensity);
    // Thin cover shows muted mineral ground, while established openings stay white.
    vec3 thinCover=diffuseColor.rgb*vec3(.40,.52,.35);
    thinCover=mix(thinCover,mossTint,.22);
    vec3 cover=mix(thinCover,mossTint,mossDensity);
    // Irregular directional grain stays resolvable in the foreshortened land.
    vec2 granularDomain=vec2(dot(vCoastWorld.xz,vec2(.831,-.556))*18.,dot(vCoastWorld.xz,vec2(.556,.831))*5.5);
    granularDomain+=vec2(coastNoise(vCoastWorld.xz*2.3+7.4),coastNoise(vCoastWorld.xz*2.1-3.8))*.62;
    float granularFootprint=max(length(dFdx(granularDomain)),length(dFdy(granularDomain)));
    float grainFade=1.-smoothstep(.65,1.25,granularFootprint);
    float fineGrainFade=1.-smoothstep(.40,.90,granularFootprint*1.8);
    float sparseGrainWeight=mix(.5,1.,1.-smoothstep(.40,.76,mossDensity))*smoothstep(.96,1.,mossCover);
    float clusteredGrain=coastClusterGrain(granularDomain);
    float grainTone=(smoothstep(.22,.78,clusteredGrain)-.5)*.36;
    grainTone+=(smoothstep(.22,.78,coastNoise(granularDomain*1.8+vec2(-7.1,3.4)))-.5)*.05*fineGrainFade;
    cover*=1.+grainTone*grainFade*sparseGrainWeight;
    // Dark granular mineral flecks vary hue without altering local luminance.
    float mineralGrain=(1.-smoothstep(.25,.65,clusteredGrain))*grainFade*sparseGrainWeight*.65;
    vec3 luminanceWeights=vec3(.2126,.7152,.0722);
    vec3 mineralTone=vec3(.28,.23,.17);
    mineralTone*=dot(cover,luminanceWeights)/dot(mineralTone,luminanceWeights);
    cover=mix(cover,mineralTone,mineralGrain);
    diffuseColor.rgb=mix(diffuseColor.rgb,cover,clamp(mossCover,0.,1.));
    float under=max(coastTide-vCoastWorld.y,0.);
    float p=sin(vCoastWorld.x*5.+sin(vCoastWorld.z*3.+coastTime*.7))*sin(vCoastWorld.z*4.7-sin(vCoastWorld.x*2.5-coastTime*.65));
    float c=pow(1.-abs(p),17.);
    diffuseColor.rgb+=vec3(.003,.0035,.003)*c*exp(-under*.7)*smoothstep(.02,.2,under);
    diffuseColor.rgb*=mix(.81,1.,smoothstep(-.02,.25,vCoastWorld.y-coastTide));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor*=mix(.60,1.,smoothstep(-.04,.25,vCoastWorld.y-coastTide));
    roughnessFactor=mix(roughnessFactor,.90+.09*coastFbm(vCoastWorld.xz*7.7),mossCover);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float mossRelief=(coastFbm(vCoastWorld.xz*4.1)*.028+coastFbm(vCoastWorld.xz*15.)*.014+mossGrain*.0015)*clamp(mossCover*mix(.55,1.,mossDensity),0.,1.);
    float sparseRelief=clusteredGrain*.009+coastNoise(granularDomain*1.8+vec2(-7.1,3.4))*.003*fineGrainFade;
    mossRelief+=sparseRelief*grainFade*sparseGrainWeight;
    vec3 surfaceX=dFdx(-vViewPosition),surfaceY=dFdy(-vViewPosition),bumpR1=cross(surfaceY,normal),bumpR2=cross(normal,surfaceX);
    float bumpDet=dot(surfaceX,bumpR1);
    vec3 mossGradient=sign(bumpDet)*(dFdx(mossRelief)*bumpR1+dFdy(mossRelief)*bumpR2)/max(abs(bumpDet),.000001);
    normal=normalize(normal-mossGradient);`);
  };
  const terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;group.add(terrain);
  const strata=createStrata(sampleHeight);group.add(strata.group);
  const rockResources=createRocks(rocks,sampleHeight);group.add(rockResources.group);
  const palms=createPalms(sampleHeight);group.add(palms.group);
  let disposed=false;
  return {setQuality:rockResources.setQuality,group,heightTexture,rockMaskTexture,sampleHeight,updateOptics(time:number,tide:number){optics.coastTime.value=time;optics.coastTide.value=tide;rockResources.updateOptics(tide);},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();textures.dispose();mossTexture.dispose();strata.dispose();rockResources.dispose();palms.dispose();heightTexture.dispose();rockMaskTexture.dispose();group.clear();}};
}

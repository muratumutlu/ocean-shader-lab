import * as THREE from 'three';
import type {TerrainResources} from '../types';
import {createRocks,rockLayout} from './rocks';
import {createSurfaceTextures,fbm,noise2} from './textures';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const SIZE=129, WIDTH=32, DEPTH=24;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
// Approximate reference edge cues mapped onto the unchanged terrain/camera.
const mossEdgePoints=[[-16,-6.3],[-12.35,-7.48],[-6.97,-9.0],[-3.80,-10.35],[-3.31,-9.83],[-.86,-8.75],[2.25,-6.69],[4.52,-7.67],[8,-7.9],[11.68,-7.51],[14.04,-7.79],[16,-7.5]];
function mossCoverage(x:number,z:number,h:number){
 let edge=mossEdgePoints[mossEdgePoints.length-1][1];
 for(let i=1;i<mossEdgePoints.length;i++)if(x<=mossEdgePoints[i][0]){const [a,za]=mossEdgePoints[i-1],[b,zb]=mossEdgePoints[i];edge=za+(zb-za)*smooth(a,b,x);break;}
 const drift=(fbm(x*.8,z*.9,17)-.5)*.75+(noise2(x*3.7,z*3.7,31)-.5)*.16;
 const tongues=smooth(.51,.72,noise2(x*2.4,z*2.2,67))*.44;
 const notches=smooth(.63,.80,noise2(x*3.7,z*2.9,71))*.18;
 const inside=edge-z+drift+tongues-notches;
 const pocketField=noise2(x*.92,z*.95,43)-(noise2(x*3.6,z*3.2,59)-.5)*.12;
 const sandPocket=smooth(.60,.77,pocketField)*(1.-smooth(.5,2.6,inside));
 return smooth(-.075,.075,inside)*(1.-sandPocket*.94)*smooth(.4,.75,h);
}
export function createTerrain(seed:number):TerrainResources{
  const group=new THREE.Group(), heights=new Float32Array(SIZE*SIZE), masks=new Float32Array(SIZE*SIZE);
  const rocks=rockLayout(seed);
  for(let j=0;j<SIZE;j++)for(let i=0;i<SIZE;i++){
    const x=-16+i/(SIZE-1)*WIDTH,z=-12+j/(SIZE-1)*DEPTH;
    const shore=-1.4+1.05*Math.sin(x*.22)+.48*Math.sin(x*.64+.8);
    const d=shore-z;
    const dune=Math.max(0,Math.min(1,(d-2)/5))*(.7+.65*Math.sin(x*.29+z*.25)**2);
    const ripple=(fbm(x*1.2,z*1.2,seed)-.5)*.022;
    const rawHeight=clamp(d*.24+dune+ripple,-3,3.8),baseHeight=rawHeight>0?rawHeight*.44:rawHeight;
    // Unequal crest anchors follow the native reference silhouette with the fixed camera.
    // Cubic slopes are shape-preserving; this is geometry, with no added noise field.
    const crestProfile=[-16,1.077951,0.000000, -14.2,1.085262,0.008338, -12.8,1.457151,0.195224, -11.25,1.694630,0.184690, -10,1.980097,0.194524, -8.1,2.295960,0.081222, -6.25,2.395675,0.073813, -4.2,2.640644,0.000000, -2.4,2.540710,-0.073997, -0.7,2.353920,0.000000, 1.1,2.383135,0.028774, 2.7,2.562327,0.071045, 4.1,2.636017,0.070996, 5.8,2.828229,0.097111, 7,2.931743,0.000000, 8.1,2.923854,-0.012798, 9.5,2.804564,-0.070638, 11,2.714384,-0.000143, 12.8,2.714259,0.000000, 14.3,2.793009,0.072761, 16,2.999972,0.000000];
    let profileHeight=crestProfile[crestProfile.length-2];
    for(let k=3;k<crestProfile.length;k+=3)if(x<=crestProfile[k]){
      const a=crestProfile[k-3],b=crestProfile[k],u=clamp((x-a)/(b-a),0,1),u2=u*u,u3=u2*u;
      profileHeight=(2*u3-3*u2+1)*crestProfile[k-2]+(u3-2*u2+u)*(b-a)*crestProfile[k-1]+(-2*u3+3*u2)*crestProfile[k+1]+(u3-u2)*(b-a)*crestProfile[k+2];break;
    }
    const crestHeight=Math.max(.92+(profileHeight-.92)*Math.exp(-(((z+12)/5.4)**2)),baseHeight*smooth(-4,0,x));
    const duneVolumes=.46*Math.exp(-(((x+10.7)/3.7)**2+((z+7.5)/1.6)**2))+.34*Math.exp(-(((x+3.2)/3.3)**2+((z+7.6)/1.4)**2));
    // The foreground tide band and other actor sites stay held.
    const landWeight=smooth(.78,.98,baseHeight)*(1-smooth(-10.0,-6.5,z))*(1-smooth(3.0,4.6,x));
    // Shared terrain/rock sampling joins the dry rear ridge to the broad hillside.
    // The height change fades before the unchanged middle/foreground ridge.
    const crestWeight=smooth(.78,.98,baseHeight)*(1-smooth(-10.0,-6.5,z));
    heights[j*SIZE+i]=baseHeight+crestWeight*smooth(5,9,d)*(crestHeight-baseHeight)+landWeight*duneVolumes;
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
  const geometry=new THREE.PlaneGeometry(32,24,256,192);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;const colors=new Float32Array(positions.count*3),moss=new Float32Array(positions.count);
  const sand=new THREE.Color(0xfff4db),wet=new THREE.Color(0xb6a788);
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
  const mossWidth=768,mossDepth=576,mossPixels=new Uint8Array(mossWidth*mossDepth);
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
    vec3 drySand=diffuseColor.r*vec3(.98,1.,.985);
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
    vec3 mossTint=mix(vec3(.145,.139,.013),vec3(.36,.312,.032),fineTone);
    mossTint*=.98+(mossGrain-.5)*mix(.04,.21,mossDensity);
    // Thin cover shows muted mineral ground, while established openings stay white.
    vec3 thinCover=diffuseColor.rgb*vec3(.35,.30,.20);
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
  // Closed, visible tile sides; each upper edge consumes the same height sampler.
  const sideVertices:number[]=[], sideColors:number[]=[];
  const edges=[[-16,-12,16,-12],[16,-12,16,12],[16,12,-16,12],[-16,12,-16,-12]];
  for(const [x0,z0,x1,z1] of edges) for(let k=0;k<128;k++){
    const a=k/128,b=(k+1)/128,xa=x0+(x1-x0)*a,za=z0+(z1-z0)*a,xb=x0+(x1-x0)*b,zb=z0+(z1-z0)*b;
    const points=[[xa,sampleHeight(xa,za),za],[xb,sampleHeight(xb,zb),zb],[xa,-3.5,za],[xb,sampleHeight(xb,zb),zb],[xb,-3.5,zb],[xa,-3.5,za]];
    for(const q of points){sideVertices.push(...q);const c=new THREE.Color(q[1]<-2?0x27221b:0x59432e);c.toArray(sideColors,sideColors.length);}
  }
  const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sideVertices,3));sideGeo.setAttribute('color',new THREE.Float32BufferAttribute(sideColors,3));sideGeo.computeVertexNormals();
  const sideMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});const soil=new THREE.Mesh(sideGeo,sideMat);soil.name='soil-cutaway';soil.receiveShadow=true;group.add(soil);
  const rockResources=createRocks(rocks,sampleHeight);group.add(rockResources.group);
  const bladeGeo=new THREE.PlaneGeometry(.065,.52,1,4);const bp=bladeGeo.attributes.position;for(let i=0;i<bp.count;i++){const h=(bp.getY(i)+.26)/.52;bp.setXYZ(i,bp.getX(i)*(1-h*.96),bp.getY(i),h*h*.11);}bladeGeo.computeVertexNormals();const parts=[0,Math.PI/3,Math.PI*2/3].map(a=>bladeGeo.clone().rotateY(a));const tuftGeo=mergeGeometries(parts);parts.forEach(p=>p.dispose());const bladeMat=new THREE.MeshStandardMaterial({color:0x85936a,roughness:1,side:THREE.DoubleSide,emissive:0x556737,emissiveIntensity:.18});
  const blades=new THREE.InstancedMesh(tuftGeo,bladeMat,1600),dummy=new THREE.Object3D();
  let state=(seed+99)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<1600;i++){
    const x=-15.8+random()*31.6,z=-11.8+random()*6.5,h=sampleHeight(x,z),patch=noise2(x*.48,z*.48,seed),scale=.10+random()*.22;
    dummy.position.set(x,h+.12*scale,z);dummy.scale.setScalar(h>.92&&patch>.43?scale:0);dummy.rotation.set(.2*random(),random()*6.28,.2*random());dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);
    blades.setColorAt(i,new THREE.Color().setHSL(.18+random()*.04,.25,.3+random()*.17));
  }
  blades.instanceMatrix.needsUpdate=true;blades.visible=false;group.add(blades);
  const scaleGeo=new THREE.CapsuleGeometry(.105,.43,6,12),scaleMat=new THREE.MeshStandardMaterial({color:0xeb7735,roughness:.7});const marker=new THREE.Mesh(scaleGeo,scaleMat);marker.position.set(-.5,sampleHeight(-.5,-6.2)+.32,-6.2);marker.castShadow=true;group.add(marker);
  let disposed=false;
  return {group,heightTexture,rockMaskTexture,sampleHeight,updateOptics(time:number,tide:number){optics.coastTime.value=time;optics.coastTide.value=tide;rockResources.updateOptics(tide);},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();textures.dispose();mossTexture.dispose();sideGeo.dispose();sideMat.dispose();bladeGeo.dispose();tuftGeo.dispose();bladeMat.dispose();blades.dispose();rockResources.dispose();scaleGeo.dispose();scaleMat.dispose();heightTexture.dispose();rockMaskTexture.dispose();group.clear();}};
}

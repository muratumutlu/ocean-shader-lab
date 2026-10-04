import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm,noise2} from './textures';
export type Rock={x:number;z:number;radius:number;height:number;angle:number;kind?:'ridge'|'boulder'|'shelf'|'pebble'};
export function rockLayout(seed:number):Rock[]{
 const rocks:Rock[]=[];
 for(let i=0;i<11;i++){const t=i/10;rocks.push({x:10.65-4.0*t+.22*Math.sin(t*8),z:-9.5+11.2*t,radius:1.12+.20*Math.sin(i*2.7+seed),height:.68+.16*Math.sin(i*1.4)**2,angle:.12*Math.sin(i),kind:'ridge'});}
 rocks.push({x:-7.0,z:2.5,radius:1.65,height:2.35,angle:.7,kind:'boulder'},{x:5.76,z:3.61,radius:.60,height:1.95,angle:1.1,kind:'boulder'},{x:-1,z:7,radius:1.1,height:.85,angle:.4,kind:'shelf'},{x:5.2,z:-3.8,radius:1.13,height:.28,angle:.5,kind:'shelf'});
 for(const [x,z,radius,height] of [[-5,-2.5,.4,.45],[-.9,-3.7,.22,.3],[.0,-3.5,.31,.34],[1.1,-3.2,.28,.3],[2,-2.7,.20,.25],[5,.6,.39,.6],[6,.5,.24,.3]])rocks.push({x,z,radius,height,angle:x*.9,kind:'pebble'});
 return rocks;
}
function createLayeredMaterial(tide:{value:number}){
 const material=new THREE.MeshStandardMaterial({color:0xd59a61,roughness:.84});
 material.onBeforeCompile=shader=>{
  shader.uniforms.rockTide=tide;
  shader.vertexShader='varying vec3 vRockWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=`varying vec3 vRockWorld;uniform float rockTide;
  float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float rockFbm(vec3 p){return rockNoise(p)*.57+rockNoise(p*2.07+7.1)*.28+rockNoise(p*4.19-3.2)*.15;}
  float rockLayers(vec3 p){return p.y*4.2+p.x*.92+p.z*1.60+rockFbm(p*.55)*.8+rockNoise(p*3.6)*.12;}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float stoneLayer=rockLayers(vRockWorld);
  float layerTone=rockNoise(vec3(stoneLayer*.85,vRockWorld.x*.35,vRockWorld.z*.35));
  float fragments=rockFbm(vRockWorld*2.4);
  float exposed=rockNoise(vec3(stoneLayer*1.8,vRockWorld.x*.7,vRockWorld.z*.7));
  float palePatch=smoothstep(.66,.82,exposed)*smoothstep(.40,.66,fragments);
  float fissure=(1.-smoothstep(.012,.047,abs(layerTone-.42)))*smoothstep(.45,.70,fragments);
  float fineGrain=rockNoise(vRockWorld*68.)-.5;
  diffuseColor.rgb=mix(vec3(.28,.11,.033),vec3(.52,.285,.11),smoothstep(.20,.85,layerTone));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.61,.44,.24),palePatch*.48);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.043,.018),fissure*.28);
  float lithicGrain=rockFbm(vRockWorld*14.);
  diffuseColor.rgb*=mix(.83,1.14,lithicGrain);
  diffuseColor.rgb+=fineGrain*.017;
  diffuseColor.rgb*=mix(.44,1.,smoothstep(-.06,.20,vRockWorld.y-rockTide));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  roughnessFactor=mix(.36,.87,smoothstep(-.04,.2,vRockWorld.y-rockTide));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  float lithicBump=rockNoise(vec3(rockLayers(vRockWorld)*1.8,vRockWorld.x*.7,vRockWorld.z*.7))*.0035+rockFbm(vRockWorld*27.)*.004+rockNoise(vRockWorld*79.)*.0012;
  vec3 surfaceX=dFdx(-vViewPosition),surfaceY=dFdy(-vViewPosition),bumpR1=cross(surfaceY,normal),bumpR2=cross(normal,surfaceX);
  float bumpDet=dot(surfaceX,bumpR1);
  vec3 bumpGradient=sign(bumpDet)*(dFdx(lithicBump)*bumpR1+dFdy(lithicBump)*bumpR2)/max(abs(bumpDet),.000001);
  normal=normalize(normal-bumpGradient);`);
 };
 return material;
}
function createFragmentedMaterial(tide:{value:number}){
 const material=new THREE.MeshStandardMaterial({color:0xd59a61,roughness:.84});
 material.onBeforeCompile=shader=>{
  shader.uniforms.rockTide=tide;
  shader.vertexShader='varying vec3 vRockWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=`varying vec3 vRockWorld;uniform float rockTide;
  float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float rockFbm(vec3 p){return rockNoise(p)*.57+rockNoise(p*2.07+7.1)*.28+rockNoise(p*4.19-3.2)*.15;}
  float rockLayers(vec3 p){return p.y*4.2+p.x*.92+p.z*1.60+rockFbm(p*.55)*.8+rockNoise(p*3.6)*.12;}
vec4 rockStrataFragments(vec3 p) {
    vec2 plane = vec2(p.x * 1.15 + p.z * .40,
                      p.z * 3.60 - p.x * .55 + p.y * 2.10);
    float warped = plane.y + (rockFbm(p * .72) - .5) * .65;
    warped += (rockNoise(p * 3.8) - .5) * .11;
    float base = floor(warped);
    float pale = 0., seam = 0., relief = 0., tone = 0.;
    for (int j = -1; j <= 1; j++) {
        float k = base + float(j);
        float id = rockHash(vec3(k, 13.7, 4.1));
        float center = k + .19 + id * .59;
        float width = .075 + rockHash(vec3(k, 3.1, 7.4)) * .16;
        float localShift = (rockNoise(vec3(plane.x * .8, k * 1.31, p.y * .55)) - .5) * .16;
        float dist = abs(warped - center - localShift);
        float band = 1. - smoothstep(width * .32, width, dist);
        float segment = rockNoise(vec3(plane.x * 1.15, k * 2.17, p.y * .7));
        float gate = smoothstep(.29, .59, segment);
        float chips = smoothstep(.25, .57, rockNoise(p * 5.9 + vec3(k, 0., 0.)));
        float fragment = band * gate * mix(.45, 1., chips);
        pale = max(pale, fragment);
        float fissure = (1. - smoothstep(.018, .051, abs(warped - center + width * .82)));
        fissure *= smoothstep(.38, .68, segment) * mix(.6, 1., chips);
        seam = max(seam, fissure);
        relief += fragment * (.006 + id * .006) - fissure * .003;
        tone = max(tone, (1. - smoothstep(.20, .58, dist)) * id);
    }
    return vec4(pale, seam, relief, tone);
}
float rockWeatheredFragments(vec3 p){
    vec2 mineralPlane=vec2((p.x*1.15+p.z*.40)*1.6,(p.z*3.60-p.x*.55+p.y*2.10)*.92);
    mineralPlane.y+=(rockFbm(p*.72)-.5)*.24;
    vec2 cell=floor(mineralPlane);float exposure=0.;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec2 id=cell+vec2(float(x),float(y));
        float key=rockHash(vec3(id,5.7));
        vec2 center=vec2(.25)+vec2(rockHash(vec3(id,1.3)),rockHash(vec3(id,9.1)))*.50;
        vec2 q=mineralPlane-id-center;
        float angle=(key-.5)*.40,c=cos(angle),s=sin(angle);
        q=mat2(c,-s,s,c)*q;
        vec2 halfSize=vec2(.34+rockHash(vec3(id,2.8))*.25,.25+rockHash(vec3(id,7.4))*.18);
        float edge=max(abs(q.x)/halfSize.x,abs(q.y)/halfSize.y);
        edge=max(edge,abs(q.x+q.y*.72)/(halfSize.x+halfSize.y*.37));
        edge+=(rockNoise(p*10.7+vec3(id,0.))-.5)*.13;
        float fragment=(1.-smoothstep(.91,1.06,edge))*smoothstep(.10,.27,key);
        exposure=max(exposure,fragment);
    }
    return exposure;
}

  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec4 strata=rockStrataFragments(vRockWorld);
  float baseTone=rockFbm(vRockWorld*1.9);
  diffuseColor.rgb=mix(vec3(.25,.085,.026),vec3(.49,.235,.084),smoothstep(.22,.77,baseTone));
  // Broad weathered mineral exposures cross mesh boundaries; narrow seams stay dark.
  vec3 weatheringField=vec3(vRockWorld.x*3.2+vRockWorld.y*.55,vRockWorld.y*2.7+vRockWorld.z*.8,vRockWorld.z*3.3-vRockWorld.x*.6);
  float continuousWeather=smoothstep(.43,.60,rockFbm(weatheringField+vec3(7.1,1.8,3.4)));
  float directionalWeather=rockWeatheredFragments(vRockWorld)*mix(.42,1.,rockFbm(vRockWorld*8.7));
  float weathered=mix(continuousWeather,directionalWeather,.33);
  float mineralVar=rockFbm(vRockWorld*7.3);
  vec3 exposedOchre=mix(vec3(.61,.267,.075),vec3(.83,.457,.210),smoothstep(.22,.75,mineralVar));
  diffuseColor.rgb=mix(diffuseColor.rgb,exposedOchre,weathered*.84);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.415,.20),strata.x*.38);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.075,.031,.012),strata.y*.50);
  float lithicGrain=rockFbm(vRockWorld*17.);
  diffuseColor.rgb*=mix(.80,1.18,lithicGrain);
  diffuseColor.rgb+=(rockNoise(vRockWorld*79.)-.5)*.013;
  diffuseColor.rgb*=mix(.44,1.,smoothstep(-.06,.20,vRockWorld.y-rockTide));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  roughnessFactor=mix(.36,.87,smoothstep(-.04,.2,vRockWorld.y-rockTide));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  float lithicBump=strata.z+rockFbm(vRockWorld*12.)*.007+rockFbm(vRockWorld*35.)*.003+rockNoise(vRockWorld*79.)*.0012;
  vec3 surfaceX=dFdx(-vViewPosition),surfaceY=dFdy(-vViewPosition),bumpR1=cross(surfaceY,normal),bumpR2=cross(normal,surfaceX);
  float bumpDet=dot(surfaceX,bumpR1);
  vec3 bumpGradient=sign(bumpDet)*(dFdx(lithicBump)*bumpR1+dFdy(lithicBump)*bumpR2)/max(abs(bumpDet),.000001);
  normal=normalize(normal-bumpGradient);`);
 };
 return material;
}

function profileAt(t:number,points:readonly (readonly [number,number])[]){
 for(let i=1;i<points.length;i++)if(t<=points[i][0]){const [a,va]=points[i-1],[b,vb]=points[i];const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return va+(vb-va)*u*u*(3-2*u);}
 return points[points.length-1][1];
}
function createRidge(sampleHeight:(x:number,z:number)=>number){
 const geometry=new THREE.PlaneGeometry(2,1,96,360);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const u=p.getX(i),t=p.getZ(i)+.5,z=-9.5+11.2*t;
  const center=10.65-4.0*t+profileAt(t,[[0,0],[.19,.12],[.39,-.09],[.66,.13],[.87,-.07],[1,0]]);
  const shoulder=profileAt(t,[[0,1],[.16,1],[.32,1.16],[.46,1.32],[.60,1.37],[.73,1.30],[.84,1.23],[.94,1.03],[1,1]]);
  const width=(profileAt(t,[[0,.94],[.08,1.05],[.19,.96],[.28,1.18],[.46,.99],[.57,1.14],[.69,.93],[.86,1.08],[1,.94]])+(noise2(t*23,0,13)-.5)*.05)*shoulder;
  let edgeChip=0;
  for(const [tc,uc,size,depth] of [[.11,-1,.017,.085],[.37,1,.025,.065],[.74,-1,.018,.075],[.93,1,.013,.09]])edgeChip+=depth*Math.exp(-(((t-tc)/size)**2))*Math.max(0,Math.sign(u)*uc);
  // Unequal rooted layer ends break the lower outline without moving the ridge.
  let tongue=0,erosion=0,crestBreak=0;
  const endProfile=(q:number)=>{
   const steps=[[-1,0],[-.80,.48],[-.25,.48],[-.16,.88],[.14,.88],[.25,.39],[.66,.39],[.86,.08],[1,0]];
   if(q<=-1||q>=1)return 0;
   for(let k=1;k<steps.length;k++)if(q<=steps[k][0]){
    const [a,va]=steps[k-1],[b,vb]=steps[k];return va+(vb-va)*(q-a)/(b-a);
   }
   return 0;
  };
  for(const [tc,side,length,reach] of [[.105,1,.015,.19],[.237,-1,.024,.13],[.346,1,.021,.24],[.471,1,.012,.15],[.603,-1,.027,.20],[.718,1,.018,.26],[.831,-1,.014,.16],[.911,1,.025,.22]]){
   const edge=endProfile((t-tc)/length);
   tongue+=edge*reach*THREE.MathUtils.smoothstep(u*side,.81,1);
  }
  for(const [tc,side,length,depth] of [[.183,1,.011,.095],[.297,-1,.014,.070],[.406,1,.010,.110],[.559,1,.016,.082],[.657,-1,.012,.104],[.790,1,.013,.087],[.875,-1,.009,.073]]){
   const notch=endProfile((t-tc)/length);
   erosion+=notch*depth*THREE.MathUtils.smoothstep(u*side,.82,1);
  }
  for(const [tc,length,depth] of [[.172,.016,.052],[.351,.021,.068],[.508,.013,.042],[.703,.018,.074],[.886,.015,.058]]){
   crestBreak+=depth*Math.max(0,1-Math.abs((t-tc)/length))*Math.pow(Math.max(0,1-Math.abs(u)),3);
  }
  const x=center+u*width*(u<0?1.14:.87)*(1-edgeChip*Math.pow(Math.abs(u),8)+tongue-erosion);
  const endFade=Math.min(1,Math.max(0,t/.085),Math.max(0,(1-t)/.12));
  const spine=profileAt(t,[[0,.04],[.23,-.08],[.38,.15],[.60,.07],[.74,-.11],[.88,.10],[1,.03]]);
  const side=u-spine,span=side>0?1-spine:1+spine;
  const cross=Math.pow(Math.max(0,1-Math.abs(side)/span),.84);
  const bed=sampleHeight(x,z);
  // Connected unequal crowns close the measured central-height/width gap.
  const crown=profileAt(t,[[0,0],[.16,0],[.26,.16],[.34,.08],[.45,.19],[.56,.52],[.61,.48],[.68,.22],[.79,.34],[.84,.20],[.93,.02],[1,0]]);
  let height=(.64+crown+Math.max(0,-bed)*.72+(noise2(t*9,1,43)-.5)*.10)*cross*endFade;
  const faultSteps=[.071,.194,.259,.442,.611,.672,.846,.925],faultDepth=[.12,.045,.15,.075,.16,.085,.035,.13];
  for(let k=0;k<faultSteps.length;k++){
   const oblique=.030+.015*Math.sin(k*2.1);
   const phase=t-faultSteps[k]-side*oblique;
   const width=.005+.005*(.5+.5*Math.sin(k*3.7));
   const sideWeight=Math.sin(Math.min(1,Math.abs(side)/span)*Math.PI)*(.50+.50*Math.sin(k*2.7+side*3.2)**2);
   const halfRib=k%3===0?(side<.25?1:.12):k%4===0?(side>-.2?1:.2):1;
   const fracture=Math.exp(-((phase/width)**2));
   height-=faultDepth[k]*fracture*sideWeight*halfRib*endFade;
   height+=.055*Math.exp(-(((phase-.016)/(width*1.5))**2))*sideWeight*halfRib*endFade;
  }
  // Short, overlapping ledges are confined to individual flanks, never full-width blocks.
  const ledges=[
   [.085,.48,.018,.23,.029,.10],[.145,-.42,.025,.31,-.021,.08],
   [.219,.59,.022,.27,.039,.12],[.278,.29,.032,.30,.022,.075],
   [.333,-.56,.017,.25,-.034,.11],[.389,.60,.024,.26,.040,.13],
   [.433,.22,.030,.20,.018,.085],[.485,-.42,.018,.32,-.024,.095],
   [.542,.57,.028,.27,.033,.13],[.596,.27,.021,.22,.044,.10],
   [.632,-.56,.026,.23,-.036,.09],[.694,.52,.016,.29,.021,.11],
   [.753,.30,.025,.26,.034,.075],[.811,-.42,.032,.30,-.018,.10],
   [.869,.61,.018,.22,.040,.12],[.925,.19,.023,.24,.025,.085],
  ];
  for(const [tc,uc,length,span,slant,rise] of ledges){
   const delta=(u-uc)/span;
   const across=Math.pow(Math.max(0,1-delta*delta),.8);
   const taper=Math.max(.05,1-Math.abs(delta));
   const halfWidth=length*.32*(.25+.75*taper);
   const q=t-tc-(u-uc)*slant-(noise2(u*8,tc*11,27)-.5)*.002;
   const slit=1-THREE.MathUtils.smoothstep(Math.abs(q),halfWidth*.16,halfWidth);
   height+=rise*.52*slit*across*cross*endFade;
   height-=rise*.12*Math.exp(-(((q+halfWidth+.001)/.0015)**2))*across*cross*endFade;
  }
  height-=crestBreak*endFade;
  height+=(tongue*.11-erosion*.045)*Math.pow(Math.abs(u),7)*endFade;
  height+=(noise2(x*2.7,z*2.7,31)-.5)*.075*cross*endFade;
  height+=(noise2((bed+height)*8+x*.9+z*1.6,u*1.2,37)-.5)*.025*cross*endFade;
  // Preserve the fractured section while ground intersects its narrowing rear end.
  height-=.45*(1-THREE.MathUtils.smoothstep(t,.08,.28));
  p.setXYZ(i,x,bed+height-.025,z);
 }
 geometry.computeVertexNormals();return geometry;
}
function createBoulder(seed:number){
 const broad=seed===3;
 // Unequal rooted masses share one continuous surface, with an off-center crown.
 const outline:readonly (readonly [number,number])[]=broad?
  [[-1,-.22],[-.61,-.84],[.08,-.93],[.71,-.49],[.97,.20],[.40,.82],[-.25,.94],[-.81,.58]]:
  [[-.85,-.39],[-.31,-.93],[.49,-.73],[.91,-.13],[.60,.71],[-.05,.91],[-.72,.47]];
 type Section=readonly (readonly [number,number])[];
 type Mass={height:number;cx:number;cz:number;sx:number;sz:number;leanX:number;leanZ:number;sections:Section};
 const core:Section=broad?[[0,1],[.31,.95],[.55,.84],[.74,.67],[.88,.40],[1,.08]]:[[0,1],[.25,.96],[.52,.88],[.73,.70],[.90,.43],[1,.24]];
 const shoulders:readonly Mass[]=broad?[
  {height:.62,cx:-.12,cz:.34,sx:.61,sz:.57,leanX:.03,leanZ:-.05,sections:[[0,1],[.25,.96],[.69,.87],[.85,.55],[1,.07]]},
  {height:.79,cx:.11,cz:-.33,sx:.60,sz:.56,leanX:-.06,leanZ:.04,sections:[[0,1],[.35,.96],[.73,.94],[.91,.65],[1,.06]]}
 ]:[
  {height:.64,cx:-.10,cz:.31,sx:.60,sz:.61,leanX:.02,leanZ:-.03,sections:[[0,1],[.30,.98],[.72,.92],[.90,.62],[1,.07]]},
  {height:.83,cx:.08,cz:-.30,sx:.57,sz:.78,leanX:-.01,leanZ:.04,sections:[[0,.76],[.25,.80],[.58,1],[.78,.97],[.86,.73],[1,.08]]}
 ];
 const section=(t:number,points:Section)=>{for(let j=1;j<points.length;j++)if(t<=points[j][0]){const [a,va]=points[j-1],[b,vb]=points[j];return va+(vb-va)*(t-a)/(b-a);}return points[points.length-1][1];};
 // Ray/plane intersections preserve angular faces of each offset shoulder.
 const rayExit=(dx:number,dz:number,cx:number,cz:number,sx:number,sz:number)=>{
  let near=0,far=4;
  for(let j=0;j<outline.length;j++){
   const [ax0,az0]=outline[j],[bx0,bz0]=outline[(j+1)%outline.length];
   const ax=cx+ax0*sx,az=cz+az0*sz,bx=cx+bx0*sx,bz=cz+bz0*sz,nx=bz-az,nz=ax-bx;
   const distance=nx*ax+nz*az,denominator=nx*dx+nz*dz;
   if(Math.abs(denominator)<.000001){if(distance<0)return null;continue;}
   const t=distance/denominator;
   if(denominator>0)far=Math.min(far,t);else near=Math.max(near,t);
   if(far<near)return null;
  }
  return far>=near&&far>0?{near,far}:null;
 };
 const raw=new THREE.CylinderGeometry(.035,1,1,96,64);raw.deleteAttribute('uv');raw.deleteAttribute('normal');const geometry=mergeVertices(raw);raw.dispose();const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),pz=p.getZ(i),h=p.getY(i)+.5,r=Math.hypot(px,pz),dx=r>.00001?px/r:0,dz=r>.00001?pz/r:0;
  const centerX=broad?-.07*h+.025*Math.sin(h*Math.PI*2):-.19*h-.025*Math.sin(h*Math.PI);
  const centerZ=broad?.13*h:.12*h;
  const width=section(h,core),coreScale=broad?.69:.66;
  const centerInterval=rayExit(dx,dz,0,0,width*coreScale,width*(broad?.68:.66));
  let radius=centerInterval?.far??0;
  for(const mass of shoulders){
   if(h>mass.height)continue;
   const t=h/mass.height,s=section(t,mass.sections);
   const interval=rayExit(dx,dz,mass.cx+mass.leanX*t-centerX,mass.cz+mass.leanZ*t-centerZ,mass.sx*s,mass.sz*s);
   if(interval){
    // Tangent intersections fade into the core instead of forming narrow fins.
    const support=THREE.MathUtils.smoothstep(interval.far-interval.near,0,.10);
    radius=Math.max(radius,radius+(interval.far-radius)*support);
   }
  }
  if(r<.00001)radius=0;
  const summitCut=(broad?.025:.055)*(.5+.5*(broad?dz:dx))*Math.pow(h,4);
  p.setXYZ(i,dx*radius+centerX,h-summitCut,dz*radius+centerZ);
 }
 geometry.computeVertexNormals();return geometry;
}
function createShelf(){
 const raw=new THREE.BoxGeometry(2,1,1.4,32,12,24);raw.deleteAttribute('uv');raw.deleteAttribute('normal');const geometry=mergeVertices(raw);raw.dispose();const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const v=new THREE.Vector3(p.getX(i),p.getY(i)+.5,p.getZ(i)),inner=new THREE.Vector3(THREE.MathUtils.clamp(v.x,-.66,.66),THREE.MathUtils.clamp(v.y,.25,.75),THREE.MathUtils.clamp(v.z,-.36,.36));
  const bevel=v.clone().sub(inner).normalize().multiplyScalar(.34);v.copy(inner).add(bevel);
  v.x+=(noise2(v.z*4,v.y*6,17)-.5)*.18;v.z+=(noise2(v.x*4,v.y*7,21)-.5)*.16;v.x*=.94+.08*Math.sin(v.z*4.3+.4);
  v.z*=.92+.06*Math.sin(v.x*6.1+.7);
  v.x-=Math.sign(v.x)*.12*Math.max(0,1-Math.abs(v.z+.16)/.21);
  v.z-=Math.sign(v.z)*.10*Math.max(0,1-Math.abs(v.x-.38)/.22);
  v.y+=v.x*.025+v.z*.06;p.setXYZ(i,v.x,v.y,v.z);
 }
 geometry.computeVertexNormals();return geometry;
}
function createPebble(seed:number){
 const shape=seed===13?0:seed===31?1:2;
 const outlines:readonly (readonly (readonly [number,number])[])[]=[
  [[-.95,-.30],[-.42,-.87],[.44,-.72],[.97,-.08],[.53,.75],[-.35,.91],[-.84,.38]],
  [[-1,-.10],[-.63,-.76],[.17,-.89],[.89,-.42],[.83,.49],[.14,.80],[-.71,.62]],
  [[-.88,-.53],[-.12,-.91],[.71,-.57],[1,.05],[.39,.87],[-.47,.71],[-.96,.13]]
 ];
 const profiles:readonly (readonly (readonly [number,number])[])[]=[
  [[0,.20],[.12,.83],[.28,1],[.53,.87],[.72,.65],[.88,.37],[1,.11]],
  [[0,.24],[.13,.85],[.32,1],[.58,.93],[.76,.64],[.91,.25],[1,.10]],
  [[0,.20],[.10,.77],[.25,.97],[.45,.90],[.65,.78],[.82,.43],[1,.17]]
 ];
 const outline=outlines[shape],sections=profiles[shape];
 const section=(t:number)=>{for(let j=1;j<sections.length;j++)if(t<=sections[j][0]){const [a,va]=sections[j-1],[b,vb]=sections[j];return va+(vb-va)*(t-a)/(b-a);}return sections[sections.length-1][1];};
 const radial=(dx:number,dz:number)=>{let distance=2;for(let j=0;j<outline.length;j++){const [ax,az]=outline[j],[bx,bz]=outline[(j+1)%outline.length],nx=bz-az,nz=ax-bx,denominator=nx*dx+nz*dz;if(denominator>.00001)distance=Math.min(distance,(nx*ax+nz*az)/denominator);}return distance;};
 const geometry=new THREE.SphereGeometry(1,48,32),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),pz=p.getZ(i),h=(p.getY(i)+1)*.5,r=Math.hypot(px,pz),dx=r>.00001?px/r:0,dz=r>.00001?pz/r:0;
  const tiltedH=THREE.MathUtils.clamp(h+[-.075,.10,-.09][shape]*dx*Math.sin(h*Math.PI),0,1);
  const radius=section(tiltedH)*radial(dx,dz);
  const leanX=[.13,-.10,.05][shape]*h,leanZ=[-.08,.04,.14][shape]*h;
  const height=.94*h+[.035,-.025,.04][shape]*dz*Math.sin(h*Math.PI);
  p.setXYZ(i,dx*radius+leanX,height,dz*radius+leanZ);
 }
 geometry.computeVertexNormals();return geometry;
}
function sampleRidgeSurface(geometry:THREE.BufferGeometry,t:number,u:number){
 const p=geometry.attributes.position,n=geometry.attributes.normal,row=THREE.MathUtils.clamp(t,0,1)*360,col=THREE.MathUtils.clamp((u+1)*.5,0,1)*96;
 const j=Math.min(359,Math.floor(row)),i=Math.min(95,Math.floor(col)),a=col-i,b=row-j;
 const indices=[j*97+i,j*97+i+1,(j+1)*97+i,(j+1)*97+i+1],weights=[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b];
 const point=new THREE.Vector3(),normal=new THREE.Vector3();
 indices.forEach((k,index)=>{point.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,k),weights[index]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(n,k),weights[index]);});
 return {point,normal:normal.normalize()};
}
function createFracturePlates(geometry:THREE.BufferGeometry,material:THREE.Material,sampleHeight:(x:number,z:number)=>number){
 const group=new THREE.Group(),geometries:THREE.BufferGeometry[]=[];
 const sites=[
  [.055,-.45,.95,.48,.055,.18],[.095,.44,1.18,.52,.10,-.09],
  [.147,-.57,1.02,.67,.08,.15],[.175,.34,1.38,.45,.13,.21],
  [.228,.72,.75,.54,.075,-.19],[.261,-.30,1.48,.68,.12,.04],
  [.292,.42,1.06,.42,.075,.28],[.333,-.68,.84,.52,.09,-.11],
  [.376,.17,1.47,.72,.14,.18],[.413,.65,.96,.46,.08,-.20],
  [.458,-.35,1.35,.54,.11,.06],[.490,.48,1.18,.78,.15,.23],
  [.535,-.69,.89,.47,.07,-.14],[.576,.14,1.43,.51,.12,.15],
  [.618,.67,1.08,.62,.10,-.09],[.654,-.38,1.22,.46,.075,.24],
  [.704,.43,1.36,.73,.13,.05],[.733,-.73,.88,.52,.085,-.16],
  [.781,.11,1.42,.60,.12,.19],[.827,.62,.97,.47,.08,-.10],
  [.873,-.35,1.34,.70,.14,.12],[.910,.49,1.15,.52,.10,.25],
  [.952,-.52,.85,.42,.065,-.07]
 ];
 // Each site breaks into narrow fragments. A sampled grid follows the curved
 // parent surface; colour remains one continuous mineral field across all pieces.
 sites.forEach(([t,u,siteWidth,siteLength,thickness,angle],i)=>{
  const fragments=2+i%3;
  for(let fragment=0;fragment<fragments;fragment++){
   const id=i*5+fragment;
   const packet=i<8?0:i<16?1:2;
   const width=siteWidth*(.55+.63*noise2(id*.73,4.1,61));
   const layerScale=fragment%3===0?.60:fragment%3===1?1.0:1.65;
   const length=width/(3.8+1.8*noise2(id*.41,2.8,43))*layerScale;

   const clusterOffset=(fragment-(fragments-1)*.5)*siteLength/fragments;
   const centerT=t+clusterOffset/11.2,centerU=u+(noise2(id*.91,0,67)-.5)*.21;
   const dip=[-.10,.13,.30][packet]+(angle-.1)*.55+(noise2(id*.51,1,71)-.5)*.11;

   const acrossSegments=28,alongSegments=12;
   const positions:number[]=[],indices:number[]=[];
   for(let row=0;row<=alongSegments;row++)for(let column=0;column<=acrossSegments;column++){
    const q=column/acrossSegments*2-1,v=row/alongSegments;
    const endTaper=Math.pow(Math.max(0,1-q*q),.38);
    const ragged=(noise2(q*7.1,id*.83,79)-.5)*.28+(noise2(q*17.3,id*.31,83)-.5)*.12;
    const lx=q*width*.5,lz=(v-.5)*length*(.44+.56*endTaper)+ragged*length;
    const rx=lx*Math.cos(dip)-lz*Math.sin(dip),rz=lx*Math.sin(dip)+lz*Math.cos(dip);
    const edgeExtension=[4,9,12,16,19,21].includes(i)?.055:0;
    const parameterU=THREE.MathUtils.clamp(centerU+rx/1.05,-1-edgeExtension,1+edgeExtension);
    const surface=sampleRidgeSurface(geometry,centerT+rz/11.2,parameterU);
    const extra=parameterU-THREE.MathUtils.clamp(parameterU,-1,1);
    surface.point.x+=extra*1.05;
    const groundY=sampleHeight(surface.point.x,surface.point.z);
    // Rear fragments follow the parent section through the ground contact.
    if(centerT+rz/11.2<.28&&surface.point.y<groundY+.003)surface.point.y-=Math.abs(extra)*.28;
    else surface.point.y=Math.max(surface.point.y-Math.abs(extra)*.28,groundY+.003);
    const localHeight=Math.max(.02,surface.point.y-sampleHeight(surface.point.x,surface.point.z));
    const exposed=Math.min(thickness*.32,localHeight*.075,.035);
    const chipped=1-.48*THREE.MathUtils.smoothstep(noise2(q*11,id*.8,89),.56,.77);
    const split=fragment%2===0?1-.92*Math.exp(-(((q-(noise2(id,0,103)-.5)*.8)/.11)**2)):1;

    const ledge=THREE.MathUtils.smoothstep(v,0,.16)*(1-THREE.MathUtils.smoothstep(v,.80,1));
    const warped=(noise2(lx*13,id+v*7,97)-.5)*.0025;
    const relief=(exposed*ledge*endTaper*chipped*split+warped*ledge)-.003;
    surface.point.addScaledVector(surface.normal,relief);
    positions.push(surface.point.x,surface.point.y,surface.point.z);
   }
   for(let row=0;row<alongSegments;row++)for(let column=0;column<acrossSegments;column++){
    const a=row*(acrossSegments+1)+column,b=a+1,c=a+acrossSegments+1,d=c+1;
    indices.push(a,c,b,b,c,d);
   }
   const plateGeometry=new THREE.BufferGeometry();
   plateGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   plateGeometry.setIndex(indices);plateGeometry.computeVertexNormals();geometries.push(plateGeometry);
   const plate=new THREE.Mesh(plateGeometry,material);plate.name='fractured-stratum';
   plate.castShadow=plate.receiveShadow=true;group.add(plate);
  }
 });
 return {group,dispose(){geometries.forEach(g=>g.dispose());group.clear();}};
}
export function createRocks(rocks:Rock[],sampleHeight:(x:number,z:number)=>number){
 const group=new THREE.Group(),tide={value:0},material=createLayeredMaterial(tide),ridgeMaterial=createFragmentedMaterial(tide),plateMaterial=createFragmentedMaterial(tide);plateMaterial.polygonOffset=true;plateMaterial.polygonOffsetFactor=-1;plateMaterial.polygonOffsetUnits=-1;
 const ridgeGeometry=createRidge(sampleHeight);ridgeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(ridgeGeometry.attributes.position.count*3).fill(1),3));const ridge=new THREE.Mesh(ridgeGeometry,ridgeMaterial);ridge.name='layered-ridge';ridge.castShadow=ridge.receiveShadow=true;group.add(ridge);const fracturePlates=createFracturePlates(ridgeGeometry,plateMaterial,sampleHeight);group.add(fracturePlates.group);
 const boulderGeometries=[createBoulder(3),createBoulder(7),createBoulder(11)],shelfGeometry=createShelf(),pebbleGeometries=[createPebble(13),createPebble(31),createPebble(61)];
 rocks.filter(r=>r.kind!=='ridge').forEach((r,i)=>{const geometry=r.kind==='shelf'?shelfGeometry:r.kind==='pebble'?pebbleGeometries[i%3]:boulderGeometries[i%3],mesh=new THREE.Mesh(geometry,material);mesh.position.set(r.x,sampleHeight(r.x,r.z)-.03,r.z);mesh.scale.set(r.radius,r.height,r.radius);mesh.rotation.y=r.angle;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);});
 return {group,updateOptics(value:number){tide.value=value;},dispose(){fracturePlates.dispose();ridgeGeometry.dispose();boulderGeometries.forEach(g=>g.dispose());pebbleGeometries.forEach(g=>g.dispose());shelfGeometry.dispose();material.dispose();ridgeMaterial.dispose();plateMaterial.dispose();group.clear();}};
}

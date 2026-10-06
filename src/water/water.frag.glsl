uniform float uTime,uTide,uSwell,uCaptured,uUnderwater,uOrbitResponse;uniform sampler2D uHeight,uRocks,uSceneColor,uSceneDepth,uRockTransmission;uniform vec3 uSun;uniform vec2 uResolution,uCameraRange;uniform float uOrthographic;varying vec2 vXZ;varying vec3 vWorld,vNormal;varying float vCrest;
float readMap(sampler2D map,vec2 uv){
 vec2 f=clamp(uv,0.0,1.0)*128.0;vec2 cell=floor(f),blend=fract(f),p=(cell+0.5)/129.0,s=vec2(1.0/129.0);
 return mix(mix(texture2D(map,p).r,texture2D(map,p+vec2(s.x,0.0)).r,blend.x),mix(texture2D(map,p+vec2(0.0,s.y)).r,texture2D(map,p+s).r,blend.x),blend.y);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.58+noise(p*2.03+7.1)*.28+noise(p*4.1-3.7)*.14;}
vec2 detailGradient(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));return vec2(mix(b-a,d-c,u.y)*du.x,mix(c-a,d-b,u.x)*du.y);}
vec3 sky(vec3 direction){float horizon=pow(1.0-max(direction.y,0.0),3.0);vec3 col=mix(vec3(.28,.50,.53),vec3(.66,.70,.62),horizon);float s=max(dot(direction,normalize(uSun)),0.0);col+=vec3(1.0,.82,.51)*(pow(s,420.0)*3.0+pow(s,18.0)*.15);return col;}
float viewDepth(float z){float perspective=(uCameraRange.x*uCameraRange.y)/max(uCameraRange.y-z*(uCameraRange.y-uCameraRange.x),.000001);return mix(perspective,mix(uCameraRange.x,uCameraRange.y,z),uOrthographic);}
void main(){
 vec2 uv=(vXZ+vec2(16.0,12.0))/vec2(32.0,24.0);float bed=readMap(uHeight,uv)-max(vXZ.y-12.0,0.0)*.12,depth=max(vWorld.y-bed,0.0);if(vWorld.y-bed<-.012)discard;
 float footprint=max(length(dFdx(vXZ)),length(dFdy(vXZ)));float microFade=1.-smoothstep(.025,.10,footprint);vec3 V=normalize(cameraPosition-vWorld);
 mat2 rotateA=mat2(.83,-.56,.56,.83),rotateB=mat2(.38,-.92,.92,.38);
 vec2 ripples=detailGradient(vXZ*2.8+vec2(-uTime*.34,uTime*.12))*.027;
 ripples+=rotateA*detailGradient(rotateA*vXZ*6.2+vec2(uTime*.19,-uTime*.28))*.015;
 ripples+=rotateB*detailGradient(rotateB*vXZ*11.6+vec2(-uTime*.22,uTime*.36))*.007*microFade;
 // A bounded normal-only response to user orbiting; the physical surface stays unchanged.
 vec2 orbitRipple=vec2(sin(dot(vXZ,vec2(2.1,-1.4))-uTime*1.7),cos(dot(vXZ,vec2(1.3,2.4))+uTime*1.3))*.70710678;
 ripples+=orbitRipple*uOrbitResponse*smoothstep(.04,.45,depth);
 vec3 N=normalize(vNormal+vec3(ripples.x,0,ripples.y));if(!gl_FrontFacing)N=-N;
 float fresnel=.0204+.9796*pow(1.0-max(dot(N,V),0.0),5.0);
 vec2 screenUV=gl_FragCoord.xy/uResolution;float foreground=texture2D(uSceneDepth,screenUV).r;if(uCaptured>.5&&gl_FragCoord.z>foreground+.000004)discard;vec3 viewN=mat3(viewMatrix)*N;vec2 bend=viewN.xy*.010*smoothstep(.03,1.4,depth);vec2 refractedUV=clamp(screenUV+bend,vec2(.002),vec2(.998));if(texture2D(uSceneDepth,refractedUV).r<gl_FragCoord.z)refractedUV=screenUV;
 if(uUnderwater>.5&&!gl_FrontFacing){
  vec3 escape=refract(-V,N,1.333);vec3 reflection=vec3(.08,.30,.29);vec3 color=length(escape)<.001?reflection:mix(sky(escape)*1.45,reflection,fresnel);
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  return;
 }
 // Actual opaque-surface distance varies along submerged rocks, unlike bed depth.
 float opaqueZ=texture2D(uSceneDepth,refractedUV).r;
 float opticalDistance=max(0.,viewDepth(opaqueZ)-viewDepth(gl_FragCoord.z));
 // Static opaque-rock classification is cached with the coast.
 float topExposure=texture2D(uRockTransmission,refractedUV).r;
 float underwaterLod=clamp(log2(1.+opticalDistance*mix(2.7,.60,topExposure)),0.,3.4);
 vec3 floorColor=texture2D(uSceneColor,refractedUV,underwaterLod).rgb;
 // Suppress the captured white wet-rock highlight before water mixing;
 // retain its sampled diffuse hue rather than replacing it with a palette.
 vec3 subduedRock=floorColor/max(1.,max(max(floorColor.r,floorColor.g),floorColor.b)/.45);
 subduedRock-=vec3(min(min(subduedRock.r,subduedRock.g),subduedRock.b)*.30);
 floorColor=mix(floorColor,subduedRock,topExposure);
 vec3 scatteredLight=vec3(.10,.37,.36);
 floorColor=mix(floorColor,scatteredLight,1.-exp(-opticalDistance*mix(.42,.055,topExposure)));
 if(uCaptured<.5)floorColor=vec3(.66,.60,.43);
 float caustic=pow(1.0-abs(sin(vXZ.x*5.0+sin(vXZ.y*3.0+uTime*.7))*sin(vXZ.y*4.7-sin(vXZ.x*2.5-uTime*.65))),17.0);floorColor+=vec3(.002,.003,.004)*caustic*exp(-depth*.65);
 float path=mix(depth/max(dot(V,vec3(0,1,0)),.32),opticalDistance,topExposure);vec3 transmit=exp(-mix(vec3(.52,.22,.23),vec3(.09,.09,.09),topExposure)*path);
 vec3 waterColor=vec3(.08,.30,.29);vec3 color=floorColor*transmit+waterColor*(1.0-transmit);
 vec3 reflection=sky(reflect(-V,N));color=mix(color,reflection,clamp(fresnel,0.0,.96));
 float glint=pow(max(dot(reflect(-normalize(uSun),N),V),0.0),mix(100.0,650.0,microFade));color+=vec3(1.0,.89,.67)*glint*.65;
 float shallow=1.-smoothstep(.025,.25,depth);
 float lace=fbm(vXZ*7.4+vec2(uTime*.20,-uTime*.28)),broad=fbm(vXZ*.85+vec2(uTime*.08,-uTime*.12));
 float front=sin(vXZ.y*2.1+fbm(vXZ*.48)*4.2+sin(vXZ.x*.8)*1.1-uTime*.95);
 // Unequal patches interrupt each front; locally broad cores keep foam cohesive.
 float foamPatches=fbm(vXZ*vec2(.22,.58)+vec2(4.3,-8.1)+vec2(uTime*.06,-uTime*.10));
 float shorePatches=fbm(vXZ*vec2(.43,1.05)+vec2(3.7,-5.1)+vec2(uTime*.04,-uTime*.13));
 float crestCoverage=smoothstep(.36,.60,foamPatches);
 float breaking=smoothstep(.78,.95,front)*crestCoverage*(1.-smoothstep(.68,1.35,depth))*smoothstep(.035,.17,depth);
 // One unequal fan develops and advances with the breaking-wave cycle.
 float fanAge=fract(uTime*.95/6.2831853+.45);
 float fanLife=smoothstep(.10,.28,fanAge)*(1.-smoothstep(.76,.96,fanAge));
 vec2 fanP=vXZ-vec2(0.,(fanAge-.45)*3.);
 vec2 fanRoot=vec2(3.264,1.831),armA=vec2(-4.418,-3.400),armB=vec2(-4.232,1.391),fanLocal=fanP-fanRoot;
 float ta=clamp(dot(fanLocal,armA)/dot(armA,armA),0.,1.),tb=clamp(dot(fanLocal,armB)/dot(armB,armB),0.,1.);
 float wa=.22+.88*pow(max(sin(ta*3.1415927),0.),1.1),wb=.22+1.05*pow(max(sin(tb*3.1415927),0.),.55);
 float ragged=(lace-.5)*.24+(broad-.5)*.20;
 float fa=1.-smoothstep(wa-.12,wa+.12,length(fanLocal-armA*ta)+ragged);
 float fb=1.-smoothstep(wb-.12,wb+.12,length(fanLocal-armB*tb)+ragged);
 float fan=max(fa,fb)*fanLife*(1.-smoothstep(1.2,1.9,depth))*smoothstep(.015,.13,depth);
 // Blue openings erode the whole footprint and can cross its perimeter.
 vec2 erosionDomain=vec2(dot(fanP,vec2(.831,-.556))*.95,dot(fanP,vec2(.556,.831))*.38);
 float coarseOpenings=noise(erosionDomain+vec2(-5.3,9.7)+vec2(uTime*.04,-uTime*.07));
 // Resolved cells and narrow links retain dense fragments inside the held large gaps.
 vec2 cellDomain=vec2(dot(fanP,vec2(.602,.799)),dot(fanP,vec2(-.799,.602)))*9.;
 cellDomain+=vec2(broad-.5,foamPatches-.5)*.65+vec2(-uTime*.18,uTime*.11);
 float cellFootprint=max(length(dFdx(cellDomain)),length(dFdy(cellDomain)));
 float fineFoamFade=1.-smoothstep(.30,.90,cellFootprint);
 float smallCells=fbm(cellDomain+vec2(7.1,-4.3));
 float links=noise(cellDomain*.71+vec2(3.1,-6.4));
 // Unequal density clusters merge selected cells into softly mottled cores.
 float denseClusters=smoothstep(.44,.67,fbm(cellDomain*.17+vec2(4.7,-3.9)));
 // Screen-scale fringes soften individual cells while their cores stay dense.
 float fringeVariation=noise(cellDomain*.43+vec2(-1.6,2.8));
 float cellLow=mix(.43,.28,denseClusters),cellHigh=mix(.56,.46,denseClusters),cellMiddle=(cellLow+cellHigh)*.5;
 float cellSoft=max((cellHigh-cellLow)*.5,fwidth(smallCells)*mix(.65,1.10,fringeVariation));
 float cellCoverage=smoothstep(cellMiddle-cellSoft,cellMiddle+cellSoft,smallCells);
 float fringeOpacity=mix(.56,.95,fringeVariation);
 cellCoverage*=1.-(1.-fringeOpacity)*4.*cellCoverage*(1.-cellCoverage);
 float coreMottling=mix(.82,1.,smoothstep(.27,.68,smallCells));
 cellCoverage*=mix(1.,coreMottling,denseClusters);
 float linkSoft=max(.0375,fwidth(links)*mix(.55,.95,fringeVariation));
 float linkCoverage=1.-smoothstep(.0625-linkSoft,.0625+linkSoft,abs(links-.5));
 linkCoverage*=mix(fringeOpacity,1.,smoothstep(.55,.90,linkCoverage));
 float fineLace=max(cellCoverage,linkCoverage*mix(.75,.65,denseClusters));
 float fanTexture=smoothstep(.27,.46,coarseOpenings)*mix(.56+.26*denseClusters,fineLace,fineFoamFade);
 float surf=shallow*smoothstep(.42,.64,shorePatches)*smoothstep(.27,.62,lace+broad*.12)+max(breaking*smoothstep(.31,.62,lace)*.88,fan*fanTexture*.88);
 float rock=readMap(uRocks,uv),rockFoam=smoothstep(.15,.6,rock)*(1.-smoothstep(.62,.96,rock))*smoothstep(.30,.65,lace)*.62;
 rockFoam*=1.-smoothstep(.55,1.3,depth);float foam=clamp(surf+rockFoam,0.,1.);color=mix(color,vec3(.89,.94,.84),foam*.91);
 gl_FragColor=vec4(color,1);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}

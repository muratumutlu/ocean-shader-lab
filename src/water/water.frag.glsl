uniform float uTime,uTide,uSwell,uCaptured;uniform sampler2D uHeight,uRocks,uSceneColor,uSceneDepth;uniform vec3 uSun;uniform vec2 uResolution;varying vec2 vXZ;varying vec3 vWorld,vNormal;varying float vCrest;
float readMap(sampler2D map,vec2 uv){
 vec2 f=clamp(uv,0.0,1.0)*128.0;vec2 cell=floor(f),blend=fract(f),p=(cell+0.5)/129.0,s=vec2(1.0/129.0);
 return mix(mix(texture2D(map,p).r,texture2D(map,p+vec2(s.x,0.0)).r,blend.x),mix(texture2D(map,p+vec2(0.0,s.y)).r,texture2D(map,p+s).r,blend.x),blend.y);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.58+noise(p*2.03+7.1)*.28+noise(p*4.1-3.7)*.14;}
vec3 sky(vec3 direction){float horizon=pow(1.0-max(direction.y,0.0),3.0);vec3 col=mix(vec3(.22,.49,.78),vec3(.76,.87,.90),horizon);float s=max(dot(direction,normalize(uSun)),0.0);col+=vec3(1.0,.82,.51)*(pow(s,420.0)*3.0+pow(s,18.0)*.15);return col;}
void main(){
 vec2 uv=(vXZ+vec2(16.0,12.0))/vec2(32.0,24.0);float bed=readMap(uHeight,uv)-max(vXZ.y-12.0,0.0)*.12,depth=max(vWorld.y-bed,0.0);if(vWorld.y-bed<-.012)discard;
 float footprint=max(length(dFdx(vXZ)),length(dFdy(vXZ)));float microFade=1.0-smoothstep(.025,.10,footprint);vec3 V=normalize(cameraPosition-vWorld);vec3 N=normalize(vNormal+microFade*vec3((sin(vXZ.x*19.3+vXZ.y*12.7+sin(vXZ.y*2.1)-uTime*3.2)+sin(vXZ.x*7.7-vXZ.y*23.8-uTime*2.4)*.55)*.018,0,(sin(vXZ.y*22.9-vXZ.x*14.1+sin(vXZ.x*1.7)-uTime*2.7)+sin(vXZ.y*11.3+vXZ.x*27.1-uTime*3.7)*.55)*.017));
 float fresnel=.0204+.9796*pow(1.0-max(dot(N,V),0.0),5.0);
 vec2 screenUV=gl_FragCoord.xy/uResolution;float foreground=texture2D(uSceneDepth,screenUV).r;if(uCaptured>.5&&gl_FragCoord.z>foreground+.000004)discard;vec3 viewN=mat3(viewMatrix)*N;vec2 bend=viewN.xy*.010*smoothstep(.03,1.4,depth);vec2 refractedUV=clamp(screenUV+bend,vec2(.002),vec2(.998));if(texture2D(uSceneDepth,refractedUV).r<gl_FragCoord.z)refractedUV=screenUV;
 vec3 floorColor=texture2D(uSceneColor,refractedUV).rgb;
 if(uCaptured<.5)floorColor=vec3(.66,.60,.43);
 float caustic=pow(1.0-abs(sin(vXZ.x*5.0+sin(vXZ.y*3.0+uTime*.7))*sin(vXZ.y*4.7-sin(vXZ.x*2.5-uTime*.65))),17.0);floorColor+=vec3(.06,.073,.045)*caustic*exp(-depth*.65);
 float path=depth/max(dot(V,vec3(0,1,0)),.32);vec3 transmit=exp(-vec3(.43,.105,.075)*path);
 vec3 waterColor=vec3(.018,.29,.30);vec3 color=floorColor*transmit+waterColor*(1.0-transmit);
 vec3 reflection=sky(reflect(-V,N));color=mix(color,reflection,clamp(fresnel,0.0,.96));
 float glint=pow(max(dot(reflect(-normalize(uSun),N),V),0.0),mix(100.0,650.0,microFade));color+=vec3(1.0,.89,.67)*glint*.65;
 float shallow=1.0-smoothstep(.025,.27,depth),front=sin(vXZ.y*3.1+fbm(vXZ*.42)*2.0-uTime*.95);
 float lace=fbm(vXZ*5.8+vec2(uTime*.2,-uTime*.28));float surf=shallow*smoothstep(.35,.72,lace+front*.15);
 float rock=readMap(uRocks,uv),rockFoam=smoothstep(.15,.6,rock)*(1.0-smoothstep(.62,.96,rock))*smoothstep(.42,.7,lace)*.45;
 rockFoam*=1.0-smoothstep(.55,1.3,depth);float foam=clamp(surf+rockFoam,0.0,1.0);color=mix(color,vec3(.88,.93,.92),foam*.86);
 gl_FragColor=vec4(color,1);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}

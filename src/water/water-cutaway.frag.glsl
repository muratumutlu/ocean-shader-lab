uniform float uTime,uTide,uSwell;
uniform sampler2D uHeight,uSceneColor,uSceneDepth,uBedVertexColor,uBedMap;
uniform vec2 uResolution,uBedColorSize,uBedMapRepeat;
uniform vec3 uSun;
varying vec2 edgeXZ;
varying float edgeY;
varying vec3 edgeWorld;
/* WAVE_CODE */

float bedAt(vec2 p){return readMap(uHeight,(p+vec2(16.,12.))/vec2(32.,24.));}
vec3 cutNormal(){return abs(edgeWorld.z-12.)<.001?vec3(0.,0.,1.):vec3(sign(edgeWorld.x),0.,0.);}

// Trace through the finite water footprint until its actual terrain bed.
// The cut plane exposes a volume: vertical depth alone is not its optical path.
float volumePath(vec3 entry,vec3 direction,out bool reachesBed){
 vec2 remaining=mix(vec2(-16.,-12.),vec2(16.,12.),step(vec2(0.),direction.xz))-entry.xz;
 vec2 bounds=remaining/(direction.xz+sign(direction.xz)*.00001);
 float limit=min(min(bounds.x,bounds.y),48.),previous=0.;reachesBed=false;
 for(int i=1;i<=12;i++){
  float distance=limit*float(i)/12.;vec3 p=entry+direction*distance;
  if(p.y<=bedAt(p.xz)){
   float low=previous,high=distance;
   for(int j=0;j<5;j++){float middle=(low+high)*.5;vec3 q=entry+direction*middle;if(q.y>bedAt(q.xz))low=middle;else high=middle;}
   vec3 a=entry+direction*low,b=entry+direction*high;
   float fa=a.y-bedAt(a.xz),fb=b.y-bedAt(b.xz);
   reachesBed=true;return mix(low,high,clamp(fa/max(fa-fb,.00001),0.,1.));
  }
  previous=distance;
 }
 return limit;
}
vec3 skyLight(vec3 direction){
 float horizon=pow(1.-max(direction.y,0.),3.);
 return mix(vec3(.12,.18,.26),vec3(.34,.41,.47),horizon);
}
void main(){
 float bed=bedAt(edgeXZ);if(bed>uTide||edgeY<bed-.02)discard;
 vec2 screenUV=gl_FragCoord.xy/uResolution;
 if(texture2D(uSceneDepth,screenUV).r<gl_FragCoord.z-.000004)discard;
 vec3 normal=cutNormal(),incident=normalize(edgeWorld-cameraPosition);
 vec3 direction=normalize(refract(incident,normal,1./1.333));
 vec3 entry=edgeWorld-normal*.002;bool reachesBed;
 float path=max(volumePath(entry,direction,reachesBed),.001);
 vec3 endpoint=entry+direction*path;
 const vec3 bedExtinction=vec3(.90,.50,.42);
 const vec3 absorption=vec3(.50,.16,.095);
 const float particleScattering=.32,anisotropy=.75;
 const vec3 extinction=absorption+vec3(particleScattering);
 // Diffuse daylight is redistributed, rather than lost with the direct beam.
 vec3 diffuseAttenuation=sqrt(3.*absorption*(absorption+vec3(particleScattering*(1.-anisotropy))));
 vec3 sun=normalize(uSun),integral=vec3(0.);
 float cosine=dot(sun,direction);
 float sunPhase=(1.-anisotropy*anisotropy)/(12.5663706*pow(1.+anisotropy*anisotropy-2.*anisotropy*cosine,1.5));
 vec2 bedUV=(endpoint.xz+vec2(16.,12.))/vec2(32.,24.);
 vec2 colorUV=(clamp(bedUV,0.,1.)*(uBedColorSize-1.)+.5)/uBedColorSize;
 float floorDepth=max(uTide-endpoint.y,0.);
 float combinedPath=path+floorDepth/max(sun.y,.25);
 float scatterBlur=clamp(log2(1.+combinedPath*3.),0.,4.8);
 vec3 albedo=texture2D(uBedVertexColor,colorUV).rgb*texture2D(uBedMap,vec2(bedUV.x,1.-bedUV.y)*uBedMapRepeat,scatterBlur).rgb;
 vec2 slope=vec2(bedAt(endpoint.xz+vec2(.06,0.))-bedAt(endpoint.xz-vec2(.06,0.)),bedAt(endpoint.xz+vec2(0.,.06))-bedAt(endpoint.xz-vec2(0.,.06)))/.12;
 vec3 bedNormal=normalize(vec3(-slope.x,1.,-slope.y));
 // Dry coast radiance would omit attenuation on the incoming light path.
 vec3 floorDirect=vec3(.95,.99,1.04)*max(dot(bedNormal,sun),0.)*exp(-bedExtinction*floorDepth/max(sun.y,.25));
 vec3 floorDiffuse=vec3(.25,.30,.35)*exp(-bedExtinction*floorDepth*1.7);
 vec3 transmitted=albedo*(floorDirect+floorDiffuse);
 if(!reachesBed)transmitted=texture2D(uSceneColor,screenUV,3.).rgb;
 float segment=path/8.;
 for(int i=0;i<8;i++){
  float distance=(float(i)+.5)*segment;vec3 p=entry+direction*distance;
  float localBed=bedAt(p.xz),waveHeight;vec2 gradient;
  waves(p.xz,smoothstep(0.,1.1,uTide-localBed),waveHeight,gradient);
  float topDepth=max(uTide+waveHeight-p.y,0.);
  vec3 surfaceNormal=normalize(vec3(-gradient.x,1.,-gradient.y));
  vec3 direct=vec3(1.,.8796,.7084)*3.4*sunPhase*max(dot(surfaceNormal,sun),0.)*exp(-extinction*topDepth/max(sun.y,.25));
  vec3 skyAverage=mix(skyLight(surfaceNormal),skyLight(vec3(1.,0.,0.)),.55);
  vec3 diffuse=skyAverage*.40*exp(-diffuseAttenuation*topDepth);
  integral+=exp(-extinction*distance)*particleScattering*(direct+diffuse)*segment;
 }
 vec3 color=transmitted*exp(-bedExtinction*path)+integral;
 float fresnel=.0204+.9796*pow(1.-max(dot(normal,-incident),0.),5.);
 color=mix(color,skyLight(reflect(incident,normal)),fresnel*.35);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}

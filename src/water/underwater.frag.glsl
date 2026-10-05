uniform sampler2D uFinalColor,uSceneDepth,uHeight;
uniform vec2 uOutputResolution;
uniform mat4 uInverseProjection,uCameraWorld;
uniform float uTime,uSwell,uTide;
/* WAVE_CODE */
vec3 pointAt(vec2 uv,float z){vec4 p=uInverseProjection*vec4(uv*2.-1.,z*2.-1.,1.);return (uCameraWorld*vec4(p.xyz/p.w,1.)).xyz;}
float exitDistance(vec3 origin,vec3 ray){
 vec3 safe=vec3(abs(ray.x)<.00001?.00001:ray.x,abs(ray.y)<.00001?.00001:ray.y,abs(ray.z)<.00001?.00001:ray.z);
 vec2 limit=(mix(vec2(-16.,-12.),vec2(16.,12.),step(vec2(0.),ray.xz))-origin.xz)/safe.xz;
 float distance=min(min(limit.x,limit.y),80.);
 if(ray.y>.00001)distance=min(distance,max(0.,(uTide+.24-origin.y)/ray.y));
 return max(0.,distance);
}
void main(){
 vec2 uv=gl_FragCoord.xy/uOutputResolution;vec3 eye=uCameraWorld[3].xyz,farPoint=pointAt(uv,1.),ray=normalize(farPoint-eye);
 float z=texture2D(uSceneDepth,uv).r;vec3 opaque=pointAt(uv,z);float path=min(length(opaque-eye),exitDistance(eye,ray));
 // Resolve the first actual surface/bed exit, never a global screen tint.
 float previous=0.;for(int i=1;i<=20;i++){
  float t=path*float(i)/20.;vec3 p=eye+ray*t;float bed=readMap(uHeight,(p.xz+vec2(16.,12.))/vec2(32.,24.));float h;vec2 g;waves(p.xz,smoothstep(0.,1.1,uTide-bed),h,g);
  if(p.y>uTide+h||p.y<bed){float low=previous,high=t;for(int j=0;j<6;j++){float mid=(low+high)*.5;vec3 q=eye+ray*mid;float b=readMap(uHeight,(q.xz+vec2(16.,12.))/vec2(32.,24.));waves(q.xz,smoothstep(0.,1.1,uTide-b),h,g);if(q.y>uTide+h||q.y<b)high=mid;else low=mid;}path=(low+high)*.5;break;}previous=t;
 }
 vec3 beam=exp(-vec3(.32,.11,.055)*max(path,0.));vec3 source=texture2D(uFinalColor,uv).rgb;
 vec3 color=source*beam+vec3(.055,.19,.23)*(1.-beam);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}

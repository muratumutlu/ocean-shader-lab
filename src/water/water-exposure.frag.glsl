uniform sampler2D uHeight,uSceneDepth;
uniform vec2 uResolution,uCameraRange;
uniform float uOrthographic;
uniform mat4 uInverseProjection,uCameraWorld;
float readMap(sampler2D map,vec2 uv){
 vec2 f=clamp(uv,0.0,1.0)*128.0;vec2 cell=floor(f),blend=fract(f),p=(cell+0.5)/129.0,s=vec2(1.0/129.0);
 return mix(mix(texture2D(map,p).r,texture2D(map,p+vec2(s.x,0.0)).r,blend.x),mix(texture2D(map,p+vec2(0.0,s.y)).r,texture2D(map,p+s).r,blend.x),blend.y);
}
float viewDepth(float z){float perspective=(uCameraRange.x*uCameraRange.y)/max(uCameraRange.y-z*(uCameraRange.y-uCameraRange.x),.000001);return mix(perspective,mix(uCameraRange.x,uCameraRange.y,z),uOrthographic);}
vec3 capturedViewPoint(vec2 uv,float z){vec4 p=uInverseProjection*vec4(uv*2.-1.,z*2.-1.,1.);return p.xyz/max(p.w,.000001);}
void main(){
 vec2 screenUV=gl_FragCoord.xy/uResolution;
 float opaqueZ=texture2D(uSceneDepth,screenUV).r;
 vec3 opaqueView=capturedViewPoint(screenUV,opaqueZ);
 vec3 opaqueWorld=(uCameraWorld*vec4(opaqueView,1.)).xyz;
 // Neighbour positions use stable depth texel centres, avoiding refracted
 // screen derivatives turning cap/flank transitions into isolated pixels.
 vec2 centerUV=(floor(screenUV*uResolution)+.5)/uResolution;
 float centerZ=texture2D(uSceneDepth,centerUV).r;
 vec2 rightUV=centerUV+vec2(1./uResolution.x,0.),upUV=centerUV+vec2(0.,1./uResolution.y);
 float rightZ=texture2D(uSceneDepth,rightUV).r,upZ=texture2D(uSceneDepth,upUV).r;
 vec3 centerView=capturedViewPoint(centerUV,centerZ);
 vec3 rightView=capturedViewPoint(rightUV,rightZ),upView=capturedViewPoint(upUV,upZ);
 vec3 opaqueNormal=normalize(mat3(uCameraWorld)*cross(rightView-centerView,upView-centerView));
 float depthContinuity=1.-smoothstep(.055,.16,max(abs(viewDepth(rightZ)-viewDepth(centerZ)),abs(viewDepth(upZ)-viewDepth(centerZ))));
 float raised=max(0.,opaqueWorld.y-readMap(uHeight,(opaqueWorld.xz+vec2(16.,12.))/vec2(32.,24.)));
 // Raised horizontal tops remain legible; deep flanks retain stronger extinction.
 float capExposure=smoothstep(.45,.72,raised)*smoothstep(.82,.98,abs(opaqueNormal.y));
 // Low raised rocks retain a faint connected shoulder below their top.
 // This tapers to zero toward the bed, preserving the deep-base extinction.
 float upperVolume=smoothstep(.30,.78,raised)*(1.-smoothstep(1.10,1.60,raised));
 gl_FragColor=vec4(max(capExposure,upperVolume*.55)*depthContinuity,0.,0.,1.);
}

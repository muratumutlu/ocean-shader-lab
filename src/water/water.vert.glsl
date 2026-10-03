uniform float uTime,uSwell,uTide;uniform sampler2D uHeight;varying vec2 vXZ;varying vec3 vWorld,vNormal;varying float vCrest;
float readMap(sampler2D map,vec2 uv){
 vec2 f=clamp(uv,0.0,1.0)*128.0;vec2 cell=floor(f),blend=fract(f),p=(cell+0.5)/129.0,s=vec2(1.0/129.0);
 return mix(mix(texture2D(map,p).r,texture2D(map,p+vec2(s.x,0.0)).r,blend.x),mix(texture2D(map,p+vec2(0.0,s.y)).r,texture2D(map,p+s).r,blend.x),blend.y);
}
void wave(vec2 direction,float frequency,float speed,float amplitude,vec2 p,inout float h,inout vec2 g){
 float w1=p.x*.17+p.y*.11,w2=p.y*.23-p.x*.09;float q=dot(direction,p)*frequency+sin(w1)*.8+sin(w2)*.7-uTime*speed;h+=sin(q)*amplitude;g+=(direction*frequency+vec2(.17,.11)*cos(w1)*.8+vec2(-.09,.23)*cos(w2)*.7)*cos(q)*amplitude;
}
void waves(vec2 p,float fade,out float h,out vec2 g){
 h=0.0;g=vec2(0.0);float a=(.028+uSwell*.11)*fade;
 wave(normalize(vec2(.22,-1.0)),.85,1.1,a,p,h,g);
 wave(normalize(vec2(-.61,-1.0)),1.75,1.62,a*.47,p,h,g);
 wave(normalize(vec2(.81,-.5)),3.5,1.92,a*.23,p,h,g);
 
 
}

void main(){vec2 p=position.xz,uv=(p+vec2(16.0,12.0))/vec2(32.0,24.0);float bed=readMap(uHeight,uv)-max(p.y-12.0,0.0)*.12;float h;vec2 g;waves(p,smoothstep(.0,1.1,uTide-bed),h,g);vec3 q=vec3(p.x,uTide+h,p.y);vXZ=p;vWorld=q;vCrest=h;vNormal=normalize(vec3(-g.x,1.0,-g.y));gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.0);}

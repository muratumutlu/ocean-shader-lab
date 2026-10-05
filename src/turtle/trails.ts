import * as THREE from 'three';
import type {TurtleState} from './state';
import type {CoveResources} from '../scene/cove';
export function createTurtleTrails(cove:Pick<CoveResources,'sampleHeight'|'sampleNormal'>&Partial<Pick<CoveResources,'heightTexture'>>){
 const capacity=96,geometry=new THREE.PlaneGeometry(1,1,8,12),metadata=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);
 geometry.setAttribute('imprint',metadata);
 // Borrow the shared height map; the cove owns its lifetime. Small subdivided
 // stamps conform to the same bilinear terrain as physics rather than planar cuts.
 const uniforms={uNow:{value:0},uTide:{value:0},uHeight:{value:cove.heightTexture??null},uHasHeight:{value:cove.heightTexture?1:0}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false,
  vertexShader:`attribute vec3 imprint; uniform sampler2D uHeight; uniform float uHasHeight;
   varying vec2 vUv,vWorldXZ; varying vec3 vImprint; varying float vSoilY;
   float heightAt(vec2 xz){vec2 p=clamp((xz/vec2(32.,24.)+.5)*128.,vec2(0.),vec2(128.)),a=floor(p),b=min(a+1.,vec2(128.)),f=fract(p);
    float h00=texture2D(uHeight,(a+.5)/129.).r,h10=texture2D(uHeight,(vec2(b.x,a.y)+.5)/129.).r,h01=texture2D(uHeight,(vec2(a.x,b.y)+.5)/129.).r,h11=texture2D(uHeight,(b+.5)/129.).r;
    return mix(mix(h00,h10,f.x),mix(h01,h11,f.x),f.y);}
   void main(){vUv=uv;vImprint=imprint;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);if(uHasHeight>.5)world.y=heightAt(world.xz)+.004;vWorldXZ=world.xz;vSoilY=world.y;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform float uNow,uTide; varying vec2 vUv,vWorldXZ; varying vec3 vImprint; varying float vSoilY;
   void main(){vec2 p=vUv*2.-1.;float grain=fract(sin(dot(floor(vWorldXZ*170.),vec2(12.9898,78.233)))*43758.5453);
    float segment=step(2.5,vImprint.y),kind=vImprint.y-segment*3.,rear=step(.5,kind)*(1.-step(1.5,kind)),body=step(1.5,kind);
    float bend=vImprint.z*(.40*p.y*p.y-.14*p.y-.13),comma=length(vec2((p.x-bend)/(.62-.17*p.y),p.y*.88));
    float r=mix(length(vec2(p.x*(1.+.15*p.y),p.y)),comma,rear);
    float wave=sin(vWorldXZ.y*8.3+vWorldXZ.x*2.1)*.12;r=mix(r,length(vec2((p.x+wave)*1.06,p.y*.69)),body);
    r=mix(r,length(vec2(p.x,max(abs(p.y)-.70,0.)*4.)),segment);
    float edge=1.-smoothstep(.50,.98,r+.045*(grain-.5)),age=1.-smoothstep(45.,150.,uNow-vImprint.x),dry=smoothstep(uTide+.035,uTide+.105,vSoilY);
    float ridge=exp(-pow((r-.73)*11.,2.)),groove=exp(-pow((r-.58)*8.,2.)),strength=mix(mix(.085,.32,rear),.115,body);
    float alpha=edge*age*dry*strength*(.73+.27*groove);if(alpha<.006)discard;
    vec3 soil=mix(vec3(.10,.071,.033),vec3(.31,.26,.17),ridge*.64);soil+=.028*(grain-.5);gl_FragColor=vec4(soil,alpha);}`});
 const mesh=new THREE.InstancedMesh(geometry,material,capacity),group=new THREE.Group();mesh.name='turtle-sand-imprints';mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=1;group.name='turtle-sand-trails';group.add(mesh);
 let cursor=0,disposed=false,emitted=0,lastBody:THREE.Vector3|null=null;const plants=new Map<string,string>(),lastContact=new Map<string,THREE.Vector3>(),point=new THREE.Vector3(),up=new THREE.Vector3(),right=new THREE.Vector3(),along=new THREE.Vector3(),matrix=new THREE.Matrix4(),orientation=new THREE.Quaternion();
 function imprint(x:number,z:number,heading:number,width:number,length:number,now:number,kind:number,side:number=0){
  const y=cove.sampleHeight(x,z),n=cove.sampleNormal(x,z);up.set(n.x,n.y,n.z).normalize();right.set(Math.cos(heading),0,-Math.sin(heading)).projectOnPlane(up).normalize();along.crossVectors(up,right).normalize();orientation.setFromRotationMatrix(matrix.makeBasis(right,along,up));
  point.set(x,y+.005,z);matrix.compose(point,orientation,new THREE.Vector3(width,length,1));mesh.setMatrixAt(cursor,matrix);metadata.setXYZ(cursor,now,kind,side);mesh.visible=true;cursor=(cursor+1)%capacity;mesh.count=Math.min(capacity,mesh.count+1);mesh.instanceMatrix.needsUpdate=true;metadata.needsUpdate=true;emitted++;
 }
 return {group,update(state:TurtleState,now:number,tide:number){
  if(disposed)return;uniforms.uNow.value=now;uniforms.uTide.value=tide;
  if(state.previousLocomotion!=='crawl'||state.transition>.35){lastBody=null;lastContact.clear();return;}
  const activeContacts=new Set<string>();
  for(const foot of state.feet){
   const rear=foot.limb==='rear',key=(rear?'rear':'front')+foot.side,soil=cove.sampleHeight(foot.position.x,foot.position.z),grounded=foot.stance||foot.position.y-soil<.032;
   activeContacts.add(key);
   if(!grounded||soil<=tide+.08){lastContact.delete(key);continue;}
   if(foot.stance&&plants.get(key)!==foot.plantId){
    plants.set(key,foot.plantId);imprint(foot.position.x,foot.position.z,state.heading+foot.side*(rear?.48:.35),rear?.34:.145,rear?.46:.25,now,rear?1:0,foot.side);
   }
   const p=new THREE.Vector3(foot.position.x,foot.position.y,foot.position.z),last=lastContact.get(key),distance=last?Math.hypot(p.x-last.x,p.z-last.z):0;
   if(last&&distance>.035&&distance<.14)imprint((p.x+last.x)/2,(p.z+last.z)/2,Math.atan2(p.x-last.x,p.z-last.z),rear?.16:.10,distance/.70,now,rear?4:3,foot.side);
   if(!last||distance>.035)lastContact.set(key,p);
  }
  for(const key of lastContact.keys())if(!activeContacts.has(key))lastContact.delete(key);
  const p=new THREE.Vector3(state.position.x,state.position.y,state.position.z);
  if(state.position.y-cove.sampleHeight(p.x,p.z)-.10*state.groundNormal.y<.085&&cove.sampleHeight(p.x,p.z)>tide+.08){
   const distance=lastBody?Math.hypot(p.x-lastBody.x,p.z-lastBody.z):0;
   if(lastBody&&distance>.08&&distance<.22)imprint((p.x+lastBody.x)/2,(p.z+lastBody.z)/2,Math.atan2(p.x-lastBody.x,p.z-lastBody.z),.48,distance/.70,now,5);
   if(!lastBody||distance>.08)lastBody=p;
  }else lastBody=null;
 },reset(){if(disposed)return;mesh.count=0;mesh.visible=false;cursor=0;plants.clear();lastContact.clear();lastBody=null;},diagnostics(){return {active:mesh.count,capacity,emitted,disposed,terrainConforming:!!cove.heightTexture,trianglesPerInstance:geometry.index!.count/3};},dispose(){if(disposed)return;disposed=true;mesh.dispose();geometry.dispose();material.dispose();group.clear();plants.clear();lastContact.clear();lastBody=null;}};
}

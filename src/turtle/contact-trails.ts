import * as THREE from 'three';
import type {TurtleContactFrame,TurtleSkinContact} from '../runtime/turtle-contact-motion';
import type {CoveResources} from '../scene/cove';

export const CONTACT_TRAIL_LIMITS=Object.freeze({capacity:144,minimumSegment:.025,maximumSegment:.15,maximumFrameGap:.2,minimumGap:-.002,maximumGap:.012,samePlantRadius:.12});
type History={plantId:string;stamped:boolean;point:THREE.Vector3|null};
const finitePoint=(p:{x:number;y:number;z:number})=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);

/** Original, bounded sand marks from observed skinned contacts only. Owns its
 * mesh/geometry/material; the optional terrain texture remains owned by the cove.
 */
export function createContactTrails(cove:Pick<CoveResources,'sampleHeight'|'sampleNormal'>&Partial<Pick<CoveResources,'heightTexture'>>){
 const {capacity}=CONTACT_TRAIL_LIMITS,geometry=new THREE.PlaneGeometry(1,1,8,12);
 const imprintData=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);geometry.setAttribute('imprint',imprintData);
 const uniforms={uNow:{value:0},uTide:{value:0},uHeight:{value:cove.heightTexture??null},uHasHeight:{value:cove.heightTexture?1:0}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false,
  vertexShader:`attribute vec3 imprint;uniform sampler2D uHeight;uniform float uHasHeight;
   varying vec2 vUv,vWorldXZ;varying vec3 vImprint;varying float vSoilY;
   float heightAt(vec2 xz){vec2 p=clamp((xz/vec2(32.,24.)+.5)*128.,vec2(0.),vec2(128.)),a=floor(p),b=min(a+1.,vec2(128.)),f=fract(p);
    float h00=texture2D(uHeight,(a+.5)/129.).r,h10=texture2D(uHeight,(vec2(b.x,a.y)+.5)/129.).r,h01=texture2D(uHeight,(vec2(a.x,b.y)+.5)/129.).r,h11=texture2D(uHeight,(b+.5)/129.).r;
    return mix(mix(h00,h10,f.x),mix(h01,h11,f.x),f.y);}
   void main(){vUv=uv;vImprint=imprint;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);if(uHasHeight>.5)world.y=heightAt(world.xz)+.004;vWorldXZ=world.xz;vSoilY=world.y;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform float uNow,uTide;varying vec2 vUv,vWorldXZ;varying vec3 vImprint;varying float vSoilY;
   void main(){vec2 p=vUv*2.-1.;float segment=step(1.5,vImprint.y),rear=mod(vImprint.y,2.);
    float grain=fract(sin(dot(floor(vWorldXZ*155.),vec2(12.9898,78.233)))*43758.5453);
    float curve=vImprint.z*(.23*p.y*p.y-.09*p.y),width=mix(.70,.78,rear)-.12*p.y;
    float r=length(vec2((p.x-curve)/width,p.y*.92));r=mix(r,length(vec2(p.x,max(abs(p.y)-.70,0.)*4.)),segment);
    float edge=1.-smoothstep(.52,.99,r+.035*(grain-.5));float age=1.-smoothstep(45.,150.,max(0.,uNow-vImprint.x));
    float dry=smoothstep(uTide+.035,uTide+.105,vSoilY),ridge=exp(-pow((r-.77)*12.,2.)),groove=exp(-pow((r-.55)*8.,2.));
    float alpha=edge*age*dry*mix(.22,.32,rear)*(.78+.22*groove);if(alpha<.006)discard;
    vec3 soil=mix(vec3(.11,.078,.039),vec3(.34,.28,.18),ridge*.62)+.020*(grain-.5);gl_FragColor=vec4(soil,alpha);}`});
 const mesh=new THREE.InstancedMesh(geometry,material,capacity),group=new THREE.Group();
 mesh.name='turtle-observed-contact-imprints';mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=1;group.name='turtle-contact-trails';group.add(mesh);
 const history=new Map<string,History>(),stampMemory=new Map<string,{plantId:string;position:THREE.Vector3}>(),matrix=new THREE.Matrix4(),orientation=new THREE.Quaternion(),up=new THREE.Vector3(),right=new THREE.Vector3(),along=new THREE.Vector3();
 let cursor=0,emitted=0,stamps=0,segments=0,rejectedContacts=0,disposed=false,paused=false,resumeBreak=false,lastTime:number|null=null;
 function imprint(x:number,z:number,heading:number,width:number,length:number,now:number,kind:number,side:number){
  const soil=cove.sampleHeight(x,z),normal=cove.sampleNormal(x,z);if(!Number.isFinite(soil)||!finitePoint(normal))return false;
  up.set(normal.x,normal.y,normal.z);if(up.lengthSq()<1e-8||up.y<=0)return false;up.normalize();
  along.set(Math.sin(heading),0,Math.cos(heading)).projectOnPlane(up);if(along.lengthSq()<1e-8)return false;along.normalize();right.crossVectors(along,up).normalize();
  orientation.setFromRotationMatrix(matrix.makeBasis(right,along,up));matrix.compose(new THREE.Vector3(x,soil+.005,z),orientation,new THREE.Vector3(width,length,1));
  mesh.setMatrixAt(cursor,matrix);imprintData.setXYZ(cursor,now,kind,side);cursor=(cursor+1)%capacity;mesh.count=Math.min(capacity,mesh.count+1);mesh.visible=true;
  mesh.instanceMatrix.needsUpdate=true;imprintData.needsUpdate=true;emitted++;if(kind<2)stamps++;else segments++;return true;
 }
 function accepted(contact:TurtleSkinContact,tide:number){
  const key=contact.limb+contact.side;
  if(!['front','rear'].includes(contact.limb)||![-1,1].includes(contact.side)||contact.key!==key||typeof contact.plantId!=='string'||!contact.plantId||contact.plantId.length>128||
   !finitePoint(contact.position)||!finitePoint(contact.skinPosition)||!Number.isFinite(contact.heading)||!Number.isFinite(contact.gap)||!Number.isFinite(contact.minimumLimbGap)||
   !Number.isInteger(contact.samples)||contact.samples<1||contact.gap<CONTACT_TRAIL_LIMITS.minimumGap||contact.gap>CONTACT_TRAIL_LIMITS.maximumGap||contact.minimumLimbGap<CONTACT_TRAIL_LIMITS.minimumGap)return false;
  const soil=cove.sampleHeight(contact.position.x,contact.position.z);return Number.isFinite(soil)&&soil>tide+.08;
 }
 const setTide=(tide:number)=>{if(!disposed&&Number.isFinite(tide))uniforms.uTide.value=tide;};
 return {group,setTide,
  update(frame:TurtleContactFrame){
   if(disposed)return;
   // Tide controls remain responsive while simulation and imprint age are paused.
   setTide(frame.tide);
   if(paused||frame.paused){resumeBreak=true;return;}
   if(!Number.isFinite(frame.time)||!Number.isFinite(frame.tide)){history.clear();lastTime=null;resumeBreak=true;return;}
   const dt=lastTime===null?null:frame.time-lastTime,broken=resumeBreak||frame.discontinuity||dt!==null&&(dt<0||dt>CONTACT_TRAIL_LIMITS.maximumFrameGap);
   const advance=dt===null||dt>0,canEmit=advance&&!broken;resumeBreak=false;lastTime=frame.time;
   uniforms.uNow.value=frame.time;
   if(broken)for(const previous of history.values())previous.point=null;
   const seen=new Set<string>();
   // Four limb contacts bound both per-frame work and retained contact history.
   for(const contact of frame.contacts.slice(0,4)){
    if(seen.has(contact.key))continue;
    if(!accepted(contact,frame.tide)){rejectedContacts++;continue;}seen.add(contact.key);
    const rear=contact.limb==='rear',position=new THREE.Vector3(contact.position.x,contact.position.y,contact.position.z);
    let previous=history.get(contact.key);
    if(!previous||previous.plantId!==contact.plantId){
     const remembered=stampMemory.get(contact.key),stamped=!!remembered&&remembered.plantId===contact.plantId&&Math.hypot(position.x-remembered.position.x,position.z-remembered.position.z)<=CONTACT_TRAIL_LIMITS.samePlantRadius;
     // Contact dropout breaks drag continuity, but does not invent another plant.
     previous={plantId:contact.plantId,stamped,point:null};history.set(contact.key,previous);
    }
    if(canEmit&&!previous.stamped){previous.stamped=imprint(position.x,position.z,contact.heading,rear?.19:.13,rear?.29:.25,frame.time,rear?1:0,contact.side);if(previous.stamped)stampMemory.set(contact.key,{plantId:contact.plantId,position:position.clone()});previous.point=position;continue;}
    const last=previous.point,distance=last?Math.hypot(position.x-last.x,position.z-last.z):0;
    if(canEmit&&previous.stamped&&last&&distance>=CONTACT_TRAIL_LIMITS.minimumSegment&&distance<CONTACT_TRAIL_LIMITS.maximumSegment){
     // A segment must also be dry at its center, not only its endpoints.
     const x=(position.x+last.x)/2,z=(position.z+last.z)/2;
     if(cove.sampleHeight(x,z)>frame.tide+.08)imprint(x,z,Math.atan2(position.x-last.x,position.z-last.z),rear?.105:.075,distance/.70,frame.time,rear?3:2,contact.side);
    }
    if(!last||broken||advance&&distance>=CONTACT_TRAIL_LIMITS.minimumSegment)previous.point=position;
   }
   for(const key of history.keys())if(!seen.has(key))history.delete(key);
  },
  setPaused(value:boolean){if(disposed)return;if(value!==paused)resumeBreak=true;paused=value;},
  reset(){if(disposed)return;mesh.count=0;mesh.visible=false;cursor=emitted=stamps=segments=rejectedContacts=0;history.clear();stampMemory.clear();lastTime=null;resumeBreak=false;},
  diagnostics(){return {active:mesh.count,capacity,emitted,stamps,segments,rejectedContacts,trackedContacts:history.size,rememberedStamps:stampMemory.size,paused,disposed,terrainConforming:!!cove.heightTexture,trianglesPerInstance:geometry.index!.count/3};},
  dispose(){if(disposed)return;disposed=true;history.clear();stampMemory.clear();mesh.dispose();geometry.dispose();material.dispose();group.clear();},
 };
}

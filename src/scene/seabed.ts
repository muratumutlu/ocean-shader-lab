import * as THREE from 'three';
import type {QualityProfile} from '../types';
import {sampleGrid,type CoveData,type Vec3} from './cove-data';

export type SeabedKind='star'|'spiral'|'valve';
export type SeabedProp={id:number;kind:SeabedKind;x:number;y:number;z:number;scale:number;angle:number;variation:number;radius:number};
export type SeabedPropRange={id:number;kind:SeabedKind;start:number;end:number;indexStart:number;indexEnd:number;aperture?:{center:Vec3;direction:Vec3;radius:number;depth:number}};
type Shape={positions:number[];colors:number[];indices:number[];aperture?:{center:THREE.Vector3;direction:THREE.Vector3;radius:number;depth:number}};
const TAU=Math.PI*2;
function randomSource(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

/** Original small benthic forms, kept outside the complete turtle and rock footprints. */
export function createSeabedLayout(seed:number,data:CoveData):SeabedProp[]{
 const random=randomSource((seed>>>0)^0x5ea8ed),layout:SeabedProp[]=[];
 const kinds:SeabedKind[]=[...Array<SeabedKind>(6).fill('star'),...Array<SeabedKind>(4).fill('spiral'),...Array<SeabedKind>(12).fill('valve')];
 for(const kind of kinds){
  const scale=kind==='star'?.30+random()*.12:kind==='spiral'?.25+random()*.09:.19+random()*.09;
  const radius=scale*1.16;let found=false;
  for(let attempt=0;attempt<1600;attempt++){
   const x=-9.4+random()*18.8,z=-1.8+random()*9.3,y=sampleGrid(data,x,z);
   if(y>-.38||y<-1.7||Math.abs(x-1.2)<2.08+radius)continue;
   if(data.shoreRoute.some(p=>Math.hypot(x-p.x,z-p.z)<2.05+radius))continue;
   if(data.rocks.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+radius+.25))continue;
   if(layout.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+radius+.14))continue;
   // Check the shoreward edge as well as the center; a shell must remain submerged.
   if(Array.from({length:8},(_,i)=>sampleGrid(data,x+radius*Math.cos(i*TAU/8),z+radius*Math.sin(i*TAU/8))).some(h=>h>-.19||h<-1.88))continue;
   layout.push({id:layout.length,kind,x,y,z,scale,angle:random()*TAU,variation:random()*TAU,radius});found=true;break;
  }
  if(!found)throw new Error(`No clear submerged seabed position for ${kind}; cove layout is incompatible.`);
 }
 return layout;
}
function shape():Shape{return {positions:[],colors:[],indices:[]};}
function vertex(s:Shape,x:number,y:number,z:number,color:THREE.Color){const i=s.positions.length/3;s.positions.push(x,y,z);s.colors.push(color.r,color.g,color.b);return i;}
function quad(s:Shape,a:number,b:number,c:number,d:number,reverse=false){s.indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));}
function tint(base:THREE.Color,amount:number){return base.clone().multiplyScalar(amount);}

// A single closed body: unequal curved arms, a raised central disc and radial crests.
function starShape(variation:number,low:boolean):Shape{
 const s=shape(),n=low?30:150,topRings=low?3:14,bottomRings=low?2:4;
 const base=new THREE.Color().setHSL(.055+.026*Math.sin(variation),.48,.43);
 const smooth=(a:number,b:number,v:number)=>{const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 const point=(r:number,a:number,top:boolean)=>{
  const sector=TAU/5,delta=a-Math.round(a/sector)*sector;
  // Rounded triangular rays taper continuously from a broad central disc.
  // The polar intersection of the arm sides avoids five bulbous petal tips.
  const side=Math.sqrt(Math.sin(delta)**2+.0016)-.04;
  const outline=.29/(side+.29*Math.cos(delta))*(.94+.045*Math.sin(3*a+variation)+.025*Math.cos(2*a-variation));
  const distance=r*outline,theta=a+.065*Math.sin(2*a+variation)*r*r;
  const disc=.134-.016*Math.min(distance/.30,1)**2;
  const arm=.115*(1-.75*THREE.MathUtils.clamp((distance-.26)/.74,0,1));
  const blend=smooth(.22,.40,distance),cross=distance*Math.sin(delta);
  const keel=.007*Math.exp(-((cross/.045)**2))*smooth(.26,.42,distance)*(1-r);
  const height=top?.023+((1-blend)*disc+blend*arm)*Math.sqrt(Math.max(0,1-r**6))+keel:.023-.011*Math.sqrt(Math.max(0,1-r*r));
  return [distance*Math.cos(theta),height,distance*Math.sin(theta)] as const;
 };
 const topCenter=vertex(s,0,.157,0,tint(base,1.04)),top:number[][]=[];
 for(let j=1;j<=topRings;j++){
  const ring:number[]=[];for(let i=0;i<n;i++){const a=i*TAU/n,r=Math.sin(j/topRings*Math.PI/2);ring.push(vertex(s,...point(r,a,true),tint(base,.96+.050*Math.cos(5*a)*r+.040*Math.sin(3*a+variation)*Math.sin(Math.PI*r))));}top.push(ring);
 }
 for(let i=0;i<n;i++)s.indices.push(topCenter,top[0][(i+1)%n],top[0][i]);
 for(let j=1;j<top.length;j++)for(let i=0;i<n;i++)quad(s,top[j-1][i],top[j-1][(i+1)%n],top[j][(i+1)%n],top[j][i]);
 const bottomCenter=vertex(s,0,.012,0,tint(base,.65)),bottom:number[][]=[];
 for(let j=1;j<bottomRings;j++){
  const ring:number[]=[];for(let i=0;i<n;i++)ring.push(vertex(s,...point(j/bottomRings,i*TAU/n,false),tint(base,.70)));bottom.push(ring);
 }
 bottom.push(top.at(-1)!);
 for(let i=0;i<n;i++)s.indices.push(bottomCenter,bottom[0][i],bottom[0][(i+1)%n]);
 for(let j=1;j<bottom.length;j++)for(let i=0;i<n;i++)quad(s,bottom[j-1][i],bottom[j][i],bottom[j][(i+1)%n],bottom[j-1][(i+1)%n]);
 return s;
}

// A compact rising spire feeds into an enlarged final body whorl. Successive
// whorls meet at their shoulders; the oval aperture retains a real inner wall.
function spiralShape(variation:number,low:boolean):Shape{
 const s=shape(),steps=low?26:112,sides=low?8:24,rings:number[][][]=[[],[]];
 const base=new THREE.Color().setHSL(.085+.018*Math.sin(variation),.28,.63);
 const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.43);
 const center=(t:number)=>{const r=Math.exp(2.75*(t-1)),a=t*TAU*2.12;return new THREE.Vector3(Math.cos(a)*r*.56,.48*(1-r),Math.sin(a)*r*.56);};
 const section=(t:number)=>{
  const c=center(t),ahead=center(Math.min(1,t+.0001)),behind=center(Math.max(0,t-.0001));
  const tangent=ahead.sub(behind).normalize(),radial=new THREE.Vector3(c.x,0,c.z).normalize();
  radial.addScaledVector(tangent,-radial.dot(tangent)).normalize();
  const up=new THREE.Vector3().crossVectors(tangent,radial).normalize();
  return {c,tangent,radial,up,r:Math.exp(2.75*(t-1))*.40};
 };
 for(let inner=0;inner<2;inner++)for(let j=0;j<=steps;j++){
  const t=j/steps,{c,tangent,radial,up,r}=section(t),ring:number[]=[];
  if(inner&&j===0)c.addScaledVector(tangent,.003);
  for(let i=0;i<sides;i++){
   const a=i*TAU/sides,wall=inner?.028:0;
   // Raised growth increments bend across the whorl; broad spiral cords carry
   // the shell's sculpture without turning the whole chamber into a rippled tube.
   const increment=Math.max(0,Math.sin(t*TAU*18+.55*Math.sin(a)+variation))**4;
   const cords=.012*Math.cos(4*a+.35*Math.sin(t*TAU));
   const growth=1+(.028*increment+cords)*(inner?.12:1),rr=(r-wall*Math.exp(2.75*(t-1)))*growth;
   const lipReach=t**16*(.032*(.55+.45*Math.cos(a-.5))+.022*Math.max(0,-Math.sin(a))**8);
   const p=c.clone().addScaledVector(radial,Math.cos(a)*rr*(1+.065*Math.sin(a))).addScaledVector(up,Math.sin(a)*rr*(1.13-.065*Math.cos(a))).addScaledVector(tangent,lipReach).applyQuaternion(tilt);
   const band=.86+.10*Math.sin(t*TAU*5.6+variation)+.045*increment+.030*Math.cos(4*a);
   ring.push(vertex(s,p.x,p.y,p.z,inner?new THREE.Color(0xcbbdaf).multiplyScalar(.94+.05*Math.cos(a)):tint(base,band)));
  }rings[inner].push(ring);
 }
 for(let inner=0;inner<2;inner++)for(let j=0;j<steps;j++)for(let i=0;i<sides;i++)quad(s,rings[inner][j][i],rings[inner][j][(i+1)%sides],rings[inner][j+1][(i+1)%sides],rings[inner][j+1][i],!!inner);
 const end=section(1),lipNormal=end.tangent.clone().applyQuaternion(tilt),outer=rings[0][steps],inner=rings[1][steps];
 let previous=outer;const lipSegments=low?1:3;
 for(let j=1;j<=lipSegments;j++){
  const t=j/lipSegments,next:number[]=[];
  for(let i=0;i<sides;i++){
   if(j===lipSegments){next.push(inner[i]);continue;}
   const a=outer[i]*3,b=inner[i]*3,p=new THREE.Vector3().fromArray(s.positions,a).lerp(new THREE.Vector3().fromArray(s.positions,b),t).addScaledVector(lipNormal,.015*Math.sin(Math.PI*t));
   const color=new THREE.Color().fromArray(s.colors,a).lerp(new THREE.Color().fromArray(s.colors,b),t);
   next.push(vertex(s,p.x,p.y,p.z,color));
  }
  for(let i=0;i<sides;i++)quad(s,previous[i],previous[(i+1)%sides],next[(i+1)%sides],next[i]);previous=next;
 }
 // Two separate end floors close the apex with finite mineral thickness.
 const apex=section(0),outerFloor=vertex(s,...apex.c.clone().applyQuaternion(tilt).toArray() as [number,number,number],base);
 const innerFloor=vertex(s,...apex.c.clone().addScaledVector(apex.tangent,.003).applyQuaternion(tilt).toArray() as [number,number,number],base);
 for(let i=0;i<sides;i++)s.indices.push(outerFloor,rings[0][0][(i+1)%sides],rings[0][0][i],innerFloor,rings[1][0][i],rings[1][0][(i+1)%sides]);
 s.aperture={center:end.c.clone().applyQuaternion(tilt),direction:end.tangent.clone().applyQuaternion(tilt),radius:.21,depth:.22};
 return s;
}

// A thick, open valve: concave inner nacre, convex exterior, radial flutes and a
// pinched hinge. Both surfaces share a connected, scalloped mineral edge.
function valveShape(variation:number,low:boolean):Shape{
 const s=shape(),n=low?20:96,ringsCount=low?2:8,surfaces:number[][][]=[[],[]];
 const base=new THREE.Color().setHSL(.075+.025*Math.sin(variation),.25,.66);
 for(let inner=0;inner<2;inner++){
  const c=vertex(s,0,inner?.057:.014,-.24,inner?new THREE.Color(0xe2d8c5):base),rings:number[][]=[];
  for(let j=1;j<=ringsCount;j++){
   const r=j/ringsCount,ring:number[]=[];
   for(let i=0;i<n;i++){
    const a=i*TAU/n,flute=Math.cos(14*a+.4*Math.sin(a)+variation)*(.86+.14*Math.cos(3*a-variation)),hinge=Math.max(0,-Math.sin(a))**10;
    const growth=Math.sin(r*TAU*3+.4*Math.sin(a)+variation),edge=1+.020*flute*r*r;
    // An offset umbo and shortened hinge spread the ribs into a fan. The outer
    // growth steps remain backed by a separate, smoother nacre surface.
    const x=Math.cos(a)*.80*r*(.78+.22*Math.sin(a))*edge,z=-.24*(1-r)+Math.sin(a)*r*(.93-.20*hinge)*edge;
    const y=.014+.28*r**1.65+(inner?.043:0)+(inner?.017:.030)*flute*r**1.4+.006*growth*Math.sin(Math.PI*r)*(inner?.35:1)+.025*hinge*r*r;
    const color=inner?new THREE.Color(0xe2d8c5).multiplyScalar(.90+.065*Math.sin(a*3+r*4)+.025*growth):tint(base,.84+.115*flute+.060*growth);
    ring.push(vertex(s,x,y,z,color));
   }rings.push(ring);
  }
  for(let i=0;i<n;i++)s.indices.push(...(inner?[c,rings[0][(i+1)%n],rings[0][i]]:[c,rings[0][i],rings[0][(i+1)%n]]));
  for(let j=1;j<ringsCount;j++)for(let i=0;i<n;i++)quad(s,rings[j-1][i],rings[j][i],rings[j][(i+1)%n],rings[j-1][(i+1)%n],!!inner);
  surfaces[inner]=rings;
 }
 const outer=surfaces[0].at(-1)!,inner=surfaces[1].at(-1)!;
 // Round the mineral lip with actual cross-section rings, retaining an open cup.
 let previous=outer;const lipSegments=low?1:3;
 for(let j=1;j<=lipSegments;j++){
  const t=j/lipSegments,next:number[]=[];
  for(let i=0;i<n;i++){
   if(j===lipSegments){next.push(inner[i]);continue;}
   const a=outer[i]*3,b=inner[i]*3,x=s.positions[a],z=s.positions[a+2],radius=Math.hypot(x,z),bulge=.012*Math.sin(Math.PI*t);
   const color=new THREE.Color().fromArray(s.colors,a).lerp(new THREE.Color().fromArray(s.colors,b),t);
   next.push(vertex(s,x+x/radius*bulge,s.positions[a+1]*(1-t)+s.positions[b+1]*t,z+z/radius*bulge,color));
  }
  for(let i=0;i<n;i++)quad(s,previous[i],next[i],next[(i+1)%n],previous[(i+1)%n]);previous=next;
 }

 s.aperture={center:new THREE.Vector3(0,.33,0),direction:new THREE.Vector3(0,1,0),radius:.42,depth:.20};return s;
}
function orientOutward(s:Shape){
 let volume=0;const p=s.positions;
 for(let i=0;i<s.indices.length;i+=3){const a=s.indices[i]*3,b=s.indices[i+1]*3,c=s.indices[i+2]*3;volume+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);}
 if(volume<0)for(let i=0;i<s.indices.length;i+=3)[s.indices[i+1],s.indices[i+2]]=[s.indices[i+2],s.indices[i+1]];
}
function makeMesh(layout:SeabedProp[],data:CoveData,low:boolean,material:THREE.MeshStandardMaterial):THREE.Mesh{
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],ranges:SeabedPropRange[]=[];
 for(const prop of layout){
  const s=prop.kind==='star'?starShape(prop.variation,low):prop.kind==='spiral'?spiralShape(prop.variation,low):valveShape(prop.variation,low);orientOutward(s);
  const dx=(sampleGrid(data,prop.x+.12,prop.z)-sampleGrid(data,prop.x-.12,prop.z))/.24,dz=(sampleGrid(data,prop.x,prop.z+.12)-sampleGrid(data,prop.x,prop.z-.12))/.24;
  const normal=new THREE.Vector3(-dx,1,-dz).normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),prop.angle));
  const points:THREE.Vector3[]=[];let minGap=Infinity;
  for(let i=0;i<s.positions.length;i+=3){const p=new THREE.Vector3(s.positions[i],s.positions[i+1],s.positions[i+2]).multiplyScalar(prop.scale).applyQuaternion(rotation).add(new THREE.Vector3(prop.x,prop.y,prop.z));points.push(p);minGap=Math.min(minGap,p.y-sampleGrid(data,p.x,p.z));}
  const lift=.002-minGap,start=positions.length/3,indexStart=indices.length;
  for(const p of points)positions.push(p.x,p.y+lift,p.z);colors.push(...s.colors);for(const i of s.indices)indices.push(i+start);
  const range:SeabedPropRange={id:prop.id,kind:prop.kind,start,end:positions.length/3,indexStart,indexEnd:indices.length};
  if(s.aperture){const a=s.aperture,c=a.center.clone().multiplyScalar(prop.scale).applyQuaternion(rotation).add(new THREE.Vector3(prop.x,prop.y+lift,prop.z));range.aperture={center:{x:c.x,y:c.y,z:c.z},direction:a.direction.clone().applyQuaternion(rotation),radius:a.radius*prop.scale,depth:a.depth*prop.scale};}ranges.push(range);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,material);mesh.name=`seabed-${layout[0].kind==='star'?'stars':'shells'}-${low?'low':'high'}`;mesh.userData.propRanges=ranges;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function createSeabedProps(seed:number,data:CoveData){
 const layout=createSeabedLayout(seed,data),group=new THREE.Group();group.name='cove-seabed-props';
 const starMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83}),shellMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65});
 const stars=layout.filter(p=>p.kind==='star'),shells=layout.filter(p=>p.kind!=='star');
 const high=[makeMesh(stars,data,false,starMaterial),makeMesh(shells,data,false,shellMaterial)],low=[makeMesh(stars,data,true,starMaterial),makeMesh(shells,data,true,shellMaterial)];group.add(...high,...low);
 let disposed=false;const setQuality=(profile:QualityProfile)=>{if(disposed)return;high.forEach(m=>m.visible=profile!=='low');low.forEach(m=>m.visible=profile==='low');};setQuality('balanced');
 const triangles=(meshes:THREE.Mesh[])=>meshes.reduce((sum,m)=>sum+m.geometry.index!.count/3,0);
 return {group,layout,metadata:{triangles:{high:triangles(high),low:triangles(low)},materials:2,counts:{star:6,spiral:4,valve:12},original:true},setQuality,dispose(){if(disposed)return;disposed=true;for(const mesh of [...high,...low])mesh.geometry.dispose();starMaterial.dispose();shellMaterial.dispose();group.clear();}};
}

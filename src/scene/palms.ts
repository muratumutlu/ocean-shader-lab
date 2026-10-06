import * as THREE from 'three';

type Surface={positions:number[];colors:number[];indices:number[]};
type PalmSpec={x:number;z:number;trunkHeight:number;reach:number;leanX:number;leanZ:number;phase:number};
const UP=new THREE.Vector3(0,1,0),TAU=Math.PI*2;
const PALMS:readonly PalmSpec[]=[
 {x:-7,z:-8.5,trunkHeight:3.90,reach:2.78,leanX:-.30,leanZ:.12,phase:.38},
 {x:-3,z:-9.5,trunkHeight:3.65,reach:2.48,leanX:-.25,leanZ:.32,phase:2.17},
 {x:-5,z:-6.8,trunkHeight:3.35,reach:2.57,leanX:.24,leanZ:.10,phase:4.41},
];
const surface=():Surface=>({positions:[],colors:[],indices:[]});
function vertex(s:Surface,p:THREE.Vector3,color:THREE.Color){
 const index=s.positions.length/3;s.positions.push(p.x,p.y,p.z);s.colors.push(color.r,color.g,color.b);return index;
}
function quad(s:Surface,a:number,b:number,c:number,d:number){s.indices.push(a,b,c,a,c,d);}

/** A capped tube with smoothly transported cross-sections. Bark scars vary its
 * actual radius; the frond spines use the same small, tapered section builder.
 */
function tube(s:Surface,curve:(t:number)=>THREE.Vector3,radius:(t:number,a:number)=>number,color:(t:number,a:number)=>THREE.Color,steps:number,sides:number){
 const start=s.positions.length/3;
 let previousAxis:THREE.Vector3|null=null;
 for(let j=0;j<=steps;j++){
  const t=j/steps,center=curve(t),tangent=curve(Math.min(1,t+.0001)).sub(curve(Math.max(0,t-.0001))).normalize();
  const axis:THREE.Vector3=previousAxis?previousAxis.clone().addScaledVector(tangent,-previousAxis.dot(tangent)):new THREE.Vector3().crossVectors(Math.abs(tangent.y)>.8?new THREE.Vector3(1,0,0):UP,tangent);
  axis.normalize();const across=new THREE.Vector3().crossVectors(tangent,axis).normalize();previousAxis=axis;
  for(let i=0;i<sides;i++){
   const a=i/sides*TAU,r=radius(t,a),p=center.clone().addScaledVector(axis,Math.cos(a)*r).addScaledVector(across,Math.sin(a)*r);
   vertex(s,p,color(t,a));
  }
 }
 for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){
  const a=start+j*sides+i,b=start+j*sides+(i+1)%sides,c=a+sides,d=b+sides;quad(s,a,b,d,c);
 }
 const root=vertex(s,curve(0),color(0,0)),tip=vertex(s,curve(1),color(1,0)),last=start+steps*sides;
 for(let i=0;i<sides;i++)s.indices.push(root,start+(i+1)%sides,start+i,tip,last+i,last+(i+1)%sides);
}

/** Each pinnate leaflet has its own drooping centreline and a folded blade.
 * Four interior sections, a pointed root and a pointed tip give five curved
 * spans, without alpha cards or a filled fan connecting neighbouring leaves.
 */
function leaflet(s:Surface,start:THREE.Vector3,forward:THREE.Vector3,lateral:THREE.Vector3,side:number,length:number,width:number,phase:number,color:THREE.Color){
 const sweep=.40+.055*Math.sin(phase),droop=.76+.10*Math.cos(phase*.7);
 const curve=(t:number)=>start.clone()
  .addScaledVector(lateral,side*length*.83*(t-.12*t*t))
  .addScaledVector(forward,length*(sweep*t+.08*t*t))
  .addScaledVector(UP,length*(.12*Math.sin(Math.PI*t)-droop*t*t));
 const root=vertex(s,curve(0),color.clone().multiplyScalar(.89)),rings:number[][]=[];
 for(let j=1;j<=4;j++){
  const t=j/5,tangent=curve(t+.0001).sub(curve(t-.0001)).normalize();
  const axis=new THREE.Vector3().crossVectors(UP,tangent).normalize().applyAxisAngle(tangent,side*(.10+.22*t*Math.sin(phase)));
  const normal=new THREE.Vector3().crossVectors(tangent,axis).normalize(),p=curve(t),halfWidth=width*Math.sin(Math.PI*t)**.82;
  const tint=color.clone().lerp(new THREE.Color(0xa4d2b5),t*.15),row:number[]=[];
  row.push(vertex(s,p.clone().addScaledVector(axis,-halfWidth),tint.clone().multiplyScalar(.96)));
  row.push(vertex(s,p.clone().addScaledVector(normal,.011*length*Math.sin(Math.PI*t)),tint.clone().multiplyScalar(1.04)));
  row.push(vertex(s,p.clone().addScaledVector(axis,halfWidth*(.94+.035*Math.sin(phase))),tint));rings.push(row);
 }
 const first=rings[0];s.indices.push(root,first[0],first[1],root,first[1],first[2]);
 for(let j=1;j<rings.length;j++)for(let k=0;k<2;k++)quad(s,rings[j-1][k],rings[j][k],rings[j][k+1],rings[j-1][k+1]);
 const tip=vertex(s,curve(1),color.clone().lerp(new THREE.Color(0xa4d2b5),.18)),last=rings.at(-1)!;
 s.indices.push(last[0],tip,last[1],last[1],tip,last[2]);
}

function buildPalm(wood:Surface,foliage:Surface,palm:PalmSpec,ground:number){
 const bark=new THREE.Color(0xb68950),mint=new THREE.Color(0x82ba9d),base=ground-.055;
 const trunk=(t:number)=>new THREE.Vector3(
  palm.x+palm.leanX*t*t+.065*Math.sin(Math.PI*t)*Math.sin(palm.phase),
  base+palm.trunkHeight*t,
  palm.z+palm.leanZ*t*t+.045*Math.sin(Math.PI*t)*Math.cos(palm.phase),
 );
 tube(wood,trunk,(t,a)=>{
  const scar=(.5+.5*Math.cos(t*TAU*18+palm.phase))**6;
  return (.080+.047*(1-t)+.022*(1-t)**12)*(1+.017*Math.sin(3*a+palm.phase))+.0045*scar;
 },(t,a)=>{
  const scar=(.5+.5*Math.cos(t*TAU*18+palm.phase))**6;
  return bark.clone().multiplyScalar(.97-.10*scar+.035*Math.sin(a*3+palm.phase+t*5));
 },72,12);
 const crown=trunk(1);
 for(let frond=0;frond<10;frond++){
  const phase=palm.phase+frond*2.3999632297,upper=frond>=6;
  const radial=new THREE.Vector3(Math.cos(phase),0,Math.sin(phase)),lateral=new THREE.Vector3().crossVectors(UP,radial).normalize();
  const reach=palm.reach*(upper?.86:1)*(.96+.04*Math.sin(phase*1.7));
  const rise=upper?.69:.88,droop=(upper?.49:1.05)*(.94+.07*Math.cos(phase));
  const root=crown.clone().addScaledVector(radial,.025).addScaledVector(UP,upper?.065:0);
  const spine=(t:number)=>root.clone().addScaledVector(radial,reach*t)
   .addScaledVector(lateral,.10*Math.sin(phase*.7)*Math.sin(Math.PI*t)*t)
   .addScaledVector(UP,rise*Math.sin(Math.PI*t)-droop*t*t);
  const leafColor=mint.clone().multiplyScalar(.94+.065*Math.sin(phase*1.3));
  tube(foliage,spine,t=>.006+.025*(1-t)**1.25,t=>leafColor.clone().lerp(bark,(1-t)**5*.40),10,5);
  for(let pair=0;pair<10;pair++)for(const side of [-1,1]){
   const t=.13+pair*.081+side*.009*Math.sin(phase+pair),length=(.34+.69*Math.sin(Math.PI*t)**.8)*(.96+.055*Math.sin(phase+pair*1.9+side));
   const width=.045+.008*Math.sin(phase*.8+pair*.7+side);
   leaflet(foliage,spine(t),radial,lateral,side,length,width,phase+pair*.91+side*.45,leafColor);
  }
 }
}
function geometry(s:Surface){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(s.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(s.colors,3));g.setIndex(s.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** Static original palms for the existing dry back-left dune. Ground is sampled
 * only to seat the trunks; this decoration adds no collider or animation state.
 */
export function createPalms(sampleHeight:(x:number,z:number)=>number){
 const wood=surface(),foliage=surface();
 for(const palm of PALMS){const ground=sampleHeight(palm.x,palm.z);if(!Number.isFinite(ground))throw new Error('Palm ground height must be finite.');buildPalm(wood,foliage,palm,ground);}
 const trunkGeometry=geometry(wood),leafGeometry=geometry(foliage);
 const trunkMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,emissive:0xb68950,emissiveIntensity:.24});
 const leafMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,side:THREE.DoubleSide,emissive:0x82ba9d,emissiveIntensity:.28});
 const trunks=new THREE.Mesh(trunkGeometry,trunkMaterial),leaves=new THREE.Mesh(leafGeometry,leafMaterial),group=new THREE.Group();
 group.name='cove-mint-palms';trunks.name='palm-trunks';leaves.name='palm-fronds';
 for(const mesh of [trunks,leaves]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
 group.userData.palms={count:3,fronds:30,leaflets:600,triangles:(wood.indices.length+foliage.indices.length)/3,materials:2,original:true};
 let disposed=false;
 return {group,dispose(){if(disposed)return;disposed=true;trunkGeometry.dispose();leafGeometry.dispose();trunkMaterial.dispose();leafMaterial.dispose();group.clear();}};
}

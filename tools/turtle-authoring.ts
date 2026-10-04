import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const cells=[[-.0,-.45],[0,-.20],[0,.06],[0,.30],[0,.49],[-.25,-.34],[-.29,-.08],[-.26,.18],[-.19,.40],[.25,-.34],[.29,-.08],[.26,.18],[.19,.40]];
function scute(x:number,z:number){const d=cells.map(([a,b])=>Math.hypot((x-a)*1.1,z-b)).sort((a,b)=>a-b);return {edge:d[1]-d[0],centre:d[0]};}
function texture(shell:boolean){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!,im=c.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const u=x/511,v=y/511,a=Math.sin(x*12.9898+y*78.233)*43758.5453,grain=(a-Math.floor(a)-.5)*7;let rgb:number[];
  if(shell){const s=scute((u-.5)*.91,(v-.5)*1.39),seam=Math.min(1,s.edge/.012),ring=Math.sin(s.centre*280+Math.sin(x*.17)*.6)*2.8,patch=Math.sin(x*.07+y*.04)*5+Math.cos(x*.02-y*.09)*5;rgb=[67,69,40].map((k,i)=>(k+patch+ring+grain)*(.66+.34*seam)+(i===0?7:0));}
  else if(u>.87&&v>.87)rgb=[192+grain,183+grain,143+grain];
  else {const row=Math.floor(v*34),sx=u*45+(row%2)*.5,sy=v*34;const edge=Math.min(sx%1,1-sx%1,sy%1,1-sy%1),seam=Math.min(1,edge/.09),mottled=Math.sin(x*.1+y*.07)*5;rgb=[112,117,76].map(k=>k+grain+mottled+(1-seam)*28);}
  const p=(y*512+x)*4;for(let i=0;i<3;i++)im.data[p+i]=rgb[i];im.data[p+3]=255;
 }
 c.putImageData(im,0,0);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function shellGeometry(n:number,rings:number){
 const p:number[]=[],uv:number[]=[],ix:number[]=[];
 for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
  const r=j/rings,a=i/n*Math.PI*2,x=Math.sin(a)*.43*r,z=Math.cos(a)*.65*r,s=scute(x,z),lip=(r>.94?Math.sin(a*21)*.002:0);
  const y=.026+.302*Math.pow(Math.max(0,1-r*r),.67)-.006*Math.exp(-s.edge*180)+lip;
  p.push(x,y,z);uv.push(x/.91+.5,z/1.39+.5);
  if(j<rings&&i<n){const q=j*(n+1)+i,b=q+n+1;ix.push(q,b,q+1,b,b+1,q+1);}
 }
 // Rounded marginal rim descends onto the torso; the shell is no longer an open lid.
 const base=(rings+1)*(n+1),outer=rings*(n+1);
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,x=Math.sin(a)*.43*.88,z=Math.cos(a)*.65*.88;p.push(x,-.049,z);uv.push(x/.91+.5,z/1.39+.5);if(i<n)ix.push(outer+i,base+i,outer+i+1,base+i,base+i+1,outer+i+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function finGeometry(sign:number,front:boolean,n:number){
 const p:number[]=[],uv:number[]=[],ix:number[]=[],length=front?.56:.30;
 for(let side=0;side<2;side++)for(let i=0;i<=n;i++)for(let j=0;j<=8;j++){
  const t=i/n,w=(front?.105:.082)*Math.pow(Math.sin(Math.PI*t),.65)+.011,a=(j/8*2-1),x=sign*((front?.28:.24)+length*t),z=(front?.32:-.40)-(front?.26:.21)*t+a*w;
  const y=-.020-.105*t+(side?1:-1)*(.011*Math.sqrt(Math.max(0,1-a*a))+.002)*Math.sin(Math.PI*t);
  p.push(x,y,z);uv.push(.12+t*.76,.10+j/8*.8);
  if(i<n&&j<8){const q=side*(n+1)*9+i*9+j,b=q+9;ix.push(...(side?[q,q+1,b,b,q+1,b+1]:[q,b,q+1,b,b+1,q+1]));}
 }
 for(let i=0;i<n;i++)for(const j of [0,8]){const a=i*9+j,b=a+9,c=a+(n+1)*9,d=c+9;ix.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function createAuthoredTurtle(){
 const root=new T.Group();root.name='LivingCoveTurtle';
 const bone=(name:string,x:number,y:number,z:number,parent?:T.Bone)=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);parent?.add(b);return b;};
 const rig=bone('Root',0,0,0),body=bone('Body',0,0,0,rig),neck=bone('Neck',0,.01,.50,body),head=bone('Head',0,.012,.15,neck),fl=bone('FrontL',-.28,-.02,.32,body),fr=bone('FrontR',.28,-.02,.32,body),hl=bone('HindL',-.24,-.02,-.40,body),hr=bone('HindR',.24,-.02,-.40,body),tail=bone('Tail',0,-.014,-.54,body);
 const flTip=bone('FrontLTip',-.36,-.067,-.167,fl),frTip=bone('FrontRTip',.36,-.067,-.167,fr);
 const bones=[rig,body,neck,head,fl,fr,hl,hr,tail,flTip,frTip];root.add(rig);root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);
 const shellMat=new T.MeshStandardMaterial({map:texture(true),roughness:.79,vertexColors:true}),bodyMat=new T.MeshStandardMaterial({map:texture(false),roughness:.89,vertexColors:true});shellMat.name='WeatheredOliveCarapace';bodyMat.name='ScaledSkinAndPlastron';
 const decorate=(g:T.BufferGeometry,boneId:number,color:T.Color)=>{
  if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
  const p=g.attributes.position,c:number[]=[],i:number[]=[],w:number[]=[];for(let k=0;k<p.count;k++){c.push(color.r,color.g,color.b);const blend=(boneId===4||boneId===5)?T.MathUtils.clamp((Math.abs(p.getX(k))-.48)/.34,0,1):0;i.push(boneId,boneId===4?9:boneId===5?10:0,0,0);w.push(1-blend,blend,0,0);}
  g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(i,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));return g;
 };
 for(const low of [false,true]){
  const lod=new T.Group();lod.name=low?'TurtleLow':'TurtleHigh';root.add(lod);const parts:T.BufferGeometry[]=[];
  const ellipsoid=(x:number,y:number,z:number,sx:number,sy:number,sz:number,id=1,color=0xffffff,detail=1)=>{
   const g=new T.SphereGeometry(1,low?Math.max(6,Math.round(12*detail)):Math.round(20*detail),low?Math.max(4,Math.round(8*detail)):Math.round(12*detail));g.scale(sx,sy,sz);g.translate(x,y,z);const uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,id===1&&color===0xdfd7b6?.90+uv.getX(k)*.08:uv.getX(k)*.82,id===1&&color===0xdfd7b6?.90+uv.getY(k)*.08:uv.getY(k)*.82);parts.push(decorate(g,id,new T.Color(color)));
  };
  // Flattened belly, a flexible short neck and a tapered, beaked head.
  ellipsoid(0,.008,0,.431,.115,.644,1,0xffffff,.8);ellipsoid(0,-.035,0,.382,.081,.57,1,0xdfd7b6);ellipsoid(0,.017,.572,.09,.061,.163,2);
  ellipsoid(0,.048,.765,.111,.085,.142,3);ellipsoid(0,.006,.878,.083,.033,.070,3,0xb4b19b,.8);
  for(const sign of [-1,1]){
   ellipsoid(sign*.093,.072,.805,.025,.024,.028,3,0x292e21,.6);ellipsoid(sign*.113,.074,.812,.013,.013,.017,3,0x111710,.5);
   ellipsoid(sign*.032,.034,.935,.006,.005,.004,3,0x20231a,.5);
   parts.push(decorate(finGeometry(sign,true,low?6:12),sign<0?4:5,new T.Color(0xffffff)));
   parts.push(decorate(finGeometry(sign,false,low?4:8),sign<0?6:7,new T.Color(0xffffff)));
  }
  const tg=new T.ConeGeometry(.035,.19,low?8:16);tg.rotateX(-Math.PI/2);tg.scale(1,.42,1);tg.translate(0,-.02,-.635);parts.push(decorate(tg,8,new T.Color(0xbec49c)));
  const geo=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const skin=new T.SkinnedMesh(geo,bodyMat);skin.name=lod.name+'Body';skin.castShadow=skin.receiveShadow=true;lod.add(skin);
  const carapace=new T.SkinnedMesh(decorate(shellGeometry(low?32:56,low?12:22),1,new T.Color(0xffffff)),shellMat);carapace.name=lod.name+'Shell';carapace.castShadow=carapace.receiveShadow=true;lod.add(carapace);
  root.updateMatrixWorld(true);skin.bind(skeleton);carapace.bind(skeleton);
 }
 const clips:T.AnimationClip[]=[];
 for(const name of ['Swim','Crawl','Idle']){
  const duration=name==='Swim'?2.4:name==='Crawl'?3.2:5,tracks:T.KeyframeTrack[]=[],times=Array.from({length:33},(_,i)=>i/32*duration);
  const rotations=(b:T.Bone,axis:'x'|'y'|'z',f:(phase:number)=>number)=>{
   const values:number[]=[];for(const t of times){const e=new T.Euler();e[axis]=f(t/duration*Math.PI*2);const q=new T.Quaternion().setFromEuler(e);values.push(q.x,q.y,q.z,q.w);}tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));
  };
  for(const [b,sign,front] of [[fl,-1,true],[fr,1,true],[hl,-1,false],[hr,1,false]] as const){
   const values:number[]=[];for(const t of times){const p=t/duration*Math.PI*2;
    const flap=name==='Swim'?sign*(Math.sin(p+(front?0:.6))*.22+.07):name==='Crawl'?sign*Math.max(0,Math.sin(p+(sign<0?0:Math.PI)))*.10:sign*Math.sin(p)*.009;
    const sweep=name==='Crawl'?sign*Math.sin(p+(sign<0?0:Math.PI))*.17:sign*Math.sin(p+.6)*.035;
    const q=new T.Quaternion().setFromEuler(new T.Euler(0,sweep,flap));values.push(q.x,q.y,q.z,q.w);
   }tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));
  }
  rotations(flTip,'z',p=>name==='Swim'?-.12*Math.sin(p-.6):-.012*Math.sin(p));rotations(frTip,'z',p=>name==='Swim'?.12*Math.sin(p-.6):.012*Math.sin(p));
  rotations(head,'y',p=>Math.sin(p)*.035);rotations(tail,'y',p=>Math.sin(p-.4)*.05);
  const positions:number[]=[];for(const t of times)positions.push(0,name==='Swim'?.22+Math.sin(t/duration*Math.PI*2)*.005:0,0);
  tracks.push(new T.VectorKeyframeTrack('Body.position',times,positions));clips.push(new T.AnimationClip(name,duration,tracks));
 }
 // Keep low LOD available to exporter; runtime adapter chooses one.
 return {root,clips,skeleton};
}
export async function buildTurtleAsset():Promise<ArrayBuffer>{const {root,clips}=createAuthoredTurtle();return await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false,maxTextureSize:512}) as ArrayBuffer;}
(window as any).__turtleAuthor={ready:true,build:async()=>{const b=new Uint8Array(await buildTurtleAsset());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}};

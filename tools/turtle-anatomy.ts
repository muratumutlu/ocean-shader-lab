import * as T from 'three';

// Original Caretta caretta reconstruction. +Z is the animal's anterior axis.
// Official NOAA/NPS loggerhead photographs and motion: b23-loggerhead-references.
// No photograph/third-party model is baked into these editable meshes or textures.
const TAU=Math.PI*2,CARAPACE_RISE=.229;
const smooth=(a:number,b:number,x:number)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(x:number,y:number)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
function noise(x:number,y:number){
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);
 return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
}
const wrapNoise=(u:number,v:number,nx:number,ny:number)=>T.MathUtils.lerp(noise(u*nx,v*ny),noise((u-1)*nx,v*ny),smooth(0,1,u));
function plates(u:number,v:number,nx:number,ny:number,wrap=false){
 const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y);let first=Infinity,second=Infinity,id=0;
 for(let j=iy-1;j<=iy+1;j++)for(let i=ix-1;i<=ix+1;i++){
  const cellX=wrap?((i%nx)+nx)%nx:i,px=i+.5+(j%2)*.35+(hash(cellX,j)-.5)*.28,py=j+.5+(hash(cellX+73,j-19)-.5)*.32,d=Math.hypot(x-px,y-py);
  if(d<first){second=first;first=d;id=hash(cellX+37,j+61);}else if(d<second)second=d;
 }
 return {edge:second-first,centre:first,id};
}
const SCUTES=[[0,-.47],[0,-.25],[0,-.005],[0,.24],[0,.46],[-.14,-.49],[-.235,-.30],[-.30,-.055],[-.305,.22],[-.245,.43],[.14,-.49],[.235,-.30],[.30,-.055],[.305,.22],[.245,.43]];
export function carapaceScute(x:number,z:number){let first=Infinity,second=Infinity,id=0,px=0,pz=0;
 for(let i=0;i<SCUTES.length;i++){const [a,b]=SCUTES[i],d=Math.hypot((x-a)*1.08,z-b);if(d<first){second=first;first=d;id=i;px=a;pz=b;}else if(d<second)second=d;}
 return {edge:second-first,id,dx:x-px,dz:z-pz};
}
function surface(shell:boolean,u:number,v:number):{color:number[];height:number;roughness?:number}{
 const aroundBody=u/.48,body=!shell&&u<.485,grain=((body?wrapNoise(aroundBody,v,149,310):noise(u*310,v*310))-.5)*2.4,cloud=body?wrapNoise(aroundBody,v,11,25):noise(u*22,v*25),fine=body?wrapNoise(aroundBody,v,37,85):noise(u*77,v*85);
 if(shell){
  const x=(u-.5)*.96,z=(v-.5)*1.42,s=carapaceScute(x,z),seam=1-smooth(.001,.007,s.edge),r=shellRadius(x,z),a=Math.atan2(x/.43,z/.65);
  const patina=.55*noise(u*45+32,v*48+19)+.35*noise(u*130+72,v*145+33)+.10*noise(u*350,v*390),cell=hash(s.id+12,7),veins=Math.sin(Math.atan2(s.dz,s.dx)*24+fine*3)*.7;
  const mottled=(cloud-.5)*24+(fine-.5)*12+grain+veins;
  const brown=[106+cell*32,74+cell*24,47+cell*23],worn=smooth(.44,.72,patina)*.26;
  const aged=smooth(.34,.68,noise(u*8+17,v*10+41))*.34;
  const seamLip=smooth(.004,.008,s.edge)*(1-smooth(.008,.019,s.edge));
  let color=brown.map((b,i)=>T.MathUtils.lerp(T.MathUtils.lerp(T.MathUtils.lerp(T.MathUtils.lerp(b+mottled,[75,74,61][i]+mottled*.45,aged),[131,130,107][i]+mottled*.4,worn),[151,123,75][i]+grain,seamLip*.24),[77,49,27][i]+grain,seam*.48));
  // Distinct marginal plates and an irregular worn horn lip, not chalk outlines.
  const edgeNoise=noise(Math.sin(a)*11+20,Math.cos(a)*13+31),marginal=smooth(.905+edgeNoise*.023,.963+edgeNoise*.015,r),partition=(1-smooth(.025,.16,Math.abs(Math.sin(a*13+(edgeNoise-.5)*1.1))))*(.40+.60*noise(u*37+9,v*41)),lip=smooth(.978+edgeNoise*.009,1.018,r),edgeWear=smooth(.30,.72,noise(a*11+20,r*71));
  color=color.map((b,i)=>T.MathUtils.lerp(T.MathUtils.lerp(b,[130+cell*19,98+cell*18,59+cell*15][i]+mottled,marginal*.49),[99,68,37][i],marginal*partition*.43));
  color=color.map((b,i)=>T.MathUtils.lerp(b,[166,138,88][i]+grain,lip*edgeWear*.37));
  return {color,height:.49+fine*.15-seam*.18-marginal*partition*.15+lip*.05,roughness:.60+patina*.15+seam*.09+lip*.06};
 }
 if(u<.485){
  const around=u/.48,neck=smooth(.48,.59,v),belly=(1-smooth(.12,.23,Math.abs(around-.5)))*(1-neck*.86);
  const n=plates(around,v,48,48,true),neckBorder=1-smooth(.02,.10,n.edge),wrinkle=Math.sin(v*950+wrapNoise(around,v,13,9)*2.1),neckShade=(cloud-.5)*25+grain+neck*wrinkle*7;
  const neckBase=[121+n.id*26,114+n.id*23,86+n.id*21],neckEdge=[186,176,137];
  const neckColor=neckBase.map((b,i)=>T.MathUtils.lerp(b+neckShade+neckBorder*(neckEdge[i]-b)*.43,[210,192,144][i]+neckShade*.5,belly*.90)),neckHeight=.58+fine*.13-neckBorder*.12+neck*wrinkle*.038;
  if(v<=.64)return {color:neckColor,height:neckHeight,roughness:.72};
  const p=plates(around,(v-.64)/.36,13,4,true),border=1-smooth(.010,.055,p.edge),beak=smooth(.945,.985,v),shade=(cloud-.5)*27+(fine-.5)*12+grain;
  const base=[128+p.id*32,89+p.id*26,52+p.id*20],edge=[207,178,125],jaw=1-smooth(.10,.24,Math.abs(around-.5)),temple=Math.exp(-Math.pow((v-.81)/.085,2))*(Math.exp(-Math.pow((around-.25)/.075,2))+Math.exp(-Math.pow((around-.75)/.075,2)));
  let color=base.map((b,i)=>T.MathUtils.lerp(b+shade,edge[i]+shade*.65,border*.39));
  color=color.map((b,i)=>T.MathUtils.lerp(b,[67,68,55][i]+shade,temple*.55));
  const keratin=[T.MathUtils.lerp(168,199,jaw),T.MathUtils.lerp(157,186,jaw),T.MathUtils.lerp(126,153,jaw)];
  color=color.map((b,i)=>T.MathUtils.lerp(b,keratin[i]+shade*.38,Math.max(beak*.83,jaw*.78)));
  const headBlend=smooth(.645,.715+(wrapNoise(around,3,17,1)-.5)*.025,v);
  return {color:color.map((b,i)=>T.MathUtils.lerp(neckColor[i],b,headBlend)),height:T.MathUtils.lerp(neckHeight,.61+fine*.15-border*.17,headBlend),roughness:T.MathUtils.lerp(.72,.61+border*.18+beak*.08,headBlend)};
 }
 if(v<.64){
  const t=(u-.5)/.5,a=v<.50?v/.5:(v-.50)/.14,p=plates(t,a,14,8),border=1-smooth(.02,.105,p.edge),under=v>.50;
  const proximal=Math.exp(-t*8),fold=Math.sin(t*165+noise(a*11,t*13)*2.3)*proximal,base=under?[194,179,128]:[116+p.id*28,100+p.id*26,74+p.id*22],edge=under?[218,202,157]:[168,155,122],shade=(cloud-.5)*27+(fine-.5)*9+grain+fold*6;
  return {color:base.map((b,i)=>b+shade+border*(edge[i]-b)*(under?.50:.32)),height:.61+fine*.13-border*.17+fold*.030,roughness:under?.77:.65+border*.16};
 }
 if(u<.77&&v>.67&&v<.94){
  const x=(u-.64)/.105,y=(v-.81)/.105,r=Math.hypot(x,y),angle=Math.atan2(y,x),pupil=1-smooth(.43,.48,r),rim=smooth(.80,.93,r);
  const striation=Math.sin(angle*54+fine*3)*5,iris=[91+striation,77+striation*.7,43+striation*.4];
  let color=iris.map((b,i)=>T.MathUtils.lerp(T.MathUtils.lerp(b,[9,12,10][i],pupil),[46,49,36][i],rim));
  const highlight=1-smooth(.05,.12,Math.hypot(x+.24,y-.30));color=color.map(b=>T.MathUtils.lerp(b,226,highlight*.85));
  return {color,height:.5,roughness:.22};
 }
 if(u>.785&&u<.925&&v>.655&&v<.915){
  const jaw=1-smooth(.765,.800,v),forehead=smooth(.85,.905,v),striations=Math.sin(u*740+noise(u*29,v*21)*2)*1.9,shade=(cloud-.5)*13+grain+striations;
  return {color:[163,153,126].map((b,i)=>T.MathUtils.lerp(T.MathUtils.lerp(b,[202,191,163][i],jaw),[128,96,65][i],forehead*.60)+shade),height:.55+fine*.035+striations*.006,roughness:.73+fine*.07};
 }
 if(u>.80&&v>.92)return {color:[158+grain,143+grain,105+grain],height:.5,roughness:.57};
 return {color:[42+grain,46+grain,35+grain],height:.5,roughness:.47};
}
function makeTexture(shell:boolean,normal:boolean,roughness=false){
 const size=roughness?256:normal?384:1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(size,size),heights=normal?new Float32Array(size*size):null;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sample=surface(shell,x/(size-1),1-y/(size-1)),k=(y*size+x)*4;
  if(heights)heights[y*size+x]=sample.height;
  else for(let c=0;c<3;c++)pixels.data[k+c]=roughness?Math.round((sample.roughness??.72)*255):Math.round(sample.color[c]/2)*2;pixels.data[k+3]=255;
 }
 if(heights)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(a:number,b:number)=>heights[Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a))];
  const n=new T.Vector3((at(x-1,y)-at(x+1,y))*1.6,(at(x,y+1)-at(x,y-1))*1.6,1).normalize(),k=(y*size+x)*4;
  pixels.data[k]=(n.x*.5+.5)*255;pixels.data[k+1]=(n.y*.5+.5)*255;pixels.data[k+2]=(n.z*.5+.5)*255;pixels.data[k+3]=255;
 }
 ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(canvas);if(!normal&&!roughness)texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function anatomyTextures(){return {shellColor:makeTexture(true,false),shellNormal:makeTexture(true,true),shellRoughness:makeTexture(true,false,true),skinColor:makeTexture(false,false),skinNormal:makeTexture(false,true),skinRoughness:makeTexture(false,false,true)};}

// Cross sections integrate the plastron, shoulder/neck folds, cranium and beak.
// [z, half-width, vertical centre, dorsal radius, ventral radius]
// A broad adult cranium and full mandibular angles, with a low, fleshy neck.
// These original section controls follow the adult reference silhouette;
// they are proportions for this diorama, not dimensions measured from a scan.
const SECTIONS=[[-.635,.006,-.025,.013,.012],[-.60,.10,-.009,.050,.047],[-.52,.215,.005,.092,.079],[-.39,.305,.008,.130,.100],[-.16,.376,.012,.137,.112],[.15,.410,.015,.134,.113],[.36,.383,.017,.128,.108],[.47,.320,.025,.112,.098],[.55,.230,.023,.073,.089],[.61,.164,.024,.063,.078],[.67,.160,.024,.069,.073],[.72,.175,.028,.080,.077],[.78,.185,.029,.084,.080],[.835,.181,.025,.082,.077],[.885,.159,.017,.063,.067],[.925,.133,.016,.044,.053],[.956,.112,.004,.033,.040],[.975,.093,-.001,.022,.030],[.980,.084,-.005,.017,.026]];
function profile(z:number){
 let i=0;while(i<SECTIONS.length-2&&z>SECTIONS[i+1][0])i++;
 const a=SECTIONS[i],b=SECTIONS[i+1],t=T.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1),p=SECTIONS[Math.max(0,i-1)],q=SECTIONS[Math.min(SECTIONS.length-1,i+2)];
 const result=[z];for(let j=1;j<5;j++){
  // Hermite slopes in physical z avoid abrupt neck/head rings.
  const m0=(b[j]-p[j])/(b[0]-p[0])*(b[0]-a[0]),m1=(q[j]-a[j])/(q[0]-a[0])*(b[0]-a[0]);
  result.push((2*t*t*t-3*t*t+1)*a[j]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*b[j]+(t*t*t-t*t)*m1);
 }return result;
}
function geometry(p:number[],uv:number[],indices:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
function shellRadius(x:number,z:number){
 let angle=Math.atan2(x/.43,z/.65);
 for(let i=0;i<5;i++){const outline=1+.20*Math.cos(angle)-.065*Math.cos(2*angle);angle=Math.atan2(x/(.43*outline),z/.65);}
 const outline=1+.20*Math.cos(angle)-.065*Math.cos(2*angle),r=Math.hypot(x/(.43*outline),z/.65);
 return r;
}
function shellHeight(x:number,z:number){const r=shellRadius(x,z);return r>=1?null:.022+CARAPACE_RISE*Math.pow(1-r*r,.76)-.0035*Math.exp(-carapaceScute(x,z).edge*160);
}
const dorsalPower=(z:number)=>T.MathUtils.lerp(.91,.52,smooth(.67,.78,z));
function bodyUV(angle:number,z:number):[number,number]{
 const v=z<.55?.02+(z+.635)/1.185*.52:z<.70?.54+(z-.55)/.15*.10:.64+(z-.70)/.280*.35;
 return [angle/TAU*.48,v];
}
const beakOffset=(a:number)=>.015*Math.max(0,Math.cos(a))-.004*Math.sin(a)**2;
export function bodyAnatomy(low:boolean){
 const sides=low?14:26,steps=low?24:48,p:number[]=[],uv:number[]=[],ix:number[]=[];
 for(let j=0;j<=steps;j++)for(let i=0;i<=sides;i++){
  const t=j/steps,z=t<.50?-.635+t/.50*1.185:t<.65?.55+(t-.50)/.15*.15:.70+(t-.65)/.35*.280,[,w,cy,up,down]=profile(z),a=i/sides*TAU,c=Math.cos(a);
  // Slight dorsal flattening and fuller cheeks; ventral jaw stays asymmetric.
  const bellyPower=T.MathUtils.lerp(.64,1,smooth(.48,.67,z)),x=w*Math.sin(a);let y=cy+(c>=0?up*Math.pow(c,dorsalPower(z)):-down*Math.pow(-c,bellyPower));
  // The soft shoulder remains under the hard carapace instead of piercing it.
  const lid=shellHeight(x,z);if(c>=0&&lid!==null&&z<.65)y=T.MathUtils.lerp(Math.min(y,lid-.012),y,smooth(.54,.65,z));
  const fold=smooth(.50,.55,z)*(1-smooth(.67,.72,z))*Math.sin((z-.52)*82+Math.sin(a)*1.3)*.0028;
  p.push(x+Math.sin(a)*fold,y+c*fold,z+smooth(.925,.980,z)*beakOffset(a));uv.push(...bodyUV(a,z));
  if(j<steps&&i<sides){const q=j*(sides+1)+i,b=q+sides+1;ix.push(q,b,q+1,b,b+1,q+1);}
 }
 const rearCentre=p.length/3;p.push(0,profile(-.635)[2],-.635);uv.push(.24,.02);
 for(let i=0;i<sides;i++)ix.push(rearCentre,i,i+1);
 // A convex keratin cap has its own UV island, preserving the closed front ring.
 const [,w,cy,up,down]=profile(.980),outer=p.length/3;
 for(const r of [1,.5])for(let i=0;i<=sides;i++){
  const a=i/sides*TAU,c=Math.cos(a),x=w*Math.sin(a)*r,y=cy+(c>=0?up*Math.pow(c,dorsalPower(.980)):-down*-c)*r,z=.980+.013*(1-r*r)+beakOffset(a)*r;
  p.push(x,y,z);uv.push(.85+x/w*.060,.78+(y-cy)/(y>=cy?up:down)*.10);
 }
 const inner=outer+sides+1,centre=p.length/3;p.push(0,cy,.993);uv.push(.85,.78);
 for(let i=0;i<sides;i++)ix.push(outer+i,inner+i,outer+i+1,inner+i,inner+i+1,outer+i+1,centre,inner+i+1,inner+i);
 const g=geometry(p,uv,ix),normals=g.attributes.normal,positions=g.attributes.position,shared=new Map<string,number[]>();
 for(let i=0;i<positions.count;i++){const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!shared.has(key))shared.set(key,[]);shared.get(key)!.push(i);}
 for(const ids of shared.values())if(ids.length>1){const normal=new T.Vector3();for(const i of ids)normal.add(new T.Vector3().fromBufferAttribute(normals,i));normal.normalize();for(const i of ids)normals.setXYZ(i,normal.x,normal.y,normal.z);}
 return g;
}
export function carapaceAnatomy(low:boolean){
 const n=low?32:60,rings=low?10:20,p:number[]=[],uv:number[]=[],ix:number[]=[];
 for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
  const r=j/rings,a=i/n*TAU,outline=1+.20*Math.cos(a)-.065*Math.cos(2*a),x=Math.sin(a)*.43*r*outline,z=Math.cos(a)*.65*r;
  const s=carapaceScute(x,z),y=.022+CARAPACE_RISE*Math.pow(Math.max(0,1-r*r),.76)-.0035*Math.exp(-s.edge*160);
  p.push(x,y,z);uv.push(x/.96+.5,z/1.42+.5);
  if(j<rings&&i<n){const q=j*(n+1)+i,b=q+n+1;ix.push(q,b,q+1,b,b+1,q+1);}
 }
 const outer=rings*(n+1),base=p.length/3;
 for(let i=0;i<=n;i++){
  const a=i/n*TAU,outline=1+.20*Math.cos(a)-.065*Math.cos(2*a),x=Math.sin(a)*.43*.89*outline,z=Math.cos(a)*.65*.89;
  p.push(x,-.052,z);uv.push(x/.96+.5,z/1.42+.5);if(i<n)ix.push(outer+i,base+i,outer+i+1,base+i,base+i+1,outer+i+1);
 }return geometry(p,uv,ix);
}
function flipperContour(front:boolean,t:number,a:number){
 const shape=Math.pow(Math.sin(Math.PI*t),front?.80:.55)*(front?1-.18*t:1),paddleWidth=(front?.110:.115)*shape+.008,width=front?.025+(paddleWidth-.025)*smooth(0,.40,t):paddleWidth;
 const edge=front?(a>0?.72+.12*Math.sin(Math.PI*t):1.17-.17*t):(a>0?1.12-.12*t:.92+.09*Math.sin(Math.PI*t));
 return a*width*edge+(front?.022*Math.sin(Math.PI*t):0);
}
export function flipperAnatomy(sign:number,front:boolean,low:boolean){
 const steps=front?(low?7:15):(low?5:10),across=low?4:8,p:number[]=[],uv:number[]=[],ix:number[]=[],length=front?.56:.30;
 for(let side=0;side<2;side++)for(let i=0;i<=steps;i++)for(let j=0;j<=across;j++){
  const t=i/steps,a=j/across*2-1;
  const x=sign*((front?.28:.24)+length*t),z=(front?.32:-.40)-(front?.26:.21)*t+flipperContour(front,t,a);
  const thickness=(front?.044*Math.exp(-t*6)+.014*Math.pow(1-t,1.45):.017*Math.pow(1-t,1.45))+.0028,bulge=Math.sqrt(Math.max(0,1-a*a));
  const camber=(front?.005:.003)*Math.sin(Math.PI*t)*bulge;
  const y=-.02-(front?.105:.07)*t+camber+(side?1:-.65)*thickness*bulge;
  p.push(x,y,z);uv.push(.50+t*.49,side?.015+j/across*.47:.505+j/across*.12);
  if(i<steps&&j<across){const q=side*(steps+1)*(across+1)+i*(across+1)+j,b=q+across+1;ix.push(...(side?[q,q+1,b,b,q+1,b+1]:[q,b,q+1,b,b+1,q+1]));}
 }
 const offset=(steps+1)*(across+1);
 for(let i=0;i<steps;i++)for(const j of [0,across]){const a=i*(across+1)+j,b=a+across+1,c=a+offset,d=c+across+1;ix.push(...(j?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
 for(const end of [0,steps])for(let j=0;j<across;j++){const a=end*(across+1)+j,b=a+1,c=a+offset,d=b+offset;ix.push(...(end?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
 if(sign<0)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
 return geometry(p,uv,ix);
}
export function flipperClaws(sign:number,front:boolean){
 const parts:T.BufferGeometry[]=[];
 for(const t of [.24,.34]){
  const length=front?.56:.30;
  const x=sign*((front?.28:.24)+length*t),z=(front?.32:-.40)-(front?.26:.21)*t+flipperContour(front,t,1),y=-.02-(front?.105:.07)*t;
  const half=front?.006:.005,reach=front?.025:.020,h=.006;
  const p=[x-half,y-h,z,x+half,y-h,z,x,y-h,z+reach,x-half,y+h,z,x+half,y+h,z,x,y+h,z+reach],uv=Array.from({length:6},()=>[.90,.965]).flat();
  parts.push(geometry(p,uv,[0,1,2,3,5,4,0,3,1,1,3,4,1,4,2,2,4,5,2,5,0,0,5,3]));
 }return parts;
}
function disc(centre:T.Vector3,normal:T.Vector3,rx:number,ry:number,low:boolean,iris:boolean){
 const around=low?12:24,rings=iris?3:2,p:number[]=[],uv:number[]=[],ix:number[]=[],h=new T.Vector3(-normal.z,0,normal.x).normalize(),v=new T.Vector3().crossVectors(normal,h).normalize();
 for(let j=0;j<=rings;j++)for(let i=0;i<=around;i++){
  const r=j/rings,a=i/around*TAU,x=Math.cos(a)*r,y=Math.sin(a)*r;
  const point=centre.clone().addScaledVector(h,x*rx).addScaledVector(v,y*ry).addScaledVector(normal,iris?.0024*(1-r*r):.0018*Math.sin(Math.PI*r));
  p.push(point.x,point.y,point.z);uv.push(iris?.64+x*.105:.94,iris?.81+y*.105:.80);
  if(j<rings&&i<around){const q=j*(around+1)+i,b=q+around+1;ix.push(q,b,q+1,b,b+1,q+1);}
 }return geometry(p,uv,ix);
}
export function facialAnatomy(low:boolean){
 const parts:T.BufferGeometry[]=[];
 for(const sign of [-1,1]){
  const z=.839,y=.068;
  const skullX=(zz:number,yy:number)=>{const [,w,cy,up]=profile(zz);return w*Math.sqrt(Math.max(0,1-Math.pow(Math.max(0,(yy-cy)/up),2/dorsalPower(zz))));};
  const dy=(skullX(z,y+.0001)-skullX(z,y-.0001))/.0002,dz=(skullX(z+.0001,y)-skullX(z-.0001,y))/.0002;
  const x=sign*skullX(z,y),normal=new T.Vector3(sign,-dy,-dz).normalize(),centre=new T.Vector3(x,y,z).addScaledVector(normal,.0015);
  // An inset corneal lens, with a raised scaled eyelid rather than button spheres.
  const eye=disc(centre,normal,.0155,.0115,low,true);parts.push(eye);
  const around=low?16:28,p:number[]=[],uv:number[]=[],ix:number[]=[],h=new T.Vector3(-normal.z,0,normal.x).normalize(),v=new T.Vector3().crossVectors(normal,h).normalize();
  for(let ring=0;ring<3;ring++)for(let i=0;i<=around;i++){
   const a=i/around*TAU,r=(ring===0?1:ring===1?1.25:1.53)*(1+.07*Math.sin(a*3+.6)+.035*Math.cos(a*5)),point=centre.clone().addScaledVector(h,Math.cos(a)*.0155*r).addScaledVector(v,Math.sin(a)*.0115*r).addScaledVector(normal,ring===1?.0032:ring===2?-.0015:0);
   p.push(point.x,point.y,point.z);const angle=(sign>0?Math.PI/2:Math.PI*1.5)+Math.sin(a)*.08;uv.push(...bodyUV(angle,point.z));
   if(ring<2&&i<around){const q=ring*(around+1)+i,b=q+around+1;ix.push(q,b,q+1,b,b+1,q+1);}
  }parts.push(geometry(p,uv,ix));
  const nz=.940,[,nw,ncy,nup]=profile(nz),nx=sign*.027,ny=ncy+nup*Math.sqrt(1-Math.pow(nx/nw,2)),nn=new T.Vector3(sign*.08,.52,.85).normalize();
  parts.push(disc(new T.Vector3(nx,ny,nz).addScaledVector(nn,.0005),nn,.0028,.0019,low,false));
 }
 // Mouth follows the actual asymmetric face surface, embedded beneath the beak.
 const count=low?24:44,mouthHalfWidth=.150,p:number[]=[],uv:number[]=[],ix:number[]=[];
 const faceZ=(x:number,y:number)=>{
  const [,w,cy,up,down]=profile(.980),vertical=(y-cy)/(y>=cy?up:down),a=Math.atan2(x/w,Math.sign(vertical)*Math.pow(Math.abs(vertical),y>=cy?1/dorsalPower(.980):1)),r=Math.hypot(x/w,Math.sign(vertical)*Math.pow(Math.abs(vertical),y>=cy?1/dorsalPower(.980):1));
  if(r<=1)return r<=.5?T.MathUtils.lerp(.993,.98975+beakOffset(a)*.5,r*2):T.MathUtils.lerp(.98975+beakOffset(a)*.5,.980+beakOffset(a),(r-.5)*2);
  let lo=.83,hi=.980;for(let i=0;i<24;i++){const z=(lo+hi)/2,[,sw,scy,sup,sdown]=profile(z),v=(y-scy)/(y>scy?sup:sdown);if(x*x/(sw*sw)+Math.pow(Math.abs(v),y>scy?2/dorsalPower(z):2)<1)lo=z;else hi=z;}
  const z=(lo+hi)/2,[,sw,scy,sup,sdown]=profile(z),v=(y-scy)/(y>scy?sup:sdown),angle=Math.atan2(x/sw,Math.sign(v)*Math.pow(Math.abs(v),y>scy?1/dorsalPower(z):1));return z+smooth(.925,.980,z)*beakOffset(angle);
 };
 for(let i=0;i<=count;i++)for(let j=0;j<2;j++){
  const x=(i/count*2-1)*mouthHalfWidth,y=-.006-.006*Math.pow(Math.abs(x)/mouthHalfWidth,1.5)+(j?1:-1)*.0010,z=faceZ(x,y)+.0009;
  p.push(x,y,z);uv.push(.94,.80);if(i<count&&j===0){const q=i*2;ix.push(q,q+2,q+1,q+1,q+2,q+3);}
 }parts.push(geometry(p,uv,ix));return parts;
}
export function anatomicalInfluences(id:number,x:number,z:number):{indices:number[];weights:number[]}{
 if(id===-1){
  if(z<.48)return {indices:[1,0,0,0],weights:[1,0,0,0]};
  if(z<.67){const a=smooth(.48,.64,z);return {indices:[1,2,0,0],weights:[1-a,a,0,0]};}
  const a=smooth(.67,.76,z);return {indices:[2,3,0,0],weights:[1-a,a,0,0]};
 }
 if(id===4||id===5){
  const t=T.MathUtils.clamp((Math.abs(x)-.28)/.56,0,1),root=smooth(.06,.30,t),tip=smooth(.12,.38,t);
  return {indices:[1,id,id===4?9:10,0],weights:[1-root,root*(1-tip),root*tip,0]};
 }
 if(id===6||id===7){const t=T.MathUtils.clamp((Math.abs(x)-.24)/.30,0,1),root=smooth(.04,.26,t),tip=smooth(.12,.40,t);return {indices:[1,id,id===6?11:12,0],weights:[1-root,root*(1-tip),root*tip,0]};}
 return {indices:[id,0,0,0],weights:[1,0,0,0]};
}

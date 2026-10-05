import {IcosahedronGeometry} from 'three';
import type {Rock} from './rocks';
import {fbm} from './textures';
import {SOIL_FLOOR} from './strata';
export type Vec3={x:number;y:number;z:number};
export type Quat={x:number;y:number;z:number;w:number};
export type WorldBounds={min:Vec3;max:Vec3};
export type ColliderSpec=
 |{kind:'heightfield';rows:number;cols:number;heights:Float32Array;scale:Vec3;translation:Vec3}
 |{kind:'convex';vertices:Float32Array;translation:Vec3;rotation:Quat}
 |{kind:'trimesh';vertices:Float32Array;indices:Uint32Array;translation:Vec3}
 |{kind:'cuboid';halfExtents:Vec3;translation:Vec3};
export type CoveData={seed:number;heights:Float32Array;rockMask:Float32Array;rocks:Rock[];size:129;width:32;depth:24;colliders:ColliderSpec[];shoreRoute:Vec3[];bounds:WorldBounds};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function sampleGrid(data:CoveData,x:number,z:number):number{
 const u=clamp((x+16)*4,0,128),v=clamp((z+12)*128/24,0,128),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,i1=Math.min(i+1,128),j1=Math.min(j+1,128),h=data.heights;
 return (h[j*129+i]*(1-a)+h[j*129+i1]*a)*(1-b)+(h[j1*129+i]*(1-a)+h[j1*129+i1]*a)*b;
}
// Preserve connected, eroded surface topology; convex hulls are collision-only.
export function createRockShape(rock:Rock):{vertices:Float32Array;indices:Uint32Array}{
 const source=new IcosahedronGeometry(1,rock.kind==='pebble'?2:12),p=source.attributes.position;
 const vertices:number[]=[],indices:number[]=[],seen=new Map<string,number>(),k=rock.angle;
 const softMin=(a:number,b:number,w:number)=>Math.min(a,b)-Math.max(w-Math.abs(a-b),0)**2/(4*w);
 const field=(x:number,y:number,z:number,frequency:number)=>fbm(x*frequency+y*.37+k,z*frequency-y*.61,k*11)*.6+fbm(z*frequency+y*.73,x*frequency-y*.23,k*17)*.4;
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),key=[px,py,pz].map(v=>Math.round(v*1e6)).join(',');
  const old=seen.get(key);if(old!==undefined){indices.push(old);continue;}
  let y=(py+1)*.5,x=px*(.86+.20*Math.sin(k*2.1)),z=pz*(.68+.19*Math.cos(k*3.7));
  const mass=(field(px,py,pz,2.1)-.45)*.42;
  x*=1+mass;z*=1+mass;y+=mass*.38+.070*px*Math.cos(k);
  x+=.13*y*Math.cos(k);z+=.13*y*Math.sin(k);
  // Broad fractured shoulders have rounded weathering transitions, then eroded relief.
  x=softMin(x,.81-.16*y+.15*z,.19);x=-softMin(-x,.87-.13*y+.10*z,.16);
  z=-softMin(-z,.72-.16*x+.07*y,.19);
  y=softMin(y,.96-.16*x+.07*z,.15);y=softMin(y,.91+.31*x-.12*z,.15);
  const weather=(field(x,y,z,8.3)-.47)*.045+(field(x,y,z,19)-.45)*.013;
  const seam=Math.pow(Math.max(0,Math.cos((y+x*.12-z*.07)*20+k)),18)*.012;
  x+=px*(weather-seam);z+=pz*(weather-seam);y+=py*weather*.5;
  // A broad broken foot is buried into the bed, rather than a sphere point contact.
  y=Math.max(y,.105+.027*x-.019*z+weather*.2);
  seen.set(key,vertices.length/3);indices.push(vertices.length/3);vertices.push(x*rock.radius,y*rock.height,z*rock.radius);
 }
 source.dispose();return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}
export function createRockVertices(rock:Rock):Float32Array{return createRockShape(rock).vertices;}
export function createCoveData(seed:number):CoveData{
 seed=seed>>>0;let state=(seed+619)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const rocks:Rock[]=[];
 // One sheltering headland and an unequal offshore group leave the center walkable.
 for(const [x,z,r,h] of [[10.8,-6.8,2.8,2.3],[11.9,-3.4,2.3,2.6],[9.6,-.5,2.1,2.8],[12.4,2.2,1.55,1.95],[-10,1.9,2.15,2.65],[-7.9,4.4,1.25,1.35],[-12.4,5.1,1.1,.95],[5.8,6.4,1.65,1.25],[8.0,7.5,.8,.65]])
  rocks.push({x:x+(random()-.5)*.45,z:z+(random()-.5)*.5,radius:r*(.94+random()*.12),height:h*(.95+random()*.10),angle:random()*Math.PI*2,kind:'boulder'});
 for(let i=0;i<24;i++)rocks.push({x:-11+random()*7,z:-5+random()*2.4,radius:.10+random()*.24,height:.10+random()*.19,angle:random()*6.28,kind:'pebble'});
 const heights=new Float32Array(129*129),rockMask=new Float32Array(129*129);
 for(let j=0;j<129;j++)for(let i=0;i<129;i++){
  const x=-16+i/4,z=-12+j*24/128;
  const shore=-2.1+.011*x*x+1.25*Math.exp(-(((x+8)/4)**2))-.75*Math.exp(-(((x-4)/5)**2));
  const d=shore-z;
  const beach=clamp(d*.24,-3,1.75);
  const dune=.70*Math.exp(-(((x+6)/5)**2+((z+9)/3)**2))+.55*Math.exp(-(((x-8)/4)**2+((z+10)/3.4)**2));
  const ripples=.014*Math.sin(x*2.2+z*.7+seed)*Math.sin(z*3.4);
  heights[j*129+i]=clamp(beach+dune*Math.max(0,Math.min(1,(d-2)/4))+ripples,-3,3.2);
  let mask=0;for(const rock of rocks)mask=Math.max(mask,Math.exp(-((x-rock.x)**2+(z-rock.z)**2)/(rock.radius**2*.75)));
  rockMask[j*129+i]=mask;
 }
 const data:CoveData={seed,heights,rockMask,rocks,size:129,width:32,depth:24,colliders:[],shoreRoute:[],bounds:{min:{x:-16,y:SOIL_FLOOR,z:-12},max:{x:16,y:6,z:12}}};
 // Rapier heightfields consume column-major heights. X is column, Z is row.
 const columnHeights=new Float32Array(heights.length);for(let x=0;x<129;x++)for(let z=0;z<129;z++)columnHeights[x*129+z]=heights[z*129+x];
 data.colliders.push({kind:'heightfield',rows:128,cols:128,heights:columnHeights,scale:{x:32,y:1,z:24},translation:{x:0,y:0,z:0}});
 for(const rock of rocks)data.colliders.push({kind:'convex',vertices:createRockVertices(rock),translation:{x:rock.x,y:sampleGrid(data,rock.x,rock.z)-.08-rock.height*.18,z:rock.z},rotation:{x:0,y:Math.sin(rock.angle/2),z:0,w:Math.cos(rock.angle/2)}});
 data.colliders.push({kind:'cuboid',halfExtents:{x:16,y:.05,z:12},translation:{x:0,y:SOIL_FLOOR-.05,z:0}});
 // Closed tile walls follow the actual terrain edge, including the dry rear.
 for(const [x0,z0,x1,z1] of [[-16,-12,16,-12],[16,-12,16,12],[16,12,-16,12],[-16,12,-16,-12]]){
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=128;i++){const x=x0+(x1-x0)*i/128,z=z0+(z1-z0)*i/128;vertices.push(x,sampleGrid(data,x,z),z,x,SOIL_FLOOR,z);if(i<128){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}}
  data.colliders.push({kind:'trimesh',vertices:new Float32Array(vertices),indices:new Uint32Array(indices),translation:{x:0,y:0,z:0}});
 }
 for(let i=0;i<=80;i++){const z=7-i*14/80,x=1.2+.18*Math.sin(i/80*Math.PI);data.shoreRoute.push({x,y:sampleGrid(data,x,z),z});}
 return data;
}

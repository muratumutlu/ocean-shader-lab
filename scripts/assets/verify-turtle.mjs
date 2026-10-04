import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Matrix4,Vector3,Quaternion,Euler} from 'three';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
export async function verifyTurtleAsset(path){
 const file=await readFile(path);requireThat(file.length<=3*1024*1024,'GLB exceeds 3 MiB');requireThat(file.readUInt32LE(0)===0x46546c67&&file.readUInt32LE(4)===2&&file.readUInt32LE(8)===file.length,'Invalid GLB header');
 let json,bin;for(let offset=12;offset<file.length;){const n=file.readUInt32LE(offset),type=file.readUInt32LE(offset+4);requireThat(offset+8+n<=file.length,'Truncated GLB chunk');const b=file.subarray(offset+8,offset+8+n);if(type===0x4e4f534a)json=JSON.parse(b.toString());if(type===0x004e4942)bin=b;offset+=n+8;}
 requireThat(json?.asset.version==='2.0'&&bin,'Missing GLB data');requireThat(json.materials.length<=2,'Material limit exceeded');
 for(const image of json.images??[]){requireThat(image.bufferView!==undefined&&!image.uri,'Texture must be embedded');const view=json.bufferViews[image.bufferView],png=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);requireThat(png.toString('ascii',1,4)==='PNG','Expected original embedded PNG');requireThat(png.readUInt32BE(16)<=1024&&png.readUInt32BE(20)<=1024,'Texture limit exceeded');}
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},bytes={5121:1,5123:2,5125:4,5126:4},cache=new Map();
 const access=index=>{
  if(cache.has(index))return cache.get(index);const a=json.accessors[index],v=json.bufferViews[a.bufferView],count=sizes[a.type],size=bytes[a.componentType];requireThat(count&&size,'Unsupported accessor');
  const values=new Float64Array(a.count*count),base=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??count*size;
  for(let i=0;i<a.count;i++)for(let j=0;j<count;j++){const off=base+i*stride+j*size;requireThat(off+size<=bin.length,'Accessor outside binary');values[i*count+j]=a.componentType===5126?bin.readFloatLE(off):a.componentType===5125?bin.readUInt32LE(off):a.componentType===5123?bin.readUInt16LE(off):bin.readUInt8(off);}
  requireThat(values.every(Number.isFinite),'Non-finite accessor');cache.set(index,values);return values;
 };
 const parents=new Map();json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
 const defaults=json.nodes.map(n=>({p:new Vector3(...(n.translation??[0,0,0])),q:new Quaternion(...(n.rotation??[0,0,0,1])),s:new Vector3(...(n.scale??[1,1,1]))}));
 const jointIds=new Set(json.skins.flatMap(s=>s.joints));requireThat(jointIds.size<=16,'Bone limit exceeded');
 const clips=json.animations??[];requireThat(clips.length===3&&['Swim','Crawl','Idle'].every(n=>clips.some(c=>c.name===n&&c.channels.length>0)),'Missing locomotion clips');
 const high=[],triangles={high:0,low:0};
 json.nodes.forEach((node,i)=>{
  if(node.mesh===undefined)return;let ancestor=i,name='';while(ancestor!==undefined){name+=json.nodes[ancestor].name??'';ancestor=parents.get(ancestor);}
  const lod=name.includes('TurtleHigh')?'high':name.includes('TurtleLow')?'low':null;requireThat(lod,'Unnamed LOD mesh');
  requireThat(node.skin!==undefined,'Unskinned model part');
  for(const p of json.meshes[node.mesh].primitives){
   const pos=access(p.attributes.POSITION),normal=access(p.attributes.NORMAL),weights=access(p.attributes.WEIGHTS_0),joints=access(p.attributes.JOINTS_0),indices=p.indices===undefined?null:access(p.indices);
   requireThat(normal.length===pos.length&&weights.length===pos.length/3*4,'Invalid attributes');
   for(let k=0;k<normal.length;k+=3)requireThat(Math.abs(Math.hypot(normal[k],normal[k+1],normal[k+2])-1)<.003,'Invalid vertex normal');
   for(let k=0;k<weights.length;k+=4){requireThat(Math.abs(weights[k]+weights[k+1]+weights[k+2]+weights[k+3]-1)<.0001,'Invalid skin weight sum');for(let j=0;j<4;j++)requireThat(weights[k+j]>=0&&weights[k+j]<=1&&joints[k+j]<json.skins[node.skin].joints.length,'Invalid skin influence');}
   const count=indices?indices.length:pos.length/3;requireThat(count%3===0,'Incomplete triangles');if(indices)requireThat(indices.every(k=>k<pos.length/3),'Invalid triangle index');triangles[lod]+=count/3;
   if(lod==='high')high.push({pos,weights,joints,skin:json.skins[node.skin]});
  }
 });
 requireThat(triangles.high<=8000&&triangles.low<=3000,'LOD triangle limit exceeded');
 let lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity),radius=0,sampledPoses=0;const modeBounds=new Map(),groundSamples=[],swimGroundSamples=[];
 const point=new Vector3(),acc=new Vector3(),temp=new Vector3();
 const sample=(clip,t,pitch,roll)=>{const contacts=new Map();
  const state=defaults.map(d=>({p:d.p.clone(),q:d.q.clone(),s:d.s.clone()}));
  for(const c of clip.channels){const sampler=clip.samplers[c.sampler];requireThat(!sampler.interpolation||sampler.interpolation==='LINEAR','Unsupported interpolation');const times=access(sampler.input),values=access(sampler.output);let k=0;while(k<times.length-2&&times[k+1]<t)k++;const alpha=Math.max(0,Math.min(1,(t-times[k])/(times[k+1]-times[k]||1))),target=state[c.target.node],n=c.target.path==='rotation'?4:3;
   if(c.target.path==='rotation')target.q.fromArray(values,k*n).slerp(new Quaternion().fromArray(values,(k+1)*n),alpha);
   else if(c.target.path==='translation')target.p.fromArray(values,k*n).lerp(new Vector3().fromArray(values,(k+1)*n),alpha);
   else if(c.target.path==='scale')target.s.fromArray(values,k*n).lerp(new Vector3().fromArray(values,(k+1)*n),alpha);
   else throw Error('Unsupported animation target');
  }
  const worlds=[];const world=i=>{if(worlds[i])return worlds[i];const d=state[i],m=new Matrix4().compose(d.p,d.q,d.s),parent=parents.get(i);if(parent!==undefined)m.premultiply(world(parent));worlds[i]=m;return m;};
  const orientation=new Matrix4().makeRotationFromEuler(new Euler(pitch,0,roll)),skinMatrices=new Map();
  for(const mesh of high){let matrices=skinMatrices.get(mesh.skin);if(!matrices){const inv=access(mesh.skin.inverseBindMatrices);matrices=mesh.skin.joints.map((j,k)=>world(j).clone().multiply(new Matrix4().fromArray(inv,k*16)));skinMatrices.set(mesh.skin,matrices);}
   for(let k=0;k<mesh.pos.length/3;k++){point.fromArray(mesh.pos,k*3);acc.set(0,0,0);for(let j=0;j<4;j++){const w=mesh.weights[k*4+j];if(w)acc.addScaledVector(temp.copy(point).applyMatrix4(matrices[mesh.joints[k*4+j]]),w);}acc.applyMatrix4(orientation);lo.min(acc);hi.max(acc);
    if(!modeBounds.has(clip.name))modeBounds.set(clip.name,{lo:new Vector3(Infinity,Infinity,Infinity),hi:new Vector3(-Infinity,-Infinity,-Infinity),radius:0});
    const bound=modeBounds.get(clip.name);bound.lo.min(acc);bound.hi.max(acc);bound.radius=Math.max(bound.radius,Math.hypot(acc.x,acc.z));
    if((clip.name==='Crawl'||clip.name==='Swim')&&pitch===0&&roll===0){const key=Math.round(acc.x/.05)+','+Math.round(acc.z/.05),old=contacts.get(key);if(!old||old[1]>acc.y)contacts.set(key,acc.toArray());}
    radius=Math.max(radius,Math.hypot(acc.x,acc.z));}
  }if(contacts.size)(clip.name==='Crawl'?groundSamples:swimGroundSamples).push([...contacts.values()].map(p=>p.map(v=>Math.round(v*1e6)/1e6)));sampledPoses++;
 };
 const clipInfo=[];
 for(const clip of clips){const duration=Math.max(...clip.samplers.map(s=>Math.max(...access(s.input))));requireThat(duration>0,'Empty animation');
  const pitchLimit=(clip.name==='Swim'?12:25)*Math.PI/180;
  for(let i=0;i<=32;i++)for(const p of [-pitchLimit,0,pitchLimit])for(const r of clip.name==='Swim'?[0]:[-pitchLimit,0,pitchLimit])sample(clip,i/32*duration,p,r);
  clipInfo.push({name:clip.name,duration,channels:clip.channels.length});
 }
 const margin=.02,offsetY=(lo.y+hi.y)/2,proxy={radius:Math.ceil((radius+margin)*1000)/1000,halfHeight:Math.ceil(((hi.y-lo.y)/2+margin)*1000)/1000,offset:{x:0,y:Math.round(offsetY*1000000)/1000000,z:0}};
 const swim=modeBounds.get('Swim'),swimProxy={radius:Math.ceil((swim.radius+.02)*1000)/1000,halfHeight:Math.ceil(((swim.hi.y-swim.lo.y)/2+.02)*1000)/1000,offset:{x:0,y:Math.round((swim.lo.y+swim.hi.y)/2*1e6)/1e6,z:0}};
 return {formatVersion:1,swimProxy,groundSamples,swimGroundSamples,fileSha256:createHash('sha256').update(file).digest('hex'),byteLength:file.length,triangles,bones:jointIds.size,materials:json.materials.length,clips:clipInfo,sampledPoses,animatedBounds:{min:lo.toArray(),max:hi.toArray()},proxy,spawnOffset:{x:0,y:proxy.halfHeight-proxy.offset.y+.02,z:0}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await verifyTurtleAsset(process.argv[2]??'public/assets/turtle.glb'),null,2));

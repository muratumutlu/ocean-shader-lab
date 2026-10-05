import {it,expect} from 'vitest';
import {Vector3,type BufferGeometry} from 'three';
import {bodyAnatomy,flipperAnatomy} from '../../tools/turtle-anatomy';
function volume(g:BufferGeometry){const p=g.attributes.position,ix=g.index!,a=new Vector3(),b=new Vector3(),c=new Vector3();let sum=0;for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));sum+=a.dot(b.cross(c))/6;}return sum;}
it('both mirrored paddles enclose the same positive volume with outward triangle winding',()=>{
 for(const low of [false,true])for(const front of [false,true]){
  const left=flipperAnatomy(-1,front,low),right=flipperAnatomy(1,front,low);
  try{expect(volume(left)).toBeGreaterThan(.0001);expect(volume(right)).toBeGreaterThan(.0001);expect(volume(left)).toBeCloseTo(volume(right),7);
   for(const g of [left,right]){expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true);expect(Array.from(g.attributes.normal.array).every(Number.isFinite)).toBe(true);}
  }finally{left.dispose();right.dispose();}
 }
});
it('the neck and cranium belong to one closed continuous body surface across both LODs',()=>{
 for(const low of [false,true]){
  const g=bodyAnatomy(low);try{
   const p=g.attributes.position,ix=g.index!,canonical=new Map<string,number>(),ids:number[]=[],edges=new Map<string,number>(),neighbors=new Map<number,Set<number>>();
   for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(',');if(!canonical.has(key))canonical.set(key,canonical.size);ids.push(canonical.get(key)!);}
   for(let i=0;i<ix.count;i+=3){const triangle=[ids[ix.getX(i)],ids[ix.getX(i+1)],ids[ix.getX(i+2)]];for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)??0)+1);if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a)!.add(b);}}
   expect([...edges.values()].every(count=>count===2)).toBe(true);
   const visited=new Set<number>(),queue=[0];while(queue.length){const id=queue.pop()!;if(visited.has(id))continue;visited.add(id);queue.push(...(neighbors.get(id)??[]));}
   expect(visited.size).toBe(canonical.size);expect(volume(g)).toBeGreaterThan(.01);
  }finally{g.dispose();}
 }
});

import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createCoveData,sampleGrid} from '../../src/scene/cove-data';
import {createSeabedLayout,createSeabedProps,type SeabedPropRange} from '../../src/scene/seabed';

const data=createCoveData(7);
const ranges=(mesh:THREE.Mesh)=>mesh.userData.propRanges as SeabedPropRange[];
const meshes=(props:ReturnType<typeof createSeabedProps>)=>props.group.children as THREE.Mesh[];
function point(p:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,i:number){return new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));}
function rayThroughAperture(mesh:THREE.Mesh,range:SeabedPropRange,cap=false){
 const a=range.aperture!,position=mesh.geometry.attributes.position,indices=Array.from(mesh.geometry.index!.array.slice(range.indexStart,range.indexEnd));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',position);geometry.setIndex(indices);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(geometry,material);
 const center=new THREE.Vector3(a.center.x,a.center.y,a.center.z),direction=new THREE.Vector3(a.direction.x,a.direction.y,a.direction.z).normalize();
 const ray=new THREE.Raycaster(center.clone().addScaledVector(direction,.025),direction.clone().negate());
 if(cap){const disc=new THREE.Mesh(new THREE.CircleGeometry(a.radius,24),material);disc.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);disc.position.copy(center);disc.updateMatrixWorld();probe.add(disc);}
 probe.updateMatrixWorld();const hits=ray.intersectObject(probe,true);
 if(cap)(probe.children[0] as THREE.Mesh).geometry.dispose();geometry.dispose();material.dispose();return hits.map(hit=>hit.distance-.025);
}

describe('original seabed props',()=>{
 it('reproduces seeded placements and leaves complete footprints clear of shore, rocks and the turtle route',()=>{
  const a=createSeabedLayout(7,data);expect(a).toEqual(createSeabedLayout(7,data));expect(a).not.toEqual(createSeabedLayout(8,data));
  for(const seed of [0,7,8,19,0xffffffff]){
   const layout=createSeabedLayout(seed,data);expect(layout.filter(p=>p.kind==='star')).toHaveLength(6);expect(layout.filter(p=>p.kind==='spiral')).toHaveLength(4);expect(layout.filter(p=>p.kind==='valve')).toHaveLength(12);
   for(const p of layout){
    expect(p.x-p.radius).toBeGreaterThan(-15);expect(p.x+p.radius).toBeLessThan(15);expect(p.z+p.radius).toBeLessThan(10);expect(p.y).toBe(sampleGrid(data,p.x,p.z));
    expect(p.y).toBeLessThan(-.12);expect(p.y).toBeGreaterThan(-1.9);expect(Math.abs(p.x-1.2)-p.radius).toBeGreaterThan(1.9);
    expect(data.shoreRoute.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>2+p.radius)).toBe(true);
    expect(data.rocks.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>q.radius+p.radius+.2)).toBe(true);
    expect(layout.every(q=>q.id===p.id||Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius)).toBe(true);
   }
  }
 });
 it('fits the actual triangle/material budgets and switches LOD without reallocating or dropping props',()=>{
  const props=createSeabedProps(7,data),objects=meshes(props).slice(),geometries=objects.map(m=>m.geometry),materials=new Set(objects.map(m=>m.material));
  try{
   expect(materials.size).toBe(2);expect(props.metadata.materials).toBe(2);let high=0,low=0;
   for(const profile of ['balanced','low','high','low','balanced'] as const){
    props.setQuality(profile);const visible=meshes(props).filter(m=>m.visible);expect(visible).toHaveLength(2);
    const triangles=visible.reduce((sum,m)=>sum+m.geometry.index!.count/3,0);if(profile==='low')low=triangles;else high=triangles;
    expect(triangles).toBe(props.metadata.triangles[profile==='low'?'low':'high']);
    expect(visible.flatMap(m=>ranges(m).map(r=>r.id)).sort((a,b)=>a-b)).toEqual(props.layout.map(p=>p.id));
    expect(meshes(props)).toEqual(objects);expect(meshes(props).map(m=>m.geometry)).toEqual(geometries);
   }
   expect(high).toBeLessThanOrEqual(120000);expect(low).toBeLessThanOrEqual(15000);expect(low).toBeLessThan(high*.20);
  }finally{props.dispose();}
 });
 it('has one closed, oriented, nondegenerate volume for every body and thick shell in both LODs',()=>{
  const props=createSeabedProps(7,data);
  try{for(const mesh of meshes(props)){
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,index=mesh.geometry.index!;
   expect(Array.from(p.array).every(Number.isFinite)).toBe(true);expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
   for(const range of ranges(mesh)){
    const edges=new Map<string,{count:number;direction:number}>(),neighbors=new Map<number,Set<number>>();let volume=0;
    for(let i=range.indexStart;i<range.indexEnd;i+=3){
     const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],a=point(p,ids[0]),b=point(p,ids[1]),c=point(p,ids[2]);
     expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq(),`${mesh.name} ${range.kind}: degenerate triangle`).toBeGreaterThan(1e-19);
     volume+=a.dot(b.clone().cross(c))/6;
     for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],key=[Math.min(u,v),Math.max(u,v)].join(':'),edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=u<v?1:-1;edges.set(key,edge);if(!neighbors.has(u))neighbors.set(u,new Set());neighbors.get(u)!.add(v);}
    }
    expect([...edges.values()].every(e=>e.count===2&&e.direction===0),`${mesh.name} ${range.kind}: open or inconsistently wound edge`).toBe(true);
    const visited=new Set<number>(),queue=[range.start];while(queue.length){const v=queue.pop()!;if(visited.has(v))continue;visited.add(v);queue.push(...neighbors.get(v)!);}
    expect(visited.size).toBe(range.end-range.start);expect(volume).toBeGreaterThan(1e-9);
   }
  }}finally{props.dispose();}
 });
 it('rests on the actual seabed at both LODs, including triangle interiors',()=>{
  const props=createSeabedProps(7,data);
  try{for(const mesh of meshes(props)){
   const p=mesh.geometry.attributes.position,index=mesh.geometry.index!;
   for(const range of ranges(mesh)){
    let nearest=Infinity;
    const gap=(v:THREE.Vector3)=>v.y-sampleGrid(data,v.x,v.z);
    for(let i=range.start;i<range.end;i++){const q=point(p,i),g=gap(q);expect(g).toBeGreaterThan(-.008);nearest=Math.min(nearest,g);const prop=props.layout[range.id];expect(Math.hypot(q.x-prop.x,q.z-prop.z)).toBeLessThan(prop.radius);}
    expect(nearest).toBeLessThan(.016);
    for(let i=range.indexStart;i<range.indexEnd;i+=3){const a=point(p,index.getX(i)),b=point(p,index.getX(i+1)),c=point(p,index.getX(i+2));expect(gap(a.clone().add(b).add(c).multiplyScalar(1/3))).toBeGreaterThan(-.008);expect(gap(a.add(b).multiplyScalar(.5))).toBeGreaterThan(-.008);}
   }
  }}finally{props.dispose();}
 });
 it('keeps a broad central star disc instead of converging five raised petals at the centre',()=>{
  const props=createSeabedProps(7,data),mesh=meshes(props).find(m=>m.name==='seabed-stars-high')!;
  try{for(const range of ranges(mesh)){
   const prop=props.layout[range.id],center=point(mesh.geometry.attributes.position,range.start);
   const dx=(sampleGrid(data,prop.x+.12,prop.z)-sampleGrid(data,prop.x-.12,prop.z))/.24,dz=(sampleGrid(data,prop.x,prop.z+.12)-sampleGrid(data,prop.x,prop.z-.12))/.24;
   const normal=new THREE.Vector3(-dx,1,-dz).normalize(),u=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,0,1)).normalize(),v=new THREE.Vector3().crossVectors(normal,u).normalize();
   const ray=new THREE.Raycaster(),heights:number[]=[];
   for(let i=0;i<30;i++){
    const a=i*Math.PI*2/30,origin=center.clone().addScaledVector(u,Math.cos(a)*prop.scale*.18).addScaledVector(v,Math.sin(a)*prop.scale*.18).addScaledVector(normal,prop.scale*.1);
    ray.set(origin,normal.clone().negate());const hit=ray.intersectObject(mesh,false)[0];expect(hit).toBeDefined();heights.push(hit.distance/prop.scale);
   }
   // The central 36%-diameter disc should not inherit the deep arm-valley folds.
   expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(.014);
  }}finally{props.dispose();}
 });
 it('has recessed shell interiors behind open apertures, with a capped negative control',()=>{
  const props=createSeabedProps(7,data);
  try{for(const mesh of meshes(props))for(const range of ranges(mesh).filter(r=>r.kind!=='star')){
   const hits=rayThroughAperture(mesh,range);expect(hits.length,`${mesh.name} ${range.kind}: no interior`).toBeGreaterThan(0);
   expect(hits[0],`${mesh.name} ${range.kind}: capped aperture`).toBeGreaterThan(range.aperture!.depth*.5);
   expect(hits[0]).toBeLessThan(props.layout[range.id].scale*1.5);
   // The inner floor/wall is backed by a separate exterior surface.
   expect(hits.some(d=>d>hits[0]+props.layout[range.id].scale*.008)).toBe(true);
   const capped=rayThroughAperture(mesh,range,true);expect(capped[0]).toBeCloseTo(0,5);
  }}finally{props.dispose();}
 });
 it('releases all visible and hidden geometries and both shared materials exactly once',()=>{
  const props=createSeabedProps(7,data),resources=new Set<THREE.BufferGeometry|THREE.Material>();
  for(const m of meshes(props)){resources.add(m.geometry);for(const material of Array.isArray(m.material)?m.material:[m.material])resources.add(material);}
  const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1));
  props.dispose();props.dispose();props.setQuality('high');expect(props.group.children).toHaveLength(0);expect([...counts.values()]).toEqual(Array(6).fill(1));
 });
});

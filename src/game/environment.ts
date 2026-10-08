// Region dressing that sits on top of the shared cove: snow cover, snow caps, falling snow and ice floes.
import * as THREE from 'three';
import type {CoveResources} from '../scene/cove';
import {createCoral,createIceFloe,createLighthouse,disposeTree} from './models';
import type {RegionTheme} from './regions';

const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

function createSnowCover(cove:CoveResources){
 // Follows the terrain just above the ground; alpha fades out toward the wet shoreline.
 const cols=129,rows=97,geometry=new THREE.PlaneGeometry(32,24,cols-1,rows-1);geometry.rotateX(-Math.PI/2);
 const p=geometry.attributes.position as THREE.BufferAttribute,colors=new Float32Array(p.count*4);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),h=cove.sampleHeight(x,z);p.setY(i,h+.035);
  const drift=.9+.1*Math.sin(x*1.7+z*.9)*Math.sin(z*1.3);
  // Several unrelated frequencies keep the snow line from looking like a regular scallop.
  const ragged=.07*Math.sin(x*2.3+z*.9)+.05*Math.sin(x*5.7-z*3.1+1.3)+.035*Math.sin(x*11.3+z*7.9+.4);
  colors.set([.95*drift,.97*drift,1,smooth(.04,.34,h+ragged)],i*4);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,4));geometry.computeVertexNormals();
 // Opaque with alpha-test: the coast capture skips transparent objects; noise gives the snow line a ragged edge.
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,alphaTest:.45,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2}));
}

function createSnowCaps(cove:CoveResources){
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xf6f9fb,roughness:.85});
 for(const rock of cove.data.rocks){
  if(rock.kind!=='boulder')continue;
  const base=cove.sampleHeight(rock.x,rock.z)-.08-rock.height*.18;
  const cap=new THREE.Mesh(new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI/2),material);
  cap.scale.set(rock.radius*.62,rock.height*.22,rock.radius*.52);cap.position.set(rock.x,base+rock.height*.8,rock.z);cap.rotation.y=rock.angle;group.add(cap);
 }
 return group;
}

function createSnowfall(count=700){
 const positions=new Float32Array(count*3),speeds=new Float32Array(count);
 for(let i=0;i<count;i++){positions.set([(Math.random()-.5)*30,Math.random()*12,(Math.random()-.5)*22],i*3);speeds[i]=.5+Math.random()*.6;}
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:.09,transparent:true,opacity:.9,depthWrite:false}));
 points.frustumCulled=false;
 return {points,update(time:number,dt:number){for(let i=0;i<count;i++){let y=positions[i*3+1]-speeds[i]*dt;if(y<0)y+=12;positions[i*3+1]=y;positions[i*3]+=Math.sin(time*.8+i)*dt*.15;}geometry.attributes.position.needsUpdate=true;}};
}

function createRain(count=650){
 // Short streaks falling fast and slightly slanted by wind.
 const positions=new Float32Array(count*6),speeds=new Float32Array(count);
 const seed=(i:number)=>{const x=(Math.random()-.5)*30,y=Math.random()*12,z=(Math.random()-.5)*22;positions.set([x,y,z,x+.06,y+.35,z],i*6);};
 for(let i=0;i<count;i++){seed(i);speeds[i]=7+Math.random()*3;}
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));
 const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xd7e1e6}));lines.frustumCulled=false;
 return {lines,update(dt:number){for(let i=0;i<count;i++){const d=speeds[i]*dt;positions[i*6+1]-=d;positions[i*6+4]-=d;positions[i*6]-=d*.15;positions[i*6+3]-=d*.15;if(positions[i*6+1]<0)seed(i);}geometry.attributes.position.needsUpdate=true;}};
}

function createReef(cove:CoveResources,colors:number[]){
 const group=new THREE.Group();let placed=0;
 for(let tries=0;tries<400&&placed<46;tries++){
  const x=-12+Math.random()*24,z=.5+Math.random()*9,floor=cove.sampleHeight(x,z);
  // Shallow enough to read through the water, deep enough to stay submerged; clear of the mooring.
  if(floor>-.35||floor<-1.7||Math.hypot(x-.4,z-4.2)<1.6||cove.sampleOccupancy(x,z)>.3)continue;
  const coral=createCoral(colors[placed%colors.length]);coral.position.set(x,floor,z);coral.scale.setScalar(1.8+Math.random()*1.4);group.add(coral);placed++;
 }
 return group;
}

export function createRegionEnvironment(cove:CoveResources){
 const group=new THREE.Group();group.name='region-environment';
 let snowfall:ReturnType<typeof createSnowfall>|null=null;
 let floes:{mesh:THREE.Mesh;phase:number;drift:THREE.Vector3;home:THREE.Vector3}[]=[];
 let rain:ReturnType<typeof createRain>|null=null,lamp:THREE.Mesh|null=null;
 const clear=()=>{disposeTree(group);group.clear();snowfall=null;floes=[];rain=null;lamp=null;};
 return {
  group,
  apply(theme:RegionTheme){
   clear();
   if(theme.coral)group.add(createReef(cove,[0xff6f59,0xffd23f,0xb388eb,0xff9fb2,0x3ec1d3]));
   if(theme.rain){rain=createRain();group.add(rain.lines);}
   if(theme.lighthouse){
    // On a small rocky base on the right of the beach, inside the default framing.
    const house=createLighthouse(),x=5.4,z=-5.6,ground=cove.sampleHeight(x,z);
    const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.15,.5,9),new THREE.MeshStandardMaterial({color:0x8b8f8c,roughness:.95}));plinth.position.set(x,ground+.15,z);group.add(plinth);
    house.group.position.set(x,ground+.4,z);house.group.scale.setScalar(.85);group.add(house.group);lamp=house.lamp;
   }
   if(!theme.snow)return;
   group.add(createSnowCover(cove),createSnowCaps(cove));
   snowfall=createSnowfall();group.add(snowfall.points);
   // Floes keep clear of the mooring (0.4, 4.2) and the route to the landing.
   for(const [x,z,r] of [[-6,6.5,.9],[-9,3.2,.7],[5.5,9.5,1.1],[-3.5,9.8,.8],[8.5,3.6,.6],[3.8,7.4,.5],[-7.5,9,.6]] as const){
    const mesh=createIceFloe(r);mesh.position.set(x,0,z);mesh.rotation.y=Math.random()*6;group.add(mesh);
    floes.push({mesh,phase:Math.random()*6,drift:new THREE.Vector3((Math.random()-.5)*.08,0,(Math.random()-.5)*.08),home:new THREE.Vector3(x,0,z)});
   }
  },
  update(time:number,dt:number,tide:number){
   snowfall?.update(time,Math.min(dt,.1));
   rain?.update(Math.min(dt,.1));
   if(lamp)(lamp.material as THREE.MeshStandardMaterial).emissiveIntensity=.6+1.4*Math.max(0,Math.sin(time*1.6));
   for(const f of floes){
    f.mesh.position.x=f.home.x+Math.sin(time*.05+f.phase)*.6;f.mesh.position.z=f.home.z+Math.cos(time*.04+f.phase)*.4;
    f.mesh.position.y=tide-.06+Math.sin(time*1.1+f.phase)*.025;f.mesh.rotation.z=Math.sin(time*.9+f.phase)*.02;
   }
  },
  dispose:clear,
 };
}

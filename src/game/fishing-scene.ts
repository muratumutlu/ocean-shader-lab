// Scene director for game mode: boat, fisherman, catch, sale and spill animations.
// It only reacts to host events and progress; it never changes game state.
import * as THREE from 'three';
import type {SceneContext} from '../runtime/demo';
import {createRegionEnvironment} from './environment';
import {roleOf,themeFor,type RegionTheme} from './regions';
import type {GameSave,HostEvent} from './host';
import {createFishSchools} from './fish-schools';
import {createBoat,createBucket,createBuoy,createCoin,createFigure,createFish,createFloat,createHut,createIgloo,createLabel,createRing,createShed,createStall,disposeTree,type Boat,type Figure} from './models';

type Task={update(dt:number):boolean};
const MOORING=new THREE.Vector3(.4,0,4.2);
const LANDING=new THREE.Vector3(-1.4,0,-.4);
/** The boat moors facing open, on-screen water; the line is cast straight off the bow. */
const MOORING_HEADING=1.2;
const CAST_OFFSET=new THREE.Vector3(Math.sin(MOORING_HEADING)*3.4,0,Math.cos(MOORING_HEADING)*3.4);
/** Hero objects are scaled up so they read clearly from the default diorama camera. */
const HERO_SCALE=1.7;
const ease=(t:number)=>t<.5?2*t*t:1-(-2*t+2)**2/2;
const FISH_TINTS=[0x8fb2c4,0xa7b6a0,0xc9a27a,0x9fa9c9,0xb8c4c9];

export type FishingScene=ReturnType<typeof createFishingScene>;
export function createFishingScene(context:SceneContext){
 const cove=context.cove;
 let theme:RegionTheme=themeFor('med');
 const root=new THREE.Group();root.name='fishing-game';
 const world=new THREE.Group();root.add(world);
 let tide=0,swell=.55,time=0;
 // Boat rig: `boatRoot` carries position/heading; the boat model can be swapped per tier.
 const boatRoot=new THREE.Group();world.add(boatRoot);boatRoot.position.copy(MOORING);boatRoot.rotation.y=MOORING_HEADING;boatRoot.scale.setScalar(HERO_SCALE);
 let boat:Boat=createBoat(0);boatRoot.add(boat.group);
 const FISHER_OUTFITS:Record<RegionTheme['outfit'],Parameters<typeof createFigure>[0]>={
  breton:{shirt:'breton',trousers:0x3b4a5c,hat:'cap',beard:true},
  parka:{shirt:'breton',parka:0xc8452f,trousers:0x3b4a5c,hat:'hood',beard:true},
  tropical:{shirt:0xf5efe0,trousers:0x4f6b5a,hat:'straw',beard:true,skin:0xc98d64},
  slicker:{shirt:0xf2c230,trousers:0x2e3a44,hat:'souwester',beard:true},
 };
 const makeFisher=(t:RegionTheme)=>createFigure(FISHER_OUTFITS[t.outfit]);
 const makeStall=(t:RegionTheme)=>t.stall==='igloo'?createIgloo():t.stall==='hut'?createHut():t.stall==='shed'?createShed():createStall();
 let fisher:Figure=makeFisher(theme);
 const bucket=createBucket();
 const rod=new THREE.Group(),rodPole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.018,1.7,6),new THREE.MeshStandardMaterial({color:0x4a3524,roughness:.6}));rodPole.position.y=.85;rod.add(rodPole);
 const reel=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.04,10),new THREE.MeshStandardMaterial({color:0x9aa3a6,metalness:.7,roughness:.4}));reel.rotation.z=Math.PI/2;reel.position.set(.03,.25,0);reel.visible=false;rod.add(reel);
 const rodTip=new THREE.Object3D();rodTip.position.y=1.7;rod.add(rodTip);
 const float=createFloat();float.scale.setScalar(HERO_SCALE);world.add(float);float.visible=false;
 const lineGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
 const line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0x2a2a2a,transparent:true,opacity:.7}));line.frustumCulled=false;world.add(line);line.visible=false;
 let stall:ReturnType<typeof createStall>=createStall();world.add(stall.group);
 const stallPos=new THREE.Vector3(-2.2,0,-4.6);stallPos.y=cove.sampleHeight(stallPos.x,stallPos.z);
 const placeStall=()=>{stall.group.position.copy(stallPos);stall.group.rotation.y=.25;stall.group.scale.setScalar(theme.stall==='igloo'?1.25:theme.stall==='shed'?1.2:1.4);};placeStall();
 const environment=createRegionEnvironment(cove);world.add(environment.group);
 const crew:Record<string,Figure>={};
 const gear=new THREE.Group();world.add(gear);
 const effects=new THREE.Group();world.add(effects);
 const schools=createFishSchools(cove);world.add(schools.group);
 let tasks:Task[]=[];
 let floatSettled=false,dipping=false,fishing=false,shownFish=0,targetFish=0,ownedKey='',busy=false,rodPitch=.15,headNod=0,coinCount=0;
 const castPoint=new THREE.Vector3();

 function mountOnBoat(){
  boat.deck.add(fisher.group);fisher.group.position.set(.12,0,boat.sternZ+.25);fisher.group.rotation.y=0;
  fisher.rightArm.add(rod);rod.position.set(0,-.34,0);
  boat.deck.add(bucket.group);bucket.group.position.set(-.18,0,boat.sternZ+.75);
  placeCrew();
 }
 function placeCrew(){
  // Spread crew along the boat: deckhand at the bow, net mender amidships, skipper between them.
  const span=boat.bowZ-boat.sternZ,at=(k:number)=>boat.sternZ+span*k;
  // Boats with a cabin keep its footprint (roughly k .39–.87) clear of crew.
  const cabin=boat.tier>=4;
  const spots:Record<string,[number,number,number]>=cabin
   ?{'crew.deckhand':[0,0,at(.93)],'crew.net-mender':[-.22,0,at(.3)],'crew.skipper':[.22,0,at(.33)]}
   :{'crew.deckhand':[0,0,at(.86)],'crew.net-mender':[-.2,0,at(.5)],'crew.skipper':[.18,0,at(.68)]};
  for(const [id,figure] of Object.entries(crew)){const s=spots[id];boat.deck.add(figure.group);figure.group.position.set(s[0],s[1],s[2]);figure.group.rotation.y=id==='crew.deckhand'?0:id==='crew.net-mender'?Math.PI/2:-Math.PI/2;}
 }
 mountOnBoat();

 /** Rebuild boat tier, crew and gear from the owned upgrade list. */
 function applyOwned(owned:string[]){
  const key=theme.id+':'+owned.slice().sort().join(',');if(key===ownedKey)return;ownedKey=key;
  // Roles let every region reuse the same visuals (e.g. arctic.eq.sonar acts as the fish finder).
  const has=new Set(owned.map(roleOf));
  const tier=owned.filter(id=>roleOf(id).startsWith('boat.')).length;
  if(tier!==boat.tier||boat.group.userData.theme!==theme.id){boatRoot.remove(boat.group);fisher.group.removeFromParent();bucket.group.removeFromParent();for(const f of Object.values(crew))f.group.removeFromParent();disposeBoat(boat);boat=createBoat(Math.min(6,tier),theme);boat.group.userData.theme=theme.id;boatRoot.add(boat.group);mountOnBoat();}
  const CREW:Record<RegionTheme['outfit'],Record<string,Parameters<typeof createFigure>[0]>>={
   breton:{'crew.deckhand':{shirt:0xb5432f,trousers:0x34404c,hat:'beanie'},'crew.net-mender':{shirt:0x4f7a5a,trousers:0x4a4136,hat:'none',skin:0xb98563},'crew.skipper':{shirt:0xf4f1e8,trousers:0x1b2a44,hat:'captain',beard:true}},
   parka:{'crew.deckhand':{shirt:0xb5432f,trousers:0x34404c,hat:'hood',parka:0xe0a63a},'crew.net-mender':{shirt:0x4f7a5a,trousers:0x4a4136,hat:'hood',skin:0xb98563,parka:0x4f7a5a},'crew.skipper':{shirt:0xf4f1e8,trousers:0x1b2a44,hat:'hood',beard:true,parka:0x2f5d7c}},
   tropical:{'crew.deckhand':{shirt:0xff8a3d,trousers:0x3d4f5f,hat:'straw',skin:0x9c6644},'crew.net-mender':{shirt:0x2fa3a3,trousers:0x4a4136,hat:'none',skin:0x7a4e33},'crew.skipper':{shirt:0xf5efe0,trousers:0x2b3a4a,hat:'straw',beard:true,skin:0xb07a52}},
   slicker:{'crew.deckhand':{shirt:0xf28c28,trousers:0x2e3a44,hat:'souwester'},'crew.net-mender':{shirt:0xf2c230,trousers:0x2e3a44,hat:'beanie',skin:0xb98563},'crew.skipper':{shirt:0x1f3442,trousers:0x1b2a44,hat:'captain',beard:true}},
  };
  const crewSpecs=CREW[theme.outfit];
  for(const [id,spec] of Object.entries(crewSpecs))if(has.has(id)&&!crew[id])crew[id]=createFigure(spec);
  placeCrew();
  reel.visible=has.has('eq.reel-rod');
  disposeTree(gear);gear.clear();
  const ring=(count:number,radius:number,color:number)=>{for(let i=0;i<count;i++){const b=createBuoy(color);const a=i/count*Math.PI*2;b.position.set(MOORING.x+Math.cos(a)*radius,0,MOORING.z+1.4+Math.sin(a)*radius*.6);b.userData.phase=a;gear.add(b);}};
  if(has.has('eq.longline'))ring(6,2.2,0xe8742a);
  if(has.has('eq.purse-seine'))ring(10,3,0xf2c94c);
  const extras:[string,THREE.Mesh,[number,number,number]][]=[
   ['eq.bait-box',new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.16),new THREE.MeshStandardMaterial({color:0x4f7a5a,roughness:.8})),[.3,.06,0]],
   ['eq.ice-chest',new THREE.Mesh(new THREE.BoxGeometry(.36,.22,.24),new THREE.MeshStandardMaterial({color:0xf4f6f6,roughness:.5})),[-.28,.11,.25]],
   ['eq.fish-finder',new THREE.Mesh(new THREE.BoxGeometry(.18,.14,.05),new THREE.MeshStandardMaterial({color:0x1d2a30,emissive:0x2bd17e,emissiveIntensity:.35,roughness:.4})),[.32,.3,.5]],
   ['eq.cast-net',new THREE.Mesh(new THREE.SphereGeometry(.2,10,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xcfc6a8,roughness:1,wireframe:true})),[.05,.02,.85]],
   ['eq.trammel-net',new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.3),new THREE.MeshStandardMaterial({color:0x6b8f7a,roughness:1,wireframe:true})),[-.25,.06,.75]],
  ];
  for(const [id,mesh,[x,y,z]] of extras){const old=boat.deck.getObjectByName(id);if(old){boat.deck.remove(old);disposeTree(old);}if(has.has(id)){mesh.name=id;mesh.position.set(x,y,boat.sternZ+.6+z);boat.deck.add(mesh);}else disposeTree(mesh);}
 }
 /** Re-dresses the cove, fisherman, crew, stall and fish for a region. */
 function applyTheme(regionId:string){
  const next=themeFor(regionId);if(next.id===theme.id&&environment.group.userData.applied)return;
  theme=next;environment.group.userData.applied=true;
  context.setBackground(theme.background);context.setWaterTint(theme.waterTint);context.setPalmsVisible(theme.palms);
  environment.apply(theme);schools.setTints(theme.fishTints);
  // New outfit: swap the fisherman (the rod moves with him) and let crew be rebuilt by applyOwned.
  const parent=fisher.group.parent,pos=fisher.group.position.clone();fisher.group.removeFromParent();disposeTree(fisher.group);
  fisher=makeFisher(theme);if(parent){parent.add(fisher.group);fisher.group.position.copy(pos);}fisher.rightArm.add(rod);rod.position.set(0,-.34,0);
  for(const [role,figure] of Object.entries(crew)){figure.group.removeFromParent();disposeTree(figure.group);delete crew[role];}
  world.remove(stall.group);disposeTree(stall.group);stall=makeStall(theme);world.add(stall.group);placeStall();coinCount=0;
  ownedKey='';
 }
 function disposeBoat(b:Boat){b.group.traverse(o=>{if(o instanceof THREE.Mesh&&!isShared(o)){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}
 const isShared=(o:THREE.Object3D)=>{let p:THREE.Object3D|null=o;while(p){if(p===fisher.group||p===bucket.group||Object.values(crew).some(c=>c.group===p))return true;p=p.parent;}return false;};

 // ---- playful idle actions ----
 type Action='wave'|'stretch'|'hop'|'look'|'dance'|'cheer';
 type Acting={figure:Figure;action:Action;t:number;duration:number};
 let acting:Acting[]=[],nextAction=3;
 const crewTimers=new Map<Figure,number>();
 /** Actions the fisherman can do while his right hand holds the rod. */
 const ROD_SAFE:Action[]=['wave','hop','look','cheer'];
 const FREE:Action[]=['wave','stretch','hop','look','dance','cheer'];
 function act(figure:Figure,action:Action){if(acting.some(a=>a.figure===figure))return;acting.push({figure,action,t:0,duration:{wave:2.2,stretch:1.8,hop:.7,look:2.4,dance:3,cheer:1.4}[action]});}
 function animateActors(dt:number){
  if(!busy){nextAction-=dt;if(nextAction<=0){nextAction=4+Math.random()*6;const pool=fishing||dipping?ROD_SAFE:FREE;act(fisher,pool[Math.floor(Math.random()*pool.length)]);}}
  for(const figure of Object.values(crew)){const left=(crewTimers.get(figure)??2+Math.random()*6)-dt;if(left<=0){crewTimers.set(figure,5+Math.random()*8);act(figure,FREE[Math.floor(Math.random()*FREE.length)]);}else crewTimers.set(figure,left);}
  acting=acting.filter(a=>{
   a.t+=dt;const k=Math.min(1,a.t/a.duration),env=Math.sin(k*Math.PI),f=a.figure,isFisher=f===fisher;
   switch(a.action){
    case 'wave':f.leftArm.rotation.x=-2.6*env;f.leftArm.rotation.z=-.4*env+Math.sin(a.t*14)*.35*env;break;
    case 'stretch':f.leftArm.rotation.x=-2.9*env;if(!isFisher||!fishing)f.rightArm.rotation.x=-2.9*env;f.torso.rotation.x=-.15*env;break;
    case 'hop':f.group.position.y=Math.max(0,Math.sin(k*Math.PI))*.28;f.leftArm.rotation.x=-1.2*env;break;
    case 'look':f.head.rotation.y=Math.sin(k*Math.PI*2)*.9;break;
    case 'dance':f.torso.rotation.z=Math.sin(a.t*8)*.18*env;f.group.rotation.y+=Math.sin(a.t*6)*.03;f.leftArm.rotation.x=-1.6*env+Math.sin(a.t*10)*.3;if(!isFisher||!fishing)f.rightArm.rotation.x=-1.6*env-Math.sin(a.t*10)*.3;f.group.position.y=Math.abs(Math.sin(a.t*8))*.06*env;break;
    case 'cheer':f.leftArm.rotation.x=-2.8*env;f.group.position.y=Math.abs(Math.sin(a.t*9))*.12*env;break;
   }
   if(k>=1){f.leftArm.rotation.z=0;f.torso.rotation.x=0;f.torso.rotation.z=0;f.group.position.y=0;f.head.rotation.y=0;return false;}
   return true;
  });
 }
 const isActing=(figure:Figure)=>acting.some(a=>a.figure===figure);

 // ---- bucket contents ----
 function setBucketFish(count:number){
  const slots=bucket.fishSlots;while(slots.children.length>count){const f=slots.children[slots.children.length-1];slots.remove(f);disposeTree(f);}
  while(slots.children.length<count){const i=slots.children.length,f=createFish(FISH_TINTS[i%FISH_TINTS.length]);const layer=Math.floor(i/5),a=i*2.4;f.scale.setScalar(.55);f.position.set(Math.cos(a)*.07,layer*.04+.1,Math.sin(a)*.07);f.rotation.set(.3*Math.sin(i),a,0);slots.add(f);}
  // Overflowing catches pile up beside the bucket.
  bucket.fishSlots.scale.setScalar(1);
 }
 // ---- helpers ----
 const worldOf=(o:THREE.Object3D)=>o.getWorldPosition(new THREE.Vector3());
 const toLocal=(v:THREE.Vector3)=>world.worldToLocal(v.clone());
 function ripple(at:THREE.Vector3,size=1){const ring=createRing();ring.position.set(at.x,tide+.02,at.z);effects.add(ring);let t=0;tasks.push({update(dt){t+=dt;ring.scale.setScalar(1+t*3*size);(ring.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.8-t*.7);if(t>1.2){effects.remove(ring);disposeTree(ring);return true;}return false;}});}
 function arc(object:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3,height:number,duration:number,done?:()=>void,spin=8){
  effects.add(object);object.position.copy(from);let t=0;
  tasks.push({update(dt){t+=dt/duration;const k=Math.min(1,t);object.position.lerpVectors(from,to,k);object.position.y+=Math.sin(k*Math.PI)*height;object.rotation.z+=dt*spin;if(k>=1){done?.();return true;}return false;}});
 }
 function wait(seconds:number,then:()=>void){let t=0;tasks.push({update(dt){t+=dt;if(t>=seconds){then();return true;}return false;}});}

 function cast(){
  fishing=true;float.visible=true;line.visible=true;
  castPoint.copy(MOORING).add(CAST_OFFSET);
  let t=0;const start=worldOf(rodTip);
  tasks.push({update(dt){t+=dt;rodPitch=t<.35?.15-.65*(t/.35):-.5+1.5*ease(Math.min(1,(t-.35)/.3));
   const k=Math.min(1,Math.max(0,(t-.45)/.8));const p=start.clone().lerp(castPoint,k);p.y=THREE.MathUtils.lerp(start.y,tide,k)+Math.sin(k*Math.PI)*1.2;float.position.copy(toLocal(p));
   if(t>=1.25){rodPitch=.75;floatSettled=true;ripple(castPoint,.8);return true;}return false;}});
 }
 function reelIn(){floatSettled=false;dipping=false;fishing=false;float.visible=false;line.visible=false;rodPitch=.15;}
 function catchFish(){
  const from=float.getWorldPosition(new THREE.Vector3()),fish=createFish(FISH_TINTS[shownFish%FISH_TINTS.length]);fish.scale.setScalar(1.15);
  ripple(from,.6);dipping=true;let dip=0;tasks.push({update(dt){if(!fishing){dipping=false;return true;}dip+=dt;float.position.set(castPoint.x,tide-.06*Math.sin(Math.min(1,dip/.3)*Math.PI),castPoint.z);rodPitch=.75+.35*Math.sin(Math.min(1,dip/.6)*Math.PI);if(dip>.6){dipping=false;rodPitch=.75;return true;}return false;}});
  const target=worldOf(bucket.group).add(new THREE.Vector3(0,.25,0));
  wait(.25,()=>arc(fish,toLocal(from),toLocal(target),1.1,.9,()=>{effects.remove(fish);disposeTree(fish);setBucketFish(Math.min(shownFish,15));},10));
 }

 function sail(from:THREE.Vector3,to:THREE.Vector3,headingFrom:number,headingTo:number,duration:number,then:()=>void){
  let t=0;tasks.push({update(dt){t+=dt/duration;const k=ease(Math.min(1,t));boatRoot.position.lerpVectors(from,to,k);boatRoot.rotation.y=THREE.MathUtils.lerp(headingFrom,headingTo,Math.min(1,k*1.6));if(t>=1){then();return true;}return false;}});
 }
 function sell(fishCount:number,money:number){
  busy=true;reelIn();
  sail(MOORING,LANDING,MOORING_HEADING,Math.PI*.95,3.2,()=>{
   const flights=Math.max(1,Math.min(12,fishCount));let landed=0;
   for(let i=0;i<flights;i++)wait(i*.18,()=>{
    const fish=createFish(FISH_TINTS[i%FISH_TINTS.length]);fish.scale.setScalar(1.15);
    const target=worldOf(stall.fishOnIce).add(new THREE.Vector3((i%6)*.16-.4,0,Math.floor(i/6)*.14-.07));
    arc(fish,toLocal(worldOf(bucket.group).add(new THREE.Vector3(0,.3,0))),toLocal(target),1.6,1,()=>{effects.remove(fish);fish.position.copy(stall.fishOnIce.worldToLocal(target.clone()));fish.rotation.set(0,Math.random()*.4-.2,Math.PI/2*0);stall.fishOnIce.add(fish);landed++;if(landed===flights){setBucketFish(0);coinBurst(money);}},6);
   });
  });
 }
 function floatLabel(text:string,at:THREE.Vector3,color?:string,glyph:'coin'|'fish'|null=null){
  const label=createLabel(text,color,glyph);label.position.copy(toLocal(at));effects.add(label);let t=0;const start=label.position.y;
  tasks.push({update(dt){t+=dt;label.position.y=start+t*.6;(label.material as THREE.SpriteMaterial).opacity=Math.min(1,t*4)*Math.max(0,1-(t-1.6)/.8);if(t>2.4){effects.remove(label);disposeTree(label);(label.material as THREE.SpriteMaterial).map?.dispose();(label.material as THREE.SpriteMaterial).dispose();return true;}return false;}});
 }
 function coinBurst(money:number){
  const bursts=Math.max(4,Math.min(24,Math.round(money/3)));const origin=worldOf(stall.coins);
  floatLabel('+'+money,worldOf(stall.group).add(new THREE.Vector3(0,2.6,0)),undefined,'coin');
  acting=acting.filter(x=>x.figure!==fisher);act(fisher,'cheer');for(const f of Object.values(crew))act(f,'hop');
  for(let i=0;i<bursts;i++)wait(i*.06,()=>{const coin=createCoin();const a=Math.random()*Math.PI*2,r=.15+Math.random()*.25;
   const pile=nextCoinSpot();arc(coin,toLocal(origin.clone().add(new THREE.Vector3(Math.cos(a)*r,.1,Math.sin(a)*r))),toLocal(worldOf(stall.coins).add(pile)),1.2+Math.random()*.6,.9,()=>{effects.remove(coin);coin.position.copy(pile);coin.rotation.set(0,0,0);stall.coins.add(coin);},14);});
  wait(bursts*.06+2.2,()=>{for(const f of [...stall.fishOnIce.children]){stall.fishOnIce.remove(f);disposeTree(f);}
   sail(LANDING,MOORING,Math.PI*.95,MOORING_HEADING,3.2,()=>{boatRoot.rotation.y=MOORING_HEADING;busy=false;});});
 }
 /** Coins spread in a golden-angle spiral that slowly heaps up toward the middle. */
 function nextCoinSpot(){const i=coinCount++,r=Math.min(.32,.03*Math.sqrt(i)),a=i*2.39996;return new THREE.Vector3(Math.cos(a)*r,.013*Math.floor(i/14)+Math.max(0,.06-r*.2)*Math.min(1,i/40),Math.sin(a)*r*.7);}
 function syncCoins(money:number){
  const want=Math.min(160,Math.round(Math.sqrt(money)*2.2));
  while(stall.coins.children.length>want){const c=stall.coins.children[stall.coins.children.length-1];stall.coins.remove(c);disposeTree(c);coinCount=stall.coins.children.length;}
  while(stall.coins.children.length<want){const c=createCoin();c.position.copy(nextCoinSpot());stall.coins.add(c);}
 }
 function spill(){
  busy=true;reelIn();const count=bucket.fishSlots.children.length;let t=0;const start=bucket.group.position.clone();
  if(count)floatLabel('-'+count,worldOf(bucket.group).add(new THREE.Vector3(0,1.4,0)),'#f0a08c','fish');
  tasks.push({update(dt){t+=dt;const k=ease(Math.min(1,t/.6));bucket.group.position.set(start.x-.3*k,start.y+.25*k,start.z);bucket.group.rotation.z=1.9*k;headNod=.5*Math.min(1,t/.6);
   if(t>=.6){
    const from=worldOf(bucket.group);for(let i=0;i<Math.max(count,3);i++)wait(i*.07,()=>{const fish=createFish(FISH_TINTS[i%FISH_TINTS.length]);fish.scale.setScalar(1.15);
     const to=from.clone().add(new THREE.Vector3(-.6-Math.random()*1.4,0,(Math.random()-.5)*1.6));to.y=tide-.05;
     arc(fish,toLocal(from),toLocal(to),.5,.7,()=>{ripple(to,.7);let s=0;tasks.push({update(dt2){s+=dt2;fish.position.y-=dt2*.5;fish.rotation.z+=dt2*2;if(s>1.4){effects.remove(fish);disposeTree(fish);return true;}return false;}});},9);});
    setBucketFish(0);
    wait(2.4,()=>{let r=0;tasks.push({update(dt2){r+=dt2;const k2=1-ease(Math.min(1,r/.5));bucket.group.position.set(start.x-.3*k2,start.y+.25*k2,start.z);bucket.group.rotation.z=1.9*k2;headNod=.5*k2;if(r>=.5){busy=false;return true;}return false;}});});
    return true;}
   return false;}});
 }

 return {
  group:root,
  /** Called every frame with scene time; tide/swell come from the coast controls. */
  update(elapsed:number,dt:number,controls:{tide:number;swell:number}){
   time=elapsed;tide=controls.tide;swell=controls.swell;
   const bob=.035+.06*swell;
   boatRoot.position.y=tide+Math.sin(time*1.3)*bob*.6-.02;
   boat.group.rotation.x=Math.sin(time*.9+.4)*bob*.35;boat.group.rotation.z=Math.sin(time*1.1)*bob*.5;
   // rodPitch is the rod's tilt from vertical toward the bow; subtract the arm so the rod ignores arm pose.
   const fisherActing=isActing(fisher);
   if(!fisherActing||fishing)fisher.rightArm.rotation.x=fishing||rodPitch<-.3?-1.05:-.2;
   rod.rotation.x=THREE.MathUtils.lerp(rod.rotation.x,rodPitch-fisher.rightArm.rotation.x,Math.min(1,dt*10));if(!fisherActing)fisher.leftArm.rotation.x=fishing?-.6:Math.sin(time*.8)*.05;
   fisher.head.rotation.x=headNod;if(!fisherActing)fisher.torso.rotation.z=Math.sin(time*.7)*.02;
   for(const f of Object.values(crew)){if(isActing(f))continue;f.leftArm.rotation.x=Math.sin(time*1.4+f.group.position.z)*.4-.3;f.head.rotation.y=Math.sin(time*.5+f.group.position.z)*.3;}
   for(const b of gear.children)b.position.y=tide+Math.sin(time*1.7+(b.userData.phase as number))*.03;
   if(floatSettled&&!dipping){float.position.set(castPoint.x,tide+Math.sin(time*2.1)*.015,castPoint.z);}
   if(line.visible){const a=world.worldToLocal(worldOf(rodTip)),b=float.position,p=lineGeometry.attributes.position as THREE.BufferAttribute;p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true;}
   // Tasks may schedule new tasks while running; collect those separately so none are dropped.
   const running=tasks;tasks=[];const alive=running.filter(task=>!task.update(Math.min(dt,.1)));tasks=alive.concat(tasks);
   schools.update(time,dt,tide);
   environment.update(time,dt,tide);
   animateActors(dt);
  },
  /** Progress of the running focus session; reveals one catch per expected fish. */
  setProgress(progress:number,expectedFish:number){
   targetFish=Math.floor(expectedFish*progress);
   if(!fishing||busy)return;
   if(targetFish>shownFish){shownFish++;catchFish();}
  },
  handle(event:HostEvent){
   switch(event.type){
    case 'state':applyTheme(event.save.currentRegionId);applyOwned(event.save.regions[event.save.currentRegionId]?.owned??[]);syncCoins(event.save.regions[event.save.currentRegionId]?.money??0);break;
    case 'started':if(event.session.kind==='focus'){shownFish=0;setBucketFish(0);cast();}break;
    case 'completed':shownFish=0;sell(event.fish,event.money);break;
    case 'abandoned':shownFish=0;spill();break;
    case 'breakDone':break;
   }
  },
  /** Restore visuals for a session that was already running when the page loaded. */
  resume(save:GameSave,progress:number,expectedFish:number){
   if(save.active?.kind!=='focus')return;shownFish=Math.floor(expectedFish*progress);setBucketFish(Math.min(shownFish,15));
   fishing=true;floatSettled=true;float.visible=true;line.visible=true;castPoint.copy(MOORING).add(CAST_OFFSET);rodPitch=.75;
  },
  debug(){return {tasks:tasks.length,busy,fishing,boat:boatRoot.position.toArray().map(v=>+v.toFixed(2))};},
  dispose(){tasks=[];schools.dispose();environment.dispose();disposeTree(root);lineGeometry.dispose();},
 };
}

// Procedural low-poly models for the fishing game, sized for the 32×24 cove diorama.
import * as THREE from 'three';

const mat=(color:number,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});

function stripeTexture(a:string,b:string,stripes:number,vertical=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const g=canvas.getContext('2d')!;
 for(let i=0;i<stripes;i++){g.fillStyle=i%2?b:a;if(vertical)g.fillRect(i*64/stripes,0,64/stripes+1,64);else g.fillRect(0,i*64/stripes,64,64/stripes+1);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export type Figure={group:THREE.Group;rightArm:THREE.Group;leftArm:THREE.Group;torso:THREE.Mesh;head:THREE.Group};
/** A stylised person ~1.05 units tall, origin at the feet, facing +Z. */
export function createFigure(options:{shirt:'breton'|number;trousers:number;hat:'cap'|'captain'|'beanie'|'hood'|'none';skin?:number;beard?:boolean;parka?:number}):Figure{
 const group=new THREE.Group(),skin=mat(options.skin??0xd9a27e,.7);
 const shirt=options.parka!==undefined?mat(options.parka,.95):options.shirt==='breton'?new THREE.MeshStandardMaterial({map:stripeTexture('#f4f1e8','#1f3b63',8),roughness:.85}):mat(options.shirt,.85);
 const trousers=mat(options.trousers,.9);
 for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.34,4,8),trousers);leg.position.set(side*.09,.25,0);group.add(leg);
  const boot=new THREE.Mesh(new THREE.BoxGeometry(.13,.08,.2),mat(0x2b2420,.9));boot.position.set(side*.09,.04,.03);group.add(boot);}
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.28,4,10),shirt);torso.position.y=.66;torso.scale.z=.8;group.add(torso);
 const arm=(side:number)=>{const pivot=new THREE.Group();pivot.position.set(side*.21,.8,0);
  const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.26,4,8),shirt);upper.position.y=-.16;pivot.add(upper);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),skin);hand.position.y=-.34;pivot.add(hand);group.add(pivot);return pivot;};
 const rightArm=arm(-1),leftArm=arm(1);
 const head=new THREE.Group();head.position.y=.98;group.add(head);
 const skull=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),skin);head.add(skull);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6),skin);nose.position.set(0,-.01,.125);head.add(nose);
 for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.016,6,6),mat(0x1d1d1d,.4));eye.position.set(side*.045,.03,.115);head.add(eye);}
 if(options.beard){const beard=new THREE.Mesh(new THREE.SphereGeometry(.12,12,10,0,Math.PI*2,Math.PI*.45,Math.PI*.55),mat(0xd8d4cc,1));beard.position.set(0,-.02,.02);head.add(beard);}
 if(options.hat==='cap'){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.08,16),mat(0x22344f,.9));cap.position.y=.1;head.add(cap);const brim=new THREE.Mesh(new THREE.BoxGeometry(.2,.015,.1),mat(0x1a1a1a,.6));brim.position.set(0,.07,.13);head.add(brim);}
 if(options.hat==='captain'){const top=new THREE.Mesh(new THREE.CylinderGeometry(.15,.13,.07,16),mat(0xf4f1e8,.6));top.position.y=.12;head.add(top);const band=new THREE.Mesh(new THREE.CylinderGeometry(.132,.132,.04,16),mat(0x1b2a44,.7));band.position.y=.08;head.add(band);const brim=new THREE.Mesh(new THREE.BoxGeometry(.2,.015,.1),mat(0x111111,.4));brim.position.set(0,.07,.13);head.add(brim);}
 if(options.hat==='hood'){
  // Parka hood with a fluffy fur rim framing the face.
  const hood=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12,0,Math.PI*2,0,Math.PI*.62),shirt);hood.position.set(0,.02,-.02);hood.rotation.x=-.25;head.add(hood);
  const fur=new THREE.Mesh(new THREE.TorusGeometry(.12,.04,8,20),mat(0xf2ede4,1));fur.position.set(0,0,.07);head.add(fur);
  const hem=new THREE.Mesh(new THREE.TorusGeometry(.2,.035,6,20),mat(0xf2ede4,1));hem.rotation.x=Math.PI/2;hem.position.y=.47;group.add(hem);
  for(const pivot of [rightArm,leftArm]){const mitten=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),mat(0x3d5a73,.9));mitten.position.y=-.34;pivot.add(mitten);}
 }
 if(options.hat==='beanie'){const beanie=new THREE.Mesh(new THREE.SphereGeometry(.135,14,10,0,Math.PI*2,0,Math.PI*.55),mat(0xb3462f,1));beanie.position.y=.02;head.add(beanie);}
 group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});
 return {group,rightArm,leftArm,torso,head};
}

/** A fish ~0.28 units long pointing along +X. */
export function createFish(tint=0x8fb2c4):THREE.Group{
 const group=new THREE.Group(),body=mat(tint,.4,.12);
 const b=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),body);b.scale.set(1.4,.6,.45);group.add(b);
 const tail=new THREE.Mesh(new THREE.ConeGeometry(.07,.12,4),body);tail.rotation.z=Math.PI/2;tail.scale.set(1,1,.3);tail.position.x=-.17;group.add(tail);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.012,6,6),mat(0x111111,.3));eye.position.set(.1,.02,.035);group.add(eye);
 return group;
}

export function createBucket(){
 const group=new THREE.Group(),metal=mat(0xc3cacc,.5,.15);
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(.2,.16,.26,18,1,true),metal);shell.position.y=.13;(shell.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;group.add(shell);
 const bottom=new THREE.Mesh(new THREE.CircleGeometry(.16,18),metal);bottom.rotation.x=-Math.PI/2;bottom.position.y=.005;group.add(bottom);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.2,.008,6,24,Math.PI),mat(0x8d9597,.5,.2));handle.position.y=.26;group.add(handle);
 const fishSlots=new THREE.Group();fishSlots.position.y=.04;group.add(fishSlots);
 return {group,fishSlots};
}

export type Boat={group:THREE.Group;deck:THREE.Group;length:number;sternZ:number;bowZ:number;tier:number};
/** Boat tiers: 0 dinghy · 1 dinghy+oars · 2 rowboat · 3 outboard · 4 cabin · 5 gulet · 6 gulet with sail. Bow points to +Z. */
export function createBoat(tier:number,palette:{hull:number[];trim:number}={hull:[0x8b5a3c,0x8b5a3c,0x2f6f8f,0x2f6f8f,0xf1ece0,0x9a6a43,0x9a6a43],trim:0xf4f1e8}):Boat{
 const group=new THREE.Group(),deck=new THREE.Group();group.add(deck);
 const length=[2,2,2.5,2.6,3,3.8,3.8][tier],beam=[.85,.85,1,1,1.15,1.35,1.35][tier],height=tier>=5?.55:.4;
 const hullColor=palette.hull[tier];
 const L=length/2,B=beam/2;
 const outline=(k:number)=>{const o=new THREE.Shape();o.moveTo(0,L*k);o.bezierCurveTo(B*.9*k,L*.55*k,B*k,L*.05*k,B*k,-L*.55*k);o.quadraticCurveTo(B*.95*k,-L*k,0,-L*k);o.quadraticCurveTo(-B*.95*k,-L*k,-B*k,-L*.55*k);o.bezierCurveTo(-B*k,L*.05*k,-B*.9*k,L*.55*k,0,L*k);return o;};
 const ring=(outer:number,inner:number)=>{const o=outline(outer);o.holes.push(new THREE.Path(outline(inner).getPoints(48).reverse()));return o;};
 const extrude=(s:THREE.Shape,depth:number,bevel=true)=>{const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel,bevelThickness:.03,bevelSize:.03,bevelSegments:2,curveSegments:24});g.rotateX(-Math.PI/2);return g;};
 // Hollow hull walls plus a separate bottom so the boat is open from above.
 const hullMaterial=mat(hullColor,.75);
 const hull=new THREE.Mesh(extrude(ring(1,.88),height),hullMaterial);hull.position.y=-.08;
 const keel=new THREE.Mesh(extrude(outline(1),.08,false),hullMaterial);keel.position.y=-.08;
 for(const mesh of [hull,keel]){const p=mesh.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<height*.5){const t=1-y/(height*.5);p.setX(i,p.getX(i)*(1-.4*t));}}mesh.geometry.computeVertexNormals();group.add(mesh);}
 const trim=new THREE.Mesh(extrude(ring(1.02,.86),.05),mat(tier>=5?0x5b3a24:palette.trim,.7));trim.position.y=-.08+height;group.add(trim);
 const floor=new THREE.Mesh(extrude(outline(.86),.02,false),mat(0xb08457,.85));floor.position.y=-.08+height*.45;group.add(floor);
 deck.position.y=-.08+height*.45+.02;
 const wood=mat(0x7a5236,.85);
 const thwart=new THREE.Mesh(new THREE.BoxGeometry(beam*.9,.05,.18),wood);thwart.position.set(0,.12,-L*.25);deck.add(thwart);
 if(tier>=1&&tier<3)for(const side of [-1,1]){const oar=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.5,6),wood);oar.rotation.set(Math.PI/2.3,0,side*1.2);oar.position.set(side*(B+.25),.05,-L*.15);deck.add(oar);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.04,.02,.28),wood);blade.position.set(side*(B+.85),-.12,-L*.15);blade.rotation.y=side*.4;deck.add(blade);}
 if(tier>=3){const motor=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.24,.3,.22),mat(0x2a2d31,.5,.3));body.position.y=.12;motor.add(body);
  const cowl=new THREE.Mesh(new THREE.BoxGeometry(.26,.06,.24),mat(0xc8402f,.5));cowl.position.y=.3;motor.add(cowl);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5,8),mat(0x3a3d40,.5,.4));shaft.position.y=-.2;motor.add(shaft);motor.position.set(0,0,-L-.08);deck.add(motor);}
 if(tier>=4){const cabin=new THREE.Mesh(new THREE.BoxGeometry(beam*.7,.5,length*.28),mat(0xf4f1e8,.7));cabin.position.set(0,.3,L*.18);deck.add(cabin);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(beam*.78,.05,length*.32),mat(tier>=5?0x5b3a24:0x2f6f8f,.7));roof.position.set(0,.57,L*.18);deck.add(roof);
  for(const side of [-1,1]){const win=new THREE.Mesh(new THREE.PlaneGeometry(length*.18,.16),mat(0x2d4a5a,.2,.2));win.position.set(side*(beam*.35+.002),.36,L*.18);win.rotation.y=side*Math.PI/2;deck.add(win);}}
 if(tier>=5){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,tier>=6?3.2:2.2,8),wood);mast.position.set(0,tier>=6?1.6:1.1,L*.45);deck.add(mast);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(1,.012,4,40),wood);rail.scale.set(B*.95,L*.95,1);rail.rotation.x=Math.PI/2;rail.position.y=.25;deck.add(rail);}
 if(tier>=6){
  // Mediterranean lateen sail: a triangle hung from a long slanted yard.
  const tri=new THREE.Shape();tri.moveTo(0,0);tri.lineTo(-2.1,2.6);tri.lineTo(-1.9,.15);tri.lineTo(0,0);
  const sailGeometry=new THREE.ShapeGeometry(tri,8);const sp=sailGeometry.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<sp.count;i++)sp.setZ(i,.22*Math.sin(Math.min(1,-sp.getX(i)/2.1)*Math.PI)*Math.min(1,sp.getY(i)/2.6+.3));sailGeometry.computeVertexNormals();
  const sail=new THREE.Mesh(sailGeometry,new THREE.MeshStandardMaterial({color:0xf2e6c9,roughness:.95,side:THREE.DoubleSide,emissive:0x8a7d62,emissiveIntensity:.35}));
  // -90° turns the triangle's -X span toward the stern, over the deck.
  sail.rotation.y=-Math.PI/2;sail.position.set(0,.55,L*.45+.15);deck.add(sail);
  const yard=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,3.4,6),wood);yard.position.set(0,1.85,L*.45-.9);yard.rotation.x=-.9;deck.add(yard);}
 return {group,deck,length,sternZ:-L*.55,bowZ:L*.6,tier};
}

/** Beach fish stall with a striped awning; origin at ground level, counter faces +Z (the sea). */
export function createStall(){
 const group=new THREE.Group(),wood=mat(0x8a613f,.85);
 for(const [x,z] of [[-.9,-.5],[.9,-.5],[-.9,.5],[.9,.5]]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.04,.045,1.5,8),wood);post.position.set(x,.75,z);group.add(post);}
 const awning=new THREE.Mesh(new THREE.BoxGeometry(2.1,.05,1.3),new THREE.MeshStandardMaterial({map:stripeTexture('#f3efe4','#c4553f',8,true),roughness:.9}));awning.position.set(0,1.52,0);awning.rotation.x=-.12;group.add(awning);
 const valance=new THREE.Mesh(new THREE.BoxGeometry(2.1,.16,.02),new THREE.MeshStandardMaterial({map:stripeTexture('#f3efe4','#c4553f',8,true),roughness:.9}));valance.position.set(0,1.43,.66);group.add(valance);
 const counter=new THREE.Mesh(new THREE.BoxGeometry(1.9,.08,.7),wood);counter.position.set(0,.72,.15);group.add(counter);
 const front=new THREE.Mesh(new THREE.BoxGeometry(1.9,.66,.04),mat(0x6e4b31,.9));front.position.set(0,.36,.5);group.add(front);
 const ice=new THREE.Mesh(new THREE.BoxGeometry(1.2,.06,.5),mat(0xe6f2f4,.3));ice.position.set(-.2,.79,.15);group.add(ice);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(.8,.24),new THREE.MeshStandardMaterial({map:signTexture(),roughness:.8}));sign.position.set(0,1.28,.67);group.add(sign);
 const coins=new THREE.Group();coins.position.set(.5,.78,.18);group.add(coins);
 const fishOnIce=new THREE.Group();fishOnIce.position.set(-.2,.84,.15);group.add(fishOnIce);
 return {group,coins,fishOnIce};
}
function signTexture(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=76;const g=canvas.getContext('2d')!;
 g.fillStyle='#1f3b63';g.fillRect(0,0,256,76);g.fillStyle='#f3efe4';g.font="bold 40px ui-rounded, 'Arial Rounded MT Bold', 'Nunito', sans-serif";g.textAlign='center';g.textBaseline='middle';g.fillText('BALIK',128,40);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function createCoin(){const coin=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.025,18),new THREE.MeshStandardMaterial({color:0xf0c445,roughness:.35,metalness:.3,emissive:0x6b4a00,emissiveIntensity:.35}));return coin;}
/** Floating text label (e.g. "+30") that always faces the camera. */
export function createLabel(text:string,color='#f2cf6b'){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const g=canvas.getContext('2d')!;
 g.font="bold 60px ui-rounded, 'Arial Rounded MT Bold', 'Nunito', sans-serif";g.textAlign='center';g.textBaseline='middle';g.lineWidth=10;g.strokeStyle='rgba(23,40,44,.85)';g.strokeText(text,128,50);g.fillStyle=color;g.fillText(text,128,50);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));sprite.scale.set(1.6,.6,1);sprite.renderOrder=10;return sprite;
}
export function createFloat(){
 const group=new THREE.Group();
 const top=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8,0,Math.PI*2,0,Math.PI/2),mat(0xd8392b,.5));group.add(top);
 const bottom=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0xf4f1e8,.5));group.add(bottom);
 return group;
}
export function createRing(){
 const ring=new THREE.Mesh(new THREE.RingGeometry(.08,.11,28),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=-Math.PI/2;return ring;
}
export function createBuoy(color=0xe8742a){const b=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),mat(color,.5));return b;}
export function disposeTree(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material as THREE.Material&{map?:THREE.Texture|null};m.map?.dispose();m.dispose();}});}

/** Snow-block igloo used as the Arctic sales counter; same contract as createStall. */
export function createIgloo(){
 const group=new THREE.Group(),snow=mat(0xf4f8fb,.9);
 const dome=new THREE.Mesh(new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI/2),snow);dome.scale.set(1.05,.85,1.05);group.add(dome);
 // Block seams: thin darker rings and meridians.
 const seam=mat(0xc9d7e1,1);
 for(const y of [.22,.45,.65]){const r=Math.sqrt(1-(y/.85)**2)*1.05;const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.012,4,48),seam);ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);}
 const arch=new THREE.Mesh(new THREE.TorusGeometry(.4,.14,8,16,Math.PI),snow);arch.position.set(0,0,1.02);group.add(arch);
 const door=new THREE.Mesh(new THREE.CircleGeometry(.3,16,0,Math.PI),mat(0x24384a,1));door.position.set(0,.02,1.06);group.add(door);
 const counter=new THREE.Mesh(new THREE.BoxGeometry(1.2,.5,.45),mat(0xe3ecf2,.8));counter.position.set(1.2,.25,.7);group.add(counter);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(.8,.24),new THREE.MeshStandardMaterial({map:signTexture(),roughness:.8}));sign.position.set(0,.95,.62);sign.rotation.x=-.5;group.add(sign);
 const coins=new THREE.Group();coins.position.set(1.4,.52,.7);group.add(coins);
 const fishOnIce=new THREE.Group();fishOnIce.position.set(.95,.56,.7);group.add(fishOnIce);
 return {group,coins,fishOnIce};
}
/** A flat irregular ice floe floating at the waterline. */
export function createIceFloe(radius:number,random:()=>number=Math.random){
 const shape=new THREE.Shape(),n=9;
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=radius*(.7+random()*.45);if(i===0)shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1});geometry.rotateX(-Math.PI/2);
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xf2f7fa,roughness:.55,emissive:0x9fb8c8,emissiveIntensity:.12}));
}

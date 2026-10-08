// Painted sky backdrop for game mode: a vertical gradient, a sun glow and soft puffy clouds.
// Drawn once per region onto a canvas and used as the scene background (screen-space).
import * as THREE from 'three';

export type SkyStyle={top:string;horizon:string;glow:string|null;clouds:number;cloudColor:string;cloudShade:string};

/** Deterministic pseudo-random so a region always gets the same cloudscape. */
function random(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

export function paintSky(style:SkyStyle,seed=7):THREE.CanvasTexture{
 const width=1024,height=1024,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const g=canvas.getContext('2d')!,rand=random(seed);
 const gradient=g.createLinearGradient(0,0,0,height);gradient.addColorStop(0,style.top);gradient.addColorStop(.72,style.horizon);gradient.addColorStop(1,style.horizon);
 g.fillStyle=gradient;g.fillRect(0,0,width,height);
 if(style.glow){
  const sun=g.createRadialGradient(width*.78,height*.16,0,width*.78,height*.16,width*.42);
  sun.addColorStop(0,style.glow);sun.addColorStop(.18,style.glow+'aa');sun.addColorStop(1,style.glow+'00');
  g.fillStyle=sun;g.fillRect(0,0,width,height);
 }
 // Each cloud is a cluster of overlapping circles: a shaded base row and a bright top.
 for(let i=0;i<style.clouds;i++){
  const cx=rand()*width,cy=height*(.08+rand()*.42),scale=60+rand()*90,puffs=5+Math.floor(rand()*4);
  for(const [color,lift] of [[style.cloudShade,.18],[style.cloudColor,0]] as const){
   g.fillStyle=color;
   for(let p=0;p<puffs;p++){
    const t=p/(puffs-1)-.5,r=scale*(.45+.4*Math.cos(t*Math.PI)*(.8+rand()*.3));
    g.beginPath();g.arc(cx+t*scale*2.6,cy-r*.35+scale*lift,r,0,Math.PI*2);g.fill();
   }
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

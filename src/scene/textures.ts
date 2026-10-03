import * as THREE from 'three';
const fract=(n:number)=>n-Math.floor(n),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function noise2(x:number,y:number,seed=7){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);const h=(a:number,b:number)=>fract(Math.sin(a*127.1+b*311.7+seed*74.7)*43758.5453);return mix(mix(h(ix,iy),h(ix+1,iy),u),mix(h(ix,iy+1),h(ix+1,iy+1),u),v);}
export function fbm(x:number,y:number,seed=7){let v=0,a=.55;for(let n=0;n<4;n++){v+=noise2(x,y,seed+n*19)*a;x=x*2.07+13;y=y*2.03-7;a*=.48;}return v;}
export function createSurfaceTextures(kind:'sand'|'stone',size=512){
 const color=new Uint8Array(size*size*4),bump=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,n=fbm(u*9,v*9),grain=noise2(u*size,v*size,43),fine=fbm(u*45,v*45,29);
 const bands=kind==='sand'?(noise2(u*37+fine*2,v*41,71)-.5)*.012:Math.pow(Math.abs(Math.sin(u*24+v*17+n*9)),18)*.025;
 const brightness=kind==='sand'?.74+n*.15+grain*.065+bands:.35+n*.29+fine*.13+bands;
 const rgb=kind==='sand'?[1,.925,.78]:[.91,.89,.82],height=kind==='sand'?fine*.45+grain*.18+bands:n*.6+fine*.4+bands;
 const k=(y*size+x)*4;for(let c=0;c<3;c++){color[k+c]=Math.min(255,Math.round(brightness*rgb[c]*255));bump[k+c]=Math.round(height*255);rough[k+c]=Math.round((kind==='sand'?.78+grain*.17:.65+fine*.26)*255);}color[k+3]=bump[k+3]=rough[k+3]=255;
 }
 const texture=(data:Uint8Array,srgb=false)=>{const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;};
 const map=texture(color,true),bumpMap=texture(bump),roughnessMap=texture(rough);return {map,bumpMap,roughnessMap,dispose(){map.dispose();bumpMap.dispose();roughnessMap.dispose();}};
}

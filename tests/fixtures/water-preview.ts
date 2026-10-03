import * as THREE from 'three';
import {createTerrain} from '../../src/scene/terrain';
import {createCamera} from '../../src/scene/camera';
const path='../../src/water/water.ts';
const api=await import(path).catch(()=>null);
if(!api?.createWater){document.querySelector('#ready')!.textContent='Water module unavailable';}
else{
 const renderer=new THREE.WebGLRenderer({canvas:document.querySelector<HTMLCanvasElement>('#water')!,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(1280,720);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x171c20);const terrain=createTerrain(7);scene.add(terrain.group);scene.add(new THREE.HemisphereLight(0xdff4ff,0x76634a,2.1));const sun=new THREE.DirectionalLight(0xfff4d6,3.1);sun.position.set(-18,25,15);scene.add(sun);
 const camera=createCamera(1280/720).camera;const water=api.createWater(terrain);scene.add(water.mesh);
 const control={swell:.55,tide:0,sunAzimuth:135};let time=0;
 const markerMaterial=new THREE.MeshBasicMaterial({color:0xff2010});const marker=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.5),markerMaterial);marker.rotation.x=-Math.PI/2;marker.position.set(-2,-.65,5);scene.add(marker);
 for(const [name,color] of [['Red seabed',0xff2010],['Blue seabed',0x1020ff]] as const){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{markerMaterial.color.setHex(color);render();};document.body.append(button);}
 const render=()=>{water.update(time,control);water.capture?.(renderer,scene,camera,true);water.render(renderer,scene,camera);};
 document.querySelector('#t0')!.addEventListener('click',()=>{time=0;render();});
 document.querySelector('#t1')!.addEventListener('click',()=>{time=1;render();});
 document.querySelector('#low')!.addEventListener('click',()=>{control.tide=-.35;render();});
 document.querySelector('#high')!.addEventListener('click',()=>{control.tide=.35;render();});
 render();document.querySelector('#ready')!.textContent='Water ready';
}
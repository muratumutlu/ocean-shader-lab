import * as THREE from 'three';
import type {TerrainResources,DemoControls,QualityProfile} from '../types';
import vertexShader from './water.vert.glsl?raw';import fragmentShader from './water.frag.glsl?raw';
export function createWater(terrain:TerrainResources){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const uniforms={uTime:{value:0},uSwell:{value:.55},uTide:{value:0},uHeight:{value:terrain.heightTexture},uRocks:{value:terrain.rockMaskTexture},uSun:{value:new THREE.Vector3(-18,25,-15)},uSceneColor:{value:target.texture},uSceneDepth:{value:target.depthTexture},uResolution:{value:new THREE.Vector2(1,1)},uCaptured:{value:0}};
 const geometry=(n:number)=>{const g=new THREE.PlaneGeometry(128,96,n,Math.round(n*.75));g.rotateX(-Math.PI/2);return g;};
 const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.FrontSide}),mesh=new THREE.Mesh(geometry(224),material);mesh.renderOrder=1;
 let profile:QualityProfile='balanced',disposed=false,captureKey:string|null=null,lastTide=0,lastSun=225;const size=new THREE.Vector2();
 function capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,force=false){
  if(disposed)return;renderer.getDrawingBufferSize(size);uniforms.uResolution.value.copy(size);camera.updateMatrixWorld();
  const key=[size.x,size.y,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(!force&&captureKey===key)return;
  if(!renderer.extensions.has('EXT_color_buffer_float'))target.texture.type=THREE.UnsignedByteType;
  if(target.width!==size.x||target.height!==size.y)target.setSize(Math.max(1,size.x),Math.max(1,size.y));
  const previous=renderer.getRenderTarget(),visible=mesh.visible,tone=renderer.toneMapping;mesh.visible=false;
  try{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(target);renderer.render(scene,camera);uniforms.uCaptured.value=1;captureKey=key;}
  finally{renderer.setRenderTarget(previous);renderer.toneMapping=tone;mesh.visible=visible;}
 }
 return {mesh,update(time:number,c:DemoControls){uniforms.uTime.value=time;uniforms.uSwell.value=c.swell;uniforms.uTide.value=c.tide;const a=c.sunAzimuth*Math.PI/180;uniforms.uSun.value.set(Math.cos(a)*22,25,Math.sin(a)*22);if(c.tide!==lastTide||c.sunAzimuth!==lastSun){lastTide=c.tide;lastSun=c.sunAzimuth;captureKey=null;}terrain.updateOptics?.(0,c.tide);},
 capture,
 render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
  if(disposed)return;capture(renderer,scene,camera);
  const background=scene.background,objects=scene.children.filter(object=>object!==mesh).map(object=>({object,visible:object.visible}));
  try{scene.background=target.texture;objects.forEach(({object})=>{object.visible=false;});renderer.render(scene,camera);}
  finally{scene.background=background;objects.forEach(({object,visible})=>{object.visible=visible;});}
 },
 setDetail(next:QualityProfile){if(profile===next)return;profile=next;captureKey=null;const old=mesh.geometry;mesh.geometry=geometry({low:160,balanced:224,high:320}[next]);old.dispose();},
 dispose(){if(disposed)return;disposed=true;mesh.geometry.dispose();material.dispose();target.dispose();mesh.clear();}};
}

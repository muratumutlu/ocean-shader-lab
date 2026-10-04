import * as THREE from 'three';
import type {TerrainResources,QualityProfile} from '../types';
import exposureShader from './water-exposure.frag.glsl?raw';
export type WaterCapture={readonly color:THREE.Texture;readonly depth:THREE.DepthTexture;readonly transmission:THREE.Texture;capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,dynamicGroup:THREE.Group|null,profile:QualityProfile,underwater:boolean):void;invalidate():void;diagnostics():{coastCaptures:number;dynamicCaptures:number;targetBytes:number};dispose():void};
export function fitCaptureSize(size:THREE.Vector2,maxWidth:number,maxHeight:number,scale=1){const fit=Math.min(scale,maxWidth/size.x,maxHeight/size.y);return {width:Math.max(1,Math.floor(size.x*fit)),height:Math.max(1,Math.floor(size.y*fit))};}
export function targetBytes(t:THREE.WebGLRenderTarget){const color=t.texture.type===THREE.HalfFloatType?8:4;return Math.ceil(t.width*t.height*color*(t.texture.generateMipmaps?4/3:1))+(t.depthTexture?t.width*t.height*4:0);}
export function createWaterCapture(terrain:TerrainResources):WaterCapture{
 const depthTarget=()=>{const t=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});t.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);return t;};
 const coast=depthTarget(),dynamic=depthTarget(),unified=depthTarget(),transmission=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 coast.texture.generateMipmaps=true;coast.texture.minFilter=THREE.LinearMipmapLinearFilter;
 transmission.texture.minFilter=transmission.texture.magFilter=THREE.NearestFilter;
 const quadGeometry=new THREE.PlaneGeometry(2,2),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),vertexShader='void main(){gl_Position=vec4(position.xy,0.,1.);}';
 const combineUniforms={uCoastColor:{value:coast.texture},uCoastDepth:{value:coast.depthTexture},uDynamicColor:{value:dynamic.texture},uDynamicDepth:{value:dynamic.depthTexture},uCaptureResolution:{value:new THREE.Vector2(1,1)}};
 const combineMaterial=new THREE.ShaderMaterial({uniforms:combineUniforms,vertexShader,fragmentShader:`uniform sampler2D uCoastColor,uCoastDepth,uDynamicColor,uDynamicDepth;uniform vec2 uCaptureResolution;
 void main(){vec2 uv=gl_FragCoord.xy/uCaptureResolution;float a=texture2D(uCoastDepth,uv).r,b=texture2D(uDynamicDepth,uv).r;gl_FragColor=texture2D(b<a?uDynamicColor:uCoastColor,uv);gl_FragDepth=min(a,b);}`,depthTest:true,depthFunc:THREE.AlwaysDepth,depthWrite:true,toneMapped:false});
 // GLSL opaque samplers cannot be selected with a ternary on all drivers.
 combineMaterial.fragmentShader=combineMaterial.fragmentShader.replace('texture2D(b<a?uDynamicColor:uCoastColor,uv)','(b<a?texture2D(uDynamicColor,uv):texture2D(uCoastColor,uv))');
 const combineScene=new THREE.Scene();combineScene.add(new THREE.Mesh(quadGeometry,combineMaterial));
 const exposureUniforms={uHeight:{value:terrain.heightTexture},uSceneDepth:{value:coast.depthTexture},uResolution:{value:new THREE.Vector2(1,1)},uCameraRange:{value:new THREE.Vector2(.03,160)},uOrthographic:{value:0},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()}};
 const exposureMaterial=new THREE.ShaderMaterial({uniforms:exposureUniforms,vertexShader,fragmentShader:exposureShader,depthTest:false,depthWrite:false,toneMapped:false});
 const exposureScene=new THREE.Scene();exposureScene.add(new THREE.Mesh(quadGeometry,exposureMaterial));
 const size=new THREE.Vector2();let active=coast,lastKey:string|null=null,cacheValid=false,includesDynamic=false,disposed=false,coastCaptures=0,dynamicCaptures=0;
 const resize=(t:THREE.WebGLRenderTarget,w:number,h:number)=>{if(t.width!==w||t.height!==h)t.setSize(w,h);};
 const mips=(enabled:boolean)=>{if(coast.texture.generateMipmaps!==enabled){coast.texture.generateMipmaps=enabled;coast.texture.minFilter=enabled?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;coast.dispose();}};
 function capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,group:THREE.Group|null,profile:QualityProfile,_underwater:boolean){
  if(disposed)return;if(!renderer.extensions.has('EXT_color_buffer_float'))for(const t of [coast,dynamic,unified,transmission])t.texture.type=THREE.UnsignedByteType;renderer.getDrawingBufferSize(size);camera.updateMatrixWorld();
  const key=[size.x,size.y,profile,...camera.matrixWorld.elements.map(v=>Math.round(v*1e9)/1e9),...camera.projectionMatrix.elements.map(v=>Math.round(v*1e9)/1e9)].join(','),moving=lastKey!==null&&key!==lastKey;
  const drawable=(o:THREE.Object3D)=>o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points;let hasDynamic=false;if(group?.visible)group.traverse(o=>{if(drawable(o)&&o.visible)hasDynamic=true;});
  const cap={low:[960,600],balanced:[1440,900],high:[1920,1200]}[profile],coastSize=fitCaptureSize(size,cap[0],cap[1]),lifeSize=fitCaptureSize(size,1440,900,{low:.5,balanced:.75,high:1}[profile]);
  const previousTarget=renderer.getRenderTarget(),tone=renderer.toneMapping,background=scene.background;
  const water=scene.getObjectByName('ocean-water'),waterVisible=water?.visible,groupVisible=group?.visible;
  const hidden:{object:THREE.Object3D;visible:boolean}[]=[];let updated=false;
  const restoreHidden=()=>{hidden.forEach(x=>{x.object.visible=x.visible;});hidden.length=0;};
  try{
   renderer.toneMapping=THREE.NoToneMapping;if(water)water.visible=false;
   if(!cacheValid||key!==lastKey||(!moving&&hasDynamic&&includesDynamic)){
    mips(!moving);resize(coast,coastSize.width,coastSize.height);
    if(group&&!moving)group.visible=false;
    renderer.setRenderTarget(coast);renderer.render(scene,camera);coastCaptures++;includesDynamic=moving&&hasDynamic;cacheValid=true;updated=true;if(group)group.visible=groupVisible!;
   }
   active=coast;
   if(hasDynamic&&!moving){
    resize(dynamic,lifeSize.width,lifeSize.height);resize(unified,lifeSize.width,lifeSize.height);
    scene.traverse(o=>{if(!drawable(o))return;let inside=false;for(let p:THREE.Object3D|null=o;p;p=p.parent)if(p===group){inside=true;break;}if(!inside){hidden.push({object:o,visible:o.visible});o.visible=false;}});
    scene.background=null;renderer.setRenderTarget(dynamic);renderer.render(scene,camera);dynamicCaptures++;restoreHidden();scene.background=background;if(water)water.visible=false;
    combineUniforms.uCaptureResolution.value.set(unified.width,unified.height);renderer.setRenderTarget(unified);renderer.render(combineScene,quadCamera);active=unified;updated=true;
   }else{resize(dynamic,1,1);resize(unified,1,1);}
   if(updated){
    resize(transmission,active.width,active.height);exposureUniforms.uSceneDepth.value=active.depthTexture;exposureUniforms.uResolution.value.set(active.width,active.height);exposureUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);exposureUniforms.uCameraWorld.value.copy(camera.matrixWorld);
    if(camera instanceof THREE.PerspectiveCamera||camera instanceof THREE.OrthographicCamera){exposureUniforms.uCameraRange.value.set(camera.near,camera.far);exposureUniforms.uOrthographic.value=camera instanceof THREE.OrthographicCamera?1:0;}
    renderer.setRenderTarget(transmission);renderer.render(exposureScene,quadCamera);
   }
   lastKey=key;
  }finally{restoreHidden();scene.background=background;if(water)water.visible=waterVisible!;if(group)group.visible=groupVisible!;renderer.toneMapping=tone;renderer.setRenderTarget(previousTarget);}
 }
 return {get color(){return active.texture;},get depth(){return active.depthTexture!;},get transmission(){return transmission.texture;},capture,invalidate(){cacheValid=false;},diagnostics(){return {coastCaptures,dynamicCaptures,targetBytes:[coast,dynamic,unified,transmission].reduce((n,t)=>n+targetBytes(t),0)};},dispose(){if(disposed)return;disposed=true;[coast,dynamic,unified,transmission].forEach(t=>t.dispose());quadGeometry.dispose();combineMaterial.dispose();exposureMaterial.dispose();combineScene.clear();exposureScene.clear();}};
}

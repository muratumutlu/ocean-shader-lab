import * as THREE from 'three';
import type {TerrainResources,DemoControls,QualityProfile} from '../types';
import vertexShader from './water.vert.glsl?raw';import fragmentShader from './water.frag.glsl?raw';
import rockTransmissionShader from './water-exposure.frag.glsl?raw';
import cutawayShader from './water-cutaway.frag.glsl?raw';
export function createWater(terrain:TerrainResources){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const rockTransmissionTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 rockTransmissionTarget.texture.minFilter=THREE.NearestFilter;rockTransmissionTarget.texture.magFilter=THREE.NearestFilter;
 // Blur levels are rebuilt with the cached coast, not with each moving frame.
 target.texture.generateMipmaps=true;target.texture.minFilter=THREE.LinearMipmapLinearFilter;
 // Cutaway-only radiance uses the actual bed albedo, not an occluded screen sample.
 const bedGround=terrain.group.children.find(object=>object instanceof THREE.Mesh&&object.geometry.getAttribute('color')) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;
 const bedColors=bedGround.geometry.getAttribute('color'),bedWidth=bedGround.geometry.parameters.widthSegments+1,bedDepth=bedGround.geometry.parameters.heightSegments+1,bedPixels=new Uint8Array(bedColors.count*4);
 for(let i=0;i<bedColors.count;i++){bedPixels[i*4]=Math.round(THREE.MathUtils.clamp(bedColors.getX(i),0,1)*255);bedPixels[i*4+1]=Math.round(THREE.MathUtils.clamp(bedColors.getY(i),0,1)*255);bedPixels[i*4+2]=Math.round(THREE.MathUtils.clamp(bedColors.getZ(i),0,1)*255);bedPixels[i*4+3]=255;}
 const bedVertexTexture=new THREE.DataTexture(bedPixels,bedWidth,bedDepth,THREE.RGBAFormat,THREE.UnsignedByteType);bedVertexTexture.minFilter=bedVertexTexture.magFilter=THREE.LinearFilter;bedVertexTexture.needsUpdate=true;
 const uniforms={uTime:{value:0},uSwell:{value:.55},uTide:{value:0},uHeight:{value:terrain.heightTexture},uRocks:{value:terrain.rockMaskTexture},uSun:{value:new THREE.Vector3(-18,25,-15)},uSceneColor:{value:target.texture},uSceneDepth:{value:target.depthTexture},uRockTransmission:{value:rockTransmissionTarget.texture},uResolution:{value:new THREE.Vector2(1,1)},uCameraRange:{value:new THREE.Vector2(.1,350)},uOrthographic:{value:0},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uBedVertexColor:{value:bedVertexTexture},uBedColorSize:{value:new THREE.Vector2(bedWidth,bedDepth)},uBedMap:{value:bedGround.material.map},uBedMapRepeat:{value:bedGround.material.map!.repeat.clone()},uCaptured:{value:0}};
 const transmissionGeometry=new THREE.PlaneGeometry(2,2);
 const transmissionMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:rockTransmissionShader,depthTest:false,depthWrite:false,toneMapped:false});
 const transmissionScene=new THREE.Scene(),transmissionCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 transmissionScene.add(new THREE.Mesh(transmissionGeometry,transmissionMaterial));
 const geometry=(n:number)=>{const g=new THREE.PlaneGeometry(32,24,n,Math.round(n*.75));g.rotateX(-Math.PI/2);return g;};
 const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.FrontSide}),mesh=new THREE.Mesh(geometry(224),material);mesh.renderOrder=1;
 const sidePositions:number[]=[];
 for(const [x0,z0,x1,z1] of [[-16,12,16,12],[-16,-12,-16,12],[16,12,16,-12]])for(let k=0;k<160;k++){
  const a=k/160,b=(k+1)/160,xa=x0+(x1-x0)*a,za=z0+(z1-z0)*a,xb=x0+(x1-x0)*b,zb=z0+(z1-z0)*b;
  const ya=terrain.sampleHeight(xa,za),yb=terrain.sampleHeight(xb,zb);
  for(const p of [[xa,1,za],[xa,ya,za],[xb,1,zb],[xb,1,zb],[xa,ya,za],[xb,yb,zb]])sidePositions.push(...p);
 }
 const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));
 const sharedWaveCode=vertexShader.slice(vertexShader.indexOf('float readMap'),vertexShader.indexOf('void main()'));
 const sideMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:true,side:THREE.FrontSide,vertexShader:`
 uniform float uTime,uSwell,uTide;uniform sampler2D uHeight;varying vec2 edgeXZ;varying float edgeY;varying vec3 edgeWorld;
 ${sharedWaveCode}
 void main(){vec3 p=position;vec2 uv=(p.xz+vec2(16.,12.))/vec2(32.,24.);float bed=readMap(uHeight,uv);if(p.y>.95){float h;vec2 g;waves(p.xz,smoothstep(0.,1.1,uTide-bed),h,g);p.y=uTide+h;}edgeXZ=p.xz;edgeY=p.y;edgeWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:cutawayShader.replace('/* WAVE_CODE */',sharedWaveCode)});const sides=new THREE.Mesh(sideGeo,sideMat);sides.name='water-cutaway';sides.renderOrder=2;mesh.add(sides);
 let profile:QualityProfile='balanced',disposed=false,captureKey:string|null=null,lastTide=0,lastSun=225;const size=new THREE.Vector2();
 function capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,force=false){
  if(disposed)return;renderer.getDrawingBufferSize(size);uniforms.uResolution.value.copy(size);camera.updateMatrixWorld();
  uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  if(camera instanceof THREE.PerspectiveCamera||camera instanceof THREE.OrthographicCamera){uniforms.uCameraRange.value.set(camera.near,camera.far);uniforms.uOrthographic.value=camera instanceof THREE.OrthographicCamera?1:0;}
  const key=[size.x,size.y,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(!force&&captureKey===key)return;
  if(!renderer.extensions.has('EXT_color_buffer_float')){target.texture.type=THREE.UnsignedByteType;rockTransmissionTarget.texture.type=THREE.UnsignedByteType;}
  if(target.width!==size.x||target.height!==size.y)target.setSize(Math.max(1,size.x),Math.max(1,size.y));
  if(rockTransmissionTarget.width!==size.x||rockTransmissionTarget.height!==size.y)rockTransmissionTarget.setSize(Math.max(1,size.x),Math.max(1,size.y));
  const previous=renderer.getRenderTarget(),visible=mesh.visible,tone=renderer.toneMapping;mesh.visible=false;
  try{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(rockTransmissionTarget);renderer.render(transmissionScene,transmissionCamera);uniforms.uCaptured.value=1;captureKey=key;}
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
 dispose(){if(disposed)return;disposed=true;mesh.geometry.dispose();material.dispose();sideGeo.dispose();sideMat.dispose();target.dispose();bedVertexTexture.dispose();transmissionGeometry.dispose();transmissionMaterial.dispose();rockTransmissionTarget.dispose();transmissionScene.clear();mesh.clear();}};
}

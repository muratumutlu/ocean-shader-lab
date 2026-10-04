import * as THREE from 'three';
import type {TerrainResources,DemoControls,QualityProfile,EnvironmentSnapshot} from '../types';
import vertexShader from './water.vert.glsl?raw';import fragmentShader from './water.frag.glsl?raw';
import {createWaterCapture,fitCaptureSize,targetBytes} from './capture';
import {waterHeightAt,updateSubmerged} from './waves';
import underwaterShader from './underwater.frag.glsl?raw';
import cutawayShader from './water-cutaway.frag.glsl?raw';
export function createWater(terrain:TerrainResources){
 const captureResources=createWaterCapture(terrain);
 // Cutaway-only radiance uses the actual bed albedo, not an occluded screen sample.
 const bedGround=terrain.group.children.find(object=>object instanceof THREE.Mesh&&object.geometry.getAttribute('color')) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;
 const bedColors=bedGround.geometry.getAttribute('color'),bedWidth=bedGround.geometry.parameters.widthSegments+1,bedDepth=bedGround.geometry.parameters.heightSegments+1,bedPixels=new Uint8Array(bedColors.count*4);
 for(let i=0;i<bedColors.count;i++){bedPixels[i*4]=Math.round(THREE.MathUtils.clamp(bedColors.getX(i),0,1)*255);bedPixels[i*4+1]=Math.round(THREE.MathUtils.clamp(bedColors.getY(i),0,1)*255);bedPixels[i*4+2]=Math.round(THREE.MathUtils.clamp(bedColors.getZ(i),0,1)*255);bedPixels[i*4+3]=255;}
 const bedVertexTexture=new THREE.DataTexture(bedPixels,bedWidth,bedDepth,THREE.RGBAFormat,THREE.UnsignedByteType);bedVertexTexture.minFilter=bedVertexTexture.magFilter=THREE.LinearFilter;bedVertexTexture.needsUpdate=true;
 const uniforms={uTime:{value:0},uSwell:{value:.55},uTide:{value:0},uHeight:{value:terrain.heightTexture},uRocks:{value:terrain.rockMaskTexture},uSun:{value:new THREE.Vector3(-18,25,-15)},uSceneColor:{value:captureResources.color},uSceneDepth:{value:captureResources.depth},uRockTransmission:{value:captureResources.transmission},uResolution:{value:new THREE.Vector2(1,1)},uCameraRange:{value:new THREE.Vector2(.1,350)},uOrthographic:{value:0},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uBedVertexColor:{value:bedVertexTexture},uBedColorSize:{value:new THREE.Vector2(bedWidth,bedDepth)},uBedMap:{value:bedGround.material.map},uBedMapRepeat:{value:bedGround.material.map!.repeat.clone()},uCaptured:{value:0},uUnderwater:{value:0}};
 const geometry=(n:number)=>{const g=new THREE.PlaneGeometry(32,24,n,Math.round(n*.75));g.rotateX(-Math.PI/2);return g;};
 const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry(224),material);mesh.renderOrder=1;mesh.name='ocean-water';
 const sidePositions:number[]=[];
 for(const [x0,z0,x1,z1] of [[-16,12,16,12],[-16,-12,-16,12],[16,12,16,-12],[16,-12,-16,-12]])for(let k=0;k<160;k++){
  const a=k/160,b=(k+1)/160,xa=x0+(x1-x0)*a,za=z0+(z1-z0)*a,xb=x0+(x1-x0)*b,zb=z0+(z1-z0)*b;
  const ya=terrain.sampleHeight(xa,za),yb=terrain.sampleHeight(xb,zb);
  for(const p of [[xa,1,za],[xa,ya,za],[xb,1,zb],[xb,1,zb],[xa,ya,za],[xb,yb,zb]])sidePositions.push(...p);
 }
 const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));
 const sharedWaveCode=vertexShader.slice(vertexShader.indexOf('float readMap'),vertexShader.indexOf('void main()'));
 const sideMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:true,side:THREE.DoubleSide,vertexShader:`
 uniform float uTime,uSwell,uTide;uniform sampler2D uHeight;varying vec2 edgeXZ;varying float edgeY;varying vec3 edgeWorld;
 ${sharedWaveCode}
 void main(){vec3 p=position;vec2 uv=(p.xz+vec2(16.,12.))/vec2(32.,24.);float bed=readMap(uHeight,uv);if(p.y>.95){float h;vec2 g;waves(p.xz,smoothstep(0.,1.1,uTide-bed),h,g);p.y=uTide+h;}edgeXZ=p.xz;edgeY=p.y;edgeWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:cutawayShader.replace('/* WAVE_CODE */',sharedWaveCode)});const sides=new THREE.Mesh(sideGeo,sideMat);sides.name='water-cutaway';sides.renderOrder=2;mesh.add(sides);
 const finalTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 const postUniforms={...uniforms,uFinalColor:{value:finalTarget.texture},uOutputResolution:{value:new THREE.Vector2(1,1)}};
 const postGeometry=new THREE.PlaneGeometry(2,2),postMaterial=new THREE.ShaderMaterial({uniforms:postUniforms,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:underwaterShader.replace('/* WAVE_CODE */',sharedWaveCode),depthTest:false,depthWrite:false});
 const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);postScene.add(new THREE.Mesh(postGeometry,postMaterial));
 let profile:QualityProfile='balanced',disposed=false,lastTide=0,lastSun=225,currentTime=0,currentSwell=.55,submerged=false,underwaterFrames=0,drawCalls=0,dynamicGroup:THREE.Group|null=null,environment:EnvironmentSnapshot|null=null;
 const size=new THREE.Vector2(),eye=new THREE.Vector3();
 function capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,force=false){
  if(disposed)return;if(force)captureResources.invalidate();renderer.getDrawingBufferSize(size);uniforms.uResolution.value.copy(size);camera.updateMatrixWorld();camera.getWorldPosition(eye);
  const level=waterHeightAt(eye.x,eye.z,currentTime,currentSwell,lastTide,terrain.sampleHeight(eye.x,eye.z));submerged=updateSubmerged(submerged,eye,level,terrain.sampleHeight(eye.x,eye.z));uniforms.uUnderwater.value=Number(submerged);
  uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  if(camera instanceof THREE.PerspectiveCamera||camera instanceof THREE.OrthographicCamera){uniforms.uCameraRange.value.set(camera.near,camera.far);uniforms.uOrthographic.value=Number(camera instanceof THREE.OrthographicCamera);}
  captureResources.capture(renderer,scene,camera,dynamicGroup,profile,submerged);uniforms.uSceneColor.value=captureResources.color;uniforms.uSceneDepth.value=captureResources.depth;uniforms.uRockTransmission.value=captureResources.transmission;uniforms.uCaptured.value=1;
 }
 return {mesh,
  update(time:number,c:DemoControls){currentTime=time;currentSwell=c.swell;uniforms.uTime.value=time;uniforms.uSwell.value=c.swell;uniforms.uTide.value=c.tide;const a=c.sunAzimuth*Math.PI/180;if(environment)uniforms.uSun.value.set(environment.sun.x,environment.sun.y,environment.sun.z);else uniforms.uSun.value.set(Math.cos(a)*22,25,Math.sin(a)*22);if(c.tide!==lastTide||c.sunAzimuth!==lastSun){lastTide=c.tide;lastSun=c.sunAzimuth;captureResources.invalidate();}terrain.updateOptics?.(0,c.tide);},
  capture,
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
   if(disposed)return;const autoReset=renderer.info.autoReset,previousTarget=renderer.getRenderTarget(),tone=renderer.toneMapping;renderer.info.autoReset=false;renderer.info.reset();
   const background=scene.background,objects=scene.children.filter(o=>o!==mesh).map(object=>({object,visible:object.visible}));
   try{
    capture(renderer,scene,camera);scene.background=captureResources.color;objects.forEach(x=>{x.object.visible=false;});
    if(submerged){
     if(!renderer.extensions.has('EXT_color_buffer_float'))finalTarget.texture.type=THREE.UnsignedByteType;
     const next=fitCaptureSize(size,1440,900,{low:.5,balanced:.75,high:1}[profile]);if(finalTarget.width!==next.width||finalTarget.height!==next.height)finalTarget.setSize(next.width,next.height);
     uniforms.uResolution.value.set(finalTarget.width,finalTarget.height);renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(finalTarget);renderer.render(scene,camera);
     renderer.toneMapping=tone;renderer.setRenderTarget(previousTarget);postUniforms.uOutputResolution.value.copy(size);renderer.render(postScene,postCamera);underwaterFrames++;
    }else{if(finalTarget.width!==1||finalTarget.height!==1)finalTarget.setSize(1,1);renderer.render(scene,camera);}
    drawCalls=renderer.info.render.calls;
   }finally{renderer.setRenderTarget(previousTarget);renderer.toneMapping=tone;renderer.info.autoReset=autoReset;uniforms.uResolution.value.copy(size);scene.background=background;objects.forEach(x=>{x.object.visible=x.visible;});}
  },
  setDynamicGroup(group:THREE.Group|null){dynamicGroup=group;captureResources.invalidate();},
  setEnvironment(snapshot:EnvironmentSnapshot){environment=snapshot;uniforms.uSun.value.set(snapshot.sun.x,snapshot.sun.y,snapshot.sun.z);captureResources.invalidate();},
  diagnostics(){return {...captureResources.diagnostics(),underwaterFrames,targetBytes:captureResources.diagnostics().targetBytes+targetBytes(finalTarget),drawCalls,submerged};},
  setDetail(next:QualityProfile){if(profile===next)return;profile=next;captureResources.invalidate();const old=mesh.geometry;mesh.geometry=geometry({low:160,balanced:224,high:320}[next]);old.dispose();},
  dispose(){if(disposed)return;disposed=true;mesh.geometry.dispose();material.dispose();sideGeo.dispose();sideMat.dispose();captureResources.dispose();bedVertexTexture.dispose();finalTarget.dispose();postGeometry.dispose();postMaterial.dispose();postScene.clear();mesh.clear();}
 };
}

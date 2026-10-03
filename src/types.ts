import type * as THREE from 'three';
export type QualityMode='auto'|'low'|'balanced'|'high';
export type QualityProfile=Exclude<QualityMode,'auto'>;
export type DemoControls={swell:number;tide:number;sunAzimuth:number};
export type TerrainResources={group:THREE.Group;heightTexture:THREE.DataTexture;rockMaskTexture:THREE.DataTexture;sampleHeight(x:number,z:number):number;updateOptics?(time:number,tide:number):void;dispose():void};
export type DemoController={setPaused(value:boolean):void;setControls(patch:Partial<DemoControls>):void;setQuality(mode:QualityMode):void;resetCamera():void;resize(width:number,height:number,dpr:number):void;dispose():void};
export const DEFAULT_CONTROLS:DemoControls={swell:0.55,tide:0,sunAzimuth:225};

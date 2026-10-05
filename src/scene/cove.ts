import {createCoveData,sampleGrid,type CoveData,type Vec3} from './cove-data';
import {createTerrainFromData} from './terrain';
import type {TerrainResources,QualityProfile} from '../types';
export type CoveResources=TerrainResources & {data:CoveData;sampleNormal(x:number,z:number):Vec3;sampleOccupancy(x:number,z:number):number;setQuality(profile:QualityProfile):void};
export function createCove(seed:number):CoveResources{
 const data=createCoveData(seed),terrain=createTerrainFromData(data);
 return {...terrain,data,sampleNormal(x,z){const dx=(sampleGrid(data,x+.1,z)-sampleGrid(data,x-.1,z))/.2,dz=(sampleGrid(data,x,z+.1)-sampleGrid(data,x,z-.1))/.2,n=Math.hypot(dx,1,dz);return {x:-dx/n,y:1/n,z:-dz/n};},sampleOccupancy(x,z){let value=0;for(const rock of data.rocks)value=Math.max(value,Math.exp(-((x-rock.x)**2+(z-rock.z)**2)/(rock.radius**2*.75)));return value;}};
}

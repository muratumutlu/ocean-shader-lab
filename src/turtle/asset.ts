import raw from '../../assets/turtle/manifest.json?raw';
import type {TurtleProxy} from '../physics/world';
export type TurtleAssetInfo={proxy:TurtleProxy;swimProxy:TurtleProxy;groundSamples:number[][][];swimGroundSamples:number[][][];clips:{name:string;duration:number}[]};
export const TURTLE_ASSET: TurtleAssetInfo=JSON.parse(raw);

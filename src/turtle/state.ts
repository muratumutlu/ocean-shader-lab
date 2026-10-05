import type {Vec3} from '../scene/cove-data';
import type {CrawlFoot} from './crawl-pose';
export type Locomotion='swim'|'shore'|'crawl'|'idle';
export type TurtleState={position:Vec3;heading:number;velocity:Vec3;locomotion:Locomotion;previousLocomotion:'swim'|'crawl';transition:number;animationPhase:number;crawlPhase:number;restBlend:number;feet:CrawlFoot[];pitch:number;groundNormal:Vec3;groundHeight:number};
export function createTurtleState(spawn:Vec3):TurtleState{return {position:{...spawn},heading:Math.PI,velocity:{x:0,y:0,z:0},locomotion:'swim',previousLocomotion:'swim',transition:1,animationPhase:0,crawlPhase:0,restBlend:0,feet:[],pitch:0,groundNormal:{x:0,y:1,z:0},groundHeight:spawn.y};}

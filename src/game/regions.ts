// Visual themes per region. Rules and prices live in the shared catalog; this is look only.
import type {SkyStyle} from './sky';
export type RegionTheme={
 id:string;
 background:number;
 /** Per-channel water multiplier; values above 1 brighten that channel (clearer, more turquoise seas). */
 water:[number,number,number];
 sky:SkyStyle;
 /** Per-channel multiplier on the beach colour: above 1 whitens, below 1 greys. */
 sand:[number,number,number];
 palms:boolean;
 snow:boolean;
 rain:boolean;
 coral:boolean;
 lighthouse:boolean;
 outfit:'breton'|'parka'|'tropical'|'slicker';
 hull:number[];
 trim:number;
 topRig?:'lateen'|'outriggers'|'searchlight';
 stall:'stall'|'igloo'|'hut'|'shed';
 fishTints:number[];
};
const MED:RegionTheme={id:'med',background:0xeeeae5,water:[.92,1.06,1.07],sky:{top:'#3d9be0',horizon:'#d4ecf8',glow:'#fff6d0',clouds:6,cloudColor:'#ffffff',cloudShade:'#dce9f3'},sand:[1.1,1.1,1.28],palms:true,snow:false,rain:false,coral:false,lighthouse:false,outfit:'breton',
 hull:[0x8b5a3c,0x8b5a3c,0x2f6f8f,0x2f6f8f,0xf1ece0,0x9a6a43,0x9a6a43],trim:0xf4f1e8,stall:'stall',
 fishTints:[0x8fb2c4,0xf2b544,0xe0785a,0x9fa9c9,0x7fc3a8,0xd9d2c0]};
const ARCTIC:RegionTheme={id:'arctic',background:0xdde8ef,water:[.64,.79,.93],sky:{top:'#86b9db',horizon:'#eef5f9',glow:'#ffffff',clouds:4,cloudColor:'#ffffff',cloudShade:'#d9e6ee'},sand:[1,1.02,1.1],palms:false,snow:true,rain:false,coral:false,lighthouse:false,outfit:'parka',
 hull:[0x6b5446,0x6b5446,0x7a6352,0xb8432f,0xb8432f,0x31464f,0x31464f],trim:0xe9eef2,topRig:'searchlight',stall:'igloo',
 fishTints:[0x9aa9b8,0xc96f5a,0x7d8e9c,0xd8dde2,0x5f7d8f,0xe8a07c]};
const INDIAN:RegionTheme={id:'indian',background:0xf4efe0,water:[.84,1.1,1.07],sky:{top:'#1aa2ea',horizon:'#cdf3fb',glow:'#fff1b8',clouds:3,cloudColor:'#ffffff',cloudShade:'#e1f1f7'},sand:[1.16,1.18,1.42],palms:true,snow:false,rain:false,coral:true,lighthouse:false,outfit:'tropical',
 hull:[0x1f8a8a,0x1f8a8a,0xe07a2e,0xe07a2e,0x2a6fa8,0x8c5a34,0x8c5a34],trim:0xf6d36b,stall:'hut',
 fishTints:[0xffd23f,0x3ec1d3,0xff6f59,0xb388eb,0x7bd389,0xff9f1c]};
const ATLANTIC:RegionTheme={id:'atlantic',background:0xd5dbe0,water:[.66,.78,.8],sky:{top:'#7f8d98',horizon:'#d2d9de',glow:null,clouds:12,cloudColor:'#e8ecef',cloudShade:'#aeb8c1'},sand:[.84,.87,.93],palms:false,snow:false,rain:true,coral:false,lighthouse:true,outfit:'slicker',
 hull:[0x7a3b2e,0x7a3b2e,0x2e4a5f,0xb3322b,0xb3322b,0xb3322b,0xb3322b],trim:0xf2f2f2,topRig:'outriggers',stall:'shed',
 fishTints:[0x8a9aa8,0x5d6f7d,0xc0c8cf,0x9c7b5b,0x6f8f8a,0xd1a46b]};
const THEMES:Record<string,RegionTheme>={med:MED,arctic:ARCTIC,indian:INDIAN,atlantic:ATLANTIC};
export const themeFor=(regionId:string)=>THEMES[regionId]??MED;
/** Maps a catalog id suffix to the role it plays in the scene, so every region reuses the same visuals. */
export function roleOf(upgradeId:string):string{
 const suffix=upgradeId.split('.').slice(1).join('.');
 const aliases:Record<string,string>={'eq.jig-rod':'eq.reel-rod','eq.shrimp-bait':'eq.bait-box','eq.smokehouse':'eq.ice-chest','eq.sonar':'eq.fish-finder','eq.ice-net':'eq.cast-net','eq.tip-ups':'eq.trammel-net','eq.trawl':'eq.purse-seine'};
 return aliases[suffix]??suffix;
}

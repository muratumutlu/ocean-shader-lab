// Browser host for game mode. It owns the focus timer and the save, mirroring OceanFocusCore.
// The native macOS/iOS hosts replace it later; the scene only reacts to the events below.
import {CATALOG,fishFor,modifiersFor,moneyFor,purchasable,region,type Preset,type Region,type Upgrade} from './economy';

export type ActiveSession={kind:'focus'|'break';durationMin:number;startedAt:number;endsAt:number;regionId:string};
export type SessionRecord={endedAt:number;durationMin:number;outcome:'completed'|'abandoned';fish:number;money:number;regionId:string};
export type GameSave={version:1;currentRegionId:string;regions:Record<string,{money:number;owned:string[]}>;unlocked?:string[];active:ActiveSession|null;history:SessionRecord[]};
export type HostEvent=
 |{type:'state';save:GameSave}
 |{type:'started';session:ActiveSession;expectedFish:number}
 |{type:'completed';fish:number;money:number}
 |{type:'abandoned';fishLost:number}
 |{type:'breakDone'};

export const BREAK_MINUTES=5;
const KEY='ocean-focus-save-v1';
const starter=CATALOG.regions.find(r=>r.available&&!r.requiresLicense)!.id;
const fresh=():GameSave=>({version:1,currentRegionId:starter,regions:{[starter]:{money:0,owned:[]}},unlocked:[starter],active:null,history:[]});

/** What the HUD and scene need from whoever owns the timer: the browser host or the native app. */
export interface Host{
 subscribe(fn:(event:HostEvent)=>void):()=>void;
 readonly save:GameSave;
 readonly speed:number;
 setSpeed(next:number):void;
 money():number;
 ownedIds(regionId?:string):Set<string>;
 region():ReturnType<typeof region>;
 remainingMs():number;
 progress():number;
 expectedFish():number;
 startFocus(minutes:Preset):void;
 startBreak():void;
 tick():void;
 abandon():void;
 shop():{upgrade:Upgrade;affordable:boolean}[];
 buy(id:string):void;
 reset():void;
 regions():RegionEntry[];
 unlockRegion(id:string):void;
 switchRegion(id:string):void;
}
export type RegionStatus='current'|'unlocked'|'unlockable'|'locked'|'soon';
export type RegionEntry={region:Region;status:RegionStatus};
/** Until StoreKit lands every build counts as licensed (see spec §5b). */
export const LICENSED=true;
export function regionEntries(save:GameSave):RegionEntry[]{
 const money=save.regions[save.currentRegionId]?.money??0;
 return CATALOG.regions.map(r=>({region:r,status:r.id===save.currentRegionId?'current':save.regions[r.id]&&isUnlocked(save,r.id)?'unlocked':!r.available?'soon':money>=r.unlockPrice&&(LICENSED||!r.requiresLicense)?'unlockable':'locked'}));
}
const isUnlocked=(save:GameSave,id:string)=>(save.unlocked??[starterId()]).includes(id);
const starterId=()=>CATALOG.regions.find(r=>r.available&&!r.requiresLicense)!.id;
export function createHost(options:{storage?:Storage;now?:()=>number;speed?:number}={}):Host{
 const storage=options.storage??localStorage;
 const realNow=options.now??(()=>Date.now());
 let speed=options.speed??1,anchorReal=realNow(),anchorGame=anchorReal;
 // Game time runs `speed` times faster than real time so a session can be watched quickly.
 const now=()=>anchorGame+(realNow()-anchorReal)*speed;
 const listeners=new Set<(event:HostEvent)=>void>();
 let save:GameSave=load();
 function load():GameSave{
  try{const parsed=JSON.parse(storage.getItem(KEY)??'null') as GameSave|null;if(parsed?.version===1)return parsed;}catch{/* fall through to a fresh save */}
  return fresh();
 }
 const persist=()=>storage.setItem(KEY,JSON.stringify(save));
 const emit=(event:HostEvent)=>{for(const fn of listeners)fn(event);};
 const progressOf=(regionId:string)=>save.regions[regionId]??(save.regions[regionId]={money:0,owned:[]});
 const owned=(regionId=save.currentRegionId)=>new Set(progressOf(regionId).owned);
 const expectedFish=(session:ActiveSession)=>session.kind==='focus'?fishFor(session.durationMin,modifiersFor(session.regionId,owned(session.regionId))):0;
 const changed=()=>{persist();emit({type:'state',save});};
 const start=(kind:'focus'|'break',minutes:number)=>{
  if(save.active)throw Error('A session is already running.');
  const t=now();save.active={kind,durationMin:minutes,startedAt:t,endsAt:t+minutes*60_000,regionId:save.currentRegionId};
  changed();emit({type:'started',session:save.active,expectedFish:expectedFish(save.active)});
 };
 return {
  subscribe(fn:(event:HostEvent)=>void){listeners.add(fn);fn({type:'state',save});return ()=>{listeners.delete(fn);};},
  get save(){return save;},
  get speed(){return speed;},
  setSpeed(next:number){anchorGame=now();anchorReal=realNow();speed=next;},
  money(){return progressOf(save.currentRegionId).money;},
  ownedIds:owned,
  region:()=>region(save.currentRegionId),
  remainingMs(){return save.active?Math.max(0,save.active.endsAt-now()):0;},
  progress(){const a=save.active;return a?Math.min(1,Math.max(0,(now()-a.startedAt)/(a.endsAt-a.startedAt))):0;},
  expectedFish(){return save.active?expectedFish(save.active):0;},
  startFocus(minutes:Preset){start('focus',minutes);},
  startBreak(){start('break',BREAK_MINUTES);},
  /** Settles a finished session. Call every frame or second. */
  tick(){
   const a=save.active;if(!a||now()<a.endsAt)return;
   save.active=null;
   if(a.kind==='break'){changed();emit({type:'breakDone'});return;}
   const mods=modifiersFor(a.regionId,owned(a.regionId)),fish=fishFor(a.durationMin,mods),money=moneyFor(fish,region(a.regionId).fishPrice,mods);
   progressOf(a.regionId).money+=money;save.history.push({endedAt:a.endsAt,durationMin:a.durationMin,outcome:'completed',fish,money,regionId:a.regionId});
   changed();emit({type:'completed',fish,money});
  },
  /** Explicit give-up. A session whose time already ran out completes instead. */
  abandon(){
   const a=save.active;if(!a)return;
   if(now()>=a.endsAt){this.tick();return;}
   const fishLost=Math.floor(expectedFish(a)*this.progress());
   save.active=null;
   if(a.kind==='focus')save.history.push({endedAt:now(),durationMin:a.durationMin,outcome:'abandoned',fish:0,money:0,regionId:a.regionId});
   changed();if(a.kind==='focus')emit({type:'abandoned',fishLost});
  },
  shop():{upgrade:Upgrade;affordable:boolean}[]{
   const money=this.money();return purchasable(save.currentRegionId,owned()).map(upgrade=>({upgrade,affordable:upgrade.price<=money}));
  },
  buy(id:string){
   if(save.active?.kind==='focus')throw Error('The shop is closed while you focus.');
   const item=purchasable(save.currentRegionId,owned()).find(u=>u.id===id);if(!item)throw Error('Upgrade unavailable.');
   const p=progressOf(save.currentRegionId);if(p.money<item.price)throw Error('Not enough coins.');
   p.money-=item.price;p.owned.push(id);changed();
  },
  reset(){save=fresh();changed();},
  regions(){return regionEntries(save);},
  unlockRegion(id:string){
   if(save.active?.kind==='focus')throw Error('Odaklanırken taşınamazsın.');
   const target=region(id),entry=regionEntries(save).find(e=>e.region.id===id);
   if(entry?.status!=='unlockable')throw Error('Bu bölge henüz açılamaz.');
   progressOf(save.currentRegionId).money-=target.unlockPrice;
   save.unlocked=[...(save.unlocked??[starter]),id];progressOf(id);save.currentRegionId=id;changed();
  },
  switchRegion(id:string){
   if(save.active?.kind==='focus')throw Error('Odaklanırken taşınamazsın.');
   if(!(save.unlocked??[starter]).includes(id))throw Error('Bu bölge kilitli.');
   save.currentRegionId=id;changed();
  },
 };
}

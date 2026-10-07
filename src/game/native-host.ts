// Host backed by the native Ocean Focus app (macOS/iOS). Swift owns the timer, save and rules
// (OceanFocusCore); this side only mirrors the snapshot it receives and forwards commands.
import {fishFor,modifiersFor,purchasable,region,type Preset} from './economy';
import type {GameSave,Host,HostEvent} from './host';

type NativeCommand={type:'ready'}|{type:'startFocus';minutes:Preset}|{type:'startBreak'}|{type:'abandon'}|{type:'buy';id:string}|{type:'setSpeed';speed:number};
/** Messages Swift sends through `window.oceanFocusNative.receive(...)`. */
export type NativeMessage=HostEvent|{type:'clock';now:number;speed:number};
type Bridge={postMessage(message:NativeCommand):void};

export function nativeBridge():Bridge|null{
 const handler=(window as unknown as {webkit?:{messageHandlers?:{oceanFocus?:Bridge}}}).webkit?.messageHandlers?.oceanFocus;
 return handler??null;
}

export function createNativeHost(bridge:Bridge):Host&{receive(message:NativeMessage):void}{
 const listeners=new Set<(event:HostEvent)=>void>();
 let save:GameSave={version:1,currentRegionId:'med',regions:{med:{money:0,owned:[]}},active:null,history:[]};
 // Swift's clock may run faster in demo mode; extrapolate from the last tick it sent.
 let clock={now:Date.now(),speed:1,receivedAt:performance.now()};
 const now=()=>clock.now+(performance.now()-clock.receivedAt)*clock.speed;
 const owned=(regionId=save.currentRegionId)=>new Set(save.regions[regionId]?.owned??[]);
 const host:Host&{receive(message:NativeMessage):void}={
  subscribe(fn){listeners.add(fn);fn({type:'state',save});return ()=>{listeners.delete(fn);};},
  get save(){return save;},
  get speed(){return clock.speed;},
  setSpeed(speed){bridge.postMessage({type:'setSpeed',speed});},
  money:()=>save.regions[save.currentRegionId]?.money??0,
  ownedIds:owned,
  region:()=>region(save.currentRegionId),
  remainingMs:()=>save.active?Math.max(0,save.active.endsAt-now()):0,
  progress(){const a=save.active;return a?Math.min(1,Math.max(0,(now()-a.startedAt)/(a.endsAt-a.startedAt))):0;},
  expectedFish(){const a=save.active;return a?.kind==='focus'?fishFor(a.durationMin,modifiersFor(a.regionId,owned(a.regionId))):0;},
  startFocus(minutes){bridge.postMessage({type:'startFocus',minutes});},
  startBreak(){bridge.postMessage({type:'startBreak'});},
  tick(){/* Swift settles sessions. */},
  abandon(){bridge.postMessage({type:'abandon'});},
  shop(){const money=host.money(),focusing=save.active?.kind==='focus';return purchasable(save.currentRegionId,owned()).map(upgrade=>({upgrade,affordable:upgrade.price<=money&&!focusing}));},
  buy(id){bridge.postMessage({type:'buy',id});},
  reset(){/* Not exposed in the native app. */},
  receive(message){
   if(message.type==='clock'){clock={now:message.now,speed:message.speed,receivedAt:performance.now()};return;}
   if(message.type==='state')save=message.save;
   for(const fn of listeners)fn(message);
  },
 };
 (window as unknown as {oceanFocusNative:typeof host}).oceanFocusNative=host;
 bridge.postMessage({type:'ready'});
 return host;
}

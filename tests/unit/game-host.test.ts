import {describe,expect,it} from 'vitest';
import {CATALOG,fishFor,moneyFor,modifiersFor,purchasable} from '../../src/game/economy';
import {createHost,type HostEvent} from '../../src/game/host';

function memoryStorage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear(),key:()=>null,length:0} as Storage;}
function setup(){let now=1_800_000_000_000;const storage=memoryStorage();const host=createHost({storage,now:()=>now});const events:HostEvent[]=[];host.subscribe(e=>events.push(e));return {host,events,storage,advance(ms:number){now+=ms;}};}

describe('economy mirrors OceanFocusCore',()=>{
 it('uses the same fish and money formulas',()=>{
  expect([15,25,45,60,50].map(m=>fishFor(m,{fishMultiplier:1,moneyBonus:0}))).toEqual([5,10,22,30,20]);
  expect(fishFor(25,{fishMultiplier:1.25,moneyBonus:0})).toBe(12);
  expect(moneyFor(10,3,{fishMultiplier:1,moneyBonus:.15})).toBe(34);
  expect(moneyFor(22,3,{fishMultiplier:1,moneyBonus:.3})).toBe(85);
 });
 it('reads the shared Swift catalog',()=>{
  expect(CATALOG.regions.map(r=>r.id)).toEqual(['med','arctic','indian','atlantic']);
  expect(CATALOG.regions[0].upgrades).toHaveLength(18);
  expect(purchasable('med',new Set()).map(u=>u.id)).toContain('med.boat.oars');
  expect(modifiersFor('med',new Set(['med.eq.sturdy-line','med.crew.deckhand'])).moneyBonus).toBeCloseTo(.15);
 });
});

describe('browser host',()=>{
 it('credits a completed session once',()=>{
  const {host,events,advance}=setup();
  host.startFocus(25);advance(25*60_000);host.tick();host.tick();
  expect(host.money()).toBe(30);
  expect(events.filter(e=>e.type==='completed')).toEqual([{type:'completed',fish:10,money:30}]);
  expect(host.save.history).toHaveLength(1);
 });
 it('spills the catch on give-up and keeps money unchanged',()=>{
  const {host,events,advance}=setup();
  host.startFocus(25);advance(15*60_000);host.abandon();
  expect(host.money()).toBe(0);
  expect(events.at(-1)).toEqual({type:'abandoned',fishLost:6});
  expect(host.save.history[0].outcome).toBe('abandoned');
 });
 it('completes instead of punishing a give-up after the time ran out',()=>{
  const {host,events,advance}=setup();
  host.startFocus(15);advance(16*60_000);host.abandon();
  expect(events.some(e=>e.type==='abandoned')).toBe(false);
  expect(host.money()).toBe(15);
 });
 it('closes the shop during focus but not during a break',()=>{
  const {host,advance}=setup();
  host.startFocus(25);advance(25*60_000);host.tick();
  host.startFocus(25);expect(()=>host.buy('med.eq.sturdy-line')).toThrow('closed');
  host.abandon();host.startBreak();host.buy('med.eq.sturdy-line');
  expect(host.money()).toBe(10);
  expect([...host.ownedIds()]).toEqual(['med.eq.sturdy-line']);
 });
 it('persists progress across hosts sharing storage',()=>{
  const {host,storage,advance}=setup();
  host.startFocus(25);advance(25*60_000);host.tick();
  expect(createHost({storage,now:()=>0}).money()).toBe(30);
 });
});

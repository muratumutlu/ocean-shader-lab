// Game-mode HUD. Layout: settings gear top-left, timer + coins + shop top-right,
// session controls bottom-left, toasts bottom-centre. Built in JS so the default page is unchanged.
import {PRESETS,type Preset} from './economy';
import type {Host,HostEvent} from './host';

const CATEGORY_LABEL={equipment:'Gear',boat:'Boat',crew:'Crew'} as const;
const CATEGORY_ICON={equipment:'🎣',boat:'⛵',crew:'🧑‍✈️'} as const;
const badge=(icon:string,extra='')=>el('span',{className:'focus-badge '+extra,textContent:icon,ariaHidden:'true'});
/** A drawn gold coin; the system 🪙 emoji is silver on Apple platforms. */
const coin=()=>el('span',{className:'focus-coin',ariaHidden:'true'});
/** Turns "+30 🪙" style text into text nodes with drawn coins. */
const withCoins=(text:string)=>text.split('🪙').flatMap((part,i)=>i?[coin(),part]:[part]);
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,props:Partial<HTMLElementTagNameMap[K]>={},...children:(Node|string)[])=>{const node=Object.assign(document.createElement(tag),props);node.append(...children);return node;};
const clock=(ms:number)=>{const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const effectLabel=(effect:{fishMultiplier?:number;moneyBonus?:number})=>[effect.fishMultiplier?'🐟 ×'+effect.fishMultiplier:'',effect.moneyBonus?'🪙 +'+Math.round(effect.moneyBonus*100)+'%':''].filter(Boolean).join(' · ');

export function createHud(host:Host,parent:HTMLElement){
 let preset:Preset=25;
 // ---- top-right: timer, coins, shop ----
 const time=el('div',{className:'focus-time',textContent:'25:00'});
 const fishCount=el('div',{className:'focus-fish'});
 const bar=el('div',{className:'focus-bar'});const barFill=el('div',{className:'focus-bar-fill'});bar.append(barFill);
 const timerBadge=badge('⏱️');
 const timerPill=el('div',{className:'focus-pill focus-timer'},timerBadge,el('div',{className:'focus-timer-body'},el('div',{className:'focus-timer-row'},time,fishCount),bar));
 const coinValue=el('span',{className:'focus-coin-value'});
 const coins=el('div',{className:'focus-pill focus-coins'},el('span',{className:'focus-badge is-gold',ariaHidden:'true'},coin()),coinValue);
 const shopToggle=el('button',{type:'button',className:'focus-round',textContent:'🛒',title:'Shop',ariaLabel:'Shop'});
 const shopList=el('div',{className:'focus-card focus-panel-sheet focus-shop'});shopList.hidden=true;
 const top=el('div',{className:'focus-top'},el('div',{className:'focus-top-row'},timerPill,coins,shopToggle),shopList);
 // ---- bottom-left: session controls ----
 const presetRow=el('div',{className:'focus-presets'});
 const presetButtons=PRESETS.map(minutes=>{const b=el('button',{type:'button',className:'focus-chip'},el('strong',{textContent:String(minutes)}),el('small',{textContent:'min'}));b.addEventListener('click',()=>{preset=minutes;render();});presetRow.append(b);return {minutes,b};});
 const start=el('button',{type:'button',className:'focus-go is-hero',textContent:'🎣 GO FISHING'});
 const giveUp=el('button',{type:'button',className:'focus-giveup',textContent:'GIVE UP'});
 const confirmYes=el('button',{type:'button',className:'focus-giveup',textContent:'SPILL'}),confirmNo=el('button',{type:'button',className:'focus-go',textContent:'KEEP FISHING'});
 // Confirmation replaces the give-up button in place: safe choice first, both the same size.
 const confirmBox=el('div',{className:'focus-confirm',hidden:true},el('p',{textContent:'💦 Spill your catch?'}),el('div',{className:'focus-row'},confirmNo,confirmYes));
 const controls=el('section',{className:'focus-card focus-controls',ariaLabel:'Focus session'},presetRow,el('div',{className:'focus-row'},start,giveUp),confirmBox);
 // ---- top-left: one gear for every setting ----
 const gear=el('button',{type:'button',className:'focus-round focus-gear',textContent:'⚙️',title:'Settings',ariaLabel:'Settings'});
 const speed=el('button',{type:'button',className:'focus-toggle'});
 const settings=el('div',{className:'focus-card focus-panel-sheet focus-settings',hidden:true},el('p',{className:'panel-title',textContent:'⚙️ SETTINGS'}),speed);
 // Reuse the scene's own controls (waves, tide, sun, quality, camera reset, pause, full screen) inside the gear panel.
 for(const id of ['play','fullscreen']){const node=document.querySelector<HTMLElement>('#'+id);if(node)settings.append(node);}
 const coast=document.querySelector<HTMLElement>('#settings-panel');if(coast){coast.hidden=false;settings.append(coast);}
 const corner=el('div',{className:'focus-corner'},gear,settings);
 const toast=el('div',{className:'focus-toast',role:'status'});toast.setAttribute('aria-live','polite');
 parent.append(corner,top,controls,toast);

 // One panel at a time; the session dock steps aside while a panel is open so nothing overlaps.
 function openPanel(next:'settings'|'shop'|null){
  settings.hidden=next!=='settings';shopList.hidden=next!=='shop';
  gear.setAttribute('aria-expanded',String(next==='settings'));shopToggle.setAttribute('aria-expanded',String(next==='shop'));
  controls.classList.toggle('is-tucked',next!==null);renderShop();
 }
 gear.addEventListener('click',()=>openPanel(settings.hidden?'settings':null));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')openPanel(null);});
 start.addEventListener('click',()=>{try{host.startFocus(preset);}catch(error){say((error as Error).message);}});
 const confirming=(on:boolean)=>{confirmBox.hidden=!on;giveUp.hidden=on||!host.save.active;};
 giveUp.addEventListener('click',()=>{if(host.save.active?.kind==='focus')confirming(true);else host.abandon();});
 confirmNo.addEventListener('click',()=>confirming(false));
 confirmYes.addEventListener('click',()=>{confirming(false);host.abandon();});
 speed.addEventListener('click',()=>{host.setSpeed(host.speed===1?60:1);render();});
 shopToggle.addEventListener('click',()=>openPanel(shopList.hidden?'shop':null));

 let toastTimer=0;
 function say(text:string){toast.replaceChildren(...withCoins(text));toast.classList.remove('visible');void toast.offsetWidth;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.classList.remove('visible'),3800);}
 function renderShop(){
  if(shopList.hidden)return;shopList.replaceChildren(el('p',{className:'panel-title',textContent:'SHOP · '+host.region().name.toUpperCase()}));
  const focusing=host.save.active?.kind==='focus',items=host.shop();
  if(focusing)shopList.append(el('p',{className:'focus-note',textContent:'🔒 Shop opens after your focus session.'}));
  if(!items.length)shopList.append(el('p',{className:'focus-note',textContent:'You own everything here! 🏆'}));
  // Regions: move on once enough coins are saved; unlocked regions can be revisited any time.
  shopList.append(el('p',{className:'panel-title focus-regions-title',textContent:'🧭 REGIONS'}));
  for(const {region,status} of host.regions()){
   const action=status==='unlockable'?el('button',{type:'button',className:'focus-go',disabled:focusing},'MOVE · '+region.unlockPrice,coin())
    :status==='unlocked'?el('button',{type:'button',className:'focus-go',textContent:'GO',disabled:focusing})
    :el('span',{className:'focus-tag'+(status==='current'?' is-here':'')},...(status==='current'?['📍 HERE']:status==='soon'?['SOON']:['🔒 '+region.unlockPrice,coin()]));
   if(action instanceof HTMLButtonElement)action.addEventListener('click',()=>{try{status==='unlockable'?host.unlockRegion(region.id):host.switchRegion(region.id);say('🧭 '+region.name+'!');}catch(error){say((error as Error).message);}});
   shopList.append(el('div',{className:'focus-item'},el('span',{className:'focus-tile',textContent:region.id==='arctic'?'🧊':region.id==='med'?'🏖️':'🌊'}),el('div',{className:'focus-item-text'},el('strong',{textContent:region.name}),el('span',{},'Per fish '+region.fishPrice,coin())),action));
  }
  if(items.length)shopList.append(el('p',{className:'panel-title focus-regions-title',textContent:'🛠 UPGRADES'}));
  for(const {upgrade,affordable} of items){
   const buy=el('button',{type:'button',className:'focus-price',disabled:!affordable||focusing},String(upgrade.price),coin());
   buy.addEventListener('click',()=>{try{host.buy(upgrade.id);say(upgrade.name+' bought!');}catch(error){say((error as Error).message);}});
   shopList.append(el('div',{className:'focus-item'},el('span',{className:'focus-tile',textContent:CATEGORY_ICON[upgrade.category]}),el('div',{className:'focus-item-text'},el('strong',{textContent:upgrade.name}),el('span',{},...withCoins(CATEGORY_LABEL[upgrade.category]+' · '+effectLabel(upgrade.effect)))),buy));
  }
 }
 function render(){
  const active=host.save.active,focusing=active?.kind==='focus';
  for(const {minutes,b} of presetButtons){b.setAttribute('aria-pressed',String(minutes===preset));b.disabled=!!active;}
  presetRow.hidden=!!active;start.hidden=!!active;giveUp.hidden=!active;giveUp.textContent=focusing?'GIVE UP':'END BREAK';
  if(!active)confirmBox.hidden=true;
  if(!confirmBox.hidden)giveUp.hidden=true;
  timerBadge.textContent=active?.kind==='break'?'☕️':'⏱️';
  time.textContent=active?clock(host.remainingMs()):clock(preset*60_000);
  timerPill.classList.toggle('is-break',active?.kind==='break');
  fishCount.textContent=focusing?'🐟 '+Math.floor(host.expectedFish()*host.progress())+'/'+host.expectedFish():active?'☕️ break':'';
  barFill.style.transform='scaleX('+(active?host.progress():0)+')';
  const money=String(host.money());if(coinValue.textContent!==money){if(coinValue.textContent)coins.classList.remove('bump'),void coins.offsetWidth,coins.classList.add('bump');coinValue.textContent=money;}
  speed.textContent=host.speed===1?'⏩ Demo speed ×60':'⏱ Real time';speed.setAttribute('aria-pressed',String(host.speed!==1));
  renderShop();
 }
 const unsubscribe=host.subscribe((event:HostEvent)=>{
  if(event.type==='completed')say('✅ '+event.fish+' 🐟 sold · +'+event.money+' 🪙');
  if(event.type==='abandoned')say('💦 '+event.fishLost+' 🐟 lost at sea');
  if(event.type==='started'&&event.session.kind==='focus')say('🎣 Line out · '+event.expectedFish+' 🐟 to catch');
  if(event.type==='breakDone')say('☕ Break over!');
  if(event.type==='completed')window.setTimeout(()=>{if(!host.save.active)try{host.startBreak();}catch{/* already running */}},400);
  render();
 });
 let last='';
 return {
  /** Called every frame; repaints only when the visible second changes. */
  frame(){const key=host.save.active?Math.ceil(host.remainingMs()/1000)+':'+Math.floor(host.expectedFish()*host.progress()):'idle';if(key!==last){last=key;render();}},
  dispose(){unsubscribe();clearTimeout(toastTimer);corner.remove();top.remove();controls.remove();toast.remove();},
 };
}

// Game-mode HUD: focus timer, coins, shop and toasts. Built in JS so the default page is unchanged.
import {PRESETS,type Preset} from './economy';
import type {Host,HostEvent} from './host';

const CATEGORY_LABEL={equipment:'Ekipman',boat:'Kayık',crew:'Mürettebat'} as const;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,props:Partial<HTMLElementTagNameMap[K]>={},...children:(Node|string)[])=>{const node=Object.assign(document.createElement(tag),props);node.append(...children);return node;};
const clock=(ms:number)=>{const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const effectLabel=(effect:{fishMultiplier?:number;moneyBonus?:number})=>[effect.fishMultiplier?'🐟 ×'+effect.fishMultiplier:'',effect.moneyBonus?'💰 +'+Math.round(effect.moneyBonus*100)+'%':''].filter(Boolean).join(' · ');

export function createHud(host:Host,parent:HTMLElement){
 let preset:Preset=25;
 const time=el('div',{className:'focus-time',textContent:'25:00'});
 const status=el('p',{className:'focus-status',textContent:'Süre seç ve denize açıl.'});
 const bar=el('div',{className:'focus-bar'});const barFill=el('div',{className:'focus-bar-fill'});bar.append(barFill);
 const presetRow=el('div',{className:'focus-presets'});
 const presetButtons=PRESETS.map(minutes=>{const b=el('button',{type:'button',textContent:minutes+' dk'});b.addEventListener('click',()=>{preset=minutes;render();});presetRow.append(b);return {minutes,b};});
 const start=el('button',{type:'button',className:'focus-primary',textContent:'Denize açıl'});
 const giveUp=el('button',{type:'button',className:'focus-giveup',textContent:'Vazgeç'});
 const speed=el('button',{type:'button',className:'focus-speed'});
 const coins=el('div',{className:'focus-coins'});
 const shopToggle=el('button',{type:'button',className:'focus-shop-toggle',textContent:'Dükkân'});
 const shopList=el('div',{className:'focus-shop'});shopList.hidden=true;
 const toast=el('div',{className:'focus-toast',role:'status'});toast.setAttribute('aria-live','polite');
 const confirmBox=el('div',{className:'focus-confirm',hidden:true},el('p',{textContent:'Balıklar denize dökülecek. Emin misin?'}));
 const confirmYes=el('button',{type:'button',className:'focus-giveup',textContent:'Evet, vazgeç'}),confirmNo=el('button',{type:'button',textContent:'Devam et'});
 confirmBox.append(el('div',{className:'focus-row'},confirmYes,confirmNo));
 const panel=el('aside',{className:'focus-panel',ariaLabel:'Ocean Focus'},
  el('p',{className:'panel-title',textContent:'OCEAN FOCUS · AKDENİZ'}),time,bar,status,presetRow,el('div',{className:'focus-row'},start,giveUp),confirmBox,
  el('div',{className:'focus-row focus-meta'},coins,shopToggle,speed),shopList);
 parent.append(panel,toast);

 start.addEventListener('click',()=>{try{host.startFocus(preset);}catch(error){say((error as Error).message);}});
 giveUp.addEventListener('click',()=>{confirmBox.hidden=false;});
 confirmNo.addEventListener('click',()=>{confirmBox.hidden=true;});
 confirmYes.addEventListener('click',()=>{confirmBox.hidden=true;host.abandon();});
 speed.addEventListener('click',()=>{host.setSpeed(host.speed===1?60:1);render();});
 shopToggle.addEventListener('click',()=>{shopList.hidden=!shopList.hidden;shopToggle.setAttribute('aria-expanded',String(!shopList.hidden));renderShop();});

 let toastTimer=0;
 function say(text:string){toast.textContent=text;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.classList.remove('visible'),3800);}
 function renderShop(){
  if(shopList.hidden)return;shopList.replaceChildren();
  const focusing=host.save.active?.kind==='focus',items=host.shop();
  if(focusing)shopList.append(el('p',{className:'focus-note',textContent:'Odaklanırken dükkân kapalı.'}));
  if(!items.length)shopList.append(el('p',{className:'focus-note',textContent:'Akdeniz\'deki her şey senin! 🏆'}));
  for(const {upgrade,affordable} of items){
   const buy=el('button',{type:'button',textContent:upgrade.price+' 💰',disabled:!affordable||focusing});
   buy.addEventListener('click',()=>{try{host.buy(upgrade.id);say(upgrade.name+' alındı!');}catch(error){say((error as Error).message);}});
   shopList.append(el('div',{className:'focus-item'},el('div',{},el('strong',{textContent:upgrade.name}),el('span',{textContent:CATEGORY_LABEL[upgrade.category]+' · '+effectLabel(upgrade.effect)})),buy));
  }
 }
 function render(){
  const active=host.save.active,focusing=active?.kind==='focus';
  for(const {minutes,b} of presetButtons){b.setAttribute('aria-pressed',String(minutes===preset));b.disabled=!!active;}
  start.hidden=!!active;giveUp.hidden=!active;giveUp.textContent=focusing?'Vazgeç':'Molayı bitir';
  if(!active)confirmBox.hidden=true;
  time.textContent=active?clock(host.remainingMs()):clock(preset*60_000);
  barFill.style.transform='scaleX('+(active?host.progress():0)+')';
  status.textContent=focusing?'Ağdaki balık: '+Math.floor(host.expectedFish()*host.progress())+' / '+host.expectedFish():active?'Mola · denizin tadını çıkar.':'Süre seç ve denize açıl.';
  coins.textContent=host.money()+' 💰';
  speed.textContent=host.speed===1?'Demo hızı ×60':'Gerçek zaman';speed.setAttribute('aria-pressed',String(host.speed!==1));
  renderShop();
 }
 const unsubscribe=host.subscribe((event:HostEvent)=>{
  if(event.type==='completed')say('✅ '+event.fish+' balık satıldı · +'+event.money+' 💰');
  if(event.type==='abandoned')say('💦 '+event.fishLost+' balık denize döküldü');
  if(event.type==='started'&&event.session.kind==='focus')say('🎣 Olta atıldı · hedef '+event.expectedFish+' balık');
  if(event.type==='breakDone')say('☕ Mola bitti. Yeni seans?');
  if(event.type==='completed')window.setTimeout(()=>{if(!host.save.active)try{host.startBreak();}catch{/* already running */}},400);
  render();
 });
 let last='';
 return {
  /** Called every frame; repaints only when the visible second changes. */
  frame(){const key=host.save.active?Math.ceil(host.remainingMs()/1000)+':'+Math.floor(host.expectedFish()*host.progress()):'idle';if(key!==last){last=key;render();}},
  dispose(){unsubscribe();clearTimeout(toastTimer);panel.remove();toast.remove();},
 };
}

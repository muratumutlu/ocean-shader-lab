export type DemoMessage={channel:'ocean-demo';version:1;type:'ready'}|{channel:'ocean-demo';version:1;type:'pause';paused:boolean}|{channel:'ocean-demo';version:1;type:'dispose'};
export function isTrustedMessage(event:MessageEvent,expectedOrigin:string,expectedSource:Window):event is MessageEvent<DemoMessage>{
 if(event.origin!==expectedOrigin||event.source!==expectedSource)return false;
 const data=event.data;if(!data||typeof data!=='object'||data.channel!=='ocean-demo'||data.version!==1)return false;
 return data.type==='ready'||data.type==='dispose'||(data.type==='pause'&&typeof data.paused==='boolean');
}
export const PARENT_ORIGIN=import.meta.env.DEV?'http://127.0.0.1:4321':'https://portfolio.muum.ai';
export function postParent(type:'ready'|'dispose'){
 if(window.parent!==window)window.parent.postMessage({channel:'ocean-demo',version:1,type},PARENT_ORIGIN);
}

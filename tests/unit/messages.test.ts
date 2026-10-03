import {it,expect} from 'vitest';
const modulePath='../../src/bridge/messages.ts';const api=await import(modulePath).catch(()=>({}));
it('rejects wrong origin, source, version and malformed pause without trusting names',()=>{
 expect(api.isTrustedMessage).toBeTypeOf('function');const parent={} as Window;const payload={channel:'ocean-demo',version:1,type:'pause',paused:true};
 const event=(data:any=payload,origin='https://portfolio.muum.ai',source=parent)=>({data,origin,source} as MessageEvent);
 expect(api.isTrustedMessage(event(),'https://portfolio.muum.ai',parent)).toBe(true);
 expect(api.isTrustedMessage(event(payload,'https://evil.test'),'https://portfolio.muum.ai',parent)).toBe(false);
 expect(api.isTrustedMessage(event(payload,undefined,{} as Window),'https://portfolio.muum.ai',parent)).toBe(false);
 for(const data of [null,{}, {...payload,version:2},{...payload,paused:'true'},{...payload,type:'unknown'}])expect(api.isTrustedMessage(event(data),'https://portfolio.muum.ai',parent)).toBe(false);
 expect(api.isTrustedMessage(event({channel:'ocean-demo',version:1,type:'dispose'}),'https://portfolio.muum.ai',parent)).toBe(true);
});

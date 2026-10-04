import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='docs/evidence/living-cove/retry-diagnostic';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{const names=new Map(),values={};window.__renderValues=values;const proto=WebGL2RenderingContext.prototype,old=proto.getUniformLocation;proto.getUniformLocation=function(p,n){const l=old.call(this,p,n);names.set(l,n);return l;};for(const k of ['uniformMatrix4fv','uniform3f','uniform1f','uniform2f']){const fn=proto[k];proto[k]=function(l,...args){values[names.get(l)]=args.map(v=>ArrayBuffer.isView(v)?Array.from(v):v);return fn.call(this,l,...args);};}});
 await page.goto('http://127.0.0.1:4175/');await page.getByRole('button',{name:'Coast settings'}).click();await page.getByLabel('Water level').fill('0.35');await page.getByLabel('Wave swell').fill('0.8');await page.getByLabel('Sun direction').fill('35');await page.getByRole('button',{name:'Coast settings'}).click();
 const capture=async n=>{const v=await page.locator('#ocean').evaluate(c=>({png:c.toDataURL(),values:window.__renderValues,w:c.width,h:c.height,busy:c.getAttribute('aria-busy')}));await writeFile(`${dir}/${n}.png`,Buffer.from(v.png.split(',')[1],'base64'));delete v.png;return v;};
 const before=await capture('before');await page.locator('#ocean').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.locator('#fallback').waitFor({state:'visible'});await page.getByRole('button',{name:'Try the live scene again'}).click();await page.locator('#fallback').waitFor({state:'hidden'});const after=await capture('after');await page.waitForTimeout(400);const settled=await capture('settled');
 const diff=(a,b)=>Object.keys(a.values).filter(k=>JSON.stringify(a.values[k])!==JSON.stringify(b.values[k])).map(k=>({name:k,before:a.values[k],after:b.values[k]}));console.log(JSON.stringify({before:{w:before.w,h:before.h,busy:before.busy},after:{w:after.w,h:after.h,busy:after.busy},settled:{w:settled.w,h:settled.h,busy:settled.busy},diff:diff(before,after),settledDiff:diff(before,settled)},null,2));await writeFile(`${dir}/uniforms.json`,JSON.stringify({before,after,settled},null,2));
}finally{await browser.close();}

import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {build} from 'vite';

test('the published CSP loads Rapier navigation and the turtle controls',async({page,baseURL})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 const rules=await readFile(new URL('../../public/_headers',import.meta.url),'utf8');
 const csp=rules.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
 if(!csp)throw Error('Publication CSP is missing');
 const result=await build({logLevel:'silent',build:{write:false}});
 if(Array.isArray(result)||!('output' in result))throw Error('Expected one production build');
 const files=new Map(result.output.map(file=>[file.fileName,file.type==='chunk'?file.code:file.source]));
 await page.route(new URL('/**',baseURL).href,async route=>{
  const path=new URL(route.request().url()).pathname.slice(1)||'index.html';
  const body=files.get(path)??await readFile(new URL('../../public/'+path,import.meta.url));
  const contentType=path.endsWith('.html')?'text/html':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'application/octet-stream';
  await route.fulfill({body:typeof body==='string'?body:Buffer.from(body),contentType,headers:{'content-security-policy':csp}});
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await expect(page.locator('#mode-turtle')).toBeEnabled({timeout:15000});
 await expect(page.locator('#navigation-retry')).toBeHidden();
 await page.locator('#mode-turtle').click();
 await expect(page.locator('#mode-turtle')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#return-turtle')).toBeVisible();
 expect(errors).toEqual([]);
});

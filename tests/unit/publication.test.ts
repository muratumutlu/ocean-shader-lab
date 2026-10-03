import {it,expect} from 'vitest';
const modulePath='../../scripts/verify-publication.mjs';const api=await import(modulePath).catch(()=>({}));
it('publication accepts only generated demo assets and rejects archive, secrets and internal artifacts',()=>{
 expect(api.assertPublication).toBeTypeOf('function');
 expect(()=>api.assertPublication(['index.html','assets/index-aBc12.js','assets/index-aBc12.css','poster.webp','PROMPT.md','_headers'])).not.toThrow();
 for(const file of ['../old-project/index.html','.env','assets/private.env','referans.png','docs/evidence/demo.png','src/main.ts','assets/code.js.map','arbitrary.json'])expect(()=>api.assertPublication(['index.html',file])).toThrow();
});

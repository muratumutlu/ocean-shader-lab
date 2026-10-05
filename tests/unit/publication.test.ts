import {it,expect} from 'vitest';
const modulePath='../../scripts/verify-publication.mjs';const api=await import(modulePath).catch(()=>({}));
const complete=['index.html','assets/index-aBc12.js','assets/index-aBc12.css','assets/turtle.glb','poster.webp','PROMPT.md','_headers'];
it('publication includes the exact runtime turtle asset and rejects unrelated assets or private evidence',()=>{
 expect(api.assertPublication).toBeTypeOf('function');
 expect(()=>api.assertPublication(complete)).not.toThrow();
 for(const file of ['../old-project/index.html','.env','assets/private.env','referans.png','docs/evidence/demo.png','src/main.ts','assets/code.js.map','arbitrary.json','assets/other.glb','assets/turtle.blend','assets/source/turtle.glb'])expect(()=>api.assertPublication([...complete,file])).toThrow('Unapproved publication file');
});
it('publication fails when the shipped turtle dependency is missing',()=>{
 expect(()=>api.assertPublication(complete.filter(file=>file!=='assets/turtle.glb'))).toThrow('Missing demo publication asset');
});

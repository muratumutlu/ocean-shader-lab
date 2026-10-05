import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const base=new URL(process.argv[2]??'https://ocean-shader-lab.muum-dev-account.workers.dev/');
if(base.protocol!=='https:'||base.pathname!=='/')throw Error('Provide the exact HTTPS publication root');
const dist=resolve('dist');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function filesAt(directory,prefix=''){
 const result=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=prefix+entry.name;
  if(entry.isDirectory())result.push(...await filesAt(resolve(directory,entry.name),path+'/'));
  else result.push(path);
 }
 return result.sort();
}
const files=await filesAt(dist),verified=[];
for(const path of files.filter(path=>path!=='_headers')){
 const response=await fetch(new URL(path==='index.html'?'':path,base),{signal:AbortSignal.timeout(30000)});
 if(response.status!==200)throw Error(path+': HTTP '+response.status);
 const expected=await readFile(resolve(dist,path)),actual=Buffer.from(await response.arrayBuffer());
 if(hash(actual)!==hash(expected))throw Error(path+': published bytes differ from the verified build');
 if(path==='index.html'){
  const rules=(await readFile(resolve(dist,'_headers'),'utf8')).split('\n').slice(1).map(line=>line.trim()).filter(Boolean);
  for(const rule of rules){const colon=rule.indexOf(':');const name=rule.slice(0,colon),value=rule.slice(colon+1).trim();
   if(response.headers.get(name)!==value)throw Error('Published header mismatch: '+name);
  }
 }
 verified.push({path,bytes:actual.length,sha256:hash(actual)});
}
for(const path of ['_headers','.env','docs/evidence/','assets/candidate.glb']){
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(15000)});
 if(response.status!==404)throw Error('Excluded path should be 404: '+path+' returned '+response.status);
}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),url:base.href,files:verified,headers:'match',excludedPaths:'404'},null,2));

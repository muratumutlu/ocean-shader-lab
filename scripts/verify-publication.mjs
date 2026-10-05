import {readdir,lstat,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export function assertPublication(files){
 const allowed=/^(index\.html|poster\.webp|PROMPT\.md|_headers|assets\/turtle\.glb|assets\/[A-Za-z0-9_-]+\.(js|css))$/;
 for(const file of files)if(!allowed.test(file))throw new Error('Unapproved publication file: '+file);
 if(!files.includes('index.html')||!files.includes('PROMPT.md')||!files.includes('poster.webp')||!files.includes('assets/turtle.glb'))throw new Error('Missing demo publication asset');
}
async function walk(dir,root=dir){
 const result=[];for(const name of await readdir(dir)){const path=resolve(dir,name),stat=await lstat(path);if(stat.isSymbolicLink())throw new Error('Symlinks cannot be published');if(stat.isDirectory())result.push(...await walk(path,root));else result.push(relative(root,path));}return result;
}
export async function verifyPublication(root=process.cwd()){
 const files=await walk(resolve(root,'dist'));assertPublication(files);
 const raw=await readFile(resolve(root,'PROMPT.md')),copy=await readFile(resolve(root,'dist/PROMPT.md'));
 if(!raw.equals(copy))throw new Error('Reproduction prompt drift');
 const turtle=await readFile(resolve(root,'public/assets/turtle.glb')),publishedTurtle=await readFile(resolve(root,'dist/assets/turtle.glb'));
 if(!turtle.equals(publishedTurtle))throw new Error('Published turtle asset drift');
 for(const file of files.filter(f=>f.endsWith('.js')))if((await readFile(resolve(root,'dist',file),'utf8')).includes('127.0.0.1:4321'))throw new Error('Development origin in production');
 return {files:files.sort(),promptSha256:createHash('sha256').update(raw).digest('hex'),turtleSha256:createHash('sha256').update(turtle).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await verifyPublication(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}

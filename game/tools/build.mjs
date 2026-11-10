import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';import {resolve,dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'dist');
for(const name of await readdir(join(root,'src'))){if(name.endsWith('.js')){const check=spawnSync(process.execPath,['--check',join(root,'src',name)],{stdio:'inherit'});if(check.status)process.exit(check.status);}}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','style.css','favicon.svg','src','engine'])await cp(join(root,name),join(out,name),{recursive:true});
await mkdir(join(out,'vendor'));await cp(join(root,'vendor/runtime-notices'),join(out,'vendor/runtime-notices'),{recursive:true});for(const name of ['cannon-es.js','CANNON-LICENSE','COCOS-LICENSE.txt'])await cp(join(root,'vendor',name),join(out,'vendor',name));
for(const name of ['THIRD_PARTY_NOTICES.md','ENGINE-SOURCE.json','start-demo.py','VERSION.txt'])await cp(join(root,name),join(out,name));
// Version every entry and relative module request, including transitive leaf
// imports. An index-only ?build query cannot invalidate cached child modules.
const revisionHash=createHash('sha256');
async function hashInputs(dir){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,item.name);if(item.isDirectory())await hashInputs(path);else{revisionHash.update(path.slice(out.length+1));revisionHash.update(await readFile(path));}}}
await hashInputs(out);const assetRevision=revisionHash.digest('hex').slice(0,20);
for(const item of await readdir(join(out,'src'))){if(!item.endsWith('.js'))continue;const path=join(out,'src',item),source=await readFile(path,'utf8');await writeFile(path,source.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"?]+)(['"])/g,`$1$2?v=${assetRevision}$3`));}
const index=join(out,'index.html');await writeFile(index,(await readFile(index,'utf8')).replace(/(\b(?:src|href)=['"])(\.\/[^'"?]+\.(?:js|css|svg))(['"])/g,`$1$2?v=${assetRevision}$3`));
const artifacts={};async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else artifacts[path.slice(out.length+1)]=createHash('sha256').update(await readFile(path)).digest('hex');}}await walk(out);
await writeFile(join(out,'build-manifest.json'),JSON.stringify({engine:'Cocos Engine 3.8.7',physics:'cannon-es 0.20.0',assetRevision,files:artifacts},null,2)+'\n');console.log(`Static game built: ${out} (${Object.keys(artifacts).length} files, assets ${assetRevision}); all game modules passed syntax checks.`);

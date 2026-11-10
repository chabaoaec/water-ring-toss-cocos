import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';import {resolve,dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'dist');
for(const name of await readdir(join(root,'src'))){if(name.endsWith('.js')){const check=spawnSync(process.execPath,['--check',join(root,'src',name)],{stdio:'inherit'});if(check.status)process.exit(check.status);}}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','style.css','favicon.svg','src','engine'])await cp(join(root,name),join(out,name),{recursive:true});
await mkdir(join(out,'vendor'));await cp(join(root,'vendor/runtime-notices'),join(out,'vendor/runtime-notices'),{recursive:true});for(const name of ['cannon-es.js','CANNON-LICENSE','COCOS-LICENSE.txt'])await cp(join(root,'vendor',name),join(out,'vendor',name));
for(const name of ['THIRD_PARTY_NOTICES.md','ENGINE-SOURCE.json'])await cp(join(root,name),join(out,name));
const artifacts={};async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else artifacts[path.slice(out.length+1)]=createHash('sha256').update(await readFile(path)).digest('hex');}}await walk(out);
await writeFile(join(out,'build-manifest.json'),JSON.stringify({engine:'Cocos Engine 3.8.7',physics:'cannon-es 0.20.0',files:artifacts},null,2)+'\n');console.log(`Static game built: ${out} (${Object.keys(artifacts).length} files); all game modules passed syntax checks.`);

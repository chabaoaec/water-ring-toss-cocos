import {mkdir,readFile,writeFile,access,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const commit='6a204c1b6ca1cbe8d090d622d8697c3398def153';
const sha256='bda1e01863bd374bc8f55febe7e141f05de85f4f0efe26b8644cedb62bb6be73';
const source=join(root,'vendor/cocos-engine'),archive=join(root,'vendor/cocos-engine-source.tar.gz');
const run=(cmd,args,cwd=root)=>{const r=spawnSync(cmd,args,{cwd,stdio:'inherit'});if(r.status!==0)throw new Error(`${cmd} failed: ${r.status}`);};
await mkdir(join(root,'vendor'),{recursive:true});
try{await access(join(source,'package-lock.json'));}catch{
 console.log('Fetching fixed official MIT Cocos Engine 3.8.7 source (~86 MB).');
 const response=await fetch(`https://codeload.github.com/cocos/cocos-engine/tar.gz/${commit}`);if(!response.ok)throw Error(`Source HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('Engine source SHA-256 mismatch');
 await writeFile(archive,bytes);run('tar',['-xzf',archive,'-C',join(root,'vendor')]);await rename(join(root,'vendor',`cocos-engine-${commit}`),source);await rm(archive);
}
const p=JSON.parse(await readFile(join(source,'package.json')));if(p.version!=='3.8.7')throw Error('Unexpected source version');
// Upstream lock is authoritative. No global install; Editor/native postinstall is intentionally unused.
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
console.log('Engine source/build dependencies ready. Run npm run build:engine.');

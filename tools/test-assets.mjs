import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
export function treeFingerprint(root, inputs, identity) {
 const h=createHash('sha256').update(JSON.stringify(identity));
 function walk(relative) {
  const absolute=path.join(root,relative);
  if(!existsSync(absolute)){h.update(relative+'\0missing\0');return;}
  const entries = readdirSync(absolute,{withFileTypes:true});
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
   const name=relative+'/'+entry.name;
   if(entry.isDirectory())walk(name);
   else if(entry.isFile())h.update(name+'\0').update(hash(readFileSync(path.join(root,name))));
   else throw Error('Unsupported cache input: '+name);
  }
 }
 for(const input of inputs) {
  if(input.endsWith('/'))walk(input.slice(0,-1));
  else {h.update(input+'\0');h.update(existsSync(path.join(root,input))?hash(readFileSync(path.join(root,input))):'missing');}
 }
 return h.digest('hex');
}
function valid(directory, key) {
 try {
  const manifest=JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8'));
  return manifest.key===key && Object.keys(manifest.outputs).length>0 && Object.entries(manifest.outputs).every(([file,digest])=>hash(readFileSync(path.join(directory,file)))===digest);
 } catch {return false;}
}
/** Short artifact publication lock. No host/role queue and no test execution lock. */
export function prepareArtifact({root,kind,fingerprint,build,outputs,timeoutMs=30000}) {
 const start=performance.now(),base=path.join(root,'.build/test-assets',kind),lock=base+'.lock';
 mkdirSync(path.dirname(base),{recursive:true});
 const token=randomUUID();
 for(;;){
  try {mkdirSync(lock);writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,token}));break;}
  catch(error){if(error.code!=='EEXIST')throw error;
   try {const owner=JSON.parse(readFileSync(path.join(lock,'owner.json'),'utf8'));let alive=true;
    try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
    if(!alive){const stale=lock+'.stale-'+token;renameSync(lock,stale);rmSync(stale,{recursive:true,force:true});continue;}
   }catch{}
   if(performance.now()-start>timeoutMs)throw Error('Test asset preparation busy: '+kind);
   pause();
  }
 }
 let temporary;
 try {
  const key=fingerprint(),directory=path.join(base,key);
  if(valid(directory,key))return {kind,key,directory,cache:'hit',reason:'verified contents',ms:performance.now()-start};
  const reason=existsSync(directory)?'missing or damaged output':'new input fingerprint';
  mkdirSync(base,{recursive:true});temporary=mkdtempSync(path.join(base,'.building-'));
  build(temporary);
  if(fingerprint()!==key)throw Error('Sources changed during test preparation; retry the selected run.');
  const digests=Object.fromEntries(outputs.map(file=>[file,hash(readFileSync(path.join(temporary,file)))]));
  writeFileSync(path.join(temporary,'manifest.json'),JSON.stringify({key,outputs:digests})+'\n');
  if(existsSync(directory))rmSync(directory,{recursive:true,force:true});
  renameSync(temporary,directory);temporary=undefined;
  return {kind,key,directory,cache:'miss',reason,ms:performance.now()-start};
 } finally {
  if(temporary)rmSync(temporary,{recursive:true,force:true});
  const owner=JSON.parse(readFileSync(path.join(lock,'owner.json'),'utf8'));
  if(owner.token===token)rmSync(lock,{recursive:true});
 }
}
export function ensureTestAsset(kind,root=process.cwd()) {
 if(!['core','store'].includes(kind))throw Error('Unknown test asset: '+kind);
 const result=prepareArtifact({root,kind,
  fingerprint:()=>treeFingerprint(root,['src/','package.json','package-lock.json','tsconfig.json','tools/test-assets.mjs','tools/build-test-assets.mjs','tools/catalog-build-asset.mjs',...(kind==='core'?['tests/shared/core/','tests/shared/core.test.ts']:[])],{kind,node:process.version,platform:process.platform,arch:process.arch,esbuild:JSON.parse(readFileSync(path.join(root,'node_modules/esbuild/package.json'),'utf8')).version}),
  outputs:['bundle.cjs','catalog/srd-5.1.generated.json',...(kind==='core'?['bundle.cjs.map','catalog/SRD-5.1-ATTRIBUTION.md']:[])],
  build:directory=>{
   const child=spawnSync(process.execPath,[path.join(root,'tools/build-test-assets.mjs'),kind,directory],{cwd:root,stdio:'inherit'});
   if(child.error)throw child.error;
   if(child.status!==0)throw Error(`Test asset ${kind} failed: ${child.signal??child.status}`);
  }});
 if(process.env.SALT_TEST_RUN_DIR){mkdirSync(process.env.SALT_TEST_RUN_DIR,{recursive:true});writeFileSync(path.join(process.env.SALT_TEST_RUN_DIR,`asset-${process.pid}-${randomUUID()}.json`),JSON.stringify(result));}
 console.log(`Test asset ${kind}: ${result.cache} (${result.reason}, ${Math.round(result.ms)} ms)`);
 return path.join(result.directory,'bundle.cjs');
}
export function publishTestAlias(source,destination) {
 mkdirSync(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID()+'.tmp';
 const relative='./'+path.relative(path.dirname(destination),source).split(path.sep).join('/');
 writeFileSync(temporary,`module.exports = require(${JSON.stringify(relative)});\n`);renameSync(temporary,destination);
}
/** Small file-only support for existing custom fixtures that emit into .build. */
export function prepareTestCatalog(root=process.cwd()) {
 for(const [source,name] of [['src/features/catalog/data/srd-5.1.generated.json','srd-5.1.generated.json'],['src/features/catalog/SRD-5.1-ATTRIBUTION.md','SRD-5.1-ATTRIBUTION.md']]) {
  const bytes=readFileSync(path.join(root,source));
  for(const subdir of ['catalog','test-shared/catalog']){
   const destination=path.join(root,'.build',subdir,name);
   if(existsSync(destination)&&hash(readFileSync(destination))===hash(bytes))continue;
   mkdirSync(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID()+'.tmp';writeFileSync(temporary,bytes);renameSync(temporary,destination);
  }
 }
}

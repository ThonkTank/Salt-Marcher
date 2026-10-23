import {mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve('.build/atlas-maplibre-interop');
await mkdir(root,{recursive:true});
// Keep the complete transitive graph reproducible while the new renderer is
// isolated from the runnable product reference. Never resolve fresh ranges here.
for(const name of ['package.json','package-lock.json']){
  await copyFile(resolve('tools/atlas-maplibre-interop',name),resolve(root,name));
}
const result=spawnSync('npm',['ci','--no-audit','--no-fund','--ignore-scripts'],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
console.log(`Pinned isolated dependencies prepared in ${root}`);

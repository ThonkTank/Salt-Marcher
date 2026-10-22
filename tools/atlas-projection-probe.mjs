import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const Database=createRequire(import.meta.url)('better-sqlite3');

// Outside opening measurements: do not race shutdown against background backup.
export async function waitForAtlasProjection(directory){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  try{
   const reference=(await readdir(directory)).find(name=>/^[a-f0-9]{64}\.json$/.test(name));
   const entry=JSON.parse(await readFile(path.join(directory,reference),'utf8'));
   const index=new Database(path.join(directory,entry.file),{readonly:true});
   try{
    const parts=new Set(index.prepare('SELECT part FROM projection_meta').all().map(row=>row.part));
    if(parts.has('geometry')&&parts.has('landscape'))return;
   }finally{index.close();}
  }catch{/* A first background publication may still be in progress. */}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.fail('Both index sections must be published before the reopen check');
}

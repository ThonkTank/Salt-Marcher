// Run in a fresh process: node --expose-gc tools/measure-landscape-writes.mjs
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {populateMixedWorld} from './atlas-mixed-world-fixture.mjs';
assert(global.gc,'Use --expose-gc to make the before/after memory samples comparable');
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/landscape-write-measure.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/landscape-write-measure.cjs');
const cache=path.join(homedir(),'.cache/saltmarcher/diagnostics');mkdirSync(cache,{recursive:true});
const dir=mkdtempSync(path.join(cache,'landscape-write-'));let store;
try {
  store=new CampaignStore(dir+'/world.sqlite');const campaign=store.create('Schreiblast');store.activateShell(campaign.id);
  global.gc();const before=process.memoryUsage(),start=performance.now();
  const fixture=populateMixedWorld(store,campaign,{hexes:5000,buildings:1,details:1,dungeonRooms:1});
  const durationMs=performance.now()-start,after=process.memoryUsage();global.gc();const collected=process.memoryUsage();
  store.close();store=null;global.gc();
  const result={before,after,collected,closed:process.memoryUsage(),durationMs,fixture,
    method:'Fresh Node process; RSS sampled after setup, not peak RSS, native UI latency or memory plateau. Hex timings cover the property writer transaction.'};
  writeFileSync(process.env.QA_EVIDENCE_FILE??'.build/landscape-write-memory.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {store?.close();rmSync(dir,{recursive:true,force:true});}

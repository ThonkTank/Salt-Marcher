import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,createReadStream,createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {populateMixedWorld} from './atlas-mixed-world-fixture.mjs';

// Recreate the disposable test inventory through the current schema and fixture writer.
const output=process.argv[2];
if(!output||process.argv.length!==3)throw Error('Usage: node tools/create-atlas-mixed-fixture.mjs <output.sqlite.gz>');
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/mixed-fixture-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/mixed-fixture-store.cjs');
const dir=mkdtempSync(join(tmpdir(),'atlas-mixed-fixture-')),file=join(dir,'world.sqlite');
let store;
try {
 store=new CampaignStore(file);const campaign=store.create('Große Atlas-Mischwelt');
 const result=populateMixedWorld(store,campaign);store.tutorial('skipped');
 store.db.pragma('wal_checkpoint(TRUNCATE)');store.close();store=null;
 await pipeline(createReadStream(file),createGzip({level:9}),createWriteStream(output));
 console.log(JSON.stringify(result));
} finally {store?.close();rmSync(dir,{recursive:true,force:true});}

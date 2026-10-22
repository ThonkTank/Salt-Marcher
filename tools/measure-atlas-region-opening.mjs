// Compare the region reader against an explicit Git baseline on a retained synthetic mixed world.
// Explicit baseline files come from Git; all other dependencies stay current.
// This is not a whole-release comparison.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),{build}=require('esbuild');
const file='src/app/storage/atlas-region.ts',ref=process.env.ATLAS_REGION_BASELINE,filename=process.env.ATLAS_MIXED_SOURCE;
assert(ref&&filename,'Set ATLAS_REGION_BASELINE and ATLAS_MIXED_SOURCE (a retained synthetic world, never a live user database)');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-region-opening');mkdirSync(output,{recursive:true});
const files=(process.env.ATLAS_REGION_BASELINE_FILES??file).split(',');assert(files.includes(file));
const old=new Map(files.map(f=>[path.resolve(f),execFileSync('git',['show',ref+':'+f],{encoding:'utf8'})]));
await build({entryPoints:[file],outfile:path.join(output,'region-before.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],plugins:[{name:'baseline',setup(b){b.onLoad({filter:/\.ts$/},args=>old.has(args.path)?{contents:old.get(args.path),loader:'ts',resolveDir:path.dirname(args.path)}:undefined);}}]});
await build({entryPoints:[file],outfile:path.join(output,'region-after.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const runs=[];
for(const label of ['before','after']){
 const db=new Database(filename,{readonly:true});try{
  db.exec('BEGIN'); // Match the worker: pin one canonical snapshot through index maintenance and reads.
  const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename,campaignId:root.campaign_id,token:'diagnostic',fence:'diagnostic',revision:root.revision,epoch:'diagnostic',sequence:0,reset:true,changes:[]};
  const building=db.prepare("SELECT b.* FROM atlas_binding b JOIN room_group g ON g.campaign_id=b.campaign_id AND g.id=b.owner_id WHERE b.campaign_id=? AND b.parent='world' ORDER BY b.rowid LIMIT 1").get(root.campaign_id);
  const dungeon=db.prepare("SELECT b.* FROM atlas_binding b WHERE b.campaign_id=? AND b.kind='dungeon' AND (SELECT count(*) FROM room r WHERE r.campaign_id=b.campaign_id AND r.scope_id=b.owner_id)>4000 LIMIT 1").get(root.campaign_id);
  assert(building&&dungeon,'Mixed-world fixture requires an independent building and a dungeon with over 4000 rooms');
  const {AtlasRegionReader}=require(path.join(output,'region-'+label+'.cjs')),reader=new AtlasRegionReader(db),start=performance.now();await reader.sync(source);const syncMs=performance.now()-start;
  const queries=[['world',{x:-20000000,y:-12500000,width:40000000,height:25000000},null],['region',{x:-1000000,y:-600000,width:2000000,height:1200000},null],['building',{x:building.x-20,y:building.y-20,width:40,height:40},building.owner_id],['dungeon',{x:dungeon.x-20,y:dungeon.y-20,width:100,height:60},dungeon.owner_id]];
  const views=[];for(const [name,box,scopeId] of queries){const q={box,width:1440,height:900,scopeId,floorId:'ground',slice:null,roofs:true,terrainRaster:false},start=performance.now(),result=reader.read(source,q),json=JSON.stringify(result);views.push({name,ms:performance.now()-start,sha256:createHash('sha256').update(json).digest('hex'),bytes:Buffer.byteLength(json),coverage:result.coverage,rooms:result.rooms.length,elements:result.drawing.elements.length});}
  const report={label,bundleSha256:createHash('sha256').update(readFileSync(path.join(output,'region-'+label+'.cjs'))).digest('hex'),syncMs,tempBytes:db.pragma('temp.page_count',{simple:true})*db.pragma('temp.page_size',{simple:true}),shapeCacheBytes:reader.shapePayloads?.bytes??null,views};runs.push(report);console.log(JSON.stringify(report));
 }finally{db.close();}
}
const equal=runs[0].views.every((view,i)=>runs[1].views[i].sha256===view.sha256);
writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,files,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),equal,runs},null,2));
assert(equal,'Region rendering differs from the baseline; inspect the retained results');

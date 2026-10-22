// Compare the same 48 detail tiles and context using old/current reader owners.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),input=process.env.TERRAIN_INDEX_SOURCE,ref=process.env.TERRAIN_INDEX_BASELINE??'5f0968763';
assert(input,'Set TERRAIN_INDEX_SOURCE to a retained synthetic world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-base-index');mkdirSync(output,{recursive:true});
const file='src/app/storage/atlas-landscape-region.ts';
for(const label of ['before','after'])buildSync({stdin:{contents:label==='before'?execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}):readFileSync(file,'utf8'),loader:'ts',resolveDir:path.resolve('src/app/storage')},outfile:path.join(output,label+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/terrain-navigation-plan';export * from './src/app/terrain-detail-tiles';",resolveDir:process.cwd()},outfile:path.join(output,'plan.cjs'),bundle:true,platform:'node',format:'cjs'});
const {terrainNavigationPlan,terrainDetailTiles}=require(path.join(output,'plan.cjs')),runs=[];
for(const label of ['before','after','after','before']){
 const db=new Database(input,{readonly:true});try{
  db.pragma('cache_size = -8192');db.pragma('temp_store = FILE');db.pragma('temp.cache_size = -8192');
  db.exec('BEGIN');const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename:input,campaignId:root.campaign_id,token:'diagnostic',fence:'diagnostic',revision:root.revision,epoch:'diagnostic',sequence:0,reset:true,changes:[]},reader=new (require(path.join(output,label+'.cjs')).AtlasLandscapeReader)(db);reader.sync(source);
  // Include synchronous setup before the first generator step in the timing.
  function consume(create){let yields=0,maxStepMs=0,first=true;const start=performance.now(),steps=create(),setupMs=performance.now()-start;for(;;){const begin=first?start:performance.now();first=false;const s=steps.next();maxStepMs=Math.max(maxStepMs,performance.now()-begin);if(s.done)return{value:s.value,ms:performance.now()-start,yields,maxStepMs,setupMs};yields++;}}
  const queries=terrainNavigationPlan({frame:{x:-20000000,y:-14791666.666666666,width:40000000,height:29583333.333333332},pixelWidth:1153,pixelHeight:853,coverage:3},root.revision,{tilt:0,rotation:0,exaggeration:1},[]),overview=consume(()=>reader.terrainSteps(source,queries[0])),rows=[],digest=createHash('sha256');
  const tempBytes=()=>db.pragma('temp.page_count',{simple:true})*db.pragma('temp.page_size',{simple:true}),tempBefore=tempBytes();
  assert.equal(db.prepare("SELECT name FROM temp.sqlite_master WHERE name LIKE 'landscape_base_%'").get(),undefined,'First overview must not build the index');
  const plan=terrainDetailTiles(queries[1].detail);
  for(const tile of plan.tiles){const result=consume(()=>reader.colorSteps(source,{box:tile.box,width:tile.width,height:tile.height,revision:source.revision,fence:source.fence,routeContext:queries[1].view.box,routeFocus:queries[1].view.refinement,contours:0,displayMpp:plan.mpp}));rows.push({phase:'tile',ms:result.ms,yields:result.yields,maxStepMs:result.maxStepMs,setupMs:result.setupMs});digest.update(result.value.pixels);}
  const {detail,detailResolution,...context}=queries[1],result=consume(()=>reader.terrainSteps(source,context));rows.push({phase:'context',ms:result.ms,yields:result.yields,maxStepMs:result.maxStepMs,setupMs:result.setupMs});digest.update(JSON.stringify(result.value));
  const run={label,overviewMs:overview.ms,overviewSha256:createHash('sha256').update(JSON.stringify(overview.value)).digest('hex'),sha256:digest.digest('hex'),tiles:plan.tiles.length,totalMs:rows.reduce((s,r)=>s+r.ms,0),tempBefore,tempAfter:tempBytes(),rows};runs.push(run);console.log(JSON.stringify({...run,rows:undefined}));
 }finally{db.close();}
}
const equal=runs.every(r=>r.sha256===runs[0].sha256&&r.overviewSha256===runs[0].overviewSha256);writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,equal,note:'Synchronous CPU comparison, includes lazy index build, no renderer or IPC; TEMP bytes are allocated database pages, not process RAM.',runs},null,2));assert(equal,'Terrain output changed');

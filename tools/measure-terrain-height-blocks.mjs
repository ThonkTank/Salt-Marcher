// Compare identical snapshots and raster inputs; old/new reader owners share dependencies.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),input=process.env.TERRAIN_BLOCK_SOURCE,ref=process.env.TERRAIN_BLOCK_BASELINE??'14dea0132';
assert(input,'Set TERRAIN_BLOCK_SOURCE to a retained synthetic world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-height-blocks');mkdirSync(output,{recursive:true});
const file='src/app/storage/atlas-landscape-region.ts';
for(const label of ['before','after'])buildSync({stdin:{contents:label==='before'?execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}):readFileSync(file,'utf8'),loader:'ts',resolveDir:path.resolve('src/app/storage')},outfile:path.join(output,label+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const runs=[];
for(const label of ['before','after','after','before']){
 const db=new Database(input,{readonly:true});try{
  db.exec('BEGIN');const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename:input,campaignId:root.campaign_id,token:'diagnostic',fence:'diagnostic',revision:root.revision,epoch:'diagnostic',sequence:0,reset:true,changes:[]},reader=new (require(path.join(output,label+'.cjs')).AtlasLandscapeReader)(db);reader.sync(source);
  let payloads=0,heightPayloads=0,heightBytes=0;const count=row=>{if(row?.payload){payloads++;if(row.payload.includes('"height":')){heightPayloads++;heightBytes+=Buffer.byteLength(row.payload);}}};
  const sql=reader.sql.bind(reader);reader.sql=text=>{const st=sql(text);if(text.includes('FROM json_each(?) ids CROSS JOIN atlas_landscape'))return{*iterate(...args){for(const row of st.iterate(...args)){count(row);yield row;}}};if(text.startsWith('SELECT a.payload,l.trashed FROM atlas_landscape'))return{get(...args){const row=st.get(...args);count(row);return row;}};return st;};
  const frame={x:-20000000,y:-14791666.666666666,width:40000000,height:29583333.333333332},box={x:-60000000,y:-60000000,width:120000000,height:120000000};
  const query={view:{projection:'perspective',box,frame,refinement:{x:-30000000,y:frame.y-frame.height/4,width:60000000,height:frame.height*1.5},columns:257,rows:257,focusM:0,tilt:0,rotation:0,exaggeration:2},revision:root.revision,objects:[],contours:0,displayMpp:frame.width/1153,width:128,height:128};
  const start=performance.now(),steps=reader.terrainSteps(source,query);let result;for(;;){const step=steps.next();if(step.done){result=step.value;break;}}
  const projectionMs=performance.now()-start,sha=value=>createHash('sha256').update(value).digest('hex'),cache=reader.projectionCache.tiles;
  const report={label,projectionMs,payloads,heightPayloads,heightBytes,cache:{bytes:cache.bytes,limit:cache.limit,hits:cache.hits,misses:cache.misses,evictions:cache.evictions},pixelsSha256:sha(result.pixels),heightsSha256:sha(Buffer.from(result.grid.heights.buffer)),projectionSha256:sha(JSON.stringify(result))};runs.push(report);console.log(JSON.stringify(report));assert(cache.bytes<=cache.limit);
 }finally{db.close();}
}
const equal=runs.every(run=>['pixelsSha256','heightsSha256','projectionSha256'].every(key=>run[key]===runs[0][key]));writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,equal,runs},null,2));assert(equal,'Projection changed');assert(runs[1].heightPayloads<runs[0].heightPayloads,'Decoded blocks must avoid repeated canonical payload reads');

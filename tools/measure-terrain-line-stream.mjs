// Compare the landscape reader's line selection on one readonly synthetic world.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),{buildSync}=require('esbuild'),ref=process.env.ATLAS_REGION_BASELINE,input=process.env.ATLAS_MIXED_SOURCE;
assert(ref&&input,'Set ATLAS_REGION_BASELINE and ATLAS_MIXED_SOURCE (retained synthetic world)');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-line-stream');mkdirSync(output,{recursive:true});
const file='src/app/storage/atlas-landscape-region.ts',old=execFileSync('git',['show',ref+':'+file],{encoding:'utf8'});
for(const label of ['before','after'])buildSync({stdin:{contents:label==='before'?old:readFileSync(file,'utf8'),loader:'ts',resolveDir:path.resolve('src/app/storage')},outfile:path.join(output,label+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const runs=[];
for(const label of ['before','after']){
 const db=new Database(input,{readonly:true});try{
  db.exec('BEGIN');const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename:input,campaignId:root.campaign_id,token:'diagnostic',fence:'diagnostic',revision:root.revision,epoch:'diagnostic',sequence:0,reset:true,changes:[]},reader=new (require(path.join(output,label+'.cjs')).AtlasLandscapeReader)(db);reader.sync(source);
  let payloads=0;const sql=reader.sql.bind(reader);reader.sql=text=>{const st=sql(text);if(!text.includes('FROM json_each(?) ids CROSS JOIN atlas_landscape'))return st;return{*iterate(...args){for(const row of st.iterate(...args)){payloads++;yield row;}}};};
  const frame={x:-20000000,y:-14791666.666666666,width:40000000,height:29583333.333333332},box={x:-60000000,y:-60000000,width:120000000,height:120000000};
  const lineStart=performance.now(),lines=[...reader.terrainStream(source)('line',box)],lineMs=performance.now()-lineStart,linePayloads=payloads;payloads=0;
  const query={view:{projection:'perspective',box,frame,refinement:{x:-30000000,y:frame.y-frame.height/4,width:60000000,height:frame.height*1.5},columns:257,rows:257,focusM:0,tilt:0,rotation:0,exaggeration:2},revision:root.revision,objects:[],contours:0,displayMpp:frame.width/1153,width:128,height:128};
  const start=performance.now(),steps=reader.terrainSteps(source,query);let result;for(;;){const step=steps.next();if(step.done){result=step.value;break;}}
  const projectionMs=performance.now()-start,sha=value=>createHash('sha256').update(value).digest('hex'),report={label,lineMs,linePayloads,lines:lines.length,lineSha256:sha(JSON.stringify(lines)),projectionMs,projectionPayloads:payloads,pixelsSha256:sha(result.pixels),heightsSha256:sha(Buffer.from(result.grid.heights.buffer)),projectionSha256:sha(JSON.stringify(result))};runs.push(report);console.log(JSON.stringify(report));
 }finally{db.close();}
}
const equal=['lineSha256','pixelsSha256','heightsSha256','projectionSha256'].every(key=>runs[0][key]===runs[1][key]);writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,equal,runs},null,2));assert(equal,'Projection changed');assert(runs[1].linePayloads<runs[0].linePayloads,'Line query must skip unrelated sources');

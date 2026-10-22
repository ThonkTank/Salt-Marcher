// Same full-world projection before/after local invalidation; no author data is changed.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),input=process.env.TERRAIN_FIELD_SOURCE,ref=process.env.TERRAIN_FIELD_BASELINE??'9f3ec8ab5';
assert(input,'Set TERRAIN_FIELD_SOURCE to a retained synthetic world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-coarse-field');mkdirSync(output,{recursive:true});
const files=['src/app/storage/atlas-region.ts','src/app/terrain-cache.ts','src/app/terrain-projection-cache.ts','src/app/storage/terrain-color-raster.ts','src/app/storage/terrain-projection.ts'];
for(const label of ['before','after'])await build({stdin:{contents:"export * from './src/app/storage/atlas-landscape-region';export * from './src/app/terrain-navigation-plan';",resolveDir:process.cwd()},outfile:path.join(output,label+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],plugins:label==='before'?[{name:'before-coarse-field-cache',setup(b){b.onLoad({filter:/\.ts$/},args=>{const file=path.relative(process.cwd(),args.path);if(files.includes(file))return {contents:execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}),loader:'ts'};});}}]:[]});
const runs=[];
for(const label of ['before','after','after','before']){
 const db=new Database(input,{readonly:true});try{
  db.pragma('cache_size = -8192');db.pragma('temp_store = FILE');db.pragma('temp.cache_size = -8192');db.exec('BEGIN');
  const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename:input,campaignId:root.campaign_id,token:'coarse-field',fence:'coarse-field',revision:root.revision,epoch:'coarse-field',sequence:0,reset:true,changes:[]};
  const {AtlasLandscapeReader,terrainNavigationPlan}=require(path.join(output,label+'.cjs')),reader=new AtlasLandscapeReader(db);reader.sync(source);
  const original=reader.terrainStream.bind(reader);let queries=0,samples=0;
  reader.terrainStream=s=>{const stream=original(s),wrapped=(...args)=>stream(...args);wrapped.heightSources=(box,lattice)=>{queries++;samples+=lattice.columns*lattice.rows;return stream.heightSources(box,lattice);};return wrapped;};
  const base=terrainNavigationPlan({frame:{x:-20000000,y:-14791666.666666666,width:40000000,height:29583333.333333332},pixelWidth:1153,pixelHeight:853,coverage:3},source.revision,{tilt:0,rotation:0,exaggeration:1},[])[0],rows=[];
  for(const width of [64,128]){
   reader.projectionCache.invalidate([],true);const q={...base,width,height:Math.max(16,Math.round(width*base.view.box.height/base.view.box.width))};
   for(let edit=0;edit<4;edit++){
    if(edit)reader.projectionCache.invalidate([{x:-4023360+(edit-1)*300000,y:-4023360,width:8046720,height:8046720}]);
    queries=0;samples=0;const start=performance.now(),steps=reader.terrainSteps(source,q);let value,maxSliceMs=0;
    for(;;){const begin=performance.now(),step=steps.next();maxSliceMs=Math.max(maxSliceMs,performance.now()-begin);if(step.done){value=step.value;break;}}
    rows.push({width,edit,ms:performance.now()-start,maxSliceMs,queries,samples,cacheBytes:reader.projectionCache.tiles.bytes,cacheLimit:reader.projectionCache.tiles.limit,sha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')});
   }
  }
  const run={label,rows};runs.push(run);console.log(JSON.stringify(run));
 }finally{db.close();}
}
const equal=runs.every(r=>r.rows.every((v,i)=>v.sha256===runs[0].rows[i].sha256));
writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,files:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),equal,note:'Readonly CPU comparison after metadata sync. Invalidates a 2500-mile-radius area without changing the database; numerical edit/undo correctness is tested separately. No IPC, native input timing or physical target qualification.',runs},null,2));assert(equal,'Terrain projection changed');

// Identical full-world grids, with time until the worker can first service another job.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),input=process.env.TERRAIN_GRID_SOURCE,ref=process.env.TERRAIN_GRID_BASELINE??'9c4f752f9';
assert(input,'Set TERRAIN_GRID_SOURCE to a retained synthetic world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-grid-scheduling');mkdirSync(output,{recursive:true});
const files=['src/app/terrain-projection-cache.ts','src/app/storage/terrain-grid.ts','src/app/storage/terrain-projection.ts'];
for(const label of ['before','after'])await build({stdin:{contents:"export * from './src/app/storage/atlas-region';export * from './src/app/terrain-navigation-plan';",resolveDir:process.cwd()},outfile:path.join(output,label+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],plugins:label==='before'?[{name:'baseline-grid',setup(b){b.onLoad({filter:/\.ts$/},args=>{const file=path.relative(process.cwd(),args.path);if(files.includes(file))return{contents:execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}),loader:'ts'};});}}]:[]});
const runs=[];
for(const label of ['before','after','after','before']){
 const db=new Database(input,{readonly:true});try{
  db.exec('BEGIN');const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename:input,campaignId:root.campaign_id,token:'grid-diagnostic',fence:'grid-diagnostic',revision:root.revision,epoch:'grid-diagnostic',sequence:0,reset:true,changes:[]};
  const {AtlasRegionReader,terrainNavigationPlan}=require(path.join(output,label+'.cjs')),reader=new AtlasRegionReader(db),syncStart=performance.now();await reader.sync(source,false);const syncMs=performance.now()-syncStart;
  const q=terrainNavigationPlan({frame:{x:-20000000,y:-14791666.666666666,width:40000000,height:29583333.333333332},pixelWidth:1153,pixelHeight:853,coverage:3},root.revision,{tilt:0,rotation:0,exaggeration:1},[])[0];
  // Actual overview dimensions and visibility grid; no renderer or IPC timing.
  const start=performance.now(),steps=reader.terrainSteps(source,q),slices=[];let value;
  for(;;){const begin=performance.now(),step=steps.next();slices.push(performance.now()-begin);if(step.done){value=step.value;break;}}
  const run={label,syncMs,projectionMs:performance.now()-start,firstYieldMs:slices[0],maxSliceMs:Math.max(...slices),slices,gridSha256:createHash('sha256').update(JSON.stringify(value.grid)).digest('hex'),sha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')};runs.push(run);console.log(JSON.stringify({...run,slices:undefined}));
 }finally{db.close();}
}
const equal=runs.every(r=>r.sha256===runs[0].sha256&&r.gridSha256===runs[0].gridSha256);
writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:ref,files:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),equal,note:'Cold initial overview after metadata sync. Each next() represents an uninterrupted worker slice. Excludes worker startup, IPC, renderer and physical target hardware.',runs},null,2));assert(equal,'Terrain output changed');

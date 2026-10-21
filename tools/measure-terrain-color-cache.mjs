// Read-only cache-pressure measurement using a retained native world fixture.
// node tools/measure-terrain-color-cache.mjs <world-result.json> <output.json>
import {buildSync} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const [input,output]=process.argv.slice(2);assert(input&&output,'Provide the retained world result and an output path');
const fixture=JSON.parse(readFileSync(input,'utf8')),require=createRequire(import.meta.url);
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/storage/atlas-landscape-region';export * from './src/app/terrain-detail-tiles';"},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-color-cache-measure.cjs'});
const {AtlasLandscapeReader,terrainDetailTiles}=require('../.build/terrain-color-cache-measure.cjs');
const view=JSON.parse(fixture.metrics.find(m=>m.name==='sculpt').state.terrainProjection),plan=terrainDetailTiles(view.refinement);
const db=new(require('better-sqlite3'))(fixture.profile+'/workbench.sqlite',{readonly:true});
try{
 const {campaign_id:campaignId}=db.prepare('SELECT campaign_id FROM atlas_landscape LIMIT 1').get(),{revision}=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaignId);
 const source={campaignId,epoch:'cache-measurement',revision,fence:'cache-measurement',reset:true,changes:[]},reader=new AtlasLandscapeReader(db);reader.sync(source);
 const cache=reader.projectionCache.tiles,result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),input,moduleSHA256:createHash('sha256').update(readFileSync('.build/terrain-color-cache-measure.cjs')).digest('hex'),profile:fixture.profile,revision,tiles:plan.tiles.length,limit:cache.limit,passes:[]};
 for(let pass=0;pass<2;pass++){
  const before={hits:cache.hits,misses:cache.misses,evictions:cache.evictions},start=performance.now(),hashes=[];
  for(const tile of plan.tiles){
   const steps=reader.colorSteps(source,{box:tile.box,width:tile.width,height:tile.height,displayMpp:plan.mpp,revision,contours:0,routeContext:view.box,routeFocus:view.refinement});
   let next;do{next=steps.next();}while(!next.done);
   hashes.push(createHash('sha256').update(next.value.pixels).digest('hex'));
  }
  const measured={pass,ms:performance.now()-start,bytes:cache.bytes,hits:cache.hits-before.hits,misses:cache.misses-before.misses,evictions:cache.evictions-before.evictions,hashes};result.passes.push(measured);
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...measured,hashes:undefined}));
 }
 assert.deepEqual(result.passes[1].hashes,result.passes[0].hashes,'warm colour must retain every pixel');
}finally{db.close();}

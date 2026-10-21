// Same pixels and actual worker priority, before/after colour-kernel changes.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),baseline=process.env.TERRAIN_BASELINE_SOURCE;if(!baseline)throw Error('Set TERRAIN_BASELINE_SOURCE to the retained source.');
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-colour-cost');mkdirSync(out,{recursive:true});
const require=createRequire(root+'/package.json'),modules={};
for(const [name,source]of [['baseline',baseline],['current',root]]){
 for(const [suffix,file]of [['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts']])buildSync({entryPoints:[path.join(source,file)],outfile:out+'/'+name+'-'+suffix+'.cjs',nodePaths:[root+'/node_modules'],bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
 modules[name]=require(out+'/'+name+'-service.cjs');
}
buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/terrain-navigation-plan';export * from './src/app/terrain-detail-tiles';"},outfile:out+'/fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,terrainNavigationPlan,terrainDetailTiles}=require(out+'/fixture.cjs'),base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const profile=mkdtempSync(base+'/colour-cost-');
const store=new CampaignStore(profile+'/world.sqlite'),campaign=store.create('Colour cost'),token=store.activate(campaign.id).token;
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>80*Math.sin((x*1024+i%64*16)/150)+30*Math.cos((y*1024+Math.floor(i/64)*16)/75)))}});
const source=store.atlasRegionSource(token),frame={x:-450,y:-300,width:900,height:600},stages=terrainNavigationPlan({frame,pixelWidth:1000,pixelHeight:667},source.revision,{tilt:45,rotation:25,exaggeration:1},[]),plan=terrainDetailTiles(stages[1].detail),runs=[];let expected;
try{
 for(const name of ['baseline','current','current','baseline']){
  const service=new modules[name].AtlasRegionService(out+'/'+name+'-worker.cjs');
  try{
   await service.terrain(source,stages[0]); // Warm IPC/index/geometry equally, before cold colour.
   const slices=[],select=[],tiles=[],hash=createHash('sha256'),original=service.run.bind(service);
   service.run=async(s,job)=>{const start=performance.now();try{return await original(s,job);}finally{if(job.kind==='terrain-color')slices.push(performance.now()-start);}};
   const start=performance.now();
   for(const tile of plan.tiles){
    const s=store.atlasRegionSource(token,service.cursor),q={box:tile.box,routeContext:stages[1].view.box,width:256,height:256,displayMpp:plan.mpp,contours:0,revision:s.revision,fence:s.fence};let complete=false;
    const pending=service.terrainColor(s,q).then(v=>{complete=true;return v;});
    void pending.catch(()=>{complete=true;}); // Stop probing on failure; await below propagates it.
    // Probe throughout the tile, not only its first height band. Vary the gap
    // so shading and later bands are not consistently missed by the sampler.
    while(!complete){
     await new Promise(r=>setTimeout(r,[13,19,29][select.length%3]));if(complete)break;const selectionStart=performance.now();
     const hits=await service.candidates(store.atlasRegionSource(token,service.cursor),{box:frame,width:64,height:64,scopeId:null,floorId:'ground',slice:null,roofs:true},{x:0,y:0});assert.equal(hits.total,0);
     select.push({ms:performance.now()-selectionStart,atMs:selectionStart-start,beforeTile:!complete});
    }
    const value=await pending;hash.update(value.pixels);tiles.push(performance.now()-start);
   }
   const digest=hash.digest('hex');if(expected)assert.equal(digest,expected,'Changed colour pixels');else expected=digest;
   const sorted=slices.slice().sort((a,b)=>a-b),row={name,tiles:plan.tiles.length,firstTileMs:tiles[0],completeMs:tiles.at(-1),selection:select,maxSliceMs:sorted.at(-1),p95SliceMs:sorted[Math.ceil(sorted.length*.95)-1],slices:slices.length,workerStarts:service.diagnostics.workerStarts,digest};runs.push(row);console.log(JSON.stringify(row));
  }finally{await service.close();}
 }
}finally{store.close();writeFileSync(out+'/result.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),baseline,profile,runs},null,2));}

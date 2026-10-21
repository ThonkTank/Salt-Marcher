// Compare actual readonly worker scheduling against a retained source snapshot.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),baseline=process.env.TERRAIN_BASELINE_SOURCE;if(!baseline)throw Error('Set TERRAIN_BASELINE_SOURCE.');
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-scheduling-measure');mkdirSync(out,{recursive:true});
const require=createRequire(root+'/package.json'),modules={};
for(const [name,source]of [['baseline',baseline],['sliced',root]]){
 for(const [suffix,file]of [['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts']])buildSync({entryPoints:[path.join(source,file)],outfile:out+'/'+name+'-'+suffix+'.cjs',nodePaths:[root+'/node_modules'],bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
 modules[name]=require(out+'/'+name+'-service.cjs');
}
buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/terrain-navigation-plan';"},outfile:out+'/fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,terrainNavigationPlan}=require(out+'/fixture.cjs'),base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const profile=mkdtempSync(base+'/schedule-measure-');
const store=new CampaignStore(profile+'/world.sqlite'),campaign=store.create('Scheduling'),token=store.activate(campaign.id).token;
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>{const px=x*1024+i%64*16,py=y*1024+Math.floor(i/64)*16;return 20+90*Math.exp(-(px*px+py*py)/40000);} ))}});
const source=store.atlasRegionSource(token),frame={x:-450,y:-300,width:900,height:600},stages=terrainNavigationPlan({frame,pixelWidth:1000,pixelHeight:667},source.revision,{tilt:45,rotation:25,exaggeration:1},[]),runs=[];let canonical;
try{
 for(const name of ['baseline','sliced','sliced','baseline']){
  const service=new modules[name].AtlasRegionService(out+'/'+name+'-worker.cjs');
  try{
   await service.terrain(source,stages[0]); // Same warm worker/index and geometry before the cold fine colour.
   const slices=[],original=service.run.bind(service);service.run=async(s,job)=>{const start=performance.now();try{return await original(s,job);}finally{if(job.kind==='terrain')slices.push(performance.now()-start);}};
   const start=performance.now();let fullMs;
   const full=service.terrain(store.atlasRegionSource(token,service.cursor),stages[1]).then(value=>{fullMs=performance.now()-start;return value;});
   await new Promise(r=>setTimeout(r,20));const selectionStart=performance.now();
   const hits=await service.candidates(store.atlasRegionSource(token,service.cursor),{box:frame,width:64,height:64,scopeId:null,floorId:'ground',slice:null,roofs:true},{x:0,y:0});
   const selectionMs=performance.now()-selectionStart,selectionBeforeFull=fullMs===undefined;assert.equal(hits.total,0);
   const value=await full;if(canonical)assert.deepEqual(value,canonical);else canonical=value;
   const sorted=slices.slice().sort((a,b)=>a-b),row={name,selectionMs,selectionBeforeFull,fullMs,slices:slices.length,maxSliceMs:sorted.at(-1),p95SliceMs:sorted[Math.ceil(sorted.length*.95)-1],workerStarts:service.diagnostics.workerStarts};runs.push(row);console.log(JSON.stringify(row));
  }finally{await service.close();}
 }
}finally{store.close();writeFileSync(out+'/result.json',JSON.stringify({source:process.env.TERRAIN_SOURCE_COMMIT??'working tree',baseline,profile,runs},null,2));}

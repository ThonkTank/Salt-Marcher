// Backend-only paired measurement: first usable geometry vs complete colour.
// No input, IPC, GPU or display latency is inferred from these timings.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-progressive-measure');mkdirSync(out,{recursive:true});
const exports=['storage/store','storage/atlas-landscape-region','terrain-height','terrain-navigation-plan'].map(file=>`export * from './src/app/${file}';`).join('\n');
buildSync({stdin:{contents:exports,resolveDir:root},outfile:out+'/model.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(root+'/package.json'),{CampaignStore,heightRecord,AtlasLandscapeReader,terrainNavigationPlan}=require(out+'/model.cjs');
const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const profile=mkdtempSync(base+'/progressive-measure-');
const store=new CampaignStore(profile+'/world.sqlite'),campaign=store.create('Progressive measurement'),token=store.activate(campaign.id).token;
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>{const px=x*1024+i%64*16,py=y*1024+Math.floor(i/64)*16;return 20+90*Math.exp(-(px*px+py*py)/40000);} ))}});
const source=store.atlasRegionSource(token),stages=terrainNavigationPlan({frame:{x:-450,y:-300,width:900,height:600},pixelWidth:1000,pixelHeight:667},source.revision,{tilt:45,rotation:25,exaggeration:1},[]),runs=[];
let canonical;
try{
 for(const mode of ['full','staged','staged','full']){
  const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db);reader.sync(source);
  try{
   const start=performance.now(),overview=mode==='staged'?reader.terrain(source,stages[0]):null,firstMs=performance.now()-start;
   const detail=reader.terrain(source,stages[1]),fullMs=performance.now()-start;
   if(overview)assert.deepEqual(overview.grid,detail.grid);
   if(canonical)assert.deepEqual(detail,canonical);else canonical=detail;
   const row={mode,firstUsableMs:overview?firstMs:fullMs,fullMs,geometryEqual:true,overviewTextureBytes:overview?.pixels.byteLength??0,cacheBytes:reader.projectionCache.tiles.bytes};runs.push(row);console.log(JSON.stringify(row));
  }finally{db.close();}
 }
}finally{store.close();writeFileSync(out+'/result.json',JSON.stringify({source:process.env.TERRAIN_SOURCE_COMMIT??'working tree',profile,runs},null,2));}

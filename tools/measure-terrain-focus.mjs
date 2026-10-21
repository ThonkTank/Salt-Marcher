// Paired readonly projection cost for the old uniform and focused main-camera layouts.
// This measures backend wall time and sampled geometry error, not UI frame rate.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const root=process.cwd(),baseline=process.env.TERRAIN_BASELINE_SOURCE;
if(!baseline)throw Error('Set TERRAIN_BASELINE_SOURCE to the retained baseline source directory.');
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-focus-measure');mkdirSync(out,{recursive:true});
const require=createRequire(root+'/package.json'),base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/focus-measure-');
const modules={};for(const [name,source]of [['baseline',baseline],['focused',root]]){
 const exports=['storage/store','storage/atlas-landscape-region','terrain-height','terrain-spatial-model','terrain-timing'].map(file=>`export * from ${JSON.stringify(path.join(source,'src/app',file))};`).join('\n');
 const file=out+'/'+name+'.cjs';buildSync({stdin:{contents:exports,resolveDir:root},outfile:file,nodePaths:[root+'/node_modules'],bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});modules[name]=require(file);
}
const {CampaignStore,heightRecord}=modules.focused,store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Focus measurement'),token=store.activate(campaign.id).token;
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>{const px=x*1024+i%64*16,py=y*1024+Math.floor(i/64)*16;return 20+90*Math.exp(-(px*px+py*py)/40000);}))}});
const source=store.atlasRegionSource(token),frame={x:-450,y:-300,width:900,height:600},box={x:-1350,y:-900,width:2700,height:1800},refinement={x:-675,y:-450,width:1350,height:900};
const records=store.atlasMaskRegion(token,box).records,sampler=new modules.focused.TerrainSampler(records),results={profile:dir,baseline,source:process.env.TERRAIN_SOURCE_COMMIT??'working tree',runs:[]};
try{
 for(const name of ['baseline','focused','focused','baseline']){
  const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new modules[name].AtlasLandscapeReader(db);reader.sync(source);
  const focused=name==='focused',view={box,frame,columns:focused?257:193,rows:focused?257:193,focusM:0,tilt:45,rotation:25,exaggeration:1,projection:'perspective',...(focused?{refinement}:{})};
  const width=focused?512:1024,query={view,width,height:Math.round(width*2/3),revision:source.revision,contours:0,displayMpp:frame.width/1000,...(focused?{detail:refinement,detailResolution:1024}:{})};
  const times=[],stages={};let reply;modules[name].takeTerrainTrace();for(let i=0;i<4;i++){const start=performance.now();reply=reader.terrain(source,query);times.push(performance.now()-start);const trace=modules[name].takeTerrainTrace();if(i===0)for(const event of trace?.events??[])stages[event.stage]=(stages[event.stage]??0)+event.duration;}
  let squared=0,maximum=0,count=0;for(let y=-240;y<=240;y+=7)for(let x=-400;x<=400;x+=7){const p={x,y},error=Math.abs(modules[name].gridHeight(reply.grid,p)-sampler.sample(p).heightM);squared+=error*error;maximum=Math.max(maximum,error);count++;}
  const row={name,stages,coldMs:times[0],warmMs:times.slice(1),gridNodes:reply.grid.heights.length,textureBytes:reply.pixels.byteLength+(reply.detail?.pixels.byteLength??0),rootMeanSquareHeightErrorM:Math.sqrt(squared/count),maximumHeightErrorM:maximum,cacheBytes:reader.projectionCache.tiles.bytes};results.runs.push(row);console.log(JSON.stringify(row));db.close();
 }
}finally{store.close();writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}

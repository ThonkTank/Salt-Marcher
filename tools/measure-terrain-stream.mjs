// Read-only raster comparison in bounded child processes; synthetic databases live on disk.
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),root=process.cwd();
if(process.argv[2]==='--child'){
 const bundle=process.argv[3],fixture=JSON.parse(readFileSync(process.argv[4],'utf8')),{AtlasLandscapeReader}=require(bundle),Database=require('better-sqlite3'),db=new Database(fixture.source.filename,{readonly:true});db.pragma('cache_size = -8192');db.pragma('temp_store = FILE');
 const reader=new AtlasLandscapeReader(db),start=performance.now();reader.sync(fixture.source);const layer=reader.read(fixture.source,fixture.query,2*1024*1024);if(layer.state!=='ready')throw Error(layer.error);
 const milliseconds=performance.now()-start,hash=createHash('sha256').update(JSON.stringify(layer.tiles.map(t=>[t.box,t.data]))).digest('hex'),replyBytes=Buffer.byteLength(JSON.stringify(layer));
 global.gc();console.log(JSON.stringify({milliseconds,peakRssMiB:process.resourceUsage().maxRSS/1024,retainedHeapMiB:process.memoryUsage().heapUsed/2**20,replyBytes,hash,tiles:layer.tiles.length}));db.close();
}else{
 const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-stream-measurement');mkdirSync(out,{recursive:true});
 const base=homedir()+'/.cache/saltmarcher/benchmarks';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/terrain-stream-');
 const sources={current:root,...(process.env.TERRAIN_BASELINE?{baseline:path.resolve(process.env.TERRAIN_BASELINE)}:{})},bundles={};
 for(const [name,source]of Object.entries(sources)){
  const bundle=out+'/'+name+'.cjs';require('esbuild').buildSync({stdin:{contents:`export * from '${source}/src/app/storage/store';export * from '${source}/src/app/storage/atlas-landscape-region';export * from '${source}/src/app/terrain-height';`,resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});bundles[name]=bundle;
 }
 const {CampaignStore,heightRecord}=require(bundles.current),report={profile:dir,runs:[],sourceHashes:{}};
 for(const file of ['src/app/terrain-field-stream.ts','src/app/terrain-route.ts','src/app/terrain-height.ts','src/app/landscape-raster.ts','src/app/storage/atlas-landscape-region.ts','tools/measure-terrain-stream.mjs'])report.sourceHashes[file]=createHash('sha256').update(readFileSync(file)).digest('hex');
 try{
  for(const side of [2,64]){
   const filename=dir+'/'+side+'.sqlite',store=new CampaignStore(filename),campaign=store.create('Synthetic '+side),token=store.activate(campaign.id).token,pixel=512,edge=side*64*pixel;
   const templates=Array.from({length:7},(_,i)=>heightRecord(0,0,pixel,new Float32Array(4096).fill(100+i*5))),put=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
   store.db.transaction(()=>{for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const px=x*64*pixel,py=y*64*pixel,template=templates[x%7],record={...template,id:`height:9:${x}:${y}`,height:{...template.height,x:px,y:py},polygons:[{outer:[{x:px-pixel,y:py-pixel},{x:px+64*pixel,y:py-pixel},{x:px+64*pixel,y:py+64*pixel},{x:px-pixel,y:py+64*pixel}],holes:[]}]};
    put.run(campaign.id,record.id,1,px-pixel,px+64*pixel,py-pixel,py+64*pixel,JSON.stringify(record));
   }})();
   const source=store.atlasRegionSource(token),authorBytes=store.db.prepare('SELECT sum(length(payload)) n FROM atlas_landscape').get().n,query={box:{x:1,y:1,width:edge-2,height:edge-2},width:256,height:256,scopeId:null,floorId:'ground',slice:null,roofs:true};store.close();
   const fixture=dir+'/'+side+'.json';writeFileSync(fixture,JSON.stringify({source,query}));
   for(const [name,bundle]of Object.entries(bundles)){
    const run=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=768',path.resolve('tools/measure-terrain-stream.mjs'),'--child',bundle,fixture],{encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
    if(run.status!==0)throw Error(name+' '+side+': '+run.stderr+' '+run.error);
    const result={name,authorTiles:side*side,authorBytes,...JSON.parse(run.stdout.trim())};report.runs.push(result);console.log(JSON.stringify(result));
   }
  }
  for(const side of [4,4096]){const pair=report.runs.filter(r=>r.authorTiles===side);if(pair.length===2&&pair[0].hash!==pair[1].hash)throw Error('Raster pixels changed for '+side+' tiles.');}
  report.ok=true;
 }finally{writeFileSync(out+'/result.json',JSON.stringify(report,null,2));rmSync(dir,{recursive:true,force:true});}
}

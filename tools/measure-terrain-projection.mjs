// Isolated, deterministic projection comparison. No native/UI latency claim.
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Session} from 'node:inspector';
import path from 'node:path';
const require=createRequire(import.meta.url),root=process.cwd();
if(process.argv[2]==='--child'){
 const {CampaignStore,AtlasLandscapeReader,heightRecord}=require(process.argv[3]);
 const base=homedir()+'/.cache/saltmarcher/benchmarks';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/terrain-projection-');
 const store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Projection benchmark'),token=store.activateShell(cam.id).token;
 const world=process.env.TERRAIN_WORLD_PROBE==='1',side=world?64:2,pixel=world?512:16,edge=64*pixel;
 const put=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
 store.db.transaction(()=>{for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const px=(x-(world?0:1))*edge,py=(y-(world?0:1))*edge;
  const r=heightRecord(px,py,pixel,Float32Array.from({length:4096},(_,i)=>100+5*(x%7)+20*Math.sin(i/64)));
  put.run(cam.id,r.id,1,px-pixel,px+edge,py-pixel,py+edge,JSON.stringify(r));
 }})();
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db);
 const frame=world?{x:0,y:2**19,width:2**21,height:2**20}:{x:-400,y:-300,width:800,height:600};
 const box={x:frame.x-frame.width,y:frame.y-frame.height,width:frame.width*3,height:frame.height*3};
 const view={box,frame,columns:193,rows:193,focusM:100,tilt:45,rotation:0,exaggeration:2};
 const point={x:frame.x+frame.width/2,y:frame.y+frame.height/2},radius=world?12000:48,detailEdge=2**Math.ceil(Math.log2(radius))*8;
 const detail={x:point.x-detailEdge/2,y:point.y-detailEdge/2,width:detailEdge,height:detailEdge};
 let cursor;const runs=[],session=new Session();
 const call=method=>new Promise((resolve,reject)=>session.post(method,(e,r)=>e?reject(e):resolve(r)));
 if(process.env.TERRAIN_CPU_PROFILE){session.connect();await call('Profiler.enable');await call('Profiler.start');}
 const read=label=>{
  globalThis.__saltTerrainTrace={events:[],dropped:0};
  const start=performance.now();cursor=store.atlasRegionSource(token,cursor);reader.sync(cursor);const synced=performance.now();
  const projection=reader.terrain(cursor,{view,width:1024,height:Math.round(1024*box.height/box.width),displayMpp:frame.width/1600,contours:0,detail,revision:cursor.revision,fence:cursor.fence});
  const digest=createHash('sha256');for(const bytes of [projection.pixels,projection.detail.pixels,new Uint8Array(projection.grid.heights.buffer)])digest.update(bytes);
  runs.push({label,syncMs:synced-start,projectionMs:performance.now()-synced,hash:digest.digest('hex'),events:globalThis.__saltTerrainTrace.events.slice(),memory:process.memoryUsage(),cacheBytes:reader.projectionCache.tiles.bytes});
 };
 read('cold');read('unchanged');
 for(let i=0;i<3;i++){
  store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token,action:{kind:'landscape-height-stroke',stroke:{mode:'raise',radius,strength:120,feather:.8,samples:[{...point,t:0},{...point,t:1000}]}}});
  read('edited-'+i);
 }
 if(process.env.TERRAIN_CPU_PROFILE){const {profile}=await call('Profiler.stop');writeFileSync(process.env.TERRAIN_CPU_PROFILE,JSON.stringify(profile));session.disconnect();}
 db.close();store.close();
 console.log(JSON.stringify({world,tiles:side*side,profile:dir,runs,peakRssKiB:process.resourceUsage().maxRSS}));
}else{
 const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-projection-measurement');mkdirSync(output,{recursive:true});
 const sources={...(process.env.TERRAIN_BASELINE?{baseline:path.resolve(process.env.TERRAIN_BASELINE)}:{}),current:root},report={runs:{},sources:{}};
 for(const [name,source]of Object.entries(sources)){
  const bundle=path.join(root,'.build','terrain-projection-measure-'+name+'.cjs');
  require('esbuild').buildSync({stdin:{contents:`export * from '${source}/src/app/storage/store';export * from '${source}/src/app/storage/atlas-landscape-region';export * from '${source}/src/app/terrain-height';`,resolveDir:root},nodePaths:[root+'/node_modules'],outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
  report.sources[name]={path:source,bundleHash:createHash('sha256').update(readFileSync(bundle)).digest('hex')};
  const child=spawnSync(process.execPath,[import.meta.filename,'--child',bundle],{encoding:'utf8',timeout:180000,env:{...process.env,SALTMARCHER_TERRAIN_TRACE:'1',...(process.env.TERRAIN_CPU_PROFILE?{TERRAIN_CPU_PROFILE:output+'/'+name+'.cpuprofile'}:{})}});
  if(child.status!==0)throw Error(child.stderr||child.stdout||String(child.error));
  report.runs[name]=JSON.parse(child.stdout.trim().split('\n').at(-1));
 }
 if(report.runs.baseline)for(let i=0;i<report.runs.current.runs.length;i++)if(report.runs.baseline.runs[i].hash!==report.runs.current.runs[i].hash)throw Error('Baseline and current projections differ');
 writeFileSync(output+'/result.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(report.runs).map(([name,r])=>[name,{projectionMs:r.runs.map(r=>r.projectionMs),peakRssKiB:r.peakRssKiB}]))));
}

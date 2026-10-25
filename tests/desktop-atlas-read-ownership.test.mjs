import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url),root=path.resolve('.build/atlas-read-ownership');
mkdirSync(root,{recursive:true});
for(const [name,file] of [['store','src/app/storage/store.ts'],['service','desktop/atlas-region.ts'],['worker','desktop/atlas-region-worker.ts'],['surface','src/app/atlas-surface-tile-stream.ts']]){
 buildSync({entryPoints:[file],outfile:path.join(root,name+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
}
const {CampaignStore}=require(path.join(root,'store.cjs')),{AtlasRegionService}=require(path.join(root,'service.cjs')),
 {atlasSurfaceTileFetcher}=require(path.join(root,'surface.cjs'));
// Run the actual main registrations and preload bridge. Only Electron's shell,
// update startup and writer transport are replaced; SQLite readers/workers are real.
const main=buildSync({entryPoints:['desktop/main.ts'],bundle:true,platform:'node',format:'cjs',write:false,
 external:['electron','better-sqlite3','./store-client','./atlas-region','./update-runtime','./update-service'],define:{__APP_VERSION__:'"test"'}}).outputFiles[0].text;
const preload=buildSync({entryPoints:['desktop/preload.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['electron']}).outputFiles[0].text;
const pauseWorker=path.join(root,'paused-worker.cjs');
writeFileSync(pauseWorker,`const {workerData}=require('node:worker_threads'),fs=require('node:fs');
fs.writeFileSync(workerData.cacheDirectory+'/started','');
while(fs.existsSync(workerData.cacheDirectory+'/hold'))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);
// Only the scheduling clock is controlled: actual generators, SQLite work and bytes remain real.
if(fs.existsSync(workerData.cacheDirectory+'/slice-clock')){let clock=0;Object.defineProperty(performance,'now',{value:()=>clock+=10});}
require(${JSON.stringify(path.join(root,'worker.cjs'))});\n`);
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw Error('Timed out waiting for reader state');await new Promise(r=>setTimeout(r,5));}}
const room={id:'room',scopeId:'local',floorId:'ground',number:'1',name:'Room',revision:0,
 polygons:[{outer:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],holes:[]}],sections:[]};
const region={box:{x:-10,y:-10,width:100,height:100},width:512,height:512,scopeId:'local',floorId:'ground',slice:null,roofs:true,terrainRaster:false};
async function fixture(t,{sliced=false}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'atlas-read-owner-')),store=new CampaignStore(path.join(dir,'workbench.sqlite')),
 campaign=store.create('Reader ownership',[room]),shell=store.activateShell(campaign.id),services=[],handlers=new Map(),events=new Map(),errors=[];
 let readyResolve,readyReject,win,api,quit=false;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const session={setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){},webRequest:{onBeforeRequest(){}},protocol:{handle(){}}};
 const electron={app:{setName(){},getPath:()=>dir,setPath(){},requestSingleInstanceLock:()=>true,quit(){quit=true;},exit:code=>readyReject(Error('Startup exited '+code)),on(){},whenReady:()=>Promise.resolve()},
  BrowserWindow:class {constructor(){win=this;this.webContents={mainFrame:{url:'campaign://app/index.html'},session,setWindowOpenHandler(){},on(){},send(){}};}on(){}isDestroyed(){return false;}async loadURL(){readyResolve();}},
  dialog:{showErrorBox:(...args)=>{errors.push(args);readyReject(Error(args.join(': ')));}},
  ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>events.set(name,fn)},
  protocol:{registerSchemesAsPrivileged(){},handle(){}},session:{fromPartition:()=>session}};
 store.on=()=>{};
 class Reader extends AtlasRegionService {constructor(){const index=services.length,cache=path.join(dir,'reader-'+index);mkdirSync(cache);writeFileSync(path.join(cache,'hold'),'');if(sliced)writeFileSync(path.join(cache,'slice-clock'),'');super(pauseWorker,1024*1024,cache);this.testCache=cache;services.push(this);}}
 const mocks={'electron':electron,'./store-client':{StoreClient:class {constructor(){return store;}}},'./atlas-region':{AtlasRegionService:Reader},
  './update-runtime':{openUpdateRuntime:async()=>({root:null,transaction:null,close:async()=>{}})},'./update-service':{UpdateService:class {async init(){}}}};
 t.after(async()=>{await Promise.all(services.map(s=>s.close()));store.close();rmSync(dir,{recursive:true,force:true});assert.deepEqual(errors,[]);});
 const context={require:name=>mocks[name]??require(name),__dirname:root,process:{...process,argv:['node','main','--data-dir',dir]},
  console,Buffer,URL,Response,Error,SharedArrayBuffer,Int32Array,Atomics,setInterval:()=>0,clearInterval(){},setTimeout:()=>({unref(){}})};
 runInNewContext(main,context,{filename:'main.cjs'});await ready;
 const event=()=>({sender:win.webContents,senderFrame:win.webContents.mainFrame});
 const invoke=(name,...args)=>handlers.get(name)(event(),...args);
 runInNewContext(preload,{require:name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'campaign');api=value;}},ipcRenderer:{invoke}};}},{filename:'preload.cjs'});
 const source=store.atlasRegionSource(shell.token),tile={tile:{lod:0,x:0,y:0},revision:source.revision};
 return {store,campaign,shell,source,tile,services,api,invoke,handlers,events,event,quit:()=>quit,
  started:index=>until(()=>existsSync(path.join(services[index].testCache,'started'))),
  release:index=>rmSync(path.join(services[index].testCache,'hold'),{force:true})};
}
function ok(result){assert.equal(result.ok,true,result.error);return result.value;}
function cancelled(result){assert.equal(result.ok,false);assert.match(result.error,/abgebrochen|ersetzt/);}

for(const kind of ['height','material'])test(`export cancellation preserves active editor ${kind}, its paired material and geometry`,async t=>{
 const f=await fixture(t),control={owner:'workbench-surface',id:'editor'},exportControl={owner:'export:one',id:'output'};
 const editor=kind==='height'?f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'},control):f.api.atlasMaterialTile(f.shell.token,{...f.tile,product:'surface'},control);
 await f.started(0);
 const geometry=f.api.atlasGeometryTile(f.shell.token,f.tile);
 const output=f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'},exportControl,'export');await f.started(1);
 ok(await f.api.cancelAtlasRegion(f.shell.token,'export'));cancelled(await output);
 f.release(0);
 const product=ok(await editor);assert.equal(product.fence,f.source.fence);assert.equal(product.revision,f.source.revision);
 assert.equal(ok(await geometry).fence,f.source.fence);
 if(kind==='height')assert.equal(ok(await f.api.atlasMaterialTile(f.shell.token,{...f.tile,product:'surface'},control)).fence,f.source.fence);
 assert.equal(ok(await f.api.atlasObjectFocus(f.shell.token,'room','room')).id,'room','editor remains usable');
 assert.equal(f.services.length,2);assert.equal(f.services[0].diagnostics.workerStarts,1,'export cancel did not restart editor');
});

test('a queued editor surface pair survives a camera request and geometry tile on the same reader',async t=>{
 const f=await fixture(t),focus=f.api.atlasObjectFocus(f.shell.token,'room','room');await f.started(0);
 const fetch=atlasSurfaceTileFetcher(f.api,f.shell.token,'workbench-surface');
 const surface=fetch(f.tile,new AbortController().signal);
 const geometry=f.api.atlasGeometryTile(f.shell.token,f.tile);
 const camera=f.api.atlasRegion(f.shell.token,region);
 await tick();assert(f.services[0].queued.size<=7,'queue is bounded by fixed lanes');f.release(0);
 ok(await focus);ok(await camera);ok(await geometry);
 const pair=await surface;assert.equal(pair.terrain.fence,f.source.fence);assert.equal(pair.material.fence,f.source.fence);
});

test('request cancellation stays in its consumer even with identical owner and request IDs',async t=>{
 const f=await fixture(t),control={owner:'same-owner',id:'same-request'};
 const editor=f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'},control),output=f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'},control,'export');
 await Promise.all([f.started(0),f.started(1)]);
 ok(await f.api.atlasCancelRead(f.shell.token,control,'export'));f.release(0);f.release(1);
 cancelled(await output);assert.equal(ok(await editor).fence,f.source.fence);
});

test('same-lane successors replace older tiles; explicit cancellation and real read errors are not retried',async t=>{
 const f=await fixture(t),focus=f.api.atlasObjectFocus(f.shell.token,'room','room');await f.started(0);
 const old=f.api.atlasTerrainTile(f.shell.token,f.tile,{owner:'workbench-surface',id:'old'}),next=f.api.atlasTerrainTile(f.shell.token,f.tile,{owner:'workbench-surface',id:'next'});
 await tick();cancelled(await old);ok(await f.api.atlasCancelRead(f.shell.token,{owner:'workbench-surface',id:'next'}));cancelled(await next);
 assert.equal(f.services[0].queued.size,0);f.release(0);ok(await focus);
 // Host accepts the shape, real worker rejects a revision made stale after the
 // source is captured. A failure must reach the caller, never restart forever.
 const source=f.store.atlasRegionSource(f.shell.token);f.store.db.prepare('UPDATE campaign_atlas SET revision=revision+1 WHERE campaign_id=?').run(f.campaign.id);
 await assert.rejects(f.services[0].terrainTile(source,f.tile,{owner:'workbench-surface',id:'bad-source'}),/inzwischen geändert/);
 assert.equal(f.services[0].diagnostics.active,false);assert.equal(f.services[0].queued.size,0);
});

test('global source barrier still cancels both readers and blocks new reads until the write ends',async t=>{
 const f=await fixture(t),editor=f.api.atlasTerrainTile(f.shell.token,f.tile),output=f.api.atlasTerrainTile(f.shell.token,f.tile,undefined,'export');
 await Promise.all([f.started(0),f.started(1)]);
 let release;const write=new Promise(r=>release=r);let entered=false;
 f.store.executeAtlasCommit=async()=>{entered=true;return write;};
 const barrier=f.invoke('atlas:commit',{commandId:'barrier',action:{kind:'graph-accept'}});
 await until(()=>entered);cancelled(await editor);cancelled(await output);
 const blocked=await f.api.atlasTerrainTile(f.shell.token,f.tile);assert.equal(blocked.ok,false);assert.match(blocked.error,/Graphwechsel/);
 release({});ok(await barrier);f.release(0);f.release(1);
 assert.equal(ok(await f.api.atlasTerrainTile(f.shell.token,f.tile)).fence,f.source.fence);
});

test('global reader close rejects both active and queued work without replacement workers',async t=>{
 const f=await fixture(t),editor=f.api.atlasTerrainTile(f.shell.token,f.tile),output=f.api.atlasTerrainTile(f.shell.token,f.tile,undefined,'export');
 await Promise.all([f.started(0),f.started(1)]);
 const queued=f.api.atlasGeometryTile(f.shell.token,f.tile);await tick();
 await Promise.all(f.services.map(s=>s.close()));cancelled(await editor);cancelled(await output);cancelled(await queued);
 assert.deepEqual(f.services.map(s=>s.diagnostics.workerStarts),[1,1]);
 cancelled(await f.api.atlasTerrainTile(f.shell.token,f.tile));
});

test('invalid consumers fail before work and the main IPC sender guard remains enforced',async t=>{
 const f=await fixture(t);
 for(const [method,args] of [['atlasTerrainTile',[f.shell.token,f.tile,undefined,'other']],['atlasMaterialTile',[f.shell.token,{...f.tile,product:'surface'},undefined,'other']],['atlasCancelRead',[f.shell.token,{owner:'owner',id:'read'},'other']]]){
  const result=await f.api[method](...args);assert.equal(result.ok,false);assert.match(result.error,/Kartenleser prüfen/);
 }
 const forbidden=await f.handlers.get('atlas:terrain-tile')({sender:{},senderFrame:{}},f.shell.token,f.tile);assert.equal(forbidden.ok,false);assert.match(forbidden.error,/Zugriff verweigert/);
 assert.deepEqual(f.services.map(s=>s.diagnostics.workerStarts),[0,0]);
});

for(const kind of ['terrain','material'])test(`real multi-step ${kind} tile restarts after foreign geometry and preserves bytes/source`,async t=>{
 const f=await fixture(t,{sliced:true}),service=f.services[0],run=service.run.bind(service),jobs=[];let interposed=false,camera,geometry;
 const query={...f.tile,product:kind==='terrain'?'height':'surface'};
 service.run=async(source,job)=>{
  jobs.push({kind:job.kind,continuation:job.continuation===true,source:structuredClone(source),query:structuredClone(job.query)});
  const value=await run(source,job);
  if(job.kind===kind+'-tile'&&value.terrainProjectionContinuation&&!interposed){
   interposed=true;camera=f.api.atlasRegion(f.shell.token,region);geometry=f.api.atlasGeometryTile(f.shell.token,f.tile);await tick();
  }
  return value;
 };
 const method=kind==='terrain'?'atlasTerrainTile':'atlasMaterialTile';
 const reading=f.api[method](f.shell.token,query,{owner:'workbench-surface',id:'continued'});f.release(0);
 const actual=ok(await reading);assert(interposed,'real generator must yield before its completed product');ok(await camera);ok(await geometry);
 const own=jobs.filter(j=>j.kind===kind+'-tile');assert(own.filter(j=>!j.continuation).length>=2,'replaced worker generator restarts');
 assert(own.some(j=>j.continuation),'multi-step product reaches a continuation');assert(own.length<4096,'finite interference makes progress');
 for(const j of own){assert.equal(j.source.token,f.shell.token);assert.equal(j.source.fence,f.source.fence);assert.equal(j.source.revision,f.source.revision);assert.deepEqual(j.query,query);}
 f.release(1);const expected=ok(await f.api[method](f.shell.token,query,{owner:'export:baseline',id:'baseline'},'export'));
 assert.equal(actual.fence,expected.fence);assert.equal(actual.revision,expected.revision);
 assert.deepEqual(kind==='terrain'?actual.projection:actual.channels,kind==='terrain'?expected.projection:expected.channels,'interrupted product equals uninterrupted worker product');
 assert.deepEqual(f.services.map(s=>s.diagnostics.workerStarts),[1,1]);
});

for(const stop of ['cancel','close','request','supersede','source','error'])test(`a yielded tile is not resurrected after ${stop}`,async t=>{
 const f=await fixture(t,{sliced:true}),service=f.services[0],run=service.run.bind(service),control={owner:'workbench-surface',id:'old'};let stopped=false,callsAfter=0,next;
 service.run=async(source,job)=>{
  if(stopped&&job.query?.tile.x===0)callsAfter++;
  const value=await run(source,job);
  if(job.kind==='terrain-tile'&&value.terrainProjectionContinuation&&!stopped){
   stopped=true;
   if(stop==='cancel')service.cancel();
   else if(stop==='close')await service.close();
   else if(stop==='request')service.cancelRead(control,f.shell.token);
   else if(stop==='supersede'){next=f.api.atlasTerrainTile(f.shell.token,{...f.tile,tile:{lod:0,x:1,y:0},product:'height'},{owner:'workbench-surface',id:'new'});await tick();}
   else if(stop==='source')f.store.db.prepare('UPDATE campaign_atlas SET revision=revision+1 WHERE campaign_id=?').run(f.campaign.id);
   else throw Error('Injected worker failure after a real continuation');
  }
  return value;
 };
 const reading=f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'},control);f.release(0);
 const result=await reading;assert(stopped,'real generator must yield');assert.equal(result.ok,false);
 assert.match(result.error,stop==='source'?/inzwischen geändert/:stop==='error'?/Injected worker failure/:/abgebrochen|ersetzt/);
 if(next)ok(await next);await tick();assert.equal(service.queued.size,0);assert.equal(callsAfter,stop==='source'?1:0,'no retry after a definitive failure or cancellation');
 assert.equal(service.diagnostics.workerStarts,1);
});


test('a cancelled reader waits for physical worker exit before its next request starts',async t=>{
 const f=await fixture(t),service=f.services[0],first=f.api.atlasTerrainTile(f.shell.token,f.tile);await f.started(0);
 const old=service.worker;ok(await f.api.cancelAtlasRegion(f.shell.token));
 const next=f.api.atlasTerrainTile(f.shell.token,{...f.tile,product:'height'});await until(()=>service.worker&&service.worker!==old);
 assert.equal(old.threadId,-1,'replacement only exists after old physical worker exited');f.release(0);
 cancelled(await first);ok(await next);assert.equal(service.diagnostics.workerStarts,2);assert.equal(service.queued.size,0);
});


test('the controlled editor object projection survives surface tiles and camera without losing its geometry',async t=>{
 const f=await fixture(t,{sliced:true}),service=f.services[0],run=service.run.bind(service);let interposed=false,surface,camera,restarts=0;
 const box={x:0,y:0,width:100,height:100},object={kind:'building',id:'house',name:'House',anchor:{x:10,y:10},outline:room.polygons[0].outer,
  binding:{mode:'fixed',offsetM:17},wallM:3,roofM:2,floorElevations:[0,3],color:'#996633'},
  query={product:'height',view:{box,frame:box,columns:2,rows:2,focusM:0,tilt:0,rotation:0,exaggeration:1},objects:[object],
   width:16,height:16,revision:f.source.revision,fence:f.source.fence,contours:0,displayMpp:1};
 service.run=async(source,job)=>{
  if(job.kind==='terrain'&&!job.continuation)restarts++;
  const value=await run(source,job);
  if(job.kind==='terrain'&&value.terrainProjectionContinuation&&!interposed){
   interposed=true;surface=atlasSurfaceTileFetcher(f.api,f.shell.token,'workbench-surface')(f.tile,new AbortController().signal);
   camera=f.api.atlasRegion(f.shell.token,region);await tick();
  }
  return value;
 };
 const reading=f.api.atlasTerrainProjection(f.shell.token,query,'view',{owner:'workbench-objects',id:'objects'});f.release(0);
 const actual=ok(await reading);assert(interposed);assert(restarts>=2&&restarts<10);await surface;ok(await camera);
 assert.equal(actual.objects[0].baseM,17);assert.equal(actual.objects[0].topM,23);assert.equal(actual.fence,f.source.fence);
 f.release(1);const expected=ok(await f.api.atlasTerrainProjection(f.shell.token,query,'export'));
 assert.deepEqual(actual.objects,expected.objects);assert.equal(service.queued.size,0);
});

const projectionQuery=f=>({product:'height',revision:f.source.revision,fence:f.source.fence,
 view:{box:region.box,frame:region.box,columns:2,rows:2,focusM:0,tilt:0,rotation:0,exaggeration:1},
 width:16,height:16,displayMpp:1,contours:0});
const sourceBarrierCases=[
 ['projection-view','atlas:terrain-projection','terrain',f=>[projectionQuery(f),'view']],
 ['projection-export','atlas:terrain-projection','terrain',f=>[projectionQuery(f),'export']],
 ['source-bootstrap','atlas:terrain-source',null,()=>[]],
 ['terrain-tile','atlas:terrain-tile','terrainTile',f=>[{...f.tile,product:'height'}]],
 ['material-tile','atlas:material-tile','materialTile',f=>[{...f.tile,product:'surface'}]],
 ['geometry-tile','atlas:geometry-tile','geometryTile',f=>[f.tile]],
 ['region','atlas:geometry-region','read',()=>[region]],
 ['focus','atlas:focus','focus',()=>['room','room']],
 ['hit','atlas:region-hit','hit',f=>[region,{x:1,y:1},f.source.fence]],
 ['candidates','atlas:region-candidates','candidates',f=>[region,{x:1,y:1},f.source.fence]],
 ['color','atlas:terrain-color','terrainColor',f=>[{box:region.box,routeContext:region.box,width:16,height:16,displayMpp:1,contours:0,revision:f.source.revision}]],
 ['frame','atlas:terrain-frame','liveTerrain',f=>[{frame:{kind:'top',query:region},source:{revision:f.source.revision,fence:f.source.fence}}]],
];
for(const [label,channel,method,args] of sourceBarrierCases)test(`source-await graph barrier prevents ${label} from starting and permits its later normal read`,async t=>{
 const f=await fixture(t),readSource=f.store.atlasRegionSource.bind(f.store);let releaseSource,sourceCaptured=false,calls=0;
 const heldSource=new Promise(resolve=>releaseSource=resolve);
 f.store.atlasRegionSource=(...params)=>{const source=readSource(...params);if(sourceCaptured)return source;sourceCaptured=true;return heldSource.then(()=>source);};
 if(method)for(const service of f.services){const run=service[method].bind(service);service[method]=(...params)=>{calls++;return run(...params);};}
 const read=f.invoke(channel,f.shell.token,...args(f));await until(()=>sourceCaptured);
 let releaseGraph,graphEntered=false;const heldGraph=new Promise(resolve=>releaseGraph=resolve);
 f.store.executeAtlasCommit=async()=>{graphEntered=true;return heldGraph;};
 const graph=f.invoke('atlas:commit',{commandId:'held-graph-'+label,action:{kind:'graph-accept'}});await until(()=>graphEntered);
 f.release(0);f.release(1);releaseSource();
 const blocked=await read,blockedCalls=calls,starts=f.services.map(s=>s.diagnostics.workerStarts);
 releaseGraph({});ok(await graph);
 assert.equal(blocked.ok,false,'a source captured before the barrier must not escape it');assert.match(blocked.error,/Graphwechsel läuft/);
 assert.equal(blockedCalls,0,'reader method is never entered while the graph owns its source');assert.deepEqual(starts,[0,0]);
 const normal=ok(await f.invoke(channel,f.shell.token,...args(f)));assert(normal,'same valid read works once the barrier ends');
 if(method)assert.equal(calls,1,'normal request enters its real reader once');
});

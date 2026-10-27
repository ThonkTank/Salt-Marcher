import {attachAtlasAuthorRecovery,atlasAuthorReferenceFixture} from './helpers/atlas-author-recovery.mjs';
import {atlasFixture,landscapeFixture} from './helpers/atlas-workbench.mjs';
import {test} from 'node:test';
import {CustomEvent as PreparedDOMEvent,Event as PreparedEvent} from 'linkedom';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
buildSync({stdin:{contents:"export * from './src/app/campaign-atlas-ui';export {recoverAtlasCommit,pendingAtlasWrite} from './src/app/campaign-atlas-author';export * from './src/app/atlas-landscape-ui';export * from './src/app/atlas-raster-presentation';export * from './src/app/landscape-brush-session';export * from './src/app/atlas-terrain-model-worker';export * from './src/app/atlas-terrain-prepared-session';export * from './src/app/terrain-author-checkpoint';export * from './src/app/terrain-brush';export * from './src/app/storage/terrain-author-window';export * from './src/app/storage/store';export * from './src/app/atlas-write-recovery';export * from './src/app/atlas-deck-surface';export * from './src/app/terrain-relief';",resolveDir:process.cwd()},outfile:'.build/terrain-commit-display-test.cjs',bundle:true,platform:'node',format:'cjs',external:['obsidian','better-sqlite3']});
const {CampaignAtlasWorkbench,LandscapeWorkbench}=createRequire(import.meta.url)('../.build/terrain-commit-display-test.cjs');
test('released direct strokes retain their author fence while releasing camera input',()=>{
 const ui=Object.assign(landscapeFixture(LandscapeWorkbench),{
  live:{},pointer:7,saving:false,tool:'height',points:[{x:0,y:0}],dirty:false,calibration:null,
 });
 assert.equal(ui.blocksNavigation(),true);assert.equal(ui.hasDraft(),true);
 ui.pointer=null;ui.saving=true;
 assert.equal(ui.blocksNavigation(),false);assert.equal(ui.hasDraft(),true);
 ui.live=null;
 assert.equal(ui.blocksNavigation(),true,'ordinary unfinished author drafts stay protected');
 ui.saving=false;ui.points=[];assert.equal(ui.blocksNavigation(),false);
 ui.routeOpening=true;assert.equal(ui.blocksNavigation(),true);assert.equal(ui.blocksNavigation(false),false);
});
test('hand mode during released direct writes preserves the author owner and bypasses draft flush',async()=>{
 let flushed=0,synced=0;
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{
  root:{dataset:{family:'terrain'}},landscape:{livePainting:true,blocksNavigation:()=>false,setActive(active){assert.equal(active,false);}},camera:{redrawOverlay(){}},
  flush:async()=>{flushed++;return false;},layout:{sync(){synced++;}},
 });
 await ui.setNavigationMode(true);assert.equal(ui.root.dataset.panMode,'true');assert.equal(ui.root.dataset.family,'terrain');
 assert.equal(flushed,0);assert.equal(synced,1);
 ui.landscape.blocksNavigation=()=>true;await ui.setNavigationMode(true);assert.equal(flushed,1);
});
test('external refresh requests cannot read the full Atlas in the middle of a direct gesture',async()=>{
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{landscape:{livePainting:true},terrainPresentation:{}});
 assert.equal(await ui.refresh(),false);
 assert.equal(await ui.refresh(true),false);
});
test('save-state rendering retains the GPU brush scene until the gesture finishes',()=>{
 const seen=[],sceneReached=Error('ordinary scene path');
 const ui=Object.assign(Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:{revision:10}}),{
  root:{hidden:false},owner:{token:'t'},landscape:{livePainting:true},terrainPresentation:{},spatial:{active:true},
  syncBrushSizes(){assert.fail('save-state updates must defer radius measurement to the shared frame');},renderPanel(){seen.push('panel');},renderTravel(){seen.push('travel');},
  layout:{sync(){seen.push('layout');}},territories:{sync(){seen.push('territories');}},
  camera:{redrawOverlay(){seen.push('overlay');},get view(){throw sceneReached;}},
 });
 ui.render();assert.deepEqual(seen,['overlay']);
ui.landscape.livePainting=false;assert.throws(()=>ui.render(),e=>e===sceneReached,'ordinary edits must rebuild');
});
test('commits advance author identity without relabelling the Atlas or awaiting display; finish refreshes once',async t=>{
 const old={document:global.document,window:global.window,CustomEvent:global.CustomEvent},status={dataset:{}},shown=[];
 global.CustomEvent=class extends Event {constructor(name,options){super(name);this.detail=options.detail;}};
 global.document={getElementById:()=>status,dispatchEvent(){}};
 let writes=0,refreshes=0,finishes=0;
 global.window={campaign:{executeAtlasCommit:async c=>({ok:true,value:{commandId:c.commandId,campaignId:'c',revision:++writes+10,sourceFence:'f'+writes,canUndo:true,canRedo:false}})}};
 t.after(()=>Object.assign(global,old));
 const references=atlasAuthorReferenceFixture(t);references.bind(global.window.campaign);
 const atlas={revision:10,workspace:references.workspace,region:{revision:10,fence:'original'}},owner=references.workspace;
 const ui=Object.assign(Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:atlas}),{
   owner,projection:atlas,svg:{dataset:{}},busy:false,opts:{status(){}},playback:{stop(){}},render(){},
   terrainPresentation:{update:s=>shown.push(s),async finish(){finishes++;},stop(){}},spatial:{gesture(){},pauseReads(){}},
   async refresh(){refreshes++;},error:e=>{throw e;},
 });
 const action={kind:'landscape-height-stroke',stroke:{}};
 const first=await ui.write(action,false,true,{id:'g',expectedRevision:10,sourceFence:'original'});
 assert.equal(first.ack.revision,11);assert.equal(ui.data,atlas);assert.equal(ui.data.region.revision,10);assert.equal(refreshes,0);
 const second=await ui.write(action,false,true,{id:'g',expectedRevision:11,sourceFence:'f1'});
 assert.equal(second.ack.revision,12);assert.deepEqual(ui.regions.authorSource,{revision:12,fence:'f2'});
 assert.equal(ui.data.revision,10);assert.equal(ui.busy,false);
 ui.spatial.active=true;ui.spatial.reconcile=(revision,fence)=>shown.push({revision,fence});ui.strokeOwner=owner.token;ui.strokeQueue={pending:false,failed:false,confirmedSource:{expectedRevision:12,sourceFence:'f2'}};
 await ui.terrainGesture(false);assert.deepEqual(shown,[{revision:12,fence:'f2'}]);assert.equal(refreshes,1);
});

test('a failed final display refresh releases the brush lock and preserves the saved-prefix status',async()=>{
 const errors=[],messages=[],locks=[];let redraws=0;
 const ui=Object.assign(landscapeFixture(LandscapeWorkbench),{
  token:'finish-test',live:{hasCommittedChanges:true,async finish(){}},saving:false,points:[{x:0,y:0}],brushStrokes:[],
  endLiveInput(){},sampleLive(){},clearMask(){},disable:value=>locks.push(value),say:text=>messages.push(text),
  host:{terrainGesture:async()=>{throw Error('Anzeige nicht erreichbar');},error:e=>errors.push(e.message),redraw(){redraws++;}},
 });
 await ui.finishLive();
 assert.equal(ui.livePainting,false);assert.equal(ui.saving,false);assert.deepEqual(ui.points,[]);assert.deepEqual(locks,[false]);
 assert.deepEqual(errors,['Anzeige nicht erreichbar']);assert.match(messages[0],/Gespeicherte Änderungen bleiben/);assert.equal(redraws,1);
});

// The same established Deck/device fixture drives the actual Surface callback.
import {readySurface,fieldDevice,bindPreparedSurfaceClass} from './helpers/atlas-prepared-surface.mjs';
import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
const preparedAPI=createRequire(import.meta.url)('../.build/terrain-commit-display-test.cjs');
bindPreparedSurfaceClass(preparedAPI.AtlasDeckSurface);
class PreparedProductPort {
 onmessage=null;onerror=null;onmessageerror=null;messages=[];responses=[];holdSettled=false;heldAcks=[];terminated=false;holdResults=false;heldResults=[];
 constructor(){this.timers=new Set();this.state=new preparedAPI.TerrainPreparedWorkerState((reply,transfer)=>{if(this.terminated)return;const value=structuredClone(reply,{transfer});this.responses.push(value);if(reply.kind==='result'&&this.holdResults)this.heldResults.push(value);else if(reply.kind==='settled'&&this.holdSettled)this.heldAcks.push(value);else queueMicrotask(()=>{if(!this.terminated)this.onmessage?.({data:value});});},run=>{const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.terminated)run();},0);this.timers.add(timer);return timer;},timer=>{clearTimeout(timer);this.timers.delete(timer);});}
 postMessage(message,transfer){const value=structuredClone(message,{transfer});this.messages.push(value);this.state.receive(value);}
 releaseAcks(){this.holdSettled=false;for(const value of this.heldAcks.splice(0))this.onmessage?.({data:value});}
 terminate(){this.terminated=true;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();this.onmessage=null;}
}
const untilPrepared=async check=>{const deadline=Date.now()+20000;while(!check()){if(Date.now()>deadline)throw Error('Prepared product integration timed out');await new Promise(r=>setTimeout(r,1));}};
function preparedProductTile(source,height=-100){const address={lod:0,x:0,y:0},box={x:0,y:0,width:256,height:256},grid={view:{box,frame:box,columns:65,rows:65,focusM:0,tilt:0,rotation:0,exaggeration:1},heights:new Float32Array(4225).fill(Math.max(0,height)),seaLevelM:0,editing:{ground:new Float32Array(4225).fill(height),water:new Float32Array(4225)}};return{tile:address,fence:source.fence,revision:source.revision,terrain:{tile:address,fence:source.fence,revision:source.revision,projection:{heightOnly:true,source:source.fence,fence:source.fence,revision:source.revision,generation:0,draft:false,grid,width:0,height:0,pixels:new Uint8Array()}},material:{tile:address,fence:source.fence,revision:source.revision,width:256,height:256,channels:emptyMaterialChannels(65536)}};}
async function preparedRasterFixture(t,{seaLevelM=0,landColor=preparedAPI.DEFAULT_TERRAIN_STYLE.land,lifecycle=false}={}){
 const environmentCleanup=[],errors=[],events=[],writerReleases=[],pendingOperations=[],ports=[];
 let renderTimer,raster,initialSession,surface=null,deck=null,env=null,originalOwner=null,originalClient=null;
 // Registered before the first productive await. The same dump covers initial
 // creation,48/49 setup and the final50/51 assertions; absent owners stay null.
 const terminalDump=label=>{
  if(!lifecycle)return;
  const session=raster?.prepared??raster?.retiringPrepared,author=originalOwner??session?.author,worker=originalClient??session?.client;
  const screen=surface?.preparedScreenSnapshot,drawn=surface?.terrainDrawn,submission=drawn?.field?.prepared?.submission;
  console.log('E50_LIFECYCLE',JSON.stringify({
   label,A:author?{source:author.canonicalSource,content:author.snapshot.content,prefix:author.snapshot.prefix,suffix:author.snapshot.suffix.map(e=>({ordinal:e.ordinal,id:e.id})),journal:author.journal.entries.map(e=>({ordinal:e.ordinal,id:e.id})),active:author.active?{id:author.active.id,closing:author.active.closing}:null,pending:author.queue.pending,failed:author.failed}:null,
   session:session?{draftContent:session.draftContent,operation:session.operation,fieldLatest:session.fieldLatest?{request:session.fieldLatest.request,sources:session.fieldLatest.tiles.map(x=>({revision:x.revision,fence:x.fence}))}:null,escape:!!session.escape,restoring:!!session.restoring,applying:session.applying?{binding:session.applying.binding,content:session.applying.content,drawn:session.applying.drawn,tiles:session.applying.tiles?.map(tile=>({revision:tile.revision,fence:tile.fence}))}:null}:null,
   C:worker?{...worker.diagnostics}:null,workers:ports.map(port=>({terminated:port.terminated,...port.state.diagnostics})),
   screen:screen?{...screen,capture:submission?.capture,target:submission?.expected.target,draft:!!submission?.result.draft}:null,
   surface:surface?{failure:surface.failure?String(surface.failure):null,contextAvailable:surface.contextAvailable,lost:surface.lost,disposed:surface.disposed,alpha:surface.terrainAlpha,frozen:surface.terrainFrozen,pending:surface.pendingField?{field:surface.pendingField.field.stateId,previous:surface.pendingField.previous?.stateId,published:surface.pendingField.published}:null,deadline:surface.fieldContentDeadline?{content:surface.fieldContentDeadline.content,goal:surface.fieldContentDeadline.goal}:null,drawn:drawn?{content:drawn.content,alpha:drawn.alpha,field:drawn.field?.stateId}:null,escape:!!surface.preparedEscape,restorePending:surface.preparedRestorePending}:null,
   raster:raster?{revision:raster.revision,fence:raster.fence,ready:raster.ready,active:raster.active,failed:raster.failed,generation:raster.generation,request:raster.request,writing:raster.host.writing(),reading:ui.regions.reading,gesturing:raster.gesturing,dirty:raster.dirty}:null,
   raf:env?.animation.statistics??null,oldEquality:author?screen?.draftRevision===author.snapshot.content:null,errors:errors.map(String),events
  }));
 };
 const fail=error=>{events.push({kind:'surface-error',message:String(error),initial:!raster});if(raster?.active)raster.fail(error);else if(!raster)errors.push(error);};
 let created;try{created=await readySurface({after:fn=>environmentCleanup.push(fn)},{camera:{focus:{x:128,y:128},focusHeightM:0,metersPerPixel:lifecycle?256/640:1,tilt:0,rotation:0,exaggeration:1},timeoutMs:5000,...(lifecycle?{animationFrames:true,onError:fail,onContextLost:()=>{events.push({kind:'context-lost',initial:!raster});if(raster?.active)raster.contextLost();else if(!raster)errors.push(Error('Initial Surface context lost'));}}:{})});}catch(error){terminalDump('initial-surface-failure');console.error('E50_INITIAL_SURFACE',JSON.stringify({error:String(error),errors:errors.map(String),events}));for(const cleanup of environmentCleanup)await cleanup();throw error;}
 ({surface,deck,env}=created);const {device}=fieldDevice();surface.gpuDevice=device;
 for(const frame of [deck.deckPicker.pickingFBO,deck.deckPicker.depthFBO])for(const attachment of [...frame.colorAttachments,frame.depthStencilAttachment])if(attachment)Object.assign(attachment.texture,{width:frame.width,height:frame.height});
 // Real installation can throw: entry alone is never evidence of a new field.
 let basisSources=[];const install=surface.setPreparedTerrain.bind(surface);surface.setPreparedTerrain=(delivery,...rest)=>{if(delivery.result.geometry)basisSources=delivery.result.geometry.newSources.map(s=>({id:s.id,source:s.source}));const binding={expected:delivery.expected,capture:delivery.capture,basis:delivery.result.basis,geometry:delivery.result.geometry!==null,draft:delivery.result.draft!==null,basisSources};console.log('E1_BINDING',JSON.stringify(binding));events.push({kind:'install-enter',...binding});try{const content=install(delivery,...rest);events.push({kind:'install-return',content,...binding});return content;}catch(error){events.push({kind:'install-throw',message:String(error),...binding});throw error;}};
 const dir=mkdtempSync(tmpdir()+'/terrain-e-product-'),store=new preparedAPI.CampaignStore(dir+'/world.sqlite'),campaign=store.create('Prepared product'),workspace=store.activate(campaign.id),token=workspace.token,seaSetup=seaLevelM?store.executeAtlasCommit({commandId:crypto.randomUUID(),token,campaignId:campaign.id,action:{kind:'landscape-sea-level',seaLevelM}}):null,source=store.atlasRegionSource(token),writes=[],screens=[];
 // Release every deliberately held writer before draining; frame callbacks must
 // still run while accepted work finishes its real checkpoint/settle path.
 t.after(async()=>{terminalDump('cleanup-entry');raster.active=false;ui.root.hidden=true;ui.regions.invalidatePendingRead();raster.stream.cancel();for(const release of writerReleases)release();let timer;const sessions=new Set([initialSession,raster.prepared,raster.retiringPrepared].filter(Boolean));try{await Promise.race([(async()=>{await Promise.allSettled(pendingOperations);for(const session of [raster.prepared,raster.retiringPrepared])if(session)sessions.add(session);for(const session of sessions)await session.dispose();})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fixture accepted-work cleanup timed out')),20000);})]);}finally{clearTimeout(timer);clearInterval(renderTimer);for(const session of sessions)session.client.dispose();for(const port of ports)if(!port.terminated)port.terminate();surface.dispose();env.animation.stop();store.close();rmSync(dir,{recursive:true,force:true});for(const cleanup of environmentCleanup)await cleanup();}});
 const status=env.document.createElement('p');status.id='atlas-save-status';status.dataset.error='false';env.document.body.append(status);
 const previousCustom=global.CustomEvent,previousEvent=global.Event;global.CustomEvent=PreparedDOMEvent;global.Event=PreparedEvent;t.after(()=>{global.CustomEvent=previousCustom;global.Event=previousEvent;});
 attachAtlasAuthorRecovery(env.window.campaign={executeAtlasCommit:async command=>{writes.push(structuredClone(command));return{ok:true,value:store.executeAtlasCommit(command)};}},store,dir);
 const atlas={revision:source.revision,workspace,region:{revision:source.revision,fence:source.fence},...(lifecycle?{cities:[],entrances:[],bindings:[],geometry:{floors:[]}}:{})},ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{owner:workspace,projection:atlas,opts:{status(){}},landscape:{livePainting:false,cancel(){},invalidate(){},routeHistory:()=>false},root:{hidden:!lifecycle},render(){},error:e=>errors.push(e),journey:{busy:false,invalidatePreview(){}}});
 const initialTile=preparedProductTile(source);initialTile.terrain.projection.grid.seaLevelM=seaLevelM;initialTile.terrain.projection.grid.editing.water.fill(seaLevelM);initialTile.terrain.projection.grid.heights.fill(seaLevelM);raster=Object.create(preparedAPI.AtlasRasterPresentation.prototype);Object.assign(raster,{active:true,surfaceReady:true,failed:false,surface,gesturing:false,frozen:null,frame:{x:0,y:0,width:256,height:256},input:{dataset:{},clientWidth:640,clientHeight:480},host:{writing:()=>lifecycle?ui.busy||ui.regions.reading:false,redraw(){},cancel:()=>ui.landscape.cancel(),hasDraft:()=>!!raster.prepared?.author.active||!!raster.dirty,error:e=>errors.push(e),refresh:()=>ui.regions.refresh()},stream:{cancel(){}},generation:0,revision:source.revision,fence:source.fence,token,request:'initial',targetComplete:true,targetTiles:[initialTile],style:{...preparedAPI.DEFAULT_TERRAIN_STYLE,land:landColor},firstSurface:new Set(),retry:{hidden:true},submitted:null,prepared:null,perception:false,tilt:0,rotation:0,exaggeration:1,focusHeightM:0,contours:0});
 Object.defineProperty(raster,'needsTerrainRaster',{value:false});ui.spatial=raster;ui.canvas=raster.input;
 env.document.addEventListener('atlas-invalidated',event=>ui.onAtlasInvalidated(event.detail));
 ui.regions.refresh=async()=>{const current=store.atlasRegionSource(token);atlas.revision=current.revision;atlas.region={...atlas.region,revision:current.revision,fence:current.fence};return true;};
 if(lifecycle){
  Object.assign(raster,{displayModels:[],objects:[],objectKey:'',objectRead:null,objectLayer:{dispose(){}},vegetationRecords:[],vegetation:null});
  surface.observeTerrainFrames(snapshot=>{raster.displayModels=snapshot.models;raster.input.dataset.terrainDrawn=JSON.stringify({at:snapshot.at,content:snapshot.content,alpha:snapshot.alpha});});
  // A single existing fixture tile replaces only the stream's data boundary.
  // Raster.load itself, including its generation/publication guards, stays real.
  let streamSerial=0,closed=false;
  const stream={
   statistics:{loads:0,cancels:0},availableTiles:[],
   cancel(){streamSerial++;this.statistics.cancels++;events.push({kind:'stream-cancel',serial:streamSerial});},
   dispose(){closed=true;this.cancel();},
   async load(request,_fetcher,publish){
    const serial=++streamSerial,job=structuredClone(request);this.statistics.loads++;
    events.push({kind:'stream-load',serial,request:job,guards:{writing:raster.host.writing(),reading:ui.regions.reading,gesturing:raster.gesturing,dirty:raster.dirty,generation:raster.generation}});
    const validate=()=>{const current=store.atlasRegionSource(token);if(raster.token!==token||job.revision!==current.revision||job.source!==current.fence)throw Error('Autorenquelle inzwischen geändert.');return current;};
    validate();await new Promise(resolve=>setImmediate(resolve));
    if(closed||serial!==streamSerial)return;
    const current=validate(),tile=preparedProductTile(current);
    const q={token,fence:job.source,revision:job.revision,owner:'fixture-raw-tile',series:0,request:serial,prefix:0,box:{x:112,y:112,width:32,height:32},pixel:.25,lattices:client.lattices([tile])};
    const ground=preparedAPI.readTerrainAuthorCheckpoint(store.db,current,q).ground[0].values;
    tile.terrain.projection.grid.seaLevelM=seaLevelM;tile.terrain.projection.grid.editing.water.fill(seaLevelM);
    tile.terrain.projection.grid.editing.ground=Float32Array.from(ground);
    tile.terrain.projection.grid.heights=Float32Array.from(ground,h=>Math.max(seaLevelM,h));
    if(closed||serial!==streamSerial)return;
    this.availableTiles=[tile.tile];events.push({kind:'stream-publish',serial,request:job,query:q});
    publish({tiles:[tile],overviewComplete:true,complete:true});events.push({kind:'stream-return',serial});
   }
  };
  raster.stream=stream;
  const load=raster.load.bind(raster);
  raster.load=async(...args)=>{
   events.push({kind:'load-entry',guards:{active:raster.active,failed:raster.failed,revision:raster.revision,fence:raster.fence,generation:raster.generation,writing:raster.host.writing(),reading:ui.regions.reading,gesturing:raster.gesturing,dirty:raster.dirty}});
   try{return await load(...args);}finally{events.push({kind:'load-return',generation:raster.generation});}
  };
  // This is only the terrain branch of the normal UI render (UI1396): the
  // actual Raster.sync/load is used, including the old projection at read start.
  ui.render=()=>{const data=ui.regions.data;if(ui.root.hidden||!data)return;if(ui.landscape.livePainting){events.push({kind:'render-overlay-only'});return;}events.push({kind:'render-sync',source:{revision:data.revision,fence:data.region.fence},reading:ui.regions.reading,writing:ui.busy});raster.sync(token,raster.frame,data.revision,data.region.landscape?.records??[],raster.contours,data,{mpp:raster.frame.width/raster.input.clientWidth,roofs:true,scopeId:null});};
  ui.regions.refresh=async()=>{
   if(ui.landscape.livePainting)return false;
   const owner=ui.owner,request=++ui.regions.request;
   ui.regions.regionReading=request;raster.pauseReads();events.push({kind:'region-reading',request});
   ui.render(); // Normal loading render still uses the OLD projection.
   try{
    await new Promise(resolve=>setImmediate(resolve));
    if(ui.owner!==owner||ui.regions.request!==request)return false;
    const current=store.atlasRegionSource(token),previous=ui.regions.data;
    ui.regions.projection={...previous,revision:current.revision,region:{...previous.region,revision:current.revision,fence:current.fence}};
    ui.regions.authorSource=null;events.push({kind:'region-projected',request,source:{revision:current.revision,fence:current.fence}});
    ui.regions.regionReading=null;ui.render();return true;
   }finally{if(ui.regions.request===request)ui.regions.regionReading=null;}
  };
 }
 const previousWorker=global.Worker,previousLocation=global.location;global.location={href:'https://test/'};global.Worker=class extends PreparedProductPort{constructor(){super();assert.equal(ports.filter(p=>!p.terminated).length,0,'only one productive modelworker may be live');ports.push(this);}};t.after(()=>{global.Worker=previousWorker;global.location=previousLocation;raster.prepared?.dispose();});
 env.window.campaign.atlasAuthorCheckpoint=async(_token,q)=>({ok:true,value:preparedAPI.readTerrainAuthorCheckpoint(store.db,store.atlasRegionSource(token),q)});
 raster.bindAuthorWriter(async(action,context)=>{const r=await ui.write(action,false,true,context);assert(r?.receipt);console.log('E1_RECEIPT',JSON.stringify({receipt:r.receipt,revision:r.ack.revision,fence:r.ack.sourceFence,stroke:context.id}));return{ack:r.ack,receipt:r.receipt};});
 raster.show();
 renderTimer=setInterval(()=>{try{deck.fireRender();}catch(e){errors.push(e);}},1);t.after(()=>clearInterval(renderTimer));
 await untilPrepared(()=>errors.length||surface.preparedScreenSnapshot&&raster.prepared&&!raster.prepared.client.diagnostics.flight);assert.deepEqual(errors,[]);const owner=raster.authorOwner,client=raster.prepared.client;initialSession=raster.prepared;originalOwner=owner;originalClient=client;
 const originalObserver=surface.preparedObserver;let lastScreenEvent='';surface.observePreparedScreens(s=>{screens.push(s);const key=JSON.stringify(s);if(key!==lastScreenEvent){lastScreenEvent=key;events.push({kind:'screen',screen:{...s},capture:surface.terrainDrawn?.field?.prepared?.submission.capture});}originalObserver(s);});client.observeSettled((screen,binding)=>events.push({kind:'settled',screen,binding}));
 // Actual brush controller invokes Raster gesture/begin/update/close, with one
 // input frame held so A's next canonical/end image is still outstanding.
 let pointer=1;const brushHost={effects:{data:()=>ui.regions.data,error:e=>errors.push(e),redraw(){},terrainGesture:a=>raster.gesture(a),previewHeight:s=>raster.previewHeight(s),localTerrain:()=>({beginHeight:(id,s)=>raster.beginHeight(id,s),enqueue:(a,id)=>ui.enqueueRasterStroke(a,id),cancel:()=>raster.cancelDraft(),previewColor(){}})},get pointer(){return pointer;},endInput(){pointer=null;},disable(){},say(){},lastPoint:{x:128,y:128},points:[],clearDraft(){},saving:false,clearHeightPreview(){}};const brush=new preparedAPI.LandscapeBrushSession(brushHost);if(!lifecycle)raster.load=async()=>{};Object.defineProperty(ui.landscape,'livePainting',{get:()=>brush.livePainting});ui.landscape.cancel=()=>{if(brush.live)void brush.finishLive(true);};
 return{surface,deck,env,store,campaign,workspace,token,source,errors,writes,screens,events,writerReleases,pendingOperations,ui,raster,ports,owner,client,brushHost,brush,dump:terminalDump,get pointer(){return pointer;},set pointer(v){pointer=v;},renderTimer,pause(){clearInterval(renderTimer);},resume(){clearInterval(renderTimer);renderTimer=setInterval(()=>{try{deck.fireRender();}catch(e){errors.push(e);}},1);},draw:()=>deck.fireRender()};
}
test('prepared Raster and brush keep one author and worker across receipt and immediate B before A endframe',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{surface,deck,store,campaign,errors,writes,screens,raster,ports,owner,client,brush,token,renderTimer}=f; const stroke={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 const activeScreen=id=>{const submission=surface.terrainDrawn?.field?.prepared?.submission;return !!(submission&&ports[0].messages.some(message=>message.kind==='draft'&&message.epoch===submission.expected.epoch&&message.job===submission.expected.job&&message.capture.id===submission.capture.id&&message.capture.owner===owner.snapshot.owner&&message.capture.editSeries===owner.snapshot.series&&message.capture.active?.id===id&&message.capture.draftRevision===submission.result.draftRevision&&f.events.some(event=>event.kind==='settled'&&event.screen&&event.screen.draftRevision===submission.result.draftRevision&&event.binding.epoch===submission.expected.epoch&&event.binding.job===submission.expected.job)));};
 const deliver=ports[0].onmessage;let heldReplay=null,heldOnce=false;ports[0].onmessage=event=>{if(event.data.kind==='author-result'&&!heldOnce){heldOnce=true;heldReplay=event;return;}deliver(event);};
 brush.maskStroke=structuredClone(stroke);brush.maskStart=performance.now()-1000;brush.startLive();const aId=brush.liveId;brush.sampleLive();
 const startedFrames=f.env.animation.statistics.executed;await untilPrepared(()=>errors.length||heldReplay&&f.env.animation.statistics.executed>=startedFrames+8);assert.deepEqual(errors,[]);const replayDispatch=ports[0].messages.find(message=>message.kind==='replay'&&message.job===heldReplay.data.job&&message.epoch===heldReplay.data.epoch);assert.equal(replayDispatch.capture.active.id,aId);const releaseFrames=f.env.animation.statistics.executed;deliver(heldReplay);console.log('S7_HELD_REPLAY_RELEASE',JSON.stringify({binding:{epoch:replayDispatch.epoch,job:replayDispatch.job,capture:replayDispatch.capture.id},capturedSamples:replayDispatch.capture.active.stroke.samples.length,desiredSamples:owner.active.action.stroke.samples.length,releaseFrames}));
 try{await untilPrepared(()=>errors.length>0||activeScreen(aId));}catch(e){console.error('E1 diagnostics',errors.map(e=>String(e)),client.diagnostics,ports[0].state.diagnostics,ports[0].messages.map(m=>({kind:m.kind,content:m.requestContent})),owner.snapshot);throw e;}
 assert.deepEqual(errors,[]);const firstProgress=surface.preparedScreenSnapshot,firstSubmission=surface.terrainDrawn.field.prepared.submission,firstHeight=surface.terrainRay([[128,128,500],[128,128,-500]]);assert(firstHeight,'first bound capture must lie in the unchanged analytic test segment');assert(firstHeight.point[2]>=300);assert(brush.live);assert.equal(f.pointer,1);assert(f.env.animation.statistics.executed>releaseFrames);
 await untilPrepared(()=>errors.length||activeScreen(aId)&&surface.preparedScreenSnapshot.draftRevision>firstProgress.draftRevision);assert.deepEqual(errors,[]);const repeatedProgress=surface.preparedScreenSnapshot;assert(brush.live);assert.equal(f.pointer,1);
 raster.input.getBoundingClientRect=()=>({left:0,top:0});
 const originalEye=480*.4/(2*Math.tan(36.86989764584402*Math.PI/360)),center=surface.frame.ray({x:320,y:240}),centerHit=surface.terrainRay(center);
 assert(centerHit);assert(centerHit.point[2]>originalEye,'normal held Raise passed the original eye');assert(center[0][2]>centerHit.point[2],'actual finite near segment starts above the new terrain');
 const move={clientX:336,clientY:240},mapped=raster.point(move),mappedHit=raster.terrainHit(move.clientX,move.clientY);assert(mappedHit);assert.notEqual(mapped.x,128,'a later real screen position is projected through the drawn safety frame');
 assert.equal(mapped.x,mappedHit.point.x);assert.equal(mapped.y,mappedHit.point.y);f.brushHost.lastPoint={...mapped};brush.sampleLive(false);const movedSample={...brush.maskStroke.samples.at(-1)};brush.sampleLive(false);assert.equal(brush.maskStroke.samples.at(-1).x,movedSample.x);assert.equal(brush.maskStroke.samples.at(-1).y,movedSample.y,'a stationary dose retains its accepted world point');
 assert(surface.terrainClearance.lifts>0);console.log('S8_HELD_RAISE',JSON.stringify({originalEye,near:center[0],drawnHeight:centerHit.point[2],camera:surface.camera,movedSample,clearance:surface.terrainClearance}));
 console.log('S7_ACTIVE_PROGRESS',JSON.stringify({first:firstProgress,firstDispatch:firstSubmission.expected,firstHeight:firstHeight.point[2],second:repeatedProgress,frames:f.env.animation.statistics}));clearInterval(renderTimer);const aDraft=repeatedProgress;
 const endInput=brush.endLiveInput.bind(brush);let expectedFinalAStroke;brush.endLiveInput=()=>{endInput();if(brush.liveId===aId)expectedFinalAStroke=structuredClone(brush.maskStroke);};
 const close=brush.finishLive();
 await untilPrepared(()=>writes.length===1||errors.length>0);assert.deepEqual(errors,[]);f.pointer=2;brush.maskStroke={...structuredClone(stroke),strength:80};brush.maskStart=performance.now()-1000;brush.startLive();const bId=brush.liveId;brush.sampleLive();
 assert.equal(raster.authorOwner,owner);assert.equal(raster.prepared.client,client);assert.equal(ports.length,1);assert.equal(owner.active.id,bId);assert.equal(writes.length,1);assert.equal(writes[0].terrainStroke.id,aId);assert.equal(aDraft.basis.generation,surface.preparedScreenSnapshot.basis.generation);
 const restart=setInterval(()=>{try{deck.fireRender();}catch(e){errors.push(e);}},1);t.after(()=>clearInterval(restart));await close;
 await untilPrepared(()=>owner.snapshot.active?.id===bId&&activeScreen(bId));assert.equal(owner.active.id,bId);assert.equal(writes.length,1);assert(store.atlasHeight(token,{x:128,y:128}).heightM>=300);assert.deepEqual(errors,[]);assert.equal(f.pointer,2);
 assert(raster.terrainHit(336,240),'the same active B still picks after the earlier own A receipt');
 const displayedB=surface.preparedScreenSnapshot,oldA=ports[0].responses.find(r=>r.kind==='result'&&r.draftRevision===aDraft.draftRevision);assert(oldA);clearInterval(restart);try{ports[0].onmessage({data:oldA});await new Promise(r=>setImmediate(r));assert.equal(surface.preparedScreenSnapshot.content,displayedB.content,'late A result cannot replace B content');assert.equal(surface.preparedScreenSnapshot.draftRevision,displayedB.draftRevision,'late A result cannot replace B draft');assert.equal(owner.active.id,bId);}finally{f.resume();}
 const normalize=heights=>heights.map(h=>({x:h.x,y:h.y,pixel:h.pixel,version:h.version,data:h.data})).sort((a,b)=>a.pixel-b.pixel||a.y-b.y||a.x-b.x);
 assert(expectedFinalAStroke.samples.length>replayDispatch.capture.active.stroke.samples.length);assert.deepEqual(writes[0].action.stroke,expectedFinalAStroke,'every final pointer-up sample reaches the original immutable writer once');assert.equal(store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,1);
 const expected=normalize(preparedAPI.applyTerrainBrush([],expectedFinalAStroke,undefined,undefined,undefined,true).map(r=>r.height)),actual=normalize(store.db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL").all(campaign.id).map(r=>JSON.parse(r.payload).height));
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),expectedHash=hash(expected),actualHash=hash(actual);assert.equal(actualHash,expectedHash,'canonical stored bands match the untouched form kernel, independently of A/C/Surface');
 await brush.finishLive(true);await untilPrepared(()=>errors.length||!owner.active&&!owner.queue.pending&&!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&client.inventoryEqual(client.acknowledged,client.inventory())&&!raster.prepared.restoring&&!surface.preparedRestorePending&&!surface.preparedEscape);assert.deepEqual(errors,[]);assert.equal(owner.journal.size,0);assert.equal(writes.length,1);
 console.log('E1_PASS',JSON.stringify({writerCommands:writes.length,finalInputSamples:expectedFinalAStroke.samples.length,finalInputEqualsImmutableWriter:true,canonicalHeightHash:actualHash,authorOwner:owner.snapshot.owner,workerEpoch:client.epoch,workers:ports.length,aDraft,bScreen:displayedB,bActive:bId,lateARejected:true}));
});

test('prepared B update and Escape restore the real A draw and release B buffers after actual restore',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,client,surface,ports,errors}=f;
 const activeScreen=strength=>{const submission=surface.terrainDrawn?.field?.prepared?.submission;return !!(submission&&ports[0].messages.some(message=>message.kind==='draft'&&message.epoch===submission.expected.epoch&&message.job===submission.expected.job&&message.capture.id===submission.capture.id&&message.capture.owner===owner.snapshot.owner&&message.capture.editSeries===owner.snapshot.series&&message.capture.active?.id==='B-escape'&&message.capture.active.stroke.strength===strength&&message.capture.draftRevision===submission.result.draftRevision));};
 const a=surface.preparedScreenSnapshot,originalHeight=surface.terrainRay([[128,128,500],[128,128,-500]]).point[2];
 raster.gesture(true);raster.beginHeight('B-escape',{mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]});
 await untilPrepared(()=>errors.length||owner.snapshot.active?.id==='B-escape'&&activeScreen(400)&&!client.diagnostics.flight);assert.deepEqual(errors,[]);
 raster.previewHeight({...owner.active.action.stroke,strength:500});
 await untilPrepared(()=>errors.length||activeScreen(500)&&!client.diagnostics.flight);assert.deepEqual(errors,[]);
 assert(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2]>originalHeight);const bScreen=surface.preparedScreenSnapshot,bIds=new Set(surface.preparedResourceInventory().retainedBufferIds);assert(f.events.some(event=>event.kind==='settled'&&event.screen&&event.screen.content===bScreen.content&&event.screen.draftRevision===bScreen.draftRevision));
 const restored=raster.prepared.cancel();raster.gesture(false);await restored;
 await untilPrepared(()=>!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&client.inventoryEqual(client.acknowledged,client.inventory())&&!raster.prepared.escape&&!raster.prepared.restoring&&!surface.preparedEscape&&!surface.preparedRestorePending);assert.equal(owner.active,null);assert.equal(f.writes.length,0);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],originalHeight);assert.deepEqual(surface.preparedScreenSnapshot.basis,a.basis);assert.equal(raster.ready,true);assert.equal(ports.filter(port=>!port.terminated).length,1);assert.equal(surface.preparedScreenSnapshot.alpha,a.alpha);assert.equal(surface.preparedScreenSnapshot.endFrame,a.endFrame);assert(f.events.some(event=>event.kind==='screen'&&event.screen.content===surface.preparedScreenSnapshot.content&&event.screen.fieldState===surface.preparedScreenSnapshot.fieldState));
 const live=new Set(surface.preparedResourceInventory().retainedBufferIds);assert([...bIds].some(id=>!live.has(id)),'B-only stores are released after the real A restore draw');assert(ports[0].state.diagnostics.bases<=2);assert.deepEqual(errors,[]);
});

test('one author changes lattice window with 32 accepted real queue captures and the same active33',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,store,token,errors}=f;let releaseRead,held=false,releaseWriter;
 const originalWrite=f.env.window.campaign.executeAtlasCommit;let writeReady;const writeGate=new Promise(r=>{writeReady=r;});f.env.window.campaign.executeAtlasCommit=async c=>{if(!releaseWriter){await new Promise(r=>{releaseWriter=()=>{r();writeReady();};});}else await writeGate;return originalWrite(c);};
 const s={mode:'raise',radius:8,strength:40,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]},completions=[];
 for(let i=0;i<32;i++){owner.begin('closed-'+i,s);const p=owner.close('closed-'+i);p.catch(()=>{});completions.push(p);}await untilPrepared(()=>!!releaseWriter);assert.equal(owner.queue.pending,32);const entries=owner.journal.entries;
 const previous=f.env.window.campaign.atlasAuthorCheckpoint;f.env.window.campaign.atlasAuthorCheckpoint=async(t,q)=>{const v=await previous(t,q);if(!held){held=true;await new Promise(r=>{releaseRead=r;});}return v;};
 owner.begin('active33',s);const refresh=owner.refresh();await untilPrepared(()=>!!releaseRead);
 const before=owner.windowGeneration,newLattices=[{id:77,x:0,y:0,dx:8,dy:8}],change=owner.changeLattices(newLattices);owner.update('active33',{...s,strength:80});releaseRead();await change;await refresh;
 assert.equal(raster.authorOwner,owner);assert.equal(owner.windowGeneration,before+1);assert.deepEqual(owner.journal.entries,entries);assert.equal(owner.queue.pending,32);assert.equal(owner.active.id,'active33');assert.equal(owner.snapshot.active.id,'active33');assert.deepEqual(owner.snapshot.ground[0].lattice,newLattices[0]);assert.equal(owner.snapshot.suffix.length,32);
 await owner.escape('active33');assert.equal(owner.snapshot.active,null);assert.deepEqual(owner.snapshot.ground[0].lattice,newLattices[0]);assert.equal(owner.journal.size,32);assert.equal(store.atlasRegionSource(token).revision,0);assert.deepEqual(errors,[]);
 releaseWriter();await Promise.all(completions);assert.equal(owner.queue.pending,0);assert.equal(owner.journal.size,0);assert.equal(owner.journal.prefix,32);assert.equal(f.writes.length,32);assert.equal(new Set(f.writes.map(c=>c.terrainStroke.id)).size,32);assert.equal(client.epoch,raster.prepared.client.epoch);assert.deepEqual(errors,[]);
});

test('real drawn staging settles before B cancellation intent and keeps its worker basis',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,surface,ports,errors}=f,port=ports[0];f.pause();
 const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};raster.gesture(true);raster.beginHeight('drawn-A',s);
 await untilPrepared(()=>errors.length||raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);assert.deepEqual(errors,[]);
 port.holdSettled=true;f.draw();await untilPrepared(()=>port.heldAcks.length===1);const painted=surface.preparedScreenSnapshot,oldFlight=client.diagnostics.flight;
 const close=raster.enqueueHeight({kind:'landscape-height-stroke',stroke:s},'drawn-A');raster.gesture(false);
 await untilPrepared(()=>f.writes.length===1);raster.gesture(true);raster.beginHeight('drawn-B',{...s,strength:80});assert.equal(owner.active.id,'drawn-B');
 assert(!port.messages.some(m=>m.kind==='cancel'&&m.job===oldFlight.job),'a really drawn field is not cancelled before its settle ack');assert.equal(surface.preparedScreenSnapshot.content,painted.content);
 port.releaseAcks();f.resume();await close;await untilPrepared(()=>errors.length||owner.snapshot.active?.id==='drawn-B'&&surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight);assert.deepEqual(errors,[]);assert.equal(port.state.diagnostics.bases,1);assert.equal(owner.active.id,'drawn-B');
});

test('real unpainted staging is fenced before C cancel and accepted A still writes exactly once',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,surface,ports,errors}=f,port=ports[0];const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 raster.gesture(true);raster.beginHeight('unpainted-A',s);await untilPrepared(()=>errors.length||surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight&&owner.snapshot.active);assert.deepEqual(errors,[]);f.pause();
 let release;const original=f.env.window.campaign.executeAtlasCommit;f.env.window.campaign.executeAtlasCommit=async c=>{await new Promise(r=>{release=r;});return original(c);};
 const close=raster.enqueueHeight({kind:'landscape-height-stroke',stroke:s},'unpainted-A');raster.gesture(false);await untilPrepared(()=>!!release&&raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);
 const staged=raster.prepared.diagnostics.applying,confirmed=surface.preparedScreenSnapshot;assert(surface.pendingField);raster.gesture(true);raster.beginHeight('unpainted-B',{...s,strength:80});
 assert.equal(surface.pendingField,null,'Surface rolls back before the cancel leaves E');assert.equal(surface.preparedScreenSnapshot.content,confirmed.content);assert(port.messages.some(m=>m.kind==='cancel'&&m.job===staged.binding.job));assert.equal(owner.active.id,'unpainted-B');release();f.resume();await close;
 await untilPrepared(()=>errors.length||surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight&&owner.snapshot.active?.id==='unpainted-B');assert.deepEqual(errors,[]);assert.equal(f.writes.length,1);assert.equal(owner.active.id,'unpainted-B');assert.equal(port.state.diagnostics.bases,1);
});

test('presentation Dispose drains an accepted immutable write and checkpoint before terminating the one worker',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,surface,ports,errors}=f,port=ports[0],session=raster.prepared;
 const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};raster.gesture(true);raster.beginHeight('dispose-A',s);
 await untilPrepared(()=>errors.length||owner.snapshot.active&&surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight);assert.deepEqual(errors,[]);f.pause();
 let release;const original=f.env.window.campaign.executeAtlasCommit;f.env.window.campaign.executeAtlasCommit=async c=>{await new Promise(r=>{release=r;});return original(c);};
 const close=raster.enqueueHeight({kind:'landscape-height-stroke',stroke:s},'dispose-A');close.catch(()=>{});raster.gesture(false);await untilPrepared(()=>!!release&&session.diagnostics.applying&&!session.diagnostics.applying.drawn);
 assert.equal(owner.journal.size,1);const shown=f.screens.length,disposed=session.dispose();surface.dispose();assert.equal(port.terminated,false,'accepted checkpoint still owns its one worker');release();await disposed;await close;
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].terrainStroke.id,'dispose-A');assert.equal(owner.journal.size,0);assert.equal(owner.journal.prefix,1);assert.equal(port.terminated,true);assert.equal(port.state.diagnostics.continuations,0);assert.equal(f.screens.length,shown,'no field is published after presentation disposal');assert.deepEqual(errors,[]);
});

for(const restart of [true,false])test(`retirement drains accepted work before ${restart?'serial view restart':'final Raster disposal without restart'}`,async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,surface,ports,errors}=f;const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 raster.gesture(true);raster.beginHeight('retire-A',s);await untilPrepared(()=>owner.snapshot.active&&surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!f.client.diagnostics.flight);f.pause();
 let release;const original=f.env.window.campaign.executeAtlasCommit;f.env.window.campaign.executeAtlasCommit=async c=>{await new Promise(r=>{release=r;});return original(c);};
 const closed=raster.enqueueHeight({kind:'landscape-height-stroke',stroke:s},'retire-A');closed.catch(()=>{});raster.gesture(false);await untilPrepared(()=>!!release&&raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);
 raster.stopModels();const barrier=raster.retirement;assert(barrier);raster.show();assert.equal(ports.length,1);assert.equal(raster.authorOwner,owner);assert.equal(ports[0].terminated,false);
 if(!restart)raster.active=false;release();await untilPrepared(()=>f.writes.length===1);
 const source=f.store.atlasRegionSource(f.token),tile=preparedProductTile(source),q={token:f.token,fence:source.fence,revision:source.revision,owner:owner.snapshot.owner,series:0,request:100,prefix:0,box:{x:112,y:112,width:32,height:32},pixel:.25,lattices:f.client.lattices([tile])},ground=preparedAPI.readTerrainAuthorCheckpoint(f.store.db,source,q).ground[0].values;
 tile.terrain.projection.grid.editing.ground=Float32Array.from(ground);tile.terrain.projection.grid.heights=Float32Array.from(ground,h=>Math.max(0,h));Object.assign(raster,{revision:source.revision,fence:source.fence,targetTiles:[tile],request:'restart'});
 f.resume();await closed;await barrier;
 if(restart){await untilPrepared(()=>errors.length||ports.length===2&&raster.prepared&&surface.preparedScreenSnapshot&& !raster.prepared.client.diagnostics.flight);assert.equal(ports[0].terminated,true);assert.equal(ports.filter(p=>!p.terminated).length,1);assert.notEqual(raster.authorOwner,owner);}
 else{await new Promise(r=>setTimeout(r,10));assert.equal(ports.length,1);assert.equal(ports[0].terminated,true);assert.equal(raster.prepared,null);}
 assert.equal(owner.journal.size,0);assert.equal(f.writes.length,1);assert.deepEqual(errors,[]);
});

test('actual basis draw changes the one author window and frozen intermediate draft resumes before commitThrough',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,surface,ports,errors}=f;f.pause();const drawnTiles=raster.tiles;
 const coarse=preparedProductTile(f.source);coarse.tile.lod=1;coarse.terrain.projection.grid.view.box.width=512;coarse.terrain.projection.grid.view.box.height=512;
 raster.targetTiles=[coarse];raster.request='coarse';raster.show();await untilPrepared(()=>errors.length||raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);assert.deepEqual(errors,[]);assert.equal(owner.windowGeneration,0,'pending geometry cannot replace A window');assert.equal(raster.tiles,drawnTiles,'pending raw target cannot replace draw-bound camera/height inputs');
 surface.terrainMorphStart=performance.now()-90;surface.publish(false);f.draw();await untilPrepared(()=>!client.diagnostics.flight);const frozen=surface.preparedScreenSnapshot;assert(frozen.alpha>.4&&frozen.alpha<.8);assert.equal(frozen.endFrame,false);assert.equal(owner.windowGeneration,1);assert.equal(raster.tiles[0],coarse,'the actual geometry draw installs its exact raw group');assert.equal(raster.authorOwner,owner);
 const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};raster.gesture(true);raster.beginHeight('morph-A',s);f.resume();
 await untilPrepared(()=>errors.length||owner.snapshot.active&&surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight);assert.deepEqual(errors,[]);assert.equal(owner.snapshot.ground[0].lattice.dx,8);assert.equal(surface.preparedScreenSnapshot.alpha,frozen.alpha);const draftHeight=surface.terrainRay([[128,128,600],[128,128,-500]]).point[2];assert.equal(draftHeight,300);
 const closed=raster.enqueueHeight({kind:'landscape-height-stroke',stroke:s},'morph-A');raster.gesture(false);await closed;await untilPrepared(()=>errors.length||!surface.terrainFrozen&&!client.diagnostics.flight);assert.deepEqual(errors,[]);f.pause();assert(surface.terrainAlpha>=frozen.alpha,'resume never resets the confirmed alpha to zero');
 const beforeEnd=surface.preparedScreenSnapshot;if(!beforeEnd.endFrame){surface.terrainMorphStart=performance.now()-200;surface.publish(false);f.draw();assert.equal(surface.preparedScreenSnapshot.content,beforeEnd.content);assert.equal(surface.preparedScreenSnapshot.endFrame,false,'first alpha1 oldSlot draw is not a material end receipt');f.draw();}const endpoint=surface.preparedScreenSnapshot;assert.equal(endpoint.alpha,1);assert.equal(endpoint.endFrame,true);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],draftHeight);
 const source=f.store.atlasRegionSource(f.token),canonical=preparedProductTile(source);canonical.tile.lod=1;canonical.terrain.projection.grid.view.box.width=512;canonical.terrain.projection.grid.view.box.height=512;canonical.terrain.projection.grid.editing.ground=Float32Array.from(owner.snapshot.ground[0].values);canonical.terrain.projection.grid.heights=Float32Array.from(owner.snapshot.ground[0].values,h=>Math.max(0,h));
 raster.targetTiles=[canonical];raster.request='commit-through';raster.show();await untilPrepared(()=>errors.length||raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);assert.deepEqual(errors,[]);const prepare=ports[0].messages.filter(m=>m.kind==='prepare').at(-1);assert.deepEqual(prepare.fromEnd,endpoint);assert.equal(prepare.commitThrough.draftRevision,endpoint.draftRevision);assert.equal(prepare.commitThrough.editSeries,owner.snapshot.series);
 f.draw();assert.equal(surface.preparedScreenSnapshot.alpha,0);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],draftHeight,'new canonical alpha0 keeps the exact confirmed absolute endpoint');assert.equal(raster.authorOwner,owner);assert.equal(ports.length,1);assert.deepEqual(errors,[]);
});

test('foreign same-token higher revision invalidates active author immediately and late old worker result cannot publish',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,client,surface,ports,errors}=f,port=ports[0];port.holdResults=true;
 const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};raster.gesture(true);raster.beginHeight('foreign-A',s);await untilPrepared(()=>port.heldResults.length===1);
 const late=port.heldResults[0],oldScreen=surface.preparedScreenSnapshot,prior=f.store.atlasRegionSource(f.token),ack=f.store.executeAtlasCommit({commandId:crypto.randomUUID(),campaignId:f.campaign.id,token:f.token,sourceFence:prior.fence,action:{kind:'landscape-sea-level',seaLevelM:17}});
 assert.equal(ack.revision,prior.revision+1);assert.notEqual(ack.sourceFence,prior.fence);f.env.document.dispatchEvent(new PreparedDOMEvent('atlas-invalidated',{detail:ack}));
 assert.equal(owner.active,null);assert.equal(raster.gesturing,false);assert.equal(raster.ready,false);assert.equal(raster.prepared,null);assert.equal(surface.preparedScreenSnapshot.content,oldScreen.content);await raster.retirement;assert.equal(port.terminated,true);assert.equal(f.writes.length,0,'foreign source never silently commits the active local gesture');
 const source=f.store.atlasRegionSource(f.token),tile=preparedProductTile(source);tile.terrain.projection.grid.seaLevelM=17;tile.terrain.projection.grid.editing.water.fill(17);tile.terrain.projection.grid.heights.fill(17);Object.assign(raster,{revision:source.revision,fence:source.fence,targetTiles:[tile],request:'foreign-new'});raster.show();
 await untilPrepared(()=>errors.length||raster.prepared&&raster.prepared!==f.session&&!raster.prepared.client.diagnostics.flight&&surface.preparedScreenSnapshot.content!==oldScreen.content);assert.deepEqual(errors,[]);const fresh=surface.preparedScreenSnapshot,newOwner=raster.authorOwner;
 await raster.prepared.client.receive(late);await client.receive(late);await new Promise(r=>setImmediate(r));assert.equal(surface.preparedScreenSnapshot.content,fresh.content);assert.equal(raster.authorOwner,newOwner);assert.equal(newOwner.canonicalSource.fence,source.fence);assert.notEqual(newOwner,owner);assert.equal(ports.filter(p=>!p.terminated).length,1);assert.equal(surface.terrainRay([[128,128,100],[128,128,-200]]).point[2],17);assert.deepEqual(errors,[]);
});

test('unknown accepted48 keeps49 immutable and explicit real receipt clarification never replays writes',async t=>{
 const f=await preparedRasterFixture(t),{raster,owner,ports,errors}=f,s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 let release;const original=f.env.window.campaign.executeAtlasCommit;f.env.window.campaign.executeAtlasCommit=async c=>{await new Promise(r=>{release=r;});await original(c);return{ok:false,errorKind:'store-outcome-unknown',error:'receipt transport deliberately lost after commit'};};
 owner.begin('accepted48',s);const first=owner.close('accepted48');first.catch(()=>{});owner.begin('accepted49',{...s,strength:80});const second=owner.close('accepted49');second.catch(()=>{});const entries=owner.journal.entries,held49=entries[1],bytes49=JSON.stringify(held49);f.ui.strokeOwner=f.token;f.ui.strokeQueue=owner.queue;
 await untilPrepared(()=>!!release);release();const outcomes=await Promise.allSettled([first,second]);assert(outcomes.every(r=>r.status==='rejected'));assert.equal(f.writes.length,1);assert.equal(owner.journal.size,2);assert.equal(owner.journal.entries[1],held49);assert.equal(JSON.stringify(held49),bytes49);assert.equal(owner.failed,true);assert.equal(raster.ready,false);assert.equal(raster.heldAcceptedInput,true);assert(preparedAPI.pendingAtlasWrite(f.token));
 const before=ports[0].messages.filter(m=>m.kind==='replay').length,status=await preparedAPI.recoverAtlasCommit(f.token);assert.equal(status.ok,true);assert.equal(status.value.outcome,'applied');assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);assert.equal(f.writes.length,1);assert.equal(owner.journal.entries[1],held49);assert.equal(JSON.stringify(held49),bytes49);assert.equal(ports[0].messages.filter(m=>m.kind==='replay').length,before);assert.equal(f.store.atlasHeight(f.token,{x:128,y:128}).heightM,300);
 raster.stopModels();await raster.retirement;raster.show();assert.equal(raster.authorOwner,owner);assert.equal(raster.heldAcceptedInput,true);assert.equal(ports.length,1);assert.equal(ports[0].terminated,true);assert.equal(raster.prepared,null);assert(errors.some(e=>String(e).includes('receipt transport deliberately lost')));
});

test('UI Undo and Redo replace the canonical terrain only after accepted height work drains',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,ui,store,token,surface,ports,errors}=f;
 const s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 raster.gesture(true);raster.beginHeight('history-height',s);await untilPrepared(()=>owner.snapshot.active&&!f.client.diagnostics.flight);await ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke:s},'history-height');raster.gesture(false);
 assert.equal(store.atlasHeight(token,{x:128,y:128}).heightM,300);assert.equal(owner.journal.size,0);
 ui.regions.projection.geometry={...ui.regions.projection.geometry,drawing:{hiddenRooms:[],elements:[]}};ui.opts.flush=async()=>true;ui.opts.updated=async()=>{};f.env.window.campaign.workspaceInitial=async()=>({ok:true,value:store.workspace()});
 const observed=new Set(),settled=[];const install=surface.setPreparedTerrain.bind(surface);surface.setPreparedTerrain=(...args)=>{const current=raster.prepared?.client;if(current&&!observed.has(current)){observed.add(current);current.observeSettled((screen,binding)=>settled.push({client:current,screen,binding}));}return install(...args);};
 const completeSource=source=>{
  const session=raster.prepared,current=session?.client,screen=surface.preparedScreenSnapshot,field=surface.terrainDrawn?.field,submission=field?.prepared?.submission;
  if(!session||!screen||!submission)return false;
  const port=ports.find(port=>!port.terminated),dispatch=port?.messages.find(message=>(message.kind==='prepare'||message.kind==='draft')&&message.capture.id===submission.capture.id&&message.epoch===submission.expected.epoch&&message.job===submission.expected.job);
  const sameSource=value=>value?.token===source.token&&value.fence===source.fence&&value.revision===source.revision;
  return !!dispatch&&dispatch.capture.owner===session.author.snapshot.owner&&dispatch.capture.editSeries===session.author.snapshot.series&&sameSource(dispatch.capture.source)&&dispatch.capture.prefix===0&&dispatch.capture.suffix.length===0&&dispatch.capture.active===null&&JSON.stringify(screen.basis)===JSON.stringify(submission.result.basis)&&screen.draftRevision===submission.result.draftRevision&&sameSource(submission.expected.target)&&sameSource(session.author.canonicalSource)&&screen.endFrame&&screen.alpha===1&&(field.endFrameDraws??field.geometry.draws).every(draw=>draw.oldSlot<0)&&raster.ready&&!current.diagnostics.flight&&!current.diagnostics.latest&&!current.diagnostics.control&&current.inventoryEqual(current.acknowledged,current.inventory())&&!session.escape&&!session.restoring&&!surface.preparedEscape&&!surface.preparedRestorePending&&f.events.some(event=>event.kind==='stream-publish'&&event.query.token===source.token&&event.query.fence===source.fence&&event.query.revision===source.revision&&f.events.some(returned=>returned.kind==='stream-return'&&returned.serial===event.serial))&&f.events.some(event=>event.kind==='install-return'&&event.expected.epoch===submission.expected.epoch&&event.expected.job===submission.expected.job&&event.capture.id===submission.capture.id)&&settled.some(event=>event.client===current&&event.screen&&event.screen.content===screen.content&&event.screen.draftRevision===screen.draftRevision&&JSON.stringify(event.screen.basis)===JSON.stringify(screen.basis)&&event.binding.epoch===submission.expected.epoch&&event.binding.job===submission.expected.job);
 };
 await ui.history('undo');assert.equal(store.atlasHeight(token,{x:128,y:128}).heightM,-100);const undoSource=store.atlasRegionSource(token);await untilPrepared(()=>errors.length||completeSource(undoSource));assert.deepEqual(errors,[]);assert.equal(completeSource(undoSource),true);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],0);assert.equal(ports.filter(p=>!p.terminated).length,1);assert.notEqual(raster.authorOwner,owner);
 await ui.history('redo');assert.equal(store.atlasHeight(token,{x:128,y:128}).heightM,300);const redoSource=store.atlasRegionSource(token);await untilPrepared(()=>errors.length||completeSource(redoSource));assert.deepEqual(errors,[]);assert.equal(completeSource(redoSource),true);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],300);assert.equal(ports.filter(p=>!p.terminated).length,1);assert.deepEqual(f.writes.map(c=>c.action.kind),['landscape-height-stroke','undo','redo']);assert.deepEqual(errors,[]);
});

test('both production packed pickers and cursor use the confirmed draft instead of analytic height',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,surface,deck,client,ports,errors}=f,s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};
 const activeScreen=strength=>{const submission=surface.terrainDrawn?.field?.prepared?.submission;return !!(submission&&ports[0].messages.some(message=>message.kind==='draft'&&message.epoch===submission.expected.epoch&&message.job===submission.expected.job&&message.capture.id===submission.capture.id&&message.capture.owner===owner.snapshot.owner&&message.capture.editSeries===owner.snapshot.series&&message.capture.active?.id==='picker-draft'&&message.capture.active.stroke.strength===strength&&message.capture.draftRevision===submission.result.draftRevision));};
 raster.input.getBoundingClientRect=()=>({left:0,top:0});raster.height=()=>{throw Error('analytic height must not replace confirmed packed terrain');};
 const label=f.env.document.createElement('span');label.id='land-cursor-height';f.env.document.body.append(label);
 raster.gesture(true);raster.beginHeight('picker-draft',s);await untilPrepared(()=>errors.length||owner.snapshot.active&&activeScreen(400)&&!client.diagnostics.flight);assert.deepEqual(errors,[]);
 await untilPrepared(()=>surface.frameUsable);f.pause();const screen=surface.preparedScreenSnapshot,segment=surface.frame.ray({x:320,y:240}),packed=surface.terrainRay(segment);assert(packed);assert.equal(Math.fround(packed.point[2]),300);
 deck.pickResult={picked:true,index:0,layer:{id:surface.terrainSnapshot.field.layerId}};const gpu=surface.pick(320,240),cpu=raster.navigationPoint({clientX:320,clientY:240});assert.equal(gpu.point.heightM,packed.point[2]);assert.equal(cpu.heightM,packed.point[2]);assert.equal(cpu.x,gpu.point.x);assert.equal(cpu.y,gpu.point.y);raster.refreshBrushCursor(320,240);assert.equal(label.textContent,'Höhe: 984 ft');
 f.pause();raster.previewHeight({...s,strength:500});await untilPrepared(()=>raster.prepared.diagnostics.applying&&!raster.prepared.diagnostics.applying.drawn);assert.equal(surface.preparedScreenSnapshot,screen);assert.equal(surface.pick(320,240),null,'GPU picking waits for current frame props; CPU frozen ray remains on confirmed A');assert.equal(raster.navigationPoint({clientX:320,clientY:240}).heightM,packed.point[2]);f.draw();await untilPrepared(()=>!client.diagnostics.flight);f.draw();deck.pickResult={picked:true,index:0,layer:{id:surface.terrainSnapshot.field.layerId}};assert.equal(activeScreen(500),true);assert.equal(Math.fround(surface.pick(320,240).point.heightM),400);assert.equal(raster.navigationPoint({clientX:320,clientY:240}).heightM,surface.pick(320,240).point.heightM);assert.deepEqual(errors,[]);
});


test('gesture dispatch binds nonzero sea water view and selected coast land through its own receipt',async t=>{
 const f=await preparedRasterFixture(t,{seaLevelM:17,landColor:'#ff0000'}),{raster,owner,ports,surface,client,errors}=f;
 const view={box:{x:0,y:0,width:256,height:256},frame:{x:0,y:0,width:256,height:256},columns:65,rows:65,focusM:17,tilt:45,rotation:0,exaggeration:1},s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}],visibility:view};
 raster.gesture(true);raster.beginHeight('bound-coast-A',s);const context=owner.active.visibility;assert(context);assert.equal(context.sources[0].seaLevelM,17);assert(context.sources[0].water.every(v=>v===17));const water=context.sources[0].water,source=structuredClone(context.source);view.tilt=0;assert.equal(owner.active.action.stroke.visibility.tilt,45);
 await untilPrepared(()=>errors.length||owner.snapshot.active?.id==='bound-coast-A'&&surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight);assert.deepEqual(errors,[]);const dispatch=ports[0].messages.filter(m=>m.kind==='draft').at(-1);assert.equal(dispatch.capture.landColor,'#ff0000');assert.equal(dispatch.frozen.basis.generation,surface.preparedScreenSnapshot.basis.generation);
 const live=structuredClone(owner.active.action.stroke);await f.ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke:live},'bound-coast-A');raster.gesture(false);assert.equal(f.writes.length,1);assert.equal(owner.snapshot.source.revision,source.revision+1);assert.equal(water,context.sources[0].water);assert(water.every(v=>v===17));assert.deepEqual(context.source,source);assert.equal(f.writes[0].action.stroke.visibility.tilt,45);assert.deepEqual(errors,[]);
});

async function unknownPreparedPair(t,{applied=true,lifecycle=false}={}){
 const f=await preparedRasterFixture(t,{lifecycle}),{raster,owner,ui,client,surface}=f,s={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]};let release;
 const original=f.env.window.campaign.executeAtlasCommit;f.env.window.campaign.executeAtlasCommit=async c=>{if(c.terrainStroke?.id==='accepted48'){await new Promise(r=>{release=r;f.writerReleases.push(r);});if(applied)await original(c);return{ok:false,errorKind:'store-outcome-unknown',error:'receipt48 transport deliberately lost after commit'};}return original(c);};
 f.env.window.campaign.reconcileAtlasCommit=async c=>({ok:true,value:f.store.reconcileAtlasCommit(c)});f.env.window.campaign.atlasTerrainSource=async()=>{const s=f.store.atlasRegionSource(f.token);return{ok:true,value:{revision:s.revision,fence:s.fence}};};f.env.window.campaign.workspaceInitial=async()=>({ok:true,value:f.store.workspace()});ui.opts.updated=async()=>{};ui.landscape.recovered=()=>{};
 f.env.window.HTMLElement.prototype.showModal=function(){this.open=true;};
 raster.gesture(true);raster.beginHeight('accepted48',s);await untilPrepared(()=>owner.snapshot.active?.id==='accepted48'&&!client.diagnostics.flight);const first=ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke:s},'accepted48');first.catch(()=>{});f.pendingOperations.push(first);raster.gesture(false);await untilPrepared(()=>!!release);
 raster.gesture(true);raster.beginHeight('accepted49',{...s,strength:80});await untilPrepared(()=>owner.snapshot.active?.id==='accepted49'&&!client.diagnostics.flight);const second=ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke:{...s,strength:80}},'accepted49');second.catch(()=>{});f.pendingOperations.push(second);raster.gesture(false);const held=owner.journal.entries,bytes=JSON.stringify(held[1]);release();await Promise.allSettled([first,second]);await untilPrepared(()=>!client.diagnostics.flight&&!client.diagnostics.control);assert.equal(f.writes.length,applied?1:0);assert.equal(owner.journal.entries[1],held[1]);assert.equal(JSON.stringify(held[1]),bytes);assert.equal(owner.failed,true);assert(f.errors.every(e=>String(e).includes('receipt48 transport')));f.errors.length=0;return{...f,held,bytes,s,original};
}

test('real UI receipt recovery adopts48 and writes the identical49 once with the same author and worker',async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,raster,client,surface,ports,errors}=f;
 const recovery=ui.recoverWrite();assert.equal(ui.recoverWrite(),recovery,'double click shares the same recovery completion');await recovery;
 assert.deepEqual(errors,[]);assert.equal(f.writes.length,2);assert.deepEqual(f.writes.map(c=>c.terrainStroke.id),['accepted48','accepted49']);assert.equal(JSON.stringify(f.held[1]),f.bytes);assert.equal(owner.journal.size,0);assert.equal(owner.journal.prefix,2);assert.equal(owner.failed,false);assert.equal(raster.authorOwner,owner);assert.equal(raster.prepared.client,client);assert.equal(ports.length,1);assert.equal(ports[0].terminated,false);assert.equal(f.store.atlasHeight(f.token,{x:128,y:128}).heightM,380);
 const records=new Map();for(const command of f.writes)for(const record of preparedAPI.applyTerrainBrush([...records.values()],command.action.stroke,undefined,undefined,undefined,true))records.set(record.id,record);const normalize=heights=>heights.map(h=>({x:h.x,y:h.y,pixel:h.pixel,version:h.version,data:h.data})).sort((a,b)=>a.pixel-b.pixel||a.y-b.y||a.x-b.x),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');const expected=hash(normalize([...records.values()].map(r=>r.height))),actual=hash(normalize(f.store.db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL").all(f.campaign.id).map(r=>JSON.parse(r.payload).height)));assert.equal(actual,expected);
 await untilPrepared(()=>errors.length||surface.preparedScreenSnapshot.draftRevision===owner.snapshot.content&&!client.diagnostics.flight&&!client.diagnostics.control);assert.deepEqual(errors,[]);assert.equal(raster.ready,true);raster.gesture(true);raster.beginHeight('after-recovery',{...f.s,strength:20});assert.equal(owner.active.id,'after-recovery');await raster.prepared.cancel();raster.gesture(false);assert.equal(f.writes.length,2);console.log('E_RECOVERY_PASS',JSON.stringify({writes:f.writes.map(c=>({id:c.commandId,gesture:c.terrainStroke.id})),canonicalHeightHash:actual,owner:owner.snapshot.owner,worker:client.epoch}));
});

test('receipt checkpoint failure preserves the original binding and a second UI clarification resumes the same suffix',async t=>{
 const f=await unknownPreparedPair(t),{owner,ui,errors}=f,before=owner.snapshot,original=f.env.window.campaign.atlasAuthorCheckpoint;let fail=true;
 f.env.window.campaign.atlasAuthorCheckpoint=async(t,q)=>{if(q.prefix===1&&fail){fail=false;return{ok:false,error:'checkpoint48 read deliberately unavailable'};}return original(t,q);};await ui.recoverWrite();assert.equal(f.writes.length,1);assert.equal(owner.snapshot,before);assert.equal(owner.journal.entries[0],f.held[0]);assert.equal(owner.journal.entries[1],f.held[1]);assert.equal(owner.journal.prefix,0);assert.equal(owner.failed,true);assert(preparedAPI.pendingAtlasWrite(f.token));assert(errors.some(e=>String(e).includes('checkpoint48 read')));errors.length=0;
 await ui.recoverWrite();assert.deepEqual(errors,[]);assert.equal(f.writes.length,2);assert.equal(owner.journal.prefix,2);assert.equal(owner.journal.size,0);assert.equal(f.ports.length,1);assert.equal(f.raster.authorOwner,owner);
});

test('foreign canonical commit holds49 through Cancel then explicit bound discard loads the current map',async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,raster,errors}=f,ack=f.store.executeAtlasCommit({commandId:crypto.randomUUID(),token:f.token,campaignId:f.campaign.id,action:{kind:'landscape-sea-level',seaLevelM:17}});f.env.document.dispatchEvent(new PreparedDOMEvent('atlas-invalidated',{detail:ack}));await raster.retirement;
 await ui.recoverWrite();assert.deepEqual(errors,[]);assert.equal(f.writes.length,1);const button=f.env.document.getElementById('atlas-terrain-recovery-conflict');assert(button);assert.match(button.textContent,/1 ungespeicherte/);assert.equal(owner.journal.entries[1],f.held[1]);button.click();f.env.document.querySelector('dialog [data-cancel]').click();await ui.terrainDiscardTask;assert.equal(owner.journal.entries[1],f.held[1]);assert(preparedAPI.pendingAtlasWrite(f.token));assert.equal(f.writes.length,1);
 const refresh=ui.regions.refresh;ui.regions.refresh=async()=>{await refresh();const source=f.store.atlasRegionSource(f.token),tile=preparedProductTile(source),q={token:f.token,fence:source.fence,revision:source.revision,owner:'conflict-source',series:0,request:1,prefix:0,box:{x:112,y:112,width:32,height:32},pixel:.25,lattices:f.client.lattices([tile])},ground=preparedAPI.readTerrainAuthorCheckpoint(f.store.db,source,q).ground[0].values;tile.terrain.projection.grid.seaLevelM=17;tile.terrain.projection.grid.editing.water.fill(17);tile.terrain.projection.grid.editing.ground=Float32Array.from(ground);tile.terrain.projection.grid.heights=Float32Array.from(ground,h=>Math.max(17,h));Object.assign(raster,{revision:source.revision,fence:source.fence,targetTiles:[tile],request:'resolved-foreign'});raster.show();await untilPrepared(()=>raster.prepared&&!raster.prepared.client.diagnostics.flight&&raster.ready);return true;};
 button.click();f.env.document.querySelector('dialog [data-discard]').click();await ui.terrainDiscardTask;assert.deepEqual(errors,[]);assert.equal(owner.journal.size,0);assert.equal(f.writes.length,1);assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);assert.notEqual(raster.authorOwner,owner);assert.equal(f.ports.filter(p=>!p.terminated).length,1);assert.equal(raster.ready,true);assert.equal(f.store.atlasHeight(f.token,{x:128,y:128}).heightM,300);assert.equal(f.surface.terrainRay([[128,128,500],[128,128,-500]]).point[2],300);
});

test('a later Unknown49 is never discarded by a stale48 recovery action and its own receipt resumes editing',async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,errors}=f;f.env.window.campaign.executeAtlasCommit=async c=>{await f.original(c);return{ok:false,errorKind:'store-outcome-unknown',error:'receipt49 transport deliberately lost after commit'};};await ui.recoverWrite();const old=ui.terrainRecoveryContext;assert(old);assert.equal(owner.journal.prefix,1);assert.equal(owner.journal.size,1);assert.equal(owner.journal.entries[0],f.held[1]);assert.equal(f.writes.length,2);assert(errors.some(e=>String(e).includes('receipt49 transport')));errors.length=0;
 const stale=ui.discardTerrainRecovery(old,[f.held[1]]);f.env.document.querySelector('dialog [data-discard]').click();await stale;assert.equal(owner.journal.size,1);assert.equal(owner.journal.entries[0],f.held[1]);assert.equal(f.writes.length,2);assert(errors.some(e=>String(e).includes('geändert')));errors.length=0;
 await ui.recoverWrite();assert.deepEqual(errors,[]);assert.equal(owner.journal.size,0);assert.equal(owner.journal.prefix,2);assert.equal(f.writes.length,2);assert.equal(f.raster.authorOwner,owner);assert.equal(f.ports.length,1);assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);
});

for(const change of ['dispose','external'])test(`a late receipt clarification after ${change} cannot adopt48 or dispatch49`,async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,raster,errors}=f;let release;const original=f.env.window.campaign.reconcileAtlasCommit;f.env.window.campaign.reconcileAtlasCommit=async c=>{const result=await original(c);await new Promise(r=>{release=r;});return result;};const recovery=ui.recoverWrite();await untilPrepared(()=>!!release);
 if(change==='dispose'){raster.active=false;raster.stopModels();await raster.retirement;}else{const ack=f.store.executeAtlasCommit({commandId:crypto.randomUUID(),campaignId:f.campaign.id,token:f.token,action:{kind:'landscape-sea-level',seaLevelM:17}});f.env.document.dispatchEvent(new PreparedDOMEvent('atlas-invalidated',{detail:ack}));await raster.retirement;}
 const head=owner.journal.entries[0],suffix=owner.journal.entries[1];release();await recovery;assert.equal(f.writes.length,1);assert.equal(owner.journal.entries[0],head);assert.equal(owner.journal.entries[1],suffix);assert.equal(owner.journal.prefix,0);assert.equal(f.ports.length,1);assert.equal(f.ports[0].terminated,true);assert(preparedAPI.pendingAtlasWrite(f.token));assert(errors.some(e=>String(e).includes('inzwischen geändert')));
});

test('an old foreign-source discard dialog cannot affect49 after another source change',async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,raster,errors}=f;const foreign=seaLevelM=>{const ack=f.store.executeAtlasCommit({commandId:crypto.randomUUID(),token:f.token,campaignId:f.campaign.id,action:{kind:'landscape-sea-level',seaLevelM}});f.env.document.dispatchEvent(new PreparedDOMEvent('atlas-invalidated',{detail:ack}));};foreign(17);await raster.retirement;await ui.recoverWrite();f.env.document.getElementById('atlas-terrain-recovery-conflict').click();const dialog=f.env.document.querySelector('dialog');foreign(18);dialog.querySelector('[data-discard]').click();await ui.terrainDiscardTask;assert.equal(f.writes.length,1);assert.equal(owner.journal.entries[1],f.held[1]);assert.equal(owner.journal.size,2);assert(preparedAPI.pendingAtlasWrite(f.token));assert(errors.some(e=>String(e).includes('geändert')));
});

test('failed conflict reload reports already-discarded input honestly and the same UI action can retry only the view',async t=>{
 const f=await unknownPreparedPair(t),{ui,owner,raster,errors}=f,ack=f.store.executeAtlasCommit({commandId:crypto.randomUUID(),campaignId:f.campaign.id,token:f.token,action:{kind:'landscape-sea-level',seaLevelM:17}});f.env.document.dispatchEvent(new PreparedDOMEvent('atlas-invalidated',{detail:ack}));await raster.retirement;await ui.recoverWrite();ui.regions.refresh=async()=>false;f.env.document.getElementById('atlas-terrain-recovery-conflict').click();f.env.document.querySelector('dialog [data-discard]').click();await ui.terrainDiscardTask;assert.equal(owner.journal.size,0);assert.equal(f.writes.length,1);assert(ui.terrainRecoveryReload);assert(errors.some(e=>String(e).includes('ausdrücklich verworfen')));assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);errors.length=0;ui.regions.refresh=async()=>true;await ui.recoverWrite();assert.equal(ui.terrainRecoveryReload,null);assert.equal(f.writes.length,1);assert.deepEqual(errors,[]);assert.match(f.env.document.getElementById('atlas-save-status').textContent,/1 ungespeicherte Folgezüge verworfen/);
});


test('not-applied48 and never-written49 survive Cancel then explicit discard reopens usable terrain with zero writes',async t=>{
 const f=await unknownPreparedPair(t,{applied:false}),{ui,owner,raster,errors}=f;await ui.recoverWrite();assert.deepEqual(errors,[]);assert.equal(f.writes.length,0);assert.match(f.env.document.getElementById('atlas-save-status').textContent,/Keiner dieser Züge wurde gespeichert/);const button=f.env.document.getElementById('atlas-terrain-recovery-conflict');assert.match(button.textContent,/2 ungespeicherte/);button.click();f.env.document.querySelector('dialog [data-cancel]').click();await ui.terrainDiscardTask;assert.deepEqual(owner.journal.entries,f.held);assert(preparedAPI.pendingAtlasWrite(f.token));
 ui.regions.refresh=async()=>{const source=f.store.atlasRegionSource(f.token);ui.regions.projection.region={...ui.regions.projection.region,revision:source.revision,fence:source.fence};Object.assign(raster,{revision:source.revision,fence:source.fence,targetTiles:[preparedProductTile(source)],request:'not-applied-reload'});raster.show();await untilPrepared(()=>raster.prepared&&!raster.prepared.client.diagnostics.flight&&raster.ready);return true;};button.click();const discard=ui.terrainDiscardTask;button.click();assert.equal(ui.terrainDiscardTask,discard);f.env.document.querySelector('dialog [data-discard]').click();await discard;assert.deepEqual(errors,[]);assert.equal(f.writes.length,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,0);assert.equal(owner.journal.size,0);assert.notEqual(raster.authorOwner,owner);assert.equal(raster.ready,true);raster.gesture(true);raster.beginHeight('after-not-applied',f.s);assert.equal(raster.authorOwner.active.id,'after-not-applied');await raster.prepared.cancel();raster.gesture(false);assert.equal(f.writes.length,0);assert.equal(f.ports.filter(p=>!p.terminated).length,1);assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);assert.match(f.env.document.getElementById('atlas-save-status').textContent,/Keiner dieser Züge wurde gespeichert/);
});

for(const outcome of ['applied','unknown','stale'])test(`not-applied discard cannot mutate captures when ${outcome} changes during Clear`,async t=>{
 const f=await unknownPreparedPair(t,{applied:false}),{ui,owner,raster,errors}=f;await ui.recoverWrite();const originalCommand=structuredClone(preparedAPI.pendingAtlasWrite(f.token)),clear=f.env.window.campaign.clearAtlasWriteReference;let release;f.env.window.campaign.clearAtlasWriteReference=async(...args)=>{const result=await clear(...args);if(outcome==='applied')f.store.executeAtlasCommit(originalCommand);else if(outcome==='unknown')f.env.window.campaign.reconcileAtlasCommit=async()=>({ok:true,value:{outcome:'unknown'}});else await new Promise(r=>{release=r;});return result;};f.env.document.getElementById('atlas-terrain-recovery-conflict').click();f.env.document.querySelector('dialog [data-discard]').click();const task=ui.terrainDiscardTask;if(outcome==='stale'){await untilPrepared(()=>!!release);raster.active=false;raster.stopModels();await raster.retirement;release();}await task;assert.equal(f.writes.length,0);assert.deepEqual(owner.journal.entries,f.held);assert.equal(owner.journal.prefix,0);assert.equal(owner.failed,true);assert(preparedAPI.pendingAtlasWrite(f.token));assert(errors.some(e=>/geändert|ungeklärt/.test(String(e))));assert.equal(f.store.atlasHeight(f.token,{x:128,y:128}).heightM,outcome==='applied'?300:-100);
});

test('recovery completion cannot release the UI write fence or refresh over a newer accepted follow-up write',async t=>{
 const f=await unknownPreparedPair(t,{lifecycle:true}),{ui,raster,owner,client,surface,ports,errors}=f;let release49,release50,command50,refreshes=0;
 const target=source=>source?{token:source.token,fence:source.fence,revision:source.revision}:null;
 const dump=f.dump;
 let completion=null;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 // Data delivery and displayed completeness are independent: an older basis
 // with the exact cumulative draft is valid even before the final tile arrives.
 const finalDelivery=()=>completion&&f.events.some(event=>event.kind==='stream-publish'&&event.query.token===completion.source.token&&event.query.fence===completion.source.fence&&event.query.revision===completion.source.revision&&event.request.source===completion.source.fence&&event.request.revision===completion.source.revision&&f.events.some(load=>load.kind==='stream-load'&&load.serial===event.serial&&same(load.request,event.request))&&f.events.some(returned=>returned.kind==='stream-return'&&returned.serial===event.serial));
 const completeCapture=submission=>{
  if(!completion)return false;
  const dispatch=ports[0].messages.find(message=>(message.kind==='prepare'||message.kind==='draft')&&message.capture.id===submission.capture.id&&Object.entries(submission.expected).every(([key,value])=>same(message[key],value)));
  if(!dispatch)return false;
  const capture=dispatch.capture,prefix=capture.prefix;
  return capture.owner===completion.owner&&capture.editSeries===completion.series&&Number.isInteger(prefix)&&prefix>=0&&prefix<=completion.prefix&&same(target(capture.source),completion.prefixSources[prefix])&&same(target(dispatch.target),completion.prefixSources[prefix])&&capture.active===null&&same(capture.suffix,completion.captures.slice(prefix))&&capture.id===submission.result.captureId&&capture.editSeries===submission.result.editSeries&&capture.draftRevision===submission.result.draftRevision&&same(submission.capture,{id:capture.id,editSeries:capture.editSeries,draftRevision:capture.draftRevision});
 };
 const idleEnd=()=>{const screen=surface.preparedScreenSnapshot,session=raster.prepared,field=surface.terrainDrawn?.field,submission=field?.prepared?.submission;return !!(screen&&submission&&screen.endFrame&&screen.alpha===1&&(field.endFrameDraws??field.geometry.draws).every(draw=>draw.oldSlot<0)&&raster.ready&&session?.author===owner&&session.client===client&&!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&client.inventoryEqual(client.acknowledged,client.inventory())&&!session.escape&&!session.restoring&&!surface.preparedEscape&&!surface.preparedRestorePending&&finalDelivery()&&completeCapture(submission));};
 const assertUsable=label=>{assert.deepEqual(errors,[]);assert.equal(owner.failed,false);assert.equal(raster.authorOwner,owner);assert.equal(raster.prepared.client,client);assert.equal(ports.length,1);assert.equal(ports[0].terminated,false);assert.equal(idleEnd(),true,label);assert.equal(owner.queue.pending,0);assert.equal(preparedAPI.pendingAtlasWrite(f.token),null);const screen=surface.preparedScreenSnapshot,field=surface.terrainDrawn.field,submission=field.prepared.submission;assert.deepEqual(screen.basis,submission.result.basis);assert.equal(screen.draftRevision,submission.result.draftRevision);assert(f.events.some(event=>event.kind==='install-return'&&event.expected.job===submission.expected.job&&event.capture.id===submission.capture.id),'installation returned before the actual bound screen');assert(f.events.some(event=>event.kind==='screen'&&event.screen.content===screen.content&&event.screen.fieldState===screen.fieldState),'AfterRender emitted the exact screen');assert(f.events.some(event=>event.kind==='settled'&&event.screen&&event.screen.draftRevision===submission.result.draftRevision&&JSON.stringify(event.screen.basis)===JSON.stringify(screen.basis)&&event.binding.job===submission.expected.job&&event.binding.epoch===submission.expected.epoch),'bound apply reached settled');const hit=surface.terrainRay([[128,128,600],[128,128,-500]]);assert(hit);assert.equal(hit.point[2],400);return screen;};
 const baseRefresh=ui.regions.refresh;ui.regions.refresh=async(...args)=>{refreshes++;return baseRefresh(...args);};
 f.env.window.campaign.executeAtlasCommit=async command=>{f.events.push({kind:'writer-held',gesture:command.terrainStroke.id});await new Promise(resolve=>{f.writerReleases.push(resolve);if(command.terrainStroke.id==='accepted49')release49=resolve;else{release50=resolve;command50=structuredClone(command);}});return f.original(command);};
 try{
  const recovery=ui.recoverWrite();f.pendingOperations.push(recovery);await untilPrepared(()=>!!release49);dump('49-held');
  raster.gesture(true);raster.beginHeight('accepted50',{...f.s,strength:20});const third=ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke:{...f.s,strength:20}},'accepted50');third.catch(()=>{});f.pendingOperations.push(third);const entry50=owner.journal.entries.at(-1),bytes50=JSON.stringify(entry50);raster.gesture(false);release49();await untilPrepared(()=>!!release50);
  try{await recovery;assert.equal(owner.queue.pending,1);assert.equal(ui.writing,true,'old recovery cannot clear a newer dispatch fence');assert.equal(JSON.stringify(entry50),bytes50);assert.equal(owner.journal.entries[0],entry50);assert.equal(preparedAPI.pendingAtlasWrite(f.token).commandId,command50.commandId);assert.equal(ui.heightDispatch.commandId,command50.commandId);assert.equal(command50.terrainStroke.expectedRevision,2);assert.equal(command50.sourceFence,f.store.atlasRegionSource(f.token).fence);assert.equal(refreshes,0,'normal queue drain owns the later refresh');const held50=f.events.findIndex(event=>event.kind==='writer-held'&&event.gesture==='accepted50');assert(held50>=0);assert(!f.events.slice(held50).some(event=>event.kind==='stream-load'&&event.request.revision===2),'held writing50 blocks the R2 load');dump('50-held-after-recovery');}finally{release50();await third;}
  assert.equal(f.writes.length,3);assert.deepEqual(f.writes.map(command=>command.terrainStroke.id),['accepted48','accepted49','accepted50']);assert.equal(owner.journal.size,0);assert.equal(owner.journal.prefix,3);assert.equal(owner.failed,false);assert.deepEqual(errors,[]);
  // Freeze the acknowledged completion once; later lattice/content changes
  // and51 begin/cancel cannot move this three-capture reference.
  completion=structuredClone({owner:owner.snapshot.owner,series:owner.snapshot.series,content:owner.snapshot.content,prefix:owner.snapshot.prefix,source:target(owner.snapshot.source),prefixSources:[target(f.source),...f.writes.slice(1).map(command=>({token:f.token,fence:command.sourceFence,revision:command.terrainStroke.expectedRevision})),target(owner.snapshot.source)],captures:[...f.held,entry50].map(entry=>({id:entry.id,ordinal:entry.ordinal,stroke:entry.action.stroke}))});
  assert.deepEqual(completion.captures.map(entry=>entry.id),['accepted48','accepted49','accepted50']);assert.deepEqual(completion.captures.map(entry=>entry.ordinal),[1,2,3]);assert.equal(completion.prefix,3);console.log('E50_COMPLETION',JSON.stringify(completion));
  const records=new Map();for(const command of f.writes)for(const record of preparedAPI.applyTerrainBrush([...records.values()],command.action.stroke,undefined,undefined,undefined,true))records.set(record.id,record);const normalize=heights=>heights.map(h=>({x:h.x,y:h.y,pixel:h.pixel,version:h.version,data:h.data})).sort((a,b)=>a.pixel-b.pixel||a.y-b.y||a.x-b.x),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),expected=hash(normalize([...records.values()].map(record=>record.height))),actual=hash(normalize(f.store.db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL").all(f.campaign.id).map(row=>JSON.parse(row.payload).height)));assert.equal(actual,expected);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,3);console.log('E50_CANONICAL_HASH',JSON.stringify({expected,actual}));dump('50-receipt');
  await untilPrepared(()=>errors.length||idleEnd());const before51=assertUsable('complete actual400 endfield before51');const projected3=f.events.findIndex(event=>event.kind==='region-projected'&&event.source.revision===3);assert(projected3>=0,'the real projection fixture reached R3');assert(f.events.slice(projected3).some(event=>event.kind==='stream-load'&&event.request.revision===3),'R3 load follows the normal final region render');assert(f.events.some(event=>event.kind==='render-sync'&&event.reading),'the old projection renders while reading');dump('actual400-endframe');
  raster.gesture(true);raster.beginHeight('accepted51',{...f.s,strength:10});assert.equal(owner.active.id,'accepted51');const cancelled=raster.prepared.cancel();f.pendingOperations.push(cancelled);await cancelled;raster.gesture(false);
  await untilPrepared(()=>errors.length||idleEnd());const after51=assertUsable('actual400 restored endfield after51');assert.deepEqual(after51.basis,before51.basis);assert.equal(owner.active,null);assert.equal(owner.snapshot.active,null);assert.equal(owner.journal.size,0);assert.equal(owner.queue.pending,0);assert.equal(f.writes.length,3);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,3);assert.equal(client.diagnostics.flight,null);assert.equal(client.diagnostics.latest,null);assert.equal(client.diagnostics.control,null);dump('51-begin-cancel-settled');
  console.log('E50_LIFECYCLE_PASS',JSON.stringify({canonicalHash:actual,owner:owner.snapshot.owner,worker:client.epoch,screen:after51,oldEquality:after51.draftRevision===owner.snapshot.content}));
 }catch(error){dump('failure');throw error;}finally{for(const release of f.writerReleases)release();}
});


test('an unchanged finite preview discarded before dispatch is retried until its real draw and settled receipt',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,client,surface,ports,errors}=f,port=ports[0],submit=client.submit.bind(client),goals=[],done=[];let discarded=false;
 port.holdSettled=true;client.submit=goal=>{goals.push(goal);const result=submit(goal);void result.then(value=>done.push(value));if(goal.kind==='draft'&&!discarded){discarded=true;assert.equal(client.latest.goal,goal,'the real replay settle ack holds this field before dispatch');client.discardFieldLatest();port.releaseAcks();}return result;};
 raster.gesture(true);raster.beginHeight('finite-discard',{mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0},{x:128,y:128,t:1000}]});
 await untilPrepared(()=>errors.length||done.some(value=>value.outcome==='settled'));assert.deepEqual(errors,[]);const first=done.find(value=>value.outcome==='discarded'),last=done.find(value=>value.outcome==='settled');assert(first);assert(last);assert.equal(first.binding,null);assert.equal(first.goal.snapshot,last.goal.snapshot,'same immutable capture must be retried without pretending it was already drawn');assert.equal(goals.length,2);assert.equal(port.messages.filter(message=>message.kind==='draft').length,1);assert.equal(surface.preparedScreenSnapshot.draftRevision,last.capture.draftRevision);assert.equal(last.screen.content,surface.preparedScreenSnapshot.content);assert.equal(surface.terrainRay([[128,128,600],[128,128,-500]]).point[2],300);assert.equal(owner.active.id,'finite-discard');
 const cancelled=raster.prepared.cancel();raster.gesture(false);await cancelled;await untilPrepared(()=>!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&client.inventoryEqual(client.acknowledged,client.inventory()));assert.equal(owner.active,null);assert.equal(f.writes.length,0);assert.deepEqual(errors,[]);
});

test('pending Prepare hands a real one-point start to two controlled Surface draws during a fixed 300ms gesture',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,client,surface,ports,brush,errors,writes,store,campaign}=f,port=ports[0],session=raster.prepared;
 const startScreen=surface.preparedScreenSnapshot;assert(session.priorStateDrawn(startScreen));
 session.canonical(session.displayTiles,{...preparedAPI.DEFAULT_TERRAIN_STYLE},'EH-pending-prepare','EH-camera',true);assert.equal(client.flight.task.goal.kind,'prepare');
 const pending=client.flight.binding,deliver=port.onmessage;let heldCancel=null,acked=false;port.onmessage=event=>{if(event.data.kind==='cancelled'&&event.data.job===pending.job&&!acked){heldCancel=event;return;}deliver(event);};
 const begin=owner.begin.bind(owner);let cancelledBeforeAuthor=false;owner.begin=(...args)=>{cancelledBeforeAuthor=client.flight?.cancelling===true;return begin(...args);};
 const zero={mode:'raise',radius:16,strength:400,feather:0,samples:[{x:128,y:128,t:0}]};brush.maskStroke=structuredClone(zero);brush.maskStart=performance.now();brush.startLive();const aId=brush.liveId;
 assert(cancelledBeforeAuthor,'only the accepted height begin fences Prepare before author/visibility work');assert.equal(session.preview,null,'the confirmed unchanged source skips the empty t0 preview');assert.equal(owner.active.id,aId);
 const activeDraws=[];let released=false;client.observeSettled((screen,binding)=>{const request=port.messages.find(m=>m.kind==='draft'&&m.job===binding.job&&m.epoch===binding.epoch);if(!released&&screen&&request?.capture.active?.id===aId&&!activeDraws.some(d=>d.screen.content===screen.content)){assert(request.capture.active.stroke.samples.length>1);assert(request.capture.active.stroke.samples.at(-1).t>0);activeDraws.push({screen,binding,capture:request.capture.id,samples:request.capture.active.stroke.samples.length,lastT:request.capture.active.stroke.samples.at(-1).t});}});
 const ackTimer=setTimeout(()=>{assert(heldCancel);assert.equal(client.flight.binding.job,pending.job);assert.equal(port.messages.filter(m=>m.kind==='replay').length,0,'no new replay before the exact Cancel-ACK');acked=true;deliver(heldCancel);},20);t.after(()=>clearTimeout(ackTimer));
 const started=performance.now();await new Promise(resolve=>setTimeout(resolve,300));released=true;assert(acked);assert(activeDraws.length>=2,'two actual controlled Draw+settled receipts must arrive while input is still active');assert.equal(f.pointer,1);assert(brush.live);assert.deepEqual(errors,[]);
 const end=brush.endLiveInput.bind(brush);let finalStroke;brush.endLiveInput=()=>{end();if(brush.liveId===aId)finalStroke=structuredClone(brush.maskStroke);};const close=brush.finishLive();f.pointer=2;brush.maskStroke={...structuredClone(zero),strength:20};brush.maskStart=performance.now();brush.startLive();const bId=brush.liveId;
 assert.equal(raster.authorOwner,owner);assert.equal(raster.prepared.client,client);assert.equal(ports.length,1);assert.equal(owner.active.id,bId);await close;
 await untilPrepared(()=>errors.length||f.events.some(event=>event.kind==='settled'&&event.screen&&port.messages.some(m=>m.kind==='draft'&&m.epoch===event.binding.epoch&&m.job===event.binding.job&&m.capture.active?.id===bId)));assert.deepEqual(errors,[]);
 assert.equal(writes.length,1);assert.deepEqual(writes[0].action.stroke,finalStroke);assert.equal(writes[0].terrainStroke.id,aId);assert.equal(store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,1);
 const normalize=v=>v.map(h=>({x:h.x,y:h.y,pixel:h.pixel,version:h.version,data:h.data})).sort((a,b)=>a.pixel-b.pixel||a.y-b.y||a.x-b.x),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),expected=hash(normalize(preparedAPI.applyTerrainBrush([],finalStroke,undefined,undefined,undefined,true).map(r=>r.height))),actual=hash(normalize(store.db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL").all(campaign.id).map(r=>JSON.parse(r.payload).height)));assert.equal(actual,expected);
 await brush.finishLive(true);await untilPrepared(()=>errors.length||!owner.active&&!owner.queue.pending&&!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&!session.restoring&&!surface.preparedRestorePending&&!surface.preparedEscape);assert.deepEqual(errors,[]);assert.equal(owner.journal.size,0);
 console.log('EH_CONTROLLED_300MS',JSON.stringify({kind:'actual product classes with FakeDeck layer Draw/AfterRender, not GPU/native',requestedInputMs:300,elapsedToAssertionMs:performance.now()-started,prepare:pending,activeDraws,canonicalHash:actual,finalSamples:finalStroke.samples.length,lastT:finalStroke.samples.at(-1).t,writerReceipts:1,followingId:bId,sameAuthor:true,workerEpoch:client.epoch,workers:ports.length}));
});


test('t0 skip requires the complete endframe and never hides an unpainted own receipt or a one-point form',async t=>{
 const f=await preparedRasterFixture(t,{lifecycle:true}),{raster,owner,client,surface,ports,errors}=f,session=raster.prepared,screen=surface.preparedScreenSnapshot,port=ports[0];
 assert(session.priorStateDrawn(screen));
 const alpha=screen.alpha,endFrame=screen.endFrame;
 try{screen.alpha=.5;assert.equal(session.priorStateDrawn(screen),false);screen.alpha=1;screen.endFrame=false;assert.equal(session.priorStateDrawn(screen),false);}finally{screen.alpha=alpha;screen.endFrame=endFrame;}
 assert(session.priorStateDrawn(screen));
 const zero={mode:'raise',radius:16,strength:40,feather:0,samples:[{x:128,y:128,t:0}]};
 raster.gesture(true);raster.beginHeight('one-point-form',{...zero,form:'mountain'});assert(session.preview,'a one-point form must start a real preview even at t0');const formCancel=session.cancel();f.pendingOperations.push(formCancel);await formCancel;raster.gesture(false);
 await untilPrepared(()=>errors.length||!client.diagnostics.flight&&!client.diagnostics.latest&&!client.diagnostics.control&&!session.restoring&&!surface.preparedRestorePending);assert.deepEqual(errors,[]);
 const beforeReceipt=surface.preparedScreenSnapshot;port.holdResults=true;const stroke={...zero,samples:[...zero.samples,{x:128,y:128,t:1000}]};raster.gesture(true);raster.beginHeight('receipt-undrawn',stroke);
 const close=f.ui.enqueueRasterStroke({kind:'landscape-height-stroke',stroke},'receipt-undrawn');f.pendingOperations.push(close);raster.gesture(false);await close;
 assert.equal(f.writes.length,1);assert.equal(owner.journal.size,0);assert.equal(owner.queue.pending,0);assert.equal(owner.snapshot.source.revision,1);const afterReceipt=surface.preparedScreenSnapshot;for(const key of ['content','fieldState','basis','draftRevision','alpha','endFrame'])assert.deepEqual(afterReceipt[key],beforeReceipt[key]);assert.equal(session.priorStateDrawn(afterReceipt),false,'an own receipt with no drawn final dose cannot skip t0');
 let refreshed=0;const refresh=session.refresh.bind(session);session.refresh=()=>{refreshed++;return refresh();};raster.gesture(true);raster.beginHeight('after-undrawn-receipt',zero);assert.equal(refreshed,1);assert(session.preview);session.refresh=refresh;
 port.holdResults=false;for(const value of port.heldResults.splice(0))port.onmessage?.({data:value});const cancel=session.cancel();f.pendingOperations.push(cancel);await cancel;raster.gesture(false);assert.deepEqual(errors,[]);
 console.log('EH_T0_GUARD',JSON.stringify({initialEndframe:true,intermediateRejected:true,materialPendingRejected:true,formPreview:true,receiptRevision:owner.snapshot.source.revision,writerReceipts:f.writes.length,undrawnReceiptRejected:true}));
});

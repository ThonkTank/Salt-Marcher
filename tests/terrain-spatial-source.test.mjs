import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-source';export * from './src/app/terrain-spatial-ui';export * from './src/app/terrain-detail-tiles';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-source-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainSourceWindow,TerrainSpatialUI,TerrainDetailTiles}=createRequire(import.meta.url)('../.build/terrain-spatial-source-test.cjs');
const frame={x:-200,y:-160,width:400,height:320};
const zoom=(factor,b=frame)=>({x:b.x+b.width*(1-factor)/2,y:b.y+b.height*(1-factor)/2,width:b.width*factor,height:b.height*factor});
test('one source lattice covers bounded pan/zoom, not a separate surface for every camera frame',()=>{
 for(const offset of [0,-1e10,1e10])for(const size of [.001,1,1e5]){
  const b={x:offset-200*size,y:-offset-160*size,width:400*size,height:320*size};
  const source=terrainSourceWindow(null,b,1000,800);
  for(const factor of [.81,1,1.24])assert.equal(terrainSourceWindow(source,zoom(factor,b),1000,800),source);
  for(const factor of [.79,1.26])assert.notEqual(terrainSourceWindow(source,zoom(factor,b),1000,800),source);
  assert.equal(terrainSourceWindow(source,{...b,x:b.x+199*size},1000,800),source);
  assert.notEqual(terrainSourceWindow(source,{...b,x:b.x+201*size},1000,800),source);
  assert.notEqual(terrainSourceWindow(source,b,1400,800),source,'pixel density matters even with the same world frame');
  assert.notEqual(terrainSourceWindow(source,{...b,height:b.height*1.3},1000,800),source,'portrait resize must refresh too');
 }
});
function fixture(t,{manualDetail=false,manualColor=false}={}){
 const prior={window:global.window,document:global.document,Worker:global.Worker};t.after(()=>Object.assign(global,prior));
 const {window,document}=parseHTML('<html><body><input id="atlas-perception"><input id="land-radius" value="10"><p id="land-status"></p></body></html>');Object.assign(global,{window,document});Object.defineProperty(document,'baseURI',{value:'https://atlas.invalid/'});
 const reads=[],colors=[],tiles=[],jobs=[],published=[],errors=[];
 window.campaign={atlasTerrainColor:(token,query)=>new Promise(resolve=>{const index=colors.length;colors.push({token,query,resolve});if(!manualColor)queueMicrotask(()=>resolveColor(index));}),atlasTerrainProjection:(token,query)=>new Promise(resolve=>{const index=reads.length;reads.push({token,query,resolve});if(query.width===512&&!manualDetail)queueMicrotask(()=>resolveRead(index));}),atlasMaskRegion(){throw Error('Navigation must not load canonical author records');}};
 global.Worker=class{postMessage(job){jobs.push({job:structuredClone(job),worker:this});}terminate(){this.terminated=true;}};
 const input={clientWidth:1000,clientHeight:800,dataset:{}};
 const ui=Object.assign(Object.create(TerrainSpatialUI.prototype),{
  active:true,ready:false,firstSurface:new Set(),input,colorTiles:new TerrainDetailTiles(),host:{live:()=>false,hasDraft:()=>false,selection:()=>null,tool:()=> 'height',writing:()=>false,draft:()=>null,error:e=>errors.push(e),redraw(){}},
  sourceWindow:null,source:'',requested:'',generation:0,busy:false,queued:false,lastDraft:'',lastSelection:'',baseline:null,
  loadBusy:false,worker:null,params:null,frame:null,records:[],samplePad:0,tilt:45,rotation:0,exaggeration:1,toggle:{},controls:{},retry:{},failed:false,canvas:null,
  view:{batch:update=>update(),setDetail:(detail,rects)=>tiles.push({detail,rects}),freezePicking(){},reframe(){},setVegetation(){},setContours(interval){this.interval=interval;},setData:data=>published.push(data),showSelection(){}},scheduleLoad(){},
 });
 const sync=(b=frame,revision=1,token='campaign',contours=0,objects=[])=>ui.sync(token,b,revision,objects,contours);
 const load=()=>ui.load(ui.requested,0);
 const resolveRead=(i=0,revision=reads[i].query.revision,extra={})=>reads[i].resolve({ok:true,value:{revision,fence:'source',generation:0,source:'source',grid:{view:reads[i].query.view,heights:new Float32Array(4),seaLevelM:0},pixels:new Uint8Array(16),width:2,height:2,draft:false,...extra}});

 const resolveColor=i=>{const q=colors[i].query;colors[i].resolve({ok:true,value:{...q,fence:q.fence??'source',pixels:new Uint8Array(q.width*q.height*4).fill(255)}});};
 return {ui,input,reads,colors,tiles,jobs,published,errors,sync,load,resolveRead,resolveColor};
}
test('camera pose can move while author writes remain fenced, without enabling terrain reads',async t=>{
 const f=fixture(t),fields={};f.sync();const loading=f.load();f.resolveRead();await loading;const reads=f.reads.length;
 f.ui.controls={querySelector:id=>fields[id]??={value:''}};f.ui.toggle={setAttribute(){}};
 f.ui.host.hasDraft=()=>true;f.ui.host.live=()=>true;f.ui.host.writing=()=>true;
 f.ui.setPose(30,20);assert.equal(f.ui.tilt,45,'legacy hosts keep the draft lock');
 f.ui.host.navigationLocked=()=>false;
 f.ui.setPose(30,20);assert.equal(f.ui.tilt,30);assert.equal(f.ui.rotation,20);
 assert.equal(f.ui.params.tilt,30);assert.equal(f.ui.params.rotation,20);
 assert.equal(f.ui.needsLoad(),false);assert.equal(f.ui.host.hasDraft(),true);
 f.ui.host.navigationLocked=()=>true;f.ui.setPose(60,50);assert.equal(f.ui.tilt,30);
 assert.equal(f.reads.length,reads);
});
test('pending bounded projection survives small camera gestures; the result uses the latest pose',async t=>{
 const f=fixture(t);f.sync();const key=f.ui.requested,loading=f.load();
 f.sync(zoom(.9));assert.equal(f.ui.requested,key);assert.equal(f.reads.length,1);
 f.ui.tilt=40;f.sync({...zoom(.9),x:-170});f.resolveRead();await loading;assert.equal(f.jobs.length,0);assert.equal(f.ui.ready,true);assert.equal(f.published.length,2);
 assert.equal(f.ui.visibility().tilt,40);assert.equal(f.ui.visibility().frame.x,-170);
 for(let i=0;i<50;i++)f.sync(zoom(.9+i*.001));
 assert.equal(f.jobs.length,0);assert.equal(f.reads.length,2);assert.equal(f.ui.ready,true);assert.deepEqual(f.errors,[]);
});
test('detail/coverage changes invalidate pending replies while canonical revision and context always invalidate reuse',async t=>{
 const f=fixture(t);f.sync();const first=f.load();
 f.sync(zoom(.7));assert.equal(f.ui.ready,false);f.resolveRead();await first;assert.equal(f.published.length,0);
 const second=f.load();f.resolveRead(1);await second;assert.equal(f.ui.ready,true);
 for(const [b,revision,token,contours] of [[zoom(.7),2,'campaign',0],[zoom(.7),2,'other',0],[{...zoom(.7),x:800},2,'other',50]]){
  const key=f.ui.requested;f.sync(b,revision,token,contours);assert.notEqual(f.ui.requested,key);assert.equal(f.ui.ready,false);
 }
});
test('source change during IPC discards the old campaign; record ordering does not discard a valid surface',async t=>{
 const f=fixture(t);f.sync();const first=f.load();f.sync(frame,1,'other');f.resolveRead();await first;assert.equal(f.jobs.length,0);
 const objects=[{kind:'road',id:'a',revision:0},{kind:'river',id:'b',revision:2}];
 f.sync(frame,1,'other',0,objects);const key=f.ui.requested;
 f.sync(frame,1,'other',0,[...objects].reverse());assert.equal(f.ui.requested,key);
 f.sync(frame,1,'other',0,[{...objects[0],revision:1},objects[1]]);assert.notEqual(f.ui.requested,key);
});

test('contour interval changes are immediate display changes without source reads or worker invalidation',async t=>{
 const f=fixture(t);f.sync();const loading=f.load();f.resolveRead();await loading;
 const key=f.ui.requested;for(const interval of [-1,100,0]){f.sync(frame,1,'campaign',interval);assert.equal(f.ui.view.interval,interval);}
 assert.equal(f.ui.requested,key);assert.equal(f.ui.ready,true);assert.equal(f.jobs.length,0);assert.equal(f.reads.length,2);
});
test('a late terrain reply cannot restore an earlier contour mode',async t=>{
 const f=fixture(t);f.sync();const loading=f.load(),key=f.ui.requested;
 f.ui.setContours(-1);assert.equal(f.ui.view.interval,-1);
 f.resolveRead();await loading;
 assert.equal(f.ui.view.interval,-1);assert.equal(f.ui.requested,key);assert.equal(f.reads.length,2);
});

test('overview becomes usable before detail; both stages retain identical geometry and latest camera',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'refining');assert(f.tiles.length>1);assert.equal(f.published.length,1);assert.equal(f.reads.length,2);
 assert.equal(f.reads[0].query.width,128);assert.equal(f.reads[0].query.detail,undefined);
 assert.deepEqual(f.reads[0].query.view,f.reads[1].query.view);assert.deepEqual(f.reads[0].query.objects,f.reads[1].query.objects);
 f.ui.tilt=40;f.sync(zoom(.9));f.ui.setContours(-1);f.resolveRead(1);await loading;
 assert.equal(f.input.dataset.terrainQuality,'detail');assert.equal(f.ui.visibility().tilt,40);assert.deepEqual(f.ui.visibility().frame,zoom(.9));assert.equal(f.ui.view.interval,-1);
});
test('a gesture revokes an in-flight detail even if it ends before that reply; refinement can resume',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 f.ui.gesture(true);f.ui.gesture(false);f.resolveRead(1);await loading;
 assert.equal(f.published.length,1);assert.equal(f.input.dataset.terrainQuality,'refining');assert.equal(f.ui.needsLoad(),true);
 const resumed=f.load();await new Promise(setImmediate);assert.equal(f.reads.length,3);assert.equal(f.reads[2].query.width,512,'resume only the missing context');f.resolveRead(2);await resumed;assert.equal(f.published.length,2);assert.equal(f.ui.needsLoad(),false);
});
test('navigation during refinement discards the old detail and prioritizes an overview of the new source',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 f.sync(zoom(.6));assert.equal(f.ui.ready,false);f.resolveRead(1);await loading;assert.equal(f.published.length,1);
 const next=f.load();assert.equal(f.reads[2].query.width,128);f.resolveRead(2);await new Promise(setImmediate);f.resolveRead(3);await next;
 assert.equal(f.published.length,3);assert.equal(f.ui.ready,true);
});
test('detail failure retains usable geometry and stops retries until an explicit retry or new source',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 f.reads[1].resolve({ok:false,error:'Detail worker failed'});await loading;
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'refining');assert.equal(f.published.length,1);assert.equal(f.ui.retry.hidden,false);assert.equal(f.ui.needsLoad(),false);assert.equal(f.errors.length,1);
});

test('navigation retains sharp world-anchored colour, but unconfirmed edits and campaign changes discard it',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const first=f.load();f.resolveRead();await new Promise(setImmediate);
 f.resolveRead(1);await first;const detail=f.ui.colorTiles.detail;
 f.sync(zoom(.6));const next=f.load();f.resolveRead(2);await new Promise(setImmediate);
 assert.equal(f.published.at(-1).detail,detail,'keep the same world texture while new detail is pending');f.resolveRead(3);await next;
 f.sync(zoom(.6),2);const edited=f.load();f.resolveRead(4,2);await new Promise(setImmediate);assert.equal(f.published.at(-1).detail,undefined,'old pigment cannot cover a changed revision');f.resolveRead(5,2);await edited;
 f.ui.colorTiles.detail=detail;f.sync(zoom(.6),2,'different');const switched=f.load();f.resolveRead(6,2);await new Promise(setImmediate);assert.equal(f.published.at(-1).detail,undefined,'campaign detail cannot leak');f.resolveRead(7,2);await switched;
});

test('expected worker preemption resumes missing detail without fallback or an error banner',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 f.reads[1].resolve({ok:false,error:'Geländeberechnung durch neuere Anfrage ersetzt.'});await loading;
 assert.equal(f.ui.ready,true);assert.equal(f.ui.needsLoad(),true);assert.deepEqual(f.errors,[]);
 const resumed=f.load();await new Promise(setImmediate);assert.equal(f.reads[2].query.width,512);f.resolveRead(2);await resumed;assert.equal(f.ui.needsLoad(),false);
});

test('stale source refresh blocks premature reads and then loads the latest revision',async t=>{
 const f=fixture(t,{manualDetail:true});let release,refreshes=0,scheduled=0;
 f.ui.host.refresh=()=>{refreshes++;return new Promise(resolve=>release=resolve);};f.ui.scheduleLoad=()=>scheduled++;
 f.sync();const loading=f.load();f.reads[0].resolve({ok:false,error:'Gelände inzwischen geändert. Ausschnitt erneut laden.'});await loading;
 assert.equal(refreshes,1);assert.equal(f.ui.needsLoad(),false);assert.equal(f.ui.ready,false);
 TerrainSpatialUI.prototype.scheduleLoad.call(f.ui,0);assert.equal(f.ui.loadTimer,undefined,'no old-source timer during refresh');
 f.sync(frame,2);const before=scheduled;assert.equal(f.ui.needsLoad(),false);
 release(true);await new Promise(setImmediate);assert.equal(scheduled,before+1);assert.equal(f.ui.needsLoad(),true);
 const current=f.load();assert.equal(f.reads[1].query.revision,2);f.resolveRead(1,2);await new Promise(setImmediate);f.resolveRead(2,2);await current;assert.equal(f.ui.ready,true);assert.deepEqual(f.errors,[]);
});

test('an overtaken refresh waits for its confirmed successor rather than re-reading old geometry',async t=>{
 const f=fixture(t,{manualDetail:true});f.ui.host.refresh=async()=>undefined;f.sync();
 const old=f.load();f.reads[0].resolve({ok:false,error:'Gelände inzwischen geändert.'});await old;await new Promise(setImmediate);
 assert.equal(f.ui.needsLoad(),false);TerrainSpatialUI.prototype.scheduleLoad.call(f.ui,0);assert.equal(f.ui.loadTimer,undefined);
 f.ui.sync('campaign',frame,2,[],0,{cities:[],entrances:[],bindings:[],region:{revision:2}});assert.equal(f.ui.needsLoad(),true);
 const latest=f.load();assert.equal(f.reads[1].query.revision,2);f.resolveRead(1,2);await new Promise(setImmediate);f.resolveRead(2,2);await latest;assert.equal(f.ui.ready,true);assert.deepEqual(f.errors,[]);
});


test('individual colour tiles appear before full detail and late gesture replies cannot paint',async t=>{
 const f=fixture(t,{manualColor:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'overview');assert.equal(f.colors.length,1);assert.equal(f.reads.length,1);
 f.resolveColor(0);await new Promise(setImmediate);assert.equal(f.tiles.length,1);assert.equal(f.input.dataset.terrainQuality,'refining');assert.equal(f.published.length,1,'colour must not republish mesh geometry');
 assert.equal(f.colors.length,2);f.ui.gesture(true);f.ui.gesture(false);f.resolveColor(1);await loading;
 assert.equal(f.tiles.length,1);assert.equal(f.reads.length,1);assert.equal(f.ui.needsLoad(),true);
});


test('a failed colour tile keeps earlier tiles usable and explicit retry starts with cached progress',async t=>{
 const f=fixture(t,{manualColor:true});f.sync();const loading=f.load();f.resolveRead();await new Promise(setImmediate);
 f.resolveColor(0);await new Promise(setImmediate);f.colors[1].resolve({ok:false,error:'Colour tile unavailable'});await loading;
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'refining');assert.equal(f.tiles.length,1);assert.equal(f.ui.retry.hidden,false);assert.equal(f.ui.needsLoad(),false);
 f.ui.detailSource='';const retry=f.load();await new Promise(setImmediate);assert.equal(f.colors.length,3);assert.deepEqual(f.colors[2].query.box,f.colors[1].query.box,'retry requests the failed tile, not the completed first tile');
 f.ui.gesture(true);f.resolveColor(2);await retry;assert.equal(f.errors.length,1);
});


test('post-edit overview and live frames preserve confirmed distant detail before any replacement tiles arrive',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const first=f.load();f.resolveRead();await new Promise(setImmediate);f.resolveRead(1);await first;
 const before=f.published.at(-1).detail,original=before.pixels.slice(),base={revision:1,fence:'source'};
 const bounds=[{x:before.box.x+before.box.width/2,y:before.box.y+before.box.height/2,width:1,height:1}];
 f.sync(frame,2);const second=f.load();assert.deepEqual(f.reads[2].query.colorBase,base);
 f.resolveRead(2,2,{colorChange:{base,invalidation:{reset:false,bounds}}});await new Promise(setImmediate);
 const early=f.published[2].detail;
 assert(early,'the overview must already carry retained sharp pixels');assert.notEqual(early,before);
 assert(early.coverage.values.some(v=>v===0));assert(early.coverage.values.some(v=>v===255));assert.deepEqual(before.pixels,original);
 f.resolveRead(3,2);await second;
 const retained=f.ui.colorTiles.detail;
 f.ui.presentLive({...f.ui.baseline,revision:3,fence:'live',colorChange:{base:{revision:2,fence:'source'},invalidation:{reset:false,bounds:[]}},detail:undefined});
 assert.equal(f.published.at(-1).detail,retained,'a live frame cannot drop unchanged viewport detail');
 const fresh={box:bounds[0],width:16,height:16,pixels:new Uint8Array(16*16*4).fill(127)},originalRetained=retained.pixels.slice();
 f.ui.presentLive({...f.ui.baseline,revision:4,fence:'next',colorChange:{base:{revision:3,fence:'live'},invalidation:{reset:false,bounds}},detail:fresh});
 const live=f.published.at(-1);
 assert.equal(live.brushDetail,fresh,'small confirmed patch goes directly to GPU composition');
 assert(live.detail.coverage.values.some(v=>v===0),'invalid fine pixels are not faked as loaded by CPU upsampling');
 assert(live.detail.coverage.values.some(v=>v===255),'distant current detail stays sharp');
 assert.deepEqual(retained.pixels,originalRetained,'earlier frames are immutable');
 assert.notEqual(live.detail,fresh,'brush pixels never replace the retained world image');
});

test('steep tilt replaces narrow pending coverage but later rotations retain the widened source',async t=>{
 const f=fixture(t);f.sync();const old=f.load(),width=f.reads[0].query.view.box.width;
 f.ui.tilt=75;f.sync();f.resolveRead();await old;assert.equal(f.published.length,0);
 const wide=f.load();assert(f.reads[1].query.view.box.width>width);
 const key=f.ui.requested;f.ui.rotation=120;f.sync();assert.equal(f.ui.requested,key);
 f.resolveRead(1);await wide;assert.equal(f.ui.ready,true);assert.equal(f.ui.visibility().rotation,120);
 f.ui.tilt=15;f.sync();assert.equal(f.ui.requested,key,'tilting back keeps the already available source');
});

test('a confirmed new frame reports graphics recovery once and never before publication',async t=>{
 const f=fixture(t),recovered=[];f.ui.failureMessage='graphics';f.ui.host.recovered=m=>recovered.push(m);
 f.sync();const loading=f.load();assert.deepEqual(recovered,[]);f.resolveRead();await loading;
 assert.deepEqual(recovered,['graphics']);assert.equal(f.ui.failureMessage,null);
});

test('opening waits only for the first usable terrain, not colour/detail or object geometry',async t=>{
 const f=fixture(t,{manualColor:true});let resolved=false;
 const opening=f.ui.openSurface('campaign',frame,1,0).then(value=>{resolved=value;});
 const loading=f.load();await new Promise(setImmediate);assert.equal(resolved,false);
 f.resolveRead();await opening;assert.equal(resolved,true);assert.equal(f.published.length,1);assert.equal(f.colors.length,1);
 assert.equal(f.ui.firstSurface.size,0);assert.equal(await f.ui.openSurface('campaign',frame,1,0),true);
 f.ui.gesture(true);f.resolveColor(0);await loading;
});
test('stale bootstrap hands back to the full region without recursively awaiting refresh',async t=>{
 const f=fixture(t);f.ui.host.refresh=()=>{throw Error('bootstrap must not recurse');};
 const opening=f.ui.openSurface('campaign',frame,1,0),loading=f.load();
 f.reads[0].resolve({ok:false,error:'Gelände inzwischen geändert. Ausschnitt erneut laden.'});
 assert.equal(await opening,false);await loading;assert.deepEqual(f.errors,[]);assert.equal(f.ui.firstSurface.size,0);assert.equal(f.ui.needsLoad(),false);
 f.ui.sync('campaign',frame,2,[],0,{cities:[],entrances:[],bindings:[],region:{revision:2}});assert.equal(f.ui.needsLoad(),true);
});
test('leaving the Atlas resolves bootstrap and a late terrain reply cannot publish',async t=>{
 const f=fixture(t);f.input.style={};f.ui.view.dispose=()=>{};
 const opening=f.ui.openSurface('campaign',frame,1,0),loading=f.load();f.ui.setActive(false);
 assert.equal(await opening,false);f.resolveRead();await loading;assert.equal(f.published.length,0);
});
test('bootstrap exceptions remove their waiter and rejected modes do not start a read',async t=>{
 const f=fixture(t);f.ui.sync=()=>{throw Error('init failure');};
 await assert.rejects(f.ui.openSurface('campaign',frame,1,0),/init failure/);assert.equal(f.ui.firstSurface.size,0);
 f.ui.failed=true;assert.equal(await f.ui.openSurface('campaign',frame,1,0),false);assert.equal(f.reads.length,0);
});

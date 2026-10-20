import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-source';export * from './src/app/terrain-spatial-ui';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-source-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainSourceWindow,TerrainSpatialUI}=createRequire(import.meta.url)('../.build/terrain-spatial-source-test.cjs');
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
function fixture(t,{manualDetail=false}={}){
 const prior={window:global.window,document:global.document,Worker:global.Worker};t.after(()=>Object.assign(global,prior));
 const {window,document}=parseHTML('<html><body><input id="atlas-perception"><input id="land-radius" value="10"><p id="land-status"></p></body></html>');Object.assign(global,{window,document});Object.defineProperty(document,'baseURI',{value:'https://atlas.invalid/'});
 const reads=[],jobs=[],published=[],errors=[];
 window.campaign={atlasTerrainProjection:(token,query)=>new Promise(resolve=>{const index=reads.length;reads.push({token,query,resolve});if(query.detail&&!manualDetail)queueMicrotask(()=>resolveRead(index));}),atlasMaskRegion(){throw Error('Navigation must not load canonical author records');}};
 global.Worker=class{postMessage(job){jobs.push({job:structuredClone(job),worker:this});}terminate(){this.terminated=true;}};
 const input={clientWidth:1000,clientHeight:800,dataset:{}};
 const ui=Object.assign(Object.create(TerrainSpatialUI.prototype),{
  active:true,ready:false,input,host:{live:()=>false,hasDraft:()=>false,selection:()=>null,tool:()=> 'height',writing:()=>false,draft:()=>null,error:e=>errors.push(e),redraw(){}},
  sourceWindow:null,source:'',requested:'',generation:0,busy:false,queued:false,lastDraft:'',lastSelection:'',baseline:null,
  loadBusy:false,worker:null,params:null,frame:null,records:[],samplePad:0,tilt:45,rotation:0,exaggeration:1,toggle:{},controls:{},retry:{},failed:false,canvas:null,
  view:{freezePicking(){},reframe(){},setVegetation(){},setContours(interval){this.interval=interval;},setData:data=>published.push(data),showSelection(){}},scheduleLoad(){},
 });
 const sync=(b=frame,revision=1,token='campaign',contours=0,objects=[])=>ui.sync(token,b,revision,objects,contours);
 const load=()=>ui.load(ui.requested,0);
 const resolveRead=(i=0,revision=1)=>reads[i].resolve({ok:true,value:{revision,fence:'source',generation:0,source:'source',grid:{view:reads[i].query.view,heights:new Float32Array(4),seaLevelM:0},pixels:new Uint8Array(16),width:2,height:2,draft:false}});

 return {ui,input,reads,jobs,published,errors,sync,load,resolveRead};
}
test('pending bounded projection survives small camera gestures; the result uses the latest pose',async t=>{
 const f=fixture(t);f.sync();const key=f.ui.requested,loading=f.load();
 f.sync(zoom(.9));assert.equal(f.ui.requested,key);assert.equal(f.reads.length,1);
 f.ui.tilt=75;f.sync({...zoom(.9),x:-170});f.resolveRead();await loading;assert.equal(f.jobs.length,0);assert.equal(f.ui.ready,true);assert.equal(f.published.length,2);
 assert.equal(f.ui.visibility().tilt,75);assert.equal(f.ui.visibility().frame.x,-170);
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
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await Promise.resolve();
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'overview');assert.equal(f.published.length,1);assert.equal(f.reads.length,2);
 assert.equal(f.reads[0].query.width,128);assert.equal(f.reads[0].query.detail,undefined);
 assert.deepEqual(f.reads[0].query.view,f.reads[1].query.view);assert.deepEqual(f.reads[0].query.objects,f.reads[1].query.objects);
 f.ui.tilt=60;f.sync(zoom(.9));f.ui.setContours(-1);f.resolveRead(1);await loading;
 assert.equal(f.input.dataset.terrainQuality,'detail');assert.equal(f.ui.visibility().tilt,60);assert.deepEqual(f.ui.visibility().frame,zoom(.9));assert.equal(f.ui.view.interval,-1);
});
test('a gesture revokes an in-flight detail even if it ends before that reply; refinement can resume',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await Promise.resolve();
 f.ui.gesture(true);f.ui.gesture(false);f.resolveRead(1);await loading;
 assert.equal(f.published.length,1);assert.equal(f.input.dataset.terrainQuality,'overview');assert.equal(f.ui.needsLoad(),true);
 const resumed=f.load();assert.equal(f.reads.length,3);assert(f.reads[2].query.detail,'resume only the missing detail');f.resolveRead(2);await resumed;assert.equal(f.published.length,2);assert.equal(f.ui.needsLoad(),false);
});
test('navigation during refinement discards the old detail and prioritizes an overview of the new source',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await Promise.resolve();
 f.sync(zoom(.6));assert.equal(f.ui.ready,false);f.resolveRead(1);await loading;assert.equal(f.published.length,1);
 const next=f.load();assert.equal(f.reads[2].query.width,128);f.resolveRead(2);await Promise.resolve();f.resolveRead(3);await next;
 assert.equal(f.published.length,3);assert.equal(f.ui.ready,true);
});
test('detail failure retains usable geometry and stops retries until an explicit retry or new source',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const loading=f.load();f.resolveRead();await Promise.resolve();
 f.reads[1].resolve({ok:false,error:'Detail worker failed'});await loading;
 assert.equal(f.ui.ready,true);assert.equal(f.input.dataset.terrainQuality,'overview');assert.equal(f.published.length,1);assert.equal(f.ui.retry.hidden,false);assert.equal(f.ui.needsLoad(),false);assert.equal(f.errors.length,1);
});

test('navigation retains sharp world-anchored colour, but edits and campaign changes discard it',async t=>{
 const f=fixture(t,{manualDetail:true});f.sync();const first=f.load();f.resolveRead();await Promise.resolve();
 const detail={box:{x:-300,y:-240,width:600,height:480},width:2,height:2,pixels:new Uint8Array(16).fill(88)};
 f.reads[1].resolve({ok:true,value:{revision:1,grid:{view:f.reads[1].query.view},detail}});await first;
 f.sync(zoom(.6));const next=f.load();f.resolveRead(2);await Promise.resolve();
 assert.equal(f.published.at(-1).detail,detail,'keep the same world texture while new detail is pending');f.resolveRead(3);await next;
 f.sync(zoom(.6),2);const edited=f.load();f.resolveRead(4,2);await Promise.resolve();assert.equal(f.published.at(-1).detail,undefined,'old pigment cannot cover a changed revision');f.resolveRead(5,2);await edited;
 f.ui.retainedDetail={token:'campaign',revision:2,detail};f.sync(zoom(.6),2,'different');const switched=f.load();f.resolveRead(6,2);await Promise.resolve();assert.equal(f.published.at(-1).detail,undefined,'campaign detail cannot leak');f.resolveRead(7,2);await switched;
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({entryPoints:['src/app/atlas-raster-presentation.ts'],outfile:'.build/atlas-presentation-source.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'object-source',setup(b){b.onResolve({filter:/^\.\/terrain-objects$/},args=>args.importer.endsWith('atlas-raster-presentation.ts')?({path:'objects',namespace:'test'}):undefined);b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function terrainObjectSources(){return [{id:"house",scopeId:"house"}];}'}));}}]});
const {AtlasRasterPresentation}=createRequire(import.meta.url)('../.build/atlas-presentation-source.cjs');
function fixture(t){
 const previous=globalThis.window;let release;const calls={refresh:0,redraw:0,errors:[],cancel:0};
 globalThis.window={campaign:{atlasTerrainProjection:()=>new Promise(r=>release=r),atlasCancelRead:async()=>{calls.cancel++;}}};t.after(()=>globalThis.window=previous);
 const ui=Object.assign(Object.create(AtlasRasterPresentation.prototype),{input:{dataset:{terrainQuality:'detail'}},token:'t',revision:7,fence:'first',frame:{x:0,y:0,width:100,height:100},focusHeightM:0,tilt:0,rotation:0,exaggeration:1,failed:false,objectKey:'',objectRead:null,stream:{cancel(){}},host:{workplane:()=>null,redraw(){calls.redraw++;},async refresh(){calls.refresh++;}},pose:()=>({metersPerPixel:1}),repaint(){},fail(e){calls.errors.push(e);}});
 return{ui,calls,release:value=>release(value)};
}
test('an object source error refreshes the source once instead of permanently disabling the Atlas',async t=>{
 const f=fixture(t),pending=f.ui.loadObjects({});f.release({ok:false,error:'Gelände inzwischen geändert. Ausschnitt erneut laden.'});await pending;
 assert.equal(f.calls.refresh,1);assert.deepEqual(f.calls.errors,[]);assert.equal(f.ui.objectRead,null);assert.equal(f.ui.objectKey,'');
});
test('obsolete object replies cannot fail or relabel a newer source',async t=>{
 for(const response of [{ok:false,error:'old read failed'},{ok:true,value:{revision:7,fence:'first',objects:[{id:'old'}]}}]){
  const f=fixture(t),pending=f.ui.loadObjects({});f.ui.fence='second';f.ui.revision=8;f.release(response);await pending;
  assert.equal(f.calls.refresh,0);assert.deepEqual(f.calls.errors,[]);assert.equal(f.ui.objects,undefined);assert.equal(f.calls.redraw,0);
 }
});
test('pausing reads retires the object response before a canonical write starts',async t=>{
 const f=fixture(t),pending=f.ui.loadObjects({});f.ui.pauseReads();f.release({ok:false,error:'cancelled'});await pending;
 assert.equal(f.calls.cancel,1);assert.deepEqual(f.calls.errors,[]);assert.equal(f.calls.redraw,0);
});

test('a superseded surface read retains the useful frame and waits for the newer owner',async t=>{
 const f=fixture(t);Object.defineProperty(f.ui,'needsTerrainRaster',{value:false});
 Object.assign(f.ui,{active:true,surfaceReady:true,surface:{frameUsable:true,preparedInputUsable:true},generation:0,request:'',host:{...f.ui.host,writing:()=>false},stream:{async load(){throw Error('Kartenausschnitt durch neuere Anfrage ersetzt.');}}});
 const pending=f.ui.load();assert.equal(f.ui.input.dataset.terrainQuality,'overview','the previous camera cannot qualify the new read');await pending;assert.equal(f.ui.ready,true);assert.equal(f.ui.request,'');assert.deepEqual(f.calls.errors,[]);assert.equal(f.calls.refresh,0);
});

function syncSourceFixture(){
 const calls=[],author={canonicalSource:{token:'t',revision:9,fence:'own9'}};
 const ui=Object.assign(Object.create(AtlasRasterPresentation.prototype),{
  token:'t',revision:7,fence:'own7',perception:false,active:true,contours:10,
  frame:{x:0,y:0,width:100,height:100},prepared:{author,matchesSource:s=>s.token===author.canonicalSource.token&&s.revision===author.canonicalSource.revision&&s.fence===author.canonicalSource.fence},
  host:{writing:()=>true},setActive(active){this.active=active;calls.push('active:'+active);},
  invalidateTerrainSource(){calls.push('invalidate');},reframe(){calls.push('frame');},
 });
 Object.defineProperty(ui,'needsTerrainRaster',{value:false});
 return{ui,calls,author};
}
test('older same-token projections are classified before any source, frame or contour effect',()=>{
 for(const revision of[0,7,8]){
  const f=syncSourceFixture(),frame=f.ui.frame;
  f.ui.sync('t',{x:1,y:2,width:50,height:50},revision,[],99,{region:{fence:'old'+revision}});
  assert.deepEqual(f.calls,[]);assert.equal(f.ui.revision,7);assert.equal(f.ui.fence,'own7');assert.equal(f.ui.contours,10);assert.equal(f.ui.frame,frame);assert.equal(f.ui.authorOwner,f.author);
 }
});
test('equal or higher foreign fences still invalidate during writing while the exact own source does not',()=>{
 for(const [token,revision,fence]of[['t',9,'foreign9'],['t',10,'foreign10'],['other',9,'foreign9']]){
  const f=syncSourceFixture();f.ui.sync(token,f.ui.frame,revision,[],10,{region:{fence}});assert(f.calls.includes('invalidate'),`${token}/${revision}/${fence}`);
 }
 const f=syncSourceFixture();f.ui.sync('t',f.ui.frame,9,[],10,{region:{fence:'own9'}});assert(!f.calls.includes('invalidate'));
});

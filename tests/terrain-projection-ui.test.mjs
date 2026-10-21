import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-ui';export * from './src/app/terrain-detail-tiles';",resolveDir:process.cwd()},outfile:'.build/terrain-projection-ui-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainSpatialUI,TerrainDetailTiles}=createRequire(import.meta.url)('../.build/terrain-projection-ui-test.cjs');
test('commit transition retains the main surface until a matching region arrives',()=>{
 const state=Object.assign(Object.create(TerrainSpatialUI.prototype),{firstSurface:new Set()});Object.assign(state,{active:true,ready:true,host:{writing:()=>true},reframe(){},placeCanvas(){throw Error('mixed revision must wait');}});
 const box={x:0,y:0,width:10,height:10};state.sync('token',box,2,[],0,{region:{revision:1,fence:'old'}});assert.equal(state.ready,true);
 state.host.writing=()=>false;state.sync('token',box,2,[],0,{region:{revision:1,fence:'old'}});assert.equal(state.ready,true);
});
test('stale projection refreshes once; obsolete, live and committing replies cannot trigger fallback',async()=>{
 let refreshes=0,failures=0,writing=false,live=false;
 const state=Object.assign(Object.create(TerrainSpatialUI.prototype),{firstSurface:new Set()});Object.assign(state,{active:true,ready:true,requested:'view',retrySource:'',host:{writing:()=>writing,live:()=>live,hasDraft:()=>false,refresh:async()=>{refreshes++;return true;}},scheduleLoad(){},fail:()=>failures++});
 const error=Error('Gelände inzwischen geändert');state.sourceFailed('old',error);writing=true;state.sourceFailed('view',error);writing=false;live=true;state.sourceFailed('view',error);live=false;
 assert.equal(refreshes,0);assert.equal(failures,0);state.sourceFailed('view',error);assert.equal(refreshes,1);assert.equal(state.ready,false);
 state.sourceFailed('view',error);assert.equal(failures,0,'no second retry while refresh is pending');
 await new Promise(setImmediate);state.sourceFailed('view',error);assert.equal(refreshes,1);assert.equal(failures,1,'repeated stale state after refresh does not loop forever');
});
test('late navigation reads cannot replace the live authored frame',async t=>{
 const old=global.window;let resolve;global.window={campaign:{atlasTerrainProjection:()=>new Promise(r=>resolve=r)}};t.after(()=>{global.window=old;});
 let live=false,published=0;const box={x:0,y:0,width:10,height:10},state=Object.assign(Object.create(TerrainSpatialUI.prototype),{firstSurface:new Set()});
 Object.assign(state,{active:true,colorTiles:new TerrainDetailTiles(),sourceWindow:{frame:box,pixelWidth:1000},frame:box,objectSources:[],token:'t',revision:1,requested:'view',host:{live:()=>live,hasDraft:()=>false,writing:()=>false},publish:()=>published++,sourceFailed:()=>assert.fail('obsolete live reply must be ignored')});
 const pending=state.load('view',0);live=true;resolve({ok:true,value:{revision:1,grid:{view:{}}}});await pending;assert.equal(published,0);
});

test('draft stays anchored while confirmed prefixes arrive; finish replaces it exactly once',()=>{
 const shown=[],frozen=[],state=Object.assign(Object.create(TerrainSpatialUI.prototype),{firstSurface:new Set()}),original={identity:{revision:1},grid:{heights:new Float32Array([0])}};
 Object.assign(state,{active:true,ready:true,token:'t',source:'s',revision:1,input:{dataset:{}},baseline:original,view:{freezePicking:a=>frozen.push(a),previewHeight:()=>true},colorTiles:{reconcile:()=>undefined},publish:d=>shown.push(d),needsLoad:()=>false});
 state.gesture(true);state.previewHeight({});assert.equal(state.input.dataset.terrainDraft,'height');
 const confirmed={...original,identity:{revision:2},grid:{heights:new Float32Array([120])},update:{base:original.identity,heights:[],pixels:[]}};
 assert.equal(state.presentLive(confirmed,false),false);assert.equal(shown.length,0);assert.equal(state.input.dataset.terrainRevision,undefined);
 state.gesture(false);assert.equal(shown.length,1);assert.equal(shown[0].grid,confirmed.grid);assert.equal(shown[0].update,undefined,'draft buffers need a complete restoration, not a delta against the old confirmed mesh');
 assert.equal(state.input.dataset.terrainRevision,'2');assert.equal(state.input.dataset.terrainDraft,undefined);assert.deepEqual(frozen,[true,false]);
});
test('a draft with no acknowledged result restores its starting surface',()=>{
 const shown=[],state=Object.assign(Object.create(TerrainSpatialUI.prototype),{firstSurface:new Set()}),original={identity:{revision:1},grid:{heights:new Float32Array([0])}};
 Object.assign(state,{active:true,ready:true,input:{dataset:{terrainQuality:'overview'}},baseline:original,view:{freezePicking(){},previewHeight:()=>true},publish:d=>shown.push(d),needsLoad:()=>false});
 state.gesture(true);state.previewHeight({});state.gesture(false);
 assert.equal(shown.length,1);assert.equal(shown[0].grid,original.grid);assert.equal(state.input.dataset.terrainRevision,'1');assert.equal(state.input.dataset.terrainQuality,'overview');
});

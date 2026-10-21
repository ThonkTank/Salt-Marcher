import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/terrain-spatial-ui.ts'],outfile:'.build/terrain-projection-ui-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainSpatialUI}=createRequire(import.meta.url)('../.build/terrain-projection-ui-test.cjs');
test('commit transition retains the main surface until a matching region arrives',()=>{
 const state=Object.create(TerrainSpatialUI.prototype);Object.assign(state,{active:true,ready:true,host:{writing:()=>true},reframe(){},placeCanvas(){throw Error('mixed revision must wait');}});
 const box={x:0,y:0,width:10,height:10};state.sync('token',box,2,[],0,{region:{revision:1,fence:'old'}});assert.equal(state.ready,true);
 state.host.writing=()=>false;state.sync('token',box,2,[],0,{region:{revision:1,fence:'old'}});assert.equal(state.ready,true);
});
test('stale projection refreshes once; obsolete, live and committing replies cannot trigger fallback',async()=>{
 let refreshes=0,failures=0,writing=false,live=false;
 const state=Object.create(TerrainSpatialUI.prototype);Object.assign(state,{active:true,ready:true,requested:'view',retrySource:'',host:{writing:()=>writing,live:()=>live,hasDraft:()=>false,refresh:async()=>{refreshes++;return true;}},scheduleLoad(){},fail:()=>failures++});
 const error=Error('Gelände inzwischen geändert');state.sourceFailed('old',error);writing=true;state.sourceFailed('view',error);writing=false;live=true;state.sourceFailed('view',error);live=false;
 assert.equal(refreshes,0);assert.equal(failures,0);state.sourceFailed('view',error);assert.equal(refreshes,1);assert.equal(state.ready,false);
 state.sourceFailed('view',error);assert.equal(failures,0,'no second retry while refresh is pending');
 await new Promise(setImmediate);state.sourceFailed('view',error);assert.equal(refreshes,1);assert.equal(failures,1,'repeated stale state after refresh does not loop forever');
});
test('late navigation reads cannot replace the live authored frame',async t=>{
 const old=global.window;let resolve;global.window={campaign:{atlasTerrainProjection:()=>new Promise(r=>resolve=r)}};t.after(()=>{global.window=old;});
 let live=false,published=0;const box={x:0,y:0,width:10,height:10},state=Object.create(TerrainSpatialUI.prototype);
 Object.assign(state,{active:true,sourceWindow:{frame:box,pixelWidth:1000},frame:box,objectSources:[],token:'t',revision:1,requested:'view',host:{live:()=>live,hasDraft:()=>false,writing:()=>false},publish:()=>published++,sourceFailed:()=>assert.fail('obsolete live reply must be ignored')});
 const pending=state.load('view',0);live=true;resolve({ok:true,value:{revision:1,grid:{view:{}}}});await pending;assert.equal(published,0);
});

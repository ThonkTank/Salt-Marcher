import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({
  stdin:{contents:"export * from './src/app/terrain-projection-cache';",resolveDir:process.cwd()},
  outfile:'.build/atlas-geometry-anchor-cache-test.cjs',
  bundle:true,
  platform:'node',
  format:'cjs'
});
const {TerrainProjectionCache}=await import('../.build/atlas-geometry-anchor-cache-test.cjs');

test('geometry anchors reuse scalar results and distinguish zero, NaN, and sea levels',()=>{
  const cache=new TerrainProjectionCache();
  let calls=0;
  assert.equal(cache.geometryAnchor(1.25,-3.5,7,()=>{calls++;return 0;}),0);
  assert.equal(cache.geometryAnchor(1.25,-3.5,7,()=>{calls++;return 9;}),0);
  assert.equal(cache.geometryAnchor(1.25,-3.5,8,()=>{calls++;return NaN;}),Number.NaN);
  assert.equal(cache.geometryAnchor(1.25,-3.5,8,()=>{calls++;return 10;}),Number.NaN);
  assert.equal(calls,2);
});

test('geometry anchors survive distant edits and evict for edits anywhere in the original 3x3 support',()=>{
  const cache=new TerrainProjectionCache();
  let calls=0;
  const read=()=>cache.geometryAnchor(0,0,0,()=>++calls);
  assert.equal(read(),1);
  cache.invalidate([{x:20,y:20,width:1,height:1}]);
  assert.equal(read(),1);
  cache.invalidate([{x:.74,y:0,width:.02,height:.02}]);
  assert.equal(read(),2);
  assert.equal(calls,2);
});

test('geometry anchors are cleared by reset and failed computations are not cached',()=>{
  const cache=new TerrainProjectionCache();
  let calls=0;
  const read=()=>cache.geometryAnchor(-.125,.375,2,()=>++calls);
  assert.equal(read(),1);
  cache.invalidate([],true);
  assert.equal(read(),2);
  assert.throws(()=>cache.geometryAnchor(4,5,2,()=>{throw Error('source read failed');}),/source read failed/);
  assert.equal(cache.geometryAnchor(4,5,2,()=>++calls),3);
  assert.equal(calls,3);
});

test('geometry anchors obey the shared cache byte budget and evict by LRU',()=>{
  const cache=new TerrainProjectionCache(256);
  let firstCalls=0,secondCalls=0;
  assert.equal(cache.geometryAnchor(1,2,3,()=>++firstCalls),1);
  assert.equal(cache.geometryAnchor(4,5,3,()=>++secondCalls),1);
  assert.ok(cache.tiles.evictions>0);
  assert.ok(cache.tiles.bytes<=cache.tiles.limit);
  assert.equal(cache.geometryAnchor(1,2,3,()=>++firstCalls),2);
  assert.equal(firstCalls,2);
});

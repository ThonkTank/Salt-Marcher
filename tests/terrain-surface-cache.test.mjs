import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-projection-cache';export * from './src/app/terrain-field-stream';export * from './src/app/terrain-height';export * from './src/app/terrain-dirty-rects';",resolveDir:process.cwd()},outfile:'.build/terrain-surface-cache-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainProjectionCache,streamTerrainField,heightRecord,terrainDirtyRects}=require('../.build/terrain-surface-cache-test.cjs');
const lattice={x:-12.125,y:-10.25,dx:.7,dy:1.3,columns:19,rows:17};
function source(){
 const records=[heightRecord(-64,-64,1,new Float32Array(4096).fill(100)),heightRecord(0,-64,1,new Float32Array(4096).fill(100)),heightRecord(-64,0,1,new Float32Array(4096).fill(100)),heightRecord(0,0,1,new Float32Array(4096).fill(100))],calls=[];
 const stream=(kind,box)=>{calls.push({kind,box});return kind==='height'?records:[];};
 return{records,calls,stream};
}
test('retained surfaces rebuild only accumulated dirty blocks, with exact fractional edge coordinates',()=>{
 const cache=new TerrainProjectionCache(),s=source(),initial=cache.grid(lattice,0,s.stream);
 s.calls.length=0;assert.deepEqual(cache.grid(lattice,0,s.stream),initial);assert.equal(s.calls.length,0);
 // Different corners include a partial block and a boundary shared by two blocks.
 const changes=[{x:lattice.x+(4-.5)*lattice.dx,y:lattice.y,width:0,height:0},{x:lattice.x+18*lattice.dx,y:lattice.y+16*lattice.dy,width:0,height:0}];
 cache.invalidate([changes[0]]);cache.invalidate([changes[1]]);
 // Small lakes affect exactly the changed sample positions, independent of height interpolation.
 const lake=changes.map((b,i)=>({id:'lake'+i,points:[],polygons:[{outer:[{x:b.x-.01,y:b.y-.01},{x:b.x+.01,y:b.y-.01},{x:b.x+.01,y:b.y+.01},{x:b.x-.01,y:b.y+.01}],holes:[]}],waterLevelM:200}));
 const stream=(kind,box)=>kind==='lake'?lake:s.stream(kind,box);
 const updated=cache.grid(lattice,0,stream),queries=s.calls.filter(c=>c.kind==='height');
 assert.equal(queries.length,2,'adjacent boundary blocks share one read; the separate corner stays local');
 assert.equal(queries.reduce((sum,q)=>sum+Math.round(q.box.width/lattice.dx)*Math.round(q.box.height/lattice.dy),0),35,'two 4x4 blocks and the 3x1 corner; no clean samples rebuilt');
 assert.deepEqual(updated,streamTerrainField(lattice,0,stream).surface);assert.notDeepEqual(updated,initial);
 const retained=updated.slice();cache.invalidate(changes);cache.grid(lattice,0,s.stream);
 assert.deepEqual(updated,retained,'later edits do not mutate an earlier response');
});
test('seed and returned buffers are owned; dirty read failures remain retryable',()=>{
 const cache=new TerrainProjectionCache(),s=source(),seed=streamTerrainField(lattice,0,s.stream).surface,expected=seed.slice();
 cache.seedGrid(lattice,0,seed);seed.fill(999);s.calls.length=0;
 const response=cache.grid(lattice,0,s.stream);assert.deepEqual(response,expected);response.fill(888);
 assert.deepEqual(cache.grid(lattice,0,s.stream),expected);assert.equal(s.calls.length,0);
 cache.invalidate([{x:lattice.x,y:lattice.y,width:0,height:0},{x:lattice.x+18*lattice.dx,y:lattice.y+16*lattice.dy,width:0,height:0}]);
 let reads=0;
 assert.throws(()=>cache.grid(lattice,0,(kind,box)=>{if(kind==='height'&&++reads===2)throw Error('source failure');return s.stream(kind,box);}),/source failure/);
 s.calls.length=0;assert.deepEqual(cache.grid(lattice,0,s.stream),expected);
 assert.equal(s.calls.filter(c=>c.kind==='height').length,2,'all dirty blocks retried after partial failure');
});
test('full rebuilds, reset and LRU eviction respect the existing shared byte quota',()=>{
 const s=source(),cache=new TerrainProjectionCache(1800),key=JSON.stringify(['surface',lattice,0]);
 cache.grid(lattice,0,s.stream);
 assert.equal(cache.tiles.bytes,key.length*2+19*17*4+5*5+128,'raster, bitmap, key and metadata counted');
 s.calls.length=0;cache.invalidate([{x:-100,y:-100,width:200,height:200}]);cache.grid(lattice,0,s.stream);
 assert.equal(s.calls.filter(c=>c.kind==='height').length,1,'mostly dirty view uses one bounded full stream');
 cache.rememberPixels('other',{x:1000,y:1000,width:1,height:1},new Uint8Array(1000));assert(cache.tiles.bytes<=1800);assert(cache.tiles.evictions>0);
 s.calls.length=0;assert.deepEqual(cache.grid(lattice,0,s.stream),streamTerrainField(lattice,0,s.stream).surface);assert(s.calls.length>0);
 cache.invalidate([],true);assert.equal(cache.tiles.bytes,0);
 const tiny=new TerrainProjectionCache(100);tiny.seedGrid(lattice,0,new Float32Array(323));assert.equal(tiny.tiles.bytes,0);
});

test('joined dirty rectangles cover every dirty sample once, preserve holes and respect the read budget',()=>{
 for(const [columns,rows,edge,budget] of [[257,257,4,65536],[193,137,4,65536],[257,193,32,1048576]])for(const mode of ['all','diagonal','holes']){
  const across=Math.ceil(columns/edge),down=Math.ceil(rows/edge);
  const dirty=Uint8Array.from({length:across*down},(_,i)=>mode==='all'?1:mode==='diagonal'?+(i%across===Math.floor(i/across)):+(i%7!==3));
  const seen=new Uint8Array(columns*rows);
  for(const r of terrainDirtyRects(dirty,columns,rows,edge,budget)){
   assert(r.width*r.height<=budget);
   for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){
    assert.equal(dirty[Math.floor(y/edge)*across+Math.floor(x/edge)],1,'clean hole must not be read');
    assert.equal(seen[y*columns+x]++,0,'no overlapping work');
   }
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)assert.equal(seen[y*columns+x],dirty[Math.floor(y/edge)*across+Math.floor(x/edge)]);
 }
});

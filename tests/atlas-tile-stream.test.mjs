import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-tile-stream.ts'],outfile:'.build/atlas-tile-stream-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasTileStream}=await import('../.build/atlas-tile-stream-test.mjs');

const input=(source='world',box={x:0,y:0,width:512,height:256})=>({box,metersPerPixel:1,revision:7,source,contours:0});
const address=tile=>`${tile.lod}/${tile.x}/${tile.y}`;
function overlaps(a,b){
  if(a.lod===b.lod)return a.x===b.x&&a.y===b.y;
  const fine=a.lod<b.lod?a:b,coarse=a.lod<b.lod?b:a,scale=2**(coarse.lod-fine.lod);
  return Math.floor(fine.x/scale)===coarse.x&&Math.floor(fine.y/scale)===coarse.y;
}
function assertNoOverlap(frame){
  for(let i=0;i<frame.tiles.length;i++)for(let j=i+1;j<frame.tiles.length;j++)
    assert.equal(overlaps(frame.tiles[i].tile,frame.tiles[j].tile),false,`overlap in frame: ${address(frame.tiles[i].tile)} and ${address(frame.tiles[j].tile)}`);
}
function reply(request,source='world',size=1024){
  return {tile:{...request.tile},revision:request.revision,fence:source,cache:'built',projection:{
    revision:request.revision,fence:source,source,width:256,height:256,pixels:new Uint8Array(size),
    grid:{heights:new Float32Array(16),view:{box:{x:0,y:0,width:1,height:1}}},
  }};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('overview remains until every planned child is ready, then swaps atomically',async()=>{
  const stream=new AtlasTileStream(),frames=[],blocked=deferred(),calls=[];
  const loading=stream.load(input(),async request=>{
    calls.push(address(request.tile));
    if(request.tile.lod===0&&request.tile.x===1)return blocked.promise;
    return reply(request);
  },frame=>frames.push(frame));
  await turn();
  assert.deepEqual(calls,['2/0/0','0/0/0','0/1/0']);
  assert.deepEqual(frames.map(frame=>frame.tiles.map(tile=>address(tile.tile))),[[],['2/0/0']]);
  for(const frame of frames)assertNoOverlap(frame);
  blocked.resolve(reply({tile:{lod:0,x:1,y:0},revision:7,contours:0}));
  await loading;
  assert.deepEqual(frames.at(-1).tiles.map(tile=>address(tile.tile)),['0/0/0','0/1/0']);
  assert.equal(frames.at(-1).complete,true);
  for(const frame of frames)assertNoOverlap(frame);
});

test('several parents refine progressively without coarse/fine overlap',async()=>{
  const stream=new AtlasTileStream(),frames=[],blocked=deferred();
  const loading=stream.load(input('world',{x:0,y:0,width:2048,height:256}),async request=>{
    if(request.tile.lod===0&&request.tile.x===7)return blocked.promise;
    return reply(request);
  },frame=>frames.push(frame));
  await turn();
  const progressive=frames.find(frame=>frame.tiles.some(tile=>address(tile.tile)==='2/1/0')
    &&frame.tiles.some(tile=>address(tile.tile)==='0/0/0'));
  assert.ok(progressive,'first parent should refine while the second parent stays coarse');
  assert.equal(progressive.tiles.some(tile=>address(tile.tile)==='2/0/0'),false);
  assert.equal(progressive.tiles.some(tile=>address(tile.tile)==='2/1/0'),true);
  for(const frame of frames)assertNoOverlap(frame);
  blocked.resolve(reply({tile:{lod:0,x:7,y:0},revision:7,contours:0}));
  await loading;
  assert.equal(frames.at(-1).complete,true);
  assert.ok(frames.at(-1).tiles.every(tile=>tile.tile.lod===0));
});

test('new source and same tile address invalidate blocked prior generations',async()=>{
  const stream=new AtlasTileStream(),oldPending=deferred(),frames=[],calls={old:0,new:0};
  const first=stream.load(input('old'),async request=>{calls.old++;return oldPending.promise;},frame=>frames.push(frame));
  await turn();
  const afterOldStart=frames.length;
  await stream.load(input('new'),async request=>{calls.new++;return reply(request,'new');},frame=>frames.push(frame));
  const newGeneration=frames.at(-1).generation;
  oldPending.resolve(reply({tile:{lod:2,x:0,y:0},revision:7,contours:0},'old'));
  await first;
  assert.ok(frames.slice(afterOldStart).every(frame=>frame.generation===newGeneration));
  const oldCallsBefore=calls.old;
  await stream.load(input('old'),async request=>{calls.old++;return reply(request,'old');},()=>{});
  assert.ok(calls.old>oldCallsBefore,'stale old reply must not populate the cache');
  assert.ok(calls.new>0);
});

test('reply address, revision, top-level fence and projection fence are all checked before caching',async()=>{
  for(const corrupt of [
    tile=>({...tile,tile:{...tile.tile,x:tile.tile.x+1}}),
    tile=>({...tile,revision:tile.revision+1}),
    tile=>({...tile,fence:'other'}),
    tile=>({...tile,projection:{...tile.projection,source:'other'}}),
  ]){
    const stream=new AtlasTileStream();let attempts=0;
    await assert.rejects(stream.load(input('world',{x:0,y:0,width:256,height:256}),async request=>{
      attempts++;
      const valid=reply(request);
      return attempts===1?corrupt(valid):valid;
    },()=>{}),/reply does not match/);
    await stream.load(input('world',{x:0,y:0,width:256,height:256}),async request=>{attempts++;return reply(request);},()=>{});
    assert.equal(attempts,3,'invalid overview reply must not enter the cache; retry reloads overview and detail');
  }
});

test('dispose invalidates an in-flight result and stops later publication',async()=>{
  const stream=new AtlasTileStream(),pending=deferred(),frames=[];
  const loading=stream.load(input(),async()=>pending.promise,frame=>frames.push(frame));
  await turn();
  stream.dispose();
  pending.resolve(reply({tile:{lod:2,x:0,y:0},revision:7,contours:0}));
  await loading;
  assert.equal(frames.length,1);
  assert.deepEqual(frames[0].tiles,[]);
  await assert.rejects(stream.load(input(),async request=>reply(request),()=>{}),/disposed/);
});

test('same-key revisits hit the LRU cache and source churn stays within its byte budget',async()=>{
  const stream=new AtlasTileStream({maxBytes:20_000}),calls=[];
  const loadSource=source=>stream.load(input(source,{x:0,y:0,width:256,height:256}),async request=>{
    calls.push(`${source}:${address(request.tile)}`);
    return reply(request,source,8192);
  },()=>{});
  await loadSource('a');
  const afterFirst=calls.length;
  await loadSource('a');
  assert.equal(calls.length,afterFirst,'matching source, revision, contours and address should reuse cached tiles');
  await loadSource('b');
  const afterSecondSource=calls.length;
  await loadSource('a');
  assert.ok(calls.length>afterSecondSource,'LRU should evict old source data when the byte budget fills');

  const tooSmall=new AtlasTileStream({maxBytes:100});
  await assert.rejects(tooSmall.load(input('large',{x:0,y:0,width:256,height:256}),async request=>reply(request,'large',4096),()=>{}),/exceeds maxBytes/);
});

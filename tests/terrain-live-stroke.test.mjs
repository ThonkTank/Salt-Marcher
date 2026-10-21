import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/terrain-live-stroke.ts'],outfile:'.build/terrain-live-stroke-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainLiveStroke}=createRequire(import.meta.url)('../.build/terrain-live-stroke-test.cjs');
const height=(n)=>({kind:'landscape-height-stroke',stroke:{mode:'raise',radius:16,strength:10,feather:0,samples:Array.from({length:n},(_,i)=>({x:i,y:0,t:i*100}))}});
const tick=()=>new Promise(setImmediate);
test('stationary sampling is requested when write capacity returns, not while a write is blocked',async()=>{
 let resolve,idle=0;
 const live=new TerrainLiveStroke({id:'g',expectedRevision:1,sourceFence:'f'},()=>new Promise(r=>resolve=r),e=>{throw e;},()=>idle++);
 live.update(height(2));assert.equal(idle,0);resolve({revision:2,sourceFence:'next'});await tick();assert.equal(idle,1);
 assert.equal(live.hasCommittedChanges,true);
 await live.finish();assert.equal(idle,1);
});
test('coalesces input behind one write; advances revision/fence only from ACK and never repeats elapsed samples',async()=>{
 const calls=[],gates=[];let errors=[];
 const live=new TerrainLiveStroke({id:'gesture',expectedRevision:10,sourceFence:'a'},(a,c)=>{calls.push({a,c});return new Promise(resolve=>gates.push(resolve));},e=>errors.push(e));
 live.update(height(2));live.update(height(3));live.update(height(4));assert.equal(calls.length,1);
 gates.shift()({revision:11,sourceFence:'b'});await tick();assert.equal(calls.length,2);assert.deepEqual(calls[1].a.stroke.samples.map(p=>p.t),[0,100,200]);assert.deepEqual(calls[1].c,{id:'gesture',expectedRevision:11,sourceFence:'b'});
 gates.shift()({revision:12,sourceFence:'c'});await live.finish();live.update(height(5));assert.equal(calls.length,2);assert.deepEqual(errors,[]);
});
test('a rejected or unknown increment stops queued work and never retries',async()=>{
 let reject,calls=0,errors=[];const error=Error('transport lost');
 const live=new TerrainLiveStroke({id:'g',expectedRevision:1,sourceFence:'f'},()=>{calls++;return new Promise((_,r)=>reject=r);},e=>errors.push(e));
 live.update(height(2));live.update(height(4));reject(error);await assert.rejects(live.finish(),/transport lost/);live.update(height(6));assert.equal(calls,1);assert.deepEqual(errors,[error]);
 assert.equal(live.hasCommittedChanges,false,'an unknown outcome must not be described as a confirmed edit');
});
test('a no-op ACK creates no Undo promise, while a saved prefix survives a later failure',async()=>{
 let n=0;
 const live=new TerrainLiveStroke({id:'g',expectedRevision:1,sourceFence:'a'},async()=>{n++;if(n===3)throw Error('rejected');return{revision:n,sourceFence:'f'+n};},()=>{});
 live.update(height(2));await tick();assert.equal(live.hasCommittedChanges,false);
 live.update(height(3));await tick();assert.equal(live.hasCommittedChanges,true);
 live.update(height(4));await assert.rejects(live.finish(),/rejected/);assert.equal(live.hasCommittedChanges,true);
});
test('stop discards unsent tail but lets the one in-flight write settle',async()=>{
 let resolve,calls=0;const live=new TerrainLiveStroke({id:'g',expectedRevision:1,sourceFence:'f'},()=>{calls++;return new Promise(r=>resolve=r);},()=>{});
 live.update(height(2));live.update(height(4));const done=live.stop();resolve({revision:2,sourceFence:'next'});await done;assert.equal(calls,1);
});
test('color replaces the full cumulative same-id layer and coalesces pending snapshots',async()=>{
 const calls=[],gates=[];const live=new TerrainLiveStroke({id:'pigment',expectedRevision:1,sourceFence:'f'},(a)=>{calls.push(a);return new Promise(r=>gates.push(r));},()=>{});
 const color=n=>({kind:'landscape-color-stroke',record:{id:'pigment',points:Array.from({length:n},(_,x)=>({x,y:0})),paint:{opacity:.5}}});
 live.update(color(1));live.update(color(2));live.update(color(3));gates.shift()({revision:2,sourceFence:'b'});await tick();assert.equal(calls[1].record.points.length,3);assert.equal(calls[1].record.paint.opacity,.5);gates.shift()({revision:3,sourceFence:'c'});await live.finish();assert.equal(calls.length,2);
});

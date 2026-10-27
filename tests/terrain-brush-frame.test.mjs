import {landscapeFixture} from './helpers/atlas-workbench.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/atlas-landscape-ui.ts'],outfile:'.build/terrain-brush-frame-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeWorkbench}=createRequire(import.meta.url)('../.build/terrain-brush-frame-test.cjs');
const settle=()=>new Promise(setImmediate);
function fixture(t,{color=false}={}){
 const old={requestAnimationFrame:global.requestAnimationFrame,cancelAnimationFrame:global.cancelAnimationFrame,performance:global.performance};
 const frames=new Map(),writes=[],gates=[],previews=[],errors=[];let now=0,serial=0;
 global.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};
 global.cancelAnimationFrame=id=>frames.delete(id);global.performance={now:()=>now};
 t.after(()=>Object.assign(global,old));
 const ui=Object.assign(landscapeFixture(LandscapeWorkbench),{
  pointer:1,maskStart:0,lastPoint:{x:0,y:0},points:[{x:0,y:0}],
  maskStroke:color?null:{mode:'raise',radius:100,strength:10,feather:0,samples:[{x:0,y:0,t:0}]},
  host:{data:()=>({revision:1,region:{fence:'base'}}),terrainGesture(){},
   previewHeight:stroke=>previews.push(structuredClone(stroke)),
   writeTerrain:(action,context)=>{writes.push({action:structuredClone(action),context});return new Promise((resolve,reject)=>gates.push({resolve,reject}));},
   error:error=>errors.push(error),redraw(){},
  },disable(){},say(){},colorRecord(){return{id:'color',points:structuredClone(this.points)};},
 });
 const advance=time=>{now=time;const ready=[...frames.values()];frames.clear();for(const fn of ready)fn(time);};
 const ack=async()=>{assert(gates.length,'write awaiting ACK');gates.shift().resolve({revision:writes.length+1,sourceFence:'f'+writes.length});await settle();};
 return{ui,frames,writes,previews,errors,advance,ack,async reject(error){gates.shift().reject(error);await settle();},setTime:time=>now=time};
}
test('stationary preview draws once per frame while storage is blocked; ACK joins the next preview',async t=>{
 const f=fixture(t);f.ui.startLive();f.advance(16);
 assert.equal(f.previews.length,1,'the first elapsed frame must not draw twice');assert.equal(f.writes.length,1);
 f.advance(32);f.advance(48);assert.equal(f.previews.length,3);assert.equal(f.writes.length,1,'blocked storage does not queue stationary writes each frame');
 await f.ack();f.advance(64);assert.equal(f.previews.length,4,'capacity return shares the scheduled preview frame');assert.equal(f.writes.length,2);
 assert.equal(f.writes[1].action.stroke.samples.at(-1).t,48,'canonical continuation includes all elapsed stationary input exactly once');
 f.ui.endLiveInput();await f.ack();await f.ui.live.finish();assert.equal(f.frames.size,0);
});
test('coalesced movement and release preserve the final point and elapsed dose without a late preview',async t=>{
 const f=fixture(t);f.ui.startLive();f.advance(16);
 f.ui.lastPoint={x:10,y:0};f.ui.maskStroke.samples.push({x:10,y:0,t:20});f.ui.scheduleLive();f.ui.scheduleLive();
 f.advance(32);assert.equal(f.previews.length,2);assert.equal(f.writes.length,1);
 f.ui.lastPoint={x:20,y:0};f.setTime(40);f.ui.endLiveInput();f.ui.sampleLive();
 assert.equal(f.previews.at(-1).samples.at(-1).t,40);assert.equal(f.previews.at(-1).samples.at(-1).x,20);assert.equal(f.frames.size,0);
 await f.ack();assert.equal(f.writes.length,2);assert.equal(f.writes[1].action.stroke.samples.at(-1).x,20);
 assert.equal(f.writes.reduce((sum,w)=>sum+w.action.stroke.samples.at(-1).t,0),40);
 await f.ack();await f.ui.live.finish();const count=f.previews.length;f.advance(64);assert.equal(f.previews.length,count);
});
test('release before the first frame flushes the actual elapsed stroke',async t=>{
 const f=fixture(t);f.ui.startLive();f.setTime(5);f.ui.endLiveInput();f.ui.sampleLive();
 assert.equal(f.previews.length,1);assert.equal(f.writes.length,1);assert.equal(f.writes[0].action.stroke.samples.at(-1).t,5);assert.equal(f.frames.size,0);
 await f.ack();await f.ui.live.finish();f.advance(16);assert.equal(f.previews.length,1);
});
test('colour brush remains event driven and commits its final cumulative points',async t=>{
 const f=fixture(t,{color:true});f.ui.startLive();f.advance(16);assert.equal(f.previews.length,0);assert.equal(f.writes.length,1);assert.equal(f.frames.size,0);
 await f.ack();f.advance(32);assert.equal(f.writes.length,1);assert.equal(f.frames.size,0);
 f.ui.points.push({x:10,y:20});f.ui.scheduleLive();f.ui.scheduleLive();f.advance(48);assert.equal(f.writes.length,2);assert.equal(f.writes[1].action.record.points.length,2);
 f.ui.endLiveInput();await f.ack();await f.ui.live.finish();assert.equal(f.frames.size,0);
});
test('a failed write cancels future height frames without retrying an uncertain operation',async t=>{
 const f=fixture(t);f.ui.startLive();f.advance(16);f.advance(32);
 const failure=Error('answer lost');await f.reject(failure);
 assert.deepEqual(f.errors,[failure]);assert.equal(f.ui.live,null);assert.equal(f.frames.size,0);
 const shown=f.previews.length;f.advance(64);assert.equal(f.previews.length,shown);assert.equal(f.writes.length,1);
});


test('one handler reuses only consecutive pixels while preserving Raster hit and miss fallback effects',()=>{
 const sequences=[[0,1,0,3],[1,2,1,0],[1,1,2,2,1,0,0]];
 for(const pixels of sequences){
  const run=memo=>{let fallback={x:5,y:6},calls=0;const ui=Object.create(LandscapeWorkbench.prototype);ui.host={point:e=>{calls++;if(e.clientX===1||e.clientX===2)fallback={x:e.clientX*10,y:7};return fallback;}};
   const point=memo?ui.pointerProjector():e=>ui.point(e),samples=pixels.map((x,i)=>({...point({clientX:x,clientY:0}),t:i*8}));return{samples,fallback,calls};};
  const expected=run(false),actual=run(true);assert.deepEqual(actual.samples,expected.samples);assert.deepEqual(actual.fallback,expected.fallback);
  assert.equal(actual.calls,pixels.filter((x,i)=>i===0||x!==pixels[i-1]).length);if(pixels.length===7)assert.equal(actual.calls,4);
 }
 // A new handler cannot borrow a preceding handler's stale projection.
 const ui=Object.create(LandscapeWorkbench.prototype);let calls=0;ui.host={point:()=>({x:++calls,y:0})};assert.equal(ui.pointerProjector()({clientX:1,clientY:1}).x,1);assert.equal(ui.pointerProjector()({clientX:1,clientY:1}).x,2);
});

import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
mkdirSync('.build', {recursive:true});
buildSync({entryPoints:['src/app/atlas-tile-stream.ts'],outfile:'.build/atlas-stream-supersession-probe-bundle.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasTileStream}=await import(pathToFileURL(resolve('.build/atlas-stream-supersession-probe-bundle.mjs')).href);
const stream=new AtlasTileStream(), pending=[],frames=[],loads=[];
let outstanding=0,maxOutstanding=0;
const fetch=request=>{
  outstanding++; maxOutstanding=Math.max(maxOutstanding,outstanding);
  return new Promise(resolve=>pending.push({request,resolve,settled:false}));
};
const makeInput=i=>({box:{x:i*256,y:0,width:256,height:256},metersPerPixel:1,revision:1,source:'same'});
for(let i=0;i<20;i++) loads.push(stream.load(makeInput(i),fetch,frame=>frames.push(frame)));
await new Promise(resolve=>setImmediate(resolve));
const callsBeforeResolve=pending.length;
const outstandingBeforeResolve=outstanding;
const currentGeneration=frames.at(-1).generation;
const framesAtSupersession=frames.length;
let waves=0;
while(waves<10) {
  const batch=pending.filter(item=>!item.settled);
  if(batch.length===0) break;
  for(const item of batch){
    item.settled=true; outstanding--;
    const {tile,revision}=item.request;
    const source='same';
    item.resolve({tile:{...tile},revision,fence:source,cache:'built',projection:{revision,fence:source,source,width:256,height:256,pixels:new Uint8Array(4),grid:{heights:new Float32Array(4),view:{box:{x:0,y:0,width:1,height:1}}}}});
  }
  waves++;
  await new Promise(resolve=>setImmediate(resolve));
  if(pending.filter(item=>!item.settled).length===0) break;
}
await Promise.all(loads);
const postSupersessionFrames=frames.slice(framesAtSupersession);
const stalePostSupersessionFrames=postSupersessionFrames.filter(frame=>frame.generation!==currentGeneration).length;
assert.equal(callsBeforeResolve,20);
assert.equal(outstandingBeforeResolve,20);
assert.equal(stalePostSupersessionFrames,0);
console.log(JSON.stringify({probe:'docs/reference/atlas-material-stream-20261024/supersession-probe.mjs',supersedingLoads:20,callsBeforeResolve,outstandingBeforeResolve,maximumOutstanding:maxOutstanding,lateRepliesResolved:pending.filter(p=>p.settled).length,stalePostSupersessionFrames,finalGeneration:frames.at(-1).generation,complete:frames.at(-1).complete,waves},null,2));

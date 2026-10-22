// Paired, exact-pixel comparison of renderer detail retention against a Git baseline.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),baseline=process.env.DETAIL_BASELINE;
assert(baseline,'Set DETAIL_BASELINE to the commit before the retention change');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/detail-retention-measure');mkdirSync(output,{recursive:true});
const files=['src/app/terrain-detail-retention.ts','src/app/terrain-detail-tiles.ts'];
const old=new Map(files.map(f=>[path.resolve(f),execFileSync('git',['show',baseline+':'+f],{encoding:'utf8'})]));
old.set(path.resolve(files[1]),old.get(path.resolve(files[1]))+'\nexport {retainPrevious as retainTerrainDetail};');
const modules={};
for(const label of ['before','after']){
 const filename=path.join(output,label+'.cjs');
 await build({stdin:{contents:files.map(f=>`export * from './${f}';`).join('\n'),resolveDir:process.cwd()},outfile:filename,bundle:true,platform:'node',format:'cjs',plugins:label==='after'?[]:[{name:'baseline',setup(b){b.onLoad({filter:/\.ts$/},args=>old.has(args.path)?{contents:old.get(args.path),loader:'ts',resolveDir:path.dirname(args.path)}:undefined);}}]});
 modules[label]=require(filename);
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),runs=[];
const width=2048,height=1536,origin=-20000000,mpp=16384,box={x:origin,y:origin,width:width*mpp,height:height*mpp};
const previous={box,width,height,pixels:Uint8Array.from({length:width*height*4},(_,i)=>(i*29+Math.floor(i/1007))%256),forest:Uint8Array.from({length:width*height},(_,i)=>i*17%256),coverage:{columns:8,rows:6,values:new Uint8Array(48).fill(255)}};
const describe=v=>v?{pixels:sha(v.pixels),forest:sha(v.forest),coverage:v.coverage?sha(v.coverage.values):undefined}:null;
const scenarios=[['same',box],['pan',{...box,x:box.x+256*mpp,y:box.y-256*mpp}],['zoom-in',{...box,width:box.width/2,height:box.height/2}],['zoom-out',{...box,width:box.width*2,height:box.height*2}]];
for(const [name,targetBox] of scenarios){
 const values={},times={before:[],after:[]};
 // Alternate order to avoid attributing warmup/host drift to one variant.
 for(let round=0;round<7;round++)for(const label of round%2?['after','before']:['before','after']){
  const target={box:targetBox,width,height,pixels:new Uint8Array(width*height*4),forest:new Uint8Array(width*height)},start=performance.now();
  modules[label].retainTerrainDetail(target,previous);const ms=performance.now()-start;if(round)times[label].push(ms);values[label]=describe(target);
 }
 assert.deepEqual(values.after,values.before,name);runs.push({name,times,output:values.after});
}
const changes={reset:false,bounds:Array.from({length:2048},(_,i)=>({x:box.x-10000*mpp,y:box.y-i*mpp,width:mpp,height:mpp}))};changes.bounds.push({x:box.x+box.width/2,y:box.y+box.height/2,width:mpp,height:mpp});
const values={},times={before:[],after:[]};
for(let round=0;round<7;round++)for(const label of round%2?['after','before']:['before','after']){
 const start=performance.now(),next=modules[label].invalidateTerrainDetail(previous,changes),ms=performance.now()-start;if(round)times[label].push(ms);values[label]=describe(next);
}
assert.deepEqual(values.after,values.before);runs.push({name:'invalidate-halo',times,output:values.after});
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
for(const run of runs)run.medianMs=Object.fromEntries(Object.entries(run.times).map(([label,a])=>[label,median(a)]));
const result={baseline,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:Object.fromEntries(files.map(f=>[f,sha(readFileSync(f))])),dimensions:{width,height,mpp},runs,note:'Allocation excluded from resampling timings; invalidation includes immutable buffer copies. JS CPU microbenchmark, not native frame or end-to-end acceptance.'};
writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(runs.map(({name,medianMs})=>({name,medianMs})),null,2));

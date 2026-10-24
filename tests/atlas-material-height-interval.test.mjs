import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'atlas-height-interval-')),outfile=join(dir,'api.cjs');
buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/height-field-interval';export * from './src/app/terrain-height';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'cjs'});
const {createHeightFieldIntervals,TerrainSampler,heightRecord}=createRequire(import.meta.url)(outfile);
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const record=(pixel,x,y,f,version=1)=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>f((x*64+i%64)*pixel,(y*64+Math.floor(i/64))*pixel,i)),version);
function check(records,boxes,n=12){
 const sampler=new TerrainSampler(records),field=createHeightFieldIntervals(records);let checked=0;
 for(const box of boxes){
  const [lo,hi]=field.range(box);assert.ok(lo<=hi&&!Number.isNaN(lo+hi),`invalid interval ${lo},${hi}`);
  assert.ok(Number.isFinite(lo)&&Number.isFinite(hi),'bounded local probe must produce a finite range');
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
   const p={x:box.x+box.width*x/n,y:box.y+box.height*y/n},z=sampler.sample(p).heightM;
   assert.ok(lo<=z&&z<=hi,`${JSON.stringify(box)}: ${lo} <= ${z} <= ${hi} at ${JSON.stringify(p)}`);checked++;
  }
 }
 return {checked,field};
}
test('constant sea plateaus and absent additive nodes keep exact singleton bounds',()=>{
 for(const value of [-100,0,37]){
  const records=[record(1,0,0,()=>value),record(1,0,0,()=>NaN,2)];
  assert.deepEqual(createHeightFieldIntervals(records).range({x:10,y:10,width:3,height:3}),[value,value]);
 }
 assert.deepEqual(createHeightFieldIntervals([]).range({x:-1,y:-1,width:2,height:2}),[-100,-100]);
});
test('Hermite extrema, sparse inheritance and additive bands enclose dense canonical samples',()=>{
 let state=73619;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
 const records=[8,2,1].flatMap(pixel=>[-1,0].flatMap(y=>[-1,0].map(x=>record(pixel,x,y,(px,py,i)=>pixel<8&&i%3===0?NaN:100*Math.sin(px*.7)+50*Math.cos(py*.9)))));
 records.push(...[-1,0].flatMap(y=>[-1,0].map(x=>record(2,x,y,(_x,_y,i)=>i%4===0?NaN:17*Math.sin(i),2))));
 const boxes=Array.from({length:80},()=>({x:random()*100-50,y:random()*100-50,width:random()*1.5+.01,height:random()*1.5+.01}));
 const {checked}=check(records,boxes);assert.equal(checked,13520);
});
test('source boundaries, far origins and tiny height values retain enclosures',()=>{
 const far=2**36;
 for(const magnitude of [1,2**-140,1e6]){
  const records=[0,1].map(x=>heightRecord(far+x*64,far,1,Float32Array.from({length:4096},(_,i)=>Math.fround(Math.sin(i*.3)*magnitude))));
  check(records,[{x:far+62.8,y:far+20.2,width:1.4,height:.5},{x:far+64,y:far+22,width:0,height:0}]);
 }
});
test('shrinking sparse-field queries converge and source cuts partition large unresolved boxes',()=>{
 const records=[record(4,0,0,(x,y)=>x+y),record(1,0,0,(x,y,i)=>i%3?x-y:NaN)];
 const field=createHeightFieldIntervals(records),p={x:20.23,y:21.37};
 let first,last;
 for(const half of [.2,.02,.002,.0002]){
  const r=field.range({x:p.x-half,y:p.y-half,width:half*2,height:half*2}),width=r[1]-r[0];
  first??=width;last=width;assert.ok(r[0]<=new TerrainSampler(records).sample(p).heightM&&r[1]>=new TerrainSampler(records).sample(p).heightM);
 }
 assert.ok(last<first/100,`${first} -> ${last}`);
 assert.deepEqual(field.range({x:0,y:0,width:1000,height:1000}),[-Infinity,Infinity]);
 const cut=field.integrationCut([{x:0,y:0},{x:1000,y:0},{x:0,y:1000}]);
 assert.ok(cut.value>400&&cut.value<600);assert.equal(cut.value%4,0);
});
test('identical row expressions preserve y independence including shared sparse inheritance',()=>{
 for(const sparse of [false,true]){
  const records=[record(4,0,0,x=>x),record(1,0,0,(x,_y)=>sparse&&x%3===0?NaN:x===32?1:-1)];
  const field=createHeightFieldIntervals(records),wide={x:31.6,y:20.1,width:.1,height:.8},thin={...wide,height:.001};
  assert.deepEqual(field.range(wide),field.range(thin),'y-independent source rows must not gain uncertainty from unrelated y extent');
  check(records,[wide]);
 }
});
test('different stencils with mirrored values retain their actual y dependence',()=>{
 const records=[record(1,0,0,(x,y)=>y%2?32-x:x-31)];
 const {field}=check(records,[{x:31.1,y:20.1,width:.2,height:.8}],24);
 const sampler=new TerrainSampler(records),a=sampler.sample({x:31.2,y:20.1}).heightM,b=sampler.sample({x:31.2,y:20.9}).heightM;
 assert.ok(Math.abs(a-b)>.5);
 const [lo,hi]=field.range({x:31.1,y:20.1,width:.2,height:.8});assert.ok(hi-lo>.5);
});
test('unrepresentable source-cell indices return unknown without an unbounded integer loop',()=>{
 const field=createHeightFieldIntervals([record(2**-24,0,0,()=>1)]);
 for(const x of [1e12,-1e12,1e300]){
  assert.deepEqual(field.range({x,y:x,width:1,height:1}),[-Infinity,Infinity]);
  assert.equal(field.integrationCut([{x,y:x},{x:x+1,y:x},{x,y:x+1}]),undefined);
 }
});
test('tiny interpolated rows cover subnormal nonzero tangent products and their zero transition',()=>{
 const records=[record(1,-1,0,()=>0),record(1,0,0,(x,y)=>x===0?0:((y%4)+1)*2**-149)];
 // Small x is representable at origin zero. The inner smoothstep produces
 // Float64 rows near 1e-162 although authored nodes are valid Float32 values.
 for(const x of [1e-55,2e-59,3e-59,4e-59])check(records,[{x,y:20.01,width:x*.1,height:.98}],64);
});
test('large additive aggregates retain the same canonical order and bounded results',()=>{
 const records=[record(1,0,0,(x,y)=>1e6*Math.sin(x+y))];
 for(let k=0;k<10;k++)records.push(record(2**k,0,0,()=>1e6,2));
 check(records,[{x:20.1,y:20.2,width:.2,height:.3}],24);
});

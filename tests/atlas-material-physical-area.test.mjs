import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {integrateMaterialArea,AreaBudgetExceeded} from '../tools/atlas-prototypes/material-area.mjs';
import {physicalMaterialLayers,physicalMaterialBackground,physicalMaterialCentroidError,physicalMaterialTriangleEstimate} from '../tools/atlas-prototypes/physical-material-layers.mjs';
import {landscapeMaterialLayers,landscapeMaterialBackground} from '../tools/atlas-prototypes/material-sources.mjs';
const dir=mkdtempSync(join(tmpdir(),'atlas-physical-area-')),outfile=join(dir,'api.cjs');
buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/physical-material-field';export * from './src/app/terrain-height';export * from './src/app/terrain-route';export {contains} from './src/app/atlas-landscape';export {colorParts} from './src/app/landscape-brush';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'cjs'});
const {createPhysicalMaterialFieldSnapshot,heightRecord,settingsRecord,routeSpec,contains,colorParts}=createRequire(import.meta.url)(outfile);
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const polygons=box=>[{outer:[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}],holes:[]}];
const height=f=>heightRecord(0,0,1,Float32Array.from({length:4096},(_,i)=>f(i%64,Math.floor(i/64))));
const field=(records,box,sea=0)=>createPhysicalMaterialFieldSnapshot(kind=>records.filter(r=>kind==='height'?r.height:kind==='route'?r.route:r.surface==='freshwater'),box,{settings:settingsRecord(sea).terrainSettings});
const pigment=(box,target,color,operation='paint',opacity=1)=>({polygons:polygons(box),points:[],paint:{version:2,fill:true,target,color,operation,opacity}});
function render(f,box,materials={},width=1,tolerance=1/255,limits){
 const layers=physicalMaterialLayers({field:f,box,landColor:'#ffffff',palette:{water:'#0000ff',forest:'#00ff00',plains:'#ffffff'},...materials});
 return integrateMaterialArea({box,width,height:width,background:physicalMaterialBackground('#ffffff'),layers,tolerance,limits,centroidErrorBound:physicalMaterialCentroidError,triangleEstimate:physicalMaterialTriangleEstimate});
}
const close=(value,expected,error)=>assert.ok(Math.abs(value-expected)<=error+1e-10,`${value} != ${expected} +/- ${error}`);
test('physical straight coast integrates half-cell base color and water with certified error',()=>{
 const box={x:31,y:20,width:2,height:2},f=field([height(x=>x-32)],box),r=render(f,box);
 close(r.pixels[14],.5,r.errorBounds[0]);close(r.pixels[0],.5,r.errorBounds[0]);close(r.pixels[1],.5,r.errorBounds[0]);close(r.pixels[2],1,r.errorBounds[0]);
 assert.ok(r.errorBounds[0]<=1/255);assert.ok(r.stats.subdivisions+r.stats.sourceCuts>0);
});
test('a subpixel physical island survives between the old sample centers',()=>{
 const box={x:0,y:20,width:64,height:1},f=field([height(x=>x===32?1:-1)],box);
 assert.equal(f.sample({x:16,y:20.5}).water,true);assert.equal(f.sample({x:48,y:20.5}).water,true);
 const r=render(f,box,{},1,1/1024);
 close(r.pixels[14],63/64,r.errorBounds[0]);assert.ok(1-r.pixels[14]>.01);
});
test('a genuinely two-dimensional saddle keeps the analytic half-water area',()=>{
 const box={x:31,y:31,width:2,height:2},f=field([height((x,y)=>(x-32)*(y-32))],box),r=render(f,box);
 close(r.pixels[14],.5,r.errorBounds[0]);assert.ok(r.errorBounds[0]<=1/255);
 assert.equal(f.sample({x:31.5,y:31.5}).water,false);
 assert.equal(f.sample({x:32.5,y:31.5}).water,true);
});
test('land/water pigment and erase preserve every channel across a physical coast',()=>{
 const box={x:31,y:20,width:2,height:2},f=field([height(x=>x-32)],box);
 const materials={baseRecords:[{kind:'patch',polygons:polygons(box),values:{terrain:'forest'}}],
  colorRecords:[pigment(box,'water','#ff0000'),pigment(box,'ground','#000000'),pigment(box,'water','#000000','erase',.5)]};
 const r=render(f,box,materials),e=r.errorBounds[0];
 // Wet half ends purple after erasing half the red back to blue; dry half black.
 for(const [c,v]of [[0,0],[1,.5],[2,.5],[3,1],[4,.5],[5,.25],[6,0],[7,0],[8,.75],[9,.25],[10,0],[11,.25],[12,1],[13,0],[14,.5]])close(r.pixels[c],v,e);
});
test('lake holes remain dry and lake level never floods higher ground',()=>{
 const box={x:10,y:10,width:4,height:4},lake={kind:'patch',polygons:polygons(box),surface:'freshwater',waterLevelM:3,points:[],width:0};
 lake.polygons[0].holes=[polygons({x:11,y:11,width:2,height:2})[0].outer];
 const low=field([height(()=>2),lake],box),r=render(low,box);
 close(r.pixels[14],.75,r.errorBounds[0]);
 const high=field([height(()=>4),lake],box);assert.deepEqual(high.range(box).water,[0,0]);
 close(render(high,box).pixels[14],0,0);
});
test('physical route intervals stay explicitly unresolved rather than certifying unmodified ground',()=>{
 const box={x:10,y:10,width:2,height:2},points=[{x:0,y:11},{x:30,y:11}],route=routeSpec('river',points);
 route.nodes=points.map(p=>({...p,z:20,structure:'ground'}));
 const f=field([height(()=>30),{id:'river',kind:'river',points,polygons:[],width:4,route}],box);
 assert.equal(f.sample({x:11,y:11}).water,true);assert.deepEqual(f.range(box).water,[0,1]);
 assert.throws(()=>render(f,box,{},1,1/255,{work:3000}),AreaBudgetExceeded);
});
test('physical targets preserve source composition for legacy strokes, soft cover and v2 erase at coast points',()=>{
 const box={x:31,y:20,width:2,height:2},f=field([height(x=>x-32)],box),whole=polygons(box);
 const cover={polygons:whole,vegetation:{preset:{ground:'#228855',density:.4,edge:.2},edits:[{mode:'thin',polygons:polygons({x:31,y:20,width:2,height:1})}]}};
 const legacy={polygons:whole,points:[{x:32,y:21}],paint:{version:1,target:'water',color:'#8855ff',tip:'soft',radius:1,flow:.3,opacity:.4,seed:17,fill:false}};
 const stroke={polygons:whole,points:[{x:32,y:21}],paint:{version:2,target:'ground',operation:'paint',color:'#ff1122',tip:'round',radius:.8,flow:.4,opacity:.7,seed:23,fill:false}};
 const options={box,landColor:'#ffffff',palette:{water:'#0000ff'},colorParts,edgePolicy:'authored-world',coverRecords:[cover],colorRecords:[legacy,stroke,pigment(box,'water','#ff0000'),pigment(box,'water','#000000','erase',.4),pigment(box,'ground','#000000','erase',.3)]};
 const original=JSON.stringify(options.colorRecords),actualLayers=physicalMaterialLayers({field:f,...options});
 const apply=(layers,initial,p)=>{const value=[...initial];for(const layer of layers){const polygons=layer.geometry.map(poly=>({outer:poly[0].map(([x,y])=>({x,y})),holes:poly.slice(1).map(r=>r.map(([x,y])=>({x,y})))}));if(contains(p,polygons))layer.paint(value,p);}return value;};
 for(const x of [31.1,31.7,32,32.2,32.8])for(const y of [20.1,20.7,21.2,21.8]){
  const p={x,y},wet=f.sample(p).water;
  const reference=landscapeMaterialLayers({...options,waterGeometry:wet?whole:[]});
  const expected=apply(reference,landscapeMaterialBackground('#ffffff'),p),actual=apply(actualLayers,physicalMaterialBackground('#ffffff'),p);
  assert.deepEqual(actual,[...expected,Number(wet)]);
 }
 assert.equal(JSON.stringify(options.colorRecords),original,'physical gating must not rewrite author paint targets');
});

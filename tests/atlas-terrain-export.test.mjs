import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/atlas-terrain-export';"},outfile:'.build/atlas-terrain-export-test.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'capture-image-boundary',setup(b){
 b.onResolve({filter:/^\.\/terrain-image$/},()=>({path:'image-boundary',namespace:'probe'}));
 b.onLoad({filter:/.*/,namespace:'probe'},()=>({contents:'export async function terrainImage(...args){return globalThis.captureTerrainImage(args);} export async function publicTerrainImage(){throw Error("GM pixels must not enter public output");}'}));
}}]});
const {atlasTerrainExport}=createRequire(import.meta.url)('../.build/atlas-terrain-export-test.cjs');
const box={x:100,y:200,width:300,height:200};
const tile=(content,data)=>({box:{x:120,y:230,width:50,height:40},width:50,height:40,content,data});
const options={audience:'gm',width:900,height:600,format:'png',references:false,grid:false,level:'local',floorId:'ground',roofs:true,contours:0};
function fixture(t){
 const snapshot={revision:7,cities:[],bindings:[],entrances:[],region:{
  fence:'source-7',landscape:{state:'ready',coverage:{complete:true,mode:'raster'},records:[],
   tiles:[tile(undefined,'ground'),tile('objects','forest'),tile('objects','road')]}
 }};
 const priorWindow=globalThis.window,priorCapture=globalThis.captureTerrainImage;
 const projection={revision:7,fence:'source-7'};let captures=0;
 globalThis.window={campaign:{async atlasTerrainProjection(){return {ok:true,value:projection};}}};
 globalThis.captureTerrainImage=async args=>{captures++;return args[7];};
 t.after(()=>{globalThis.window=priorWindow;globalThis.captureTerrainImage=priorCapture;});
 return {snapshot,projection,captures:()=>captures,run:()=>atlasTerrainExport('token',snapshot,{box,frame:box},options,()=>true,()=>{})};
}
const images=node=>[...(node.kind==='image'?[node]:[]),...node.children.flatMap(images)];
test('perspective export preserves dense forest and road object tiles at world positions without repainting ground',async t=>{
 const f=fixture(t),before=structuredClone(f.snapshot),scene=await f.run(),tiles=images(scene);
 assert.deepEqual(tiles.map(i=>i.geometry.source),['forest','road']);
 for(const image of tiles){assert.equal(image.geometry.x,20);assert.equal(image.geometry.y,30);assert.equal(image.geometry.width,50);assert.equal(image.geometry.height,40);}
 assert.deepEqual(f.snapshot,before);assert.equal(f.captures(),1);
});
test('incomplete layers and changed projection fences cannot produce a partial forest export',async t=>{
 const f=fixture(t);f.snapshot.region.landscape.coverage.complete=false;
 await assert.rejects(f.run,/nicht vollständig/);assert.equal(f.captures(),0);
 f.snapshot.region.landscape.coverage.complete=true;f.projection.fence='changed';
 await assert.rejects(f.run,/während der Ausgabe geändert/);assert.equal(f.captures(),0);
});

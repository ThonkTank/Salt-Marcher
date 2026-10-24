import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/app/atlas-surface-draft.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {AtlasSurfaceDraft}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const view={box:{x:0,y:0,width:64,height:64},frame:{x:0,y:0,width:64,height:64},columns:65,rows:65,focusM:20,tilt:0,rotation:0,exaggeration:1};
function tile(x=0){const grid={view:{...view,box:{...view.box,x:x*64}},heights:new Float32Array(4225).fill(20),editing:{ground:new Float32Array(4225).fill(20),water:new Float32Array(4225)},seaLevelM:0};const address={lod:-2,x,y:0};return{tile:address,revision:0,fence:'a',terrain:{tile:address,revision:0,fence:'a',projection:{grid}},material:{tile:address,revision:0,fence:'a',width:256,height:256,channels:{baseColor:new Uint8Array(256*256*4).fill(255),water:new Uint8Array(256*256),forest:new Uint8Array(256*256)}}};}
const stroke={mode:'raise',radius:8,strength:10,feather:.5,samples:[{x:32,y:32,t:0},{x:32,y:32,t:1000}]};
test('a second unacknowledged height gesture starts from first local ground without mutating canonical source',()=>{
 const base=tile(),outside=tile(2),first=new AtlasSurfaceDraft([base,outside],view);
 assert(first.height(stroke));assert.equal(first.tiles[1],outside);const centre=32*65+32;
 assert.equal(base.terrain.projection.grid.heights[centre],20);assert.equal(first.tiles[0].terrain.projection.grid.heights[centre],30);
 const second=new AtlasSurfaceDraft(first.tiles,view);second.height(stroke);
 assert.equal(second.tiles[0].terrain.projection.grid.heights[centre],40);assert.equal(second.tiles[0].terrain.projection.grid.editing.ground[centre],40);
 assert.equal(second.height(stroke),false);
});
test('local pigment honors author mask and water target, with repeated snapshots composed only once',()=>{
 const base=tile(),center=128*256+128;
 const record={kind:'patch',points:[{x:32,y:32}],polygons:[{outer:[{x:24,y:24},{x:40,y:24},{x:40,y:40},{x:24,y:40}],holes:[]}],paint:{version:2,color:'#ff0000',target:'water',radius:8,opacity:.5,flow:1,tip:'round',strokes:[[{x:32,y:32}]],fill:false,seed:1}};
 const draft=new AtlasSurfaceDraft([base],view);draft.color(record);assert.equal(draft.tiles[0].material.channels.baseColor[center*4+1],255);
 record.paint.target='ground';draft.color(record);const first=draft.tiles[0].material.channels.baseColor;assert.equal(first[center*4+1],128);draft.color(record);assert.deepEqual(draft.tiles[0].material.channels.baseColor,first);assert.equal(first[0],255);
 const next=new AtlasSurfaceDraft(draft.tiles,view);next.color(record);assert.equal(next.tiles[0].material.channels.baseColor[center*4+1],64);assert.equal(base.material.channels.baseColor[center*4+1],255);
});

test('raising through water updates provisional coast channels and cancellation retains the preceding draft',()=>{
 const base=tile();base.terrain.projection.grid.editing.ground.fill(-2);base.terrain.projection.grid.heights.fill(0);base.material.channels.water.fill(255);
 const first=new AtlasSurfaceDraft([base],view);assert(first.height(stroke));const centre=128*256+128;
 assert.equal(first.tiles[0].material.channels.water[centre],0);assert.equal(base.material.channels.water[centre],255);
 const second=new AtlasSurfaceDraft(first.tiles,view);second.height({...stroke,mode:'lower'});
 assert.equal(second.tiles[0].material.channels.water[centre],255);assert.equal(second.baseTiles[0].material.channels.water[centre],0);
});

test('a height segment crossing a tile is applied even when both endpoints are outside',()=>{
 const base=tile(),draft=new AtlasSurfaceDraft([base],view);
 assert(draft.height({...stroke,samples:[{x:-20,y:32,t:0},{x:84,y:32,t:1000}]}));
 assert(draft.tiles[0].terrain.projection.grid.heights[32*65+32]>20);
});

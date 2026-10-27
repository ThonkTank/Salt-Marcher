import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/atlas-terrain-model-client';export * from './src/app/atlas-terrain-model-worker';"},bundle:true,write:false,format:'esm',platform:'node'});
const {AtlasTerrainModelClient,TerrainModelWorkerState,terrainModelBytes,terrainModelBuffers,encodeTerrainModel,decodeTerrainModel,TERRAIN_MODEL_MEMORY}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const sourceKey=JSON.stringify(['campaign-token','source',1]);
function tile(x=0){const address={lod:0,x,y:-1},box={x:x*256,y:-256,width:256,height:256},view={box,frame:box,columns:65,rows:65,focusM:0,tilt:0,rotation:0,exaggeration:1},grid={view,heights:new Float32Array(4225).fill(300),seaLevelM:0,editing:{ground:new Float32Array(4225).fill(300),water:new Float32Array(4225)}};return{tile:address,fence:'source',revision:1,terrain:{tile:address,fence:'source',revision:1,projection:{heightOnly:true,source:'source',fence:'source',revision:1,generation:0,draft:false,grid,width:0,height:0,pixels:new Uint8Array()}},material:{tile:address,fence:'source',revision:1,width:256,height:256,channels:emptyMaterialChannels(65536)}};}
class Port{onmessage=null;onerror=null;onmessageerror=null;messages=[];terminated=false;postMessage(value,transfer=[]){this.messages.push(structuredClone(value,{transfer}));}terminate(){this.terminated=true;}reply(value){this.onmessage?.({data:value});}}
const goal=(tiles,request='a')=>({tiles,source:'source',request,camera:'camera',complete:true,animate:true});
const emptyFieldGeometry=()=>({vertices:new Float32Array(),indices:new Uint32Array(),draws:[],gpuGeometryBytes:0,gpuDrawMetadataBytes:0,oldSourceCount:0,newSourceCount:0,draftSourceCount:0});
const response=job=>({kind:'result',epoch:job.epoch,job:job.job,base:job.base,source:job.source,payload:{models:[],tiles:[],fieldGeometry:emptyFieldGeometry()},buffers:[],metrics:{workerHeldBytes:0}});
test('worker jobs reserve the live surface geometry even when it predates the last worker reply',()=>{
 const port=new Port(),retained=new Float32Array(128),inventory=()=>({retained:[retained],gpuGeometryBytes:17_164_040,drawMetadataBytes:214_528});
 const client=new AtlasTerrainModelClient('source',async()=>{},()=>{},()=>port,inventory);
 client.submit(goal([]));
 assert.equal(port.messages[0].displayGeometryBytes,17_164_040);
 assert.equal(port.messages[0].displayDrawMetadataBytes,214_528);
 assert.equal(port.messages[0].displayBytes,retained.byteLength+214_528);
 client.dispose();
});
test('Worker scheduler copies only one job, coalesces latest and waits for its exact drawn content',async()=>{
 const port=new Port(),a=tile(),b=tile(1),c=tile(2),shown=[],errors=[];let finish;
 const client=new AtlasTerrainModelClient('source',snapshot=>{shown.push(snapshot);return new Promise(resolve=>{finish=resolve;});},e=>errors.push(e),()=>port);
 client.submit(goal([a]));client.submit(goal([b],'b'));client.submit(goal([c],'c'));
 assert.equal(port.messages.length,1);assert.equal(a.terrain.projection.grid.heights.byteLength,16900,'Stream input is never detached');
 const first=port.messages[0];port.reply({...response(first),epoch:0});await flush();assert.equal(shown.length,0,'Stale epoch cannot change display');
 port.reply(response(first));await flush();assert.equal(shown.length,1);assert.equal(shown[0].request,'a');assert.equal(port.messages.length,1,'A generic response is not a GPU acknowledgement');
 finish();await flush();assert.equal(port.messages[1].kind,'displayed');assert.equal(port.messages[2].kind,'build');assert.equal(port.messages[2].base,first.job);assert.equal(port.messages[2].tiles[0].tile.x,2,'Only newest uncopied target is dispatched');assert.equal(errors.length,0);client.dispose();
});
test('All worker failures terminate ownership; disposal fences a delayed response and resolves the scheduler wait',async()=>{
 for(const kind of ['error','messageerror','postMessage','source','dispose']){
  const port=new Port(),errors=[],shown=[];if(kind==='postMessage')port.postMessage=()=>{throw Error('copy failure');};
  const client=new AtlasTerrainModelClient('source',s=>{shown.push(s);return new Promise(()=>{});},e=>errors.push(e),()=>port);client.submit(goal([tile()]));
  const oldHandler=port.onmessage,job=port.messages[0];
  if(kind==='error')port.onerror({message:'broken'});if(kind==='messageerror')port.onmessageerror({});if(kind==='source')client.submit({...goal([tile()]),source:'other'});
  if(kind==='dispose'){port.reply(response(job));await flush();client.dispose();}
  assert.equal(port.terminated,true);assert.equal(errors.length,kind==='dispose'?0:1);oldHandler?.({data:response(job??{epoch:client.epoch,job:1,base:0,source:'source'})});await flush();assert.equal(shown.length,kind==='dispose'?1:0);client.submit(goal([tile()]));assert(port.messages.length<=1);
 }
});
test('Buffer aliases are counted and transferred once; oversized input fails before copying',()=>{
 const buffer=new ArrayBuffer(64),value={a:new Uint8Array(buffer),b:new Float32Array(buffer),m:new Map([['buffer',buffer]])};assert.equal(terrainModelBytes(value),64);assert.equal(terrainModelBuffers(value).length,1);
 const port=new Port(),errors=[],t=tile();t.terrain.projection.grid.heights=new Float32Array(TERRAIN_MODEL_MEMORY.input/4+1);
 const client=new AtlasTerrainModelClient('source',async()=>{},e=>errors.push(e),()=>port);client.submit(goal([t]));assert.equal(port.messages.length,0);assert.equal(port.terminated,true);assert.match(errors[0].message,/Eingabespeicher/);assert(t.terrain.projection.grid.heights.byteLength>TERRAIN_MODEL_MEMORY.input);
});
test('Pure field worker binds jobs to acknowledged snapshots without rebuilding CPU morph fields',()=>{
 const state=new TerrainModelWorkerState(),a=tile(),before=a.terrain.projection.grid.heights.slice(),base={epoch:7,job:1,base:0,source:sourceKey},first=state.build({kind:'build',...base,tiles:[a],ids:[1],animate:true,displayBytes:0});
 const decodedFirst=decodeTerrainModel(first.payload,first.buffers),firstValue=decodedFirst.value;assert.equal(firstValue.models.length,1);assert.deepEqual(firstValue.tiles[0].terrain.projection.grid.editing,a.terrain.projection.grid.editing,'Draft basis preserves canonical editing data independently from derived mesh heights');assert.deepEqual(a.terrain.projection.grid.heights,before);assert.throws(()=>state.build({kind:'build',...base,job:2,tiles:[tile()],ids:[2],animate:true,displayBytes:0}),/Auftragsbindung/);
 assert.throws(()=>state.displayed({...base,job:8}),/veraltet/);state.displayed({...base,kind:'displayed',bufferIds:[...decodedFirst.buffers.keys()]});
 const b=tile();b.terrain.projection.grid.heights.fill(350);const second=state.build({kind:'build',...base,job:2,base:1,tiles:[b],ids:[2],animate:true,displayBytes:terrainModelBytes(firstValue)});
 const decodedSecond=decodeTerrainModel(second.payload,second.buffers,decodedFirst.buffers),secondValue=decodedSecond.value;assert.equal(secondValue.models[0].transition,undefined);assert(secondValue.models[0].grid.heights.every(h=>h===350));assert(second.metrics.fieldModelsMs>=0);assert.equal(second.metrics.normalsMs,undefined);assert.equal(second.metrics.materialsMs,undefined);assert.equal(second.metrics.morphInclusiveMs,undefined);assert(second.metrics.chargedPeakBytes<=TERRAIN_MODEL_MEMORY.total);assert(second.metrics.resultBytes<=TERRAIN_MODEL_MEMORY.result);
 state.displayed({...base,kind:'displayed',job:2,base:1,bufferIds:[...decodedSecond.buffers.keys()]});assert.throws(()=>state.build({kind:'build',...base,job:3,base:1,tiles:[b],ids:[2],animate:true,displayBytes:0}),/Auftragsbindung/);
});
test('worker rejects malformed source before geometry and accepts a camera-bound tilted draft',()=>{
 const base={kind:'build',epoch:7,job:1,base:0,source:sourceKey,ids:[1],animate:false,displayBytes:0};
 for(const badSource of ['source','["campaign-token","source"]',JSON.stringify(['campaign-token','other',1]),JSON.stringify(['campaign-token','source',2])]){
  assert.throws(()=>new TerrainModelWorkerState().build({...base,source:badSource,tiles:[tile()]}),/Quellschlüssel|vollständige Kacheln|Atlas-Terrainquelle/);
 }
 for(const corrupt of [
  t=>{t.terrain.projection.grid.view.refinement={x:32,y:-224,width:32,height:32};},
  t=>{t.terrain.projection.grid.view.box.x++;},
  t=>{t.terrain.projection.grid.heights[0]=NaN;},
  t=>{t.terrain.projection.grid.editing.water=new Float32Array(1);},
 ]){
  const state=new TerrainModelWorkerState(),bad=tile();corrupt(bad);
  assert.throws(()=>state.build({...base,tiles:[bad]}),/Atlas-Terrainquelle ungültig/);
  assert.equal(state.build({...base,tiles:[tile()]}).kind,'result','a rejected input leaves the worker ready for a valid job');
 }
 const draft=tile(),view=draft.terrain.projection.grid.view;
 draft.terrain.projection.grid.view={...view,frame:{x:view.box.x+16,y:view.box.y+8,width:192,height:192},focusM:300,tilt:45,rotation:25};
 const result=new TerrainModelWorkerState().build({...base,tiles:[draft]});
 assert.equal(result.kind,'result');
});
test('Stable immutable buffer identities preserve GPU attribute aliases across transferred replies',async()=>{
 const port=new Port(),worker=new TerrainModelWorkerState(),shown=[],errors=[],a=tile();
 const client=new AtlasTerrainModelClient(sourceKey,async snapshot=>{shown.push(snapshot);},e=>errors.push(e),()=>port);
 client.submit({...goal([a]),source:sourceKey});const first=worker.build(port.messages[0]);port.reply(first);await flush();worker.displayed(port.messages[1]);
 client.submit({...goal([{...a,terrain:{...a.terrain},material:{...a.material}}],'next-camera'),source:sourceKey});assert.equal(port.messages[2].tiles[0],null,'An acknowledged immutable source needs no new input copy');const second=worker.build(port.messages[2]);assert.equal(port.messages[2].displayGeometryBytes,shown[0].fieldGeometry.gpuGeometryBytes);assert.equal(port.messages[2].displayDrawMetadataBytes,shown[0].fieldGeometry.gpuDrawMetadataBytes);assert.equal(second.buffers.length,2,'Only the newly prepared field vertex and index buffers cross again');assert.equal(second.metrics.expectedTransportBytes,second.metrics.transportBytes);assert.equal(second.metrics.fieldGeometryBytes,terrainModelBytes(second.buffers));port.reply(second);await flush();
 assert.equal(shown.length,2);assert.equal(shown[1].metrics.gpuScratchBytes,shown[1].fieldGeometry.vertices.byteLength,'adoption reserves the actual slot-rebased field vertices');assert.equal(shown[1].models[0].mesh.attributes.POSITION.value,shown[0].models[0].mesh.attributes.POSITION.value);assert.equal(shown[1].models[0].texture.data,shown[0].models[0].texture.data);assert.equal(shown[1].tiles[0].terrain.projection.grid.editing.ground,shown[0].tiles[0].terrain.projection.grid.editing.ground);assert(shown[1].metrics.reusedBytes>0);assert.equal(errors.length,0);client.dispose();
});
test('Transport preserves offset aliases, refuses missing identities and reserves before copying',()=>{
 const buffer=new ArrayBuffer(128),a=new Float32Array(buffer,16,8),b=new Uint8Array(buffer,8,24);a.fill(77);let charged=0;const packet=encodeTerrainModel({a,b,again:a},new Set(),()=>1,bytes=>{charged+=bytes;});assert.equal(charged,128);assert.equal(packet.buffers.length,1);const decoded=decodeTerrainModel(packet.payload,packet.buffers).value;assert.equal(decoded.a,decoded.again);assert.equal(decoded.a.buffer,decoded.b.buffer);assert.equal(decoded.a.byteOffset,16);assert.equal(decoded.a[0],77);assert.equal(buffer.byteLength,128);
 assert.throws(()=>encodeTerrainModel({a,b},new Set(),()=>1,()=>{throw Error('before allocation');}),/before allocation/);const known=encodeTerrainModel({a,b},new Set([1]),()=>1,()=>{throw Error('No new backing store');});assert.equal(known.transportBytes,0);assert.throws(()=>decodeTerrainModel(known.payload,[]),/fehlt/);
});

test('the next input includes retained worker RAM in its guard before any copy',async()=>{
 const port=new Port(),errors=[];
 const client=new AtlasTerrainModelClient('source',async()=>{},e=>errors.push(e),()=>port);
 client.submit(goal([]));const first=port.messages[0];port.reply({...response(first),metrics:{workerHeldBytes:TERRAIN_MODEL_MEMORY.total-1024*1024}});await flush();
 const original=globalThis.structuredClone;let copies=0;globalThis.structuredClone=(...args)=>{copies++;return original(...args);};
 try{client.submit(goal([tile(),tile(1)],'overlap'));}finally{globalThis.structuredClone=original;}
 assert.equal(copies,0,'The rejected overlap must not allocate an input clone');assert.equal(port.messages.length,2,'Only the first job and its acknowledgement were sent');assert.equal(port.terminated,true);assert.match(errors[0].message,/Eingabespeicher/);
});


test('worker counts disjoint 32 old and 32 new geometry plus transport and adoption before allocating the next field',()=>{
 const state=new TerrainModelWorkerState(),firstTiles=Array.from({length:32},(_,i)=>tile(i)),binding={kind:'build',epoch:11,source:sourceKey,animate:true},
   first=state.build({...binding,job:1,base:0,tiles:firstTiles,ids:firstTiles.map((_,i)=>i+1),displayBytes:0}),decoded=decodeTerrainModel(first.payload,first.buffers),value=decoded.value;
 state.displayed({...binding,kind:'displayed',job:1,base:0,bufferIds:[...decoded.buffers.keys()]});
 const secondTiles=Array.from({length:32},(_,i)=>tile(32+i)),second=state.build({...binding,job:2,base:1,tiles:secondTiles,ids:secondTiles.map((_,i)=>i+33),
   displayBytes:terrainModelBytes(value)+value.fieldGeometry.vertices.byteLength,displayGeometryBytes:value.fieldGeometry.gpuGeometryBytes,displayDrawMetadataBytes:value.fieldGeometry.gpuDrawMetadataBytes}),next=decodeTerrainModel(second.payload,second.buffers,decoded.buffers).value;
 assert.equal(next.fieldGeometry.oldSourceCount,32);assert.equal(next.fieldGeometry.newSourceCount,32);assert.equal(next.fieldGeometry.draws.length,64);
 assert.equal(second.metrics.expectedTransportBytes,second.metrics.transportBytes);assert.equal(second.metrics.adoptionVertexBytes,next.fieldGeometry.vertices.byteLength);
 assert.equal(second.metrics.fieldMetadataPeakBytes,next.fieldGeometry.gpuDrawMetadataBytes*4);assert(second.metrics.chargedPeakBytes<TERRAIN_MODEL_MEMORY.total);
 const blocked=new TerrainModelWorkerState();
 assert.throws(()=>blocked.build({...binding,job:1,base:0,tiles:[tile()],ids:[1],displayBytes:0,displayGeometryBytes:24*1024*1024}),/Geometriebudget/,'held geometry is included before new field backing stores are made');
});

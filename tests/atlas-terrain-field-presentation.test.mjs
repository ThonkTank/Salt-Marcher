import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';

const {outputFiles}=await build({stdin:{contents:"export * from './src/app/atlas-terrain-field-presentation';export * from './src/app/atlas-mesh-ray';export * from './src/app/atlas-terrain-tile-model';export {terrainGridLayout} from './src/app/terrain-grid-layout';export {AtlasRasterTileStream} from './src/app/atlas-raster-tile-stream';export {atlasTerrainTileQuery} from './src/app/atlas-terrain-tile';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {prepareAtlasTerrainFieldLookup,prepareAtlasTerrainFieldEdgeOwners,atlasTerrainFieldMaterialWeights,atlasTerrainFieldBoundaryOwner,atlasTerrainFieldPhysicalSupport,atlasTerrainFieldGradient,atlasTerrainFieldSample,atlasTerrainFieldPresentationNormal,ATLAS_TERRAIN_FIELD_META_ROWS,atlasTerrainFieldPlannedTables,ATLAS_TERRAIN_FIELD_FS,prepareAtlasTerrainFieldGeometry,preflightAtlasTerrainFieldPilotGpu,ATLAS_TERRAIN_FIELD_GPU,ATLAS_TERRAIN_PREPARED_GPU,ATLAS_TERRAIN_FIELD_SLOTS,AtlasTerrainFieldGpuOwner,AtlasTerrainFieldLayer,atlasTerrainTileModels,packAtlasTerrainFieldSlotMetadata,ATLAS_TERRAIN_FIELD_SLOT_META_FLOATS,terrainGridLayout,atlasTerrainFieldDrawOffsets,createAtlasTerrainFieldRayIndex,ATLAS_TERRAIN_FIELD_VS,ATLAS_TERRAIN_PREPARED_VS,sameAtlasTerrainFieldSources,AtlasRasterTileStream,atlasTerrainTileQuery}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

test('prepared vertex shader uses the B hi/lo graph, direct draft endpoint and unchanged material fragment shader',()=>{
  const switchSource=AtlasTerrainFieldLayer.prototype.getShaders.toString();
  assert.match(switchSource,/preparedBasis/);
  assert.match(switchSource,/ATLAS_TERRAIN_PREPARED_VS/);
  assert.match(switchSource,/ATLAS_TERRAIN_FIELD_FS/);
  assert.match(ATLAS_TERRAIN_PREPARED_VS,/if \(alpha == 1\.0\) return hasDraft \? draftValue : newValue/);
  assert.match(ATLAS_TERRAIN_PREPARED_VS,/terrainPreparedRelative\(height,atlasTerrainField\.frameHeightPair\)/);
  assert.match(ATLAS_TERRAIN_PREPARED_VS,/fieldNormal=vec3\(-physicalX,-physicalY,1\.0\)/);
  assert.doesNotMatch(ATLAS_TERRAIN_PREPARED_VS,/fieldSampleDirect|fieldNodeNormal|normalize\(fieldNormal\)/);
});

test('conditional P GPU model counts two basis generations, five arrays, three table pairs and picker resize together',()=>{
  const width=1920,height=1080,pixels=width*height;
  const color={width,height,colorAttachments:[{texture:{format:'rgba8unorm',samples:1}}],depthStencilAttachment:{texture:{format:'depth24plus',samples:1}}};
  const depth={width,height,colorAttachments:[{texture:{format:'rgba32float',samples:1}}],depthStencilAttachment:{texture:{format:'depth24plus',samples:1}}};
  const arrays=['base','masks','cover','relief'].map(()=>({width:256,height:256,depth:128,format:'rgba8unorm',samples:1}));
  arrays.push({width:65,height:65,depth:128,format:'r32float',samples:1});
  const tablePair=atlasTerrainFieldPlannedTables(),input={drawingWidth:width,drawingHeight:height,observedLumaGpuBytes:0,materialTextures:[],morphTextures:[],
    picker:{color,depth,drawnColor:color,drawnDepth:depth},previousDrawingSize:[width,height],candidatePickerSize:[width,height],
    fieldArraysResident:true,fieldArrayTextures:arrays,retainedTables:[...tablePair,...tablePair.map(value=>({...value}))],plannedTables:tablePair,
    retainedFieldGpuGeometryBytes:30_622_928,newFieldGpuGeometryBytes:30_622_928,retainedDrawMetadataBytes:1117*128,newDrawMetadataBytes:1117*128};
  const peak=preflightAtlasTerrainFieldPilotGpu(input,ATLAS_TERRAIN_PREPARED_GPU);
  assert.equal(peak.fieldArraysBytes,136_380_928);assert.equal(peak.geometryBytes,61_245_856);
  assert.equal(peak.tablesBytes,3*(128*25*16+64*256));
  assert.equal(peak.defaultOldAndNew,40*2*pixels);assert.equal(peak.pickerOldAndNew,28*2*pixels);
  assert(peak.headroomBytes>0,'this is a conditional model pass, not a hardware qualification');
});

test('field screen callback requires every real indexed Model draw and keeps SimpleMesh uniforms',()=>{
  const draws=Array.from({length:3},(_,i)=>({origin:{x:i,y:0},bounds:{x:i,y:0,width:1,height:1},oldSlot:0,newSlot:32,firstIndex:i*3,indexCount:3}));
  const events=[],uniforms=[],results=[true,true,true];let calls=0;
  const model={indexBuffer:{},instanceCount:1,pipeline:{isErrored:false},shaderInputs:{setProps:value=>uniforms.push(value)},setBindings(){},setIndexCount(){},setDrawOffsets(){},draw(){return results[calls++];}};
  const props={geometry:{draws,indices:new Uint32Array(9)},owner:{arrays:{},uploadSlotMetadata(){}},tables:{},oldModels:[],newModels:[],draftModels:[],oldBase:0,newBase:32,draftBase:64,alpha:.7,frameOrigin:{x:0,y:0,z:0},exaggeration:1,terrainStyle:{mode:'relief',lightDegrees:0,strength:1},seaLevelM:0,materialBand:1,sizeScale:1,_instanced:true,onDrawSuccess:alpha=>events.push(alpha)};
  const layer={state:{model,hasNormals:false},context:{renderPass:{}},props,getNumInstances:()=>1};
  const run=()=>AtlasTerrainFieldLayer.prototype.draw.call(layer,{shaderModuleProps:{picking:{isActive:false}}});
  run();assert.deepEqual(events,[Math.fround(.7)]);assert.equal(calls,3);assert(uniforms.some(value=>value.simpleMesh?.composeModelMatrix===true&&value.simpleMesh.flatShading===true));
  for(const failedAt of [0,1,2]){calls=0;events.length=0;results.fill(true);results[failedAt]=false;run();assert.deepEqual(events,[],`false at batch ${failedAt} cannot confirm`);}
  calls=0;events.length=0;results.fill(true);layer.props={...props,geometry:{...props.geometry,draws:[...draws.slice(0,1),{...draws[1],indexCount:0},draws[2]]}};assert.throws(run,/Screenpartition/);assert.deepEqual(events,[]);
  layer.props=props;layer.state.model=null;run();assert.deepEqual(events,[]);
  layer.state.model=model;model.instanceCount=0;run();assert.deepEqual(events,[]);model.instanceCount=1;
  calls=0;run();assert.deepEqual(events,[Math.fround(.7)]);
  calls=0;events.length=0;AtlasTerrainFieldLayer.prototype.draw.call(layer,{shaderModuleProps:{picking:{isActive:1}}});assert.deepEqual(events,[]);
  calls=0;results[0]=false;model.pipeline.isErrored=true;assert.throws(run,/Screenpipeline fehlgeschlagen/);assert.deepEqual(events,[]);
  model.pipeline.isErrored=false;results[0]=true;
  calls=0;results[0]=false;model._drawBlockedReason='invalid indexed draw';model._pipelineNeedsUpdate=false;
  assert.throws(run,/invalid indexed draw/);assert.deepEqual(events,[]);
  model._pipelineNeedsUpdate='rebuilding';calls=0;run();assert.deepEqual(events,[]);
  model._drawBlockedReason=false;model._pipelineNeedsUpdate=false;results[0]=true;
  model.draw=()=>{throw Error('injected Model draw failure');};assert.throws(run,/injected Model draw failure/);assert.deepEqual(events,[]);
});

test('prepared endframe skips old-only partitions but requires every surviving Model draw',()=>{
  const oldOnly={origin:{x:0,y:0},bounds:{x:0,y:0,width:1,height:1},oldSlot:0,newSlot:-1,firstIndex:0,indexCount:3};
  const transition={origin:{x:1,y:0},bounds:{x:1,y:0,width:1,height:1},oldSlot:0,newSlot:32,firstIndex:3,indexCount:3};
  let calls=0,accepted=true;const uniforms=[],screens=[];
  const model={indexBuffer:{},instanceCount:1,pipeline:{isErrored:false},shaderInputs:{setProps:value=>uniforms.push(value)},setBindings(){},setIndexCount(){},setDrawOffsets(){},draw(){calls++;return accepted;}};
  const props={geometry:{draws:[oldOnly,transition],indices:new Uint32Array(6)},endFrameDraws:[{...oldOnly,oldSlot:-1},{...transition,oldSlot:-1}],owner:{arrays:{},uploadSlotMetadata(){}},tables:{},oldModels:[],newModels:[],draftModels:[],oldBase:0,newBase:32,draftBase:64,alpha:1,frameOrigin:{x:0,y:0,z:0},exaggeration:1,terrainStyle:{mode:'relief',lightDegrees:0,strength:1},seaLevelM:0,materialBand:1,sizeScale:1,_instanced:true,onDrawSuccess:alpha=>screens.push(alpha)};
  const layer={state:{model,hasNormals:false},context:{renderPass:{}},props,getNumInstances:()=>1};
  const run=()=>AtlasTerrainFieldLayer.prototype.draw.call(layer,{shaderModuleProps:{picking:{isActive:false}}});
  run();assert.equal(calls,1);assert.deepEqual(screens,[1]);
  assert.equal(uniforms.filter(value=>value.atlasTerrainField).length,1);
  assert.equal(uniforms.find(value=>value.atlasTerrainField).atlasTerrainField.oldSlot,-1);
  calls=0;accepted=false;screens.length=0;run();assert.equal(calls,1);assert.deepEqual(screens,[]);
  calls=0;accepted=true;layer.props={...props,endFrameDraws:[{...oldOnly,oldSlot:-1,newSlot:-1},{...transition,oldSlot:-1,newSlot:-1}]};run();assert.equal(calls,0);assert.deepEqual(screens,[],'no active new draw cannot fabricate a Screen');
  layer.props={...props,alpha:.5};assert.throws(run,/Endpartition ohne Quelle/);
});

function square(x,y,size){
  const box={x,y,width:size,height:size},origin={x,y,heightM:0};
  const view={box,columns:2,rows:2};
  return {grid:{view},object:{origin},mesh:{attributes:{POSITION:{value:Float32Array.from([0,0,0,size,0,0,0,size,0,size,size,0])}},indices:{value:Uint32Array.from([0,1,2,1,3,2])}}};
}
function grid(x,y,size){
  const box={x,y,width:size,height:size},origin={x,y,heightM:0},p=new Float32Array(65*65*3),indices=new Uint32Array(64*64*6);let at=0;
  for(let row=0;row<65;row++)for(let col=0;col<65;col++){const i=(row*65+col)*3;p[i]=col*size/64;p[i+1]=row*size/64;}
  for(let row=0;row<64;row++)for(let col=0;col<64;col++){const i=row*65+col;indices.set([i,i+1,i+65,i+1,i+66,i+65],at);at+=6;}
  return {grid:{view:{box,columns:65,rows:65},heights:new Float32Array(65*65)},object:{origin,id:`terrain-tile:${x}/${y}`,target:{kind:'terrain'}},mesh:{attributes:{POSITION:{value:p}},indices:{value:indices}}};
}
function sourceTile(x,y,lod){
  const address={lod,x,y},size=256*2**lod,box={x:x*size,y:y*size,width:size,height:size},view={box,frame:box,columns:65,rows:65};
  return {tile:address,revision:1,fence:'a',terrain:{tile:address,revision:1,fence:'a',projection:{grid:{view,heights:new Float32Array(65*65).fill(300)}}},material:{tile:address,revision:1,fence:'a',width:256,height:256,channels:emptyMaterialChannels(65536)}};
}
function areas(result){
  const out=new Map();
  for(const draw of result.draws){let area=0;
    for(let i=draw.firstIndex;i<draw.firstIndex+draw.indexCount;i+=3){
      const point=j=>{const at=result.indices[i+j]*4;return{x:draw.origin.x+result.vertices[at],y:draw.origin.y+result.vertices[at+1]};};
      const a=point(0),b=point(1),c=point(2);area+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
    }
    out.set(`${draw.oldSlot}/${draw.newSlot}`,(out.get(`${draw.oldSlot}/${draw.newSlot}`)??0)+area);
  }
  return out;
}

test('old fine surface survives a coarser target without a duplicate or uncovered region',()=>{
  const result=prepareAtlasTerrainFieldGeometry([square(0,0,1)],[square(0,0,2)]),a=areas(result);
  assert.equal(a.get('0/0'),1);
  assert.equal(a.get('-1/0'),3);
  assert.equal([...a.values()].reduce((x,y)=>x+y,0),4);
  assert.equal(result.gpuGeometryBytes,result.vertices.byteLength+result.indices.byteLength);
  assert(result.vertices.length/4<=4*result.indices.length/3,'cut nodes are shared inside a source pair');
});

test('old-only regions remain in the common mesh while a smaller target is arriving',()=>{
  const result=prepareAtlasTerrainFieldGeometry([square(0,0,2)],[square(0,0,1)]),a=areas(result);
  assert.equal(a.get('0/0'),1);
  assert.equal(a.get('0/-1'),3);
  assert.equal([...a.values()].reduce((x,y)=>x+y,0),4);
  assert(result.vertices.some((_,i)=>i%4===3&&result.vertices[i]===-1));
});

test('indexed draw partitions use WebGL byte offsets and WebGPU element offsets',()=>{
  assert.deepEqual(atlasTerrainFieldDrawOffsets({firstIndex:27}),{firstVertex:108,firstIndex:27});
});

test('the prepared field ray uses the same alpha and draft delta at a large negative origin',()=>{
  const old=grid(-10_000_000,-128,256),next=grid(-10_000_000,-128,256),draft=grid(-10_000_000,-128,256);old.grid.heights.fill(100);next.grid.heights.fill(300);draft.grid.heights.fill(350);
  const geometry=prepareAtlasTerrainFieldGeometry([old],[next],1),index=createAtlasTerrainFieldRayIndex(geometry,[old],[next],[draft]),segment=[[-9_999_872,0,1000],[-9_999_872,0,-1000]];
  const start=index.intersect(segment,.5);assert(start);assert(Math.abs(start.point[2]-250)<1e-5);assert(Math.abs(start.segmentFraction-.375)<1e-7);assert.equal(start.model,next);
});

test('field rays interpolate the GPU-resolved coarse height from an LOD boundary vertex',()=>{
  const fine=grid(0,0,256),coarse=grid(256,0,512);fine.grid.heights.fill(0);coarse.grid.heights.fill(100);
  const geometry=prepareAtlasTerrainFieldGeometry([fine,coarse],[]),index=createAtlasTerrainFieldRayIndex(geometry,[fine,coarse],[]),segment=[[254,128,500],[254,128,-500]],hit=index.intersect(segment,1);
  assert(hit);assert(Math.abs(hit.point[2]-50)<1e-5);assert(Math.abs(hit.segmentFraction-.45)<1e-7);
  assert(Math.abs(segment[0][2]+(segment[1][2]-segment[0][2])*hit.segmentFraction-hit.point[2])<1e-8,'the reported height lies on the queried ray');
});

test('45 and 75 degree field rays retain alpha 0, .5 and 1 at negative and positive world origins',()=>{
  for(const origin of [-10_000_000,10_000_000]){
    const old=grid(origin,-512,1024),next=grid(origin,-512,1024);old.grid.heights.fill(100);next.grid.heights.fill(300);
    const geometry=prepareAtlasTerrainFieldGeometry([old],[next]),index=createAtlasTerrainFieldRayIndex(geometry,[old],[next]);
    for(const angle of [45,75])for(const alpha of [0,.5,1]){
      const expected=100+200*alpha,radians=angle*Math.PI/180,run=600*Math.cos(radians),rise=600*Math.sin(radians),center=origin+512;
      const segment=[[center-run,-run,expected+rise],[center+run,run,expected-rise]],hit=index.intersect(segment,alpha);
      assert(hit,`${angle} degree alpha ${alpha} at ${origin}`);assert(Math.abs(hit.point[2]-expected)<1e-5);assert(Math.abs(hit.segmentFraction-.5)<1e-7);assert.equal(hit.model,next);
    }
  }
});

test('field normals resolve both morph sides across owner edges before mixing gradients',()=>{
 assert.match(ATLAS_TERRAIN_FIELD_VS,/vec2 fieldGradient\(int slot,vec2 p,vec2 support\)/);
 assert.match(ATLAS_TERRAIN_FIELD_VS,/fieldSampleAvailable\(slot,p-vec2\(support\.x,0\.0\)\)/);
 assert.match(ATLAS_TERRAIN_FIELD_VS,/support\.x\*xCount/,'a missing neighbour uses the one-sided physical denominator');
 assert.match(ATLAS_TERRAIN_FIELD_VS,/oldSlot<0\?fieldSupport\(nextSlot,p\):max\(fieldSupport\(oldSlot,p\),fieldSupport\(nextSlot,p\)\)/,'both morph sides retain the same physical support through alpha 1');
 assert.doesNotMatch(ATLAS_TERRAIN_FIELD_VS,/alpha>=1\.0\?fieldSupport/,'alpha completion cannot change the normal support');
 assert.match(ATLAS_TERRAIN_FIELD_VS,/mix\(oldGradient,nextGradient,atlasTerrainField\.alpha\)/,'physical gradients mix before normalization');
 assert.doesNotMatch(ATLAS_TERRAIN_FIELD_VS,/float l=fieldMixed/,'support probes must not clamp the new owner texture directly');
});

test('fresh wrappers around the same immutable field buffers do not start another topology transition',()=>{
 const source=sourceTile(-1,-1,-4),first=atlasTerrainTileModels([source]),model=first[0];
 const wrapped={...model,grid:{...model.grid,view:{...model.grid.view,box:{...model.grid.view.box}}},object:{...model.object}};
 assert.equal(sameAtlasTerrainFieldSources(first,[wrapped]),true);
 assert.equal(sameAtlasTerrainFieldSources(first,[{...wrapped,grid:{...wrapped.grid,heights:wrapped.grid.heights.slice()}}]),false);
 assert.equal(sameAtlasTerrainFieldSources(first,[{...wrapped,grid:{...wrapped.grid,view:{...wrapped.grid.view,box:{...wrapped.grid.view.box,x:0}}}}]),false);
});

test('nested old ownership selects the fine child and cuts its coarse parent',()=>{
  const result=prepareAtlasTerrainFieldGeometry([square(0,0,2),square(0,0,1)],[square(0,0,2)],32),a=areas(result);
  assert.equal(a.get('1/0'),1);
  assert.equal(a.get('0/0'),3);
  assert.equal(a.get('-1/0'),undefined);
  assert.equal([...a.values()].reduce((x,y)=>x+y,0),4);
  assert.equal(result.draftSourceCount,32);
  assert.equal(result.gpuGeometryBytes,result.vertices.byteLength+result.indices.byteLength,'draft fields reuse triangles');
});

test('large and negative world origins stay local and the living-buffer cap fails before upload',()=>{
  const result=prepareAtlasTerrainFieldGeometry([square(-10_000_000,-128,2)],[square(-10_000_000,-128,2)]);
  assert(result.vertices.every(Number.isFinite));
  assert(Math.max(...result.vertices.filter((_,i)=>i%4<2))<=2);
  assert.throws(()=>prepareAtlasTerrainFieldGeometry([], [square(0,0,2)],0,ATLAS_TERRAIN_FIELD_GPU.geometry),/Geometriebudget/);
});

test('the complete 32 old + 32 new + 32 draft field count fits only after the final partition is counted',()=>{
  const old=Array.from({length:32},(_,i)=>grid((i%8)*256,Math.floor(i/8)*256,256));
  const next=old.map(m=>grid(m.grid.view.box.x,m.grid.view.box.y,256));
  const result=prepareAtlasTerrainFieldGeometry(old,next,32);
  assert.equal(result.oldSourceCount,32);assert.equal(result.newSourceCount,32);assert.equal(result.draftSourceCount,32);
  assert.equal(result.gpuGeometryBytes,32*(65*65*16+64*64*6*4));
  assert.equal(result.gpuDrawMetadataBytes,32*ATLAS_TERRAIN_FIELD_GPU.drawMetadataStride);
  assert(result.gpuGeometryBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);
});

test('31 fine holes in a world parent are counted with target-only additions before upload',()=>{
  const old=[grid(0,0,8192),...Array.from({length:31},(_,i)=>grid(i*256,0,256))];
  const next=[grid(0,0,8192),...Array.from({length:31},(_,i)=>grid(8192+i*256,0,256))];
  const result=prepareAtlasTerrainFieldGeometry(old,next,32),a=areas(result),parentArea=8192*8192;
  assert.equal(a.get('0/0'),parentArea-31*256*256);
  for(let i=1;i<32;i++)assert.equal(a.get(`${i}/0`),256*256);
  for(let i=1;i<32;i++)assert.equal(a.get(`-1/${i}`),256*256);
  assert(result.gpuGeometryBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);
});

test('real clipped terrain meshes retain the metre-scale child of a world-scale parent',()=>{
  const parent=sourceTile(-1,-1,20),child=sourceTile(-1,-1,-6);
  const old=atlasTerrainTileModels([parent,child]),next=atlasTerrainTileModels([parent]);
  const result=prepareAtlasTerrainFieldGeometry(old,next),a=areas(result);
  assert.equal(a.get('1/0'),16);
  assert(result.gpuGeometryBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);
  assert(result.vertices.every(Number.isFinite));
  assert(result.draws.some(draw=>{
    if(draw.oldSlot!==0||draw.newSlot!==0)return false;
    for(let i=draw.firstIndex;i<draw.firstIndex+draw.indexCount;i++){
      const at=result.indices[i]*4;
      if(draw.origin.x+result.vertices[at]===-4&&draw.origin.y+result.vertices[at+1]===-4)return true;
    }
    return false;
  }),'the parent cut corner remains exact after Float32 packing near the local origin');
});

test('per-draw slot metadata preserves nonuniform physical grid bands at a negative world origin',()=>{
  const model=grid(-10_000_000,-9_000_000,1_000_000);
  model.grid.view={box:model.grid.view.box,columns:65,rows:65,
    refinement:{x:-9_750_000,y:-8_750_000,width:20_000,height:20_000}};
  const origin={x:-9_749_999.75,y:-8_749_998.5},packed=packAtlasTerrainFieldSlotMetadata(origin,[model],[model],[model]),layout=terrainGridLayout(model.grid.view);
  assert.equal(packed.byteLength,ATLAS_TERRAIN_FIELD_SLOT_META_FLOATS*4);
  assert.equal(packed[0],Math.fround(model.grid.view.box.x-origin.x));
  assert.equal(packed[1],Math.fround(model.grid.view.box.y-origin.y));
  for(const slot of [0,32,64]){
    const xBase=(ATLAS_TERRAIN_FIELD_SLOTS+slot)*4,yBase=(ATLAS_TERRAIN_FIELD_SLOTS*10+slot)*4;
    assert.deepEqual([...packed.slice(xBase,xBase+4)],[
      Math.fround(layout.x.bands[0].origin-origin.x),Math.fround(layout.x.bands[0].step),layout.x.bands[0].start,layout.x.bands[0].cells]);
    assert.deepEqual([...packed.slice(yBase,yBase+4)],[
      Math.fround(layout.y.bands[0].origin-origin.y),Math.fround(layout.y.bands[0].step),layout.y.bands[0].start,layout.y.bands[0].cells]);
    assert.equal(layout.x.bands.reduce((n,b)=>n+b.cells,0),64);
    assert.equal(layout.y.bands.reduce((n,b)=>n+b.cells,0),64);
  }
  assert(packed.every(Number.isFinite));
});

test('four-sample browser and picker resize overlap is reserved before field arrays',()=>{
  const color={width:1632,height:1032,colorAttachments:[{texture:{format:'rgba8unorm'}}],depthStencilAttachment:{texture:{format:'depth24plus'}}},depth={width:1632,height:1032,colorAttachments:[{texture:{format:'rgba32float'}}],depthStencilAttachment:{texture:{format:'depth24plus'}}};
  const tables=[...atlasTerrainFieldPlannedTables()];
  const input={drawingWidth:1920,drawingHeight:1080,observedLumaGpuBytes:40_136_510,materialTextures:[],morphTextures:[],picker:{color,depth,drawnColor:color,drawnDepth:depth},previousDrawingSize:[1632,1032],candidatePickerSize:[1920,1080],retainedFieldGpuGeometryBytes:0,newFieldGpuGeometryBytes:24*1024*1024,retainedDrawMetadataBytes:0,newDrawMetadataBytes:1024*1024,retainedTables:[...tables,...tables.map(table=>({...table}))],plannedTables:tables};
  const estimate=preflightAtlasTerrainFieldPilotGpu(input);
  assert(estimate.peakBytes<ATLAS_TERRAIN_FIELD_GPU.total);
  assert.equal(estimate.headroomBytes,ATLAS_TERRAIN_FIELD_GPU.total-estimate.peakBytes);
  assert.equal(estimate.tablesBytes,3*(ATLAS_TERRAIN_FIELD_SLOTS*ATLAS_TERRAIN_FIELD_META_ROWS*16+64*256));
  const widened=preflightAtlasTerrainFieldPilotGpu({...input,plannedTables:[tables[0],{...tables[1],width:128}]});
  assert.equal(widened.tablesBytes-estimate.tablesBytes,64*256,'future edge-table dimensions count by actual owner descriptor');
  assert.throws(()=>preflightAtlasTerrainFieldPilotGpu({...input,retainedTables:[{...tables[0],destroyed:true}]}),/Freigegebene/);
  assert.throws(()=>preflightAtlasTerrainFieldPilotGpu({...input,morphTextures:[{destroyed:false}]}),/Morphtextur/);
  assert.throws(()=>preflightAtlasTerrainFieldPilotGpu({...input,picker:{...input.picker,drawnColor:{}}}),/Picker/);
  assert.throws(()=>preflightAtlasTerrainFieldPilotGpu({...input,drawingWidth:1921}),/Pilotfenster/);
  assert.throws(()=>preflightAtlasTerrainFieldPilotGpu({...input,observedLumaGpuBytes:200_000_000}),/Gesamtbudget/);
});

test('full 128-slot overlap counts three live table generations and two full-size browser and picker owners',()=>{
  const frame=format=>({width:1920,height:1080,colorAttachments:[{texture:{format}}],depthStencilAttachment:{texture:{format:'depth24plus'}}});
  const color=frame('rgba8unorm'),depth=frame('rgba32float');
  const table=()=>[...atlasTerrainFieldPlannedTables()];
  const [first,second,planned]=[table(),table(),table()];
  const materialTextures=Array.from({length:32*4},()=>({width:256,height:256,format:'rgba8unorm',samples:1}));
  const fieldArrayTextures=[...Array.from({length:4},()=>({width:256,height:256,depth:128,format:'rgba8unorm',samples:1})),{width:65,height:65,depth:128,format:'r32float',samples:1}];
  const input={drawingWidth:1920,drawingHeight:1080,observedLumaGpuBytes:40_136_510,materialTextures,morphTextures:[],picker:{color,depth,drawnColor:color,drawnDepth:depth},previousDrawingSize:[1920,1080],candidatePickerSize:[1920,1080],fieldArraysResident:true,fieldArrayTextures,retainedTables:[...first,...second],plannedTables:planned,retainedFieldGpuGeometryBytes:0,newFieldGpuGeometryBytes:24*1024*1024,retainedDrawMetadataBytes:0,newDrawMetadataBytes:1024*1024};
  const result=preflightAtlasTerrainFieldPilotGpu(input);
  assert.equal(result.materialBytes,32*4*256*256*4,'drawn alpha-1 legacy channels remain resident through first takeover');
  assert.equal(result.legacyBytes,45_780_654);
  assert.equal(result.fieldArraysBytes,136_380_928);
  assert.equal(result.tablesBytes,202_752);
  assert.equal(result.geometryBytes,25_165_824);
  assert.equal(result.drawMetadataBytes,1_048_576);
  assert.equal(result.defaultOldAndNew,165_888_000);
  assert.equal(result.pickerOldAndNew,116_121_600);
  assert.equal(result.peakBytes,490_588_334);
  assert.equal(result.headroomBytes,12_728_146);
});

test('one surface owner keeps drawn slots through a failed new upload and releases them once',()=>{
  const textures=[],gl={NO_ERROR:0,TEXTURE_BINDING_2D_ARRAY:1,UNPACK_ALIGNMENT:2,UNPACK_ROW_LENGTH:3,TEXTURE_2D_ARRAY:4,RGBA:5,UNSIGNED_BYTE:6,RED:7,FLOAT:8,
    getParameter:key=>key===2?4:key===3?0:null,getError:()=>0,bindTexture(_target,texture){this.bound=texture;},pixelStorei(){},texSubImage3D(){if(this.bound?.failCount){this.bound.failCount--;throw Error('upload failed');}}},
    device={type:'webgl',gl,isTextureFormatSupported:()=>true,createTexture:props=>{
    const texture={props,handle:{},destroyed:false,destroy(){this.destroyed=true;}};texture.handle.owner=texture;
    textures.push(texture);return texture;
  }};
  const color={width:1632,height:1032,colorAttachments:[{texture:{format:'rgba8unorm'}}],depthStencilAttachment:{texture:{format:'depth24plus'}}},depth={width:1632,height:1032,colorAttachments:[{texture:{format:'rgba32float'}}],depthStencilAttachment:{texture:{format:'depth24plus'}}};
  const input={drawingWidth:1632,drawingHeight:1032,observedLumaGpuBytes:40_136_510,materialTextures:[],morphTextures:[],picker:{color,depth,drawnColor:color,drawnDepth:depth},retainedFieldGpuGeometryBytes:0,newFieldGpuGeometryBytes:0,retainedDrawMetadataBytes:0,newDrawMetadataBytes:0,retainedTables:[],plannedTables:[...atlasTerrainFieldPlannedTables()]};
  const insufficient={...device,gl:{...gl,MAX_ARRAY_TEXTURE_LAYERS:77,getParameter:key=>key===77?96:gl.getParameter(key)}};
  assert.throws(()=>AtlasTerrainFieldGpuOwner.create(insufficient,input),/128 physische Array-Layer/);
  assert.equal(textures.length,0,'capability failure precedes every array allocation');
  const owner=AtlasTerrainFieldGpuOwner.create(device,input),source={object:{id:'tile'},texture:{data:new Uint8Array(256*256*4),width:256,height:256},grid:{heights:new Float32Array(65*65)}};
  source.masks=source.cover=source.relief=source.texture;
  assert(textures.slice(0,5).every(t=>t.props.data===undefined&&t.props.dimension==='2d-array'&&t.props.depth===ATLAS_TERRAIN_FIELD_SLOTS),'GPU arrays never retain CPU upload sources in constructors');
  assert.deepEqual(textures.slice(5).map(t=>[t.props.dimension,t.props.width,t.props.height,t.props.format]),[['2d',ATLAS_TERRAIN_FIELD_SLOTS,ATLAS_TERRAIN_FIELD_META_ROWS,'rgba32float'],['2d',64,256,'r8uint']]);
  owner.upload(0,source);owner.publish([0]);assert.equal(owner.heldSlots,1);
  textures[2].handle.failCount=1;assert.throws(()=>owner.upload(1,source),/upload failed/);assert.equal(owner.heldSlots,1,'partial new slot rolls back without destroying old draw');
  owner.upload(1,source);owner.discardUnpublished([1]);assert.equal(owner.heldSlots,1);
  const draft={...source,texture:{...source.texture,data:source.texture.data.slice()},grid:{heights:source.grid.heights.slice()}};draft.masks=draft.cover=draft.relief=draft.texture;
  owner.upload(64,source);owner.publish([64]);
  assert.throws(()=>owner.upload(64,draft),/nicht frei/,'a drawn draft can never be replaced in place');
  textures[2].handle.failCount=1;assert.throws(()=>owner.upload(96,draft),/upload failed/);
  assert.equal(owner.source(64),source,'a failed candidate draft leaves the drawn source intact');
  owner.upload(96,draft);owner.publish([96]);owner.release([64]);assert.equal(owner.source(96),draft);
  owner.release([96]);
  assert.throws(()=>owner.discardUnpublished([0]),/gezeichneten Slot/);
  owner.release([0]);assert.equal(owner.heldSlots,0);
  for(let slot=0;slot<96;slot++)owner.upload(slot,source);
  owner.publish(Array.from({length:96},(_,slot)=>slot));
  for(let slot=96;slot<128;slot++)owner.upload(slot,draft);
  assert.equal(owner.heldSlots,128,'old, new, drawn draft and pending draft occupy four disjoint 32-slot banks');
  assert.equal(owner.source(64),source);assert.equal(owner.source(127),draft);
  owner.publish(Array.from({length:32},(_,index)=>96+index));
  owner.release(Array.from({length:32},(_,index)=>64+index));
  assert.equal(owner.heldSlots,96);assert.equal(owner.source(96),draft);
  owner.release([...Array.from({length:64},(_,slot)=>slot),...Array.from({length:32},(_,index)=>96+index)]);
  owner.dispose();owner.dispose();assert(textures.every(t=>t.destroyed));
});


// Independent geometric oracle: use the actual Float32 positions and index
// connectivity. The production field ray reconstructs source triangles from
// draw bounds, so a passing source ray alone cannot detect an empty/bad mesh.
function assertSourceTriangles(geometry,oldModels,newModels){
  let triangles=0,containments=0;
  for(const draw of geometry.draws)for(let i=draw.firstIndex;i<draw.firstIndex+draw.indexCount;i+=3){
    const p=[0,1,2].map(j=>{const at=geometry.indices[i+j]*4;return [geometry.vertices[at]+draw.origin.x,geometry.vertices[at+1]+draw.origin.y];});
    assert.notEqual((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]),0,'actual packed triangle must have area');triangles++;
    for(const model of [oldModels[draw.oldSlot],newModels[draw.newSlot]]){
      if(!model)continue;
      const b=model.grid.view.box,sx=b.width/64,sy=b.height/64,
        ix=Math.min(63,Math.floor((Math.min(...p.map(v=>v[0]))-b.x)/sx)),iy=Math.min(63,Math.floor((Math.min(...p.map(v=>v[1]))-b.y)/sy)),
        uv=p.map(([x,y])=>[(x-(b.x+ix*sx))/sx,(y-(b.y+iy*sy))/sy]);
      assert(uv.every(([u,v])=>u>=0&&u<=1&&v>=0&&v<=1),'packed triangle stays within one source cell');
      assert(uv.every(([u,v])=>u+v<=1)||uv.every(([u,v])=>u+v>=1),'packed triangle stays on one source diagonal side');containments++;
    }
  }
  assert(triangles>0);return {triangles,containments};
}
function modelsFromKeys(keys){return keys.map(key=>{const [lod,x,y]=key.split('/').map(Number),view=atlasTerrainTileQuery({tile:{lod,x,y},revision:1}).view;return grid(view.box.x,view.box.y,view.box.width);});}
function independentSourceHeight(model,p){
  const b=model.grid.view.box,x=(p[0]-b.x)*64/b.width,y=(p[1]-b.y)*64/b.height,ix=Math.min(63,Math.floor(x)),iy=Math.min(63,Math.floor(y)),u=x-ix,v=y-iy,h=model.grid.heights,at=iy*65+ix;
  return u+v<=1?h[at]*(1-u-v)+h[at+1]*u+h[at+65]*v:h[at+66]*(u+v-1)+h[at+1]*(1-v)+h[at+65]*(1-u);
}
function actualMeshHeight(geometry,oldModels,newModels,point,alpha){
  for(const draw of geometry.draws)for(let i=draw.firstIndex;i<Math.min(geometry.indices.length,draw.firstIndex+draw.indexCount);i+=3){
    const p=[0,1,2].map(j=>{const at=geometry.indices[i+j]*4;return [geometry.vertices[at]+draw.origin.x,geometry.vertices[at+1]+draw.origin.y];}),[a,b,c]=p,
      det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),u=((point[0]-a[0])*(c[1]-a[1])-(point[1]-a[1])*(c[0]-a[0]))/det,
      v=((b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]))/det;
    if(u<0||v<0||u+v>1)continue;
    const heights=p.map(vertex=>{const old=oldModels[draw.oldSlot],next=newModels[draw.newSlot];return !next?independentSourceHeight(old,vertex):!old?independentSourceHeight(next,vertex):independentSourceHeight(old,vertex)*(1-alpha)+independentSourceHeight(next,vertex)*alpha;});
    return heights[0]*(1-u-v)+heights[1]*u+heights[2]*v;
  }
  return null;
}

test('actual packed D2 triangles retain a single fine summit at alpha 0, half and 1 in both directions',()=>{
  const old=modelsFromKeys(['-1/1/1']),next=modelsFromKeys(['0/0/0']);old[0].grid.heights[66]=100;next[0].grid.heights.fill(20);
  for(const [a,b,expected] of [[old,next,[50,35,20]],[next,old,[20,35,50]]]){
    const geometry=prepareAtlasTerrainFieldGeometry(a,b);assertSourceTriangles(geometry,a,b);
    assert.deepEqual([0,.5,1].map(alpha=>actualMeshHeight(geometry,a,b,[130.5,130.5],alpha)),expected);
    assert.equal(actualMeshHeight({...geometry,indices:new Uint32Array()},a,b,[130.5,130.5],0),null,'oracle depends on real connectivity');
  }
});

test('actual Float32 triangles preserve clipped diagonals at MIN_LOD, negative roots and the largest valid source',()=>{
  for(const [oldKeys,newKeys] of [
    [['-8/0/0'],['20/0/0']], [['20/0/0'],['-8/0/0']], [['-8/-1/-1'],['20/-1/-1']],
    [['-8/0/0'],['31/0/0']], [['-8/274877906944/274877906944'],['31/0/0']],
    [['-2/0/0','-1/1/0','0/0/0'],['-1/0/0','-2/2/2','0/0/0']]
  ]){
    const a=modelsFromKeys(oldKeys),b=modelsFromKeys(newKeys),geometry=prepareAtlasTerrainFieldGeometry(a,b);assertSourceTriangles(geometry,a,b);
    assert(geometry.gpuGeometryBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);assert(geometry.gpuDrawMetadataBytes<ATLAS_TERRAIN_FIELD_GPU.drawMetadata);
  }
  assert.throws(()=>atlasTerrainTileQuery({tile:{lod:32,x:0,y:0},revision:1}),/darstellbaren Bereichs/,'LOD32 is already outside the existing 1e12-metre canonical source bound');
});

test('the narrow real stream and every D2 target publication contain actual common source triangles',async()=>{
  const frames=[],stream=new AtlasRasterTileStream({request:(tile,revision)=>({tile,revision}),validate:()=>{}},{maxTiles:32,maxRetainedTiles:64,coverageLod:20}),capture=label=>frame=>frames.push({label,...frame}),input={box:{x:0,y:0,width:512,height:512},metersPerPixel:.5,revision:1,source:'fixed'};
  const fetch=async req=>({...req,fence:'fixed'}),keys=frame=>frame.tiles.map(t=>`${t.tile.lod}/${t.tile.x}/${t.tile.y}`);
  await stream.load(input,fetch,capture('old'));await stream.load({...input,metersPerPixel:1},fetch,capture('new'));
  const old=modelsFromKeys(keys(frames.findLast(f=>f.label==='old'&&f.complete))),protectedGeometry=prepareAtlasTerrainFieldGeometry([],old);
  let publications=0,maxBytes=0;
  for(const frame of frames.filter(f=>f.label==='new'&&f.tiles.length)){
    const next=modelsFromKeys(keys(frame)),g=prepareAtlasTerrainFieldGeometry(old,next,0,protectedGeometry.gpuGeometryBytes);assertSourceTriangles(g,old,next);publications++;maxBytes=Math.max(maxBytes,protectedGeometry.gpuGeometryBytes+g.gpuGeometryBytes);
  }
  assert(publications>1);assert(maxBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);
  const narrow=[];await stream.load({...input,box:{x:0,y:0,width:1,height:1},metersPerPixel:1/256},fetch,frame=>narrow.push(frame));
  const next=modelsFromKeys(keys(narrow.findLast(f=>f.complete))),g=prepareAtlasTerrainFieldGeometry([],next);assertSourceTriangles(g,[],next);
  assert(g.draws.length>9,'precision partition has an explicit draw/metadata cost');
});

test('the exact counted field output is reserved before either vertex or index backing store is allocated',()=>{
  const source=modelsFromKeys(['-8/0/0','20/0/0']),OriginalFloat32=globalThis.Float32Array,OriginalUint32=globalThis.Uint32Array;let allocations=0,reservations=0;
  const intercept=kind=>new Proxy(kind,{construct(target,args){allocations++;return Reflect.construct(target,args);}});
  globalThis.Float32Array=intercept(OriginalFloat32);globalThis.Uint32Array=intercept(OriginalUint32);
  try{assert.throws(()=>prepareAtlasTerrainFieldGeometry([],source,0,0,{reserve:()=>{reservations++;throw Error('reservation refused');}}),/reservation refused/);}finally{globalThis.Float32Array=OriginalFloat32;globalThis.Uint32Array=OriginalUint32;}
  assert.equal(reservations,1);assert.equal(allocations,0);
  let reserved=0;const g=prepareAtlasTerrainFieldGeometry([],source,0,0,{reserve:bytes=>{reserved+=bytes;}});assert.equal(reserved,g.vertices.byteLength+g.indices.byteLength+g.gpuDrawMetadataBytes);
});


test('large valid old/new partitions merge only equal owners and retain every fine hole within the unchanged budgets',()=>{
  const rootSize=2**28;
  const family=shift=>{
    const old=[`20/${shift?'-1/-1':'0/0'}`,...Array.from({length:31},(_,i)=>`-8/${shift+1000+i*10000}/${shift+1000+i*10000}`)],
      next=[`20/${shift?'-1/-1':'0/0'}`,...Array.from({length:31},(_,i)=>`-8/${shift+5000+i*10000}/${shift+7000+i*10000}`)];
    return [modelsFromKeys(old),modelsFromKeys(next)];
  };
  for(const [shift,reverse] of [[0,false],[0,true],[-rootSize,false]]){
    let [old,next]=family(shift);old[1].grid.heights[33*65+33]=100;next[0].grid.heights.fill(20);
    if(reverse)[old,next]=[next,old];
    const protectedGeometry=prepareAtlasTerrainFieldGeometry([],old),g=prepareAtlasTerrainFieldGeometry(old,next,32,protectedGeometry.gpuGeometryBytes,{retainedDrawMetadataBytes:protectedGeometry.gpuDrawMetadataBytes});
    assertSourceTriangles(g,old,next);
    assert(g.gpuGeometryBytes+protectedGeometry.gpuGeometryBytes<ATLAS_TERRAIN_FIELD_GPU.geometry);
    assert(g.gpuDrawMetadataBytes+protectedGeometry.gpuDrawMetadataBytes<ATLAS_TERRAIN_FIELD_GPU.drawMetadata);
    assert(g.draws.length<2000,'equal-owner cross-cuts do not become thousands of irrelevant draws');
    const area=areas(g);for(let i=1;i<32;i++){assert.equal(area.get(`${i}/0`),1);assert.equal(area.get(`0/${i}`),1);}
    const sample=[shift+1000+33.25/64,shift+1000+33.25/64];
    assert.deepEqual([0,.5,1].map(alpha=>actualMeshHeight(g,old,next,sample,alpha)),reverse?[20,35,50]:[50,35,20]);
  }
});

function close(actual,expected,epsilon=1e-6){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<epsilon,`${i}: ${v} instead of ${expected[i]}`));}
function fillPhysical(model,height){const b=model.grid.view.box;for(let y=0;y<65;y++)for(let x=0;x<65;x++)model.grid.heights[y*65+x]=height(b.x+x*b.width/64,b.y+y*b.height/64);return model;}
function packedOwner(meta,cells,bank,p){
  const at=(slot,row,c)=>(meta[(row*128+slot)*4+c]),cut=(axis,i)=>at(bank+Math.floor(i/2),19,axis*2+i%2),count=axis=>axis===0?at(bank,23,3)%128:Math.floor(at(bank,23,3)/128),cell=(axis,value)=>{const n=count(axis);let i=0;while(i<n&&cut(axis,i)<=value)i++;return i-1;};
  const x=cell(0,p.x),y=cell(1,p.y);return x<0||y<0||x>=count(0)-1||y>=count(1)-1?-1:cells[(bank/32*64+y)*64+x]-1;
}

test('exact signed owner intervals retain a one-metre neighbour between eight-metre edge nodes',()=>{
  const sources=[grid(-512,-512,512),grid(0,-512,512),grid(0,-3,1),grid(0,-5,1)];
  for(const ordered of [sources,[sources[3],sources[1],sources[0],sources[2]]]){
    const origin={x:-512,y:-512},meta=packAtlasTerrainFieldSlotMetadata(origin,ordered,[]),cells=prepareAtlasTerrainFieldEdgeOwners(ordered,[]);
    for(const [y,expected] of [[-2.5,sources[2]],[-4.5,sources[3]],[-3.5,sources[1]]]){
      const owner=packedOwner(meta,cells,0,{x:512.25,y:y+512});assert.equal(ordered[owner],expected);
    }
    assert.equal(cells.byteLength,16_384);assert.equal(meta.byteLength,51_200);
    const lookup=prepareAtlasTerrainFieldLookup(ordered);assert.equal(lookup.nodes.length,7);assert(lookup.nodes.every(n=>n.escape<=7));
  }
});

test('all incident negative T/corner supports select sixteen metres and independently known physical slopes',()=>{
  for(const shift of [0,-10_000_384]){
    const models=[grid(shift-512,shift-512,512),grid(shift,shift-512,256),grid(shift,shift-256,128),grid(shift,shift-128,128),grid(shift,shift,1024)];
    for(const m of models)fillPhysical(m,(x,y)=>Math.max(0,x-shift)**2+Math.max(0,y-shift)**2);
    const p={x:shift,y:shift};assert.equal(atlasTerrainFieldBoundaryOwner(models,3,p),4);
    const support=atlasTerrainFieldPhysicalSupport(models,3,p);assert.equal(support,16);
    const gradient=atlasTerrainFieldGradient(models,3,p,support);close(gradient,[8,8]);const length=Math.hypot(...gradient,1);close([-gradient[0]/length,-gradient[1]/length,1/length],[-8/Math.sqrt(129),-8/Math.sqrt(129),1/Math.sqrt(129)]);
    const reversed=[...models].reverse();assert.equal(reversed[atlasTerrainFieldBoundaryOwner(reversed,1,p)],models[4]);assert.equal(atlasTerrainFieldPhysicalSupport(reversed,1,p),16);
  }
});

test('physical gradients mix before normalization at all three alphas, including a large negative origin',()=>{
  for(const shift of [0,-10_000_384]){
    const old=fillPhysical(grid(shift-256,shift-256,256),(x,y)=>100+2*(x-shift)+3*(y-shift)),next=fillPhysical(grid(shift-256,shift-256,256),(x,y)=>200-4*(x-shift)+(y-shift)),p={x:shift-128,y:shift-128};
    const before=atlasTerrainFieldGradient([old],0,p,4),after=atlasTerrainFieldGradient([next],0,p,4);close(before,[2,3]);close(after,[-4,1]);
    for(const [alpha,expected] of [[0,[-2,-3,1]],[.5,[1,-2,1]],[1,[4,-1,1]]]){const g=before.map((v,i)=>v*(1-alpha)+after[i]*alpha),n=Math.hypot(...g,1),den=Math.hypot(...expected);close([-g[0]/n,-g[1]/n,1/n],expected.map(v=>v/den));}
  }
  assert.match(ATLAS_TERRAIN_FIELD_VS,/gradient\+=fieldGradient\(draftSlot,p,support\)-nextGradient/);
  assert.match(ATLAS_TERRAIN_FIELD_VS,/fieldPresentationNormal/,'cut vertices interpolate the underlying source-node presentation normals');
});

test('material footprint has independent symmetric corner, T and nested-parent area weights',()=>{
  const four=[grid(-256,-256,256),grid(0,-256,256),grid(-256,0,256),grid(0,0,256)];
  close(atlasTerrainFieldMaterialWeights(four,{x:0,y:0},2),[.25,.25,.25,.25]);
  close(atlasTerrainFieldMaterialWeights(four,{x:-1,y:-1},2),[.5625,.1875,.1875,.0625]);
  const values=[0,64,128,192],weights=atlasTerrainFieldMaterialWeights(four,{x:-1,y:-1},2);assert.equal(weights.reduce((sum,w,i)=>sum+w*values[i],0),48);
  const reversed=[...four].reverse(),flipped=atlasTerrainFieldMaterialWeights(reversed,{x:-1,y:-1},2);close(flipped.reverse(),weights);
  const tee=[grid(-512,-512,512),grid(0,-256,128),grid(0,-128,128)];close(atlasTerrainFieldMaterialWeights(tee,{x:0,y:-128},2),[.5,.25,.25]);
  const nested=[grid(-512,-512,512),grid(-3,-3,1)];close(atlasTerrainFieldMaterialWeights(nested,{x:-2.5,y:-2.5},1),[.75,.25]);
  for(const radius of [.5,.500001,1,2]){const a=atlasTerrainFieldMaterialWeights(four,{x:-1e-7,y:0},radius),b=atlasTerrainFieldMaterialWeights(four,{x:1e-7,y:0},radius);a.forEach((w,i)=>assert(Math.abs(w-b[i])<1e-6));}
  assert.match(ATLAS_TERRAIN_FIELD_FS,/visit<63/);assert.match(ATLAS_TERRAIN_FIELD_FS,/if\(weight<=0\.0\)continue/);
});

test('unaffected frozen draft heights, gradients and all material fields stay at the drawn alpha',()=>{
  const old=fillPhysical(grid(-256,-256,256),(x,y)=>100+2*x+3*y),next=fillPhysical(grid(-256,-256,256),(x,y)=>200-4*x+y),draft={...next,grid:{...next.grid,heights:next.grid.heights.slice()}};
  draft.grid.heights[32*65+32]+=20;const p={x:-32,y:-32},touched={x:-132,y:-128},go=atlasTerrainFieldGradient([old],0,p,4),gn=atlasTerrainFieldGradient([next],0,p,4),gd=atlasTerrainFieldGradient([draft],0,p,4);
  close(gd,gn);assert.equal(atlasTerrainFieldSample([draft],0,p)-atlasTerrainFieldSample([next],0,p),0);
  close(atlasTerrainFieldGradient([draft],0,touched,4).map((v,i)=>v-atlasTerrainFieldGradient([next],0,touched,4)[i]),[2.5,0]);
  const geometry=prepareAtlasTerrainFieldGeometry([old],[next],1),ray=createAtlasTerrainFieldRayIndex(geometry,[old],[next],[draft]);
  for(const alpha of [0,.5,1]){const expected=atlasTerrainFieldSample([old],0,p)*(1-alpha)+atlasTerrainFieldSample([next],0,p)*alpha,hit=ray.intersect([[p.x,p.y,2000],[p.x,p.y,-2000]],alpha);assert(hit);assert(Math.abs(hit.point[2]-expected)<1e-6);
    close(go.map((v,i)=>v*(1-alpha)+gn[i]*alpha+gd[i]-gn[i]),go.map((v,i)=>v*(1-alpha)+gn[i]*alpha));
    for(const [before,target] of [[16,240],[0,255],[70,100],[90,200]]){const frozen=before*(1-alpha)+target*alpha,draftAtUntouched=target;assert.equal(frozen+draftAtUntouched-target,frozen);}
  }
});

test('finite lookup and filter tables retain the exact three-generation resource count at maximum source count',()=>{
  const models=Array.from({length:32},(_,i)=>grid(i*512,i*512,256)),lookup=prepareAtlasTerrainFieldLookup(models);assert.equal(lookup.nodes.length,63);assert.equal(lookup.x.length,64);assert.equal(lookup.y.length,64);
  const tableBytes=atlasTerrainFieldPlannedTables().reduce((sum,t)=>sum+t.width*t.height*(t.format==='r8uint'?1:16),0);assert.equal(tableBytes,67_584);assert.equal(3*tableBytes,202_752);assert(3*tableBytes<=ATLAS_TERRAIN_FIELD_GPU.neighborTables);
});

test('actual Float32 lookup cuts retain MIN_LOD owners at K2 local draw origins up to LOD31',()=>{
  for(const keys of [['31/0/0','-8/0/0'],['31/-1/-1','-8/-1/-1'],['31/0/0','-8/274877906944/274877906944'],['31/0/0','-8/549755813887/549755813887']]){
    const models=modelsFromKeys(keys),geometry=prepareAtlasTerrainFieldGeometry([],models),fine=models[1].grid.view.box;
    for(const draw of geometry.draws){
      const origin=draw.origin,meta=packAtlasTerrainFieldSlotMetadata(origin,[],models),cells=prepareAtlasTerrainFieldEdgeOwners([],models),world={x:draw.bounds.x+draw.bounds.width/2,y:draw.bounds.y+draw.bounds.height/2},p={x:Math.fround(world.x-origin.x),y:Math.fround(world.y-origin.y)},found=packedOwner(meta,cells,32,p);
      assert.equal(found,32+draw.newSlot,`${keys.join(',')} at ${JSON.stringify(origin)} / ${JSON.stringify(world)}`);
      if(draw.newSlot===1){
        for(const fraction of [.25,.5,.75]){const exact={x:fine.x+fraction,y:fine.y+1-fraction},local={x:Math.fround(exact.x-origin.x),y:Math.fround(exact.y-origin.y)};assert.equal(origin.x+local.x,exact.x);assert.equal(origin.y+local.y,exact.y);assert.equal(packedOwner(meta,cells,32,local),33,'one metre owner survives the actual Float32 metadata, not just Double preparation');}
      }
    }
  }
});

function packedMaterialWeights(meta,bank,p,radius){
  const f=Math.fround,read=(node,row,c)=>meta[((row+Math.floor(node/32))*128+bank+node%32)*4+c],weights=new Float32Array(32),count=meta[(20*128+bank)*4+3];let visits=0;
  for(let node=0;node<count;){visits++;const dx=f(Math.max(0,f(Math.min(f(p.x+radius),read(node,21,2))-Math.max(f(p.x-radius),read(node,21,0))))/f(2*radius)),dy=f(Math.max(0,f(Math.min(f(p.y+radius),read(node,21,3))-Math.max(f(p.y-radius),read(node,21,1))))/f(2*radius));
    if(!dx||!dy){node=read(node,23,2);continue;}const source=read(node,23,0),parent=read(node,23,1);if(source>=0){const area=f(dx*dy);weights[source-bank]=f(weights[source-bank]+area);if(parent>=0)weights[parent-bank]=f(weights[parent-bank]-area);}node++;
  }const total=weights.reduce((sum,v)=>sum+Math.max(0,v),0);return{weights:[...weights].map(v=>Math.max(0,v)/total),visits};
}
test('packed far endpoints preserve material area beside a one-metre child at the LOD31 far corner',()=>{
  const models=modelsFromKeys(['31/0/0','-8/549755813887/549755813887']),g=prepareAtlasTerrainFieldGeometry([],models),draw=g.draws.find(d=>d.newSlot===1),origin=draw.origin,meta=packAtlasTerrainFieldSlotMetadata(origin,[],models),b=models[1].grid.view.box,p={x:Math.fround(b.x-origin.x),y:Math.fround(b.y+.5-origin.y)};
  assert.equal(meta[(20*128+32)*4],Math.fround(549755813888-origin.x),'far endpoint is packed directly, never reconstructed by large Float32 addition');
  const actual=packedMaterialWeights(meta,32,p,.25);close(actual.weights.slice(0,2),[.5,.5]);assert.equal(actual.visits,3);
});


test('a nonshared fine edge normal lies on the same coarse nodal segment from both owners',()=>{
  const models=[grid(-512,-512,512),grid(0,-512,256),grid(0,-256,128),grid(0,-128,128)];for(const m of models)fillPhysical(m,(x,y)=>100+.001*x*x+.002*y*y);
  const p={x:0,y:-129},a=atlasTerrainFieldPresentationNormal(models,0,[], -1,p,0),b=atlasTerrainFieldPresentationNormal(models,2,[],-1,p,0);close(a,b);
  // The shared 8m coarse edge segment is y=-136..-128. Its physical nodal
  // gradients are (0, .004*y), independently of the fine owner's 2m nodes.
  const node=y=>{const gy=.004*y,n=Math.hypot(gy,1);return[0,-gy/n,1/n];},lo=node(-136),hi=node(-128),expected=lo.map((v,i)=>v/8+hi[i]*7/8);close(a,expected,2e-6);
});

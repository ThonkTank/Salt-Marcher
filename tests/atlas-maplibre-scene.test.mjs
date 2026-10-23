import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-maplibre-scene.ts'],outfile:'.build/atlas-maplibre-scene-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasMapLibreScene,atlasMapLibreSceneLayers,atlasMapLibreSceneHit}=await import('../.build/atlas-maplibre-scene-test.mjs');

function fixture(){
  const object={id:'room:scope:floor:room',target:{kind:'room',id:'room',scopeId:'scope',floorId:'floor'},
    positions:new Float32Array([0,0,0,.1,0,0,0,.1,0]),indices:new Uint32Array([0,1,2])};
  return {root:{x:0,y:0,size:1024},sceneOrigin:{x:200,y:300},objects:[object],targets:new Map([[object.id,object.target]]),
    verticalOriginM:0,verticalExaggeration:2,coverage:{complete:false,unsupported:[]}};
}
function hit(model,coordinate=[.125,.25,.0625]){
  const object=model.objects[0];return {picked:true,index:0,object,layer:{id:`atlas-scene:${object.id}`},coordinate};
}
function bridge(model){
  const precise=color=>({depthStencilAttachment:{texture:{format:'depth24plus'}},colorAttachments:[{texture:{format:color}}]});
  return {root:model.root,sceneOrigin:model.sceneOrigin,frameUsable:true,calls:[],overlay:{pickObject:()=>hit(model),
    _deck:{deckPicker:{device:{},_resizeBuffer(){},pickingFBO:precise('rgba8unorm'),depthFBO:precise('rgba32float')}}},
    setLayers(layers){this.calls.push(layers);}};
}

test('renderer and picking share the exact indexed buffers and write opaque depth',()=>{
  const model=fixture(),[layer]=atlasMapLibreSceneLayers(model),object=model.objects[0];
  assert.equal(layer.props.mesh.attributes.POSITION.value,object.positions);
  assert.equal(layer.props.mesh.indices.value,object.indices);
  assert.equal(layer.props.data[0],object);
  assert.equal(layer.props.pickable,'3d');
  assert.equal(layer.props.parameters.depthWriteEnabled,true);
  assert.equal(layer.props.parameters.depthCompare,'less-equal');
  assert.deepEqual(layer.props.getPolygonOffset({layerIndex:20}),[0,0]);
  assert.deepEqual(layer.props.getPosition,[0,0,0]);
});

test('author point intersects selected geometry and never trusts the approximate GPU depth coordinate',()=>{
  const model=fixture();
  for(let i=2;i<model.objects[0].positions.length;i+=3)model.objects[0].positions[i]=.0625;
  const ray={frame:{projection:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],nearZ:.1,farZ:100},
    viewport:{x:0,y:0,width:100,height:100},pixel:{x:(.02+200/1024+1)*50,y:(1-.03-300/1024)*50}};
  const result=atlasMapLibreSceneHit(model,hit(model),ray);
  assert(Math.abs(result.point.x-220.48)<1e-8);assert(Math.abs(result.point.y-330.72)<1e-8);
  assert.equal(result.point.heightM,32);assert.equal(result.target,model.objects[0].target);
  assert.equal(atlasMapLibreSceneHit(model,hit(model)).point,null);
  assert.equal(atlasMapLibreSceneHit(model,hit(model),{...ray,pixel:{x:99,y:99}}).point,null);
});

test('foreign, stale and missed picks never become canonical selections',()=>{
  const model=fixture(),valid=hit(model);
  for(const candidate of [null,{...valid,picked:false},{...valid,index:1},{...valid,object:{...valid.object}},
    {...valid,layer:{id:'foreign'}},{...valid,object:undefined}])assert.equal(atlasMapLibreSceneHit(model,candidate),null);
});

test('scene retains buffers across repeated updates and camera-only picking, and releases layers on disposal',()=>{
  const model=fixture(),mapBridge=bridge(model),scene=new AtlasMapLibreScene(mapBridge);
  assert.equal(scene.pick(10,20),null);
  scene.update(model);const layers=mapBridge.calls[0];
  scene.update(model);assert.equal(mapBridge.calls.length,1);
  scene.pick(10,20);scene.pick(100,200);assert.equal(mapBridge.calls[0],layers);
  mapBridge.frameUsable=false;assert.equal(scene.pick(10,20),null);
  mapBridge.frameUsable=true;assert.equal(scene.pick(10,20).target,model.objects[0].target);
  assert.throws(()=>scene.pick(NaN,0),/finite/);
  scene.dispose();scene.dispose();assert.deepEqual(mapBridge.calls.at(-1),[]);
  assert.equal(mapBridge.calls.length,2);
  assert.throws(()=>scene.update(model),/disposed/);assert.throws(()=>scene.pick(1,1),/disposed/);
});

test('coordinate domain mismatch and failed layer replacement preserve the previous pick snapshot',()=>{
  const model=fixture(),mapBridge=bridge(model),scene=new AtlasMapLibreScene(mapBridge);
  scene.update(model);
  assert.throws(()=>scene.update({...model,sceneOrigin:{x:201,y:300}}),/coordinate domains/);
  assert.throws(()=>scene.update({...model,root:{...model.root,size:2048}}),/coordinate domains/);
  mapBridge.setLayers=()=>{throw Error('upload failed');};
  assert.throws(()=>scene.update(fixture()),/upload failed/);
  assert.equal(scene.pick(10,20).target,model.objects[0].target);
});

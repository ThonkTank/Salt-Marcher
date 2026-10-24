import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';

buildSync({entryPoints:['src/app/atlas-deck-surface.ts'],outfile:'.build/atlas-deck-overview-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasDeckSurface,atlasDeckSceneLayers}=await import('../.build/atlas-deck-overview-test.mjs');
buildSync({entryPoints:['src/app/atlas-metric-camera.ts'],outfile:'.build/atlas-metric-camera-overview-test.mjs',bundle:true,platform:'node',format:'esm'});
const {atlasMetricFrame}=await import('../.build/atlas-metric-camera-overview-test.mjs');

const camera={focus:{x:0,y:0},focusHeightM:0,metersPerPixel:1,rotation:0,tilt:0,exaggeration:1};
const roomTarget={kind:'room',id:'room-1',scopeId:'building-1',floorId:'ground'};
const semanticObject={id:'room:room-1',target:roomTarget,origin:{x:0,y:0,heightM:0},
  positions:new Float32Array([-1,-1,0,1,-1,0,0,1,0]),indices:new Uint32Array([0,1,2])};
const overviewMesh={id:'proxy-building-1',kind:'building',origin:{x:768,y:-512,heightM:20},
  positions:new Float32Array([-8,-8,0,8,-8,0,0,8,4]),indices:new Uint32Array([0,1,2])};
const overview={tile:{lod:3,x:4,y:-2},resolution:8,sourceObjects:1,meshes:[overviewMesh]};
const secondOverviewMesh={...overviewMesh,id:'proxy-room-2',kind:'room',origin:{x:-512,y:1024,heightM:0}};
const secondOverview={tile:{lod:3,x:-3,y:5},resolution:8,sourceObjects:1,meshes:[secondOverviewMesh]};
const model={objects:[semanticObject],overviews:[overview,secondOverview],targets:new Map([[semanticObject.id,roomTarget]]),
  coverage:{complete:true,supportedKinds:['terrain','building','room'],unsupported:[]},verticalExaggeration:1};
const fmt=(color,depth='depth24plus')=>({colorAttachments:[{texture:{format:color}}],depthStencilAttachment:{texture:{format:depth}},destroy(){}});
class FakeDeck {
  constructor(props){this.props=props;this.deckPicker={_resizeBuffer(){},device:{isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true},
    pickingFBO:fmt('rgba8unorm'),depthFBO:fmt('rgba32float')};this.pickResult=null;}
  setProps(props){this.props={...this.props,...props};}
  fireLoad(){this.props.onLoad?.();}
  fireRender(){for(const layer of this.props.layers??[])Object.defineProperty(layer,'isLoaded',{value:true,configurable:true});this.props.onAfterRender?.();}
  pickObject(){return this.pickResult;}
  finalize(){}
}
function environment(t){
  const {window,document}=parseHTML('<html><body><div id="host"></div></body></html>');
  const previous={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver};
  globalThis.document=document;globalThis.window=window;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  t.after(()=>Object.assign(globalThis,previous));
  const container=document.getElementById('host');
  Object.defineProperties(container,{clientWidth:{get:()=>640},clientHeight:{get:()=>480}});
  return container;
}
async function ready(t){
  const container=environment(t),decks=[];
  const pending=AtlasDeckSurface.create({container,camera,model,timeoutMs:300,createDeck:props=>{const deck=new FakeDeck(props);decks.push(deck);return deck;}});
  await new Promise(resolve=>setImmediate(resolve));decks[0].fireLoad();decks[0].fireRender();
  return {surface:await pending,deck:decks[0]};
}

test('overview meshes stay visual-only while retaining GPU mesh and data identity as camera moves',async t=>{
  const active=await ready(t),{surface,deck}=active;
  const first=deck.props.layers.find(layer=>layer.id.startsWith('atlas-overview:'));
  assert(first,'overview mesh is rendered in its own layer');
  assert.equal(deck.props.layers.filter(layer=>layer.id.startsWith('atlas-overview:')).length,2,'multiple overview tiles are retained in one scene');
  assert.equal(first.props.pickable,false);
  assert.equal(first.props.mesh.attributes.POSITION.value,overviewMesh.positions);
  assert.equal(first.props.mesh.indices.value,overviewMesh.indices);
  const farther={...camera,focus:{x:1024,y:-768},focusHeightM:256,exaggeration:3};
  surface.setCamera(farther);
  const second=deck.props.layers.find(layer=>layer.id===first.id);
  assert(second);
  assert.equal(second.props.pickable,false);
  assert.equal(second.props.mesh,first.props.mesh);
  assert.equal(second.props.data,first.props.data);
  assert.deepEqual(second.props.getScale,[1,1,3]);
  assert.deepEqual(second.props.getPosition,[overviewMesh.origin.x-1024,overviewMesh.origin.y+768,(overviewMesh.origin.heightM-256)*3]);
  assert.deepEqual(second.props.updateTriggers.getPosition,[1024,-768,256,3]);

  deck.pickResult={picked:true,index:0,object:overviewMesh,layer:{id:first.id}};
  assert.equal(surface.pick(320,240),null,'a mocked Deck overview hit cannot become a semantic selection');
  deck.pickResult={picked:true,index:0,object:semanticObject,layer:{id:first.id}};
  assert.equal(surface.pick(320,240),null,'a semantic object reported under an overview layer is rejected');
  surface.dispose();
});

test('overview layers retain cached geometry across independent camera frames',()=>{
  const frameA=atlasMetricFrame(camera,640,480);
  const frameB=atlasMetricFrame({...camera,focus:{x:-4096,y:8192},exaggeration:2},640,480);
  const first=atlasDeckSceneLayers(model,frameA).find(layer=>layer.id.startsWith('atlas-overview:'));
  const second=atlasDeckSceneLayers(model,frameB).find(layer=>layer.id.startsWith('atlas-overview:'));
  assert(first&&second);
  assert.equal(atlasDeckSceneLayers(model,frameA).filter(layer=>layer.id.startsWith('atlas-overview:')).length,2);
  assert.equal(first.props.mesh,second.props.mesh);
  assert.equal(first.props.data,second.props.data);
  assert.equal(second.props.pickable,false);
});

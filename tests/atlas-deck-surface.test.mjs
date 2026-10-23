import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';

buildSync({entryPoints:['src/app/atlas-deck-surface.ts'],outfile:'.build/atlas-deck-surface-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasDeckSurface,atlasDeckSceneLayers}=await import('../.build/atlas-deck-surface-test.mjs');
buildSync({entryPoints:['src/app/atlas-metric-camera.ts'],outfile:'.build/atlas-metric-camera-test.mjs',bundle:true,platform:'node',format:'esm'});
const {atlasMetricFrame:atlasMetricFrameForTest}=await import('../.build/atlas-metric-camera-test.mjs');

const camera={focus:{x:0,y:0},focusHeightM:0,metersPerPixel:1,rotation:0,tilt:0,exaggeration:1};
function object(id='floor') {
  const target={kind:'room',id:'room-1',scopeId:'building-1',floorId:'ground'};
  return {id:`room:${id}`,target,origin:{x:0,y:0,heightM:0},
    positions:new Float32Array([-10,-10,0,10,-10,0,0,10,0]),indices:new Uint32Array([0,1,2])};
}
function model(o=object()) {return {objects:[o],targets:new Map([[o.id,o.target]]),coverage:{complete:true,supportedKinds:['terrain','building','room'],unsupported:[]},verticalExaggeration:1};}
const fmt=(color,depth='depth24plus')=>({colorAttachments:[{texture:{format:color}}],depthStencilAttachment:{texture:{format:depth}},destroy(){}});

class FakeDeck {
  constructor(props) {
    this.props=props;this.setPropsCalls=[];this.redrawCalls=[];this.finalizeCalls=0;this.pickCalls=[];
    this.pickResult=null;
    this.deckPicker={_resizeBuffer(){},device:{isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true},
      pickingFBO:fmt('rgba8unorm'),depthFBO:fmt('rgba32float')};
  }
  setProps(props){this.setPropsCalls.push(props);this.props={...this.props,...props};}
  redraw(reason){this.redrawCalls.push(reason);}
  fireLoad(){this.props.onLoad?.();}
  fireRender(){this.props.onAfterRender?.();}
  fireError(error=new Error('fake Deck failure')){this.props.onError?.(error);}
  pickObject(args){this.pickCalls.push(args);return this.pickResult;}
  finalize(){this.finalizeCalls++;}
}

function environment(t) {
  const {window,document}=parseHTML('<html><body><div id="host"></div></body></html>');
  const previous={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver};
  let observer;
  globalThis.document=document;globalThis.window=window;
  globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;this.disconnected=false;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
  const container=document.getElementById('host');let width=640,height=480;
  Object.defineProperties(container,{clientWidth:{configurable:true,get:()=>width},clientHeight:{configurable:true,get:()=>height}});
  const setSize=(w,h)=>{width=w;height=h;};
  t.after(()=>Object.assign(globalThis,previous));
  return {container,document,window,setSize,getObserver:()=>observer};
}
async function readySurface(t,{camera:pose=camera,model:scene=model(),timeoutMs=200,...options}={}) {
  const env=environment(t),decks=[];
  const createDeck=props=>{const deck=new FakeDeck(props);decks.push(deck);return deck;};
  const pending=AtlasDeckSurface.create({container:env.container,camera:pose,model:scene,timeoutMs,createDeck,...options});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(decks.length,1);
  const deck=decks[0];deck.fireLoad();
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
  assert.equal(settled,false,'Deck load alone must not publish a ready surface');
  deck.fireRender();
  const surface=await pending;
  assert.equal(surface.frameUsable,true);
  return {surface,deck,decks,env};
}
function picked(objectValue,layerId=`atlas-scene:${objectValue.id}`) {
  return {picked:true,index:0,object:objectValue,layer:{id:layerId}};
}

test('create waits for Deck onLoad and a real afterRender before resolving',async t=>{
  const {container}=environment(t),decks=[];
  const pending=AtlasDeckSurface.create({container,camera,model:model(),timeoutMs:200,createDeck:props=>{const deck=new FakeDeck(props);decks.push(deck);return deck;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(decks.length,1);
  let completed=false;pending.then(()=>{completed=true;});
  await Promise.resolve();assert.equal(completed,false);
  decks[0].fireLoad();await Promise.resolve();assert.equal(completed,false);
  decks[0].fireRender();const surface=await pending;
  assert.equal(completed,true);assert.equal(surface.frameUsable,true);
  surface.dispose();
});

test('camera, scene and resize revisions invalidate picking until latest Deck render',async t=>{
  const {surface,deck,env}=await readySurface(t),mesh=surface.model.objects[0];
  deck.pickResult=picked(mesh);
  assert.equal(surface.pick(320,240)?.id,mesh.id);assert.equal(deck.pickCalls.length,1);
  const moved={...camera,focus:{x:512,y:0},exaggeration:2};
  surface.setCamera(moved);
  assert.equal(surface.frameUsable,false);assert.equal(surface.pick(320,240),null);assert.equal(deck.pickCalls.length,1);
  surface.setScene(model(object('replacement')));
  assert.equal(surface.frameUsable,false);
  env.setSize(800,500);surface.resize();
  assert.equal(surface.frame.viewport.width,800);assert.equal(surface.frame.viewport.height,500);
  assert.equal(surface.frameUsable,false);
  deck.fireRender();assert.equal(surface.frameUsable,true,'one render of latest props validates the accumulated revision');
  surface.dispose();
});

test('timeout cleans Deck, observer and canvas; disposed surfaces ignore late callbacks',async t=>{
  const env=environment(t),decks=[];
  await assert.rejects(AtlasDeckSurface.create({container:env.container,camera,model:model(),timeoutMs:15,
    createDeck:props=>{const deck=new FakeDeck(props);decks.push(deck);return deck;}}),/frame readiness timeout/i);
  assert.equal(decks[0].finalizeCalls,1);assert.equal(env.container.querySelectorAll('canvas').length,0);assert.equal(env.getObserver().disconnected,true);

  const active=await readySurface(t);const {surface,deck}=active;
  const setsBefore=deck.setPropsCalls.length;surface.dispose();
  deck.fireLoad();deck.fireRender();deck.fireError();
  assert.equal(surface.frameUsable,false);assert.equal(deck.setPropsCalls.length,setsBefore);
  assert.equal(active.env.container.querySelectorAll('canvas').length,0);
  assert.equal(deck.finalizeCalls,1);
});

test('GPU context recovery retains camera/model and replaces one canvas with a fresh Deck',async t=>{
  const initialModel=model(),initialCamera={...camera,focus:{x:-768,y:512},focusHeightM:17,exaggeration:4};
  const active=await readySurface(t,{camera:initialCamera,model:initialModel});
  const {surface,decks,env}=active,oldDeck=decks[0],oldCanvas=surface.canvas;
  const event=new env.window.Event('webglcontextlost',{cancelable:true});oldCanvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(decks.length,2);assert.equal(oldDeck.finalizeCalls,1);assert.notEqual(surface.canvas,oldCanvas);
  assert.equal(env.container.querySelectorAll('canvas').length,1);
  assert.deepEqual(surface.camera,initialCamera);assert.equal(surface.model,initialModel);
  decks[1].fireLoad();decks[1].fireRender();await surface.waitForFrame();
  assert.equal(surface.frameUsable,true);
  surface.dispose();
});

test('Deck errors fail closed and never permit stale picking',async t=>{
  const errors=[],active=await readySurface(t,{onError:error=>errors.push(error)}),{surface,deck}=active;
  const waiting=surface.setCamera({...camera,focus:{x:12,y:9}});
  assert.equal(surface.frameUsable,false);
  const frameWait=surface.waitForFrame();
  const error=new Error('device lost while rebuilding');deck.fireError(error);
  await assert.rejects(frameWait,/device lost while rebuilding/);
  assert.deepEqual(errors,[error]);assert.equal(surface.frameUsable,false);assert.equal(surface.pick(10,10),null);
  deck.fireRender();assert.equal(surface.frameUsable,false,'an already queued afterRender cannot revive a failed generation');
  surface.dispose();void waiting;
});

test('mesh geometry and instance data survive camera, snapped-origin and exaggeration changes',()=>{
  const mesh=object('cached'),scene=model(mesh);
  const first=atlasDeckSceneLayers(scene,atlasMetricFrameForTest(camera,640,480))[0];
  const farther={...camera,focus:{x:768,y:-512},focusHeightM:300,exaggeration:3};
  const second=atlasDeckSceneLayers(scene,atlasMetricFrameForTest(farther,640,480))[0];
  assert.equal(first.props.mesh,second.props.mesh);assert.equal(first.props.data,second.props.data);
  assert.deepEqual(second.props.getScale,[1,1,3]);
  assert.deepEqual(second.props.getPosition,[mesh.origin.x-768,mesh.origin.y+512,(mesh.origin.heightM-256)*3]);
  assert.deepEqual(second.props.updateTriggers.getPosition,[768,-512,256,3]);
  assert.equal(second.props.updateTriggers.getScale,3);
  assert.notDeepEqual(first.props.updateTriggers.getPosition,second.props.updateTriggers.getPosition);
  assert.notEqual(first.props.updateTriggers.getScale,second.props.updateTriggers.getScale);
});

test('foreign, stale and wrong-layer pick results are rejected',async t=>{
  const active=await readySurface(t),{surface,deck}=active,current=surface.model.objects[0];
  deck.pickResult=picked(object('foreign'));
  assert.equal(surface.pick(320,240),null);
  deck.pickResult=picked(current,'atlas-scene:stale-layer');
  assert.equal(surface.pick(320,240),null);
  deck.pickResult={...picked(current),index:1};
  assert.equal(surface.pick(320,240),null);
  deck.pickResult=picked(current);
  assert.equal(surface.pick(320,240)?.id,current.id);
  surface.dispose();
});

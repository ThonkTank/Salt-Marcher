import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';

buildSync({entryPoints:['src/app/atlas-maplibre-bridge.ts'],outfile:'.build/atlas-maplibre-bridge-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasMapLibreBridge} = await import('../.build/atlas-maplibre-bridge-test.mjs');

const matrix = seed => Array.from({length:16},(_,index)=>index%5===0?1:seed+index/100);
const input = (seed=0) => ({
  modelViewProjectionMatrix:matrix(seed+1),
  projectionMatrix:matrix(seed+2),
  defaultProjectionData:{mainMatrix:matrix(seed+3)},
  nearZ:.1,
  farZ:1_000
});

class FakeMap {
  layers = new Map();
  listeners = new Map();
  controls = new Set();
  sourceLoaded = new Map();
  styleLoaded = true;
  failNextAdd = false;
  styleDataDuringAdd = false;
  holdNextFrame = false;
  nextFrameInput = null;

  isStyleLoaded(){return this.styleLoaded;}
  getLayer(id){return this.layers.get(id);}
  addLayer(layer,beforeId){
    if(this.failNextAdd){this.failNextAdd=false;throw new Error('synthetic addLayer failure');}
    const ordered=new Map(this.layers);
    this.layers.clear();
    for(const [id,value] of ordered){if(id===beforeId)this.layers.set(layer.id,layer);this.layers.set(id,value);}
    if(!this.layers.has(layer.id))this.layers.set(layer.id,layer);
    if(this.styleDataDuringAdd){this.styleDataDuringAdd=false;this.emit('styledata');}
    if(!this.holdNextFrame)layer.render?.(null,input());
  }
  removeLayer(id){this.layers.delete(id);}
  getSource(id){return this.sourceLoaded.has(id)?{}:undefined;}
  isSourceLoaded(id){return this.sourceLoaded.get(id)===true;}
  getLayersOrder(){return [...this.layers.keys()];}
  triggerRepaint(){if(!this.holdNextFrame)this.render();}
  flushFrame(){this.holdNextFrame=false;this.render(this.nextFrameInput??input());this.nextFrameInput=null;}
  render(frame=input()){
    this.layers.get('atlas-projection-diagnostic')?.render?.(null,frame);
  }
  addControl(control){
    this.controls.add(control);
    control._map=this;
    control._deck={};
    this.on('styledata',control._handleStyleChange);
    control._handleStyleChange?.();
  }
  removeControl(control){
    this.controls.delete(control);
    this.off('styledata',control._handleStyleChange);
    control._map=undefined;
    control._deck=undefined;
  }
  on(type,listener){const list=this.listeners.get(type)??new Set();list.add(listener);this.listeners.set(type,list);}
  once(type,listener){const once=(event)=>{this.off(type,once);listener(event);};this.on(type,once);}
  off(type,listener){this.listeners.get(type)?.delete(listener);}
  emit(type,event={}){for(const listener of [...(this.listeners.get(type)??[])])listener(event);}
  get listenerCount(){return [...this.listeners.values()].reduce((count,list)=>count+list.size,0);}
}

class FakeOverlay {
  _map;
  _deck;
  _props;
  _handleStyleChange=()=>{};
  calls=[];
  constructor(props){this._props={...props};}
  setProps(props){this.calls.push(props);this._props={...this._props,...props};this._props.views?.makeViewport({width:320,height:240,viewState:{}});}
}

const makeBridge = (map, root, sceneOrigin, more={}) => {
  let overlay;
  const bridge=new AtlasMapLibreBridge({
    map:map,
    root,
    sceneOrigin,
    createOverlay:props=>{overlay=new FakeOverlay(props);return overlay;},
    ...more
  });
  return {bridge,get overlay(){return overlay;}};
};

test('bridge owns independent frozen roots, origins, frames and view revisions per map', async()=>{
  const aMap=new FakeMap(),bMap=new FakeMap();
  const a=makeBridge(aMap,{x:-32,y:-32,size:64},{x:4,y:7});
  const b=makeBridge(bMap,{x:100,y:200,size:128},{x:120,y:240});
  await a.bridge.attach([]);
  await b.bridge.attach([]);

  assert.notEqual(a.bridge.frame,b.bridge.frame);
  assert.equal(a.bridge.frame.mainMatrix[1],3.01);
  assert.equal(b.bridge.frame.mainMatrix[1],3.01);
  assert.ok(Object.isFrozen(a.bridge.root));
  assert.ok(Object.isFrozen(a.bridge.sceneOrigin));
  const aView=a.overlay._props.views;
  const bView=b.overlay._props.views;
  assert.notEqual(aView,bView);

  aMap.render(input(10));
  assert.notEqual(a.overlay._props.views.props.matrixRevision,b.overlay._props.views.props.matrixRevision);
  assert.equal(b.bridge.frame.mainMatrix[1],3.01);
  a.bridge.dispose();
  b.bridge.dispose();
});

test('matrix capture invalidates Deck view cache when either public matrix changes', async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  const initialRevision=fixture.overlay._props.views.props.matrixRevision;
  map.render({...input(),projectionMatrix:matrix(20)});
  const projectionRevision=fixture.overlay._props.views.props.matrixRevision;
  assert.ok(projectionRevision>initialRevision);
  map.render({...input(),mainMatrix:undefined,defaultProjectionData:{mainMatrix:matrix(30)}});
  assert.ok(fixture.overlay._props.views.props.matrixRevision>projectionRevision);
  fixture.bridge.dispose();
});

test('fresh-frame epoch gates picks after move and resize until unchanged matrices are captured again',async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  const captured=fixture.bridge.frame;
  assert.equal(fixture.bridge.frameUsable,true);
  for(const event of ['move','resize']){
    map.emit(event);
    assert.equal(fixture.bridge.frameUsable,false,`${event} must invalidate the pick frame synchronously`);
    assert.equal(fixture.bridge.frame,captured,'the previous frame remains available to Deck while repaint is pending');
    map.render(input());
    assert.equal(fixture.bridge.frameUsable,true,`${event} must recover after a custom-layer capture`);
    assert.equal(fixture.bridge.frame,captured,'an unchanged matrix still captures the current epoch');
  }
  fixture.bridge.dispose();
});

test('style reload keeps retained Deck matrices but blocks picks until a post-reload capture',async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  const captured=fixture.bridge.frame;
  map.layers.clear();
  map.holdNextFrame=true;
  map.emit('styledataloading');
  assert.equal(fixture.bridge.frameUsable,false,'the public style-loading event invalidates synchronously at setStyle start');
  assert.equal(fixture.bridge.frame,captured,'the retained frame remains available while MapLibre loads replacement style data');
  map.emit('style.load');
  assert.equal(fixture.bridge.frameUsable,false,'style.load invalidates before asynchronous reconciliation');
  assert.equal(fixture.bridge.frame,captured,'retained matrices keep Deck view construction alive during reconciliation');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(map.getLayer('atlas-projection-diagnostic'));
  assert.equal(fixture.bridge.frameUsable,false,'layer installation alone is not a fresh render');
  map.flushFrame(input());
  await fixture.bridge.waitForStyleReconciliation();
  assert.equal(fixture.bridge.frameUsable,true,'a new capture restores pick readiness even when its matrices are unchanged');
  assert.equal(fixture.bridge.frame,captured);
  fixture.bridge.dispose();
});

test('style reload reinstalls capture before public layer-group reconciliation', async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  map.layers.clear();
  map.layers.set('deck-maplibre-layer-group-last',{id:'deck-maplibre-layer-group-last'});
  map.emit('style.load');
  await fixture.bridge.waitForStyleReconciliation();
  assert.ok(map.getLayer('atlas-projection-diagnostic'));
  assert.ok(map.getLayersOrder().indexOf('atlas-projection-diagnostic')<map.getLayersOrder().indexOf('deck-maplibre-layer-group-last'));
  const lastSetProps=fixture.overlay.calls.at(-1);
  assert.ok(lastSetProps.views);
  assert.equal(lastSetProps.layers.length,0);
  fixture.bridge.dispose();
  assert.equal(map.listenerCount,0);
});

test('styledata can build a view from the retained frame while reconciliation waits for the new capture frame',async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  const priorFrame=fixture.bridge.frame;
  map.layers.clear();
  map.styleDataDuringAdd=true;
  map.holdNextFrame=true;
  map.nextFrameInput=input(40);
  map.emit('style.load');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(map.getLayer('atlas-projection-diagnostic'));
  assert.ok(fixture.overlay._props.views.makeViewport({width:320,height:240,viewState:{}}));
  assert.equal(fixture.bridge.frame,priorFrame,'the last valid frame remains available during styledata');

  let reconciled=false;
  const pending=fixture.bridge.waitForStyleReconciliation().then(()=>{reconciled=true;});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(reconciled,false,'style reconciliation waits for a render from the reinstalled capture layer');
  map.flushFrame();
  await pending;
  assert.equal(reconciled,true);
  assert.notEqual(fixture.bridge.frame,priorFrame);
  fixture.bridge.dispose();
});

test('dispose cancels bridge ownership and removes its control, capture layer and listener', async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await fixture.bridge.attach([]);
  assert.equal(map.controls.size,1);
  assert.equal(map.listenerCount,5);
  fixture.bridge.dispose();
  fixture.bridge.dispose();
  assert.equal(map.controls.size,0);
  assert.equal(map.getLayer('atlas-projection-diagnostic'),undefined);
  assert.equal(map.listenerCount,0);
  assert.equal(fixture.bridge.frame,null);
});

test('style reload failures are retained and reported through onError', async()=>{
  const map=new FakeMap(),reported=[];
  const fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0},{onError:error=>reported.push(error)});
  await fixture.bridge.attach([]);
  map.layers.clear();
  map.failNextAdd=true;
  map.emit('style.load');
  await assert.rejects(fixture.bridge.waitForStyleReconciliation(),/synthetic addLayer failure/);
  assert.equal(reported.length,1);
  assert.equal(fixture.bridge.error,reported[0]);
  fixture.bridge.dispose();
});

test('missing pinned private style hook fails closed before adding the overlay', async()=>{
  const map=new FakeMap();
  const bridge=new AtlasMapLibreBridge({
    map,
    root:{x:-64,y:-64,size:128},
    sceneOrigin:{x:0,y:0},
    createOverlay:props=>{
      const overlay=new FakeOverlay(props);
      delete overlay._handleStyleChange;
      return overlay;
    }
  });
  await assert.rejects(bridge.attach([]),/private style hook is unavailable/);
  assert.equal(map.controls.size,0);
  assert.equal(map.getLayer('atlas-projection-diagnostic'),undefined);
  bridge.dispose();
});

test('constructor rejects malformed roots and non-finite origins',()=>{
  const map=new FakeMap();
  assert.throws(()=>new AtlasMapLibreBridge({map,root:{x:0,y:0,size:3},sceneOrigin:{x:1,y:1}}),/Invalid metric rendering root/);
  assert.throws(()=>new AtlasMapLibreBridge({map,root:{x:-64,y:-64,size:128},sceneOrigin:{x:NaN,y:0}}),/root-relative offsets must be finite/);
  assert.throws(()=>new AtlasMapLibreBridge({map,root:{x:-64,y:-64,size:128},sceneOrigin:{x:0,y:Infinity}}),/root-relative offsets must be finite/);
});

test('finite scene origin outside the current root still yields finite local viewport coordinates',async()=>{
  const map=new FakeMap(),fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:65,y:-70});
  await fixture.bridge.attach([]);
  const viewport=fixture.overlay._props.views.makeViewport({width:320,height:240,viewState:{}});
  const projected=viewport.project([0,0,0]);
  assert.ok(projected.every(Number.isFinite));
  assert.ok(viewport.viewMatrix.every(Number.isFinite));
  fixture.bridge.dispose();
});

test('attach rejects a foreign capture id and disposal preserves that layer',async()=>{
  const map=new FakeMap(),foreign={id:'atlas-projection-diagnostic',type:'foreign'};
  map.layers.set(foreign.id,foreign);
  const fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  await assert.rejects(fixture.bridge.attach([]),/already owned by another layer/);
  fixture.bridge.dispose();
  assert.equal(map.getLayer(foreign.id),foreign);
  assert.equal(map.controls.size,0);
});

test('concurrent attach fails synchronously without creating a second owner',async()=>{
  const map=new FakeMap();map.styleLoaded=false;
  const fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0});
  const first=fixture.bridge.attach([]);
  await assert.rejects(fixture.bridge.attach([]),/already attached or attaching/);
  map.styleLoaded=true;map.emit('style.load');
  await first;
  assert.equal(map.controls.size,1);
  fixture.bridge.dispose();
});

test('overlay creation failure removes only the capture layer it installed',async()=>{
  const map=new FakeMap();
  const bridge=new AtlasMapLibreBridge({
    map,
    root:{x:-64,y:-64,size:128},
    sceneOrigin:{x:0,y:0},
    createOverlay:()=>{throw new Error('synthetic overlay construction failure');}
  });
  await assert.rejects(bridge.attach([]),/synthetic overlay construction failure/);
  assert.equal(map.getLayer('atlas-projection-diagnostic'),undefined);
  assert.equal(map.controls.size,0);
  bridge.dispose();
});

test('superseded style waits cannot install a stale capture layer',async()=>{
  const map=new FakeMap();map.sourceLoaded.set('catalog',true);
  const fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0},{sourceIds:['catalog']});
  await fixture.bridge.attach([]);
  map.layers.clear();
  map.sourceLoaded.set('catalog',false);
  map.emit('style.load');
  map.emit('style.load');
  map.sourceLoaded.set('catalog',true);
  map.emit('sourcedata',{dataType:'source',sourceId:'catalog'});
  await fixture.bridge.waitForStyleReconciliation();
  assert.equal(map.getLayersOrder().filter(id=>id==='atlas-projection-diagnostic').length,1);
  fixture.bridge.dispose();
});

test('late layer reconciliation failure blocks picks despite an already captured fresh frame',async()=>{
  const map=new FakeMap(),errors=[];
  const fixture=makeBridge(map,{x:-64,y:-64,size:128},{x:0,y:0},{onError:error=>errors.push(error)});
  await fixture.bridge.attach([]);
  const original=fixture.overlay.setProps.bind(fixture.overlay);
  fixture.overlay.setProps=()=>{throw new Error('late layer reconciliation failure');};
  map.layers.clear();map.emit('style.load');
  await assert.rejects(fixture.bridge.waitForStyleReconciliation(),/late layer reconciliation failure/);
  assert(fixture.bridge.frame,'the retained frame is still needed by Deck');
  assert.equal(fixture.bridge.frameUsable,false,'a captured frame cannot authorize picks after reconciliation failed');
  assert.equal(errors.length,1);
  fixture.overlay.setProps=original;map.emit('style.load');
  await fixture.bridge.waitForStyleReconciliation();
  assert.equal(fixture.bridge.frameUsable,true);
  fixture.bridge.dispose();
});

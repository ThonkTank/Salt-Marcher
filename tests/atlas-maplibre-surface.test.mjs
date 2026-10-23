import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-maplibre-surface.ts'],outfile:'.build/atlas-maplibre-surface-test.mjs',bundle:true,platform:'node',format:'esm'});
const {AtlasMapLibreSurface} = await import('../.build/atlas-maplibre-surface-test.mjs');

class FakeElement {
  style = {};
  children = [];
  listeners = new Map();
  ownerDocument;
  parentElement = null;
  constructor(doc){this.ownerDocument=doc;}
  append(child){child.parentElement=this;this.children.push(child);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  addEventListener(type,fn){const list=this.listeners.get(type)??new Set();list.add(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatch(type,event={}){for(const fn of [...(this.listeners.get(type)??[])])fn(event);}
  focus(){this.ownerDocument.activeElement=this;}
}
class FakeDocument extends FakeElement {
  defaultView={getComputedStyle:()=>({position:'relative'})};
  activeElement=null;
  constructor(){super(null);this.ownerDocument=this;}
  createElement(){return new FakeElement(this);}
}
class FakeMap {
  listeners=new Map();
  removed=false;
  frameReady=false;
  styleLoaded=true;
  moving=false;
  images=new Set();
  holdFrames=false;
  removeThrows=false;
  constructor(options){this.options=options;this.container=options.container;this.canvas=this.container.ownerDocument.createElement('canvas');this.container.append(this.canvas);this.center=options.center;this.zoom=options.zoom;this.bearing=options.bearing;this.pitch=options.pitch;this.elevation=options.elevation??0;this.maxZoom=options.maxZoom;}
  on(type,fn){const list=this.listeners.get(type)??new Set();list.add(fn);this.listeners.set(type,list);}
  off(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of [...(this.listeners.get(type)??[])])fn(event);}
  isStyleLoaded(){return this.styleLoaded;}
  isMoving(){return this.moving;}
  setCenterClampedToGround(value){this.clamped=value;}
  jumpTo(camera){Object.assign(this,{center:camera.center,zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch,elevation:camera.elevation??this.elevation});this.emit('move');}
  triggerRepaint(){if(!this.holdFrames){this.frameReady=true;this.emit('render');}}
  flushFrame(){this.holdFrames=false;this.frameReady=true;this.emit('render');}
  resize(){this.emit('resize');}
  getCenter(){return {lng:this.center[0],lat:this.center[1]};}
  getZoom(){return this.zoom;}
  getBearing(){return this.bearing;}
  getPitch(){return this.pitch;}
  getCenterElevation(){return this.elevation;}
  getContainer(){return this.container;}
  getCanvas(){return this.canvas;}
  hasImage(id){return this.images.has(id);}
  addImage(id){this.images.add(id);}
  remove(){this.removed=true;this.listeners.clear();if(this.removeThrows)throw new Error('synthetic map remove failure');}
}
class FakeBridge {
  error=null;
  constructor({map}){this.map=map;this.map.on('render',this.onRender);this.map.on('move',this.onInvalidate);this.map.on('resize',this.onInvalidate);}
  onRender=()=>{this.frameUsable=true;};
  onInvalidate=()=>{this.frameUsable=false;};
  frameUsable=false;
  async attach(){return this;}
  async waitForStyleReconciliation(){}
  dispose(){this.map.off('render',this.onRender);this.map.off('move',this.onInvalidate);this.map.off('resize',this.onInvalidate);this.disposed=true;}
}
class FakeScene {
  constructor(bridge){this.bridge=bridge;}
  update(model){this.model=model;}
  dispose(){this.disposed=true;}
}
const pose={focus:{x:0,y:0},focusHeightM:145,metersPerPixel:.5,rotation:28,tilt:55};
const root={x:-32,y:-32,size:64};
const sourceResolution={sourceIds:['anchors'],baseRootSize:64,baseMaxZoom:22,maximumMaxZoom:24};
const makeFixture=({prepare,timeoutMs=1000,maximumMaxZoom=24}={})=>{
  const doc=new FakeDocument(),host=doc.createElement('host');
  const maps=[],projections=new Set();let revision=0;
  const prepareFn=prepare??(async(_snapshot,nextRoot)=>({model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{revision:++revision,rootSize:nextRoot.size}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1+Math.log2(nextRoot.size/64),maxzoom:10+Math.log2(nextRoot.size/64)}]}}));
  const surfaceOptions={container:host,root,sceneOrigin:{x:0,y:0},pose,snapshot:()=>snapshotValue,prepare:prepareFn,
    sourceResolution:{...sourceResolution,maximumMaxZoom},timeoutMs,maxZoom:32,
    createMap:options=>{const map=new FakeMap(options);maps.push(map);return map;},createBridge:options=>new FakeBridge(options),createScene:bridge=>new FakeScene(bridge),
    registerProjection:crs=>{if(projections.has(crs.name))throw new Error('duplicate CRS');projections.add(crs.name);},removeProjection:name=>projections.delete(name),onError:()=>{}};
  let snapshotValue={revision:1};
  return {doc,host,maps,projections,options:surfaceOptions,setSnapshot(value){snapshotValue=value;}};
};
const waitFor=async(predicate)=>{const deadline=Date.now()+500;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1));}throw new Error('condition did not become true');};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('root expansion rebuilds root-bound sources, shifts layer thresholds, preserves pose and transfers focus',async()=>{
  const f=makeFixture();
  const surface=await AtlasMapLibreSurface.create(f.options);
  const old=surface.current.map;
  old.getCanvas().focus();
  assert.equal(await surface.expand({x:50,y:50,width:1,height:1}),true);
  const current=surface.current;
  assert.notEqual(current.map,old);
  assert.equal(old.removed,true);
  assert.equal(current.root.size,128);
  assert.equal(current.map.options.maxPitch,75);
  assert.equal(current.map.options.renderWorldCopies,false);
  assert.equal(current.map.clamped,false);
  assert.equal(current.map.getCenterElevation(),pose.focusHeightM);
  assert.equal(f.doc.activeElement,current.map.getCanvas());
  assert.equal(current.model.root.size,128);
  assert.equal(f.projections.size,1);
  assert.equal(await surface.expand({x:1,y:1,width:1,height:1}),false,'bounds already inside the current root are a no-op');
  surface.dispose();
  assert.equal(current.map.removed,true);
  assert.equal(f.projections.size,0);
  assert.equal(f.host.children.length,0);
});

test('source-detail cap and unshifted style zoom thresholds reject the candidate without replacing the current map',async()=>{
  const capped=makeFixture({maximumMaxZoom:23});
  const surface=await AtlasMapLibreSurface.create(capped.options);
  const original=surface.current.map;
  await assert.rejects(surface.expand({x:1000,y:1000,width:1,height:1}),/requires GeoJSON maxzoom 27, above the supported cap 23/);
  assert.equal(surface.current.map,original);
  assert.equal(capped.maps.length,1,'root detail is checked before candidate map allocation');
  surface.dispose();

  const wrong=makeFixture({prepare:async(_snapshot,nextRoot)=>({model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{rootSize:nextRoot.size}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1,maxzoom:10}]}})});
  const second=await AtlasMapLibreSurface.create(wrong.options);
  const prior=second.current.map;
  await assert.rejects(second.expand({x:50,y:50,width:1,height:1}),/minzoom must shift by 1/);
  assert.equal(second.current.map,prior);
  assert.equal(wrong.maps.length,1);
  second.dispose();
});

test('overlapping expansions abort stale work, union requested bounds, and ignore late preparation',async()=>{
  const first=deferred(),second=deferred(),signals=[];let calls=0;
  const f=makeFixture({prepare:async(snapshot,nextRoot,_origin,signal)=>{
    if(nextRoot.size!==64){signals.push(signal);calls++;await (calls===1?first.promise:second.promise);}
    return {model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{snapshot,rootSize:nextRoot.size}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1+Math.log2(nextRoot.size/64),maxzoom:10+Math.log2(nextRoot.size/64)}]}};
  }});
  const surface=await AtlasMapLibreSurface.create(f.options);
  const one=surface.expand({x:50,y:50,width:1,height:1});
  await waitFor(()=>calls===1);
  const two=surface.expand({x:-50,y:-50,width:1,height:1});
  await waitFor(()=>calls===2);
  assert.equal(signals[0].aborted,true);
  first.resolve();
  assert.equal(await one,false);
  second.resolve();
  assert.equal(await two,true);
  assert.equal(surface.current.root.size,256,'the second candidate includes both requested extents');
  assert.equal(f.maps.length,2,'late first prepare must not allocate a map');
  surface.dispose();
});

test('candidate is not published until a post-scene frame is actually captured',async()=>{
  const f=makeFixture();
  const createMap=f.options.createMap;
  f.options.createMap=options=>{
    const map=createMap(options);
    if(f.maps.length===2)map.holdFrames=true;
    return map;
  };
  const surface=await AtlasMapLibreSurface.create(f.options);
  const old=surface.current.map;
  const expansion=surface.expand({x:50,y:50,width:1,height:1});
  await waitFor(()=>f.maps.length===2);
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(surface.current.map,old,'a stale or missing candidate frame cannot publish');
  assert.equal(f.maps[1].frameReady,false);
  f.maps[1].flushFrame();
  assert.equal(await expansion,true);
  assert.equal(surface.current.map,f.maps[1]);
  surface.dispose();
});

test('snapshot changes, timeouts, and disposal abort candidates and clean all owned resources',async()=>{
  const pending=deferred();
  const f=makeFixture({prepare:async(snapshot,nextRoot,_origin,signal)=>{
    if(nextRoot.size===64)return {model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22,data:{snapshot}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1,maxzoom:10}]}};
    await pending.promise;
    if(signal.aborted) throw signal.reason;
    return {model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{snapshot}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1+Math.log2(nextRoot.size/64),maxzoom:10+Math.log2(nextRoot.size/64)}]}};
  }});
  const surface=await AtlasMapLibreSurface.create(f.options);
  const original=surface.current.map;
  const expansion=surface.expand({x:50,y:50,width:1,height:1});
  await waitFor(()=>f.maps.length===1);
  f.setSnapshot({revision:2});
  pending.resolve();
  assert.equal(await expansion,false);
  assert.equal(surface.current.map,original);
  assert.equal(f.projections.size,1);
  surface.dispose();

  const never=deferred();
  const timed=makeFixture({timeoutMs:60,prepare:async(_snapshot,nextRoot)=>{
    if(nextRoot.size!==64)await never.promise;
    return {model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{rootSize:nextRoot.size}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1+Math.log2(nextRoot.size/64),maxzoom:10+Math.log2(nextRoot.size/64)}]}};
  }});
  const timedSurface=await AtlasMapLibreSurface.create(timed.options);
  await assert.rejects(timedSurface.expand({x:50,y:50,width:1,height:1}),/timed out/);
  assert.equal(timedSurface.current.root.size,64);
  assert.equal(timed.maps.length,1);
  timedSurface.dispose();

  const ignored=deferred();
  const disposed=makeFixture({prepare:async(_snapshot,nextRoot)=>{
    if(nextRoot.size!==64)await ignored.promise;
    return {model:{root:{...nextRoot},sceneOrigin:{x:0,y:0},verticalExaggeration:1,objects:[],targets:new Map()},style:{version:8,sources:{anchors:{type:'geojson',maxzoom:22+Math.log2(nextRoot.size/64),data:{rootSize:nextRoot.size}}},layers:[{id:'anchor-labels',type:'symbol',source:'anchors',minzoom:1+Math.log2(nextRoot.size/64),maxzoom:10+Math.log2(nextRoot.size/64)}]}};
  }});
  const disposedSurface=await AtlasMapLibreSurface.create(disposed.options);
  const canceled=disposedSurface.expand({x:50,y:50,width:1,height:1});
  disposedSurface.dispose();
  assert.equal(await canceled,false);
  ignored.resolve();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(disposed.maps.length,1,'late prepare after dispose cannot allocate resources');
  assert.equal(disposed.projections.size,0);
});

test('camera changes stay in sync while an active pointer gesture blocks publication',async()=>{
  const f=makeFixture();
  const surface=await AtlasMapLibreSurface.create(f.options);
  const source=surface.current.map;
  source.getContainer().dispatch('pointerdown',{pointerId:7});
  const expansion=surface.expand({x:50,y:50,width:1,height:1});
  await waitFor(()=>f.maps.length===2);
  const candidate=f.maps[1];
  source.moving=true;
  source.jumpTo({center:[20,-20],zoom:source.zoom,bearing:71,pitch:62,elevation:310});
  await waitFor(()=>candidate.center[0]===-22&&candidate.center[1]===22&&candidate.bearing===71);
  assert.equal(surface.current.map,source,'an in-progress pointer gesture keeps the current map published');
  assert.equal(candidate.elevation,310);
  source.moving=false;
  source.emit('moveend');
  f.doc.dispatch('pointerup',{pointerId:7});
  assert.equal(await expansion,true);
  assert.equal(surface.current.map,candidate);
  assert.equal(candidate.zoom,-1,'root growth preserves physical meters per pixel');
  surface.dispose();
});

test('failed candidate style source leaves the live surface intact and releases candidate CRS',async()=>{
  let created=0;
  const f=makeFixture();
  const makeMap=f.options.createMap;
  f.options.createMap=options=>{
    const map=makeMap(options);created++;
    if(created===2){const emit=map.triggerRepaint.bind(map);map.triggerRepaint=()=>{map.emit('error',{sourceId:'anchors',error:new Error('source failed')});emit();};}
    return map;
  };
  const surface=await AtlasMapLibreSurface.create(f.options);
  const original=surface.current.map;
  await assert.rejects(surface.expand({x:50,y:50,width:1,height:1}),/source failed/);
  assert.equal(surface.current.map,original);
  assert.equal(f.maps.length,2);
  assert.equal(f.maps[1].removed,true);
  assert.equal(f.projections.size,1);
  surface.dispose();
});

test('throwing cleanup reporter cannot interrupt disposal or lose a published replacement',async()=>{
  const f=makeFixture();
  f.options.onError=()=>{throw new Error('reporter failure');};
  const createMap=f.options.createMap;
  f.options.createMap=options=>{
    const map=createMap(options);
    if(f.maps.length===1)map.removeThrows=true;
    return map;
  };
  const surface=await AtlasMapLibreSurface.create(f.options);
  const old=surface.current.map;
  assert.equal(await surface.expand({x:50,y:50,width:1,height:1}),true);
  assert.equal(surface.current.map, f.maps[1]);
  assert.equal(old.removed,true);
  assert.equal(f.projections.size,1);
  surface.dispose();
  assert.equal(f.projections.size,0);
});

test('initial configuration is captured before asynchronous preparation',async()=>{
  const f=makeFixture(),gate=deferred(),prepare=f.options.prepare;
  const inputRoot={...root},inputOrigin={x:0,y:0},inputPose={...pose,focus:{...pose.focus}};
  f.options.root=inputRoot;f.options.sceneOrigin=inputOrigin;f.options.pose=inputPose;
  f.options.prepare=async(...args)=>{await gate.promise;return prepare(...args);};
  const pending=AtlasMapLibreSurface.create(f.options);
  inputRoot.size=256;inputOrigin.x=40;inputPose.focus.x=17;
  gate.resolve();const surface=await pending;
  assert.deepEqual(surface.current.root,root);
  assert.deepEqual(surface.current.sceneOrigin,{x:0,y:0});
  assert.equal(surface.current.map.getCenter().lng,0);
  surface.dispose();
});

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
const fmt=(color,depth='depth24plus',width=640,height=480)=>({width,height,colorAttachments:[{texture:{format:color}}],depthStencilAttachment:{texture:{format:depth}},destroyed:false,destroy(){this.destroyed=true;}});

class FakeDeck {
  constructor(props) {
    this.props=props;this.setPropsCalls=[];this.redrawCalls=[];this.finalizeCalls=0;this.pickCalls=[];
    this.pickResult=null;
    this.deckPicker={_resizeBuffer(){},device:{isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true},
      pickingFBO:fmt('rgba8unorm','depth24plus',props.canvas.width,props.canvas.height),depthFBO:fmt('rgba32float','depth24plus',props.canvas.width,props.canvas.height)};
  }
  setProps(props){this.setPropsCalls.push(props);if(this.setPropsError)throw this.setPropsError;this.props={...this.props,...props};}
  redraw(reason){this.redrawCalls.push(reason);}
  fireLoad(){this.props.onLoad?.();}
  fireRender(){this.props.onBeforeRender?.();for(const layer of this.props.layers??[]){Object.defineProperty(layer,'isLoaded',{value:true,configurable:true});if(layer.props.visible!==false&&!this.suppressFieldDraw)layer.props.onDrawSuccess?.(Math.fround(layer.props.alpha));}this.props.onAfterRender?.();}
  fireError(error=new Error('fake Deck failure')){this.props.onError?.(error);}
  pickObject(args){this.pickCalls.push(args);return this.pickResult;}
  finalize(){this.finalizeCalls++;}
}

function environment(t) {
  const {window,document}=parseHTML('<html><body><div id="host"></div></body></html>');
  const previous={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let observer;
  globalThis.document=document;globalThis.window=window;
  globalThis.requestAnimationFrame??=()=>1;globalThis.cancelAnimationFrame??=()=>{};
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

function fieldSource(id,height=100){
  const box={x:0,y:0,width:256,height:256},view={box,columns:65,rows:65},data=new Uint8Array(256*256*4),texture={width:256,height:256,data};
  return{object:{id,target:{kind:'terrain',id},origin:{x:0,y:0,heightM:0}},grid:{view,heights:new Float32Array(65*65).fill(height)},texture,masks:texture,cover:texture,relief:texture};
}
function fieldDevice(){
  const textures=[],uploads=[],gl={NO_ERROR:0,TEXTURE_BINDING_2D_ARRAY:1,TEXTURE_BINDING_2D:9,UNPACK_ALIGNMENT:2,UNPACK_ROW_LENGTH:3,TEXTURE_2D_ARRAY:4,TEXTURE_2D:10,RGBA:5,UNSIGNED_BYTE:6,RED:7,FLOAT:8,RED_INTEGER:11,
    lost:false,isContextLost(){return this.lost;},
    getParameter:key=>key===2?4:key===3?0:null,getError:()=>0,bindTexture(_target,value){this.bound=value;},pixelStorei(){},texSubImage3D(_target,_level,_x,_y,slot,_width,_height,_depth,_format,_type,data){if(this.bound?.failCount){this.bound.failCount--;throw Error('injected partial upload');}uploads.push({texture:this.bound?.owner?.props.id,slot,first:data[0]});},texSubImage2D(){}};
  const device={type:'webgl',gl,statsManager:{getStats:()=>({get:()=>({count:0})})},isTextureFormatSupported:()=>true,createTexture:props=>{const texture={props,width:props.width,height:props.height,depth:props.depth??1,samples:1,format:props.format,handle:{},destroyed:false,destroy(){this.destroyed=true;}};texture.handle.owner=texture;textures.push(texture);return texture;}};
  return{device,textures,uploads};
}

function preparedFixture({morph=false,oldOnly=false,initialRevision=1}={}){
  let nextId=1;const buffers=new Map();
  const ref=(value,kind)=>{const id=nextId++;buffers.set(id,value.buffer);return{buffer:id,kind,offset:0,length:value.length};};
  const basis=new Float32Array(14*(oldOnly?6:3));
  for(const [i,[x,y]] of [[0,0],[1,0],[0,1],...(oldOnly?[[2,0],[3,0],[2,1]]:[])].entries()){const at=i*14;basis[at]=x;basis[at+1]=y;basis[at+2]=morph?50:100;basis[at+8]=oldOnly&&i>=3?basis[at+2]:100;}
  const indices=ref(Uint32Array.from(oldOnly?[0,1,2,3,4,5]:[0,1,2]),'u32'),vertices=ref(basis,'f32');
  const rayBytes=new ArrayBuffer(oldOnly?64:32),f=new Float32Array(rayBytes),u=new Uint32Array(rayBytes);f.set([0,0,1,1]);u[7]=1;
  if(oldOnly){f.set([2,0,3,1],8);u[15]=1;u[14]=1;}
  const rayNodes=ref(u,'u32'),rayTriangles=ref(Uint32Array.from(oldOnly?[0,1]:[0]),'u32');
  const materialRef=ref(new Uint8Array(256*256*4),'u8'),height=ref(new Float32Array(65*65).fill(100),'f32');
  const materials={texture:materialRef,masks:materialRef,cover:materialRef,relief:materialRef};
  const target={token:'source',fence:'fence',revision:initialRevision},basisId={generation:1,topology:1,manifest:1};
  const source={id:1,source:target,lod:0,x:0,y:0,seaLevelM:0,height,material:materials};
  const oldMaterial=ref(new Uint8Array(256*256*4).fill(7),'u8'),oldHeight=ref(new Float32Array(65*65).fill(50),'f32');
  const oldSource={...source,id:2,height:oldHeight,material:{texture:oldMaterial,masks:oldMaterial,cover:oldMaterial,relief:oldMaterial}};
  const geometry={basis:basisId,vertices,indices,rayNodes,rayTriangles,oldSources:morph?[oldSource]:[],newSources:[source],draws:[{origin:[0,0],bounds:[0,0,1,1],oldSlot:morph?0:-1,newSlot:0,firstIndex:0,indexCount:3,rayRoot:0,rayFirstTriangle:0,rayTriangleCount:1},...(oldOnly?[{origin:[0,0],bounds:[2,0,3,1],oldSlot:0,newSlot:-1,firstIndex:3,indexCount:3,rayRoot:1,rayFirstTriangle:1,rayTriangleCount:1}]:[])]};
  const packet=(job,geometryValue,draft=null,draftSources=[])=>{
    const expected={epoch:1,job,operation:1,requestContent:job,target},capture={id:job,editSeries:1,draftRevision:job};
    return{expected,capture,buffers,result:{kind:'result',...expected,captureId:capture.id,editSeries:capture.editSeries,draftRevision:capture.draftRevision,basis:basisId,geometry:geometryValue,draft,draftSources,buffers:[],workerBackingBytes:0,transportBytes:0}};
  };
  const initial=packet(1,geometry);
  const draftValues=new Float32Array(6*3);for(let i=0;i<3;i++)draftValues[i*6]=150;
  const draft=packet(2,null,ref(draftValues,'f32'),[{sourceId:1,material:materials,height:null}]);
  return{initial,draft,buffers};
}
function rebindPrepared(packet,job,target,changes={}){
  const expected={...packet.expected,job,requestContent:job,target,...changes.expected};
  const capture={...packet.capture,id:job,draftRevision:job,...changes.capture};
  return{...packet,expected,capture,result:{...packet.result,...expected,captureId:capture.id,editSeries:capture.editSeries,draftRevision:capture.draftRevision,...changes.result}};
}

test('prepared Screen is minted only after a full draw; packed ray, draft and CPU-only Escape follow the confirmed owner',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  for(const frame of [deck.deckPicker.pickingFBO,deck.deckPicker.depthFBO])for(const attachment of [...frame.colorAttachments,frame.depthStencilAttachment])Object.assign(attachment.texture,{width:frame.width,height:frame.height});
  const {initial,draft}=preparedFixture(),screens=[];surface.observePreparedScreens(screen=>screens.push(screen));
  const contentA=surface.setPreparedTerrain(initial);assert.equal(surface.preparedScreenSnapshot,null);
  deck.suppressFieldDraw=true;deck.fireRender();assert.equal(screens.length,0);assert.equal(surface.terrainSnapshot?.field,null);
  deck.suppressFieldDraw=false;deck.fireRender();assert.equal(screens.length,1);
  assert.equal(screens[0].content,contentA);assert.equal(screens[0].fieldState,surface.terrainSnapshot.field.stateId);
  assert.equal(screens[0].endFrame,true,'an initial alpha-one Screen has only oldSlot-free draws');
  const inventoriedA=surface.preparedResourceInventory();
  assert.equal(inventoriedA.gpuArrayBytes,136_380_928);assert(inventoriedA.rendererBackingBytes>0);
  assert.equal(inventoriedA.pickerBytes,640*480*(4+4+16+4),'each real picker attachment is counted once');
  assert.deepEqual(inventoriedA.retainedBases,[initial.result.basis]);
  assert(inventoriedA.retainedBufferIds.length>=6);assert(inventoriedA.cpuPeakBytes>=inventoriedA.rendererBackingBytes);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],100);
  deck.pickResult={picked:true,index:0,layer:{id:surface.terrainSnapshot.field.layerId}};
  const pickedA=surface.pick(320,240);assert(pickedA);assert.equal(pickedA.point.heightM,100);
  const canonicalExpected={...initial.expected,job:3,requestContent:3},canonicalCapture={...initial.capture,id:3,draftRevision:3};
  const sameContextPending={...initial,expected:canonicalExpected,capture:canonicalCapture,result:{...initial.result,...canonicalExpected,captureId:3,draftRevision:3}};
  surface.setPreparedTerrain(sameContextPending);
  assert.equal(surface.preparedScreenSnapshot.content,contentA);
  assert.equal(surface.preparedInputUsable,true,'same-camera/source canonical pending must not block B-down');
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],100,'B-down ray still uses confirmed A triangle');
  surface.freezeTerrain();assert.equal(surface.pendingField,null,'B-down supersedes the unconfirmed A-final candidate');
  const escape=surface.capturePreparedEscape(),owner=surface.terrainFieldOwner;
  const contentB=surface.setPreparedTerrain(draft);assert.equal(owner.heldSlots,2);
  assert(surface.preparedResourceInventory().gpuGeometryBytes>inventoriedA.gpuGeometryBytes,'pending B carries a second GPU geometry owner');
  deck.suppressFieldDraw=true;deck.fireRender();assert.equal(surface.preparedScreenSnapshot.content,contentA);
  deck.suppressFieldDraw=false;deck.fireRender();assert.equal(surface.preparedScreenSnapshot.content,contentB);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],150);
  deck.pickResult={picked:true,index:0,layer:{id:surface.terrainSnapshot.field.layerId}};
  const pickedB=surface.pick(320,240);assert(pickedB);assert.equal(pickedB.point.heightM,150);
  const nextDraft=(job,drawHeight)=>{
    const values=new Float32Array(6*3);for(let i=0;i<3;i++)values[i*6]=drawHeight;
    const buffer=Math.max(...draft.buffers.keys())+1;draft.buffers.set(buffer,values.buffer);
    const expected={...draft.expected,job,requestContent:job},capture={...draft.capture,id:job,draftRevision:job};
    return{...draft,expected,capture,result:{...draft.result,...expected,captureId:job,draftRevision:job,draft:{buffer,kind:'f32',offset:0,length:values.length}}};
  };
  const updateDraft=nextDraft(4,175),update=surface.setPreparedTerrain(updateDraft);deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,update);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],175);
  assert(!surface.preparedResourceInventory().retainedBufferIds.includes(draft.result.draft.buffer),'retired B draft must not pin its old delivery-table entry');
  const candidateC=nextDraft(5,200),pendingC=surface.setPreparedTerrain(candidateC);
  assert.notEqual(pendingC,update);assert.equal(surface.preparedScreenSnapshot.content,update,'unconfirmed C cannot replace the last B Screen');
  const restored=surface.restorePreparedEscape(escape);assert.equal(surface.preparedScreenSnapshot.content,update);
  assert(!surface.preparedResourceInventory().retainedBufferIds.includes(candidateC.result.draft.buffer),'discarded C must release its wire buffer ID');
  deck.fireRender();assert.equal(surface.preparedScreenSnapshot.content,restored);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],100);
  assert.equal(owner.heldSlots,1,'B draft slot retires only after A restore draws');
  assert(!surface.preparedResourceInventory().retainedBufferIds.includes(updateDraft.result.draft.buffer),'restored A no longer retains any B draft buffer');
  surface.releasePreparedEscape(escape);surface.dispose();
});

test('prepared Escape restores the exact drawn intermediate A alpha after two B drafts and an unseen C',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial,draft}=preparedFixture({morph:true}),screens=[];surface.observePreparedScreens(screen=>screens.push(screen));
  surface.setPreparedTerrain(initial);deck.fireRender();
  surface.terrainMorphStart=performance.now()-90;surface.publish(false);deck.fireRender();
  const drawnA=surface.preparedScreenSnapshot;assert(drawnA.alpha>0&&drawnA.alpha<1);
  const heightA=surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2];
  assert(heightA>50&&heightA<100);
  surface.freezeTerrain();const escape=surface.capturePreparedEscape();
  const nextDraft=(job,height)=>{
    const values=new Float32Array(6*3);for(let i=0;i<3;i++)values[i*6]=height;
    const buffer=Math.max(...draft.buffers.keys())+1;draft.buffers.set(buffer,values.buffer);
    const expected={...draft.expected,job,requestContent:job},capture={...draft.capture,id:job,draftRevision:job};
    return{...draft,expected,capture,result:{...draft.result,...expected,captureId:job,draftRevision:job,draft:{buffer,kind:'f32',offset:0,length:values.length}}};
  };
  surface.setPreparedTerrain(draft);deck.fireRender();
  surface.setPreparedTerrain(nextDraft(4,175));deck.fireRender();
  surface.setPreparedTerrain(nextDraft(5,200));
  const restored=surface.restorePreparedEscape(escape);
  assert.equal(surface.preparedScreenSnapshot.alpha,drawnA.alpha,'B remains drawn until A restore succeeds');
  assert.equal(surface.terrainAlpha,drawnA.alpha,'the restore dispatch pins A, not B or the canonical alpha-zero start');
  deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,restored);
  assert.equal(surface.preparedScreenSnapshot.alpha,drawnA.alpha);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],heightA);
  assert.equal(screens.at(-1).alpha,drawnA.alpha);
  surface.releasePreparedEscape(escape);
  const aDraft=nextDraft(6,130);surface.setPreparedTerrain(aDraft);deck.fireRender();
  const drawnDraftA=surface.preparedScreenSnapshot,draftAHeight=surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2];
  surface.freezeTerrain();const draftEscape=surface.capturePreparedEscape();
  surface.setPreparedTerrain(nextDraft(7,160));deck.fireRender();
  surface.setPreparedTerrain(nextDraft(8,180));deck.fireRender();
  surface.setPreparedTerrain(nextDraft(9,190));
  const restoredDraft=surface.restorePreparedEscape(draftEscape);deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,restoredDraft);
  assert.equal(surface.preparedScreenSnapshot.alpha,drawnDraftA.alpha);
  assert.equal(surface.preparedScreenSnapshot.draftRevision,drawnDraftA.draftRevision);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],draftAHeight);
  surface.releasePreparedEscape(draftEscape);surface.dispose();
});

test('prepared alpha-one screen keeps old material until a second oldSlot-free endframe draws',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial}=preparedFixture({morph:true}),seen=[];surface.observePreparedScreens(screen=>seen.push(screen));
  surface.setPreparedTerrain(initial);deck.fireRender();
  const owner=surface.terrainFieldOwner,alphaZero=surface.preparedScreenSnapshot;
  assert.equal(alphaZero.endFrame,false);
  assert.equal(owner.heldSlots,2);
  surface.terrainMorphStart=performance.now()-200;surface.publish(false);
  assert.equal(deck.props.layers.find(layer=>layer.props.visible!==false&&layer.id.startsWith('atlas-terrain-field:')).props.geometry.draws[0].oldSlot>=0,true);
  deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot,alphaZero,'first alpha-one draw does not acknowledge the unretired old-material Screen');
  assert.equal(owner.heldSlots,2,'old material remains live before its last possible FS lookup');
  const endLayer=deck.props.layers.find(layer=>layer.props.visible!==false&&layer.id.startsWith('atlas-terrain-field:'));
  assert.equal(endLayer.props.geometry.draws[0].oldSlot,0,'the original packed geometry remains immutable');
  assert.equal(endLayer.props.endFrameDraws[0].oldSlot,-1,'the next real draw receives no old material slot');
  surface.freezeTerrain();
  assert.equal(surface.terrainField.geometry.draws[0].oldSlot,0,'an unseen endframe restores the previous confirmed draw descriptors');
  assert.equal(surface.terrainField.endFrameDraws,undefined);
  assert.equal(owner.heldSlots,2);assert.equal(surface.terrainField.tables.slotMetadata.destroyed,false);
  surface.terrainFrozen=false;surface.publish(false);deck.fireRender();
  assert.equal(owner.heldSlots,2);
  assert.equal(deck.props.layers.find(layer=>layer.props.visible!==false&&layer.id.startsWith('atlas-terrain-field:')).props.endFrameDraws[0].oldSlot,-1);
  deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.alpha,1);
  assert.equal(surface.preparedScreenSnapshot.endFrame,true,'C may rebase only from the confirmed material endframe');
  assert.equal(seen.at(-1),surface.preparedScreenSnapshot);
  assert.equal(owner.heldSlots,1,'the old bank retires only after the oldSlot-free screen');
  surface.dispose();
});

test('mixed old-only and transitioning partitions retire only at the confirmed endframe',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial}=preparedFixture({morph:true,oldOnly:true});surface.setPreparedTerrain(initial);deck.fireRender();
  const oldScreen=surface.preparedScreenSnapshot,owner=surface.terrainFieldOwner,oldField=surface.terrainField;
  const beforeEnd=surface.preparedResourceInventory();
  assert.equal(oldField.geometry.draws[1].oldSlot,oldField.oldBase);
  assert(surface.terrainRay([[2.25,.25,200],[2.25,.25,0]]),'old-only triangle is part of the intermediate confirmed screen');
  surface.terrainMorphStart=performance.now()-200;surface.publish(false);deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot,oldScreen);assert.equal(owner.heldSlots,2);
  const endField=surface.terrainField;
  assert.notEqual(endField,oldField);assert.equal(endField.geometry,oldField.geometry,'the GPU mesh is reused');
  const duringEnd=surface.preparedResourceInventory();
  assert.equal(duringEnd.gpuGeometryBytes,beforeEnd.gpuGeometryBytes,'the endframe creates no third GPU geometry');
  assert.equal(duringEnd.drawMetadataBytes,beforeEnd.drawMetadataBytes+2*128,'both new CPU Draw descriptors are counted');
  assert(duringEnd.cpuPeakBytes>=duringEnd.rendererBackingBytes);
  assert.deepEqual(endField.endFrameDraws.map(draw=>[draw.oldSlot,draw.newSlot]),[[-1,endField.newBase],[-1,-1]]);
  assert.equal(oldField.endFrameDraws,undefined,'the previous Screen and geometry remain immutable');
  surface.freezeTerrain();assert.equal(surface.terrainField,oldField);assert.equal(owner.heldSlots,2);
  surface.terrainFrozen=false;surface.publish(false);deck.fireRender();deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.endFrame,true);
  assert.equal(owner.heldSlots,1);
  assert.equal(surface.terrainRay([[2.25,.25,200],[2.25,.25,0]]),null,'the retired old-only triangle cannot be picked');
  assert(surface.terrainRay([[.25,.25,200],[.25,.25,0]]));
  surface.dispose();
});

test('a nested terrain observer draw cannot report the newer prepared Screen twice',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial}=preparedFixture(),screens=[];let nested=false;
  surface.observePreparedScreens(screen=>screens.push(screen));
  surface.observeTerrainFrames(frame=>{if(frame.field?.prepared&&!nested){nested=true;deck.fireRender();}});
  const content=surface.setPreparedTerrain(initial);deck.fireRender();
  assert.equal(nested,true);assert.equal(screens.length,1);
  assert.equal(screens[0].content,content);assert.equal(screens[0],surface.preparedScreenSnapshot);
  surface.dispose();
});

test('the first prepared picker reservation uses the conditional P budget',async t=>{
  const {surface}=await readySurface(t),{device}=fieldDevice();
  device.statsManager.getStats=()=>({get:()=>({count:480_000_000})});surface.gpuDevice=device;
  assert.throws(()=>surface.reservePickerAllocation([640,480]),/Gesamtbudget/);
  assert.doesNotThrow(()=>surface.reservePickerAllocation([640,480],true));
  surface.dispose();
});

test('prepared reply binding and a partial draft upload fail closed while explicit recovery restores only A',async t=>{
  const {surface,deck,decks}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  const {initial,draft}=preparedFixture();surface.setPreparedTerrain(initial);deck.fireRender();
  const owner=surface.terrainFieldOwner,confirmed=surface.terrainSnapshot.field,screen=surface.preparedScreenSnapshot;
  const bad={...draft,expected:{...draft.expected,job:99}};
  assert.throws(()=>surface.setPreparedTerrain(bad),/Resultatbindung/);
  assert.equal(owner.heldSlots,1);assert.equal(surface.terrainSnapshot.field,confirmed);
  assert.equal(surface.preparedScreenSnapshot,null);assert.equal(surface.contextAvailable,false);
  const restart=surface.recover();surface.gpuDevice=fieldDevice().device;decks[1].fireLoad();decks[1].fireRender();await restart;
  assert.equal(surface.preparedScreenSnapshot?.fieldState,screen.fieldState);
  const restoredOwner=surface.terrainFieldOwner;
  restoredOwner.arrays.cover.handle.failCount=1;
  assert.throws(()=>surface.setPreparedTerrain(draft),/injected partial upload/);
  assert.equal(restoredOwner.heldSlots,1);assert.equal(surface.preparedScreenSnapshot,null);
  surface.dispose();
});

test('prepared Screen stays a rollback owner but pointer use waits for a camera redraw',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial}=preparedFixture();surface.setPreparedTerrain(initial);deck.fireRender();
  const first=surface.preparedScreenSnapshot;assert(first);
  surface.setCamera({...surface.camera,focus:{x:10,y:0}});
  assert.equal(surface.preparedScreenSnapshot,first);assert.equal(surface.preparedInputUsable,false);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]),null);
  deck.fireRender();assert(surface.preparedScreenSnapshot);assert(surface.preparedScreenSnapshot.frameRevision>first.frameRevision);
  const otherTarget={token:'other-source',fence:'other-fence',revision:2},expected={...initial.expected,target:otherTarget,job:4,requestContent:4};
  const switched={...initial,expected,capture:{...initial.capture,id:4,draftRevision:4},result:{...initial.result,...expected,captureId:4,draftRevision:4,geometry:{...initial.result.geometry,newSources:[{...initial.result.geometry.newSources[0],source:otherTarget}]}}};
  surface.setPreparedTerrain(switched);assert.equal(surface.preparedInputUsable,false,'a different source blocks pointer use until its draw');
  surface.freezeTerrain();assert.equal(surface.preparedInputUsable,true,'rolling back the source switch restores the old confirmed input');
  surface.dispose();
});

test('a retained prepared basis keeps its original source across own receipt revisions and Escape',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial,draft}=preparedFixture({initialRevision:0});
  const target1={token:'source',fence:'own-receipt-1',revision:1},target2={token:'source',fence:'own-receipt-2',revision:2},target3={token:'source',fence:'own-receipt-3',revision:3};
  const origin={basis:initial.result.basis,target:initial.expected.target,epoch:initial.expected.epoch,editSeries:initial.capture.editSeries};
  surface.setPreparedTerrain(initial);deck.fireRender();surface.freezeTerrain();
  const first=surface.setPreparedTerrain(rebindPrepared(draft,3,target1,{expected:{operation:2}}));deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,first);
  assert.deepEqual(surface.terrainField.prepared.origin,origin,'the writer receipt changes the draft target, not the basis source');
  surface.freezeTerrain();const escape=surface.capturePreparedEscape();
  const second=surface.setPreparedTerrain(rebindPrepared(draft,4,target2,{expected:{operation:3}}));deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,second);
  assert.deepEqual(surface.terrainField.prepared.origin,origin,'another own receipt does not move the basis origin');
  const restored=surface.restorePreparedEscape(escape);deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,restored);
  assert.deepEqual(surface.terrainField.prepared.origin,origin,'Escape restores the same F0 basis origin');
  surface.releasePreparedEscape(escape);
  const third=surface.setPreparedTerrain(rebindPrepared(draft,5,target3,{expected:{operation:4}}));deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot.content,third);
  assert.deepEqual(surface.terrainField.prepared.origin,origin);
  surface.dispose();
});

test('prepared source binding rejects foreign and stale drafts while full geometry remains current-source bound',async t=>{
  const target1={token:'source',fence:'own-receipt-1',revision:1};
  const cases=[
    ['same revision with foreign fence',0,({draft})=>rebindPrepared(draft,4,{token:'source',fence:'foreign',revision:0}),/Draftquelle/],
    ['cross token',0,({draft})=>rebindPrepared(draft,4,{token:'foreign',fence:'foreign',revision:1}),/Draftquelle/],
    ['revision rollback',1,({draft})=>rebindPrepared(draft,4,{token:'source',fence:'old',revision:0}),/Draftquelle/],
    ['foreign epoch',0,({draft})=>rebindPrepared(draft,4,target1,{expected:{epoch:2}}),/Basisursprung/],
    ['foreign edit series',0,({draft})=>rebindPrepared(draft,4,target1,{capture:{editSeries:2}}),/Basisursprung/],
    ['stale result binding',0,({draft})=>rebindPrepared(draft,4,target1,{result:{job:3}}),/Resultatbindung/],
    ['wrong retained basis',0,({draft})=>rebindPrepared(draft,4,target1,{result:{basis:{generation:9,topology:9,manifest:9}}}),/Draftbasis/],
    ['full geometry from old source',0,({initial})=>rebindPrepared(initial,4,target1),/Displayquelle/],
    ['wrong full basis',0,({initial})=>rebindPrepared(initial,4,initial.expected.target,{result:{basis:{generation:9,topology:9,manifest:9}}}),/Basisbindung/]
  ];
  for(const [name,initialRevision,packet,error] of cases){
    const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
    const fixture=preparedFixture({initialRevision});surface.setPreparedTerrain(fixture.initial);deck.fireRender();
    assert.throws(()=>surface.setPreparedTerrain(packet(fixture)),error,name);
    assert.equal(surface.contextAvailable,false,`${name}: invalid delivery closes input`);
    surface.dispose();
  }
});

test('prepared resume continues the drawn intermediate alpha and needs the real material endframe',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial}=preparedFixture({morph:true}),screens=[];surface.observePreparedScreens(screen=>screens.push(screen));
  surface.setPreparedTerrain(initial);deck.fireRender();
  surface.terrainMorphStart=performance.now()-90;surface.publish(false);deck.fireRender();
  const beforeFreeze=surface.preparedScreenSnapshot;assert(beforeFreeze.alpha>.4&&beforeFreeze.alpha<.6);
  surface.freezeTerrain();
  deck.fireRender();
  const frozenScreen=surface.preparedScreenSnapshot;
  assert.equal(frozenScreen.alpha,beforeFreeze.alpha,'first frozen redraw keeps the confirmed F32 alpha');
  assert.throws(()=>surface.resumePreparedTerrain(beforeFreeze),/Frozen-Screen/,'the older receipt cannot resume a newer frozen redraw');
  const drawnAlpha=frozenScreen.alpha;
  frozenScreen.alpha=Math.fround(drawnAlpha+.1);
  assert.throws(()=>surface.resumePreparedTerrain(frozenScreen),/Frozen-Screen/,'a mutated receipt cannot change drawn alpha');
  frozenScreen.alpha=drawnAlpha;
  const queued=surface.terrainMorphStart;
  surface.resumePreparedTerrain(frozenScreen);
  assert.equal(surface.terrainFrozen,false);
  assert(Math.abs((performance.now()-surface.terrainMorphStart)-frozenScreen.alpha*180)<10,'resume keeps only the undrawn part of the 180 ms morph');
  assert.notEqual(surface.terrainMorphStart,queued);
  const resumedLayer=deck.props.layers.find(layer=>layer.props.visible!==false&&layer.id.startsWith('atlas-terrain-field:'));
  assert(Math.abs(resumedLayer.props.alpha-frozenScreen.alpha)<.06,'first resumed layer starts at the confirmed F32 alpha');
  let completed=false;const complete=surface.waitForTerrainContent(frozenScreen.content).then(()=>{completed=true;});
  surface.terrainMorphStart=performance.now()-181;surface.publish(false);deck.fireRender();
  assert.equal(surface.preparedScreenSnapshot,frozenScreen,'first alpha-one draw still reads the old material');
  assert.equal(surface.terrainFieldOwner.heldSlots,2);
  await Promise.resolve();assert.equal(completed,false,'the first alpha-one draw is not completion');
  deck.fireRender();
  await complete;
  assert.equal(completed,true);
  assert.equal(surface.preparedScreenSnapshot.alpha,1);
  assert.equal(surface.preparedScreenSnapshot.endFrame,true);
  assert.equal(surface.terrainFieldOwner.heldSlots,1);
  assert.equal(screens.at(-1),surface.preparedScreenSnapshot);
  surface.dispose();
});

test('prepared resume rejects stale, pending, camera-changed and lost screens; freeze fences a late unpainted draw',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const {initial,draft}=preparedFixture({morph:true}),screens=[];surface.observePreparedScreens(screen=>screens.push(screen));
  surface.setPreparedTerrain(initial);deck.fireRender();
  surface.terrainMorphStart=performance.now()-90;surface.publish(false);deck.fireRender();
  const a=surface.preparedScreenSnapshot;
  const pending=surface.setPreparedTerrain(draft),lateProps=deck.props;
  assert.throws(()=>surface.resumePreparedTerrain(a),/Frozen-Screen/);
  surface.freezeTerrain();
  assert.equal(surface.pendingField,null);
  assert.equal(surface.preparedScreenSnapshot,a);
  lateProps.onBeforeRender?.();
  for(const layer of lateProps.layers??[])if(layer.props.visible!==false)layer.props.onDrawSuccess?.(Math.fround(layer.props.alpha));
  lateProps.onAfterRender?.();
  assert.equal(surface.preparedScreenSnapshot,a,'late callback cannot confirm the canceled candidate');
  assert.equal(screens.some(screen=>screen.content===pending),false);
  const bContent=surface.setPreparedTerrain(draft);deck.fireRender();
  const b=surface.preparedScreenSnapshot;assert.equal(b.content,bContent);
  assert.throws(()=>surface.resumePreparedTerrain(a),/Frozen-Screen/);
  surface.freezeTerrain();
  const draftHeight=surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2];
  surface.resumePreparedTerrain(b);
  assert.equal(surface.terrainRay([[.25,.25,200],[.25,.25,0]]).point[2],draftHeight,'resuming a drawn draft keeps its exact pick height');
  surface.freezeTerrain();
  const otherTarget={token:'other-source',fence:'other-fence',revision:2},expected={...initial.expected,target:otherTarget,job:4,requestContent:4};
  const switched={...initial,expected,capture:{...initial.capture,id:4,draftRevision:4},result:{...initial.result,...expected,captureId:4,draftRevision:4,geometry:{...initial.result.geometry,newSources:[{...initial.result.geometry.newSources[0],source:otherTarget}]}}};
  surface.setPreparedTerrain(switched);
  assert.throws(()=>surface.resumePreparedTerrain(b),/Frozen-Screen/,'a pending different source cannot resume B');
  surface.freezeTerrain();
  surface.setCamera({...surface.camera,focus:{x:10,y:0}});
  assert.throws(()=>surface.resumePreparedTerrain(b),/Frozen-Screen/,'changed projection invalidates the screen');
  surface.handleContextLoss();
  assert.throws(()=>surface.resumePreparedTerrain(b),/Frozen-Screen/,'context loss invalidates even a frozen screen');
  surface.dispose();
});

test('confirmed field owner and tables survive a pending draw and release only after its success',async t=>{
  const {surface,deck}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  const a=fieldSource('a'),b=fieldSource('b',200);
  surface.setTerrain([a]);const owner=surface.terrainFieldOwner,first=surface.terrainField;
  assert.equal(owner.liveArrayBytes,136_380_928,'the owner inventories its five actual texture descriptors');
  assert.equal(owner.heldSlots,1);assert.equal(surface.terrainSnapshot?.field,null);
  deck.fireRender();assert.equal(surface.terrainSnapshot.field,first);
  surface.setTerrain([b]);const second=surface.terrainField;
  assert.equal(owner.heldSlots,2);assert.equal(owner.source(first.slots[0]),a);
  assert.equal(first.tables.slotMetadata.destroyed,false);
  const fieldLayers=deck.props.layers.filter(layer=>layer.id.startsWith('atlas-terrain-field:'));
  assert.equal(fieldLayers.length,2);assert.equal(fieldLayers[0].props.visible,false);
  deck.fireRender();assert.equal(surface.terrainSnapshot.field,second);
  assert.equal(owner.heldSlots,2,'the old morph side is still referenced by the new alpha-zero draw');
  assert.equal(first.tables.slotMetadata.destroyed,true,'old field tables are destroyed only after the candidate draw');
  assert.equal(surface.terrainResourceInventory().gpuGeometryBytes,first.geometry.gpuGeometryBytes+second.geometry.gpuGeometryBytes,'Deck still owns both mesh buffers before hidden-layer finalization');
  await Promise.resolve();assert.equal(surface.terrainResourceInventory().gpuGeometryBytes,second.geometry.gpuGeometryBytes);
  assert(textures.slice(0,5).every(texture=>!texture.destroyed));surface.dispose();
});

test('an unconfirmed first field releases its owner before a replacement allocates tables',async t=>{
  const {surface,deck}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('a')]);const firstOwner=surface.terrainFieldOwner,first=surface.terrainField;
  assert.equal(firstOwner.heldSlots,1);
  surface.setTerrain([fieldSource('b',200)]);const secondOwner=surface.terrainFieldOwner,second=surface.terrainField;
  assert.notEqual(secondOwner,firstOwner);assert(first.tables.slotMetadata.destroyed);
  assert(firstOwner.liveArrays.every(texture=>texture.destroyed));
  assert.equal(second.oldModels.length,0,'the unseen A source cannot become the drawn old side');
  assert.equal(secondOwner.heldSlots,1);assert.equal(second.tables.slotMetadata.destroyed,false);
  deck.fireRender();assert.equal(surface.terrainSnapshot.field,second);
  assert.equal(secondOwner.source(second.slots[0]).object.id,'b');
  assert(textures.slice(0,5).every(texture=>texture.destroyed));
  surface.dispose();assert(textures.every(texture=>texture.destroyed));
});

test('first field takeover retains the drawn legacy layer through the candidate Draw',async t=>{
  const {surface,deck}=await readySurface(t);
  const legacy=fieldSource('legacy'),mesh=object('legacy');legacy.mesh={attributes:{POSITION:{size:3,value:mesh.positions}},indices:{size:1,value:mesh.indices}};legacy.data=[legacy.object];
  surface.setTerrain([legacy]);deck.fireRender();assert.equal(surface.terrainSnapshot.field,null);
  const {device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('field',200)]);
  const layers=deck.props.layers;
  assert(layers.some(layer=>layer.id===`atlas-scene:${legacy.object.id}`&&layer.props.visible===false));
  assert(layers.some(layer=>layer.id.startsWith('atlas-terrain-field:')&&layer.props.visible!==false));
  deck.fireRender();assert(surface.terrainSnapshot.field);
  await Promise.resolve();assert(!deck.props.layers.some(layer=>layer.id===`atlas-scene:${legacy.object.id}`));
  surface.dispose();
});

test('a failed later draw discards only unconfirmed slots and stops new input',async t=>{
  const {surface,deck,decks}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const a=fieldSource('a'),b=fieldSource('b',200);
  surface.setTerrain([a]);deck.fireRender();const owner=surface.terrainFieldOwner,confirmed=surface.terrainField;
  const content=surface.setTerrain([b]),waiting=surface.waitForTerrainContent(content);
  assert.equal(owner.heldSlots,2);assert.equal(owner.source(confirmed.slots[0]),a);
  deck.fireError(Error('injected shader draw failure'));
  await assert.rejects(waiting,/injected shader draw failure/);
  assert.equal(surface.terrainField,confirmed);assert.equal(owner.heldSlots,1);
  assert.equal(surface.terrain[0],a,'failed candidate cannot become the recovery source');
  assert.equal(owner.source(confirmed.slots[0]),a);assert.equal(surface.frameUsable,false);
  assert.throws(()=>surface.setTerrain([b]),/injected shader draw failure/);
  const restart=surface.recover();surface.gpuDevice=fieldDevice().device;
  decks[1].fireLoad();assert.equal(surface.confirmedField,null);decks[1].fireRender();await restart;
  assert.equal(surface.terrainSnapshot.field.newModels[0],a);assert.equal(surface.terrain[0],a);
  surface.dispose();
});

test('partial first upload releases unconfirmed arrays and rejects input before any Draw',async t=>{
  const {surface,deck}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  const original=device.createTexture;let count=0;device.createTexture=props=>{const texture=original(props);if(++count===3)texture.handle.failCount=1;return texture;};
  assert.throws(()=>surface.setTerrain([fieldSource('partial')]),/injected partial upload/);
  assert.equal(surface.terrainFieldOwner,null);assert(textures.every(texture=>texture.destroyed));
  assert.equal(surface.frameUsable,false);assert.equal(surface.terrainRay([[0,0,10],[0,0,-10]]),null);
  assert.throws(()=>surface.setTerrain([fieldSource('retry-without-recovery')]),/injected partial upload/);
  assert.equal(deck.setPropsCalls.length,1);surface.dispose();
});

test('partial later upload leaves the previously drawn slot and table intact',async t=>{
  const {surface,deck}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('old')]);deck.fireRender();
  const owner=surface.terrainFieldOwner,field=surface.terrainField;
  textures[2].handle.failCount=1;
  assert.throws(()=>surface.setTerrain([fieldSource('partial-next')]),/injected partial upload/);
  assert.equal(surface.terrainField,field);assert.equal(owner.heldSlots,1);
  assert.equal(surface.terrain[0].object.id,'old');
  assert.equal(owner.source(field.slots[0]).object.id,'old');assert.equal(field.tables.slotMetadata.destroyed,false);
  assert.equal(surface.contextAvailable,false);surface.dispose();
});

test('setProps failure preserves the drawn owner and discards the unconfirmed table and slot',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('old')]);deck.fireRender();
  const owner=surface.terrainFieldOwner,field=surface.terrainField,oldTable=field.tables;
  deck.setPropsError=Error('injected setProps failure');
  assert.throws(()=>surface.setTerrain([fieldSource('next')]),/injected setProps failure/);
  assert.equal(surface.terrainField,field);assert.equal(owner.heldSlots,1);
  assert.equal(owner.source(field.slots[0]).object.id,'old');assert.equal(oldTable.slotMetadata.destroyed,false);
  assert.equal(surface.contextAvailable,false);surface.dispose();
});

test('an omitted first field Draw stays pending until its fixed content deadline',async t=>{
  const {surface,deck}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;surface.options.timeoutMs=30;
  const content=surface.setTerrain([fieldSource('missing')]),waiting=surface.waitForTerrainContent(content);
  deck.suppressFieldDraw=true;deck.fireRender();
  assert.equal(surface.confirmedField,null);assert.equal(surface.terrainSnapshot?.field,null);
  assert.equal(surface.terrainFieldOwner?.heldSlots,1);assert.equal(surface.contextAvailable,true);
  await assert.rejects(waiting,/Screenframe.*nicht binnen 30 ms bestätigt/);
  assert(textures.every(texture=>texture.destroyed));assert.equal(surface.contextAvailable,false);surface.dispose();
});

test('repeated unconfirmed frames cannot extend the fixed field content deadline',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;surface.options.timeoutMs=40;
  const content=surface.setTerrain([fieldSource('still-pending')]),waiting=surface.waitForTerrainContent(content);
  deck.suppressFieldDraw=true;const repeat=setInterval(()=>deck.fireRender(),5);
  try{await assert.rejects(waiting,/Screenframe.*nicht binnen 40 ms bestätigt/);}finally{clearInterval(repeat);surface.dispose();}
});

test('a frozen intermediate draft needs its pinned screen, not canonical alpha one',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('base')]);deck.fireRender();
  surface.setTerrain([fieldSource('morph',200)]);deck.fireRender();
  surface.terrainMorphStart=performance.now()-90;surface.publish(false);deck.fireRender();
  const frozen=surface.freezeTerrain();assert(frozen.alpha>0&&frozen.alpha<1);
  surface.options.timeoutMs=30;
  const content=surface.setTerrain([fieldSource('draft',300)],undefined,undefined,true);
  let canonicalWaiterResolved=false;
  const canonicalWaiter=surface.waitForTerrainContent(content).then(()=>{canonicalWaiterResolved=true;},()=>{});
  deck.fireRender();assert.equal(surface.terrainSnapshot.content,content);
  assert.equal(surface.terrainSnapshot.alpha,Math.fround(frozen.alpha));
  assert.equal(surface.terrainSnapshot.complete,false);
  await new Promise(resolve=>setTimeout(resolve,45));
  assert.equal(surface.contextAvailable,true,'a correctly drawn frozen draft must not time out');
  assert.equal(canonicalWaiterResolved,false,'a pinned draft screen does not grant canonical alpha-one completion');
  deck.fireRender();assert.equal(surface.frameUsable,true);surface.dispose();await canonicalWaiter;
});

test('a frozen intermediate draft without its own screen still reaches the fixed deadline',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('base')]);deck.fireRender();
  surface.setTerrain([fieldSource('morph',200)]);deck.fireRender();
  surface.terrainMorphStart=performance.now()-90;surface.publish(false);deck.fireRender();surface.freezeTerrain();
  surface.options.timeoutMs=30;
  const content=surface.setTerrain([fieldSource('draft',300)],undefined,undefined,true),waiting=surface.waitForTerrainContent(content);
  deck.suppressFieldDraw=true;deck.fireRender();
  await assert.rejects(waiting,/Screenframe.*nicht binnen 30 ms bestätigt/);
  assert.equal(surface.contextAvailable,false);surface.dispose();
});

test('a missing alpha-one screen keeps the drawn alpha-zero owner until the same content draws',async t=>{
  const {surface,deck}=await readySurface(t,{timeoutMs:1000}),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('old')]);deck.fireRender();
  const content=surface.setTerrain([fieldSource('new',200)]),waiting=surface.waitForTerrainContent(content);
  deck.fireRender();const alphaZero=surface.terrainSnapshot,owner=surface.terrainFieldOwner;
  assert.equal(alphaZero.alpha,0);assert.equal(alphaZero.complete,false);
  surface.terrainMorphStart=performance.now()-1000;surface.publish(false);
  deck.suppressFieldDraw=true;deck.fireRender();
  assert.equal(surface.terrainSnapshot,alphaZero);assert.equal(owner.heldSlots,2);
  assert.equal(surface.frameUsable,false);
  deck.suppressFieldDraw=false;deck.fireRender();await waiting;
  assert.equal(surface.terrainSnapshot.content,content);assert.equal(surface.terrainSnapshot.complete,true);
  assert.equal(owner.heldSlots,1);surface.dispose();
});

test('a canonical field still times out when alpha one never draws',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('old')]);deck.fireRender();surface.options.timeoutMs=60;
  const content=surface.setTerrain([fieldSource('new',200)]),waiting=surface.waitForTerrainContent(content);
  deck.fireRender();assert.equal(surface.terrainSnapshot.complete,false);
  surface.terrainMorphStart=performance.now()-1000;surface.publish(false);
  deck.suppressFieldDraw=true;deck.fireRender();
  await assert.rejects(waiting,/Screenframe.*nicht binnen 60 ms bestätigt/);
  assert.equal(surface.contextAvailable,false);surface.dispose();
});

test('field completion uses the Float32 alpha actually uploaded to the screen shader',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('old')]);deck.fireRender();
  const content=surface.setTerrain([fieldSource('new',200)]),waiting=surface.waitForTerrainContent(content);
  deck.fireRender();surface.terrainFrozen=true;surface.terrainAlpha=1-1e-8;surface.publish(false);
  deck.fireRender();await waiting;
  assert.equal(surface.terrainSnapshot.alpha,1);assert.equal(surface.terrainSnapshot.complete,true);
  assert.equal(surface.terrainFieldOwner.heldSlots,1);surface.dispose();
});

test('same-source acknowledgement and a reused draft layer ID need their own current screen draw',async t=>{
  const {surface,deck}=await readySurface(t,{timeoutMs:1000}),{device}=fieldDevice();surface.gpuDevice=device;
  const source=fieldSource('same');surface.setTerrain([source]);deck.fireRender();
  const first=surface.terrainSnapshot,wrapper={...source,grid:{...source.grid}};
  const content=surface.setTerrain([wrapper]),waiting=surface.waitForTerrainContent(content);
  deck.suppressFieldDraw=true;deck.fireRender();assert.equal(surface.terrainSnapshot,first);
  deck.suppressFieldDraw=false;deck.fireRender();await waiting;assert.equal(surface.terrainSnapshot.content,content);
  surface.freezeTerrain();surface.setTerrain([fieldSource('draft-a',300)],undefined,undefined,true);deck.fireRender();
  const drawn=surface.terrainSnapshot,oldLayer=deck.props.layers.find(layer=>layer.id===drawn.field.layerId);
  surface.setTerrain([fieldSource('draft-b',400)],undefined,undefined,true);
  assert.equal(deck.props.layers.find(layer=>layer.id===drawn.field.layerId)?.id,oldLayer.id,'drafts reuse the field layer ID');
  deck.props.onBeforeRender?.();oldLayer.props.onDrawSuccess?.(Math.fround(oldLayer.props.alpha));deck.props.onAfterRender?.();
  assert.equal(surface.terrainSnapshot,drawn);assert.equal(surface.confirmedField,drawn.field);
  deck.fireRender();assert.notEqual(surface.terrainSnapshot,drawn);surface.dispose();
});

test('picker replacement reserves the real old and new attachments before creating either FBO',async t=>{
  const {surface,deck}=await readySurface(t),picker=deck.deckPicker;
  const oldColor=fmt('rgba8unorm','depth16unorm',640,480),oldDepth=fmt('rgba32float','depth16unorm',640,480);
  for(const frame of [oldColor,oldDepth])frame.colorAttachments[0].texture.destroy=function(){this.destroyed=true;};
  picker.pickingFBO=oldColor;picker.depthFBO=oldDepth;let creates=0,reported=600_000_000;
  surface.gpuDevice={statsManager:{getStats:()=>({get:()=>({count:reported})})}};
  picker.device.getDefaultCanvasContext=()=>({getDrawingBufferSize:()=>[640,480]});
  picker.device.createFramebuffer=props=>{creates++;return fmt(props.colorAttachments[0],props.depthStencilAttachment,props.width,props.height);};
  assert.throws(()=>surface.drawPicker(),/Gesamtbudget/);assert.equal(creates,0);
  assert.equal(picker.pickingFBO,oldColor);assert.equal(picker.depthFBO,oldDepth);
  reported=0;surface.drawPicker();assert.equal(creates,2);
  assert.equal(oldColor.destroyed,true);assert.equal(oldDepth.destroyed,true);
  assert.equal(surface.pickerDrawn.color,picker.pickingFBO);surface.dispose();
});

test('same-source acknowledgement reports the older drawn mesh to the next worker job',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  const source=fieldSource('stable');surface.setTerrain([source]);deck.fireRender();
  const drawn=surface.terrainField,geometry=drawn.geometry;
  const wrapper={...source,grid:{...source.grid},texture:{...source.texture},masks:{...source.masks},cover:{...source.cover},relief:{...source.relief}};
  surface.setTerrain([wrapper]);deck.fireRender();
  const inventory=surface.terrainResourceInventory();
  assert.equal(surface.terrainField.geometry,geometry);
  assert.equal(inventory.gpuGeometryBytes,geometry.gpuGeometryBytes);
  assert.equal(inventory.drawMetadataBytes,drawn.sourceGeometry.gpuDrawMetadataBytes+drawn.geometry.gpuDrawMetadataBytes);
  surface.dispose();
});

test('disjoint frozen morph banks retain both drawn drafts while the next draft uploads',async t=>{
  const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('a')]);deck.fireRender();
  surface.setTerrain([fieldSource('b',200)]);deck.fireRender();surface.freezeTerrain();
  surface.setTerrain([fieldSource('draft-one',300)],undefined,undefined,true);deck.fireRender();
  const owner=surface.terrainFieldOwner,firstDraft=surface.terrainField,oldDraft=firstDraft.draftBase;
  assert.equal(owner.heldSlots,3);
  surface.setTerrain([fieldSource('draft-two',400)],undefined,undefined,true);
  assert.equal(owner.heldSlots,4);assert.equal(owner.source(oldDraft).object.id,'draft-one');
  assert.equal(surface.terrainField.draftBase,96);
  deck.fireRender();assert.equal(owner.heldSlots,3);assert.equal(owner.holds(oldDraft),false);
  surface.dispose();
});

test('explicit recovery restores the last drawn draft after its shared height and material arrays mutate',async t=>{
  const {surface,deck,decks}=await readySurface(t),first=fieldDevice();surface.gpuDevice=first.device;
  surface.setTerrain([fieldSource('a')]);deck.fireRender();
  surface.setTerrain([fieldSource('b',200)]);deck.fireRender();surface.freezeTerrain();
  const draft=fieldSource('mutable-draft',300);
  for(const [index,key] of ['texture','masks','cover','relief'].entries()){
    draft[key]={...draft[key],data:new Uint8Array(256*256*4).fill(31+index)};
  }
  surface.setTerrain([draft],undefined,undefined,true);deck.fireRender();
  const drawn=surface.terrainSnapshot.field,drawnSlot=drawn.draftBase;
  assert.equal(surface.preflightTerrainCpu(drawn.sourceGeometry,drawn.oldModels,drawn.newModels,[draft],true).draftSourceCopies,1_065_476);
  assert.notEqual(drawn.draftModels[0].grid.heights,draft.grid.heights);
  assert.notEqual(drawn.draftModels[0].texture.data,draft.texture.data);
  draft.grid.heights[0]=901;
  for(const [index,key] of ['texture','masks','cover','relief'].entries())draft[key].data[0]=71+index;
  first.textures[2].handle.failCount=1;
  assert.throws(()=>surface.setTerrain([draft],undefined,undefined,true),/injected partial upload/);
  assert.equal(surface.terrainField,drawn);
  assert.equal(surface.terrainSnapshot.renderModels[0].grid.heights[0],300);
  assert.equal(surface.terrainSnapshot.renderModels[0].texture.data[0],31);
  const restart=surface.recover(),second=fieldDevice();surface.gpuDevice=second.device;
  decks[1].fireLoad();decks[1].fireRender();await restart;
  assert.equal(surface.terrainSnapshot.field,drawn);
  assert.equal(surface.terrainSnapshot.field.draftModels[0].grid.heights[0],300);
  for(const [index,key] of ['base','masks','cover','relief'].entries()){
    assert.equal(second.uploads.find(item=>item.texture===`atlas-terrain-field-${key}`&&item.slot===drawnSlot)?.first,31+index,`${key} recovers its last drawn byte`);
  }
  assert.equal(second.uploads.find(item=>item.texture==='atlas-terrain-field-height'&&item.slot===drawnSlot)?.first,300);
  surface.dispose();
});

test('a failed second draft Draw recovers the previously drawn material and height',async t=>{
  const {surface,deck,decks}=await readySurface(t),first=fieldDevice();surface.gpuDevice=first.device;
  surface.setTerrain([fieldSource('a')]);deck.fireRender();
  surface.setTerrain([fieldSource('b',200)]);deck.fireRender();surface.freezeTerrain();
  const draft=fieldSource('shared',300);draft.texture={...draft.texture,data:new Uint8Array(256*256*4).fill(42)};
  surface.setTerrain([draft],undefined,undefined,true);deck.fireRender();
  const drawn=surface.terrainSnapshot.field,slot=drawn.draftBase;
  draft.grid.heights[0]=902;draft.texture.data[0]=99;
  surface.setTerrain([draft],undefined,undefined,true);
  deck.fireError(Error('injected second draft Draw failure'));
  assert.equal(surface.terrainField,drawn);
  const restart=surface.recover(),second=fieldDevice();surface.gpuDevice=second.device;
  decks[1].fireLoad();decks[1].fireRender();await restart;
  assert.equal(second.uploads.find(item=>item.texture==='atlas-terrain-field-height'&&item.slot===slot)?.first,300);
  assert.equal(second.uploads.find(item=>item.texture==='atlas-terrain-field-base'&&item.slot===slot)?.first,42);
  surface.dispose();
});

test('the first local field keeps its shared new and draft sources stable for recovery',async t=>{
  const {surface,deck,decks}=await readySurface(t),first=fieldDevice();surface.gpuDevice=first.device;
  const draft=fieldSource('first-local',300);draft.texture={...draft.texture,data:new Uint8Array(256*256*4).fill(42)};
  surface.setTerrain([draft],undefined,undefined,true);deck.fireRender();
  const drawn=surface.terrainSnapshot.field;
  draft.grid.heights[0]=903;draft.texture.data[0]=99;
  first.textures[2].handle.failCount=1;
  assert.throws(()=>surface.setTerrain([draft],undefined,undefined,true),/injected partial upload/);
  const restart=surface.recover(),second=fieldDevice();surface.gpuDevice=second.device;
  decks[1].fireLoad();decks[1].fireRender();await restart;
  for(const slot of [drawn.newBase,drawn.draftBase]){
    assert.equal(second.uploads.find(item=>item.texture==='atlas-terrain-field-height'&&item.slot===slot)?.first,300);
    assert.equal(second.uploads.find(item=>item.texture==='atlas-terrain-field-base'&&item.slot===slot)?.first,42);
  }
  surface.dispose();
});

test('one renderer alpha binds every terrain layer, displayed ray grids and immediate gesture freeze',async t=>{
 const prior={requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,performance:globalThis.performance};let clock=1000,serial=0;const raf=new Map();
 globalThis.requestAnimationFrame=fn=>{raf.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>raf.delete(id);globalThis.performance={now:()=>clock};t.after(()=>Object.assign(globalThis,prior));
 const {surface,deck}=await readySurface(t),box={x:-256,y:-256,width:256,height:256},view={box,frame:box,columns:2,rows:2},grid={view,heights:new Float32Array(4).fill(350)},from={view,heights:new Float32Array(4).fill(300)},mesh=object('terrain'),texture={width:1,height:1,data:new Uint8Array(4)},normals=new Float32Array(12);
 const terrain={grid,gridNormals:normals,object:mesh,data:[mesh],mesh:{attributes:{POSITION:{size:3,value:mesh.positions},NORMAL:{size:3,value:new Float32Array(9)},TEXCOORD_0:{size:2,value:new Float32Array(6)}},indices:{size:1,value:mesh.indices}},bounds:{min:[-256,-256,300],max:[0,0,350]},texture,masks:texture,cover:texture,relief:texture,transition:{start:0,duration:180,progress:0,presented:false,grid:from,normals,materialGrid:from,materialUv:[0,0,1,1],heights:new Float32Array(3).fill(300),vertexNormals:new Float32Array(9),texture,masks:texture,cover:texture,relief:texture}};
 const content=surface.setTerrain([terrain]),seen=[];surface.observeTerrainFrames(s=>seen.push(s));let done=false;const waiting=surface.waitForTerrainContent(content).then(()=>{done=true;});
 deck.fireRender();assert.equal(seen.at(-1).models[0].grid.heights[0],300);assert.equal(done,false);assert.equal(deck.props.layers[0].props.transitionAlpha,0);
 const tick=()=>{const [id,fn]=raf.entries().next().value;raf.delete(id);fn(clock);};clock=1090;tick();deck.fireRender();assert.equal(deck.props.layers[0].props.transitionAlpha,.5,'the drawn alpha follows continuous renderer time');assert.equal(seen.at(-1).models[0].grid.heights[0],325);
 clock=1201;tick();deck.fireRender();await waiting;assert.equal(done,true);assert.equal(seen.at(-1).complete,true);assert.equal(seen.at(-1).models[0].grid.heights[0],350);
 clock=1500;const slow=surface.setTerrain([terrain]),slowDone=surface.waitForTerrainContent(slow);deck.fireRender();clock=1700;tick();deck.fireRender();assert.equal(deck.props.layers[0].props.transitionAlpha,1,'a missed interval completes at renderer time without a forced midpoint');await slowDone;
 clock=2000;const next=surface.setTerrain([terrain]),cancelled=assert.rejects(surface.waitForTerrainContent(next),/abgelöst/);deck.fireRender();clock=2090;tick();deck.fireRender();clock=2135;tick();assert.equal(deck.props.layers[0].props.transitionAlpha,.75,'A queued layer is not yet the drawn surface');const frozen=surface.freezeTerrain();await cancelled;assert.equal(frozen.models[0].grid.heights[0],325);assert.equal(raf.size,0);assert.equal(deck.props.layers[0].props.transitionAlpha,.5,'Freeze replaces queued alpha with the last GPU-confirmed alpha');
 clock=3000;surface.setCamera({...camera,tilt:45});deck.fireRender();assert.equal(deck.props.layers[0].props.transitionAlpha,.5);assert.equal(surface.terrainSnapshot.models[0].grid.heights[0],325,'Camera redraw cannot independently advance a frozen gesture surface');
 const replacement={...terrain,grid:{...grid,heights:new Float32Array(4).fill(500)},mesh:{...terrain.mesh},transition:{...terrain.transition,grid,progress:0,presented:false}},queued=surface.setTerrain([replacement]),aborted=assert.rejects(surface.waitForTerrainContent(queued),/abgelöst/);surface.freezeTerrain();await aborted;assert.equal(deck.props.layers[0].props.mesh,terrain.mesh,'An unrendered replacement cannot become the gesture geometry');deck.fireRender();assert.equal(surface.terrainSnapshot.models[0].grid.heights[0],325);assert.equal(surface.terrainSnapshot.content,next);surface.dispose();
});

test('terrain author rays use only the last drawn immutable field',async t=>{
 const {surface}=await readySurface(t),segment=[[0,0,10],[0,0,-10]],current={point:[1,1,1],segmentFraction:.1,model:{}},drawn={point:[2,2,2],segmentFraction:.2,model:{}};
 surface.terrainField={ray:{intersect:()=>current}};
 surface.terrainDrawn={at:1,frame:surface.frame,content:1,complete:false,alpha:.5,models:[],renderModels:[],field:{ray:{intersect:()=>drawn}}};
 assert.equal(surface.terrainRay(segment),drawn,'a queued field cannot move author input before it is drawn');
 surface.terrainDrawn.field=null;assert.equal(surface.terrainRay(segment),null,'a drawn legacy frame cannot expose a queued field');
 surface.dispose();
});

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
  assert.equal(decks.length,1,'context loss never starts another device without an explicit action');
  assert.equal(surface.frameUsable,false);assert.equal(surface.terrainSnapshot,null);
  const restart=surface.recover();
  assert.equal(decks.length,2);assert.equal(oldDeck.finalizeCalls,1);assert.notEqual(surface.canvas,oldCanvas);
  assert.equal(env.container.querySelectorAll('canvas').length,1);
  assert.deepEqual(surface.camera,initialCamera);assert.equal(surface.model,initialModel);
  decks[1].fireLoad();decks[1].fireRender();await restart;
  assert.equal(surface.frameUsable,true);
  surface.dispose();
});

test('explicit recovery reuploads the real field and confirms its new GPU owner only after Draw',async t=>{
  const active=await readySurface(t),{surface,decks,env}=active,first=fieldDevice();surface.gpuDevice=first.device;
  const source=fieldSource('recovery');surface.setTerrain([source]);decks[0].fireRender();
  const field=surface.terrainField,oldOwner=surface.terrainFieldOwner,oldTables=field.tables,
    oldLayer=decks[0].props.layers.find(layer=>layer.id===field.layerId);
  surface.canvas.dispatchEvent(new env.window.Event('webglcontextlost',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(decks.length,1);assert.equal(surface.terrainSnapshot,null);assert.equal(surface.terrainRay([[0,0,10],[0,0,-10]]),null);
  assert(first.textures.every(texture=>texture.destroyed));assert.deepEqual(field.slots,[]);
  const restart=surface.recover(),second=fieldDevice();surface.gpuDevice=second.device;
  decks[1].fireLoad();assert.notEqual(surface.terrainFieldOwner,oldOwner);
  assert.equal(surface.confirmedField,null,'a successful upload is not yet a drawn field');
  assert.equal(surface.pendingField.field,field);assert.notEqual(field.tables,oldTables);
  decks[1].props.onBeforeRender?.();oldLayer.props.onDrawSuccess?.(Math.fround(oldLayer.props.alpha));decks[1].props.onAfterRender?.();
  assert.equal(surface.terrainSnapshot,null);assert.equal(surface.confirmedField,null,'the old callback generation cannot confirm recovery');
  decks[1].fireRender();await restart;
  assert.equal(surface.confirmedField,field);assert.equal(surface.terrainSnapshot.field,field);
  assert.equal(surface.terrainFieldOwner.heldSlots,1);surface.dispose();
});

test('context loss discards a pending source, rejects its waiter and never retries automatically',async t=>{
  const {surface,deck,decks,env}=await readySurface(t),{device,textures}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('drawn')]);deck.fireRender();const confirmed=surface.terrainField;
  const content=surface.setTerrain([fieldSource('pending')]),waiting=surface.waitForTerrainContent(content);
  surface.canvas.dispatchEvent(new env.window.Event('webglcontextlost',{cancelable:true}));
  await assert.rejects(waiting,/Kontext verloren/);
  assert.equal(surface.terrainField,confirmed);assert.equal(surface.terrainSnapshot,null);
  assert.equal(surface.terrain[0].object.id,'drawn','context recovery retains the last drawn source');
  assert.equal(surface.terrainRay([[0,0,10],[0,0,-10]]),null);assert.equal(decks.length,1);
  assert(textures.every(texture=>texture.destroyed));assert.equal(surface.contextAvailable,false);
  assert.throws(()=>surface.setTerrain([fieldSource('blocked')]),/Kontext verloren/);surface.dispose();
});

test('context loss after field dispatch but before AfterRender confirms no screen or owner',async t=>{
  const {surface,deck,env}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('drawn')]);deck.fireRender();const confirmed=surface.confirmedField;
  const seen=[];surface.observeTerrainFrames(snapshot=>seen.push(snapshot));
  const content=surface.setTerrain([fieldSource('queued')]),waiting=surface.waitForTerrainContent(content);
  const layer=deck.props.layers.find(item=>item.props.visible!==false&&item.id.startsWith('atlas-terrain-field:'));
  deck.props.onBeforeRender?.();layer.props.onDrawSuccess?.(Math.fround(layer.props.alpha));
  surface.canvas.dispatchEvent(new env.window.Event('webglcontextlost',{cancelable:true}));
  deck.props.onAfterRender?.();await assert.rejects(waiting,/Kontext verloren/);
  assert.equal(surface.confirmedField,confirmed);assert.equal(surface.terrainSnapshot,null);
  assert.deepEqual(seen,[]);surface.dispose();
});

test('synchronous device loss after field dispatch blocks takeover before the DOM event',async t=>{
  const losses=[],errors=[],seen=[];
  const {surface,deck,env}=await readySurface(t,{onContextLost:()=>losses.push(1),onError:error=>errors.push(error)}),{device}=fieldDevice();surface.gpuDevice=device;
  surface.setTerrain([fieldSource('drawn')]);deck.fireRender();const confirmed=surface.confirmedField;
  surface.observeTerrainFrames(snapshot=>seen.push(snapshot));
  const content=surface.setTerrain([fieldSource('queued')]),waiting=surface.waitForTerrainContent(content);
  const layer=deck.props.layers.find(item=>item.props.visible!==false&&item.id.startsWith('atlas-terrain-field:'));
  deck.props.onBeforeRender?.();layer.props.onDrawSuccess?.(Math.fround(layer.props.alpha));
  device.gl.lost=true;deck.props.onAfterRender?.();
  await assert.rejects(waiting,/Kontext verloren/);
  assert.equal(surface.confirmedField,confirmed);assert.equal(surface.terrainSnapshot,null);
  assert.deepEqual(seen,[]);assert.equal(surface.frameUsable,false);assert.equal(surface.terrainFrameUsable,false);
  assert.equal(surface.terrainRay([[0,0,10],[0,0,-10]]),null);
  assert.throws(()=>surface.setTerrain([fieldSource('blocked')]),/Kontext verloren/);
  assert.equal(losses.length,1);assert.equal(errors.length,1);
  const event=new env.window.Event('webglcontextlost',{cancelable:true});surface.canvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(losses.length,1);assert.equal(errors.length,1);
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

test('a late Deck load cannot revive a replacement generation after its startup error',async t=>{
  const active=await readySurface(t),{surface,decks,env}=active;
  const oldCanvas=surface.canvas;
  oldCanvas.dispatchEvent(new env.window.Event('webglcontextlost',{cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  const restart=surface.recover();
  assert.equal(decks.length,2);
  const replacement=decks[1];
  replacement.fireError(new Error('replacement startup failed'));
  await assert.rejects(restart,/replacement startup failed/);
  assert.equal(surface.frameUsable,false);
  replacement.fireLoad();replacement.fireRender();
  assert.equal(surface.frameUsable,false,'callbacks from the failed replacement generation stay fenced');
  surface.dispose();
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


test('pending textures delay readiness and the original GPU failure rejects later waiters immediately',async t=>{
 const {surface,deck}=await readySurface(t);
 surface.setCamera({...camera,rotation:20});
 let done=false;const pending=surface.waitForFrame().then(()=>{done=true;});
 // Deck has not yet uploaded this layer's asynchronous texture.
 deck.props.onBeforeRender();deck.props.onAfterRender();await Promise.resolve();assert.equal(done,false);
 deck.fireRender();await pending;assert.equal(done,true);
 const error=new Error('texture allocation failed');deck.fireError(error);
 await assert.rejects(surface.waitForFrame(),e=>e===error);assert.equal(surface.frameUsable,false);surface.dispose();
});

test('a newer callback cannot finish a render that began with older props',async t=>{
 const {surface,deck}=await readySurface(t);
 deck.props.onBeforeRender();
 surface.setCamera({...camera,focus:{x:200,y:300}});
 deck.props.onAfterRender();
 assert.equal(surface.frameUsable,false,'Deck reads current props for afterRender, so a matching render start is required');
 deck.fireRender();assert.equal(surface.frameUsable,true);
 surface.dispose();
});

test('hover drawing preserves terrain input but never releases drawing picks or batch waiters',async t=>{
 const {surface,deck}=await readySurface(t);
 surface.setDrawing(()=>[]);
 assert.equal(surface.terrainFrameUsable,true);
 assert.equal(surface.frameUsable,false);
 assert.equal(surface.pick(320,240),null);
 let complete=false;const pending=surface.waitForFrame().then(()=>{complete=true;});
 surface.setCamera({...camera,focus:{...camera.focus}});
 assert.equal(surface.terrainFrameUsable,true,'an unchanged camera cannot invalidate hover input');
 await Promise.resolve();assert.equal(complete,false);
 deck.fireRender();await pending;
 surface.setTerrain([]);assert.equal(surface.terrainFrameUsable,false,'new terrain must be drawn');
 surface.setDrawing(()=>[]);assert.equal(surface.terrainFrameUsable,false,'drawing cannot release pending terrain');
 deck.fireRender();assert.equal(surface.terrainFrameUsable,true);
 surface.setCamera({...camera,rotation:12});assert.equal(surface.terrainFrameUsable,false);
 deck.fireError();assert.equal(surface.terrainFrameUsable,false);
 surface.dispose();
});

test('drawing before ResizeObserver cannot authorize the new viewport against old terrain',async t=>{
 const {surface,deck,env}=await readySurface(t);
 env.setSize(800,600);surface.setDrawing(()=>[]);
 assert.equal(surface.terrainFrameUsable,false);
 surface.resize();assert.equal(surface.terrainFrameUsable,false);
 deck.fireRender();assert.equal(surface.terrainFrameUsable,true);
 surface.dispose();
});

test('local terrain continuation cannot release a pending camera or source frame',async t=>{
 const {surface,deck}=await readySurface(t);
 surface.setTerrain([],undefined,undefined,true);
 assert.equal(surface.frameUsable,false);assert.equal(surface.terrainFrameUsable,true);
 surface.setCamera({...camera,rotation:25});
 surface.setTerrain([],undefined,undefined,true);assert.equal(surface.terrainFrameUsable,false);
 deck.fireRender();surface.setTerrain([]);
 surface.setTerrain([],undefined,undefined,true);assert.equal(surface.terrainFrameUsable,false);
 deck.fireRender();assert.equal(surface.terrainFrameUsable,true);
 surface.dispose();
});

test('safety camera publishes a free near volume and active input keeps the actual drawn pair through own receipts',async t=>{
 const {surface,deck}=await readySurface(t,{camera:{...camera,focus:{x:.25,y:.25},metersPerPixel:.0001}}),{device}=fieldDevice();surface.gpuDevice=device;
 for(const frame of [deck.deckPicker.pickingFBO,deck.deckPicker.depthFBO])for(const attachment of [...frame.colorAttachments,frame.depthStencilAttachment])Object.assign(attachment.texture,{width:frame.width,height:frame.height});
 const {initial,draft}=preparedFixture();surface.setPreparedTerrain(initial);
 assert(surface.camera.focusHeightM>99,'initial high geometry is cleared before its first draw');deck.fireRender();
 const binding=surface.capturePreparedInputBinding(),old=surface.samplePreparedInput(binding,{x:320,y:240});assert(old?.hit);assert.equal(old.hit.point[2],100);
 surface.freezeTerrain();const escape=surface.capturePreparedEscape();
 const ownLater={...draft.expected.target,revision:2,fence:'own-later-ack'};surface.setPreparedTerrain(rebindPrepared(draft,2,ownLater));
 assert(surface.camera.focusHeightM>149);assert.equal(surface.preparedInputUsable,false,'pending safety camera gates a new gesture');
 const retained=surface.samplePreparedInput(binding,{x:320,y:240});assert(retained);assert.equal(retained.frame,old.frame);assert.equal(retained.hit.point[2],100);
 deck.fireRender();const current=surface.samplePreparedInput(binding,{x:320,y:240});assert(current?.hit);assert.notEqual(current.frame,old.frame);assert.equal(current.hit.point[2],150);
 assert.equal(current.frame.camera.focus.x,.25);assert.equal(current.frame.camera.metersPerPixel,.0001);assert.equal(current.frame.camera.tilt,0);
 assert(surface.terrainClearance.lifts>=2);assert(surface.terrainClearance.visits>0);assert(surface.terrainClearance.triangles>0);
 surface.restorePreparedEscape(escape);deck.fireRender();assert.equal(surface.samplePreparedInput(binding,{x:320,y:240}),null,'Escape ends the old input authorization');assert(surface.camera.focusHeightM>149,'Escape does not move the camera downward');surface.releasePreparedEscape(escape);const afterEscape=surface.capturePreparedInputBinding();assert.equal(surface.samplePreparedInput(afterEscape,{x:320,y:240}).hit.point[2],100);
 const proof=surface.terrainClearance.proof;assert(proof.maximum+proof.margin<proof.minimumZ);assert(proof.iterations<=4);
 const foreign={...initial.expected.target,revision:3,fence:'external-owner'},foreignGeometry={...initial.result.geometry,newSources:initial.result.geometry.newSources.map(s=>({...s,source:foreign}))};
 surface.setPreparedTerrain(rebindPrepared(initial,3,foreign,{result:{geometry:foreignGeometry}}));deck.fireRender();assert.equal(surface.samplePreparedInput(afterEscape,{x:320,y:240}),null,'new origin owner revokes even reused numerical basis identifiers');
 const replacement=surface.capturePreparedInputBinding();assert(surface.samplePreparedInput(replacement,{x:320,y:240})?.hit);
 surface.setCamera({...surface.camera,focus:{x:.3,y:.25}});assert.equal(surface.samplePreparedInput(replacement,{x:320,y:240}),null,'ordinary navigation revokes the active exception');
 console.log('S8_CLEARANCE',JSON.stringify(surface.terrainClearance));surface.dispose();
});

test('four failed final-origin checks stop before publishing another terrain frame',async t=>{
 const {surface,deck}=await readySurface(t),{device}=fieldDevice();surface.gpuDevice=device;
 for(const frame of [deck.deckPicker.pickingFBO,deck.deckPicker.depthFBO])for(const attachment of [...frame.colorAttachments,frame.depthStencilAttachment])Object.assign(attachment.texture,{width:frame.width,height:frame.height});
 surface.setPreparedTerrain(preparedFixture().initial);deck.fireRender();const drawn=surface.terrainSnapshot,props=deck.setPropsCalls.length;
 let calls=0;surface.terrainField.prepared.ray.heightEnvelope=()=>{calls++;return{maximum:1e12,visits:1,triangles:1};};
 assert.throws(()=>surface.setCamera({...surface.camera,focusHeightM:1}),/vier Prüfungen/);assert.equal(calls,4);assert.equal(deck.setPropsCalls.length,props);assert.equal(surface.terrainSnapshot,drawn);assert.equal(surface.contextAvailable,false);surface.dispose();
});

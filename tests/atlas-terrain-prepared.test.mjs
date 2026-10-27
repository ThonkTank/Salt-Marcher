import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/atlas-terrain-prepared-field';export * from './src/app/atlas-terrain-prepared-contract';export * from './src/app/atlas-terrain-prepared-budget';export {TerrainAuthorState} from './src/app/terrain-author-state';export {terrainAuthorWindow} from './src/app/terrain-author-checkpoint';"},bundle:true,write:false,format:'esm',platform:'node'});
const m=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const value=(height,gradientX=0,gradientY=0)=>({height,gradientX,gradientY});
const pair=m.terrainSplit;
const evaluate=(a,b,d,alpha)=>m.terrainPairValue(m.terrainEvaluatePair(pair(a),pair(b),d===null?null:pair(d),alpha));

test('56/24 ABI preserves XY and independent height/gradient lanes without normalizing',()=>{
 const basis=new Float32Array(28),draft=new Float32Array(12);
 m.terrainPackBasis(basis,1,[-.125,8192.5],value(.01,-3,7),value(1e6,100,-200));
 m.terrainPackDraft(draft,1,value(1e6+.0625,100.25,-199.75));
 assert.equal(basis.byteLength/2,56);assert.equal(draft.byteLength/2,24);
 assert.deepEqual([...basis.subarray(14,16)],[-.125,8192.5]);
 const result=m.terrainEvaluateVertex(basis,draft,1,0);
 assert.equal(result.height,Math.fround(.0725));assert.equal(result.gradientX,-2.75);assert.equal(result.gradientY,7.25);
 assert.throws(()=>m.terrainEvaluateVertex(basis,draft,2,0),/position/);
});
test('old negative cases retain changed detail, exact endpoints and no-change path',()=>{
 for(const alpha of [0,.5,1,Math.fround(.1)]){
  assert.equal(evaluate(.01,1e6,1e6,alpha),evaluate(.01,1e6,null,alpha));
  assert(Math.abs(evaluate(.01,1e6,1e6+.0625,alpha)-(.01+(1e6-.01)*alpha+.0625))<1e-7);
 }
 assert.equal(evaluate(116e6+.03125,-50e6,null,0),116e6+.03125);
 assert.equal(evaluate(116e6+.03125,-50e6,null,1),-50e6);
 assert.throws(()=>evaluate(0,1,1,.1),/alpha/);
});
test('alpha1 returns the exact packed Draft end field for height and gradients at origins0/.01',()=>{
 const old=pair(-3),next=pair(49_999_999),draft=pair(.01);
 assert.deepEqual(next,[50_000_000,-1]);assert.equal(m.terrainEvaluatePair(old,next,draft,1),draft);assert.equal(m.terrainEvaluatePair(old,next,null,1),next);
 const basis=new Float32Array(14),end=new Float32Array(14),field=new Float32Array(6);
 m.terrainPackBasis(basis,0,[0,0],value(-3,-7,9),value(49_999_999,49_999_999,-49_999_999));
 m.terrainPackBasis(end,0,[0,0],value(-3,-7,9),value(.01,.01,-.01));m.terrainPackDraft(field,0,value(.01,.01,-.01));
 for(const origin of [0,.01]){
  const actual=m.terrainEvaluateVertex(basis,field,0,1,origin),canonical=m.terrainEvaluateVertex(end,null,0,1,origin);
  assert.deepEqual(actual,canonical);assert.equal(actual.height,origin===0?Math.fround(.01):.01);assert.equal(actual.gradientX,Math.fround(.01));assert.equal(actual.gradientY,Math.fround(-.01));
 }
 assert(m.TERRAIN_PREPARED_GLSL.includes('if (alpha == 1.0) return hasDraft ? draftValue : newValue;'));
});

// Exact rational expectations from the input IEEE754 bits, independent of the
// production arithmetic graph. Units are 2^-149 for each float32 component.
const bitsBuffer=new ArrayBuffer(4),bitsFloat=new Float32Array(bitsBuffer),bitsUint=new Uint32Array(bitsBuffer);
function exactFloat(v){bitsFloat[0]=v;const bits=bitsUint[0],exponent=(bits>>>23)&255,mantissa=bits&0x7fffff,sign=bits>>>31?-1n:1n;assert(exponent<255);return sign*BigInt(exponent===0?mantissa:mantissa|0x800000)*(exponent===0?1n:1n<<BigInt(exponent-1));}
const unit=2**149;
const exactPair=p=>exactFloat(p[0])+exactFloat(p[1]);
function expectation(a,b,d,alpha){const A=exactPair(a),B=exactPair(b),D=d?exactPair(d):B,t=exactFloat(alpha);return Number(A*(1n<<149n)+(B-A)*t+(D-B)*(1n<<149n))/(unit*unit);}
test('116e6 envelope, signed cancellation and 1/64m gradients agree with exact packed rational expectations',()=>{
 let seed=0x4254;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const height=116e6,g=2*height*64;
 for(const bound of [height,g])for(let i=0;i<1500;i++){
  const a=pair((rnd()*2-1)*bound),b=pair((rnd()*2-1)*bound),d=i%7===0?b:pair((rnd()*2-1)*bound),alpha=[0,.5,1,Math.fround(rnd())][i%4];
  const got=m.terrainPairValue(m.terrainEvaluatePair(a,b,d,alpha)),want=expectation(a,b,d,alpha);
  const error=Math.abs(got-want),boundError=64*2**-48*(Math.abs(a[0])+2*Math.abs(b[0])+Math.abs(d[0]));
  assert(error<=boundError+2**-120,`${got}, ${want}, error ${error}, bound ${boundError}`);
 }
 for(const alpha of [0,.5,1]){
  const a=pair(.01),b=pair(1e6),d=pair(1e6+.0625);assert(Math.abs(m.terrainPairValue(m.terrainEvaluatePair(a,b,d,alpha))-expectation(a,b,d,alpha))<1e-7);
 }
});
test('relative vertical output subtracts split origin before its final float round',()=>{
 const basis=new Float32Array(14),draft=new Float32Array(6),h=116e6-.03125;
 m.terrainPackBasis(basis,0,[0,0],value(h),value(50e6));m.terrainPackDraft(draft,0,value(h));
 assert.equal(m.terrainEvaluateVertex(basis,draft,0,1,116e6).height,h);
 assert.equal(m.terrainEvaluateVertex(basis,draft,0,1,0).height,Math.fround(h),'final round is material and must not be hidden by the DS error bound');
 assert(m.TERRAIN_PREPARED_GLSL.includes('alpha == 0.0'));
 assert(m.TERRAIN_PREPARED_GLSL.includes('all(equal(draftValue, newValue))'));
 assert(m.TERRAIN_PREPARED_GLSL.includes('terrainPreparedSubtract(value, origin)'));
});
test('whole-buffer census counts actual aliases across author, Escape, replay and transport owners',()=>{
 const shared=new ArrayBuffer(128),copy=shared.slice(0),ids=new Map();let id=0;
 const inventory=m.terrainPreparedCensus([{owner:'author',value:new Uint8Array(shared,7,1)},{owner:'escape',value:new Float64Array(shared,8,2)},{owner:'replay',value:new Map([[shared,copy]])},{owner:'transport',value:new Float32Array(copy)}],b=>{if(!ids.has(b))ids.set(b,++id);return ids.get(b);});
 assert.equal(inventory.bytes,256);assert.deepEqual(inventory.stores[0].owners,['author','escape','replay']);assert.deepEqual(inventory.stores[1].owners,['replay','transport']);
 let reserved=0;const cache=m.terrainPreparedNodeCache(3,b=>{reserved=b;});assert.equal(reserved,360);
 const c=m.terrainPreparedCensus([{owner:'nodes',value:cache}],()=>++id);assert.equal(c.bytes,360);assert.equal(c.stores.length,7);
 assert.throws(()=>m.terrainPreparedNodeCache(3,()=>{throw Error('before allocation');}),/before allocation/);
 assert.equal(m.terrainPreparedReserve(256,128,384),384);assert.throws(()=>m.terrainPreparedReserve(256,129,384),/etat/);
});
test('wire retains actual offsets and backingstore identities, never a retained graph',()=>{
 const source=new ArrayBuffer(128),buffer=structuredClone(source,{transfer:[source]});assert.equal(source.byteLength,0);
 const {table,transportBytes}=m.terrainPreparedBufferTable([{id:7,buffer}],new Map(),128);assert.equal(transportBytes,128);
 const view=m.terrainPreparedView({buffer:7,kind:'f64',offset:8,length:2},table);assert.equal(view.buffer,buffer);assert.equal(view.byteOffset,8);
 assert.throws(()=>m.terrainPreparedBufferTable([{id:7,buffer}],table,128),/identität/);
 assert.throws(()=>m.terrainPreparedBufferTable([{id:8,buffer}],new Map(),127),/etat/);
 for(const ref of [{buffer:6,kind:'f32',offset:0,length:1},{buffer:7,kind:'f64',offset:4,length:1},{buffer:7,kind:'f64',offset:8,length:16}])assert.throws(()=>m.terrainPreparedView(ref,table),/ansicht/);
 const screen={surfaceGeneration:1,frameRevision:2,fieldState:3,content:4,alpha:Math.fround(.1),endFrame:false,basis:{generation:5,topology:6,manifest:7},draftRevision:8};m.terrainPreparedValidateScreen(screen);assert.throws(()=>m.terrainPreparedValidateScreen({...screen,alpha:.1}),/Screen/);
 const inventory={rendererBackingBytes:128,authorBackingBytes:0,pendingReadBytes:0,gpuGeometryBytes:0,gpuOtherBytes:0,drawMetadataBytes:0,retainedBufferIds:[7],retainedBases:[screen.basis]};m.terrainPreparedValidateInventory(inventory);
 assert.throws(()=>m.terrainPreparedValidateInventory({...inventory,retainedBases:[screen.basis,{generation:6,topology:7,manifest:8},{generation:7,topology:8,manifest:9}]}),/inventar/);
});
test('transport reserves before copies, copies immutable sources once and moves renderer-only rays',()=>{
 const source=new ArrayBuffer(128),ray=new ArrayBuffer(32),known=new ArrayBuffer(16);let reserved=false;
 const packet=m.terrainPreparedTransport([{id:1,buffer:source,mode:'copy'},{id:2,buffer:ray,mode:'move'},{id:3,buffer:known,mode:'copy'}],new Set([3]),(copy,total)=>{assert.equal(copy,128);assert.equal(total,160);reserved=true;});
 assert(reserved);assert.notEqual(packet.buffers[0].buffer,source);assert.equal(packet.buffers[1].buffer,ray);
 const incoming=structuredClone(packet.buffers,{transfer:packet.transfer});assert.equal(source.byteLength,128);assert.equal(ray.byteLength,0);assert.equal(known.byteLength,16);assert.equal(incoming[1].buffer.byteLength,32);
 assert.throws(()=>m.terrainPreparedTransport([{id:4,buffer:source,mode:'copy'}],new Set(),()=>{throw Error('before copy');}),/before copy/);
 assert.throws(()=>m.terrainPreparedBufferTable([{id:4,buffer:source},{id:5,buffer:source}],new Map(),1024),/identität/);
});
test('allocation plan and A owners expose full 32+active bounds without assumed sharing',()=>{
 assert.deepEqual(m.terrainPreparedAllocation(10,30,3,7,10),{basis:560,draft:240,indices:120,nodeCache:360,stencils:280,rayNodes:224,rayTriangles:40,rayScratch:160});
 const a=m.terrainPreparedAuthorBound(32,774,256);assert.equal(a.K,33*256*16384);assert.equal(a.G,1081600);assert.equal(a.backingBytes,Object.values(a.owners).reduce((s,v)=>s+v,0));assert(a.adapterUtf16>0);assert(a.actionNumericContent>0);assert.throws(()=>m.terrainPreparedAuthorBound(33,774,256),/hülle/);
});
test('author result retains worker originals, charges a distinct outgoing copy and transfers only that copy',()=>{
 const originals=[{id:1,buffer:new Float64Array(4225).buffer,mode:'copy'},{id:2,buffer:new Float32Array(4096).buffer,mode:'copy'},{id:3,buffer:new Float32Array(4096).buffer,mode:'copy'}];
 const bytes=originals.reduce((s,e)=>s+e.buffer.byteLength,0),ids=new Map();let serial=0;const id=b=>{if(!ids.has(b))ids.set(b,++serial);return ids.get(b);};
 const outgoing=m.terrainPreparedTransport(originals,new Set(),(copy,total)=>{assert.equal(copy,bytes);assert.equal(total,bytes);});
 assert(originals.every((e,i)=>e.buffer!==outgoing.buffers[i].buffer));
 const before=m.terrainPreparedCensus([{owner:'worker-original',value:originals},{owner:'outgoing-author-copy',value:outgoing.buffers}],id);assert.equal(before.bytes,2*bytes);
 const received=structuredClone(outgoing.buffers,{transfer:outgoing.transfer});assert(outgoing.buffers.every(e=>e.buffer.byteLength===0));assert(originals.every(e=>e.buffer.byteLength>0));assert(received.every((e,i)=>e.buffer!==originals[i].buffer&&e.buffer!==outgoing.buffers[i].buffer));
 const after=m.terrainPreparedCensus([{owner:'worker-original',value:originals},{owner:'outgoing-detached',value:outgoing.buffers},{owner:'author-receiver',value:received}],id);assert.equal(after.bytes,2*bytes);
 assert.equal(m.terrainPreparedAuthorBound(32,774,256).owners.outgoingAuthorResult,152_174_848);
});
test('real numeric capture references validate band NaNs, reject ground NaNs and local callback owners',()=>{
 const ground=new Float64Array(4225).fill(10),page=new Float32Array(4096).fill(NaN);
 const table=new Map([[1,ground.buffer],[2,page.buffer]]),ref=(buffer,kind,length)=>({buffer,kind,offset:0,length});
 const c={id:1,owner:'author',editSeries:1,draftRevision:3,prefix:0,source:{token:'campaign',fence:'fence',revision:1},
  ground:[{lattice:{id:1,x:-1,y:-1,dx:1/64,dy:1/64},values:ref(1,'f64',4225)}],
  basis:[{x:0,y:0,pixel:1,revision:0,values:ref(2,'f32',4096)}],bands:[],suffix:[],active:null,sources:[]};
 m.terrainPreparedValidateCapture(c,table);ground[0]=NaN;assert.throws(()=>m.terrainPreparedValidateCapture(c,table),/werte/);ground[0]=10;
 const binding={epoch:1,job:1,operation:1,requestContent:3,target:c.source},r={kind:'author-result',...binding,captureId:c.id,owner:c.owner,editSeries:c.editSeries,draftRevision:c.draftRevision,prefix:c.prefix,source:c.source,ground:c.ground,basis:c.basis,bands:c.bands,buffers:[],workerBackingBytes:ground.byteLength+page.byteLength,transportBytes:0};
 m.terrainPreparedValidateAuthorResult(r,binding,c,table);assert.throws(()=>m.terrainPreparedValidateAuthorResult({...r,prefix:1},binding,c,table),/bindung/);
 assert.throws(()=>m.terrainPreparedValidateCapture({...c,current:()=>true},table),/Besitzer/);
 assert.throws(()=>m.terrainPreparedValidateDto({retained:new Map()}),/Besitzer/);
 const cycle={};cycle.self=cycle;assert.throws(()=>m.terrainPreparedValidateDto(cycle),/Besitzer/);
});
test('prepared result validates the original indexed triangle and forward-only 32B ray tree',()=>{
 const basis=new Float32Array(42);for(let i=0;i<3;i++)m.terrainPackBasis(basis,i,[[0,0],[1,0],[0,1]][i],value(1),value(2));
 const indices=new Uint32Array([0,1,2]),triangles=new Uint32Array([0]),nodes=new Uint32Array(8),bounds=new Float32Array(nodes.buffer);bounds.set([0,0,1,1]);nodes.set([0,0,0,1],4);
 const table=new Map([[1,basis.buffer],[2,indices.buffer],[3,triangles.buffer],[4,nodes.buffer]]),ref=(buffer,kind,length)=>({buffer,kind,offset:0,length}),binding={epoch:1,job:2,operation:3,requestContent:4,target:{token:'t',fence:'f',revision:1}},b={generation:1,topology:1,manifest:1};
 const texture=new Uint8Array(256*256*4),height=new Float32Array(4225);table.set(5,texture.buffer);table.set(6,height.buffer);const material={texture:ref(5,'u8',texture.length),masks:ref(5,'u8',texture.length),cover:ref(5,'u8',texture.length),relief:ref(5,'u8',texture.length)};const source={id:1,height:ref(6,'f32',4225),material};const r={kind:'result',...binding,captureId:5,editSeries:1,draftRevision:0,basis:b,draft:null,draftSources:[],buffers:[],workerBackingBytes:0,transportBytes:0,geometry:{basis:b,vertices:ref(1,'f32',42),indices:ref(2,'u32',3),rayTriangles:ref(3,'u32',1),rayNodes:ref(4,'u32',8),oldSources:[],newSources:[source],draws:[{origin:[-1e12,-1e12],oldSlot:-1,newSlot:0,firstIndex:0,indexCount:3,bounds:[0,0,1,1],rayRoot:0,rayFirstTriangle:0,rayTriangleCount:1}]}};
 m.terrainPreparedValidateResult(r,binding,{id:5,editSeries:1,draftRevision:0},table);
 const field=new Float32Array(18);table.set(7,field.buffer);const draftReply={...r,geometry:null,draft:ref(7,'f32',18)};
 assert.throws(()=>m.terrainPreparedValidateResult(draftReply,binding,{id:5,editSeries:1,draftRevision:0},table),/Draftbasis/);
 m.terrainPreparedValidateResult(draftReply,binding,{id:5,editSeries:1,draftRevision:0},table,{basis:b,vertices:3,sourceIds:[1]});
 assert.throws(()=>m.terrainPreparedValidateResult(draftReply,binding,{id:5,editSeries:1,draftRevision:0},table,{basis:{...b,generation:2},vertices:3,sourceIds:[1]}),/Draftbasis/);
 assert.throws(()=>m.terrainPreparedValidateResult({...r,operation:4},binding,{id:5,editSeries:1,draftRevision:0},table),/bindung/);
 indices[2]=3;assert.throws(()=>m.terrainPreparedValidateResult(r,binding,{id:5,editSeries:1,draftRevision:0},table),/Indexwerte/);indices[2]=2;
 nodes[7]=0;assert.throws(()=>m.terrainPreparedValidateResult(r,binding,{id:5,editSeries:1,draftRevision:0},table),/Rayknoten/);
});
test('actual A installed and Escape snapshots share only proven stores; a dispatch clone is additional',async()=>{
 const lattice={id:1,x:-2,y:-2,dx:1/16,dy:1/16};
 const state=new m.TerrainAuthorState({owner:'numeric-owner',series:1,source:{token:'t',fence:'f',revision:1},lattices:[lattice],
  read:async query=>{const w=m.terrainAuthorWindow(query),pages=[];for(let y=w.top;y<=w.bottom;y++)for(let x=w.left;x<=w.right;x++)pages.push({x:x*w.edge,y:y*w.edge,pixel:query.pixel,revision:1,values:new Float32Array(4096)});return{query:structuredClone(query),pages,ground:[{lattice:{...lattice},values:new Float64Array(4225)}],coverage:{left:w.left,right:w.right,top:w.top,bottom:w.bottom,complete:true}};},
  write:async()=>{throw Error('No write in this owner census');}});
 const stroke={mode:'raise',radius:1,strength:10,feather:.5,samples:[{x:0,y:0,t:0},{x:0,y:0,t:1000}]};
 state.begin('first',stroke);await state.refresh();await state.escape('first');const beginning=state.snapshot;
 state.begin('second',stroke);await state.refresh();const installed=state.snapshot;assert.notEqual(installed,beginning);assert.equal(state.beginning.snapshot,beginning);
 const ids=new Map();let next=0;const id=b=>{if(!ids.has(b))ids.set(b,++next);return ids.get(b);};
 const original=m.terrainPreparedCensus([{owner:'installed',value:installed},{owner:'escape',value:beginning},{owner:'borrowed',value:state.snapshot}],id);
 assert(original.stores.some(s=>s.owners.includes('installed')&&s.owners.includes('borrowed')));
 assert(original.stores.some(s=>s.owners.length===1&&s.owners[0]==='escape'));
 const clone=structuredClone(installed),withClone=m.terrainPreparedCensus([{owner:'installed',value:installed},{owner:'escape',value:beginning},{owner:'dispatch',value:clone}],id);
 const cloneBytes=m.terrainPreparedCensus([{owner:'clone',value:clone}],id).bytes;assert.equal(withClone.bytes,original.bytes+cloneBytes);
 state.retire();
});
test('affine raw physical gradients retain a small edit against a large 1/64m derivative',()=>{
 const old=value(.01,-3.5,2.25),next=value(1e6,6.4e9,-6.4e9),draft=value(1e6+.0625,6.4e9+.25,-6.4e9-.125);
 const basis=new Float32Array(42),field=new Float32Array(18);for(let i=0;i<3;i++){m.terrainPackBasis(basis,i,[[-1,-1],[-63/64,-1],[-1,-63/64]][i],old,next);m.terrainPackDraft(field,i,draft);}
 for(const alpha of [0,.5,1]){
  const vertices=[0,1,2].map(i=>m.terrainEvaluateVertex(basis,field,i,alpha,alpha===1?1e6:0));
  const actual=vertices.reduce((s,v,i)=>s+v.gradientX*[.25,.25,.5][i],0),expected=Math.fround(-3.5+(6.4e9+3.5)*alpha+.25);assert.equal(actual,expected);
 }
});

const resultBinding={epoch:1,job:1,operation:1,requestContent:1,target:{token:'t',fence:'f',revision:1}};
const resultCapture={id:9,editSeries:2,draftRevision:7};
const boundResult={kind:'result',...resultBinding,captureId:9,editSeries:2,draftRevision:7,basis:{generation:1,topology:1,manifest:1},geometry:null,draft:null,draftSources:[],buffers:[],workerBackingBytes:0,transportBytes:0};
test('field result rejects the wrong edit series even when every other binding matches',()=>{
 m.terrainPreparedValidateResult(boundResult,resultBinding,resultCapture,new Map());
 assert.throws(()=>m.terrainPreparedValidateResult({...boundResult,editSeries:3},resultBinding,resultCapture,new Map()),/bindung/);
});
test('field result rejects the wrong draft revision even when every other binding matches',()=>{
 assert.throws(()=>m.terrainPreparedValidateResult({...boundResult,draftRevision:8},resultBinding,resultCapture,new Map()),/bindung/);
});
test('rebased old116/new50/draft116 and signed gradient bounds retain exact packed expectations',()=>{
 assert.equal(m.TERRAIN_PREPARED_RANGE.transitionOldHeight,116e6);assert.equal(m.TERRAIN_PREPARED_RANGE.canonicalHeight,50e6);assert.equal(m.TERRAIN_PREPARED_RANGE.displayedHeight,282e6);assert.equal(m.TERRAIN_PREPARED_RANGE.displayedGradient,36.096e9);
 for(const [old,next,draft] of [[116e6-.03125,-50e6,116e6-.0625],[-116e6+.03125,50e6,-116e6+.0625],[14.848e9-.25,-6.4e9,14.848e9-.5],[-14.848e9+.25,6.4e9,-14.848e9+.5]])for(const alpha of [0,.5,1]){const a=pair(old),b=pair(next),d=pair(draft),actual=m.terrainPairValue(m.terrainEvaluatePair(a,b,d,alpha)),expected=expectation(a,b,d,alpha),bound=m.terrainPreparedErrorBound(Math.abs(old),Math.abs(next),Math.abs(draft)).arithmeticAndPack;assert(Math.abs(actual-expected)<=bound);}
 const out=new Float32Array(14);assert.throws(()=>m.terrainPackBasis(out,0,[0,0],value(116e6+1),value(0)),/hülle/);assert.throws(()=>m.terrainPackBasis(out,0,[0,0],value(0),value(50e6+1)),/hülle/);
});

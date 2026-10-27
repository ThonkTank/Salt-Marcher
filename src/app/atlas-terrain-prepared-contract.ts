import {TERRAIN_PREPARED_RANGE} from './atlas-terrain-prepared-field';
import type {TerrainAuthorSource,TerrainAuthorLattice,TerrainAuthorQuery} from './terrain-author-checkpoint';
import type {HeightStroke} from './terrain-brush';
import {validateHeightStroke} from './terrain-brush';
import type {TerrainMaterialChannel} from './terrain-material';

/** Owned by the P worker adapter. C produces; D consumes without rebuilding. */
export interface TerrainPreparedBasis {readonly generation:number;readonly topology:number;readonly manifest:number}
export interface TerrainPreparedBinding {
 readonly epoch:number;readonly job:number;readonly operation:number;readonly requestContent:number;
 readonly target:TerrainAuthorSource;
}
/** Numbers are minted by Surface from its actual successful draw callback.
 * fieldState is an identity of that K3 field, not an author's desired state.
 * A screen receipt confirms dispatch, not GPU completion. */
export interface TerrainPreparedScreen {
 readonly surfaceGeneration:number;readonly frameRevision:number;readonly fieldState:number;
 readonly content:number;readonly alpha:number;readonly endFrame:boolean;readonly basis:TerrainPreparedBasis;readonly draftRevision:number;
}
export type TerrainPreparedBufferKind='f32'|'f64'|'u32'|'i32'|'u8';
export interface TerrainPreparedView {readonly buffer:number;readonly kind:TerrainPreparedBufferKind;readonly offset:number;readonly length:number}
export interface TerrainPreparedBuffer {readonly id:number;readonly buffer:ArrayBuffer}
export interface TerrainPreparedSource {
 readonly id:number;readonly source:TerrainAuthorSource;readonly lod:number;readonly x:number;readonly y:number;
 readonly columns:65;readonly rows:65;readonly seaLevelM:number;readonly height:TerrainPreparedView;
 readonly ground:TerrainPreparedView;readonly water:TerrainPreparedView;
 readonly materialWidth:number;readonly materialHeight:number;
 readonly material:Readonly<Partial<Record<TerrainMaterialChannel,TerrainPreparedView>>>;
}
/** C packs the existing four material products; D only uploads them. */
export interface TerrainPreparedMaterials {
 readonly texture:TerrainPreparedView;readonly masks:TerrainPreparedView;
 readonly cover:TerrainPreparedView;readonly relief:TerrainPreparedView;
}
export interface TerrainPreparedDisplaySource {
 readonly id:number;readonly source:TerrainAuthorSource;readonly lod:number;readonly x:number;readonly y:number;
 readonly seaLevelM:number;readonly height:TerrainPreparedView;readonly material:TerrainPreparedMaterials;
}
export interface TerrainPreparedDraftSource {
 /** Exact corresponding new-source ID in this basis manifest. */
 readonly sourceId:number;readonly material:TerrainPreparedMaterials;
 /** Retained until D proves the old R32F owner has actually been removed. */
 readonly height:TerrainPreparedView|null;
}
export interface TerrainPreparedPage {readonly x:number;readonly y:number;readonly pixel:number;readonly revision:number;readonly values:TerrainPreparedView}
export interface TerrainPreparedGround {readonly lattice:TerrainAuthorLattice;readonly values:TerrainPreparedView}
export interface TerrainPreparedGesture {readonly id:string;readonly ordinal:number;readonly stroke:HeightStroke}
export interface TerrainPreparedActiveGesture {readonly id:string;readonly stroke:HeightStroke;readonly closing:boolean}
/** Exact dispatch clone. The durable author's borrowed arrays never detach.
 * An active gesture is distinct from at most 32 closed suffix entries. */
export interface TerrainPreparedVisibilityContext {readonly gesture:string;readonly ordinal:number|null;readonly owner:string;readonly editSeries:number;readonly source:TerrainAuthorSource;readonly sources:readonly {readonly id:number;readonly lod:number;readonly x:number;readonly y:number;readonly seaLevelM:number;readonly water:TerrainPreparedView}[]}
export interface TerrainPreparedCapture {
 readonly id:number;readonly owner:string;readonly editSeries:number;readonly draftRevision:number;readonly prefix:number;
 readonly source:TerrainAuthorSource;readonly ground:readonly TerrainPreparedGround[];
 readonly basis:readonly TerrainPreparedPage[];readonly bands:readonly TerrainPreparedPage[];
 readonly suffix:readonly TerrainPreparedGesture[];readonly active:TerrainPreparedActiveGesture|null;
 readonly landColor?:string;readonly sources:readonly TerrainPreparedSource[];readonly visibilityContexts?:readonly TerrainPreparedVisibilityContext[];
}
export interface TerrainPreparedDraw {
 readonly origin:readonly [number,number];readonly oldSlot:number;readonly newSlot:number;
 readonly firstIndex:number;readonly indexCount:number;
 /** Double world minX/minY/maxX/maxY; ray node bounds remain local Float32. */
 readonly bounds:readonly [number,number,number,number];
 readonly rayRoot:number;readonly rayFirstTriangle:number;readonly rayTriangleCount:number;
}
/** Node and stencil arrays are worker-only caches, not part of this result.
 * Ray arrays are built by C and transferred directly; D holds the only copy. */
export interface TerrainPreparedGeometry {
 readonly basis:TerrainPreparedBasis;readonly vertices:TerrainPreparedView;readonly indices:TerrainPreparedView;
 readonly draws:readonly TerrainPreparedDraw[];readonly rayNodes:TerrainPreparedView;readonly rayTriangles:TerrainPreparedView;
 readonly oldSources:readonly TerrainPreparedDisplaySource[];readonly newSources:readonly TerrainPreparedDisplaySource[];
}
/** Interleaved 32B ray node: four Float32 local XY bounds, then Uint32
 * left/right/first/count. Child indices are absolute node ordinals; count=0
 * means internal, 1..8 means leaf. Triangle values are original global index
 * ordinals (index offset / 3), preserving K2 diagonals and vertex order. */
export const TERRAIN_PREPARED_RAY={nodeBytes:32,nodeWords:8,bounds:0,left:4,right:5,first:6,count:7,maxLeaf:8} as const;
export interface TerrainPreparedInventory {
 readonly rendererBackingBytes:number;readonly authorBackingBytes:number;readonly pendingReadBytes:number;
 readonly gpuGeometryBytes:number;readonly gpuOtherBytes:number;readonly drawMetadataBytes:number;
 readonly retainedBufferIds:readonly number[];readonly retainedBases:readonly TerrainPreparedBasis[];
}
export interface TerrainPreparedPrepare extends TerrainPreparedBinding {
 readonly kind:'prepare';readonly from:TerrainPreparedBasis|null;readonly fromEnd:TerrainPreparedScreen|null;
 readonly capture:TerrainPreparedCapture;readonly request:string;readonly camera:string;readonly complete:boolean;
 readonly inventory:TerrainPreparedInventory;readonly buffers:readonly TerrainPreparedBuffer[];
 readonly commitThrough?:{readonly editSeries:number;readonly draftRevision:number;readonly target:TerrainAuthorSource};
}
export interface TerrainPreparedDraft extends TerrainPreparedBinding {
 readonly kind:'draft';readonly basis:TerrainPreparedBasis;readonly frozen:TerrainPreparedScreen;
 readonly capture:TerrainPreparedCapture;readonly inventory:TerrainPreparedInventory;readonly buffers:readonly TerrainPreparedBuffer[];
}
export interface TerrainPreparedReplay extends TerrainPreparedBinding {
 readonly kind:'replay';readonly capture:TerrainPreparedCapture;readonly initial:TerrainPreparedSeedPayload;
 readonly inventory:TerrainPreparedInventory;readonly buffers:readonly TerrainPreparedBuffer[];
}
/** Canonical seeds are separate jobs: do not silently combine their peak with
 * a 160MiB geometry result. C resumes its single continuation after reception. */
export interface TerrainPreparedSeedPayload {
 readonly query:TerrainAuthorQuery;
 readonly coverage:{readonly left:number;readonly right:number;readonly top:number;readonly bottom:number;readonly complete:true};
 readonly ground:readonly TerrainPreparedGround[];readonly pages:readonly TerrainPreparedPage[];
}
export interface TerrainPreparedSeed extends TerrainPreparedBinding,TerrainPreparedSeedPayload {
 readonly kind:'seed';readonly captureId:number;readonly request:number;
 readonly buffers:readonly TerrainPreparedBuffer[];
}
/** Main thread delegates this to A's bound load(stroke) closure. The worker
 * cannot mint receipts, read storage or invoke the preload bridge itself. */
export interface TerrainPreparedSeedRequest extends TerrainPreparedBinding {
 readonly kind:'seed-needed';readonly captureId:number;readonly request:number;readonly workerBufferIds:readonly number[];
 /** Look up this immutable capture in A's still-current replay input; do not
  * clone/reconstruct a fresh stroke from mutable UI arrays or worker input. */
 readonly gesture:string;
}
export interface TerrainPreparedResult extends TerrainPreparedBinding {
 readonly kind:'result';readonly captureId:number;readonly editSeries:number;readonly draftRevision:number;
 readonly basis:TerrainPreparedBasis;readonly geometry:TerrainPreparedGeometry|null;readonly draft:TerrainPreparedView|null;
 readonly draftSources:readonly TerrainPreparedDraftSource[];
 readonly buffers:readonly TerrainPreparedBuffer[];readonly workerBackingBytes:number;readonly transportBytes:number;
}
/** Separate from field delivery: a full 152MB author state plus a 98MB
 * field result does not fit 160MiB. A alone atomically installs this result.
 * Author results copy their stores: worker originals remain live. Only the
 * renderer-only ray stores use the separate move policy. */
export interface TerrainPreparedAuthorResult extends TerrainPreparedBinding {
 readonly kind:'author-result';readonly captureId:number;readonly owner:string;readonly editSeries:number;
 readonly draftRevision:number;readonly prefix:number;readonly source:TerrainAuthorSource;
 readonly ground:readonly TerrainPreparedGround[];readonly basis:readonly TerrainPreparedPage[];readonly bands:readonly TerrainPreparedPage[];
 readonly buffers:readonly TerrainPreparedBuffer[];readonly workerBackingBytes:number;readonly transportBytes:number;
}
export interface TerrainPreparedFailure extends TerrainPreparedBinding {readonly kind:'failed';readonly captureId:number;readonly message:string;readonly code:'visibility'|'calculation';readonly workerBufferIds:readonly number[]}
export interface TerrainPreparedSettle extends TerrainPreparedBinding {
 readonly kind:'settle';readonly captureId:number;readonly outcome:'screen-confirmed'|'discarded';
 readonly screen:TerrainPreparedScreen|null;readonly retainedBases:readonly TerrainPreparedBasis[];readonly retainedBufferIds:readonly number[];
}
export interface TerrainPreparedCancel extends TerrainPreparedBinding {readonly kind:'cancel';readonly captureId:number}
export interface TerrainPreparedCancelled extends TerrainPreparedBinding {readonly kind:'cancelled';readonly captureId:number;readonly workerBufferIds:readonly number[]}
export interface TerrainPreparedSettled extends TerrainPreparedBinding {readonly kind:'settled';readonly captureId:number;readonly workerBufferIds:readonly number[]}
/** Idle-only ownership reduction; this occupies the same client/worker slot
 * as calculation. The caller leases every included screen/escape until ack.
 * A released basis cannot subsequently be reintroduced by a stale inventory. */
export interface TerrainPreparedRetain extends TerrainPreparedBinding {readonly kind:'retain';readonly controlId:number;readonly captureId:number;readonly retainedBases:readonly TerrainPreparedBasis[];readonly retainedBufferIds:readonly number[]}
export interface TerrainPreparedRetained extends TerrainPreparedBinding {readonly kind:'retained';readonly controlId:number;readonly captureId:number;readonly actualBases:readonly TerrainPreparedBasis[];readonly workerBufferIds:readonly number[]}
export type TerrainPreparedRequest=TerrainPreparedPrepare|TerrainPreparedDraft|TerrainPreparedReplay|TerrainPreparedSeed|TerrainPreparedSettle|TerrainPreparedCancel|TerrainPreparedRetain;
export type TerrainPreparedResponse=TerrainPreparedResult|TerrainPreparedAuthorResult|TerrainPreparedFailure|TerrainPreparedSeedRequest|TerrainPreparedCancelled|TerrainPreparedSettled|TerrainPreparedRetained;
export interface TerrainPreparedPort {
 onmessage:((event:MessageEvent<TerrainPreparedResponse>)=>void)|null;
 onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent)=>void)|null;
 postMessage(message:TerrainPreparedRequest,transfer:Transferable[]):void;terminate():void;
}

const bytes={f32:4,f64:8,u32:4,i32:4,u8:1} as const;
const uint=(v:number)=>Number.isSafeInteger(v)&&v>=0;
export function terrainPreparedSameBasis(a:TerrainPreparedBasis,b:TerrainPreparedBasis){return a.generation===b.generation&&a.topology===b.topology&&a.manifest===b.manifest;}
export function terrainPreparedSameBinding(a:TerrainPreparedBinding,b:TerrainPreparedBinding){return a.epoch===b.epoch&&a.job===b.job&&a.operation===b.operation&&a.requestContent===b.requestContent&&a.target.token===b.target.token&&a.target.fence===b.target.fence&&a.target.revision===b.target.revision;}
export function terrainPreparedValidateScreen(s:TerrainPreparedScreen){
 if(!s||typeof s.endFrame!=='boolean'||s.endFrame&&s.alpha!==1||![s.surfaceGeneration,s.frameRevision,s.fieldState,s.content,s.draftRevision,s.basis?.generation,s.basis?.topology,s.basis?.manifest].every(uint)||!Number.isFinite(s.alpha)||s.alpha<0||s.alpha>1||Math.fround(s.alpha)!==s.alpha)throw Error('Terrain-Screenbindung prüfen.');
}
export function terrainPreparedValidateInventory(i:TerrainPreparedInventory){
 if(!i||![i.rendererBackingBytes,i.authorBackingBytes,i.pendingReadBytes,i.gpuGeometryBytes,i.gpuOtherBytes,i.drawMetadataBytes].every(uint)||!Array.isArray(i.retainedBases)||i.retainedBases.length>2||!Array.isArray(i.retainedBufferIds)||i.retainedBufferIds.some(id=>!uint(id)||id===0)||new Set(i.retainedBufferIds).size!==i.retainedBufferIds.length)throw Error('Terrain-Besitzerinventar prüfen.');
 const generations=new Set<number>();for(const b of i.retainedBases){if(![b.generation,b.topology,b.manifest].every(uint)||generations.has(b.generation))throw Error('Terrain-Basisinventar prüfen.');generations.add(b.generation);}
}
/** Whole backingstores are the transfer unit. Reused IDs may only reference
 * the exact already retained store; unknown IDs, duplicate incoming IDs and
 * oversized offsets are rejected before constructing any typed view. */
export function terrainPreparedBufferTable(incoming:readonly TerrainPreparedBuffer[],retained:ReadonlyMap<number,ArrayBuffer>,maximumBytes:number){
 if(!uint(maximumBytes))throw Error('Terrain-Bufferetat prüfen.');
 const table=new Map(retained);let total=0;const seen=new Set<number>(),physical=new Set(retained.values());
 for(const e of incoming){if(!uint(e.id)||e.id===0||seen.has(e.id)||table.has(e.id)||!(e.buffer instanceof ArrayBuffer)||physical.has(e.buffer))throw Error('Terrain-Bufferidentität prüfen.');seen.add(e.id);physical.add(e.buffer);total+=e.buffer.byteLength;if(!Number.isSafeInteger(total)||total>maximumBytes)throw Error('Terrain-Transportetat überschritten.');table.set(e.id,e.buffer);}
 return{table,transportBytes:total};
}
/** Immutable products are copied exactly once; renderer-only ray stores move.
 * Logical reuse is allowed only for IDs present in the union of all still-live
 * acknowledged renderer snapshots. This never deducts a physical worker store
 * from the whole-process census. Call postMessage with the returned transfer. */
export function terrainPreparedTransport(originals:readonly (TerrainPreparedBuffer&{readonly mode:'copy'|'move'})[],known:ReadonlySet<number>,reserve:(copyBytes:number,transportBytes:number)=>void){
 const ids=new Set<number>(),physical=new Set<ArrayBuffer>();let copyBytes=0,transportBytes=0;
 for(const e of originals){if(!uint(e.id)||e.id===0||ids.has(e.id)||physical.has(e.buffer)||!(e.buffer instanceof ArrayBuffer)||!['copy','move'].includes(e.mode))throw Error('Terrain-Transportbindung prüfen.');ids.add(e.id);physical.add(e.buffer);if(!known.has(e.id)){transportBytes+=e.buffer.byteLength;if(e.mode==='copy')copyBytes+=e.buffer.byteLength;}}
 if(!uint(copyBytes)||!uint(transportBytes))throw Error('Terrain-Transportgröße prüfen.');reserve(copyBytes,transportBytes);
 const buffers=originals.filter(e=>!known.has(e.id)).map(e=>({id:e.id,buffer:e.mode==='copy'?e.buffer.slice(0):e.buffer}));
 return{buffers,transfer:buffers.map(e=>e.buffer),copyBytes,transportBytes};
}
export function terrainPreparedView(ref:TerrainPreparedView,table:ReadonlyMap<number,ArrayBuffer>){
 const b=table.get(ref.buffer),stride=bytes[ref.kind];
 if(!b||!stride||!uint(ref.offset)||!uint(ref.length)||ref.offset%stride||!Number.isSafeInteger(ref.length*stride)||ref.offset+ref.length*stride>b.byteLength)throw Error('Terrain-Bufferansicht prüfen.');
 switch(ref.kind){case'f32':return new Float32Array(b,ref.offset,ref.length);case'f64':return new Float64Array(b,ref.offset,ref.length);case'u32':return new Uint32Array(b,ref.offset,ref.length);case'i32':return new Int32Array(b,ref.offset,ref.length);case'u8':return new Uint8Array(b,ref.offset,ref.length);}
}
/** Validate dimensions/refs before constructing views or allocating derived
 * products. Values are checked once after decoding; NaN is allowed ONLY in
 * authored band pages, never in prepared fields/ground/XY. */
export function* terrainPreparedValidateCaptureSteps(c:TerrainPreparedCapture,table:ReadonlyMap<number,ArrayBuffer>,requireVisibility=false):Generator<void>{
 yield* terrainPreparedValidateDtoSteps(c);
 if(!c||![c.id,c.editSeries,c.draftRevision,c.prefix,c.source?.revision].every(uint)||c.id===0||typeof c.owner!=='string'||!c.owner||!c.source?.token||!c.source.fence||!Array.isArray(c.suffix)||c.suffix.length>32||!Array.isArray(c.ground)||c.ground.length>32||!Array.isArray(c.basis)||c.basis.length>774||!Array.isArray(c.bands)||c.bands.length>33*256||!Array.isArray(c.sources)||c.sources.length>32)throw Error('Terrain-Capturebindung prüfen.');
 function* checked(r:TerrainPreparedView,kind:TerrainPreparedBufferKind,length:number,limit:number,nan=false):Generator<void>{
  if(!r||r.kind!==kind||r.length!==length)throw Error('Terrain-Capturedimension prüfen.');
  const v=terrainPreparedView(r,table);for(let i=0;i<v.length;i++){if((i&511)===0)yield;const n=v[i]!;if(!(nan&&Number.isNaN(n)||Number.isFinite(n)&&Math.abs(n)<=limit))throw Error('Terrain-Capturewerte prüfen.');}
 };
 const ids=new Set<number>();
 for(const g of c.ground){const l=g.lattice;if(!l||!uint(l.id)||ids.has(l.id)||![l.x,l.y,l.dx,l.dy,l.x+64*l.dx,l.y+64*l.dy].every(Number.isFinite)||Math.max(Math.abs(l.x),Math.abs(l.y),Math.abs(l.x+64*l.dx),Math.abs(l.y+64*l.dy))>1e12||l.dx<=0||l.dy<=0)throw Error('Terrain-Capturelattice prüfen.');ids.add(l.id);yield* checked(g.values,'f64',4225,116e6);}
 function* pages(values:readonly TerrainPreparedPage[]):Generator<void>{const keys=new Set<string>();for(const p of values){const k=`${p.pixel}/${p.x}/${p.y}`;if(![p.x,p.y,p.pixel].every(Number.isFinite)||Math.max(Math.abs(p.x),Math.abs(p.y))>1e12||p.pixel<2**-24||p.pixel>2**24||!Number.isInteger(Math.log2(p.pixel))||![p.x/(64*p.pixel),p.y/(64*p.pixel)].every(Number.isSafeInteger)||!uint(p.revision)||keys.has(k))throw Error('Terrain-Captureseite prüfen.');keys.add(k);yield* checked(p.values,'f32',4096,1e6,true);}};
 yield* pages(c.basis);yield* pages(c.bands);
 const gestures=new Set<string>();let ordinal=c.prefix;
 for(const g of c.suffix){if(!g.id||gestures.has(g.id)||!uint(g.ordinal)||g.ordinal!==ordinal+1)throw Error('Terrain-Capturepräfix prüfen.');gestures.add(g.id);ordinal=g.ordinal;validateHeightStroke(g.stroke);}
 if(c.active){if(!c.active.id||gestures.has(c.active.id)||typeof c.active.closing!=='boolean')throw Error('Terrain-Capturegeste prüfen.');validateHeightStroke(c.active.stroke);}
 const contexts=c.visibilityContexts??[];if(contexts.length>33)throw Error('Terrain-Visibilitykontexte prüfen.');const contextKeys=new Set<string>();for(const v of contexts){const active=v.ordinal===null,gesture=active?c.active:c.suffix.find(g=>g.ordinal===v.ordinal),key=`${v.ordinal}/${v.gesture}`;if(!gesture||gesture.id!==v.gesture||!gesture.stroke.visibility||contextKeys.has(key)||v.owner!==c.owner||v.editSeries!==c.editSeries||v.source.token!==c.source.token||!uint(v.source.revision)||v.source.revision>c.source.revision||!v.source.fence||v.sources.length<1||v.sources.length>32)throw Error('Terrain-Visibilitycapture prüfen.');contextKeys.add(key);const ids=new Set<number>();for(const s of v.sources){if(!uint(s.id)||s.id===0||ids.has(s.id)||!Number.isSafeInteger(s.lod)||s.lod< -8||s.lod>31||![s.x,s.y].every(Number.isSafeInteger)||!Number.isFinite(s.seaLevelM))throw Error('Terrain-Watermanifest prüfen.');ids.add(s.id);yield* checked(s.water,'f32',4225,50e6);}}
 if(requireVisibility)for(const g of [...c.suffix,...(c.active?[{...c.active,ordinal:null}]:[])])if(g.stroke.visibility&&!contexts.some(v=>v.gesture===g.id&&v.ordinal===g.ordinal))throw Error('Terrain-Visibilitykontext fehlt.');
 const sources=new Set<number>();
 for(const s of c.sources){if(!uint(s.id)||s.id===0||sources.has(s.id)||s.columns!==65||s.rows!==65||!Number.isSafeInteger(s.lod)||s.lod< -8||s.lod>31||![s.x,s.y].every(Number.isSafeInteger)||!Number.isFinite(s.seaLevelM)||s.source.token!==c.source.token||s.source.fence!==c.source.fence||s.source.revision!==c.source.revision||s.materialWidth!==256||s.materialHeight!==256)throw Error('Terrain-Capturequelle prüfen.');sources.add(s.id);
  yield* checked(s.height,'f32',4225,50e6);yield* checked(s.ground,'f32',4225,50e6);yield* checked(s.water,'f32',4225,50e6);
  for(const name of ['baseColor','relief','water','forest','deciduous','conifer','grass','shrub','debris'] as const)yield* checked(s.material[name]!,'u8',256*256*(name==='baseColor'||name==='relief'?4:1),255);
  for(const name of ['rock','snow'] as const)if(s.material[name])yield* checked(s.material[name]!,'u8',256*256,255);
 }
}
export function terrainPreparedValidateCapture(c:TerrainPreparedCapture,table:ReadonlyMap<number,ArrayBuffer>){const work=terrainPreparedValidateCaptureSteps(c,table);while(!work.next().done){/* synchronous consumers preserve the same validator */}}

/** Only plain data crosses the boundary. In particular A's current()/load()
 * callbacks and local retained-object census never become wire properties. */
export function* terrainPreparedValidateDtoSteps(value:unknown):Generator<void>{
 const parents=new Set<object>();
 let count=0;function* visit(v:unknown):Generator<void>{if((++count&255)===0)yield;if(v===null||v===undefined||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Terrain-Wirezahl prüfen.');return;}
  if(typeof v!=='object'||ArrayBuffer.isView(v)||v instanceof ArrayBuffer||parents.has(v)||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype)throw Error('Terrain-Wire enthält lokale Besitzer.');
  parents.add(v);for(const item of Object.values(v))yield* visit(item);parents.delete(v);
 };yield* visit(value);
}
export function terrainPreparedValidateDto(value:unknown){const work=terrainPreparedValidateDtoSteps(value);while(!work.next().done){/* shared synchronous decoder */}}

/** C validates before resolving A's injected replay promise. A still performs
 * its own current-owner check after that await and installs all fields at once. */
export function terrainPreparedValidateAuthorResult(r:TerrainPreparedAuthorResult,expected:TerrainPreparedBinding,c:Pick<TerrainPreparedCapture,'id'|'owner'|'editSeries'|'draftRevision'|'prefix'|'source'>,table:ReadonlyMap<number,ArrayBuffer>){
 if(r.kind!=='author-result'||!terrainPreparedSameBinding(r,expected)||r.captureId!==c.id||r.owner!==c.owner||r.editSeries!==c.editSeries||r.draftRevision!==c.draftRevision||r.prefix!==c.prefix||r.source.token!==c.source.token||r.source.fence!==c.source.fence||r.source.revision!==c.source.revision||![r.workerBackingBytes,r.transportBytes].every(uint))throw Error('Terrain-Autorenresultatbindung prüfen.');
 terrainPreparedValidateCapture({id:r.captureId,owner:r.owner,editSeries:r.editSeries,draftRevision:r.draftRevision,prefix:r.prefix,source:r.source,ground:r.ground,basis:r.basis,bands:r.bands,suffix:[],active:null,sources:[]},table);
}
export function terrainPreparedValidateResult(r:TerrainPreparedResult,expected:TerrainPreparedBinding,capture:Pick<TerrainPreparedCapture,'id'|'editSeries'|'draftRevision'>,table:ReadonlyMap<number,ArrayBuffer>,retained?:{basis:TerrainPreparedBasis;vertices:number;sourceIds:readonly number[]}){
 if(r.kind!=='result'||!terrainPreparedSameBinding(r,expected)||r.captureId!==capture.id||r.editSeries!==capture.editSeries||r.draftRevision!==capture.draftRevision||![r.captureId,r.editSeries,r.draftRevision,r.workerBackingBytes,r.transportBytes,r.basis?.generation,r.basis?.topology,r.basis?.manifest].every(uint))throw Error('Terrain-Resultatbindung prüfen.');
 const float=(ref:TerrainPreparedView,stride:number)=>{if(ref.kind!=='f32'||ref.length%stride)throw Error('Terrain-Feldlayout prüfen.');const v=terrainPreparedView(ref,table);if(!(v instanceof Float32Array)||!v.every(Number.isFinite))throw Error('Terrain-Feldwerte prüfen.');return v;};
 const lanes=(values:Float32Array,stride:number,at:number,height:number,gradient:number)=>{for(let i=at;i<values.length;i+=stride){if(Math.abs(values[i]!+values[i+1]!)>height||Math.abs(values[i+2]!+values[i+3]!)>gradient||Math.abs(values[i+4]!+values[i+5]!)>gradient)throw Error('Terrain-Feldhülle prüfen.');}};
 const draft=r.draft?float(r.draft,6):null;if(draft)lanes(draft,6,0,TERRAIN_PREPARED_RANGE.draftHeight,TERRAIN_PREPARED_RANGE.draftGradient);
 if(!r.geometry&&draft&&(!retained||!terrainPreparedSameBasis(r.basis,retained.basis)||draft.length/6!==retained.vertices))throw Error('Terrain-Draftbasis prüfen.');
 if(!Array.isArray(r.draftSources)||r.draftSources.length>32)throw Error('Terrain-Draftquellen prüfen.');
 const materials=(p:TerrainPreparedMaterials)=>{for(const ref of [p.texture,p.masks,p.cover,p.relief]){if(ref.kind!=='u8'||ref.length!==256*256*4)throw Error('Terrain-Materiallayout prüfen.');terrainPreparedView(ref,table);}};
 for(const s of r.draftSources){if(!uint(s.sourceId)||s.sourceId===0)throw Error('Terrain-Draftmanifest prüfen.');materials(s.material);if(s.height){const h=float(s.height,1);if(h.length!==4225)throw Error('Terrain-Draftraster prüfen.');}}
 const sourceIds=r.geometry?.newSources.map(s=>s.id)??retained?.sourceIds;
 if(r.draftSources.length&&(!sourceIds||r.draftSources.length!==sourceIds.length||r.draftSources.some((s,i)=>s.sourceId!==sourceIds[i])))throw Error('Terrain-Draftquellbindung prüfen.');
 if(r.geometry){const g=r.geometry;if(!terrainPreparedSameBasis(g.basis,r.basis)||g.oldSources.length>32||g.newSources.length>32)throw Error('Terrain-Basisbindung prüfen.');
  for(const s of [...g.oldSources,...g.newSources]){if(!uint(s.id)||s.id===0)throw Error('Terrain-Quellmanifest prüfen.');materials(s.material);const h=float(s.height,1);if(h.length!==4225)throw Error('Terrain-Quellraster prüfen.');}
  const vertices=float(g.vertices,14),vertexCount=vertices.length/14;lanes(vertices,14,2,TERRAIN_PREPARED_RANGE.transitionOldHeight,TERRAIN_PREPARED_RANGE.transitionOldGradient);// An absent New side aliases all six packed Old values exactly. This is
  // not a canonical New source and does not widen that producer envelope.
  const alias=(i:number)=>[0,1,2,3,4,5].every(c=>Object.is(vertices[i*14+2+c],vertices[i*14+8+c]));
  const canonical=(i:number)=>Math.abs(vertices[i*14+8]!+vertices[i*14+9]!)<=TERRAIN_PREPARED_RANGE.canonicalHeight&&Math.max(Math.abs(vertices[i*14+10]!+vertices[i*14+11]!),Math.abs(vertices[i*14+12]!+vertices[i*14+13]!))<=TERRAIN_PREPARED_RANGE.canonicalGradient;
  for(let i=0;i<vertexCount;i++)if(!canonical(i)&&!alias(i))throw Error('Terrain-Newhülle prüfen.');
  if(g.indices.kind!=='u32'||g.indices.length%3||g.rayTriangles.kind!=='u32'||g.rayNodes.kind!=='u32'||g.rayNodes.length%8)throw Error('Terrain-Indexlayout prüfen.');
  const indices=terrainPreparedView(g.indices,table),triangles=terrainPreparedView(g.rayTriangles,table),nodes=terrainPreparedView(g.rayNodes,table);
  if(!(indices instanceof Uint32Array)||!(triangles instanceof Uint32Array)||!(nodes instanceof Uint32Array)||indices.some(i=>i>=vertexCount)||triangles.some(i=>i>=indices.length/3)||draft&&draft.length/6!==vertexCount)throw Error('Terrain-Indexwerte prüfen.');
  const bounds=new Float32Array(nodes.buffer,nodes.byteOffset,nodes.length),n=nodes.length/8;
  for(let i=0;i<n;i++){const k=8*i,left=nodes[k+4]!,right=nodes[k+5]!,first=nodes[k+6]!,count=nodes[k+7]!;
   if(![bounds[k],bounds[k+1],bounds[k+2],bounds[k+3]].every(v=>v!==undefined&&Number.isFinite(v))||bounds[k]!>bounds[k+2]!||bounds[k+1]!>bounds[k+3]!||count>8||(count===0?(left<=i||right<=i||left>=n||right>=n):first+count>triangles.length))throw Error('Terrain-Rayknoten prüfen.');
  }
  let end=0;for(const d of g.draws){if(![...d.origin,...d.bounds].every(Number.isFinite)||![d.firstIndex,d.indexCount,d.rayRoot,d.rayFirstTriangle,d.rayTriangleCount].every(uint)||d.firstIndex!==end||d.indexCount%3||d.firstIndex+d.indexCount>indices.length||d.rayRoot>=n||d.rayFirstTriangle+d.rayTriangleCount>triangles.length||d.rayTriangleCount!==d.indexCount/3||!Number.isInteger(d.oldSlot)||d.oldSlot< -1||d.oldSlot>=g.oldSources.length||!Number.isInteger(d.newSlot)||d.newSlot< -1||d.newSlot>=g.newSources.length)throw Error('Terrain-Drawbindung prüfen.');for(let j=d.firstIndex;j<d.firstIndex+d.indexCount;j++){const i=indices[j]!;if(d.newSlot<0?!alias(i):!canonical(i))throw Error('Terrain-Newabwesenheit prüfen.');}end+=d.indexCount;}
  if(end!==indices.length)throw Error('Terrain-Drawabdeckung prüfen.');
 }
}

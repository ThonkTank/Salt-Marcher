import {atlasTerrainTileModels,atlasTerrainModelRetained,completeAtlasTerrainModels,withAtlasTerrainAllocationBudget,withAtlasTerrainModelMeasurements,type AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {terrainModelBytes,terrainModelBuffers,TERRAIN_MODEL_MEMORY,encodeTerrainModel,type TerrainModelJob,type TerrainModelAcknowledgement} from './atlas-terrain-model-client';
import {validateSurfaceTile,type AtlasSurfaceTile} from './atlas-surface-tile-stream';
import {prepareAtlasTerrainFieldGeometry,ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH} from './atlas-terrain-field-presentation';

function tileSourceBinding(key:string):{fence:string;revision:number}{
  let value:unknown;try{value=JSON.parse(key);}catch{throw Error('Terrainmodell-Quellschlüssel ungültig.');}
  if(!Array.isArray(value)||value.length!==3||typeof value[0]!=='string'||!value[0]||
    typeof value[1]!=='string'||!value[1]||!Number.isSafeInteger(value[2])||value[2]<0)
    throw Error('Terrainmodell-Quellschlüssel ungültig.');
  return{fence:value[1],revision:value[2]};
}

/** Disposable pure presentation work; no preload/native/storage access. */
export class TerrainModelWorkerState {
  private owner={};private base=0;private awaiting:number|null=null;private source='';private epoch=0;
  private bufferIds=new WeakMap<ArrayBuffer,number>();private bufferId=0;private knownBuffers=new Set<number>();
  private tiles=new Map<number,AtlasSurfaceTile>();private models:readonly AtlasTerrainTileModel[]=[];
  displayed(binding:TerrainModelAcknowledgement){
    if(binding.epoch!==this.epoch||binding.source!==this.source||binding.job!==this.awaiting||binding.base!==this.base||!Array.isArray(binding.bufferIds)||binding.bufferIds.length>4096||binding.bufferIds.some(id=>!Number.isSafeInteger(id)||id<1||id>this.bufferId))throw Error('Terrainmodell-Snapshotbestätigung veraltet.');
    completeAtlasTerrainModels(this.owner);this.base=binding.job;this.awaiting=null;this.knownBuffers=new Set(binding.bufferIds);
  }
  build(job:TerrainModelJob){
    if(this.awaiting!==null||job.base!==this.base||this.epoch&&job.epoch!==this.epoch||this.source&&job.source!==this.source||job.tiles.length>32||job.ids.length!==job.tiles.length||new Set(job.ids).size!==job.ids.length)throw Error('Terrainmodell-Auftragsbindung ungültig.');
    const binding=tileSourceBinding(job.source);
    // Reject malformed fresh and retained fields before copying axes or building geometry.
    for(let i=0;i<job.tiles.length;i++){
      const tile=job.tiles[i]??this.tiles.get(job.ids[i]!);
      if(!tile)throw Error('Terrainmodell-Eingabe fehlt.');
      validateSurfaceTile(tile,{tile:tile.tile,revision:binding.revision,product:'height'},binding.fence,false);
    }
    this.source=job.source;this.epoch=job.epoch;
    const inputBytes=terrainModelBytes(job.tiles);if(!Number.isSafeInteger(job.displayBytes)||job.displayBytes<0||inputBytes>TERRAIN_MODEL_MEMORY.input)throw Error('Terrainmodell-Eingabespeicher überschritten.');
    let charged=inputBytes+terrainModelBytes(atlasTerrainModelRetained([...this.tiles.values()],this.models))+job.displayBytes;
    const reserve=(bytes:number)=>{if(!Number.isSafeInteger(bytes)||bytes<0||charged+bytes>TERRAIN_MODEL_MEMORY.total)throw Error('Terrainmodell-Arbeitsspeicher überschritten.');charged+=bytes;};
    reserve(0);
    const next=new Map(job.tiles.map((tile,i)=>{const id=job.ids[i]!,value=this.tiles.get(id)??tile;if(!Number.isSafeInteger(id)||id<1||!value)throw Error('Terrainmodell-Eingabe fehlt.');return[id,value];})),tiles=[...next.values()],start=performance.now(),stages:Record<string,number>={};
    // New canonical views each introduce two bounded Float64 axis arrays.
    reserve(job.tiles.filter(Boolean).length*65*2*8);
    const models=withAtlasTerrainAllocationBudget(reserve,()=>withAtlasTerrainModelMeasurements((phase,ms)=>{stages[phase]=(stages[phase]??0)+ms;},()=>atlasTerrainTileModels(tiles,{owner:this.owner,animate:job.animate,fieldOnly:true})));
    const sourceResultBytes=terrainModelBytes([models,tiles]),sourceTransportBytes=terrainModelBuffers([models,tiles]).filter(buffer=>!this.knownBuffers.has(this.bufferIds.get(buffer)??-1)).reduce((sum,buffer)=>sum+buffer.byteLength,0);
    let expectedTransportBytes=0,adoptionVertexBytes=0,fieldMetadataPeakBytes=0;
    const adoptionLayoutBytes=new Set(models.map(model=>model.grid.view)).size*65*2*8,fieldUploadScratchBytes=ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH;
    const fieldStart=performance.now(),fieldGeometry=prepareAtlasTerrainFieldGeometry(this.models,models,0,job.displayGeometryBytes??0,{
      retainedDrawMetadataBytes:job.displayDrawMetadataBytes??0,
      reserve:(bytes,need)=>{
        if(sourceResultBytes+need.geometryBytes>TERRAIN_MODEL_MEMORY.result)throw Error('Terrainmodell-Resultatspeicher vor Geometrieallokation überschritten.');
        // Real independent allocations: worker field + transport backing stores
        // + the renderer's slot-rebased vertex copy. Draw descriptors exist in
        // the worker plan, wire graph, decoded graph and rebased surface graph;
        // use the existing 128-byte descriptor comparison for all four, never
        // deduct theoretical shared indices. Source copies are counted using
        // the acknowledged buffer identities, before encode can allocate them.
        expectedTransportBytes=sourceTransportBytes+need.geometryBytes;adoptionVertexBytes=need.vertexBytes;
        fieldMetadataPeakBytes=need.drawMetadataBytes*4;
        reserve(bytes+expectedTransportBytes+adoptionVertexBytes+need.drawMetadataBytes*3+adoptionLayoutBytes+fieldUploadScratchBytes);
      }
    }),fieldGeometryMs=performance.now()-fieldStart;
    const workerMs=performance.now()-start,resultBytes=terrainModelBytes([models,tiles,fieldGeometry]);if(resultBytes>TERRAIN_MODEL_MEMORY.result)throw Error('Terrainmodell-Resultatspeicher überschritten.');
    const encodeStart=performance.now(),packet=encodeTerrainModel({models,tiles,fieldGeometry},this.knownBuffers,buffer=>{let id=this.bufferIds.get(buffer);if(id===undefined){id=++this.bufferId;this.bufferIds.set(buffer,id);}return id;},bytes=>{if(bytes!==expectedTransportBytes)throw Error('Terrainmodell-Transportbedarf hat sich nach dem Vorabzählen geändert.');});
    this.tiles=next;this.models=models;this.awaiting=job.job;
    return{kind:'result' as const,epoch:job.epoch,job:job.job,base:job.base,source:job.source,payload:packet.payload,buffers:packet.buffers,metrics:{workerMs,fieldGeometryMs,resultCopyMs:packet.copyMs,encodeMs:performance.now()-encodeStart,resultBytes,transportBytes:packet.transportBytes,workerHeldBytes:terrainModelBytes(atlasTerrainModelRetained(tiles,models)),chargedPeakBytes:charged,fieldGeometryBytes:fieldGeometry.gpuGeometryBytes,fieldDrawMetadataBytes:fieldGeometry.gpuDrawMetadataBytes,fieldMetadataPeakBytes,adoptionVertexBytes,adoptionLayoutBytes,fieldUploadScratchBytes,expectedTransportBytes,...stages}};
  }
}
import {terrainPreparedBufferTable,terrainPreparedTransport,terrainPreparedValidateCaptureSteps,terrainPreparedValidateInventory,terrainPreparedSameBinding,terrainPreparedSameBasis,terrainPreparedView,terrainPreparedValidateScreen,type TerrainPreparedRequest,type TerrainPreparedResponse,type TerrainPreparedBinding,type TerrainPreparedReplay,type TerrainPreparedSeed,type TerrainPreparedView,type TerrainPreparedGeometry} from './atlas-terrain-prepared-contract';
import {TerrainPreparedRegistry,prepareTerrainBasis,prepareTerrainDraft,replayTerrainAuthorSteps,preparedWorkBytes,type TerrainPreparedWorkBasis,type TerrainPreparedNeedSeed,type TerrainPreparedDraftState} from './atlas-terrain-prepared-work';
import type {TerrainAuthorCheckpoint} from './terrain-author-checkpoint';

const PREPARED_INPUT=40*1024*1024,PREPARED_RESULT=160*1024*1024;
type WorkJob=Extract<TerrainPreparedRequest,{kind:'prepare'|'draft'|'replay'}>;
// Opt-in on this existing worker URL; no diagnostic message enters the wire.
const PREPARED_PHASE_SUMMARY=typeof location!=='undefined'&&new URL(location.href).searchParams.get('terrainPhaseSummary')==='1';
interface PreparedPhaseSummary {
 epoch:number;job:number;captureId:number;kind:string;receivedAt:number;inputAcceptMs:number;
 activeRunMs:number;chunks:number;enqueueWaitMs:number;seedWaitMs:number;seedAcceptMs:number;seedRequests:number;
 activeSince:number|null;queuedSince:number|null;seedSince:number|null;resultSentAt:number|null;lastPhase:string;resultPrepareSendMs:number;
}

interface Work {job:WorkJob;steps:Generator<void|TerrainPreparedNeedSeed,TerrainPreparedResponse,TerrainAuthorCheckpoint|undefined>;seed:number|null;gesture?:string;resume?:TerrainAuthorCheckpoint;timer:ReturnType<typeof setTimeout>|null;cancelled:boolean;allocated:number;phase:string;createdBasis:number|null;live?:unknown}
/** Exactly one resumable calculation. No internal job queue and no second
 * worker: the client owns one uncopied latest descriptor until cancellation. */
export class TerrainPreparedWorkerState {
 private registry=new TerrainPreparedRegistry();private bases=new Map<number,TerrainPreparedWorkBasis>();
 private phaseSummaries=new Map<string,PreparedPhaseSummary>();
 private phaseKey(job:TerrainPreparedRequest){return `${job.epoch}/${job.job}/${'capture'in job?job.capture?.id:job.captureId}`;}
 private summary(job:TerrainPreparedRequest){return PREPARED_PHASE_SUMMARY?this.phaseSummaries.get(this.phaseKey(job)):undefined;}
 private beginSummary(job:TerrainPreparedRequest,receivedAt:number){
  if(!PREPARED_PHASE_SUMMARY||!['prepare','draft','replay'].includes(job.kind)||!('capture'in job))return;
  const key=this.phaseKey(job);if(this.phaseSummaries.has(key))return;
  this.phaseSummaries.set(key,{epoch:job.epoch,job:job.job,captureId:job.capture?.id,kind:job.kind,receivedAt,inputAcceptMs:0,activeRunMs:0,chunks:0,enqueueWaitMs:0,seedWaitMs:0,seedAcceptMs:0,seedRequests:0,activeSince:null,queuedSince:null,seedSince:null,resultSentAt:null,lastPhase:'input-validation',resultPrepareSendMs:0});
 }
 private pauseSummary(s:PreparedPhaseSummary,now:number){if(s.activeSince!==null){s.activeRunMs+=now-s.activeSince;s.activeSince=null;}}
 private summaryOutput(prefix:string,value:object){try{console.info(prefix+JSON.stringify(value));}catch{/* Diagnostics must not replace a product outcome. */}}
 private endSummary(job:TerrainPreparedRequest,outcome:string,reason:string,receivedAt?:number){
  const s=this.summary(job);if(!s)return;const endAt=performance.now();
  if(s.resultSentAt!==null){const at=receivedAt??endAt;this.summaryOutput('TW06_WORKER_SETTLE ',{epoch:s.epoch,job:s.job,captureId:s.captureId,kind:s.kind,resultSentAt:s.resultSentAt,settleReceivedAt:at,settleHandledMs:endAt-at,resultToSettleMs:at-s.resultSentAt,outcome,reason,lastPhase:s.lastPhase});this.phaseSummaries.delete(this.phaseKey(job));return;}
  this.pauseSummary(s,endAt);if(s.queuedSince!==null){s.enqueueWaitMs+=endAt-s.queuedSince;s.queuedSince=null;}if(s.seedSince!==null){s.seedWaitMs+=endAt-s.seedSince;s.seedSince=null;}
  if(s.chunks===0&&s.inputAcceptMs===0)s.inputAcceptMs=endAt-s.receivedAt;
  this.summaryOutput('TW06_WORKER_SUMMARY ',{epoch:s.epoch,job:s.job,captureId:s.captureId,kind:s.kind,receivedAt:s.receivedAt,inputAcceptMs:s.inputAcceptMs,activeRunMs:s.activeRunMs,chunks:s.chunks,enqueueWaitMs:s.enqueueWaitMs,seedWaitMs:s.seedWaitMs,seedAcceptMs:s.seedAcceptMs,seedRequests:s.seedRequests,endAt,elapsedMs:endAt-s.receivedAt,outcome,reason,lastPhase:s.lastPhase,resultPrepareSendMs:s.resultPrepareSendMs});
  if(outcome==='result-sent')s.resultSentAt=endAt;else this.phaseSummaries.delete(this.phaseKey(job));
 }

 private current:Work|null=null;private pendingDraft:{basis:number;state:TerrainPreparedDraftState}|null=null;private awaiting:{job:WorkJob;basis:number|null}|null=null;
 private reservedBasis:number|null=null;private controlSerial=0;private epoch=0;private serial=0;private seedSerial=0;private known=new Set<number>();private author:TerrainPreparedResponse|null=null;
 constructor(private post:(reply:TerrainPreparedResponse,transfer:Transferable[])=>void,private schedule:(run:()=>void)=>ReturnType<typeof setTimeout>=run=>setTimeout(run,0),private cancelTimer:(timer:ReturnType<typeof setTimeout>)=>void=timer=>clearTimeout(timer)){}
 get diagnostics(){return{continuations:this.current?1:0,phase:this.current?.phase??null,bases:this.bases.size,reservedBases:this.reservedBasis===null?0:1,workerBackingBytes:preparedWorkBytes([this.bases,this.registry.buffers,this.current?.job,this.awaiting?.job,this.current?.live,this.pendingDraft]),allocatedBytes:this.current?.allocated??0,retainedBufferIds:[...this.registry.buffers.keys()]};}
 receive(message:TerrainPreparedRequest){const receivedAt=PREPARED_PHASE_SUMMARY?performance.now():0;this.beginSummary(message,receivedAt);try{
  if(message.kind==='cancel'){const work=this.current,waiting=this.awaiting;if(work&&terrainPreparedSameBinding(message,work.job)&&message.captureId===work.job.capture.id){if(work.timer!==null)this.cancelTimer(work.timer);work.cancelled=true;this.pendingDraft=null;work.steps.return(undefined as never);if(work.createdBasis!==null)this.bases.delete(work.createdBasis);this.reservedBasis=null;this.current=null;this.prune();this.post({...this.binding(message),kind:'cancelled',captureId:message.captureId,workerBufferIds:[...this.registry.buffers.keys()]},[]);this.endSummary(work.job,'cancelled','bound cancel',receivedAt);}else if(waiting&&terrainPreparedSameBinding(message,waiting.job)&&message.captureId===waiting.job.capture.id){if(waiting.basis!==null&&!this.knownBasis(waiting.basis))this.bases.delete(waiting.basis);this.awaiting=null;this.pendingDraft=null;this.prune();this.post({...this.binding(message),kind:'cancelled',captureId:message.captureId,workerBufferIds:[...this.registry.buffers.keys()]},[]);this.endSummary(waiting.job,'cancelled','bound cancel after result',receivedAt);}return;}
  if(message.kind==='settle'){const waiting=this.awaiting;if(!waiting||!terrainPreparedSameBinding(message,waiting.job)||message.captureId!==waiting.job.capture.id)return;
   if(message.retainedBases.length>2||new Set(message.retainedBufferIds).size!==message.retainedBufferIds.length)throw Error('Terrain-Settleinventar prüfen.');
   if(message.outcome==='screen-confirmed'){if(!message.screen)throw Error('Terrain-Screenbestätigung fehlt.');terrainPreparedValidateScreen(message.screen);if(message.screen.draftRevision!==waiting.job.capture.draftRevision||waiting.basis!==null&&!terrainPreparedSameBasis(message.screen.basis,this.bases.get(waiting.basis)!.basis))throw Error('Terrain-Screenbasis verändert.');}
   if(message.outcome==='screen-confirmed'&&this.pendingDraft){const b=this.bases.get(this.pendingDraft.basis),d=this.pendingDraft.state;if(!b)throw Error('Terrain-Draftbesitzer fehlt.');b.cache.draftGradients=d.gradients;b.cache.draftRevisions=d.revisions;b.changedRegions=d.regions;b.draftModels=d.models;b.draftSources=d.sources;b.confirmedDraft={editSeries:waiting.job.capture.editSeries,draftRevision:waiting.job.capture.draftRevision};}this.pendingDraft=null;
   const retained=new Set(message.retainedBases.map(b=>{const known=this.bases.get(b.generation);if(!known||!terrainPreparedSameBasis(known.basis,b))throw Error('Terrain-Basis nicht gehalten.');return b.generation;}));
   for(const id of this.bases.keys())if(!retained.has(id))this.bases.delete(id);this.known=new Set(message.retainedBufferIds);this.awaiting=null;this.prune();this.post({...this.binding(message),kind:'settled',captureId:message.captureId,workerBufferIds:[...this.registry.buffers.keys()]},[]);this.endSummary(waiting.job,'settled',message.outcome,receivedAt);return;
  }
  if(message.kind==='retain'){
   if(this.current||this.awaiting||this.reservedBasis!==null||message.epoch!==this.epoch||message.job<=this.serial||!Number.isSafeInteger(message.controlId)||message.controlId<=this.controlSerial||!Number.isSafeInteger(message.captureId)||message.captureId<1)throw Error('Terrain-Retainplatz prüfen.');
   terrainPreparedValidateInventory({rendererBackingBytes:0,authorBackingBytes:0,pendingReadBytes:0,gpuGeometryBytes:0,gpuOtherBytes:0,drawMetadataBytes:0,retainedBases:message.retainedBases,retainedBufferIds:message.retainedBufferIds});
   const retained=new Set(message.retainedBases.map(b=>{const known=this.bases.get(b.generation);if(!known||!terrainPreparedSameBasis(known.basis,b))throw Error('Freigegebene Terrain-Basis nicht wiederaufnehmbar.');return b.generation;}));
   this.serial=message.job;this.controlSerial=message.controlId;for(const id of this.bases.keys())if(!retained.has(id))this.bases.delete(id);this.known=new Set(message.retainedBufferIds);this.prune();
   this.post({...this.binding(message),kind:'retained',controlId:message.controlId,captureId:message.captureId,actualBases:[...this.bases.values()].map(b=>b.basis),workerBufferIds:[...this.registry.buffers.keys()]},[]);return;
  }
  if(message.kind==='seed'){this.seed(message);return;}
  if(this.current||this.awaiting)throw Error('Terrain-Fortsetzungsplatz belegt.');
  if(message.target.token!==message.capture.source.token||message.target.fence!==message.capture.source.fence||message.target.revision!==message.capture.source.revision)throw Error('Terrain-Auftragsquelle prüfen.');
  if(this.epoch&&message.epoch!==this.epoch||message.job<=this.serial)throw Error('Terrain-Arbeitsbindung veraltet.');
  terrainPreparedValidateInventory(message.inventory);terrainPreparedBufferTable(message.buffers,this.registry.buffers,PREPARED_INPUT);
  if(message.kind==='prepare'&&this.bases.size+(this.reservedBasis===null?0:1)>=2)throw Error('Terrain-Basisplatz vor Allokation belegt.');
  if(message.kind==='prepare')this.reservedBasis=message.job;
  for(const entry of message.buffers)this.registry.add(entry.id,entry.buffer);this.epoch=message.epoch;this.serial=message.job;
  const work:Work={job:message,steps:this.calculate(message),seed:null,timer:null,cancelled:false,allocated:0,phase:'validation',createdBasis:null};this.current=work;const summary=this.summary(message);if(summary){summary.inputAcceptMs=performance.now()-summary.receivedAt;summary.lastPhase=work.phase;}this.enqueue(work);
 }catch(error){this.failure(message,error,receivedAt);}}
 private phase=(name:string)=>{if(this.current){this.current.phase=name;const summary=this.summary(this.current.job);if(summary)summary.lastPhase=name;}};
 private binding(v:TerrainPreparedBinding):TerrainPreparedBinding{return{epoch:v.epoch,job:v.job,operation:v.operation,requestContent:v.requestContent,target:v.target};}
 private knownBasis(generation:number){return [...this.bases.values()].some(b=>b.basis.generation===generation&&[b.geometry.vertices.buffer,b.geometry.indices.buffer].some(id=>this.known.has(id)));}
 private enqueue(work:Work){if(this.current!==work||work.cancelled||work.seed!==null)return;const summary=this.summary(work.job);if(summary)summary.queuedSince=performance.now();work.timer=this.schedule(()=>{work.timer=null;this.run(work);});}
 private run(work:Work){if(this.current!==work||work.cancelled)return;try{const start=performance.now(),summary=this.summary(work.job);if(summary){if(summary.queuedSince!==null){summary.enqueueWaitMs+=start-summary.queuedSince;summary.queuedSince=null;}summary.activeSince=start;summary.chunks++;}for(let n=0;n<256;n++){
   const step=withAtlasTerrainAllocationBudget(bytes=>{work.allocated+=bytes;},()=>work.steps.next(work.resume));work.resume=undefined;
   if(this.current!==work||work.cancelled)return;
   if(step.done){this.current=null;this.awaiting={job:work.job,basis:step.value.kind==='result'?step.value.basis.generation:null};const sentStart=PREPARED_PHASE_SUMMARY?performance.now():0;this.deliver(step.value);if(summary)summary.resultPrepareSendMs=performance.now()-sentStart;this.endSummary(work.job,'result-sent',step.value.kind);return;}
   if(step.value){work.seed=++this.seedSerial;work.gesture=step.value.gesture;this.prune();if(summary)summary.seedRequests++;this.post({...this.binding(work.job),kind:'seed-needed',captureId:work.job.capture.id,request:work.seed,gesture:step.value.gesture,workerBufferIds:[...this.registry.buffers.keys()]},[]);return;}
   if(performance.now()-start>=4)break;
  }if(summary)this.pauseSummary(summary,performance.now());this.enqueue(work);
 }catch(error){this.failure(work.job,error);}finally{const summary=this.summary(work.job);if(summary){const now=performance.now();this.pauseSummary(summary,now);if(work.seed!==null&&summary.seedSince===null)summary.seedSince=now;}}}
 private seed(message:TerrainPreparedSeed){const work=this.current;if(!work||work.seed!==message.request||message.captureId!==work.job.capture.id||!terrainPreparedSameBinding(message,work.job))return;
  const summary=this.summary(work.job),arrived=PREPARED_PHASE_SUMMARY?performance.now():0;if(summary&&summary.seedSince!==null){summary.seedWaitMs+=arrived-summary.seedSince;summary.seedSince=null;}try{
  const table=terrainPreparedBufferTable(message.buffers,this.registry.buffers,PREPARED_INPUT).table;
  // Decoder checks complete query, Offset0, coverage, revisions, NaN and all values.
  const checkpoint=this.checkpoint(message,table);this.checkQuery(checkpoint,work.job,work.gesture);for(const e of message.buffers)this.registry.add(e.id,e.buffer);work.resume=checkpoint;work.seed=null;
  }finally{if(summary)summary.seedAcceptMs+=performance.now()-arrived;}this.enqueue(work);
 }
 private checkpoint(seed:TerrainPreparedReplay['initial']|TerrainPreparedSeed,table:ReadonlyMap<number,ArrayBuffer>):TerrainAuthorCheckpoint{
  const value={query:seed.query,coverage:seed.coverage,ground:seed.ground.map(g=>({lattice:g.lattice,values:terrainPreparedView(g.values,table) as Float64Array})),pages:seed.pages.map(p=>({...p,values:terrainPreparedView(p.values,table) as Float32Array}))};return value;
 }
 private *validateCheckpoint(seed:TerrainAuthorCheckpoint,job:WorkJob):Generator<void>{const q=seed.query,w=terrainAuthorWindow(q),coverage=seed.coverage;if(!coverage||coverage.complete!==true||coverage.left!==w.left||coverage.right!==w.right||coverage.top!==w.top||coverage.bottom!==w.bottom||seed.pages.length!==w.pages||seed.ground.length!==q.lattices.length)throw Error('Terrain-Seedcoverage prüfen.');const stores=new Set<ArrayBufferLike>();let i=0;for(let y=w.top;y<=w.bottom;y++)for(let x=w.left;x<=w.right;x++){yield;const p=seed.pages[i++]!;if(p.x!==x*w.edge||p.y!==y*w.edge||p.pixel!==q.pixel||!Number.isSafeInteger(p.revision)||p.revision<0||p.values.byteOffset!==0||p.values.length!==4096||p.values.buffer.byteLength!==16384||stores.has(p.values.buffer))throw Error('Terrain-Seedseite prüfen.');stores.add(p.values.buffer);for(let n=0;n<4096;n++){if((n&511)===0)yield;const v=p.values[n]!;if(!(Number.isNaN(v)||Number.isFinite(v)&&Math.abs(v)<=1e6))throw Error('Terrain-Seedwert prüfen.');}}for(let j=0;j<seed.ground.length;j++){const g=seed.ground[j]!;if(JSON.stringify(g.lattice)!==JSON.stringify(q.lattices[j])||g.values.byteOffset!==0||g.values.length!==4225||g.values.buffer.byteLength!==33800||stores.has(g.values.buffer))throw Error('Terrain-Seedground prüfen.');stores.add(g.values.buffer);for(let n=0;n<4225;n++){if((n&511)===0)yield;const v=g.values[n]!;if(!Number.isFinite(v)||Math.abs(v)>50e6)throw Error('Terrain-Seedgroundwert prüfen.');}}this.checkQuery(seed,job);}
 private *replay(job:Extract<WorkJob,{kind:'replay'}>):Generator<void|TerrainPreparedNeedSeed,import('./terrain-author-state').TerrainAuthorReplayResult,TerrainAuthorCheckpoint|undefined>{const initial=this.checkpoint(job.initial,this.registry.buffers);yield* this.validateCheckpoint(initial,job);const inner=replayTerrainAuthorSteps(job.capture,initial,owners=>{if(this.current)this.current.live=owners;},this.registry.buffers,this.phase);let step=inner.next();while(!step.done){if(step.value){const seed=yield step.value;if(!seed)throw Error('Terrain-Replayseed fehlt.');yield* this.validateCheckpoint(seed,job);step=inner.next(seed);}else{yield;step=inner.next();}}return step.value;}
 private checkQuery(seed:TerrainAuthorCheckpoint,job:WorkJob,gesture?:string){const q=seed.query,c=job.capture;if(q.owner!==c.owner||q.series!==c.editSeries||q.prefix!==c.prefix||q.token!==c.source.token||q.fence!==c.source.fence||q.revision!==c.source.revision)throw Error('Terrain-Seedquellbindung prüfen.');if(gesture){const action=c.suffix.find(g=>g.id===gesture)??(c.active?.id===gesture?c.active:null);if(!action||JSON.stringify(strokeBox(action.stroke))!==JSON.stringify(q.box)||heightBrushPixel(action.stroke.radius)!==q.pixel)throw Error('Terrain-Seedcapture prüfen.');}if(job.kind==='replay'&&JSON.stringify(q.lattices)!==JSON.stringify(job.initial.query.lattices))throw Error('Terrain-Seedlattice verändert.');}
 private *calculate(job:WorkJob):Generator<void|TerrainPreparedNeedSeed,TerrainPreparedResponse,TerrainAuthorCheckpoint|undefined>{yield* terrainPreparedValidateCaptureSteps(job.capture,this.registry.buffers,job.kind==='replay');const capture=job.capture,reserve=(bytes:number)=>{if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Terrain-Arbeitsbedarf prüfen.');this.current!.allocated+=bytes;};
  if(job.kind==='replay'){
   const value=yield* this.replay(job);const result:TerrainPreparedResponse={...this.binding(job),kind:'author-result',captureId:capture.id,owner:capture.owner,editSeries:capture.editSeries,draftRevision:capture.draftRevision,prefix:capture.prefix,source:capture.source,ground:value.ground.map(g=>({lattice:g.lattice,values:this.registry.ref(g.values)})),basis:value.basis.map(p=>({...p,values:this.registry.ref(p.values)})),bands:value.bands.map(p=>({...p,values:this.registry.ref(p.values)})),buffers:[],workerBackingBytes:0,transportBytes:0};this.author=result;return result;
  }
  if(!/^#[0-9a-f]{6}$/i.test(capture.landColor??''))throw Error('Terrain-Landfarbe fehlt.');
  let base:TerrainPreparedWorkBasis,geometry:TerrainPreparedGeometry|null=null;
  if(job.kind==='prepare'){
   const old=job.from?this.bases.get(job.from.generation):null;if(job.from&&(!old||!terrainPreparedSameBasis(old.basis,job.from)))throw Error('Terrain-Ausgangsbasis fehlt.');
   if(job.from&&(!job.fromEnd||job.fromEnd.alpha!==1||!job.fromEnd.endFrame||!terrainPreparedSameBasis(job.fromEnd.basis,job.from)))throw Error('Terrain-Endbild vor Basiswechsel fehlt.');
   const endpoint=job.commitThrough;if(endpoint&&(!!capture.active||capture.suffix.length>0||!old?.draftModels||!old.confirmedDraft||endpoint.editSeries!==capture.editSeries||endpoint.editSeries!==old.confirmedDraft.editSeries||endpoint.draftRevision!==old.confirmedDraft.draftRevision||endpoint.draftRevision!==job.fromEnd?.draftRevision||endpoint.target.token!==job.target.token||endpoint.target.fence!==job.target.fence||endpoint.target.revision!==job.target.revision))throw Error('Terrain-Commitendpunkt nicht bestätigt.');
   base=yield* prepareTerrainBasis({generation:job.job,topology:job.job,manifest:job.job},old??null,capture.sources,this.registry.buffers,this.registry,reserve,!!endpoint,this.phase,roots=>{if(this.current)this.current.live=roots;});this.bases.set(base.basis.generation,base);this.current!.createdBasis=base.basis.generation;this.reservedBasis=null;geometry=base.geometry;
  }else{const retained=this.bases.get(job.basis.generation);if(!retained||!terrainPreparedSameBasis(retained.basis,job.basis)||!terrainPreparedSameBasis(job.frozen.basis,job.basis))throw Error('Terrain-Draftbasis fehlt.');base=retained;}
  let draft:TerrainPreparedView|null=null,draftSources:readonly import('./atlas-terrain-prepared-contract').TerrainPreparedDraftSource[]=[];
  if(capture.ground.length&&(capture.suffix.length||capture.active||job.kind==='draft')){const ground=capture.ground.map(g=>({lattice:g.lattice,values:terrainPreparedView(g.values,this.registry.buffers) as Float64Array})),result=yield* prepareTerrainDraft(base,ground,capture.draftRevision,this.registry,reserve,this.phase,capture.landColor!,roots=>{if(this.current)this.current.live=roots;});draft=result.draft;draftSources=result.sources;this.pendingDraft={basis:base.basis.generation,state:result.state};}
  return{...this.binding(job),kind:'result',captureId:capture.id,editSeries:capture.editSeries,draftRevision:capture.draftRevision,basis:base.basis,geometry,draft,draftSources,buffers:[],workerBackingBytes:0,transportBytes:0};
 }
 private refs(value:unknown){const ids=new Set<number>();const visit=(v:unknown)=>{if(!v||typeof v!=='object')return;const r=v as Partial<TerrainPreparedView>;if(typeof r.buffer==='number'&&typeof r.kind==='string'){ids.add(r.buffer);return;}for(const child of Object.values(v))visit(child);};visit(value);return ids;}
 private deliver(result:TerrainPreparedResponse){if(result.kind!=='result'&&result.kind!=='author-result')return;const ids=this.refs(result),ray=result.kind==='result'&&result.geometry?new Set([result.geometry.rayNodes.buffer,result.geometry.rayTriangles.buffer]):new Set<number>();
  const originals=[...ids].map(id=>{const buffer=this.registry.buffers.get(id);if(!buffer)throw Error('Terrain-Ausgangsbuffer fehlt.');return{id,buffer,mode:ray.has(id)?'move' as const:'copy' as const};});
  const workerBackingBytes=preparedWorkBytes([this.bases,this.registry.buffers,this.current?.job,this.awaiting?.job,this.current?.live,this.pendingDraft]),packet=terrainPreparedTransport(originals,this.known,(copy,transport)=>{if(transport>PREPARED_RESULT)throw Error('Terrain-Resultattransport überschritten.');if(this.current)this.current.allocated+=copy;});
  const reply={...result,buffers:packet.buffers,workerBackingBytes,transportBytes:packet.transportBytes};this.post(reply,packet.transfer);for(const id of ray)this.registry.buffers.delete(id);
 }
 private prune(){const ids=new Set(this.known);if(this.current)for(const id of this.refs(this.current.job.capture.visibilityContexts))ids.add(id);if(this.author)for(const id of this.refs(this.author))ids.add(id);for(const b of this.bases.values()){for(const id of this.refs([b.geometry,b.sources,b.draftSources]))ids.add(id);}this.registry.retain(ids);}
 private failure(job:TerrainPreparedRequest,error:unknown,receivedAt?:number){
  // An invalid/late idle control cannot tear down a different live dispatch.
  const running=this.current&&terrainPreparedSameBinding(job,this.current.job),waiting=this.awaiting&&terrainPreparedSameBinding(job,this.awaiting.job);
  if(running||waiting||!this.current&&!this.awaiting){if(this.current?.timer!==null&&this.current?.timer!==undefined)this.cancelTimer(this.current.timer);if(this.current?.createdBasis!==null&&this.current?.createdBasis!==undefined)this.bases.delete(this.current.createdBasis);if(waiting&&this.awaiting!.basis!==null&&!this.knownBasis(this.awaiting!.basis!))this.bases.delete(this.awaiting!.basis!);this.reservedBasis=null;this.current=null;this.awaiting=null;this.pendingDraft=null;this.prune();}
  if('capture'in job)this.post({...this.binding(job),kind:'failed',captureId:job.capture.id,message:error instanceof Error?error.message:String(error),code:/Visibility|Water/.test(error instanceof Error?error.message:String(error))?'visibility':'calculation',workerBufferIds:[...this.registry.buffers.keys()]},[]);else if('captureId'in job)this.post({...this.binding(job),kind:'failed',captureId:job.captureId,message:error instanceof Error?error.message:String(error),code:/Visibility|Water/.test(error instanceof Error?error.message:String(error))?'visibility':'calculation',workerBufferIds:[...this.registry.buffers.keys()]},[]);this.endSummary(job,'failed',error instanceof Error?error.message:String(error),receivedAt);}
}
import {terrainAuthorWindow} from './terrain-author-checkpoint';
import {strokeBox} from './land-mask';
import {heightBrushPixel} from './terrain-brush';

// P uses this same worker entry point; the legacy builder remains for the
// old raster caller until E switches that caller to the prepared protocol.
if(typeof self!=='undefined'&&typeof document==='undefined'){
  const state=new TerrainModelWorkerState(),prepared=new TerrainPreparedWorkerState((reply,transfer)=>self.postMessage(reply,{transfer}));self.onmessageerror=()=>{throw Error('Terrainmodell-Auftrag nicht lesbar.');};self.onmessage=(event:MessageEvent<TerrainModelJob|TerrainModelAcknowledgement>)=>{
    const job=event.data;if(job.kind!=='build'&&job.kind!=='displayed'){prepared.receive(job as unknown as TerrainPreparedRequest);return;}try{if(job.kind==='displayed'){state.displayed(job);return;}const reply=state.build(job);self.postMessage(reply,{transfer:reply.buffers.map(entry=>entry.buffer)});}
    catch(error){self.postMessage({kind:'result',epoch:job.epoch,job:job.job,base:job.base,source:job.source,error:error instanceof Error?error.message:String(error),metrics:{},payload:null,buffers:[]});}
  };
}

import type {TerrainAuthorVisibilityContext} from './terrain-author-visibility';
import type {AtlasSurfaceTile} from './atlas-surface-tile-stream';
import type {AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import type {AtlasTerrainFieldGeometry} from './atlas-terrain-field-presentation';

export const TERRAIN_MODEL_MEMORY={input:40*1024*1024,result:160*1024*1024,total:384*1024*1024} as const;
/** Backing stores, rather than subviews, are the accounting/transfer unit. */
export function terrainModelBuffers(value:unknown):ArrayBuffer[]{
  const objects=new Set<object>(),buffers=new Set<ArrayBuffer>();
  const visit=(v:unknown)=>{if(!v||typeof v!=='object'||objects.has(v))return;objects.add(v);
    if(v instanceof ArrayBuffer){buffers.add(v);return;}
    if(ArrayBuffer.isView(v)){if(v.buffer instanceof ArrayBuffer)buffers.add(v.buffer);return;}
    if(v instanceof Map||v instanceof Set){for(const item of v.values())visit(item);return;}
    for(const item of Object.values(v))visit(item);
  };visit(value);return[...buffers];
}
export function terrainModelBytes(value:unknown){return terrainModelBuffers(value).reduce((sum,b)=>sum+b.byteLength,0);}
interface TerrainWireBuffer {id:number;buffer:ArrayBuffer}
interface TerrainWirePacket {payload:unknown;buffers:TerrainWireBuffer[];transportBytes:number;copyMs:number}
/** Only buffers absent from the last acknowledged display cross the boundary.
 * The encoded graph retains aliases, while the worker keeps its own originals. */
export function encodeTerrainModel(value:unknown,known:ReadonlySet<number>,idFor:(buffer:ArrayBuffer)=>number,reserve:(bytes:number)=>void):TerrainWirePacket {
  const originals=terrainModelBuffers(value),ids=new Map(originals.map(buffer=>[buffer,idFor(buffer)])),missing=originals.filter(buffer=>!known.has(ids.get(buffer)!)),transportBytes=missing.reduce((sum,b)=>sum+b.byteLength,0);
  if(transportBytes)reserve(transportBytes);const start=performance.now(),buffers=missing.map(buffer=>({id:ids.get(buffer)!,buffer:buffer.slice(0)})),copyMs=performance.now()-start,visited=new Map<object,unknown>();
  const encode=(v:unknown):unknown=>{if(!v||typeof v!=='object')return v;if(visited.has(v))return visited.get(v);
    if(v instanceof Float32Array||v instanceof Uint32Array||v instanceof Uint8Array){const result={__terrainView:true,id:ids.get(v.buffer as ArrayBuffer),kind:v.constructor.name,offset:v.byteOffset,length:v.length};visited.set(v,result);return result;}
    if(v instanceof ArrayBuffer){const result={__terrainBuffer:true,id:ids.get(v)};visited.set(v,result);return result;}
    const result:Record<string,unknown>|unknown[]=Array.isArray(v)?[]:{};visited.set(v,result);for(const [key,item]of Object.entries(v))(result as Record<string,unknown>)[key]=encode(item);return result;
  };return{payload:encode(value),buffers,transportBytes,copyMs};
}
export function decodeTerrainModel(payload:unknown,incoming:readonly TerrainWireBuffer[],previous:ReadonlyMap<number,ArrayBuffer>=new Map(),oldViews:ReadonlyMap<string,ArrayBufferView>=new Map()){
  const buffers=new Map(previous),views=new Map<string,ArrayBufferView>(),visited=new Map<object,unknown>(),received=new Set<number>(),reused=new Set<ArrayBuffer>();
  for(const entry of incoming){if(!Number.isSafeInteger(entry.id)||entry.id<1||received.has(entry.id)||buffers.has(entry.id)||!(entry.buffer instanceof ArrayBuffer))throw Error('Terrainmodell-Bufferbindung ungültig.');received.add(entry.id);buffers.set(entry.id,entry.buffer);}
  const decode=(v:unknown):unknown=>{if(!v||typeof v!=='object')return v;if(visited.has(v))return visited.get(v);const record=v as Record<string,unknown>;
    if(record.__terrainView===true||record.__terrainBuffer===true){const id=record.id as number,buffer=buffers.get(id);if(!buffer)throw Error('Terrainmodell-Buffer fehlt.');
      if(record.__terrainBuffer===true)return buffer;
      const kind=record.kind,offset=record.offset as number,length=record.length as number,key=`${id}/${kind}/${offset}/${length}`,old=oldViews.get(key);
      if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0)throw Error('Terrainmodell-Ansicht ungültig.');
      const view=old??(kind==='Float32Array'?new Float32Array(buffer,offset,length):kind==='Uint32Array'?new Uint32Array(buffer,offset,length):kind==='Uint8Array'?new Uint8Array(buffer,offset,length):null);if(!view)throw Error('Terrainmodell-Buffertyp ungültig.');if(old)reused.add(buffer);views.set(key,view);visited.set(v,view);return view;
    }
    visited.set(v,v);for(const [key,item]of Object.entries(v))record[key]=decode(item);return v;
  };return{value:decode(payload),buffers,views,reusedBytes:[...reused].reduce((sum,b)=>sum+b.byteLength,0)};
}
export interface TerrainModelGoal {tiles:readonly AtlasSurfaceTile[];source:string;request:string;camera:string;complete:boolean;animate:boolean;}
export interface TerrainModelBinding {epoch:number;job:number;base:number;source:string;}
export interface TerrainModelSnapshot extends TerrainModelGoal,TerrainModelBinding {models:readonly AtlasTerrainTileModel[];fieldGeometry:AtlasTerrainFieldGeometry;metrics:Record<string,number>;}
export interface TerrainModelJob extends TerrainModelBinding {kind:'build';tiles:readonly (AtlasSurfaceTile|null)[];ids:number[];animate:boolean;displayBytes:number;displayGeometryBytes?:number;displayDrawMetadataBytes?:number;}
export interface TerrainModelAcknowledgement extends TerrainModelBinding {kind:'displayed';bufferIds:number[];}
export interface TerrainModelReply extends TerrainModelBinding {kind:'result';payload:unknown;buffers:TerrainWireBuffer[];metrics:Record<string,number>;error?:string;}
export interface TerrainModelPort {
  onmessage:((event:MessageEvent<TerrainModelReply>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent)=>void)|null;
  postMessage(value:unknown,transfer?:Transferable[]):void;terminate():void;
}
export interface TerrainSurfaceInventory {retained:unknown;gpuGeometryBytes:number;drawMetadataBytes:number;}
interface TerrainInputIdentity {next:WeakMap<object,TerrainInputIdentity>;id?:number}
let epoch=0;
/** One job and one uncopied latest descriptor. The next calculation starts only
 * after the renderer confirms this exact content and its final morph alpha. */
export class AtlasTerrainModelClient {
  readonly epoch=++epoch;
  private port:TerrainModelPort;private latest:TerrainModelGoal|null=null;
  private flight:{goal:TerrainModelGoal;binding:TerrainModelBinding;ids:number[];sent:number;prepareMs:number;copyMs:number;inputBytes:number}|null=null;
  private cancelWait!:()=>void;private cancelled=new Promise<void>(resolve=>{this.cancelWait=resolve;});
  private stopped=false;private serial=0;private base=0;private displayBytes=0;private displayGeometryBytes=0;private displayDrawMetadataBytes=0;private workerBytes=0;
  private ids:TerrainInputIdentity={next:new WeakMap()};private id=0;private workerTiles=new Set<number>();
  private views=new Map<string,ArrayBufferView>();private buffers=new Map<number,ArrayBuffer>();
  constructor(private source:string,private apply:(snapshot:TerrainModelSnapshot)=>Promise<void>,private failed:(error:Error)=>void,create:()=>TerrainModelPort=()=>new Worker(new URL('./atlas-terrain-model-worker.js',location.href)),private inventory?:()=>TerrainSurfaceInventory){
    this.port=create();this.port.onmessage=e=>{void this.receive(e.data);};this.port.onerror=e=>this.fail(Error(e.message||'Terrainmodell-Worker fehlgeschlagen.'));this.port.onmessageerror=()=>this.fail(Error('Terrainmodell-Antwort nicht lesbar.'));
  }
  submit(goal:TerrainModelGoal){if(this.stopped)return;if(goal.source!==this.source){this.fail(Error('Terrainmodell-Quelle geändert.'));return;}this.latest=goal;this.pump();}
  private tileId(tile:AtlasSurfaceTile){const channels=tile.material.channels;let node=this.ids;for(const object of [tile.terrain.projection.grid,...Object.keys(channels).sort().map(name=>channels[name as keyof typeof channels]!).filter(Boolean)]){let child=node.next.get(object);if(!child){child={next:new WeakMap()};node.next.set(object,child);}node=child;}return node.id??(node.id=++this.id);}
  private pump(){
    if(this.stopped||this.flight||!this.latest)return;
    const goal=this.latest;this.latest=null;const binding={epoch:this.epoch,job:++this.serial,base:this.base,source:this.source},start=performance.now();
    try{
      if(goal.tiles.length>32)throw Error('Terrainmodell-Kachelbudget überschritten.');
      const ids=goal.tiles.map(tile=>this.tileId(tile));
      // Canonical editing ground travels with changed source products for the
      // later draft basis. Stream buffers are never detached. Unchanged sources
      // are already owned by this worker; no new transport copy is needed.
      const tiles=goal.tiles.map((t,i)=>this.workerTiles.has(ids[i]!)?null:{...t,terrain:{...t.terrain,projection:{...t.terrain.projection,pixels:new Uint8Array()}}});
      const live=this.inventory?.(),displayBytes=live?terrainModelBytes([this.buffers,live.retained])+live.drawMetadataBytes:this.displayBytes;
      const displayGeometryBytes=live?.gpuGeometryBytes??this.displayGeometryBytes,displayDrawMetadataBytes=live?.drawMetadataBytes??this.displayDrawMetadataBytes;
      const inputBytes=terrainModelBytes(tiles);if(inputBytes>TERRAIN_MODEL_MEMORY.input||inputBytes+displayBytes+this.workerBytes>TERRAIN_MODEL_MEMORY.total)throw Error('Terrainmodell-Eingabespeicher überschritten.');
      const prepared=performance.now(),copied=structuredClone(tiles),copyMs=performance.now()-prepared;
      this.flight={goal:{...goal,tiles:[]},binding,ids,sent:performance.now(),prepareMs:prepared-start,copyMs,inputBytes};
      this.port.postMessage({kind:'build',...binding,tiles:copied,ids,animate:goal.animate,displayBytes,displayGeometryBytes,displayDrawMetadataBytes} satisfies TerrainModelJob,terrainModelBuffers(copied));
    }catch(error){this.fail(error);}
  }
  private async receive(reply:TerrainModelReply){
    if(this.stopped)return;const flight=this.flight;
    if(!flight||(['epoch','job','base','source'] as const).some(k=>reply[k]!==flight.binding[k]))return;
    if(reply.error){this.fail(Error(reply.error));return;}
    try{
      const adoptionStart=performance.now();if(terrainModelBytes(reply.buffers)>TERRAIN_MODEL_MEMORY.result)throw Error('Terrainmodell-Transportbudget überschritten.');
      const decoded=decodeTerrainModel(reply.payload,reply.buffers,this.buffers,this.views),value=decoded.value as {models:readonly AtlasTerrainTileModel[];tiles:readonly AtlasSurfaceTile[];fieldGeometry:AtlasTerrainFieldGeometry};
      if(!Array.isArray(value.models)||!Array.isArray(value.tiles)||value.models.length>32||value.tiles.length>32||!(value.fieldGeometry?.vertices instanceof Float32Array)||!(value.fieldGeometry?.indices instanceof Uint32Array)||!Array.isArray(value.fieldGeometry?.draws)||value.fieldGeometry.newSourceCount!==value.models.length)throw Error('Terrainmodell-Resultat ungültig.');
      const live=this.inventory?.(),retainedMetadata=live?.drawMetadataBytes??this.displayDrawMetadataBytes;
      const bytes=terrainModelBytes(value),gpuScratchBytes=value.fieldGeometry.vertices.byteLength,raySnapshotBytes=2*value.models.reduce((sum,m)=>sum+m.grid.heights.byteLength,0),layoutSnapshotBytes=32*65*2*8*6,mainHeldBytes=terrainModelBytes([this.buffers,value,live?.retained]),fieldMetadataBytes=2*(retainedMetadata+value.fieldGeometry.gpuDrawMetadataBytes);
      if(bytes>TERRAIN_MODEL_MEMORY.result||gpuScratchBytes+raySnapshotBytes+layoutSnapshotBytes+fieldMetadataBytes+mainHeldBytes+flight.inputBytes+(reply.metrics.workerHeldBytes??0)>TERRAIN_MODEL_MEMORY.total)throw Error('Terrainmodell-Übernahmespeicher überschritten.');
      const snapshot:TerrainModelSnapshot={...flight.goal,...flight.binding,...value,metrics:{...reply.metrics,inputBytes:flight.inputBytes,prepareMs:flight.prepareMs,copyMs:flight.copyMs,deliveryMs:performance.now()-flight.sent,resultBytes:bytes,gpuScratchBytes,fieldMetadataBytes,raySnapshotBytes,layoutSnapshotBytes,adoptionMs:performance.now()-adoptionStart,reusedBytes:decoded.reusedBytes}};
      await Promise.race([this.apply(snapshot),this.cancelled]);if(this.stopped||this.flight!==flight)return;
      for(const model of value.models)delete model.transition;
      const retained=new Set(terrainModelBuffers(value));this.buffers=new Map([...decoded.buffers].filter(([,buffer])=>retained.has(buffer)));this.views=new Map([...decoded.views].filter(([,view])=>retained.has(view.buffer as ArrayBuffer)));
      this.workerTiles=new Set(flight.ids);this.workerBytes=reply.metrics.workerHeldBytes??0;this.base=reply.job;this.displayGeometryBytes=value.fieldGeometry.gpuGeometryBytes;this.displayDrawMetadataBytes=value.fieldGeometry.gpuDrawMetadataBytes;this.displayBytes=terrainModelBytes(value)+gpuScratchBytes+layoutSnapshotBytes+2*this.displayDrawMetadataBytes;
      this.port.postMessage({kind:'displayed',...flight.binding,bufferIds:[...this.buffers.keys()]} satisfies TerrainModelAcknowledgement);this.flight=null;this.pump();
    }catch(error){if(!this.stopped)this.fail(error);}
  }
  private fail(value:unknown){if(this.stopped)return;this.dispose();this.failed(value instanceof Error?value:Error(String(value)));}
  dispose(){if(this.stopped)return;this.stopped=true;this.views.clear();this.buffers.clear();this.workerTiles.clear();this.cancelWait();this.latest=null;this.flight=null;this.port.onmessage=this.port.onerror=this.port.onmessageerror=null;this.port.terminate();}
}

import {terrainPreparedBufferTable,terrainPreparedTransport,terrainPreparedValidateResult,terrainPreparedValidateAuthorResult,terrainPreparedSameBinding,terrainPreparedSameBasis,terrainPreparedValidateScreen,terrainPreparedValidateInventory,terrainPreparedView,type TerrainPreparedPort,type TerrainPreparedBinding,type TerrainPreparedCapture,type TerrainPreparedView,type TerrainPreparedRequest,type TerrainPreparedResponse,type TerrainPreparedScreen,type TerrainPreparedBasis,type TerrainPreparedInventory,type TerrainPreparedSource,type TerrainPreparedResult,type TerrainPreparedSeedPayload} from './atlas-terrain-prepared-contract';
import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import type {TerrainAuthorSnapshot,TerrainAuthorReplayInput,TerrainAuthorReplayResult} from './terrain-author-state';
import type {TerrainAuthorCheckpoint,TerrainAuthorPage,TerrainAuthorGround} from './terrain-author-checkpoint';
import {terrainPreparedCensus} from './atlas-terrain-prepared-budget';

export interface TerrainPreparedFieldGoal {
 readonly landColor:string;readonly kind:'prepare'|'draft';readonly snapshot:TerrainAuthorSnapshot;readonly tiles:readonly AtlasSurfaceTile[];
 readonly operation:number;readonly requestContent:number;readonly basis:TerrainPreparedBasis|null;
 readonly screen:TerrainPreparedScreen|null;readonly request:string;readonly camera:string;readonly complete:boolean;
 readonly commitThrough?:{readonly editSeries:number;readonly draftRevision:number;readonly target:TerrainAuthorSnapshot['source']};
}
export interface TerrainPreparedDelivery {
 readonly result:TerrainPreparedResult;readonly expected:TerrainPreparedBinding;
 readonly capture:Pick<TerrainPreparedCapture,'id'|'editSeries'|'draftRevision'>;
 readonly buffers:ReadonlyMap<number,ArrayBuffer>;
}
export interface TerrainPreparedFieldCompletion {
 readonly goal:TerrainPreparedFieldGoal;readonly outcome:'settled'|'cancelled'|'discarded'|'disposed'|'failed';
 readonly binding:TerrainPreparedBinding|null;readonly capture:TerrainPreparedDelivery['capture']|null;readonly screen:TerrainPreparedScreen|null;
}
interface PreparedTask {goal?:TerrainPreparedFieldGoal;replay?:TerrainAuthorReplayInput;resolve?:(v:TerrainAuthorReplayResult)=>void;reject?:(e:Error)=>void;fieldDone?:(v:TerrainPreparedFieldCompletion)=>void;fieldFinished?:boolean}
interface PreparedFlight {task:PreparedTask;binding:TerrainPreparedBinding;capture:TerrainPreparedCapture;stage:'running'|'staging'|'settling';settledInventory?:TerrainPreparedInventory;settledScreen?:TerrainPreparedScreen|null;cancelling:boolean;poll:ReturnType<typeof setTimeout>|null}
interface PreparedControl {binding:TerrainPreparedBinding;captureId:number;controlId:number;inventory:TerrainPreparedInventory}
let preparedEpoch=0;
/** Product adapter for A + the same existing modelworker. A owns author
 * installation; Surface owns successful screens; neither authority is copied
 * into mutable UI state. A latest descriptor is borrowed until dispatch. */
export class AtlasTerrainPreparedClient {
 readonly epoch=++preparedEpoch;private serial=0;private captureSerial=0;private inputSerial=0;
 private physicalIds=new WeakMap<ArrayBuffer,number>();private tileIds=new Map<string,number>();private tileSerial=0;
 private port:TerrainPreparedPort;private flight:PreparedFlight|null=null;private latest:PreparedTask|null=null;
 private control:PreparedControl|null=null;private controlSerial=0;private acknowledged:TerrainPreparedInventory|null=null;private workerBases:readonly TerrainPreparedBasis[]=[];private lastBinding:TerrainPreparedBinding|null=null;
 private buffers=new Map<number,ArrayBuffer>();private workerKnown=new Set<number>();private stopped=false;
 private settleObservers=new Set<(screen:TerrainPreparedScreen|null,binding:TerrainPreparedBinding)=>void>();
 observeSettled(observer:(screen:TerrainPreparedScreen|null,binding:TerrainPreparedBinding)=>void){this.settleObservers.add(observer);return()=>this.settleObservers.delete(observer);}
 /** Synchronous accepted pointerdown only; never cancels a drawn flight or replay. */
 discardFieldLatest(){const old=this.latest;if(old?.goal){this.latest=null;this.finishField(old,'discarded');}}
 private authorResult:TerrainAuthorReplayResult|null=null;private retained=new Map<number,{basis:TerrainPreparedBasis;vertices:number;sourceIds:number[];source:TerrainAuthorSnapshot['source'];water:TerrainAuthorVisibilityContext['sources'];visibility?:TerrainAuthorVisibilityContext}>();
 constructor(private apply:(delivery:TerrainPreparedDelivery)=>Promise<TerrainPreparedScreen>,private inventory:()=>TerrainPreparedInventory,private failed:(e:Error)=>void,create:()=>TerrainPreparedPort=()=>new Worker(new URL('./atlas-terrain-model-worker.js',location.href))){
  this.port=create();this.port.onmessage=e=>{void this.receive(e.data);};this.port.onerror=e=>this.fail(Error(e.message||'Terrainworker fehlgeschlagen.'));this.port.onmessageerror=()=>this.fail(Error('Terrainworker-Antwort nicht lesbar.'));
 }
 get diagnostics(){let id=0;return{epoch:this.epoch,control:this.control?.controlId??null,workerBases:this.workerBases.length,flight:this.flight?.binding??null,latest:this.latest?.replay?'replay':this.latest?.goal?.kind??null,backingBytes:terrainPreparedCensus([{owner:'retained renderer results',value:this.buffers},{owner:'author result borrowed by A',value:this.authorResult},{owner:'confirmed water contexts',value:this.retained}],()=>++id).bytes,bufferIds:[...this.buffers.keys()]};}
 private cancelFlight(f:PreparedFlight|null){if(f&&!f.cancelling&&f.stage!=='settling'){f.cancelling=true;this.port.postMessage({...f.binding,kind:'cancel',captureId:f.capture.id},[]);}}
 cancelPending(){const old=this.latest;this.latest=null;old?.reject?.(Error('Autorenarbeit ersetzt.'));if(old)this.finishField(old,'discarded');this.cancelFlight(this.flight);}
 /** E fences an unpainted Surface installation before calling this. A's
  * accepted checkpoint replay and its uncopied latest must keep progressing. */
 cancelUndrawnField(){this.discardFieldLatest();if(!this.flight?.task.replay)this.cancelFlight(this.flight);}
 /** E calls after a final screen/escape lease release, never before it. */
 refreshInventory(){this.pump();}
 /** Local completion only: never serialized and never confused with replay discard. */
 submit(goal:TerrainPreparedFieldGoal):Promise<TerrainPreparedFieldCompletion>{return new Promise(resolve=>{const task:PreparedTask={goal,fieldDone:resolve};if(this.stopped)this.finishField(task,'disposed');else this.replaceLatest(task);});}
 get retainedFieldOwners():readonly unknown[]{return[this.flight?.task.goal?.snapshot,this.latest?.goal?.snapshot];}
 private finishField(task:PreparedTask,outcome:TerrainPreparedFieldCompletion['outcome'],flight?:PreparedFlight,screen:TerrainPreparedScreen|null=null){
  if(!task.goal||task.fieldFinished)return;task.fieldFinished=true;const done=task.fieldDone;task.fieldDone=undefined;
  done?.(Object.freeze({goal:task.goal,outcome,binding:flight?.binding??null,capture:flight?{id:flight.capture.id,editSeries:flight.capture.editSeries,draftRevision:flight.capture.draftRevision}:null,screen}));
 }
 /** Supply as TerrainAuthorOptions.replay. No current()/load() function crosses wire. */
 replay=(input:TerrainAuthorReplayInput):Promise<TerrainAuthorReplayResult>=>new Promise((resolve,reject)=>{if(this.stopped){reject(Error('Terrainworker beendet.'));return;}this.replaceLatest({replay:input,resolve,reject});});
 private replaceLatest(task:PreparedTask){if(task.goal&&this.latest?.replay){this.finishField(task,'discarded');return;}const old=this.latest;this.latest=task;old?.reject?.(Error('Autorenarbeit ersetzt.'));if(old)this.finishField(old,'discarded');const flight=this.flight;if(flight&&flight.stage==='running'&&!flight.cancelling&&(!flight.task.replay||!!task.replay)){flight.cancelling=true;this.port.postMessage({...flight.binding,kind:'cancel',captureId:flight.capture.id},[]);}this.pump();}
 private ref(value:Float32Array|Float64Array|Uint8Array,stores:Map<number,ArrayBuffer>):TerrainPreparedView{const b=value.buffer as ArrayBuffer;let id=this.physicalIds.get(b);if(id===undefined){id=++this.inputSerial;this.physicalIds.set(b,id);}stores.set(id,b);return{buffer:id,kind:value instanceof Float64Array?'f64':value instanceof Float32Array?'f32':'u8',offset:value.byteOffset,length:value.length};}
 private page(p:TerrainAuthorPage,stores:Map<number,ArrayBuffer>){return{...p,values:this.ref(p.values,stores)};}
 private ground(g:TerrainAuthorGround,stores:Map<number,ArrayBuffer>){return{lattice:g.lattice,values:this.ref(g.values,stores)};}
 private seed(value:TerrainAuthorCheckpoint,stores:Map<number,ArrayBuffer>):TerrainPreparedSeedPayload{return{query:value.query,coverage:value.coverage,ground:value.ground.map(g=>this.ground(g,stores)),pages:value.pages.map(p=>this.page(p,stores))};}
 captureVisibility(screen:TerrainPreparedScreen,owner:string,series:number):TerrainAuthorVisibilityContext{const retained=this.retained.get(screen.basis.generation);terrainPreparedValidateScreen(screen);if(!retained||!terrainPreparedSameBasis(screen.basis,retained.basis))throw Error('Bestätigte Visibilitybasis fehlt.');if(retained.visibility?.owner===owner&&retained.visibility.series===series)return retained.visibility;return retained.visibility=Object.freeze({owner,series,source:Object.freeze({...retained.source}),sources:retained.water});}
 sourceIdentity(tile:AtlasSurfaceTile){const key=`${tile.tile.lod}/${tile.tile.x}/${tile.tile.y}`;let id=this.tileIds.get(key);if(id===undefined){id=++this.tileSerial;this.tileIds.set(key,id);}return id;}
 lattices(tiles:readonly AtlasSurfaceTile[]){return tiles.map(tile=>{const b=atlasTerrainTileQuery({tile:tile.tile,revision:tile.terrain.revision,product:'height'}).view.box;return{id:this.sourceIdentity(tile),x:b.x,y:b.y,dx:b.width/64,dy:b.height/64};});}
 private source(tile:AtlasSurfaceTile,stores:Map<number,ArrayBuffer>):TerrainPreparedSource{const id=this.sourceIdentity(tile);const grid=tile.terrain.projection.grid,c=tile.material.channels;return{id,source:{token:this.flight!.binding.target.token,fence:tile.terrain.fence,revision:tile.terrain.revision},...tile.tile,columns:65,rows:65,seaLevelM:grid.seaLevelM,height:this.ref(grid.heights,stores),ground:this.ref(grid.editing!.ground,stores),water:this.ref(grid.editing!.water,stores),materialWidth:tile.material.width,materialHeight:tile.material.height,material:Object.fromEntries(Object.entries(c).map(([name,value])=>[name,this.ref(value!,stores)]))};}
 private packet(stores:Map<number,ArrayBuffer>,maximum:number){const p=terrainPreparedTransport([...stores].map(([id,buffer])=>({id,buffer,mode:'copy' as const})),this.workerKnown,(_copy,transport)=>{if(transport>maximum)throw Error('Terrain-Eingabetransport benötigt getrennte kanonische Vorbereitung.');});for(const e of p.buffers)this.workerKnown.add(e.id);return p;}
 private inventoryEqual(a:TerrainPreparedInventory|null,b:TerrainPreparedInventory){return !!a&&a.retainedBases.length===b.retainedBases.length&&a.retainedBases.every(x=>b.retainedBases.some(y=>terrainPreparedSameBasis(x,y)))&&a.retainedBufferIds.length===b.retainedBufferIds.length&&a.retainedBufferIds.every(id=>b.retainedBufferIds.includes(id));}
 private pruneRetained(inventory:TerrainPreparedInventory){const ids=new Set(inventory.retainedBufferIds);this.buffers=new Map([...this.buffers].filter(([id])=>ids.has(id)));for(const [id]of this.retained)if(!inventory.retainedBases.some(b=>b.generation===id))this.retained.delete(id);}
 private beginRetain(inventory:TerrainPreparedInventory){
  for(const b of inventory.retainedBases)if(!this.workerBases.some(w=>terrainPreparedSameBasis(w,b)))throw Error('Freigegebene Terrain-Basis nicht wiederaufnehmbar.');
  const task=this.latest,input=task?.replay,goal=task?.goal,old=this.lastBinding;if(!old)return;
  const q=input?.initial.query,target=goal?.snapshot.source??(q?{token:q.token,fence:q.fence,revision:q.revision}:old.target),binding:TerrainPreparedBinding={epoch:this.epoch,job:++this.serial,operation:goal?.operation??input?.binding.content??old.operation,requestContent:goal?.requestContent??input?.binding.content??old.requestContent,target:{...target}};
  const snapshot={...inventory,retainedBases:inventory.retainedBases.map(b=>({...b})),retainedBufferIds:[...inventory.retainedBufferIds]},control={binding,captureId:++this.captureSerial,controlId:++this.controlSerial,inventory:snapshot};this.control=control;
  this.port.postMessage({...binding,kind:'retain',captureId:control.captureId,controlId:control.controlId,retainedBases:snapshot.retainedBases,retainedBufferIds:snapshot.retainedBufferIds},[]);
 }
 private pump(){if(this.stopped||this.flight||this.control)return;try{const inventory=this.inventory();terrainPreparedValidateInventory(inventory);if(this.acknowledged&&!this.inventoryEqual(this.acknowledged,inventory)){this.beginRetain(inventory);return;}if(this.latest?.goal?.kind==='prepare'&&this.workerBases.length+1>2)return;}catch(error){this.fail(error);return;}if(!this.latest)return;const task=this.latest;this.latest=null;const input=task.replay,goal=task.goal;if(input&&!input.current()){task.reject?.(Error('Autorenarbeit ersetzt.'));this.pump();return;}
  try{if(goal?.kind==='prepare'&&goal.basis&&(!goal.screen||goal.screen.alpha!==1||!goal.screen.endFrame))throw Error('Bestätigter Materialendframe vor Basiswechsel fehlt.');if(goal?.basis){if(!this.workerBases.some(b=>terrainPreparedSameBasis(b,goal.basis!))||!goal.screen||!terrainPreparedSameBasis(goal.basis,goal.screen.basis))throw Error('Terrain-Ausgangsbasis vor Kopie nicht gehalten.');terrainPreparedValidateScreen(goal.screen);}const stores=new Map<number,ArrayBuffer>(),snapshot=goal?.snapshot,initial=input?.initial,target=snapshot?.source??{token:initial!.query.token,fence:initial!.query.fence,revision:initial!.query.revision},binding:TerrainPreparedBinding={epoch:this.epoch,job:++this.serial,operation:goal?.operation??input!.binding.content,requestContent:goal?.requestContent??input!.binding.content,target:{...target}};
   const capture:TerrainPreparedCapture={id:++this.captureSerial,owner:snapshot?.owner??input!.binding.owner,editSeries:snapshot?.series??input!.binding.series,draftRevision:snapshot?.content??input!.binding.content,prefix:snapshot?.prefix??initial!.query.prefix,source:target,ground:[],basis:[],bands:[],suffix:(snapshot?.suffix??input!.suffix).map(e=>{if(e.action.kind!=='landscape-height-stroke')throw Error('Höhenreplay benötigt.');return{id:e.id,ordinal:e.ordinal,stroke:e.action.stroke};}),active:(snapshot?.active??input?.active)?(()=>{const a=(snapshot?.active??input!.active)!;return{id:a.id,stroke:a.action.stroke,closing:a.closing};})():null,sources:[]};
   const flight:PreparedFlight={task,binding,capture,stage:'running',cancelling:false,poll:null};this.flight=flight;this.lastBinding=binding;
   let request:TerrainPreparedRequest;const inventory=this.inventory();
   if(input){const contexts=[...input.suffix.flatMap(entry=>{const context=input.visibilityContexts?.get(entry);return context?[{entry,context}]:[];}),...(input.active?.visibility?[{entry:null,context:input.active.visibility}]:[])];const replayCapture={...capture,visibilityContexts:contexts.map(({entry,context})=>({gesture:entry?.id??input.active!.id,ordinal:entry?.ordinal??null,owner:context.owner,editSeries:context.series,source:context.source,sources:context.sources.map(s=>({...s,water:this.ref(s.water,stores)}))}))};flight.capture=replayCapture;request={...binding,kind:'replay',capture:replayCapture,initial:this.seed(initial!,stores),inventory,buffers:[]};}
   else{const fieldCapture={...capture,landColor:goal!.landColor,ground:snapshot!.ground.map(g=>this.ground(g,stores)),sources:goal!.kind==='draft'?[]:goal!.tiles.map(t=>this.source(t,stores))};flight.capture=fieldCapture;
    if(goal!.kind==='draft'){if(!goal!.basis||!goal!.screen)throw Error('Bestätigte Draftbasis fehlt.');request={...binding,kind:'draft',basis:goal!.basis,frozen:goal!.screen,capture:fieldCapture,inventory,buffers:[]};}
    else request={...binding,kind:'prepare',from:goal!.basis,fromEnd:goal!.screen,capture:fieldCapture,request:goal!.request,camera:goal!.camera,complete:goal!.complete,inventory,buffers:[],...(goal!.commitThrough?{commitThrough:goal!.commitThrough}:{})};
   }
   // Only backingstores missing in this exact worker epoch are copied. If a
   // replay seed/union is too large, the canonical window protocol is required;
   // the author gesture remains in A and is never acknowledged or dropped here.
   const packet=this.packet(stores,40*1024*1024);request={...request,buffers:packet.buffers};this.port.postMessage(request,packet.transfer);if(input)this.poll(flight);
  }catch(error){if(!this.flight)this.finishField(task,'failed');this.fail(error);}
 }
 private poll(flight:PreparedFlight){flight.poll=setTimeout(()=>{flight.poll=null;if(this.stopped||this.flight!==flight||flight.stage!=='running')return;if(flight.task.replay&&!flight.task.replay.current()&&!flight.cancelling){flight.cancelling=true;this.port.postMessage({...flight.binding,kind:'cancel',captureId:flight.capture.id},[]);}this.poll(flight);},4);}
 private clearPoll(flight:PreparedFlight){if(flight.poll!==null)clearTimeout(flight.poll);flight.poll=null;}
 private async receive(reply:TerrainPreparedResponse){if(this.stopped)return;const control=this.control;
  if(control&&terrainPreparedSameBinding(reply,control.binding)&&reply.captureId===control.captureId){try{if(reply.kind==='failed')throw Error(reply.message);if(reply.kind!=='retained'||reply.controlId!==control.controlId)return;
    if(reply.actualBases.length!==control.inventory.retainedBases.length||reply.actualBases.some(b=>!control.inventory.retainedBases.some(r=>terrainPreparedSameBasis(b,r))))throw Error('Terrain-Retainabschluss verändert.');
    const live=this.inventory();terrainPreparedValidateInventory(live);if(live.retainedBases.some(b=>!control.inventory.retainedBases.some(r=>terrainPreparedSameBasis(b,r))))throw Error('Terrain-Retainlease vor Abschluss verletzt.');
    this.workerKnown=new Set(reply.workerBufferIds);this.workerBases=reply.actualBases.map(b=>({...b}));this.acknowledged=control.inventory;this.pruneRetained(control.inventory);this.control=null;this.pump();return;
   }catch(error){this.fail(error);return;}}
  if(reply.kind==='retained')return;const f=this.flight;if(!f||!terrainPreparedSameBinding(reply,f.binding)||reply.captureId!==f.capture.id)return;
  try{if(reply.kind==='settled'){if(f.stage!=='settling')return;this.workerKnown=new Set(reply.workerBufferIds);this.acknowledged=f.settledInventory!;this.workerBases=this.acknowledged.retainedBases.map(b=>({...b}));this.flight=null;this.finishField(f.task,'settled',f,f.settledScreen??null);for(const observer of this.settleObservers)observer(f.settledScreen??null,f.binding);this.pump();return;}
   if(reply.kind==='cancelled'){if(!f.cancelling)return;const live=this.inventory();terrainPreparedValidateInventory(live);if(live.retainedBases.some(b=>!this.workerBases.some(w=>terrainPreparedSameBasis(w,b))))throw Error('Terrain-Cancellease vor Abschluss verletzt.');this.pruneRetained(live);this.workerKnown=new Set(reply.workerBufferIds);this.clearPoll(f);f.task.reject?.(Error('Autorenarbeit ersetzt.'));this.flight=null;this.finishField(f.task,'cancelled',f);this.pump();return;}
   if(reply.kind==='failed'){if(reply.code==='visibility'&&f.task.replay){this.clearPoll(f);this.workerKnown=new Set(reply.workerBufferIds);const error=Error(reply.message);f.task.reject?.(error);this.flight=null;this.failed(error);this.pump();return;}throw Error(reply.message);}
   if(reply.kind==='seed-needed'){this.workerKnown=new Set(reply.workerBufferIds);const input=f.task.replay;if(!input||!input.current()||f.cancelling)return;const action=input.suffix.find(e=>e.id===reply.gesture)?.action??(input.active?.id===reply.gesture?input.active.action:null);if(!action||action.kind!=='landscape-height-stroke')throw Error('Unveränderlicher Replaycapture fehlt.');let seed:TerrainAuthorCheckpoint;try{seed=await input.load(action.stroke);}catch(error){if(this.stopped||this.flight!==f||f.cancelling||!input.current()){if(this.flight===f&&!f.cancelling){f.cancelling=true;this.port.postMessage({...f.binding,kind:'cancel',captureId:f.capture.id},[]);}return;}throw error;}if(this.stopped||this.flight!==f||f.cancelling||!input.current())return;const stores=new Map<number,ArrayBuffer>(),payload=this.seed(seed,stores),packet=this.packet(stores,40*1024*1024);this.port.postMessage({...f.binding,kind:'seed',captureId:f.capture.id,request:reply.request,...payload,buffers:packet.buffers},packet.transfer);return;}
   if(f.cancelling)return;this.clearPoll(f);const decoded=terrainPreparedBufferTable(reply.buffers,this.buffers,160*1024*1024),table=decoded.table;if(decoded.transportBytes!==reply.transportBytes)throw Error('Terrain-Transportzählung verändert.');
   if(reply.kind==='author-result'){if(!f.task.replay?.current()){f.task.reject?.(Error('Autorenarbeit ersetzt.'));this.settle(f,'discarded',null,this.inventory());return;}terrainPreparedValidateAuthorResult(reply,f.binding,f.capture,table);
    const result={ground:reply.ground.map(g=>({lattice:g.lattice,values:terrainPreparedView(g.values,table) as Float64Array})),basis:reply.basis.map(p=>({...p,values:terrainPreparedView(p.values,table) as Float32Array})),bands:reply.bands.map(p=>({...p,values:terrainPreparedView(p.values,table) as Float32Array}))};
    this.authorResult=result;for(const e of reply.buffers){this.physicalIds.set(e.buffer,e.id);this.workerKnown.add(e.id);}f.task.resolve?.(result);this.settle(f,'discarded',null,this.inventory());return;
   }
   const retained=this.retained.get(reply.basis.generation);terrainPreparedValidateResult(reply,f.binding,f.capture,table,retained);
   if(reply.geometry)this.retained.set(reply.basis.generation,{basis:reply.basis,vertices:reply.geometry.vertices.length/14,sourceIds:reply.geometry.newSources.map(s=>s.id),source:{...f.binding.target},water:Object.freeze(f.task.goal!.tiles.map(t=>Object.freeze({id:this.sourceIdentity(t),...t.tile,seaLevelM:t.terrain.projection.grid.seaLevelM,water:t.terrain.projection.grid.editing!.water})))});
   this.buffers=table;f.stage='staging';const screen=await this.apply({result:reply,expected:f.binding,capture:{id:f.capture.id,editSeries:f.capture.editSeries,draftRevision:f.capture.draftRevision},buffers:table});
   if(this.stopped||this.flight!==f||f.cancelling)return;this.settle(f,'screen-confirmed',screen,this.inventory());
  }catch(error){if(this.stopped||this.flight!==f||f.cancelling)return;this.fail(error);}
 }
 private settle(f:PreparedFlight,outcome:'screen-confirmed'|'discarded',screen:TerrainPreparedScreen|null,inventory:TerrainPreparedInventory){if(this.flight!==f)return;this.port.postMessage({...f.binding,kind:'settle',captureId:f.capture.id,outcome,screen,retainedBases:inventory.retainedBases,retainedBufferIds:inventory.retainedBufferIds},[]);this.pruneRetained(inventory);f.settledInventory={...inventory,retainedBases:inventory.retainedBases.map(b=>({...b})),retainedBufferIds:[...inventory.retainedBufferIds]};f.settledScreen=screen;f.stage='settling';}
 private fail(value:unknown){if(this.stopped)return;const error=value instanceof Error?value:Error(String(value));this.flight?.task.reject?.(error);this.latest?.reject?.(error);if(this.flight)this.finishField(this.flight.task,'failed',this.flight);if(this.latest)this.finishField(this.latest,'failed');this.dispose();this.failed(error);}
 dispose(){if(this.stopped)return;this.stopped=true;if(this.flight)this.clearPoll(this.flight);this.flight?.task.reject?.(Error('Terrainworker beendet.'));this.latest?.reject?.(Error('Terrainworker beendet.'));const flight=this.flight,latest=this.latest;this.flight=null;this.control=null;this.latest=null;if(flight)this.finishField(flight.task,'disposed',flight);if(latest)this.finishField(latest,'disposed');this.buffers.clear();this.workerKnown.clear();this.authorResult=null;this.retained.clear();this.settleObservers.clear();this.port.onmessage=this.port.onerror=this.port.onmessageerror=null;this.port.terminate();}
}

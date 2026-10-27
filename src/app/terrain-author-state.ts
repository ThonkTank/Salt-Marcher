import {terrainAuthorGroundSample,terrainAuthorVisibility,terrainAuthorWater,validateTerrainAuthorVisibility,type TerrainAuthorVisibilityContext} from './terrain-author-visibility';
import {TerrainStrokeQueue,TerrainStrokeJournal,type TerrainQueueCapture,type TerrainQueueRecovery,type TerrainQueueAbsence} from './terrain-stroke-queue';
import {decodeTerrainAuthorCheckpoint,terrainAuthorWindow,type TerrainAuthorSource,type TerrainAuthorReceipt,type TerrainAuthorLattice,type TerrainAuthorPage,type TerrainAuthorGround,type TerrainAuthorQuery,type TerrainAuthorCheckpoint} from './terrain-author-checkpoint';
import {applyTerrainBrush,heightBrushPixel,validateHeightStroke,type HeightStroke} from './terrain-brush';
import {strokeBox} from './land-mask';
import {decodeHeights,heightRecord,TerrainSampler} from './terrain-height';
import type {LandscapeRecord} from './atlas-landscape';
import type {AtlasCommitAck} from './campaign-atlas-contracts';
import type {TerrainLiveAction,TerrainLiveContext} from './terrain-live-stroke';

export interface TerrainAuthorGesture {readonly id:string;readonly action:Extract<TerrainLiveAction,{kind:'landscape-height-stroke'}>;readonly closing:boolean;readonly visibility?:TerrainAuthorVisibilityContext}
export interface TerrainAuthorSnapshot {
 readonly owner:string;readonly series:number;readonly content:number;
 readonly source:TerrainAuthorSource;readonly prefix:number;
 readonly ground:readonly TerrainAuthorGround[];readonly basis:readonly TerrainAuthorPage[];
 readonly bands:readonly TerrainAuthorPage[];readonly suffix:readonly TerrainQueueCapture[];
 readonly active:TerrainAuthorGesture|null;
}
export interface TerrainAuthorReplayInput {
 readonly binding:{readonly owner:string;readonly series:number;readonly content:number};
 readonly initial:TerrainAuthorCheckpoint;readonly visibilityContexts?:ReadonlyMap<TerrainQueueCapture,TerrainAuthorVisibilityContext>;readonly suffix:readonly TerrainQueueCapture[];readonly active:TerrainAuthorGesture|null;
 /** C supplies bounded continuations and must check this before/after every yield. */
 current():boolean;
 load(stroke:HeightStroke):Promise<TerrainAuthorCheckpoint>;
}
export interface TerrainAuthorReplayResult {ground:TerrainAuthorGround[];basis:TerrainAuthorPage[];bands:TerrainAuthorPage[]}
export interface TerrainAuthorRecovery {readonly author:TerrainAuthorState;readonly queue:TerrainQueueRecovery;readonly owner:string;readonly series:number;readonly version:number;readonly operation:number;readonly window:number;readonly active:TerrainAuthorGesture|null;readonly retired:boolean}
export interface TerrainAuthorOptions {
 owner:string;series:number;source:TerrainAuthorSource;lattices:readonly TerrainAuthorLattice[];
 read(query:TerrainAuthorQuery):Promise<TerrainAuthorCheckpoint>;
 write(action:TerrainLiveAction,context:TerrainLiveContext):Promise<{ack:AtlasCommitAck;receipt:TerrainAuthorReceipt}>;
 replay?:(input:TerrainAuthorReplayInput)=>Promise<TerrainAuthorReplayResult>;
}
const key=(p:Pick<TerrainAuthorPage,'x'|'y'|'pixel'>)=>`${p.pixel}:${p.x},${p.y}`;
const clonePages=(pages:readonly TerrainAuthorPage[])=>pages.map(p=>({...p,values:p.values.slice()}));
function capture(id:string,stroke:HeightStroke,closing=false,visibility?:TerrainAuthorVisibilityContext):TerrainAuthorGesture{
 validateHeightStroke(stroke);const action=structuredClone({kind:'landscape-height-stroke' as const,stroke});
 const freeze=(x:object)=>{Object.freeze(x);for(const v of Object.values(x))if(v&&typeof v==='object')freeze(v);};freeze(action);return Object.freeze({id,action,closing,...(visibility?{visibility}:{})});
}
/** One durable author owner. Desired input changes immediately; the public
 * numerical snapshot changes only through one complete validated installation.
 * No raster, GPU, UI lifetime or screen acknowledgement owns this object. */
export class TerrainAuthorState {
 readonly journal=new TerrainStrokeJournal();
 readonly queue:TerrainStrokeQueue;
 private desired:TerrainAuthorGesture|null=null;
 private visibilityContexts=new Map<TerrainQueueCapture,TerrainAuthorVisibilityContext>();
 private visibilityValidated=new WeakSet<object>();
 private beginning:{snapshot:TerrainAuthorSnapshot;version:number;window:number;entries:readonly TerrainQueueCapture[]}|null=null;
 private window=0;
 private version=0;
 private operation=0;
 private request=0;
 private targetPrefix=0;
 private lastStroke:HeightStroke|undefined;
 private retired=false;
 private target:TerrainAuthorSource;
 private running:Promise<TerrainAuthorSnapshot|null>|null=null;
 private acknowledging:{source:TerrainAuthorSource;done:Promise<void>}|null=null;
 private replayOwners:unknown[]=[];
 private refreshing:Promise<TerrainAuthorSnapshot|null>|null=null;
 private capacityWait:{capture:TerrainAuthorGesture;controller:AbortController}|null=null;
 private lastReceipt:TerrainAuthorReceipt|undefined;
 private installed:TerrainAuthorSnapshot;
 constructor(private options:TerrainAuthorOptions){
  terrainAuthorWindow({...options.source,owner:options.owner,series:options.series,request:0,prefix:0,box:{x:0,y:0,width:0,height:0},pixel:1,lattices:options.lattices});
  this.options={...options,source:{...options.source},lattices:options.lattices.map(l=>({...l}))};this.target={...options.source};
  this.installed={owner:options.owner,series:options.series,content:0,source:{...this.target},prefix:0,ground:[],basis:[],bands:[],suffix:[],active:null};
  this.queue=new TerrainStrokeQueue({expectedRevision:this.target.revision,sourceFence:this.target.fence},async(a,c)=>{
   this.assertLive();const writing=(async()=>{const v=await this.options.write(a,c);this.assertLive();
    if(v.ack.commandId!==v.receipt.commandId||!v.ack.sourceFence||v.ack.revision<c.expectedRevision)throw Error('Autorenbestätigung prüfen.');
    this.target={token:this.target.token,fence:v.ack.sourceFence,revision:v.ack.revision};this.lastReceipt={...v.receipt};this.targetPrefix=this.journal.prefix+1;this.version++;return v.ack;
   })();const barrier=writing.then(()=>{});void barrier.catch(()=>{});
   const acknowledging={source:{token:this.target.token,fence:c.sourceFence,revision:c.expectedRevision},done:barrier};this.acknowledging=acknowledging;
   try{return await writing;}finally{if(this.acknowledging===acknowledging)this.acknowledging=null;}
  },(ack,entry)=>this.checkpoint(ack,entry),this.journal);
 }
 /** Borrowed immutable numerical view; copy before transfer or mutation. */
 get snapshot():TerrainAuthorSnapshot{return this.installed;}
 get canonicalSource():TerrainAuthorSource{return{...this.target};}
 /** Local diagnostic roots only; never serialize this graph. */
 get retainedOwners():readonly unknown[]{return[this.installed,this.beginning,this.desired,this.visibilityContexts,this.journal.entries,this.replayOwners];}
 get active(){return this.desired;}
 get windowGeneration(){return this.window;}
 /** Change desired numerical coverage atomically; installation still occurs
  * only after the complete bound read/replay. Accepted captures do not move. */
 changeLattices(lattices:readonly TerrainAuthorLattice[]):Promise<boolean>{
  this.assertLive();terrainAuthorWindow({...this.target,owner:this.options.owner,series:this.options.series,request:0,prefix:0,box:{x:0,y:0,width:0,height:0},pixel:1,lattices});
  if(JSON.stringify(lattices)===JSON.stringify(this.options.lattices))return Promise.resolve(false);
  this.options={...this.options,lattices:lattices.map(l=>({...l}))};this.window++;this.operation++;this.version++;
  return this.refresh().then(Boolean);
 }
 get failed(){return this.journal.frozen;}
 captureRecovery():TerrainAuthorRecovery|null{const queue=this.queue.captureRecovery();return queue?Object.freeze({author:this,queue,owner:this.options.owner,series:this.options.series,version:this.version,operation:this.operation,window:this.window,active:this.desired,retired:this.retired}):null;}
 recoveryCurrent(b:TerrainAuthorRecovery){return b.author===this&&b.owner===this.options.owner&&b.series===this.options.series&&b.version===this.version&&b.operation===this.operation&&b.window===this.window&&b.active===this.desired&&b.retired===this.retired&&this.queue.recoveryCurrent(b.queue);}
 recoverApplied(b:TerrainAuthorRecovery,source:TerrainAuthorSource,ack:AtlasCommitAck,receipt:TerrainAuthorReceipt,current:()=>boolean,beforeCommit:()=>Promise<void>,adopted:()=>void):Promise<void>{
  const valid=()=>!this.retired&&this.recoveryCurrent(b)&&current();
  if(!valid()||source.token!==this.target.token||source.revision!==b.queue.source.expectedRevision+1||ack.commandId!==receipt.commandId||ack.revision!==source.revision||ack.sourceFence!==source.fence)throw Error('Speicherklärung gehört nicht zum gehaltenen Autorenpräfix.');
  return this.queue.recoverApplied(b.queue,ack,async()=>{
   const action=b.queue.head.action;if(action.kind!=='landscape-height-stroke'||!valid())throw Error('Höhenpräfix inzwischen geändert.');let candidate:TerrainAuthorSnapshot|undefined;
   const ok=await this.rebuild(action.stroke,b.queue.head.ordinal,receipt,{source,current:valid,stage:s=>{candidate=s;}});if(!ok||!candidate||!valid())throw Error('Speicherklärung inzwischen geändert.');
   await beforeCommit();if(!valid())throw Error('Speicherklärung inzwischen geändert.');
   this.target={...source};this.lastReceipt={...receipt};this.targetPrefix=b.queue.head.ordinal;this.version++;this.installed={...candidate,content:this.version};this.visibilityContexts.delete(b.queue.head);
  },adopted);
 }
 discardRecovery(b:TerrainAuthorRecovery,unwritten:readonly TerrainQueueCapture[],absence?:TerrainQueueAbsence){if(!this.recoveryCurrent(b)||absence&&absence.command.token!==this.target.token)throw Error('Gehaltene Züge inzwischen geändert.');if(absence)this.queue.discardUnapplied(b.queue,unwritten,absence);else this.queue.discardApplied(b.queue,unwritten);this.capacityWait?.controller.abort();this.capacityWait=null;this.desired=null;this.beginning=null;this.visibilityContexts.clear();this.operation++;this.version++;}

 private assertLive(){if(this.retired||this.journal.frozen)throw this.journal.failure??Error('Autorenbesitzer inzwischen geändert.');}
 /** Retain uncertain accepted input; retirement invalidates work, never acknowledges it. */
 retire(){this.retired=true;this.operation++;this.version++;this.journal.freeze(Error('Autorenbesitzer inzwischen geändert.'));}
 begin(id:string,stroke:HeightStroke,visibility?:TerrainAuthorVisibilityContext){this.assertLive();if(stroke.visibility){if(!visibility)throw Error('Autoren-Visibilitykontext fehlt.');validateTerrainAuthorVisibility(visibility,this.options.owner,this.options.series,source=>this.visibilityValidated.has(visibility)||JSON.stringify(source)===JSON.stringify(this.options.source)||JSON.stringify(source)===JSON.stringify(this.target));this.visibilityValidated.add(visibility);}if(this.desired||!id||this.journal.entries.some(e=>e.id===id))throw Error('Aktiver Pinselzug prüfen.');this.operation++;this.beginning={snapshot:this.installed,version:this.version,window:this.window,entries:this.journal.entries};this.desired=capture(id,stroke,false,visibility);this.lastStroke=this.desired.action.stroke;this.version++;return this.desired;}
 update(id:string,stroke:HeightStroke){this.assertLive();if(this.desired?.id!==id||this.desired.closing)throw Error('Aktiver Pinselzug inzwischen geändert.');this.desired=capture(id,stroke,false,this.desired.visibility);this.version++;}
 escape(id:string){
  this.assertLive();if(this.desired?.id!==id)throw Error('Aktiver Pinselzug inzwischen geändert.');
  if(this.capacityWait?.capture===this.desired){this.capacityWait.controller.abort();this.capacityWait=null;}
  this.desired=null;this.operation++;this.version++;const beginning=this.beginning;this.beginning=null;
  const s=beginning?.snapshot,entries=this.journal.entries;
  if(s&&beginning!.window===this.window&&s.ground.length&&s.active===null&&s.content===beginning!.version&&s.prefix===this.targetPrefix&&s.source.fence===this.target.fence&&s.source.token===this.target.token&&s.source.revision===this.target.revision&&entries.length===beginning!.entries.length&&entries.every((e,i)=>e===beginning!.entries[i])){
   this.installed={...s,content:this.version,active:null};return Promise.resolve(true);
  }
  return this.refresh().then(Boolean);
 }
 async close(id:string){
  this.assertLive();if(this.desired?.id!==id||this.desired.closing)throw Error('Aktiver Pinselzug inzwischen geändert.');
  const active=this.desired,closing=Object.freeze({...active,closing:true});this.desired=closing;this.version++;
  if(this.journal.size>=32){
   const wait={capture:closing,controller:new AbortController()};this.capacityWait=wait;
   try{if(!await this.journal.capacity(wait.controller.signal))return;}
   finally{if(this.capacityWait===wait)this.capacityWait=null;}
  }this.assertLive();
  if(this.desired!==closing)return;
  // Capture and remove active input synchronously; a checkpoint can observe
  // either side, never a missing or duplicated gesture.
  const completion=this.queue.enqueue(active.action,id),entry=this.journal.entries.find(e=>e.id===id);if(entry&&active.visibility)this.visibilityContexts.set(entry,active.visibility);this.desired=null;this.beginning=null;this.version++;await completion;this.assertLive();
 }
 private query(stroke:HeightStroke,source:TerrainAuthorSource,prefix:number,receipt?:TerrainAuthorReceipt):TerrainAuthorQuery{
  const q={...source,owner:this.options.owner,series:this.options.series,request:++this.request,prefix,box:strokeBox(stroke),pixel:heightBrushPixel(stroke.radius),lattices:this.options.lattices.map(l=>({...l})),...(receipt?{receipt:{...receipt}}:{})};terrainAuthorWindow(q);return q;
 }
 private async checkpoint(_ack:AtlasCommitAck,entry:TerrainQueueCapture){
  this.assertLive();if(entry.ordinal!==this.journal.prefix+1)throw Error('Autorenpräfix inzwischen geändert.');
  const action=entry.action;if(action.kind!=='landscape-height-stroke')throw Error('Höhencheckpoint benötigt.');
  // Input operations can replace a replay while storage prefix stays pinned.
  // Retry only that current owner state; retirement/unknown still throws.
  for(;;){const ok=await this.rebuild(action.stroke,entry.ordinal,this.lastReceipt);this.assertLive();if(ok){this.visibilityContexts.delete(entry);return;}}
 }
 /** Finish one immutable capture even while the same gesture keeps changing.
  * The caller receives this exact installation, never a later mutable lookup. */
 refresh():Promise<TerrainAuthorSnapshot|null>{
  this.assertLive();if(this.refreshing)return this.refreshing;
  const task=(async()=>{
   for(;;){
    const last=this.journal.entries.at(-1)?.action,selected=this.desired?.action.stroke??(last?.kind==='landscape-height-stroke'?last.stroke:this.lastStroke);
    if(!selected)return null;
    const snapshot=await this.rebuild(selected,this.targetPrefix,this.lastReceipt);
    if(this.retired||this.journal.frozen)return null;
    if(snapshot)return snapshot;
   }
  })();this.refreshing=task;
  const clear=()=>{if(this.refreshing===task)this.refreshing=null;};void task.then(clear,clear);return task;
 }
 private async rebuild(stroke:HeightStroke,prefix:number,receipt?:TerrainAuthorReceipt,recovery?:{source:TerrainAuthorSource;current:()=>boolean;stage:(s:TerrainAuthorSnapshot)=>void}):Promise<TerrainAuthorSnapshot|null>{
  // Exactly one read/replay in this owner; callers coalesce behind it. C may
  // replace replay with the existing modelworker's invalidatable continuation.
  const source={...(recovery?.source??this.target)},operation=this.operation,window=this.window,sameSource=()=>recovery?recovery.current():this.window===window&&this.operation===operation&&!this.retired&&!this.journal.frozen&&this.target.token===source.token&&this.target.fence===source.fence&&this.target.revision===source.revision;
  while(this.running){await this.running;if(!recovery)this.assertLive();if(!sameSource())return null;}
  if(!recovery&&prefix!==this.targetPrefix||!sameSource())return null;
  if(this.installed.prefix===prefix&&this.installed.content===this.version&&this.installed.source.fence===source.fence&&this.installed.source.revision===source.revision&&this.installed.source.token===source.token)return this.installed;
  const run=(async()=>{
   while(sameSource()){
    const version=this.version,suffix=this.journal.entries.filter(e=>e.ordinal>prefix),active=this.desired;
    // A newer dose of this same live gesture is a following request, not a
    // reason to kill this finite immutable replay. Structural changes still
    // invalidate it, including Close's active→journal transition.
    const current=()=>sameSource()&&(recovery?this.version===version:
     this.targetPrefix===prefix&&this.desired?.id===active?.id&&this.desired?.closing===active?.closing&&
     this.journal.entries.filter(e=>e.ordinal>prefix).length===suffix.length&&
     this.journal.entries.filter(e=>e.ordinal>prefix).every((e,i)=>e===suffix[i]));
    let initialSeed:TerrainAuthorCheckpoint|null=null,seedReused=false;
    const canonicalQuery=(s:HeightStroke)=>JSON.stringify({...source,owner:this.options.owner,series:this.options.series,prefix,box:strokeBox(s),pixel:heightBrushPixel(s.radius),lattices:this.options.lattices,...(receipt?{receipt}: {})});
    const load=async(s:HeightStroke)=>{if(!current())throw Error('Autorenarbeit ersetzt.');
     if(initialSeed&&!seedReused){const {query}=initialSeed,canonical=Object.fromEntries(Object.entries(query).filter(([key])=>key!=='request'));
      if(JSON.stringify(canonical)===canonicalQuery(s)){seedReused=true;return initialSeed;}}
     const q=this.query(s,source,prefix,receipt);const expected=structuredClone(q);let raw:TerrainAuthorCheckpoint;
     try{raw=await this.options.read(q);}catch(error){
      // A committed write may precede its durable receipt cleanup. Only an
      // overlapping own write can replace this failed, older source read;
      // its target/version changes before the normal checkpoint starts.
      const barrier=!recovery&&this.acknowledging;
      if(current()&&barrier&&barrier.source.token===source.token&&barrier.source.fence===source.fence&&barrier.source.revision===source.revision)try{await barrier.done;}catch{/* The unchanged binding below keeps a real read/write failure fatal. */}
      throw error;
     }if(!current())throw Error('Autorenarbeit ersetzt.');return decodeTerrainAuthorCheckpoint(raw,expected);};
    try{
     const initial=await load(stroke);if(!current())continue;initialSeed=initial;this.replayOwners=[initial,suffix,active];
     const value=await(this.options.replay??replayTerrainAuthor)({binding:{owner:this.options.owner,series:this.options.series,content:version},initial,suffix,active,visibilityContexts:new Map(suffix.flatMap(entry=>{const context=this.visibilityContexts.get(entry);return context?[[entry,context] as const]:[];})),current,load});if(!current())continue;
     if(value.ground.length!==this.options.lattices.length||value.ground.some((g,i)=>JSON.stringify(g.lattice)!==JSON.stringify(this.options.lattices[i])||g.values.length!==4225||!g.values.every(v=>Number.isFinite(v)&&Math.abs(v)<=116e6)))throw Error('Autorenreplay prüfen.');
     const installed=Object.freeze({owner:this.options.owner,series:this.options.series,content:version,source,prefix,ground:value.ground,basis:value.basis,bands:value.bands,suffix,active});if(recovery)recovery.stage(installed);else this.installed=installed;return installed;
    }catch(error){if(!sameSource())return null;if(!current())continue;throw error;}
   }return null;
  })();this.running=run;try{return await run;}finally{if(this.running===run){this.running=null;this.replayOwners=[];}}
 }
}

/** Interim shared-kernel replay. It is asynchronous/invalidatable at its
 * boundaries, not a responsiveness pass; C supplies bounded inner-loop steps. */
export async function replayTerrainAuthor(input:TerrainAuthorReplayInput):Promise<TerrainAuthorReplayResult>{
 let ground=input.initial.ground.map(g=>({lattice:{...g.lattice},values:g.values.slice()})),basis=clonePages(input.initial.pages);
 const overlay=new Map<string,TerrainAuthorPage>();
 const operations=[...input.suffix.map(e=>({action:e.action,visibility:input.visibilityContexts?.get(e)})),...(input.active?[{action:input.active.action,visibility:input.active.visibility}]:[])];
 const sample=(p:{x:number;y:number})=>terrainAuthorGroundSample(ground,p);
 for(const operation of operations){const {action,visibility:context}=operation;
  if(action.kind!=='landscape-height-stroke')throw Error('Höhenreplay benötigt.');
  if(action.stroke.visibility){if(!context)throw Error('Autoren-Visibilitykontext fehlt.');validateTerrainAuthorVisibility(context,input.binding.owner,input.binding.series,source=>source.token===input.initial.query.token&&source.revision<=input.initial.query.revision);}
  const seed=await input.load(action.stroke);if(!input.current())throw Error('Autorenarbeit ersetzt.');basis=clonePages(seed.pages);
  const before:LandscapeRecord[]=basis.filter(p=>Math.abs(p.x)<=1e12&&Math.abs(p.y)<=1e12).map(p=>{const v=overlay.get(key(p))??p;return heightRecord(v.x,v.y,v.pixel,v.values,2);});
  const p0=new TerrainSampler(before,false),visible=action.stroke.visibility?terrainAuthorVisibility(ground,action.stroke.visibility,terrainAuthorWater(context!)):undefined,edited=applyTerrainBrush(before,action.stroke,undefined,visible,sample,true),after=new Map(before.map(r=>[r.id,r]));
  for(const r of edited){after.set(r.id,r);const h=r.height!;overlay.set(key(h),{x:h.x,y:h.y,pixel:h.pixel,revision:r.revision,values:decodeHeights(h).slice()});}
  const p1=new TerrainSampler([...after.values()],false);
  ground=ground.map(g=>{const values=g.values.slice(),l=g.lattice;for(let y=0;y<65;y++)for(let x=0;x<65;x++){const p={x:l.x+x*l.dx,y:l.y+y*l.dy};values[y*65+x]=values[y*65+x]!+p1.sample(p).heightM-p0.sample(p).heightM;}return{lattice:g.lattice,values};});
 }
 return{ground,basis,bands:[...overlay.values()]};
}

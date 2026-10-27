import {AtlasTerrainPreparedClient,terrainModelBytes,type TerrainPreparedDelivery,type TerrainPreparedFieldGoal} from './atlas-terrain-model-client';
import {TerrainAuthorState,type TerrainAuthorOptions,type TerrainAuthorSnapshot} from './terrain-author-state';
import {terrainAuthorWindow,type TerrainAuthorSource} from './terrain-author-checkpoint';
import type {AtlasDeckSurface} from './atlas-deck-surface';
import type {AtlasSurfaceTile} from './atlas-surface-tile-stream';
import type {TerrainPreparedBinding,TerrainPreparedPort,TerrainPreparedScreen} from './atlas-terrain-prepared-contract';
import type {TerrainStyle} from './terrain-relief';
import type {HeightStroke} from './terrain-brush';
import type {TerrainLiveAction} from './terrain-live-stroke';
import {terrainTraceStart} from './terrain-timing';
type TargetView=Pick<TerrainPreparedFieldGoal,'tiles'|'request'|'camera'|'complete'>;
type Escape=ReturnType<AtlasDeckSurface['capturePreparedEscape']>;
interface Applying {binding:TerrainPreparedBinding;content:number;drawn:boolean;tiles:readonly AtlasSurfaceTile[]|null}
/** Presentation bindings and leases only. A owns accepted input; C owns the
 * single worker and its single continuation/latest position. */
export class AtlasTerrainPreparedSession {
 readonly client:AtlasTerrainPreparedClient;readonly author:TerrainAuthorState;
 private operation=0;private disposed=false;private activeId:string|null=null;
 private tiles:readonly AtlasSurfaceTile[];private style:Readonly<TerrainStyle>;
 private frozen:TerrainPreparedScreen|null=null;private escape:Escape|null=null;
 private waiter:{content:number;resolve:(s:TerrainPreparedScreen)=>void;reject:(e:Error)=>void}|null=null;
 private restoring:{content:number;escape:Escape;resolve:()=>void;reject:(e:Error)=>void}|null=null;
 private applying:Applying|null=null;private preparingTiles:readonly AtlasSurfaceTile[]|null=null;
 private fieldLatest:TargetView|null=null;private draftContent=-1;private completedDraftContent=-1;private pendingReadBytes=0;
 private preview:{operation:number;follow:boolean;snapshot:TerrainAuthorSnapshot|null}|null=null;
 private resumedContent=-1;private tracedEndContent=-1;private drain:Promise<void>|null=null;
 constructor(private surface:AtlasDeckSurface,tiles:readonly AtlasSurfaceTile[],style:Readonly<TerrainStyle>,options:Omit<TerrainAuthorOptions,'lattices'|'replay'>,private changed:(screen:TerrainPreparedScreen)=>void,private committed:(revision:number,fence:string)=>void,private failed:(e:Error)=>void,create?:()=>TerrainPreparedPort){
  this.tiles=tiles;this.style=style;
  this.client=new AtlasTerrainPreparedClient(d=>this.apply(d),()=>({...this.surface.preparedResourceInventory(),authorBackingBytes:terrainModelBytes([...(this.author?.retainedOwners??[]),this.preview?.snapshot,...(this.client?.retainedFieldOwners??[])]),pendingReadBytes:this.pendingReadBytes}),failed,create);
  this.author=new TerrainAuthorState({...options,lattices:this.client.lattices(tiles),read:async q=>{this.pendingReadBytes=terrainAuthorWindow(q).bytes;try{return await options.read(q);}finally{this.pendingReadBytes=0;}},replay:this.client.replay});
  surface.observePreparedScreens(screen=>this.screen(screen));
  this.client.observeSettled((_screen,binding)=>{if(this.applying?.binding.job===binding.job&&this.applying.binding.epoch===binding.epoch)this.applying=null;if(!this.disposed)this.prepareLatest();});
 }
 resumeAfterRecovery(){if(this.disposed||this.author.failed)throw Error('Autorenbesitzer inzwischen geändert.');const source=this.source;this.committed(source.revision,source.fence);this.refresh();this.resume();}
 get displayTiles(){return this.tiles;}
 get queue(){return this.author.queue;}get source(){return this.author.canonicalSource;}
 get diagnostics(){return{author:this.author.snapshot,worker:this.client.diagnostics,activeId:this.activeId,operation:this.operation,applying:this.applying,restoring:!!this.restoring,disposed:this.disposed,draining:!!this.drain};}
 private screen(screen:TerrainPreparedScreen){
  if(this.disposed)return;
  const a=this.applying;if(a?.content===screen.content){a.drawn=true;if(a.tiles){this.tiles=a.tiles;a.tiles=null;void this.author.changeLattices(this.client.lattices(this.tiles)).catch(e=>this.failed(e));}}
  const w=this.waiter;if(w?.content===screen.content){this.waiter=null;w.resolve(screen);}
  const r=this.restoring;if(r?.content===screen.content){this.restoring=null;this.surface.releasePreparedEscape(r.escape);this.client.refreshInventory();r.resolve();}
  this.changed(screen);
  if(screen.endFrame&&screen.alpha===1&&this.tracedEndContent!==screen.content){this.tracedEndContent=screen.content;terrainTraceStart('prepared.end.draw',this.source.revision)();}
  if(!this.activeId&&!this.restoring&&screen.alpha<1&&screen.draftRevision===this.draftContent)this.resume();
  if(!this.activeId&&!this.restoring&&screen.alpha===1&&screen.endFrame){this.releaseEscape();this.prepareLatest();}
 }
 private apply(delivery:TerrainPreparedDelivery):Promise<TerrainPreparedScreen>{
  if(this.disposed||delivery.expected.operation!==this.operation||this.restoring){this.client.cancelUndrawnField();return Promise.reject(Error('Terrainpräsentation inzwischen ersetzt.'));}
  const end=terrainTraceStart(delivery.result.draft?'prepared.draft.draw':'prepared.canonical.draw',delivery.expected.target.revision);
  return new Promise((resolve,reject)=>{
   if(delivery.result.geometry){this.draftContent=-1;this.completedDraftContent=-1;this.resumedContent=-1;}
   const content=this.surface.setPreparedTerrain(delivery,this.style);
   this.applying={binding:delivery.expected,content,drawn:false,tiles:delivery.result.geometry?this.preparingTiles:null};
   this.waiter={content,resolve:s=>{end();resolve(s);},reject};
  });
 }
 canonical(tiles:readonly AtlasSurfaceTile[],style:Readonly<TerrainStyle>,request:string,camera:string,complete:boolean){
  if(this.disposed)return;this.style=style;this.fieldLatest={tiles,request,camera,complete};this.prepareLatest();
 }
 private prepareLatest(){
  if(this.disposed||this.preview||this.activeId||this.restoring||!this.fieldLatest||this.client.diagnostics.flight||this.client.diagnostics.control)return;
  const screen=this.client.diagnostics.workerBases?this.surface.preparedScreenSnapshot:null;
  if(screen&&(!screen.endFrame||screen.alpha!==1)||this.queue.pending||this.author.active)return;
  const goal=this.fieldLatest,snapshot=this.author.snapshot;
  if(goal.tiles.some(t=>t.fence!==snapshot.source.fence||t.revision!==snapshot.source.revision))return;
  this.fieldLatest=null;this.preparingTiles=goal.tiles;this.operation++;
  terrainTraceStart('prepared.canonical.dispatch',snapshot.source.revision)();
  this.client.submit({...goal,kind:'prepare',snapshot,landColor:this.style.land,operation:this.operation,requestContent:snapshot.content,basis:screen?.basis??null,screen:screen??null,...(screen&&this.draftContent===screen.draftRevision?{commitThrough:{editSeries:snapshot.series,draftRevision:screen.draftRevision,target:{...snapshot.source}}}:{})});
 }
 private fenceUnpainted(){
  this.surface.freezeTerrain();
  if(this.applying?.drawn)return; // Its real draw must reach bound settled.
  const w=this.waiter;this.waiter=null;this.client.cancelUndrawnField();w?.reject(Error('Terrainbild ersetzt.'));
 }
 private priorStateDrawn(screen:TerrainPreparedScreen){
  const snapshot=this.author.snapshot,source=this.source,drawn=this.surface.terrainSnapshot,submission=drawn?.field?.prepared?.submission;
  const same=(v:typeof source)=>v.token===source.token&&v.fence===source.fence&&v.revision===source.revision;
  return screen.alpha===1&&screen.endFrame&&!this.restoring&&!this.queue.pending&&!this.author.journal.size&&!this.author.active&&!snapshot.active&&!snapshot.suffix.length&&
   same(snapshot.source)&&this.surface.preparedScreenSnapshot===screen&&drawn?.content===screen.content&&!!submission&&
   submission.expected.epoch===this.client.epoch&&same(submission.expected.target)&&submission.capture.editSeries===snapshot.series&&
   submission.result.editSeries===snapshot.series&&submission.capture.draftRevision===snapshot.content&&
   submission.result.draftRevision===snapshot.content&&screen.draftRevision===snapshot.content&&
   submission.result.basis.generation===screen.basis.generation&&submission.result.basis.topology===screen.basis.topology&&submission.result.basis.manifest===screen.basis.manifest;
 }
 begin(id:string,stroke:HeightStroke){
  if(this.disposed||this.activeId||this.restoring||!this.surface.preparedInputUsable)throw Error('Bestätigtes Atlasbild fehlt.');
  this.operation++;this.preview=null;this.completedDraftContent=-1;this.client.discardFieldLatest();this.fieldLatest=null;
  this.surface.freezeTerrain();const screen=this.surface.preparedScreenSnapshot;if(!screen)throw Error('Bestätigte Terrainbasis fehlt.');
  this.releaseEscape();this.frozen=screen;this.escape=this.surface.capturePreparedEscape();this.activeId=id;
  const skipZero=!stroke.form&&stroke.samples.length===1&&stroke.samples[0]!.t===0&&this.priorStateDrawn(screen);
  this.fenceUnpainted();
  this.author.begin(id,stroke,stroke.visibility?this.client.captureVisibility(screen,this.author.snapshot.owner,this.author.snapshot.series):undefined);
  terrainTraceStart(this.operation>2?'prepared.following.pointer':'prepared.pointer',this.source.revision)();if(!skipZero)this.refresh();
 }
 update(stroke:HeightStroke){if(!this.activeId)return;this.author.update(this.activeId,stroke);this.refresh();}
 /** One finite preview cycle; desired input keeps advancing in A. Only the
  * newest following intention is held, not another queue or copied snapshot. */
 private refresh(){
  if(this.disposed||this.restoring||!this.frozen||this.author.failed)return;
  if(this.preview){this.preview.follow=true;return;}
  const cycle={operation:this.operation,follow:false,snapshot:null as TerrainAuthorSnapshot|null};this.preview=cycle;
  const valid=()=>!this.disposed&&this.preview===cycle&&cycle.operation===this.operation&&!this.restoring;
  void(async()=>{
   const snapshot=await this.author.refresh();if(!valid()||!snapshot||!this.frozen)return;
   cycle.snapshot=snapshot;const source=this.source;
   if(snapshot.source.token!==source.token||snapshot.source.fence!==source.fence||snapshot.source.revision!==source.revision){cycle.follow=true;return;}
   if(this.completedDraftContent===snapshot.content)return;
   this.draftContent=snapshot.content;
   terrainTraceStart('prepared.draft.dispatch',snapshot.source.revision)();
   const goal:TerrainPreparedFieldGoal={kind:'draft',snapshot,tiles:this.tiles,landColor:this.style.land,operation:cycle.operation,requestContent:snapshot.content,basis:this.frozen.basis,screen:this.frozen,request:'draft',camera:'frozen',complete:true};
   const completion=await this.client.submit(goal);if(!valid())return;
   if(completion.outcome!=='settled'){cycle.follow=true;return;}
   if(completion.goal!==goal||!completion.screen||completion.binding?.operation!==cycle.operation||completion.binding.requestContent!==snapshot.content||completion.capture?.editSeries!==snapshot.series||completion.capture.draftRevision!==snapshot.content||completion.screen.draftRevision!==snapshot.content)throw Error('Terrain-Previewabschluss gehört nicht zum Capture.');
   this.completedDraftContent=snapshot.content;
  })().catch(e=>{if(valid()&&!this.author.failed)this.failed(e);}).finally(()=>{
   if(this.preview!==cycle)return;this.preview=null;
   if(this.disposed||cycle.operation!==this.operation||this.restoring||this.author.failed)return;
   if(cycle.follow)this.refresh();else{this.resume();this.prepareLatest();}
  });
 }

 async close(action:TerrainLiveAction,id:string){
  if(action.kind!=='landscape-height-stroke'||this.activeId!==id)throw Error('Aktiver Höhenzug fehlt.');
  this.author.update(id,action.stroke);const completion=this.author.close(id);this.activeId=null;this.refresh();
  await completion;if(this.disposed)return;const source=this.author.snapshot.source;this.committed(source.revision,source.fence);this.refresh();this.resume();
 }
 end(){if(!this.activeId)this.resume();}
 private resume(){if(this.activeId||this.preview||this.disposed||this.restoring)return;const screen=this.surface.preparedScreenSnapshot;if(screen&&screen.draftRevision===this.draftContent&&screen.alpha<1&&this.resumedContent!==screen.content){this.resumedContent=screen.content;this.surface.resumePreparedTerrain(screen);}}
 async cancel(){
  const id=this.activeId;if(!id)return;this.operation++;this.preview=null;this.activeId=null;this.fieldLatest=null;this.client.discardFieldLatest();
  const restored=this.author.escape(id);this.fenceUnpainted();const escape=this.escape;this.escape=null;
  if(escape){this.draftContent=escape.screen.draftRevision;await new Promise<void>((resolve,reject)=>{const content=this.surface.restorePreparedEscape(escape);this.restoring={content,escape,resolve,reject};});}
  await restored;if(!this.disposed)this.resume();
 }
 private releaseEscape(){if(this.escape){const value=this.escape;this.escape=null;this.surface.releasePreparedEscape(value);this.client.refreshInventory();}}
 /** Dispose presentation immediately, but accepted actions finish their same
  * writer/checkpoint chain before the sole numerical worker is terminated. */
 dispose():Promise<void>{
  if(this.drain)return this.drain;if(this.disposed)return Promise.resolve();
  this.disposed=true;this.operation++;this.preview=null;this.fieldLatest=null;this.client.discardFieldLatest();
  if(this.activeId){const id=this.activeId;this.activeId=null;void this.author.escape(id).catch(()=>{});}
  this.fenceUnpainted();this.surface.observePreparedScreens(null);
  this.restoring?.reject(Error('Terrainpräsentation beendet.'));this.restoring=null;this.releaseEscape();
  this.drain=this.queue.finish().catch(()=>{/* Unknown input remains in A's immutable journal; no replay/retry. */}).finally(()=>{this.author.retire();this.client.dispose();this.applying=null;});return this.drain;
 }
 matchesSource(source:TerrainAuthorSource){return source.token===this.source.token&&source.fence===this.source.fence&&source.revision===this.source.revision;}
}

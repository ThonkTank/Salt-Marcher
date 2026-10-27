import {clearAtlasCamera,orbitAtlasCamera,zoomAtlasCamera,shiftAtlasCamera,type AtlasNavigationAnchor} from './atlas-camera-navigation';
import type {AtlasCameraPose} from './atlas-camera';
import {terrainCoverageBox,terrainCoverageLevel} from './terrain-coverage';
import type {AtlasDeckVegetation} from './atlas-deck-vegetation';
import {lengthLabel} from './atlas-units';
import {atlasSurfaceRequestKey} from './atlas-surface-request-key';
import {reuseAtlasSurfaceTile} from './atlas-surface-reuse';
import {terrainObjectSources,type TerrainObject} from './terrain-objects';
import {AtlasObjectGeometry} from './atlas-object-geometry';
import {atlasWorkplaneHeight} from './atlas-workplane';
import type {AtlasReadRequest} from './atlas-read-request';
import {terrainTraceMeasure} from './terrain-timing';
import type {AtlasPresentationHost} from './atlas-presentation-host';
import {AtlasPresentationFrameError,type AtlasPresentation} from './atlas-presentation';
import type {AtlasCanvasScene} from './atlas-canvas-scene';
import type {LandscapeBox,LandscapeRecord} from './atlas-landscape';
import type {AtlasRenderView} from './campaign-atlas-contracts';
import type {Point} from './contracts';
import type {AtlasDeckSurface,AtlasTerrainInputBinding} from './atlas-deck-surface';
import type {AtlasDeckDrawing} from './atlas-deck-drawing';
import {AtlasSurfaceTileStream,atlasSurfaceTileFetcher,type AtlasSurfaceTile} from './atlas-surface-tile-stream';
import type {AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {AtlasTerrainPreparedSession} from './atlas-terrain-prepared-session';
import type {TerrainAuthorState,TerrainAuthorOptions} from './terrain-author-state';
import type {TerrainAuthorSource} from './terrain-author-checkpoint';
import type {TerrainLiveAction} from './terrain-live-stroke';
import {DEFAULT_TERRAIN_STYLE,type TerrainStyle} from './terrain-relief';
import {gridHeight,type TerrainView} from './terrain-spatial-model';
import type {HeightStroke} from './terrain-brush';

type Host=AtlasPresentationHost;
/** Owns the GPU presentation; author input and canonical writes remain in the controller. */
export class AtlasRasterPresentation implements AtlasPresentation {
  active=false;
  private surfaceReady=false;
  private rejectedPress=false;
  /** Frozen brush input may continue while its own preview is being drawn. */
  get ready(){return this.surfaceReady&&!this.failed&&!this.authorQueue?.failed&&!!this.surface&&(this.perception?this.surface.frameUsable:this.gesturing&&this.inputGesture?this.surface.contextAvailable:this.surface.preparedInputUsable);}
  private firstSurface=new Set<(ready:boolean)=>void>();
  private settleFirst(ready:boolean){for(const resolve of this.firstSurface)resolve(ready);this.firstSurface.clear();}
  private container:HTMLDivElement|null=null;
  private surface:AtlasDeckSurface|null=null;
  private Drawing:typeof AtlasDeckDrawing|null=null;
  private creating:Promise<void>|null=null;
  private recovery:Promise<void>|null=null;
  private stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024});
  private tiles:readonly AtlasSurfaceTile[]=[];
  private targetTiles:readonly AtlasSurfaceTile[]=[];private displayModels:readonly AtlasTerrainTileModel[]=[];
  private prepared:AtlasTerrainPreparedSession|null=null;
  private retiringPrepared:AtlasTerrainPreparedSession|null=null;
  private retirement:Promise<void>|null=null;
  private authorWriter:TerrainAuthorOptions['write']|null=null;
  private targetComplete=false;private submitted:{tiles:readonly AtlasSurfaceTile[];request:string;camera:string;complete:boolean}|null=null;
  bindAuthorWriter(write:TerrainAuthorOptions['write']){this.authorWriter=write;}
  async releaseAuthorRecovery(author:TerrainAuthorState){if(author.journal.size)throw Error('Angenommene Züge bleiben gehalten.');if(this.prepared?.author===author)this.stopModels();await this.retirement;if(this.retiringPrepared?.author===author&&!author.journal.size)this.retiringPrepared=null;}
  resumeAuthorRecovery(author:TerrainAuthorState){if(this.prepared?.author!==author)throw Error('Autorenbesitzer inzwischen geändert.');this.prepared.resumeAfterRecovery();}
  get authorQueue(){return this.prepared?.queue??this.retiringPrepared?.queue??null;}
  get authorOwner(){return this.prepared?.author??this.retiringPrepared?.author??null;}
  get heldAcceptedInput(){return !!this.retiringPrepared?.author.journal.size||!!(this.prepared?.queue.failed&&this.prepared.author.journal.size);}
  /** An external canonical fence invalidates input immediately, even while a
   * gesture, write or deferred frame is live. Retained accepted input survives. */
  invalidateTerrainSource(){
    this.pauseReads();this.stopModels();this.targetTiles=[];this.submitted=null;this.surfaceReady=false;this.gesturing=false;this.inputGesture=null;this.dirty=false;
    this.input.dataset.terrainReady='loading';delete this.input.dataset.terrainDraft;
  }
  private ownsTerrainSource(source:TerrainAuthorSource){return !!this.prepared?.matchesSource(source);}
  beginHeight(id:string,stroke:HeightStroke){if(!this.prepared)throw Error('Terrainautor fehlt.');if(this.inputGesture)this.inputGesture.id=id;this.prepared.begin(id,stroke);}
  enqueueHeight(action:TerrainLiveAction,id:string){if(!this.prepared)return Promise.reject(Error('Terrainautor fehlt.'));return this.prepared.close(action,id);}
  private dirty=false;private preferDetail=false;
  private gesturing=false;
  private inputGesture:{id:string|null;session:AtlasTerrainPreparedSession;author:TerrainAuthorState;binding:AtlasTerrainInputBinding}|null=null;
  private frame:LandscapeBox={x:0,y:0,width:256,height:256};
  private focusHeightM=0;
  private perception=false;
  private tilt=0;private rotation=0;private exaggeration=1;private contours=0;
  private refreshFence='';
  private token='';private revision=-1;private fence='';private request='';private generation=0;
  private style:Readonly<TerrainStyle>=DEFAULT_TERRAIN_STYLE;
  private map:AtlasDeckDrawing|null=null;private transient:AtlasDeckDrawing|null=null;
  private scene:{scene:AtlasCanvasScene;origin:Point;images:ReadonlyMap<string,CanvasImageSource>}|null=null;
  private lastPoint:Point={x:0,y:0};private failed=false;
  private frameOwner=0;
  private failureMessage:string|null=null;
  private Vegetation:typeof AtlasDeckVegetation|null=null;private vegetation:AtlasDeckVegetation|null=null;private vegetationRecords:LandscapeRecord[]|undefined;
  private objectLayer=new AtlasObjectGeometry();private objects:TerrainObject[]=[];private objectKey='';
  private objectRead:{token:string;control:AtlasReadRequest}|null=null;
  private controls:HTMLDivElement;private toggle:HTMLButtonElement;private retry:HTMLButtonElement;
  constructor(private input:HTMLCanvasElement,private host:Host,private cameraChanged?:()=>void){
    this.controls=document.createElement('div');this.controls.id='atlas-terrain-view';
    this.controls.innerHTML='<label>Neigung<input id="terrain-tilt" type="range" min="0" max="75" value="0"></label><label>Drehung<input id="terrain-rotation" type="range" min="-180" max="180" value="0"></label><label>Höhenüberhöhung<input id="terrain-exaggeration" type="range" min="0.25" max="8" step="0.25" value="1"></label><button id="terrain-top" type="button">Zur Draufsicht</button>';
    this.toggle=document.createElement('button');this.toggle.id='atlas-terrain-tilt';this.toggle.textContent='Atlas kippen';this.toggle.onclick=()=>this.setPose(this.tilt?0:45);
    this.retry=document.createElement('button');this.retry.id='atlas-camera-retry';this.retry.type='button';this.retry.textContent='Atlaskamera erneut laden';this.retry.hidden=true;
    this.retry.onclick=()=>void this.recover();
    document.getElementById('atlas-view-popup')!.append(this.toggle,this.controls,this.retry);
    this.controls.querySelector<HTMLButtonElement>('#terrain-top')!.onclick=()=>this.setPose(0,0);
    for(const [kind,label]of [['road','Straße planen'],['river','Fluss planen']] as const){
      const button=document.createElement('button');button.id='terrain-plan-'+kind;button.textContent=label;
      button.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}void this.host.route?.(kind).catch(this.host.error);};this.controls.append(button);
    }
    for(const name of ['tilt','rotation','exaggeration'] as const)this.controls.querySelector<HTMLInputElement>('#terrain-'+name)!.oninput=e=>{
      if(this.gesturing||(this.host.navigationLocked?.()??this.host.hasDraft()))return;const value=Number((e.target as HTMLInputElement).value);if(name==='exaggeration'){this.exaggeration=value;this.applyNavigation(this.navigationPose());this.cameraChanged?.();}else this.setPose(name==='tilt'?value:this.tilt,name==='rotation'?value:this.rotation);this.reframe(this.frame);this.host.redraw();
    };
    input.parentElement!.addEventListener('pointerdown',e=>{
      if(e.target!==input||!this.active)return;
      this.rejectedPress=false;
      if(this.host.navigation(e))return;
      const rejection=this.gesturing?'gesture':!this.surfaceReady?'source':this.failed||!this.surface?.contextAvailable?'gpu':!this.surface.preparedInputUsable?'terrain-frame':!this.authorPoint(e.clientX,e.clientY)?'miss':null;
      terrainTraceMeasure(rejection?'input.reject.'+rejection:'input.accept',()=>{},this.revision);
      if(!rejection&&!this.surface!.frameUsable)terrainTraceMeasure('input.pending-drawing',()=>{},this.revision);
      if(rejection){
        this.rejectedPress=true;e.preventDefault();e.stopImmediatePropagation();
      }
    },true);
    input.parentElement!.addEventListener('click',e=>{
      if(e.target===input&&this.rejectedPress){this.rejectedPress=false;e.preventDefault();e.stopImmediatePropagation();}
    },true);
    new ResizeObserver(()=>{this.place();this.reframe(this.frame);}).observe(input);
  }
  get needsTerrainRaster(){return (document.getElementById('atlas-perception') as HTMLInputElement).checked;}
  get localDraft(){return this.dirty;}
  private pose(){return{focus:{x:this.frame.x+this.frame.width/2,y:this.frame.y+this.frame.height/2},focusHeightM:this.focusHeightM,metersPerPixel:this.frame.width/Math.max(1,this.input.clientWidth),tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration};}
  private place(){if(this.container)Object.assign(this.container.style,{left:this.input.offsetLeft+'px',top:this.input.offsetTop+'px',width:this.input.clientWidth+'px',height:this.input.clientHeight+'px'});}
  setActive(active:boolean){
    if(active===this.active)return;
    this.active=active;this.generation++;this.frameOwner++;
    if(!active){this.stopModels();this.targetTiles=[];this.displayModels=[];}
    if(!active)this.failureMessage=null;
    if(!active){this.creating=null;this.recovery=null;this.retry.hidden=true;this.retry.disabled=false;this.rejectedPress=false;this.pauseReads();this.objects=[];this.inputGesture=null;this.gesturing=false;this.objectKey='';this.objectLayer.dispose();this.vegetation?.dispose();this.vegetationRecords=undefined;this.settleFirst(false);this.surfaceReady=false;this.stream.dispose();this.stream=new AtlasSurfaceTileStream({maxTiles:32,maxRetainedTiles:64,maxBytes:64*1024*1024});this.surface?.dispose();this.surface=null;this.container?.remove();this.container=null;this.tiles=[];this.dirty=false;this.preferDetail=false;this.scene=null;this.map?.dispose();this.map=null;this.transient?.dispose();this.transient=null;this.request='';this.revision=-1;this.fence='';this.input.style.background='';delete this.input.dataset.terrainReady;delete this.input.dataset.terrainDraft;return;}
    this.startSurface();
  }
  private startSurface(){
    this.container?.remove();
    this.failed=false;this.surfaceReady=false;this.retry.hidden=true;this.container=document.createElement('div');this.container.id='atlas-terrain-spatial';this.container.style.cssText='position:absolute;pointer-events:none;z-index:0';this.input.parentElement!.append(this.container);this.place();
    this.input.style.background='transparent';this.input.style.position='relative';this.input.style.zIndex='1';this.input.dataset.renderer='deck';this.input.dataset.terrainView='raster';this.input.dataset.terrainReady='loading';
    const container=this.container;
    const current=()=>this.active&&this.container===container;
    this.creating=import('./atlas-deck-runtime').then(async runtime=>{
      if(!current())return;
      this.Drawing=runtime.AtlasDeckDrawing;this.Vegetation=runtime.AtlasDeckVegetation;this.vegetation?.dispose();this.vegetation=new this.Vegetation(this.vegetationRecords??[]);
      return runtime.AtlasDeckSurface.create({container,camera:this.pose(),model:{objects:[],targets:new Map(),coverage:{complete:true,supportedKinds:['terrain'],unsupported:[]},verticalExaggeration:1},externalInput:true,onCamera:camera=>{if(current()){this.focusHeightM=camera.focusHeightM;this.input.dataset.terrainCamera=JSON.stringify(camera);}},onError:e=>{if(current())this.fail(e);},onContextLost:()=>{if(current())this.contextLost();}});
    }).then(surface=>{
      if(!surface)return;
      if(!current()){surface.dispose();return;}
      this.surface=surface;surface.observeTerrainFrames(snapshot=>{
        if(this.surface!==surface||!current())return;
        this.displayModels=snapshot.models;this.input.dataset.terrainDrawn=JSON.stringify({at:snapshot.at,camera:snapshot.frame.camera,content:snapshot.content,alpha:snapshot.alpha});
        this.input.dataset.terrainGpu=JSON.stringify(surface.gpuMemory);this.input.dataset.terrainUpload=JSON.stringify(surface.terrainTimings);
      });this.show();this.repaint();
    }).catch(e=>{if(current())this.fail(e);});
  }
  private async finishPerception(container:HTMLDivElement|null){
    await this.creating;
    if(this.container!==container||!this.active||this.failed)return;
    const surface=this.surface;if(!surface)return;
    this.show();this.repaint();await surface.waitForFrame();
    if(this.container!==container||this.surface!==surface||!this.perception||this.failed)return;
    this.publishReady();
  }
  private publishReady(){
    this.surfaceReady=true;this.retry.hidden=true;this.input.dataset.terrainReady='ready';this.settleFirst(true);this.host.redraw();
    const message=this.failureMessage;if(message!==null){this.failureMessage=null;this.host.recovered?.(message);}
  }
  private contextLost(){
    this.stopModels();this.rejectedPress=true;
    // The host cancels its input/preview synchronously; the canonical writer is
    // untouched and recovery must never replay it.
    if(this.gesturing||this.host.hasDraft())this.host.cancel();
    this.gesture(false);
  }
  private fail(error:unknown){if(this.failed)return;this.stopModels();this.failed=true;this.frameOwner++;this.failureMessage=error instanceof Error?error.message:String(error);this.retry.hidden=false;this.pauseReads();if(this.gesturing)this.host.cancel();this.settleFirst(false);console.error(error);this.surfaceReady=false;this.input.dataset.terrainReady='failed';this.host.error(error);}
  private recover(){
    if(!this.active)return Promise.resolve();
    if(this.recovery)return this.recovery;
    this.frameOwner++;
    this.retry.disabled=true;this.retry.hidden=true;this.failed=false;this.surfaceReady=false;
    const surface=this.surface;
    if(!surface)this.startSurface();
    const container=this.container;
    const current=()=>this.active&&this.container===container;
    const run=(async()=>{
      try{
        if(surface){
          await surface.recover();if(!current()||this.surface!==surface||this.failed)return;
          this.show();this.repaint();await surface.waitForFrame();
          if(!current()||this.surface!==surface||this.failed)return;
          // Restoring the device may draw retained tiles from an older source.
          // Terrain readiness belongs to the current stream generation below.
          if(this.perception)this.publishReady();
        }else{
          await this.creating;if(!current()||this.failed||!this.surface)return;
          if(this.perception)await this.finishPerception(container);
        }
        if(!current()||this.failed)return;
        this.request='';this.objectKey='';void this.load();
      }catch(error){if(current())this.fail(error);}
      finally{if(current()){this.retry.disabled=false;this.recovery=null;}}
    })();
    this.recovery=run;return run;
  }
  openSurface(token:string,frame:LandscapeBox,revision:number,contours:number,fence?:string){
    const own=this.ownsTerrainSource({token,fence:fence??'',revision});
    if(this.active&&(this.token!==token||!own&&!this.surface&&(this.revision!==revision||this.fence!==(fence??''))))this.setActive(false);
    if(!own&&(this.revision!==revision||this.fence!==(fence??''))){this.invalidateTerrainSource();}
    this.token=token;this.revision=revision;this.fence=fence??'';this.frame={...frame};this.contours=contours;this.setActive(true);
    if(!this.fence||this.failed)return Promise.resolve(false);
    const container=this.container;
    // Register before initialization can fail or be retired. The old caller
    // must settle even when its GPU initialization has not answered yet.
    const ready=new Promise<boolean>(resolve=>this.firstSurface.add(resolve));
    void this.creating?.then(()=>{
      if(this.container!==container||!this.active||this.failed||!this.surface)return;
      void this.load();if(this.surfaceReady)this.settleFirst(true);
    });
    return ready;
  }
  sync(token:string,frame:LandscapeBox,revision:number,_objects:LandscapeRecord[],contours:number,atlas?:AtlasRenderView,display?:{mpp:number;roofs:boolean;scopeId:string|null}){
    const perception=this.needsTerrainRaster;
    // A normal loading render can still carry this owner's older projection.
    // Classify it before source invalidation, camera or presentation effects.
    if(!perception&&!this.perception&&this.token===token){
      const author=this.authorOwner?.canonicalSource;
      const confirmed=author?.token===token?Math.max(this.revision,author.revision):this.revision;
      if(revision<confirmed)return;
    }
    if(this.token&&token!==this.token||perception!==this.perception)this.setActive(false);
    this.perception=perception;
    if(perception){
      this.token=token;this.revision=revision;this.frame={...frame};this.tilt=0;this.rotation=0;this.focusHeightM=0;
      const starting=!this.active;this.setActive(true);this.reframe(frame);
      if(starting){const container=this.container;void this.finishPerception(container).catch(e=>{if(this.active&&this.container===container)this.fail(e);});}
      return;
    }
    if(this.token&&token!==this.token)this.setActive(false);
    this.token=token;this.contours=contours;
    if(!this.active)this.setActive(true);
    const fence=atlas?.region?.fence??this.fence,changed=this.revision!==revision||this.fence!==fence;
    if(changed&&!this.ownsTerrainSource({token,fence,revision}))this.invalidateTerrainSource();
    if(this.gesturing||this.dirty||this.host.writing()||revision<this.revision){
      if(!this.gesturing)this.reframe(frame);return;
    }
    this.revision=revision;this.fence=fence;
    this.reframe(frame);
    const style=atlas?.region?.landscape?.terrainStyle??_objects.find(r=>r.terrainSettings?.style)?.terrainSettings?.style;if(style&&style!==this.style){this.style=style;this.show();}
    if(this.vegetationRecords!==_objects){this.vegetationRecords=_objects;this.vegetation?.dispose();this.vegetation=this.Vegetation?new this.Vegetation(_objects):null;this.drawings();}
    if(atlas)void this.loadObjects(atlas,display);
    void this.load();
  }
  reframe(frame:LandscapeBox,_draw=true){
    if(frame.x!==this.frame.x||frame.y!==this.frame.y||frame.width!==this.frame.width||frame.height!==this.frame.height)this.preferDetail=false;
    // Layout resize can cancel large origin/extent operands into a near-zero
    // center. Bound their rounding, rather than scaling by the cancelled sum.
    const changed=(origin:number,size:number,previousOrigin:number,previousSize:number)=>
      Math.abs(origin+size/2-(previousOrigin+previousSize/2))>Number.EPSILON*8*Math.max(Math.abs(origin),size,Math.abs(previousOrigin),previousSize);
    if(!this.gesturing&&(changed(frame.x,frame.width,this.frame.x,this.frame.width)||changed(frame.y,frame.height,this.frame.y,this.frame.height))){
      this.focusHeightM=this.height({x:frame.x+frame.width/2,y:frame.y+frame.height/2});
    }
    this.frame={...frame};
    // History, reset and host reframes bypass applyNavigation. Clear the new
    // frame against retained terrain before publishing any camera to the GPU.
    if(!this.gesturing)this.focusHeightM=clearAtlasCamera(this.navigationPose(),p=>this.height(p)).focusM;
    this.place();if(this.surface){this.surface.setCamera(this.pose());this.input.dataset.terrainCamera=JSON.stringify(this.pose());if(!this.gesturing&&!this.dirty&&!this.host.writing())void this.load();}
  }
  get cameraPreference(){return {tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration,focusHeightM:this.focusHeightM};}
  /** Restore the existing campaign-local view preference; old boxes use defaults. */
  restoreCameraPreference(value?:unknown,frame?:LandscapeBox){
    const p=value&&typeof value==='object'?value as Record<string,unknown>:{};
    const finite=(name:string,fallback:number)=>typeof p[name]==='number'&&Number.isFinite(p[name])?p[name] as number:fallback;
    this.tilt=Math.max(0,Math.min(75,finite('tilt',0)));this.rotation=((finite('rotation',0)+180)%360+360)%360-180;
    this.exaggeration=Math.max(.25,Math.min(8,finite('exaggeration',1)));this.focusHeightM=finite('focusHeightM',0);
    
    // The first host render must see this pose at its restored world frame.
    if(frame)this.frame={...frame};
    this.syncPoseControls();
  }
  private syncPoseControls(){
    this.toggle.textContent=this.tilt?'Senkrecht ausrichten':'Atlas kippen';
    for(const name of ['tilt','rotation','exaggeration'] as const)(this.controls.querySelector('#terrain-'+name) as HTMLInputElement).value=String(this[name]);
  }
  private async load(){
    if(this.needsTerrainRaster||!this.active||!this.fence||this.failed||this.gesturing||this.dirty||this.host.writing())return;
    const pose=this.pose(),box=this.tilt?terrainCoverageBox(this.frame,terrainCoverageLevel(this.tilt)):this.frame;
    const preload=this.tilt?undefined:{x:this.frame.x-this.frame.width/2,y:this.frame.y-this.frame.height/2,width:this.frame.width*2,height:this.frame.height*2};
    const key=atlasSurfaceRequestKey(this.token,this.revision,this.fence,box,pose.metersPerPixel,32,this.tilt?this.frame:undefined,preload);if(key===this.request){this.show();return;}this.request=key;
    const generation=++this.generation;
    // Retain the useful old image, but its detail flag cannot qualify the new camera.
    this.input.dataset.terrainQuality='overview';
    try{
      await this.creating;if(generation!==this.generation)return;
      await this.stream.load({box,preload,maxTiles:32,focus:this.tilt?this.frame:undefined,metersPerPixel:pose.metersPerPixel,revision:this.revision,source:this.fence},atlasSurfaceTileFetcher(window.campaign,this.token,'workbench-surface'),frame=>{
        if(generation!==this.generation||this.gesturing||this.dirty||this.host.writing())return;
        // Keep the useful old image during source reconciliation, never publish
        // an empty frame between a local gesture and its canonical tiles.
        if(!frame.tiles.length||this.failed||!frame.overviewComplete&&this.surfaceReady||this.preferDetail&&!frame.complete)return;
        if(frame.complete)this.preferDetail=false;
        const previous=new Map(this.targetTiles.map(t=>[JSON.stringify(t.tile),t]));this.targetTiles=frame.tiles.map(t=>reuseAtlasSurfaceTile(previous.get(JSON.stringify(t.tile)),t));this.targetComplete=frame.complete;this.show();
        if(frame.complete&&this.scene){const scene=this.scene;this.scene=null;this.paint(scene.scene,scene.origin,scene.images);}
        this.input.dataset.terrainCache=JSON.stringify(this.stream.statistics);this.input.dataset.terrainAvailable=JSON.stringify(this.stream.availableTiles);

      });
      if(generation===this.generation)this.input.dataset.terrainCache=JSON.stringify(this.stream.statistics);this.input.dataset.terrainAvailable=JSON.stringify(this.stream.availableTiles);
    }catch(e){
      if(generation!==this.generation)return;
      if(String(e).includes('durch neuere Anfrage ersetzt')){this.request='';return;}
      if(String(e).includes('inzwischen geändert')&&this.refreshFence!==this.fence&&this.host.refresh){
        this.refreshFence=this.fence;this.pauseReads();this.settleFirst(false);
        try{await this.host.refresh();}catch(error){this.fail(error);}return;
      }
      this.fail(e);
    }
  }
  private async loadObjects(atlas:AtlasRenderView,display?:{mpp:number;roofs:boolean;scopeId:string|null}){
    if(this.failed)return;
    const sources=terrainObjectSources(atlas,display);
    const key=JSON.stringify([this.fence,sources]);if(key===this.objectKey)return;this.objectKey=key;
    if(this.objectRead)void window.campaign.atlasCancelRead(this.objectRead.token,this.objectRead.control).catch(()=>{});
    const read={token:this.token,fence:this.fence,revision:this.revision,control:{owner:'workbench-objects',id:crypto.randomUUID()}};this.objectRead=read;
    if(!sources.length){this.objects=[];this.objectLayer.dispose();this.repaint();this.objectRead=null;return;}
    try{
      const view={box:{...this.frame},frame:{...this.frame},focusM:this.focusHeightM,tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration,columns:2,rows:2};
      const reply=await window.campaign.atlasTerrainProjection(this.token,{product:'height',revision:this.revision,fence:this.fence,view,objects:sources,width:16,height:16,displayMpp:this.pose().metersPerPixel,contours:0},'view',read.control);
      if(this.objectRead!==read||read.fence!==this.fence||read.revision!==this.revision)return;if(!reply.ok)throw Error(reply.error);
      if(reply.value.revision!==this.revision||reply.value.fence!==this.fence)return;
      this.objects=reply.value.objects??[];this.repaint();this.host.redraw();
    }catch(error){if(this.objectRead===read){if(String(error).includes('durch neuere Anfrage ersetzt'))this.objectKey='';else if(String(error).includes('inzwischen geändert')&&this.refreshFence!==this.fence&&this.host.refresh){this.refreshFence=this.fence;this.pauseReads();await this.host.refresh();}else this.fail(error);}}
    finally{if(this.objectRead===read)this.objectRead=null;}
  }
  private repaint(){if(this.scene){const {scene,origin,images}=this.scene;this.scene=null;this.paint(scene,origin,images);}}
  private cameraKey(){return JSON.stringify(this.pose());}
  private stopModels(){
    const session=this.prepared;this.prepared=null;this.submitted=null;this.surface?.cancelTerrainContent();
    if(!session)return;this.retiringPrepared=session;
    const retirement=session.dispose();this.retirement=retirement;
    void retirement.then(()=>{
      if(this.retirement!==retirement)return;this.retirement=null;
      if(session.author.journal.size){this.surfaceReady=false;this.failureMessage='Nicht bestätigte Pinselzüge bleiben gehalten. Speicherstand klären.';this.input.dataset.terrainReady='blocked';return;}
      this.retiringPrepared=null;
      if(this.active&&!this.failed&&this.surface){this.submitted=null;this.show();}
    });
  }
  private show(){
    const surface=this.surface;if(this.retiringPrepared||this.retirement||!surface||this.perception||!this.targetTiles.length||this.targetTiles.some(t=>t.fence!==this.fence||t.revision!==this.revision))return;
    if(!this.prepared){
      if(!this.authorWriter)throw Error('Terrainwriter fehlt.');
      this.prepared=new AtlasTerrainPreparedSession(surface,this.targetTiles,this.style,{owner:'atlas-'+this.token,series:0,source:{token:this.token,fence:this.fence,revision:this.revision},read:async query=>{const r=await window.campaign.atlasAuthorCheckpoint(this.token,query);if(!r.ok)throw Error(r.error);return r.value;},write:this.authorWriter},screen=>{
        if(this.failed)return;this.tiles=this.prepared?.displayTiles??this.tiles;
        this.focusHeightM=surface.camera.focusHeightM;
        this.input.dataset.terrainCamera=JSON.stringify(surface.camera);this.input.dataset.terrainClearance=JSON.stringify(surface.terrainClearance);
        this.input.dataset.terrainRevision=String(this.revision);this.input.dataset.terrainQuality=screen.endFrame&&this.targetComplete?'detail':'overview';
        this.input.dataset.terrainModel=JSON.stringify({epoch:this.prepared?.client.epoch,alpha:screen.alpha,content:screen.content,morphComplete:screen.endFrame});
        if(!this.surfaceReady)this.publishReady();
      },(revision,fence)=>this.reconcile(revision,fence),error=>this.fail(error));
    }
    const camera=this.cameraKey(),previous=this.submitted;
    if(previous&&previous.request===this.request&&previous.camera===camera&&previous.complete===this.targetComplete&&previous.tiles.length===this.targetTiles.length&&previous.tiles.every((t,i)=>t===this.targetTiles[i]))return;
    this.submitted={tiles:this.targetTiles,request:this.request,camera,complete:this.targetComplete};
    surface.refreshTerrainStyle(this.style,{contours:this.contours,seaLevelM:this.targetTiles[0]?.terrain.projection.grid.seaLevelM??0});
    this.prepared.canonical(this.targetTiles,this.style,this.request,camera,this.targetComplete);
  }
  private height(p:Point){const model=[...this.displayModels].sort((a,b)=>a.grid.view.box.width-b.grid.view.box.width).find(m=>{const b=m.grid.view.box;return p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.width&&p.y<=b.y+b.height;});return model?gridHeight(model.grid,p):0;}
  visibility():TerrainView|undefined{return this.tiles.length?{box:{...this.frame},frame:{...this.frame},columns:65,rows:65,focusM:this.surface?.camera.focusHeightM??0,tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration,projection:'perspective'}:undefined;}
  private pixel(x:number,y:number){const b=this.input.getBoundingClientRect();return{x:x-b.left,y:y-b.top};}
  private gestureSample(x:number,y:number){
    const g=this.inputGesture;
    if(!this.gesturing||!g||g.session!==this.prepared||g.author!==this.authorOwner||g.id===null||g.author.active?.id!==g.id)return null;
    return this.surface?.samplePreparedInput(g.binding,this.pixel(x,y))??null;
  }
  private terrainHit(x:number,y:number){
    if(this.gesturing){const sample=this.gestureSample(x,y),hit=sample?.hit;return hit?{point:{x:hit.point[0],y:hit.point[1],heightM:hit.point[2]},segmentFraction:hit.segmentFraction}:null;}
    const frame=this.surface?.frame,segment=frame?.ray(this.pixel(x,y));if(!segment)return null;
    const field=this.surface?.terrainRay(segment);if(field)return{point:{x:field.point[0],y:field.point[1],heightM:field.point[2]},segmentFraction:field.segmentFraction};
    return null;
  }
  private planePoint(x:number,y:number,height:number,occlude:boolean){
    const segment=this.gesturing?this.gestureSample(x,y)?.segment:(this.surface?.frame)?.ray(this.pixel(x,y));if(!segment)return null;
    const dz=segment[1][2]-segment[0][2];if(Math.abs(dz)<1e-12)return null;const t=(height-segment[0][2])/dz;
    if(t<0||t>1||occlude&&(this.terrainHit(x,y)?.segmentFraction??Infinity)<t-1e-7)return null;
    return{x:segment[0][0]+t*(segment[1][0]-segment[0][0]),y:segment[0][1]+t*(segment[1][1]-segment[0][1])};
  }
  private authorPoint(x:number,y:number){if(!this.ready)return null;if(this.needsTerrainRaster)return this.planePoint(x,y,0,false);const plane=this.host.workplane?.();return plane?this.planePoint(x,y,atlasWorkplaneHeight(plane,this.drawingSurface()),true):this.terrainHit(x,y)?.point??null;}
  point(e:{clientX:number;clientY:number}){const p=terrainTraceMeasure('draft.pick',()=>this.authorPoint(e.clientX,e.clientY));if(p)this.lastPoint={x:p.x,y:p.y};return this.lastPoint;}
  private navigationPose():AtlasCameraPose{return {frame:{...this.frame},focusM:this.focusHeightM,tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration,projection:'perspective'};}
  private applyNavigation(pose:AtlasCameraPose){
    pose=clearAtlasCamera(pose,p=>this.height(p));this.frame={...pose.frame};this.focusHeightM=pose.focusM;this.tilt=pose.tilt;this.rotation=pose.rotation;
    this.syncPoseControls();
    this.input.dataset.terrainCamera=JSON.stringify({...this.pose(),pivot:'terrain-or-focus-plane'});
    return {...this.frame};
  }
  navigationPoint(e:{clientX:number;clientY:number}):AtlasNavigationAnchor|null{
    const plane=this.host.workplane?.(),heightM=plane?atlasWorkplaneHeight(plane,this.drawingSurface()):this.focusHeightM;
    const hit=!plane?this.terrainHit(e.clientX,e.clientY):null;
    const point=hit?hit.point:this.planePoint(e.clientX,e.clientY,heightM,false);
    const center={x:this.frame.x+this.frame.width/2,y:this.frame.y+this.frame.height/2};
    // Horizon rays can reach arbitrarily far. Bound the pivot to the viewed neighbourhood.
    return point&&Math.hypot(point.x-center.x,point.y-center.y)<=this.frame.width*2?{...point,heightM:'heightM' in point?Number(point.heightM):heightM}:{...center,heightM:this.focusHeightM};
  }
  navigationPan(anchor:AtlasNavigationAnchor,e:{clientX:number;clientY:number},dx:number,dy:number){
    const at=this.planePoint(e.clientX,e.clientY,anchor.heightM??this.focusHeightM,false);
    const bounded=at&&Math.hypot(at.x-anchor.x,at.y-anchor.y)<this.frame.width;
    const frame=bounded?{...this.frame,x:this.frame.x+anchor.x-at.x,y:this.frame.y+anchor.y-at.y}:shiftAtlasCamera(this.frame,this.rotation,-dx*this.pose().metersPerPixel,-dy*this.pose().metersPerPixel);
    return this.applyNavigation({...this.navigationPose(),frame});
  }
  navigationOrbit(anchor:AtlasNavigationAnchor,dx:number,dy:number){
    if(this.gesturing||(this.host.navigationLocked?.()??this.host.hasDraft()))return null;
    return this.applyNavigation(orbitAtlasCamera(this.navigationPose(),anchor,dx,dy));
  }
  navigationZoom(width:number,anchor:AtlasNavigationAnchor){return this.applyNavigation(zoomAtlasCamera(this.navigationPose(),width,anchor));}
  navigationShift(dx:number,dy:number){return this.applyNavigation({...this.navigationPose(),frame:shiftAtlasCamera(this.frame,this.rotation,dx,dy)});}
  screenAnchor(p:Point){const projected=this.surface?.frame.project({...p,heightM:this.host.workplane?.()?atlasWorkplaneHeight(this.host.workplane()!,this.drawingSurface()):this.height(p)});return projected?{x:this.frame.x+projected.x/this.input.clientWidth*this.frame.width,y:this.frame.y+projected.y/this.input.clientHeight*this.frame.height}:null;}
  pauseReads(){this.generation++;this.stream.cancel();this.request='';if(this.objectRead){void window.campaign.atlasCancelRead(this.objectRead.token,this.objectRead.control).catch(()=>{});this.objectRead=null;this.objectKey='';}}
  gesture(active:boolean){
    if(active&&(!this.ready||this.gesturing))throw Error('Atlasbild noch nicht bereit. Geste erneut beginnen.');
    this.gesturing=active;
    if(active){this.surface?.freezeTerrain();this.inputGesture=this.prepared&&this.surface?{id:null,session:this.prepared,author:this.prepared.author,binding:this.surface.capturePreparedInputBinding()}:null;this.pauseReads();}
    else{this.inputGesture=null;this.prepared?.end();}
  }
  cancelDraft(){void this.prepared?.cancel().catch(e=>this.fail(e));this.dirty=false;delete this.input.dataset.terrainDraft;}
  previewHeight(stroke:HeightStroke){this.prepared?.update(stroke);this.dirty=true;this.input.dataset.terrainDraft='height';}
  /** Pigment data is retained; this terrain mode exposes height brushes only. */
  previewColor(_record:LandscapeRecord){throw Error('Farbmalen ist in dieser Terrainetappe zurückgestellt.');}
  reconcile(revision:number,fence:string){this.preferDetail||=this.dirty;this.dirty=false;delete this.input.dataset.terrainDraft;this.revision=revision;this.fence=fence;this.request='';if(!this.gesturing)void this.load();}
  setContours(interval:number){this.contours=interval;this.show();}
  setPose(tilt:number,rotation=this.rotation){if(this.gesturing||(this.host.navigationLocked?.()??this.host.hasDraft()))return;this.applyNavigation({...this.navigationPose(),tilt:Math.max(0,Math.min(75,tilt)),rotation:((rotation+180)%360+360)%360-180});this.reframe(this.frame);this.cameraChanged?.();this.host.redraw();}
  private drawingSurface(){this.objectLayer.update(this.objects,{x:this.frame.x,y:this.frame.y,z:0},1);return{displayMpp:this.frame.width/Math.max(1,this.input.clientWidth),routes:new Map([...(this.vegetationRecords??[]),...(this.host.draft()?.routeRecords??[])].filter(r=>r.route).map(r=>[r.id,r])),objectHeights:this.objectLayer.heights,scopeBases:this.objectLayer.scopeBases,closedObjectIds:this.objectLayer.closedIds,origin:{x:this.frame.x,y:this.frame.y},focusM:0,exaggeration:1,height:(p:Point)=>this.height(p),segment:this.frame.width/64,bounds:this.frame};}
  private drawings(){this.surface?.setDrawing(frame=>[...(this.map?.layers(frame,'map')??[]),...(this.vegetation?.layers(frame,'map')??[]),...(this.transient?.layers(frame,'overlay')??[])]);}
  paint(scene:AtlasCanvasScene,origin:Point,images:ReadonlyMap<string,CanvasImageSource>){if(this.scene?.scene===scene)return;this.scene={scene,origin,images};if(!this.Drawing)return;try{const next=new this.Drawing(scene,origin,images,this.drawingSurface(),this.objectLayer.meshes);this.map?.dispose();this.map=next;this.drawings();}catch(e){this.fail(e);}}
  overlay(scene:AtlasCanvasScene,origin:Point){if(!this.Drawing)return;try{const next=new this.Drawing(scene,origin,new Map(),this.drawingSurface());this.transient?.dispose();this.transient=next;this.drawings();}catch(e){this.fail(e);}}
  hitAt(e:{clientX:number;clientY:number},keys:string[]){const frame=this.surface?.frame;if(!frame||!this.ready||!this.surface?.frameUsable)return null;const p=this.pixel(e.clientX,e.clientY),segment=frame.ray(p),hit=this.terrainHit(e.clientX,e.clientY);const distance=segment&&hit?Math.hypot(...segment[1].map((v,i)=>v-segment[0][i]!))*hit.segmentFraction:Infinity;return this.transient?.hit(frame,p,keys,distance)??this.vegetation?.hit(frame,p,keys,distance)??this.map?.hit(frame,p,keys,distance)??null;}
  batch(paint:()=>void){
    // A synchronous failure in the supplied Canvas paint is not a GPU failure.
    paint();
    const surface=this.surface,owner=this.frameOwner;
    if(!surface)return;
    const failure=(error:unknown)=>{
      // Timeout rejection has no Surface.onError callback. Report it here,
      // but never let a retired batch fail a replacement/recovered owner.
      if(this.active&&this.surface===surface&&this.frameOwner===owner)this.fail(error);
      return new AtlasPresentationFrameError(this,error);
    };
    try{return surface.waitForFrame().catch(error=>{throw failure(error);});}
    catch(error){return Promise.reject(failure(error));}
  }
  refreshBrushCursor(x:number,y:number){const hit=this.terrainHit(x,y),point=hit?.point,label=document.getElementById('land-cursor-height');if(label)label.textContent=point?'Höhe: '+lengthLabel(point.heightM):'Höhe: –';}
}

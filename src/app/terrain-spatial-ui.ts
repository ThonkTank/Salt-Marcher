import {terrainObjectSources,type TerrainObjectSource} from './terrain-objects';
import type {AtlasRenderView} from './campaign-atlas-contracts';
import {TerrainSpatialView} from './terrain-spatial-view';
import {terrainSourceBounds,type TerrainView} from './terrain-spatial-model';
import type {HeightStroke} from './terrain-brush';
import type {SpatialJob,SpatialReply} from './terrain-spatial-worker';
import type {LandscapeBox,LandscapeRecord} from './atlas-landscape';
import type {Point} from './contracts';
import {atlasFieldValue,lengthLabel} from './atlas-units';
import {terrainSourceWindow,type TerrainSourceWindow} from './terrain-spatial-source';
import type {AtlasPresentation} from './atlas-presentation';
import type {AtlasCanvasScene} from './atlas-canvas-scene';
import {terrainNavigationPlan} from './terrain-navigation-plan';
export interface TerrainDraft {heightStroke?:HeightStroke;color?:LandscapeRecord;routeRecords?:LandscapeRecord[]}

/** Main Atlas presentation: camera controls and terrain jobs, with existing author handlers. */
export class TerrainSpatialUI implements AtlasPresentation {
  active=false;ready=false;
  private canvas:HTMLCanvasElement|null=null;
  private view:TerrainSpatialView|null=null;
  private worker:Worker|null=null;
  private records:LandscapeRecord[]=[];
  private objectSources:TerrainObjectSource[]=[];
  private recordsSource='';private draftLoading=false;
  private params:TerrainView|null=null;
  private source='';private requested='';private generation=0;private busy=false;private queued=false;private lastDraft='';
  private baseline:SpatialReply|null=null;private lastSelection='';
  private loadTimer:ReturnType<typeof setTimeout>|undefined;private loadBusy=false;private pendingContours=0;
  private detailSource='';
  private samplePad=0;
  private sourceWindow:TerrainSourceWindow|null=null;
  private token='';private revision=-1;private frame:LandscapeBox|null=null;private objects:LandscapeRecord[]=[];
  private lastPoint:Point={x:0,y:0};private blockedGesture=false;
  private controls:HTMLElement;
  private toggle:HTMLButtonElement;
  private failed=false;private retrySource='';
  private retry:HTMLButtonElement;
  private tilt=0;private rotation=0;private exaggeration=1;
  constructor(private input:HTMLCanvasElement,private host:{
    draft:()=>TerrainDraft|null;live:()=>boolean;hasDraft:()=>boolean;writing:()=>boolean;cancel:()=>void;
    tool:()=>string;objectPicking?:()=>boolean;navigation:(event:PointerEvent)=>boolean;panning:()=>boolean;redraw:()=>void;
    refresh?:()=>Promise<unknown>;route?:(kind:'road'|'river')=>Promise<void>;error:(error:unknown)=>void;selection:()=>Point|null;
  }){
    this.toggle=document.createElement('button');this.toggle.id='atlas-terrain-tilt';this.toggle.textContent='Atlas kippen';this.toggle.type='button';
    this.controls=document.createElement('div');this.controls.id='atlas-terrain-view';this.controls.hidden=false;
    this.controls.innerHTML='<label>Neigung<input id="terrain-tilt" type="range" min="0" max="75" value="0"></label><label>Drehung<input id="terrain-rotation" type="range" min="-180" max="180" value="0"></label><label>Höhenüberhöhung<input id="terrain-exaggeration" type="range" min="0.25" max="8" step="0.25" value="1"></label><p>Nur die Darstellung wird überhöht. Die drei Landpinsel bearbeiten weiterhin Meterwerte.</p><button id="terrain-top" type="button">Zur Draufsicht</button>';
    this.retry=document.createElement('button');this.retry.id='atlas-camera-retry';this.retry.type='button';this.retry.textContent='Atlaskamera erneut laden';this.retry.hidden=true;
    this.retry.onclick=()=>{if(this.host.hasDraft())return;this.failed=false;this.retry.hidden=true;if(this.active){this.detailSource='';this.scheduleLoad(this.pendingContours);}else this.setActive(true);};
    document.getElementById('atlas-view-popup')!.append(this.toggle,this.controls,this.retry);
    for(const [kind,label]of [['road','Straße planen'],['river','Fluss planen']] as const){const button=document.createElement('button');button.id='terrain-plan-'+kind;button.textContent=label;button.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}void this.host.route?.(kind).catch(this.host.error);};this.controls.append(button);}
    this.toggle.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}this.setPose(this.tilt===0?45:0,this.rotation);};
    this.controls.querySelector<HTMLButtonElement>('#terrain-top')!.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}this.setPose(0,0);};
    for(const id of ['tilt','rotation','exaggeration'] as const)this.controls.querySelector<HTMLInputElement>('#terrain-'+id)!.oninput=e=>{
      const field=e.target as HTMLInputElement;if(this.host.hasDraft()){field.value=String(this[id]);return;}this[id]=Number(field.value);if(id==='exaggeration'){this.requested='';this.host.redraw();}else this.setPose(this.tilt,this.rotation);
    };
    const parent=input.parentElement!;
    // Parent capture runs before the existing 2D canvas/author handlers; the latter still own brush gestures.
    parent.addEventListener('pointerdown',e=>{
      if(e.target!==input||!this.active)return;
      this.blockedGesture=false;
      if(this.host.navigation(e))return;
      if(!this.ready&&!this.host.live()){this.blockedGesture=true;e.preventDefault();e.stopImmediatePropagation();return;}
      const hit=this.view?.hit(e.clientX,e.clientY,this.host.tool()==='select',this.host.objectPicking?.()??false);if(!hit){this.blockedGesture=true;e.preventDefault();e.stopImmediatePropagation();return;}this.lastPoint=hit;
    },true);
    parent.addEventListener('click',e=>{if(e.target===input&&this.blockedGesture){this.blockedGesture=false;e.preventDefault();e.stopImmediatePropagation();}},true);
    parent.addEventListener('pointermove',e=>{
      if(e.target!==input||!this.active||this.host.panning())return;
      const hit=this.view?.hit(e.clientX,e.clientY);if(!hit||!this.ready&&!this.host.live()){e.stopImmediatePropagation();return;}this.lastPoint=hit;
      const field=document.getElementById('land-radius') as HTMLInputElement;
      this.view?.showCursor(hit,['height','smooth','color'].includes(this.host.tool())?Number(atlasFieldValue(field)):0);
    },true);
    input.addEventListener('pointerleave',()=>this.view?.showCursor(null,0));
    new ResizeObserver(()=>{this.placeCanvas();this.view?.render();}).observe(input);
  }
  refreshBrushCursor(x:number,y:number){
    if(!this.active||!this.ready)return;
    const hit=this.view?.hit(x,y);if(!hit)return;this.lastPoint=hit;
    const field=document.getElementById('land-radius') as HTMLInputElement;
    this.view?.showCursor(hit,['height','smooth','color'].includes(this.host.tool())?Number(atlasFieldValue(field)):0);
  }
  screenAnchor(point:Point):Point|null{
    const p=this.active?this.view?.project(point):null,frame=this.frame;
    return p&&frame?{x:frame.x+p.x*frame.width,y:frame.y+p.y*frame.height}:null;
  }
  navigationPoint(e:{clientX:number;clientY:number}){return this.view?.planePoint(e.clientX,e.clientY)??null;}
  point(e:{clientX:number;clientY:number}){const hit=this.view?.hit(e.clientX,e.clientY,false,this.host.objectPicking?.()??false);if(hit)this.lastPoint=hit;return this.lastPoint;}
  paint(scene:AtlasCanvasScene,origin:Point,images:ReadonlyMap<string,CanvasImageSource>){this.view?.publish(scene,origin,images);}
  overlay(scene:AtlasCanvasScene,origin:Point){this.view?.overlay(scene,origin);}
  hitAt(e:{clientX:number;clientY:number},keys:string[]){return this.view?.hitAt(e.clientX,e.clientY,keys)??null;}
  setPose(tilt:number,rotation=this.rotation){
    if(this.host.hasDraft())return;
    this.tilt=tilt;this.rotation=rotation;
    (this.controls.querySelector('#terrain-tilt') as HTMLInputElement).value=String(tilt);
    (this.controls.querySelector('#terrain-rotation') as HTMLInputElement).value=String(rotation);
    this.toggle.textContent=tilt===0?'Atlas kippen':'Senkrecht ausrichten';
    this.toggle.setAttribute('aria-pressed',String(tilt!==0));
    if(this.frame)this.reframe(this.frame);
  }
  gesture(active:boolean){
    this.view?.freezePicking(active);
    if(active){clearTimeout(this.loadTimer);this.loadTimer=undefined;this.generation++;this.worker?.terminate();this.worker=null;this.busy=false;this.queued=false;}
    else if(this.needsLoad())this.scheduleLoad(this.pendingContours);
  }
  liveQuery(detail?:(box:LandscapeBox)=>LandscapeBox|undefined):import('./terrain-presentation').TerrainFrameQuery|null{
    if(!this.active||!this.params||!this.frame)return null;
    return {kind:'tilted',query:{detail:detail?.(this.params.box),view:this.params,revision:this.revision,
      objects:this.objectSources,width:this.baseline?.width??1024,height:this.baseline?.height??1024,contours:0,
      displayMpp:this.sourceWindow!.frame.width/this.sourceWindow!.pixelWidth}};
  }
  presentLive(data:import('./terrain-projection').TerrainProjection){
    if(!this.active)return;this.baseline={...data,source:this.source};this.publish(this.baseline);
  }
  visibility(){return this.active&&this.params?structuredClone(this.params):undefined;}
  setContours(interval:number){this.pendingContours=interval;this.view?.setContours(interval);}
  private fail(error:unknown){
    this.failed=true;this.retry.hidden=false;this.host.cancel();this.setActive(false);this.host.error(error);
  }
  setActive(active:boolean){
    if(active&&this.failed)return;
    if(active&&(document.getElementById('atlas-perception') as HTMLInputElement).checked)return;
    if(this.active===active)return;this.active=active;
    if(!active){clearTimeout(this.loadTimer);this.loadTimer=undefined;this.generation++;this.ready=false;this.source='';this.requested='';this.detailSource='';this.sourceWindow=null;this.worker?.terminate();this.worker=null;this.busy=false;this.records=[];this.params=null;this.baseline=null;this.view?.dispose();this.view=null;this.canvas?.remove();this.canvas=null;this.input.style.background='';this.input.style.position='';this.input.style.zIndex='';this.input.dataset.renderer='canvas2d';delete this.input.dataset.terrainView;delete this.input.dataset.terrainReady;delete this.input.dataset.terrainQuality;this.host.redraw();return;}
    try{
      this.canvas=document.createElement('canvas');this.canvas.id='atlas-terrain-spatial';this.canvas.style.cssText='position:absolute;pointer-events:none;z-index:0;';this.input.parentElement!.append(this.canvas);this.placeCanvas();this.view=new TerrainSpatialView(this.canvas);this.input.style.background='transparent';this.input.style.position='relative';this.input.style.zIndex='1';this.input.dataset.renderer='webgl';this.input.dataset.terrainView='main';this.input.dataset.terrainReady='loading';
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(this.active){this.fail(Error('Grafikdarstellung verloren. Der Atlas ist in Draufsicht verfügbar. Die Atlaskamera kann im Ansichtsmenü erneut geladen werden.'));}});
      this.requested='';this.host.redraw();
    }catch(error){this.fail(error);}
  }
  private placeCanvas(){if(!this.canvas)return;this.canvas.style.left=this.input.offsetLeft+'px';this.canvas.style.top=this.input.offsetTop+'px';this.canvas.style.width=this.input.clientWidth+'px';this.canvas.style.height=this.input.clientHeight+'px';}
  /** Called by the existing Atlas camera before any asynchronous region request. */
  reframe(frame:LandscapeBox){
    this.frame={...frame};if(!this.active)return;
    if(this.params)this.params={...this.params,frame:{...frame},tilt:this.tilt,rotation:this.rotation,projection:'perspective'};
    this.view?.reframe(frame,this.tilt,this.rotation);
    if(this.params)this.input.dataset.terrainProjection=JSON.stringify(this.params);
  }
  sync(token:string,frame:LandscapeBox,revision:number,objects:LandscapeRecord[],contours:number,atlas?:AtlasRenderView,display?:{mpp:number;roofs:boolean;scopeId:string|null}){
    this.token=token;this.reframe(frame);this.revision=revision;this.objects=objects;
    // A commit may advance the root before its corresponding region arrives.
    if(this.host.writing()||atlas?.region&&atlas.region.revision!==revision)return;
    this.toggle.disabled=this.failed||(document.getElementById('atlas-perception') as HTMLInputElement).checked;
    this.controls.hidden=this.failed;this.retry.disabled=this.host.hasDraft()||(document.getElementById('atlas-perception') as HTMLInputElement).checked;
    if(this.toggle.disabled&&this.active)this.setActive(false);
    if(this.toggle.disabled)return;
    if(!this.active)this.setActive(true);if(!this.active)return;this.placeCanvas();this.setContours(contours);this.view?.setVegetation(objects);
    const selected=this.host.selection(),selectionKey=JSON.stringify(selected);if(selectionKey!==this.lastSelection){this.lastSelection=selectionKey;this.view?.showSelection(selected);}
    if(this.host.live())return;
    this.objectSources=atlas?terrainObjectSources(atlas,display):[];
    const radius=Number(atlasFieldValue(document.getElementById('land-radius') as HTMLInputElement));this.samplePad=this.host.tool()==='smooth'&&Number.isFinite(radius)&&radius>0?radius/2:0;
    this.sourceWindow=terrainSourceWindow(this.sourceWindow,frame,this.input.clientWidth,this.input.clientHeight);
    const source=JSON.stringify([token,revision,this.sourceWindow,this.samplePad,this.exaggeration,this.objectSources,objects.filter(r=>r.kind!=='patch').map(r=>[r.id,r.revision]).sort()]);
    if(source!==this.requested){this.requested=source;this.ready=false;this.input.dataset.terrainReady='loading';this.generation++;this.busy=false;this.queued=false;this.baseline=null;this.worker?.terminate();this.worker=null;this.scheduleLoad(contours);return;}
    if(this.host.writing())return;
    const draft=this.host.draft(),key=JSON.stringify(draft);
    if(this.ready&&key!==this.lastDraft){this.lastDraft=key;if(!draft&&this.baseline?.source===this.source){this.generation++;this.worker?.terminate();this.worker=null;this.busy=false;this.queued=false;this.view!.setData(this.baseline);this.reframe(this.frame!);this.input.dataset.terrainPreview='false';}else this.queue(contours);}
    if(this.needsLoad()&&!this.loadBusy&&this.loadTimer===undefined)this.scheduleLoad(contours);
  }
  private needsLoad(){return this.active&&(!this.ready||this.detailSource!==this.requested)&&!this.host.hasDraft()&&!this.host.live()&&!this.host.writing();}
  /** Coalesce camera motion before IPC; discard obsolete replies without accumulating main-thread reads. */
  private scheduleLoad(contours:number){
    this.pendingContours=contours;clearTimeout(this.loadTimer);this.loadTimer=undefined;
    if(this.loadBusy||!this.active||this.host.hasDraft()||this.host.live())return;
    this.loadTimer=setTimeout(()=>{
      this.loadTimer=undefined;if(!this.active)return;const source=this.requested;this.loadBusy=true;
      void this.load(source).finally(()=>{this.loadBusy=false;if(this.active&&(this.requested!==source||this.needsLoad()))this.scheduleLoad(this.pendingContours);});
    },100);
  }
  private async load(source:string){
    const token=this.token,revision=this.revision,generation=this.generation;
    const current=()=>this.active&&this.requested===source&&this.generation===generation&&!this.host.live()&&!this.host.hasDraft()&&!this.host.writing();
    try{
      const stages=terrainNavigationPlan(this.sourceWindow!,revision,{tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration},this.objectSources);
      // An interrupted refinement resumes from the already usable surface.
      const start=this.source===source&&this.ready&&this.baseline?1:0;
      for(let stage=start;stage<stages.length;stage++){
        if(!current())return;
        const reply=await window.campaign.atlasTerrainProjection(token,stages[stage]!);
        if(!current())return;
        if(!reply.ok)throw Error(reply.error);
        if(reply.value.revision!==revision){this.ready=false;this.requested='';this.host.redraw();return;}
        this.records=[];this.recordsSource='';
        this.params={...reply.value.grid.view,frame:{...this.frame!},tilt:this.tilt,rotation:this.rotation};this.source=source;this.lastDraft='null';
        this.detailSource=stage===1?source:'';this.input.dataset.terrainQuality=stage===1?'detail':'overview';
        const data={...reply.value,source};this.baseline=data;this.publish(data);this.setContours(this.pendingContours);
        if(stage===1)this.retry.hidden=true;
      }
    }catch(error){
      if(!current())return;
      if(this.ready&&this.source===source&&!String(error).includes('inzwischen geändert')){
        this.detailSource=source;this.retry.hidden=false;this.host.error(error); // Keep the usable overview; explicit retry, no loop.
      }else this.sourceFailed(source,error);
    }
  }
  private sourceFailed(source:string,error:unknown){
    if(!this.active||this.requested!==source||this.host.writing()||this.host.live())return;
    if(String(error).includes('inzwischen geändert')&&this.retrySource!==source&&this.host.refresh){
      this.retrySource=source;this.ready=false;void this.host.refresh().catch(e=>this.fail(e));return;
    }
    this.fail(error);
  }
  private publish(data:SpatialReply){
    this.view!.setData(data);this.reframe(this.frame!);this.ready=true;
    this.input.dataset.terrainReady='ready';this.input.dataset.terrainPreview=String(data.draft);
    this.input.dataset.terrainProjection=JSON.stringify(this.params);this.input.dataset.terrainSamplePad=String(this.samplePad);
    this.view!.showSelection(this.host.selection());this.host.redraw();
  }
  private async queue(contours:number,baseOnly=false){
    if(!this.params||!this.active)return;if(this.busy){this.queued=true;return;}
    if(this.recordsSource!==this.source){
      if(this.draftLoading){this.queued=true;return;}
      this.draftLoading=true;const source=this.source,token=this.token,revision=this.revision;
      try{
        const reply=await window.campaign.atlasMaskRegion(token,terrainSourceBounds(this.params,this.samplePad));
        if(!this.active||source!==this.source||source!==this.requested)return;
        if(!reply.ok)throw Error(reply.error);
        if(reply.value.revision!==revision){this.requested='';this.host.redraw();return;}
        this.records=[...new Map([...this.objects.filter(r=>r.kind!=='patch'),...reply.value.records].map(r=>[r.id,r])).values()];this.recordsSource=source;
      }catch(error){if(this.active&&source===this.requested)this.fail(error);return;}
      finally{this.draftLoading=false;if(this.active&&this.ready&&this.source!==source&&this.host.draft())void this.queue(this.pendingContours);}
      if(!this.host.draft())return;
    }
    this.worker??=new Worker(new URL('terrain-spatial-worker.js',document.baseURI));this.busy=true;
    const generation=++this.generation,source=this.source,draft=baseOnly||this.host.writing()?null:this.host.draft();this.lastDraft=JSON.stringify(draft);
    this.worker.onmessage=(e:MessageEvent<SpatialReply&{error?:string}>)=>{
      if(!this.active||source!==this.source||source!==this.requested||generation!==this.generation||e.data.generation!==generation)return;this.busy=false;
      if(e.data.error){this.fail(Error(e.data.error));return;}
      if(e.data.draft&&!this.host.draft()){this.queue(contours,true);return;}
      if(!e.data.draft)this.baseline=e.data;this.publish(e.data);
      if(e.data.protectedLimit!==undefined)document.getElementById('land-status')!.textContent='Pinselwirkung am geschützten Verlauf lokal begrenzt. Eingriffsgrenzen wären sonst überschritten.';
      if(e.data.heightM!==undefined)document.getElementById('land-cursor-height')!.textContent='Höhe: '+lengthLabel(e.data.heightM)+' · Vorschau';
      this.view!.showSelection(this.host.selection());this.host.redraw();
      if(this.queued||!e.data.draft&&this.host.draft()&&!this.host.writing()){this.queued=false;this.queue(contours);}
    };
    this.worker.onerror=()=>this.fail(Error('Atlaskamera konnte nicht geladen werden. Im Ansichtsmenü erneut versuchen.'));
    const width=draft?512:1024,height=Math.max(128,Math.min(1024,Math.round(width*this.params.box.height/this.params.box.width)));
    const job:SpatialJob={generation,source,view:this.params,objectSources:this.objectSources,records:this.records,box:this.params.box,width,height,contours,displayMpp:this.sourceWindow!.frame.width/this.sourceWindow!.pixelWidth,...draft};this.worker.postMessage(job);
  }
}

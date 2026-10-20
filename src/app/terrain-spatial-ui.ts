import {TerrainSpatialView} from './terrain-spatial-view';
import {TerrainSampler} from './terrain-height';
import {terrainSourceBounds,type TerrainView} from './terrain-spatial-model';
import type {HeightStroke} from './terrain-brush';
import type {SpatialJob,SpatialReply} from './terrain-spatial-worker';
import type {LandscapeBox,LandscapeRecord} from './atlas-landscape';
import type {Point} from './contracts';
import {atlasFieldValue,lengthLabel} from './atlas-units';
import {wheelZoomFactor} from './atlas-navigation-scale';
import {terrainSourceWindow,type TerrainSourceWindow} from './terrain-spatial-source';
export interface TerrainDraft {heightStroke?:HeightStroke;color?:LandscapeRecord}

/** The second Atlas projection shares its canvas input, camera box, selection and author tools. */
export class TerrainSpatialUI {
  active=false;ready=false;
  private canvas:HTMLCanvasElement|null=null;
  private view:TerrainSpatialView|null=null;
  private worker:Worker|null=null;
  private records:LandscapeRecord[]=[];
  private params:TerrainView|null=null;
  private source='';private requested='';private generation=0;private busy=false;private queued=false;private lastDraft='';
  private baseline:SpatialReply|null=null;private lastSelection='';
  private loadTimer:ReturnType<typeof setTimeout>|undefined;private loadBusy=false;private pendingContours=0;
  private samplePad=0;
  private sourceWindow:TerrainSourceWindow|null=null;
  private token='';private revision=-1;private frame:LandscapeBox|null=null;private objects:LandscapeRecord[]=[];
  private lastPoint:Point={x:0,y:0};private space=false;
  private drag:{id:number;anchor:Point}|null=null;
  private controls:HTMLElement;
  private toggle:HTMLButtonElement;
  private tilt=45;private rotation=0;private exaggeration=2;
  constructor(private input:HTMLCanvasElement,private host:{
    draft:()=>TerrainDraft|null;hasDraft:()=>boolean;writing:()=>boolean;cancel:()=>void;
    tool:()=>string;pan:()=>boolean;set:(box:LandscapeBox)=>void;zoom:(factor:number,anchor:Point)=>void;stopZoom:()=>void;redraw:()=>void;
    choose:(point:Point)=>Promise<void>;route?:(kind:'road'|'river',tilt:number)=>Promise<void>;error:(error:unknown)=>void;selection:()=>Point|null;
  }){
    this.toggle=document.createElement('button');this.toggle.id='atlas-terrain-tilt';this.toggle.textContent='Atlas kippen';this.toggle.type='button';
    this.controls=document.createElement('div');this.controls.id='atlas-terrain-view';this.controls.hidden=true;
    this.controls.innerHTML='<label>Neigung<input id="terrain-tilt" type="range" min="0" max="75" value="45"></label><label>Drehung<input id="terrain-rotation" type="range" min="-180" max="180" value="0"></label><label>Höhenüberhöhung<input id="terrain-exaggeration" type="range" min="0.25" max="8" step="0.25" value="2"></label><p>Nur die Darstellung wird überhöht. Die drei Landpinsel bearbeiten weiterhin Meterwerte.</p><button id="terrain-top" type="button">Zur Draufsicht</button>';
    document.getElementById('atlas-view-popup')!.append(this.toggle,this.controls);
    for(const [kind,label]of [['road','Straße planen'],['river','Fluss planen']] as const){const button=document.createElement('button');button.id='terrain-plan-'+kind;button.textContent=label;button.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}void this.host.route?.(kind,this.tilt).catch(this.host.error);};this.controls.append(button);}
    this.toggle.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}this.setActive(!this.active);};
    this.controls.querySelector<HTMLButtonElement>('#terrain-top')!.onclick=()=>{if(this.host.hasDraft()){this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));return;}this.setActive(false);};
    for(const id of ['tilt','rotation','exaggeration'] as const)this.controls.querySelector<HTMLInputElement>('#terrain-'+id)!.oninput=e=>{
      const field=e.target as HTMLInputElement;if(this.host.hasDraft()){field.value=String(this[id]);return;}this[id]=Number(field.value);if(id==='exaggeration')this.requested='';else if(this.frame)this.reframe(this.frame);this.host.redraw();
    };
    document.getElementById('land-tool')!.addEventListener('change',()=>{if(this.active&&!['height','smooth','color','select'].includes(this.host.tool()))this.setActive(false);});
    const parent=input.parentElement!;
    // Parent capture runs before the existing 2D canvas/author handlers; the latter still own brush gestures.
    parent.addEventListener('pointerdown',e=>{
      if(e.target!==input||!this.active)return;
      if(e.button===1||e.altKey||this.space||this.host.pan()){
        e.preventDefault();e.stopImmediatePropagation();
        if(this.host.hasDraft())return;this.host.stopZoom();const anchor=this.view?.planePoint(e.clientX,e.clientY);if(!anchor)return;this.drag={id:e.pointerId,anchor};input.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();return;
      }
      if(!this.ready){e.preventDefault();e.stopImmediatePropagation();return;}
      if(e.button===0&&!['height','smooth','color','select'].includes(this.host.tool())){this.setActive(false);e.preventDefault();e.stopImmediatePropagation();return;}
      const hit=this.view?.hit(e.clientX,e.clientY,this.host.tool()==='select');if(!hit){e.preventDefault();e.stopImmediatePropagation();return;}this.lastPoint=hit;if(this.host.tool()==='select'){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    parent.addEventListener('pointermove',e=>{
      if(e.target!==input||!this.active)return;
      if(this.drag){
        const p=this.view?.planePoint(e.clientX,e.clientY),frame=this.frame;
        if(p&&frame)this.host.set({...frame,x:frame.x+this.drag.anchor.x-p.x,y:frame.y+this.drag.anchor.y-p.y});e.preventDefault();e.stopImmediatePropagation();return;
      }
      const hit=this.view?.hit(e.clientX,e.clientY);if(!hit||!this.ready){e.stopImmediatePropagation();return;}this.lastPoint=hit;
      const field=document.getElementById('land-radius') as HTMLInputElement;
      this.view?.showCursor(hit,['height','smooth','color'].includes(this.host.tool())?Number(atlasFieldValue(field)):0);
    },true);
    parent.addEventListener('pointerup',e=>{if(e.target!==input||!this.active||!this.drag)return;this.drag=null;if(input.hasPointerCapture(e.pointerId))input.releasePointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();},true);
    parent.addEventListener('pointercancel',()=>{this.drag=null;},true);
    parent.addEventListener('wheel',e=>{
      if(e.target!==input||!this.active)return;e.preventDefault();e.stopImmediatePropagation();if(this.host.hasDraft()||!this.frame)return;
      const p=this.view?.planePoint(e.clientX,e.clientY)??{x:this.frame.x+this.frame.width/2,y:this.frame.y+this.frame.height/2};
      this.host.zoom(wheelZoomFactor(e.deltaY,e.deltaMode,input.clientHeight),p);
    },{capture:true,passive:false});
    parent.addEventListener('click',e=>{if(e.target!==input||!this.active||this.host.tool()!=='select'||this.host.hasDraft())return;const p=this.view?.hit(e.clientX,e.clientY,true);e.preventDefault();e.stopImmediatePropagation();if(p)void this.host.choose(p).catch(this.host.error);},true);
    input.addEventListener('keydown',e=>{if(e.code==='Space')this.space=true;});window.addEventListener('keyup',e=>{if(e.code==='Space')this.space=false;});window.addEventListener('blur',()=>{this.space=false;this.drag=null;});
    input.addEventListener('pointerleave',()=>this.view?.showCursor(null,0));
    new ResizeObserver(()=>{this.placeCanvas();this.view?.render();}).observe(input);
  }
  refreshBrushCursor(x:number,y:number){
    if(!this.active||!this.ready)return;
    const hit=this.view?.hit(x,y);if(!hit)return;this.lastPoint=hit;
    const field=document.getElementById('land-radius') as HTMLInputElement;
    this.view?.showCursor(hit,['height','smooth','color'].includes(this.host.tool())?Number(atlasFieldValue(field)):0);
  }
  point(e:MouseEvent){const hit=this.view?.hit(e.clientX,e.clientY);if(hit)this.lastPoint=hit;return this.lastPoint;}
  visibility(){return this.active&&this.params?structuredClone(this.params):undefined;}
  setActive(active:boolean){
    if(active&&(document.getElementById('atlas-perception') as HTMLInputElement).checked)return;
    if(this.active===active)return;this.active=active;this.controls.hidden=!active;this.toggle.textContent=active?'Draufsicht':'Atlas kippen';this.toggle.setAttribute('aria-pressed',String(active));
    if(!active){clearTimeout(this.loadTimer);this.loadTimer=undefined;this.generation++;this.ready=false;this.source='';this.requested='';this.sourceWindow=null;this.worker?.terminate();this.worker=null;this.busy=false;this.records=[];this.params=null;this.baseline=null;this.view?.dispose();this.view=null;this.canvas?.remove();this.canvas=null;this.input.style.opacity='';delete this.input.dataset.terrainView;delete this.input.dataset.terrainReady;this.host.redraw();return;}
    try{
      this.canvas=document.createElement('canvas');this.canvas.id='atlas-terrain-spatial';this.canvas.style.cssText='position:absolute;pointer-events:none;z-index:1;';this.input.parentElement!.append(this.canvas);this.placeCanvas();this.view=new TerrainSpatialView(this.canvas);this.input.style.opacity='0';this.input.dataset.terrainView='tilted';this.input.dataset.terrainReady='loading';
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(this.active){this.host.cancel();this.setActive(false);this.host.error(Error('Grafikdarstellung verloren. Der Atlas ist wieder in Draufsicht verfügbar.'));}});
      this.requested='';this.host.redraw();
    }catch(error){this.setActive(false);this.host.error(error);}
  }
  private placeCanvas(){if(!this.canvas)return;this.canvas.style.left=this.input.offsetLeft+'px';this.canvas.style.top=this.input.offsetTop+'px';this.canvas.style.width=this.input.clientWidth+'px';this.canvas.style.height=this.input.clientHeight+'px';}
  /** Called by the existing Atlas camera before any asynchronous region request. */
  reframe(frame:LandscapeBox){
    this.frame={...frame};if(!this.active)return;
    if(this.params)this.params={...this.params,frame:{...frame},tilt:this.tilt,rotation:this.rotation,projection:'perspective'};
    this.view?.reframe(frame,this.tilt,this.rotation);
    if(this.params)this.input.dataset.terrainProjection=JSON.stringify(this.params);
  }
  sync(token:string,frame:LandscapeBox,revision:number,objects:LandscapeRecord[],contours:number){
    this.token=token;this.reframe(frame);this.revision=revision;this.objects=objects;
    this.toggle.disabled=(document.getElementById('atlas-perception') as HTMLInputElement).checked;
    if(this.toggle.disabled&&this.active)this.setActive(false);
    if(!this.active)return;this.placeCanvas();
    const selected=this.host.selection(),selectionKey=JSON.stringify(selected);if(selectionKey!==this.lastSelection){this.lastSelection=selectionKey;this.view?.showSelection(selected);}
    const radius=Number(atlasFieldValue(document.getElementById('land-radius') as HTMLInputElement));this.samplePad=this.host.tool()==='smooth'&&Number.isFinite(radius)&&radius>0?radius/2:0;
    this.sourceWindow=terrainSourceWindow(this.sourceWindow,frame,this.input.clientWidth,this.input.clientHeight);
    const source=JSON.stringify([token,revision,this.sourceWindow,this.samplePad,this.exaggeration,contours,objects.filter(r=>r.kind!=='patch').map(r=>[r.id,r.revision]).sort()]);
    if(source!==this.requested){this.requested=source;this.ready=false;this.input.dataset.terrainReady='loading';this.generation++;this.busy=false;this.queued=false;this.baseline=null;this.worker?.terminate();this.worker=null;this.scheduleLoad(contours);return;}
    if(this.host.writing())return;
    const draft=this.host.draft(),key=JSON.stringify(draft);
    if(this.ready&&key!==this.lastDraft){this.lastDraft=key;if(!draft&&this.baseline?.source===this.source){this.generation++;this.worker?.terminate();this.worker=null;this.busy=false;this.queued=false;this.view!.setData(this.baseline);this.reframe(this.frame!);this.input.dataset.terrainPreview='false';}else this.queue(contours);}
  }
  /** Coalesce camera motion before IPC; discard obsolete replies without accumulating main-thread reads. */
  private scheduleLoad(contours:number){
    this.pendingContours=contours;clearTimeout(this.loadTimer);
    if(this.loadBusy||!this.active)return;
    this.loadTimer=setTimeout(()=>{
      this.loadTimer=undefined;if(!this.active)return;const source=this.requested;this.loadBusy=true;
      void this.load(source,this.pendingContours).finally(()=>{this.loadBusy=false;if(this.active&&this.requested!==source)this.scheduleLoad(this.pendingContours);});
    },100);
  }
  private async load(source:string,contours:number){
    const frame={...this.sourceWindow!.frame},box={x:frame.x-frame.width,y:frame.y-frame.height,width:frame.width*3,height:frame.height*3},token=this.token,revision=this.revision;
    try{
      const view:TerrainView={projection:'perspective',box,frame,columns:193,rows:193,focusM:0,tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration};
      const reply=await window.campaign.atlasMaskRegion(token,terrainSourceBounds(view,this.samplePad));
      if(!this.active||this.requested!==source)return;
      if(!reply.ok)throw Error(reply.error);if(reply.value.revision!==revision){this.requested='';this.host.redraw();return;}
      this.records=[...new Map([...this.objects.filter(r=>r.kind!=='patch'),...reply.value.records].map(r=>[r.id,r])).values()];
      const focusM=Math.max(new TerrainSampler(this.records).seaLevelM,new TerrainSampler(this.records).sample({x:frame.x+frame.width/2,y:frame.y+frame.height/2}).heightM);
      this.params={projection:'perspective',box,frame:{...this.frame!},columns:193,rows:193,focusM,tilt:this.tilt,rotation:this.rotation,exaggeration:this.exaggeration};this.source=source;this.lastDraft='null';this.queue(contours,true);
    }catch(error){if(this.active&&this.requested===source){this.setActive(false);this.host.error(error);}}
  }
  private queue(contours:number,baseOnly=false){
    if(!this.params||!this.active)return;if(this.busy){this.queued=true;return;}
    this.worker??=new Worker(new URL('terrain-spatial-worker.js',document.baseURI));this.busy=true;
    const generation=++this.generation,source=this.source,draft=baseOnly||this.host.writing()?null:this.host.draft();this.lastDraft=JSON.stringify(draft);
    this.worker.onmessage=(e:MessageEvent<SpatialReply&{error?:string}>)=>{
      if(!this.active||source!==this.source||source!==this.requested||generation!==this.generation||e.data.generation!==generation)return;this.busy=false;
      if(e.data.error){this.host.error(Error(e.data.error));this.input.dataset.terrainReady='error';this.ready=false;return;}
      if(e.data.draft&&!this.host.draft()){this.queue(contours,true);return;}
      if(!e.data.draft)this.baseline=e.data;this.view!.setData(e.data);this.reframe(this.frame!);this.ready=true;this.input.dataset.terrainReady='ready';this.input.dataset.terrainPreview=String(e.data.draft);this.input.dataset.terrainProjection=JSON.stringify(this.params);this.input.dataset.terrainSamplePad=String(this.samplePad);
      if(e.data.protectedLimit!==undefined)document.getElementById('land-status')!.textContent='Pinselwirkung am geschützten Verlauf lokal begrenzt. Eingriffsgrenzen wären sonst überschritten.';
      if(e.data.heightM!==undefined)document.getElementById('land-cursor-height')!.textContent='Höhe: '+lengthLabel(e.data.heightM)+' · Vorschau';
      this.view!.showSelection(this.host.selection());
      if(this.queued||!e.data.draft&&this.host.draft()&&!this.host.writing()){this.queued=false;this.queue(contours);}
    };
    this.worker.onerror=()=>{this.busy=false;this.host.error(Error('Räumliche Vorschau fehlgeschlagen.'));this.setActive(false);};
    const width=draft?512:1024,height=Math.max(128,Math.min(1024,Math.round(width*this.params.box.height/this.params.box.width)));
    const job:SpatialJob={generation,source,view:this.params,records:this.records,box:this.params.box,width,height,contours,displayMpp:this.sourceWindow!.frame.width/this.sourceWindow!.pixelWidth,...draft};this.worker.postMessage(job);
  }
}

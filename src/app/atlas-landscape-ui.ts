import {mapLabelEditor,readMapLabelEditor} from './map-label-editor';
import {openTerrainRoute} from './terrain-route-ui';
import {validateVegetation,vegetationSpec,type VegetationInstance,type VegetationOverride} from './vegetation';
import {vegetationControls,vegetationInspector} from './vegetation-controls';
import {openVegetationSpatial} from './vegetation-spatial';
import {DEFAULT_TERRAIN_STYLE,type TerrainStyle} from './terrain-relief';
import {heightBrushBounds,heightBrushResolution,type HeightStroke} from './terrain-brush';
import {drawMeasurements,areaMeasures,pathMeasures,radiusMeasures} from './atlas-measurements';
import {atlasFieldValue,setAtlasFieldValue,setAtlasElevationField,lengthLabel} from './atlas-units';
import {landscapeRasterBounds} from './landscape-raster';
import {strokeBox} from './land-mask';
import {LandscapeToolSettings,lineControls,readLineControls} from "./landscape-tool-settings";
import {brushFootprint,type BrushMode} from "./landscape-brush";
import {newLine,linePoints,translateLine,splitLine} from "./landscape-line";
import { automaticGrid, gridMeters, travelHexSizes } from "./atlas-navigation-scale";
import {AtlasPaint,atlasPaint} from './atlas-paint';
import { pendingAtlasWrite } from "./campaign-atlas-author";
import type { AtlasRenderView, AtlasAction } from "./campaign-atlas-contracts";
import type { Point, Polygon } from "./contracts";
import {
  contains,
  emptyRecord,
  bounds as boundsOfColor,
  hexStrokesPolygons,
  distance,
  hexPolygon,
  type LandscapeBox,
  type LandscapeRecord,
  type LandscapeField,
} from "./atlas-landscape";
import {
  drawLandscape,
  drawLandscapeGrid,
  drawScale,
} from "./atlas-landscape-view";
import {
  newLocation,
  type LocationDocument,
} from "../features/location/location-schema";
import { atlasHexAt } from "./campaign-atlas-model";
const html = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
type Tool =
  | "vegetation" | "vegetation-area" | "vegetation-line" | "vegetation-clear" | "vegetation-thin" | "vegetation-dense" | "vegetation-object"
  | "select"
  | "height"
  | "smooth"
  | "color"
  | "property"
  | "freshwater"
  | "hex"
  | "reset"
  | "river"
  | "road"
  | "place"
  | "measure";
export class LandscapeWorkbench {
  readonly panel = document.createElement("section");
  private vegetationSettings=vegetationSpec();
  private spatialViewState={tilt:45,rotation:0,exaggeration:1};
  private vegetationFields=document.createElement('div');
  private vegetationInstance:VegetationInstance|undefined;
  private inspectorRoot: HTMLElement;
  private settings:LandscapeToolSettings;
  private draftSeed=crypto.getRandomValues(new Uint32Array(1))[0]!;
  private selectionRecords=new Map<string,LandscapeRecord>();
  private dragOrigin:Point|null=null;
  private hovering=false;

  readonly assets = new Map<string, string>();
  private unavailableAssets=new Set<string>();
  private background:{key:unknown[];node:AtlasPaint;box:LandscapeBox;selectedSlot:number}|null=null;
  private assetFence='';
  records: LandscapeRecord[] = [];
  private raster: import("./landscape-raster").LandscapeRaster[] | undefined;
  private token = "";
  private key = "";
  private publishedLayer: import("./atlas-region-contracts").AtlasLandscapeLayer|undefined;
  private request = 0;
  private selectionRequest=0;
  private minimumRevision=0;
  private active = false;
  private spacePan = false;
  private tool: Tool = "select";
  private points: Point[] = [];
  private brushStrokes: Point[][] = [];
  private maskStroke:HeightStroke|null=null;
  private colorDraft:ReturnType<LandscapeToolSettings['color']>|null=null;
  private maskStart=0;
  private maskTimer:ReturnType<typeof setTimeout>|undefined;
  private maskPreview:AtlasPaint|null=null;
  private maskGeneration=0;
  private brushWorker:Worker|null=null;
  private previewBusy=false;
  private pointer: number | null = null;
  private selected: LandscapeRecord | null = null;
  get selectionId(){return this.selected&&this.inspectorRoot.dataset.selectionId===this.selected.id?this.selected.id:null;}
  private vertex = 0;
  private dragging = false;
  private lineDragChanged = false;
  private releaseClick = false;
  private dirty = false;
  private saving = false;
  private measurement: Point[] = [];
  private doc: LocationDocument | null = null;
  private docRevision: number | null = null;
  private calibration: {
    record: LandscapeRecord;
    points: Point[];
  } | null = null;
  private lastPoint: Point = { x: 0, y: 0 };
  constructor(
    svg: HTMLCanvasElement,
    private host: {
      box: () => LandscapeBox;
      visibility?:()=>import("./terrain-spatial-model").TerrainView|undefined;
      navigate?:(box:LandscapeBox)=>void;
      hit:(e:MouseEvent,keys:string[])=>{data:Record<string,string>}|null;
      point:(e:MouseEvent)=>Point;
      refresh?:()=>Promise<unknown>;
      selected?:(id:string,kind:LandscapeRecord['kind'])=>void;
      choose?: (point:Point)=>Promise<void>;
      current?:()=>boolean;
      redraw: () => void;
      write: (a: AtlasAction) => Promise<unknown>;
      error: (e: unknown) => void;
      data: () => AtlasRenderView | null;
    },
  ) {
    this.panel.id = "atlas-landscape-tools";
    this.panel.hidden = true;
    this.panel.innerHTML = `<label>Werkzeug<select id="land-tool"><option value="select">Auswählen / Verlauf korrigieren</option><option value="height">Land formen</option><option value="smooth">Glätten</option><option value="color">Farbe auftragen / radieren</option><option value="property">Eigenschaften bearbeiten</option><option value="freshwater">Süßwasser bearbeiten</option><option value="hex">Hexfläche füllen</option><option value="reset">Eigenschaft zur Vorgabe zurücksetzen</option><option value="river">Fluss zeichnen</option><option value="road">Weg zeichnen</option><option value="place">Ort platzieren</option><option value="measure">Strecke messen</option></select></label><label>Eigenschaft<select id="land-field"><option value="terrain">Gelände</option><option value="elevationM">Höhe</option><option value="climate">Klima</option></select></label><label id="land-value-field">Wert<input id="land-value" placeholder="Höhe" value="0"></label><label>Pinselradius in m<input id="land-radius" type="number" min="1" value="500"></label><label>Verlaufstil<select id="land-line-style"><option value="path">Pfad / Bach</option><option value="road">Straße / Fluss</option></select></label><label>Verlaufbreite in m<input id="land-width" type="number" min="0.1" step="any" value="30"></label><p id="land-status" role="status">3 Meilen von Kante zu Kante. Orts-/Verlaufpunkte anklicken, dann abschließen.</p><div class="toolbar"><button id="land-finish">Zug abschließen</button><button id="land-cancel">Verwerfen</button><button id="land-reload" hidden>Ansicht erneut laden</button></div><label><input id="land-auto-level" type="checkbox" checked> Hexstufe automatisch anzeigen</label><label><input id="land-grid" type="checkbox" checked> Hexraster anzeigen</label><label>Objekt auswählen<select id="land-object"><option value="">Auf der Karte auswählen</option></select></label><div id="land-selection"></div><details><summary>Nachzeichenvorlage</summary><button id="land-reference">Bild laden und kalibrieren</button><label>Abstand der Bildpunkte in m<input id="land-calibration-distance" type="number" min="0.1" value="10000"></label><p>Nach dem Laden zwei Punkte im Bild anklicken. Anschließend Lage und Drehung bearbeiten.</p></details>`;
    const sea=document.createElement('details');sea.id='land-sea-options';sea.hidden=true;sea.innerHTML='<summary>Meeresspiegel</summary><label>Höhe in m<input id="land-sea-level" type="number" value="0" step="any"></label><button id="land-sea-apply" type="button">Meeresspiegel übernehmen</button>';this.panel.append(sea);
    sea.querySelector<HTMLButtonElement>('#land-sea-apply')!.onclick=()=>{if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}void this.commit({kind:'landscape-sea-level',seaLevelM:Number(html<HTMLInputElement>('land-sea-level').value)});};
    const relief=document.createElement('div');relief.innerHTML='<label>Höhenlinien<select id="land-contours"><option value="0">Aus</option><option value="10">Alle 10 m</option><option value="50">Alle 50 m</option><option value="100">Alle 100 m</option><option value="500">Alle 500 m</option></select></label><output id="land-cursor-height" aria-live="off">Höhe: –</output>';this.panel.append(relief);
    this.installReliefStyle();
    relief.querySelector('select')!.onchange=()=>{if(this.hasDraft()){this.say('Höhenlinien nach dem Pinselzug ändern.');html<HTMLSelectElement>('land-contours').value=String(this.contourInterval);return;}this.contourInterval=Number(html<HTMLSelectElement>('land-contours').value);this.panel.dispatchEvent(new Event('terrain-display-change',{bubbles:true}));};
    for(const [value,label]of [['vegetation','Landschaft malen'],['vegetation-area','Landschaft umgrenzen'],['vegetation-line','Hecke / Baumreihe'],['vegetation-clear','Freihalten'],['vegetation-thin','Ausdünnen'],['vegetation-dense','Verdichten'],['vegetation-object','Einzelbaum / Felsen']])this.panel.querySelector<HTMLSelectElement>('#land-tool')!.add(new Option(label!,value));
    this.vegetationFields.id='vegetation-options';this.panel.append(this.vegetationFields);
    vegetationControls(this.vegetationFields,'vegetation',this.vegetationSettings,()=>this.host.redraw());
    const layout=document.createElement('label');layout.textContent='Linienverteilung';layout.innerHTML+='<select id="vegetation-layout"><option value="natural">Natürlicher Saum</option><option value="row">Regelmäßige Reihe</option></select>';this.vegetationFields.append(layout);
    const spacing=document.createElement('label');spacing.textContent='Abstand in m';spacing.innerHTML+='<input id="vegetation-spacing" type="number" min="2" max="1000" value="12">';this.vegetationFields.append(spacing);
    const asset=document.createElement('label');asset.textContent='Einzelobjekt';asset.innerHTML+='<select id="vegetation-asset"><option value="oak">Laubbaum</option><option value="pine">Nadelbaum</option><option value="rock">Felsen</option><option value="shrub">Strauch</option></select>';this.vegetationFields.append(asset);
    const selectionFilter=document.createElement('label');selectionFilter.textContent='Bewuchs auswählen';
    selectionFilter.innerHTML+='<select id="vegetation-selection-filter"><option value="all">Alle sichtbaren Objekte</option><option value="trees">Bäume</option><option value="rocks">Felsen unter Baumkronen</option><option value="undergrowth">Unterwuchs unter Baumkronen</option></select>';this.panel.append(selectionFilter);
    const spatial=document.createElement('button');spatial.type='button';spatial.id='vegetation-spatial';spatial.textContent='Räumliche Landschaft';spatial.onclick=()=>{if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}void openVegetationSpatial({token:this.token,box:this.host.box(),viewState:this.spatialViewState,terrain:{settings:this.settings,radius:html<HTMLInputElement>('land-radius'),tool:this.tool,selection:this.selected?.id,choose:tool=>{this.tool=tool as Tool;html<HTMLSelectElement>('land-tool').value=tool;this.settings.show(tool);}},write:a=>this.commit(a),error:e=>this.host.error(e),navigate:b=>this.host.navigate?.(b),select:async(area,instance)=>{await this.host.refresh?.();await this.selectVegetation(area,instance);}}).catch(e=>this.host.error(e));};this.panel.append(spatial);
    this.inspectorRoot=this.panel.querySelector<HTMLElement>('#land-selection')!;
    html("atlas-tool-fields").after(this.panel);
    this.settings=new LandscapeToolSettings(this.panel,()=>{this.toolFields();this.host.redraw();},()=>{if(this.hasDraft()){this.say("Zuerst abschließen oder verwerfen.");return false;}return true;});
    const routePlan=document.createElement('button');routePlan.id='land-route-plan';routePlan.textContent='Geländegerecht planen';routePlan.type='button';this.settings.lineRoot.after(routePlan);
    routePlan.onclick=()=>{if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}void this.openRoute().catch(e=>this.host.error(e));};
    html<HTMLSelectElement>("land-tool").onchange = () => {
      // A ruler is temporary; leaving it must not require saving a drawing.
      if(this.tool==='measure'&&!this.saving&&this.pointer===null)this.points=[];
      if (this.hasDraft()) {
        html<HTMLSelectElement>("land-tool").value=this.tool;
        this.say("Zuerst abschließen oder verwerfen.");
        return;
      }
      this.tool = html<HTMLSelectElement>("land-tool").value as Tool;
      this.toolFields();
      this.say("Werkzeug wählen, auf der Karte arbeiten. Enter schließt Punktzüge ab; Escape verwirft.");
      this.measurement=[];
      this.selected = null;
      this.vegetationInstance=undefined;
      this.selectionRecords.clear();
      this.doc = null;
      html("land-selection").replaceChildren();
      this.host.redraw();
    };
    html<HTMLSelectElement>("land-object").onchange = () => {
      const r = this.records.find(
        (r) => r.id === html<HTMLSelectElement>("land-object").value,
      );
      if (r) void (this.host.data()?.region?.landscape?this.selectId(r.id):this.select(r)).catch((e) => this.host.error(e));
    };
    const property = () => {
      const field = html<HTMLSelectElement>("land-field").value;
      html("land-value-field").hidden = field === "terrain";
      setAtlasElevationField(html<HTMLInputElement>('land-value'),field==='elevationM');
      if (field === "climate")
        setAtlasFieldValue(html<HTMLInputElement>("land-value"), "temperate");
      else setAtlasFieldValue(html<HTMLInputElement>("land-value"), "0");
      html<HTMLInputElement>("land-value").placeholder =
        field === "climate"
          ? "temperate / cold / arid / tropical"
          : "Höhe";
    };
    html("land-field").onchange = () => { property(); this.toolFields(); };
    property();
    html("land-finish").onclick = () =>
      void this.finish().catch((e) => this.host.error(e));
    html("land-cancel").onclick = () => this.cancel();
    html("land-reload").onclick = () => void (async()=>{await (this.host.refresh?this.host.refresh():this.load(true));if(this.selected?.assetId&&!this.assets.has(this.selected.assetId))await this.selectId(this.selected.id);})().catch(e=>this.host.error(e));
    html("land-reference").onclick = () =>
      void this.importReference().catch((e) => this.host.error(e));
    html("land-grid").onchange = () => this.host.redraw();
    html("land-auto-level").onchange = () => { this.toolFields(); this.host.redraw(); };
    svg.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || e.button !== 0 || e.altKey || this.spacePan || this.saving) return;
        this.releaseClick = false;
        svg.focus({preventScroll:true});
        if(this.host.current&&!this.host.current()){this.say('Kartenausschnitt wird geladen. Zug danach beginnen.');return;}
        if (
          this.tool === "select" && !this.host.choose &&
          !this.hit(e, ["landscapeId","landVertex"])
        )
          return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.lastPoint = this.point(e);
        this.heightRead=null;this.heightPreviewM=null;
        if(this.settings.eyedropper){
          const b=svg.getBoundingClientRect(),pixel=svg.getContext('2d')?.getImageData(Math.floor((e.clientX-b.left)*svg.width/b.width),Math.floor((e.clientY-b.top)*svg.height/b.height),1,1).data;
          if(pixel)this.settings.sample('#'+[...pixel.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join(''));this.releaseClick=true;return;
        }
        const handle = this.selectionRecords.size>1?null:this.hit(e, ["landVertex"]);
        if (handle && this.selected) {
          if (this.selected.kind === "reference" && this.selected.locked)
            return;
          this.vertex = Number(handle.data.landVertex);
          this.dragging = true;
          this.lineDragChanged = false;
          this.pointer = e.pointerId;
          svg.setPointerCapture(e.pointerId);
          return;
        }
        if (this.tool === "select") {
          const filter=html<HTMLSelectElement>('vegetation-selection-filter').value;
          const plant=this.hit(e,[filter==='all'?'vegetationInstance':'vegetation-'+filter]);
          if(plant?.data.vegetationInstance&&plant.data.landscapeId){const record=this.records.find(r=>r.id===plant.data.landscapeId),instance=record?.vegetationView?.instances.find(i=>i.id===plant.data.vegetationInstance);if(instance){void this.selectVegetation(record!.id,instance).catch(e=>this.host.error(e));return;}}
          if(filter!=='all'){this.say('Kein Objekt des gewählten Typs an dieser Stelle.');return;}
          const id=this.hit(e,['landscapeId'])?.data.landscapeId;
          if(e.shiftKey&&id){void this.selectAdditional(id).catch(e=>this.host.error(e));return;}
          if(id&&this.selected&&(id===this.selected.id||this.selectionRecords.has(id))&&['river','road'].includes(this.selected.kind)){
            if(this.selected.route){void this.openRoute(this.selected).catch(e=>this.host.error(e));return;}
            this.vertex=-2;this.dragOrigin=this.lastPoint;this.dragging=true;this.lineDragChanged=false;this.pointer=e.pointerId;svg.setPointerCapture(e.pointerId);return;
          }
          if(this.host.choose){void this.host.choose(this.lastPoint).catch(e=>this.host.error(e));return;}
          const r = this.records.find(
            (r) =>
              r.id ===
              this.hit(e, ["landscapeId"])
                ?.data.landscapeId,
          );
          if (r) void this.select(r);
          return;
        }
        if (["height", "smooth", "color", "property", "freshwater", "hex", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense"].includes(this.tool)) {
          if (this.brushPointCount() >= 1000) {
            this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
            return;
          }
          if(this.maskStroke){this.say('Zuerst abschließen oder verwerfen.');return;}
          this.pointer = e.pointerId;
          if(this.tool==='color')this.colorDraft??={...this.settings.color(Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),this.draftSeed),visibility:this.host.visibility?.()};
          if(this.tool==='height'||this.tool==='smooth'){this.maskStart=e.timeStamp;this.maskStroke={...this.settings.height(),visibility:this.host.visibility?.(),seed:this.draftSeed,radius:Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),samples:[{...this.lastPoint,t:0}]};this.maskGeneration++;}
          if (this.points.length) this.brushStrokes.push(this.points);
          this.points = [this.lastPoint];
          if(this.tool==='height'||this.tool==='smooth'||this.tool==='color'){this.maskGeneration++;void this.previewMask();}
          svg.setPointerCapture(e.pointerId);
          this.host.redraw();
        }
      },
      true,
    );
    svg.addEventListener(
      "pointermove",
      (e) => {
        if(this.active&&this.pointer===null){this.lastPoint=this.point(e);this.hovering=true;this.cursorHeight();if(['height','smooth','color','property','freshwater','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool)||this.points.length)this.host.redraw();}
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = this.point(e);
        this.lastPoint = p;
        if(this.maskStroke){const events=e.getCoalescedEvents?.()??[];for(const sample of events.length?events:[e])if(this.maskStroke.samples.length<20000)this.maskStroke.samples.push({...this.point(sample),t:Math.min(300000,Math.max(0,sample.timeStamp-this.maskStart))});}
        if (this.dragging && this.selected) {
          if (this.selected.kind === "reference" && this.vertex === -1) {
            const o = this.selected.points[0]!,
              ratio =
                (this.selected.imageHeight ?? 1) /
                (this.selected.imageWidth ?? 1);
            this.selected.width =
              Math.hypot(p.x - o.x, p.y - o.y) / Math.hypot(1, ratio);
            this.selected.angle =
              Math.atan2(p.y - o.y, p.x - o.x) - Math.atan2(ratio, 1);
            setAtlasFieldValue(html<HTMLInputElement>("land-record-width"), String(
              this.selected.width,
            ));
            html<HTMLInputElement>("land-angle").value=String(
              (this.selected.angle * 180) / Math.PI,
            );
          } else if(this.vertex===-2&&this.dragOrigin){
            const dx=p.x-this.dragOrigin.x,dy=p.y-this.dragOrigin.y;
            for(const r of this.selectionRecords.size?[...this.selectionRecords.values()]:[this.selected])translateLine(r,dx,dy);
            this.dragOrigin=p;this.lineDragChanged ||= !!(dx||dy);
            setAtlasFieldValue(html<HTMLInputElement>('land-x'), String(this.selected.points[0]!.x));setAtlasFieldValue(html<HTMLInputElement>('land-y'), String(this.selected.points[0]!.y));
          } else {
            const before = this.selected.points[this.vertex];
            this.lineDragChanged ||= !!before && (before.x !== p.x || before.y !== p.y);
            this.selected.points[this.vertex] = p;
          }
          if (this.vertex === 0) {
            setAtlasFieldValue(html<HTMLInputElement>("land-x"), String(p.x));
            setAtlasFieldValue(html<HTMLInputElement>("land-y"), String(p.y));
          }
          this.dirty = true;
          if(this.selectionRecords.size>1)this.background=null;
        } else {
          const events=this.tool==='color'?(e.getCoalescedEvents?.()??[]):[];
          for(const sample of events.length?events:[e]){
          const p=this.point(sample);
          const previous = this.points.at(-1), size = gridMeters(html<HTMLSelectElement>("atlas-hex-level").value);
          const a = previous && atlasHexAt(previous, size), b = atlasHexAt(p, size);
          const changed = !previous || (this.tool === "hex"
            ? a!.q !== b.q || a!.r !== b.r
            : Math.hypot(p.x - previous.x, p.y - previous.y) > Math.max(1e-9, (this.colorDraft?.radius??Number(atlasFieldValue(html<HTMLInputElement>('land-radius')))) / 3));
          if (changed) {
            if (this.brushPointCount() < 1000) this.points.push(p);
            else this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
          }
          }
        }
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener(
      "pointerup",
      (e) => {
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        if(this.maskStroke)this.maskStroke.samples.push({...this.point(e),t:Math.min(300000,Math.max(0,e.timeStamp-this.maskStart))});
        clearTimeout(this.maskTimer);
        const commitLine = this.dragging && this.lineDragChanged &&
          (this.selected?.kind === "road" || this.selected?.kind === "river");
        if(!this.dragging&&['height','smooth','color','property','freshwater','hex','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool)&&this.brushPointCount()<1000){const p=this.point(e),last=this.points.at(-1);if(last&&(last.x!==p.x||last.y!==p.y))this.points.push(p);}
        this.pointer = null;
        this.dragging = false;
        this.lineDragChanged = false;
        if (commitLine) {
          this.releaseClick = true;
          void this.finish().catch(e => this.host.error(e));
        }
        if (["height", "smooth", "color", "property", "freshwater", "hex", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense"].includes(this.tool))
          void this.finish().catch(e=>this.host.error(e));
        if (svg.hasPointerCapture(e.pointerId))
          svg.releasePointerCapture(e.pointerId);
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener("pointercancel", () => {
      if(this.maskStroke)this.maskStroke.samples.push({...this.lastPoint,t:Math.min(300000,performance.now()-this.maskStart)});
      clearTimeout(this.maskTimer);
      this.pointer = null;
      this.dragging = false;
      this.say("Zug unterbrochen. Abschließen oder verwerfen.");
    });
    svg.addEventListener(
      "click",
      (e) => {
        if (!this.active || this.spacePan || e.altKey) return;
        // A saved handle drag still produces a click after pointerup. It must
        // not reach the Atlas picker and clear the just-edited selection.
        if (this.releaseClick || this.saving) {
          this.releaseClick = false;
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
        if (this.tool === "select") {
          if (
            this.hit(e, ["landscapeId","landVertex"])
          )
            e.stopImmediatePropagation();
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        if (["height", "smooth", "color", "property", "freshwater", "hex", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense"].includes(this.tool)) return;
        if (this.tool === "place" && this.selected) {
          if (this.dirty) {
            this.say("Ortsänderungen zuerst abschließen oder verwerfen.");
            return;
          }
          this.selected = null;
          this.doc = null;
          this.docRevision = null;
          html("land-selection").replaceChildren();
        }
        const p = this.point(e);
        this.lastPoint = p;
        if (this.calibration) {
          this.calibration.points.push(p);
          this.say(
            "Bildpunkt " +
              this.calibration.points.length +
              " von 2. Danach abschließen.",
          );
        } else {this.points.push(this.tool==='river'?this.snapRiver(p):p);this.say(this.points.length+" Punkte · Enter oder Zug abschließen übernimmt. Backspace entfernt den letzten Punkt.");}
        if (this.tool === "place")
          this.say('Ortspunkt gesetzt. Mit „Zug abschließen“ anlegen.');
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener('pointerleave',()=>{this.hovering=false;this.heightRead=null;this.heightPreviewM=null;html('land-cursor-height').textContent='Höhe: –';this.renderHeightPrecision();this.host.redraw();});
    svg.addEventListener('contextmenu',e=>{if(this.active&&['river','road'].includes(this.tool)){e.preventDefault();e.stopImmediatePropagation();void this.finish().catch(e=>this.host.error(e));}});
    svg.addEventListener("keydown", (e) => {
      if (!this.active || (e.target as HTMLElement).closest?.('input,select,textarea,[contenteditable=true]')) return;
      if(e.code==="Space"){this.spacePan=true;return;}
      if(e.key==="Backspace"){e.preventDefault();this.points.pop();this.host.redraw();return;}
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void this.finish().catch((e) => this.host.error(e));
      }
    });
    window.addEventListener("keyup",e=>{if(e.code==="Space")this.spacePan=false;});
    window.addEventListener("blur",()=>{this.spacePan=false;if(this.maskStroke&&this.pointer!==null){this.maskStroke.samples.push({...this.lastPoint,t:Math.min(300000,performance.now()-this.maskStart)});const pointer=this.pointer;this.pointer=null;clearTimeout(this.maskTimer);if(svg.hasPointerCapture(pointer))svg.releasePointerCapture(pointer);this.say('Zug unterbrochen. Abschließen oder verwerfen.');}});
  }
  private colorRecord(preview=false){
    const radius=this.colorDraft?.radius??Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),r=emptyRecord('patch');
    r.points=[...this.points];r.resolution=gridMeters(html<HTMLSelectElement>('atlas-hex-level').value);
    if(preview){
      const ps=[...this.brushStrokes.flat(),...this.points],xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),x=Math.min(...xs)-radius,y=Math.min(...ys)-radius,right=Math.max(...xs)+radius,bottom=Math.max(...ys)+radius;
      r.polygons=[{outer:[{x,y},{x:right,y},{x:right,y:bottom},{x,y:bottom}],holes:[]}];
    }else r.polygons=[...this.brushStrokes,this.points].flatMap(ps=>brushFootprint(ps,radius));
    r.paint={...(this.colorDraft??this.settings.color(radius,this.draftSeed)),strokes:[...this.brushStrokes,this.points].map(ps=>[...ps])};
    r.values={};return r;
  }
  get spatialTool(){return this.tool;}
  get spatialSelection(){return this.selected?.points[0]??this.selected?.polygons[0]?.outer[0]??null;}
  spatialDraft():import("./terrain-spatial-ui").TerrainDraft|null {
    if(this.maskStroke)return {heightStroke:{...this.maskStroke,samples:[...this.maskStroke.samples,...(this.pointer!==null?[{...this.lastPoint,t:Math.min(300000,Math.max(this.maskStroke.samples.at(-1)!.t,performance.now()-this.maskStart))}]:[])]}};
    if(this.tool==="color"&&this.points.length)return {color:this.colorRecord(true)};
    return null;
  }
  private async previewMask(){
    if(this.host.visibility?.()){this.host.redraw();if(this.pointer!==null)this.maskTimer=setTimeout(()=>void this.previewMask(),100);return;}
    if(this.previewBusy||(!this.maskStroke&&!(this.tool==='color'&&this.points.length)))return;
    const generation=this.maskGeneration,source=this.maskStroke;
    const stroke:HeightStroke|undefined=source?{...source,samples:[...source.samples,...(this.pointer!==null?[{...this.lastPoint,t:Math.min(300000,Math.max(source.samples.at(-1)!.t,performance.now()-this.maskStart))}]:[])]}:undefined;
    const color=stroke?undefined:this.colorRecord(true),frame=this.host.box();
    const b=stroke?strokeBox(stroke):color?.paint?.fill?frame:boundsOfColor(color!);
    const mpp=frame.width/Math.max(1,document.getElementById('campaign-map')!.clientWidth);
    const scale=Math.max(mpp,b.width/384,b.height/384),width=Math.max(1,Math.ceil(b.width/scale)),height=Math.max(1,Math.ceil(b.height/scale));
    this.previewBusy=true;
    try{
      const reply=await window.campaign.atlasMaskRegion(this.token,landscapeRasterBounds(stroke?heightBrushBounds(stroke):b,width,height));
      if(generation!==this.maskGeneration||!reply.ok){this.previewBusy=false;return;}
      this.brushWorker??=new Worker(new URL('atlas-brush-worker.js',document.baseURI));
      this.brushWorker.onmessage=(event:MessageEvent<{generation:number;pixels:Uint8Array;heightM?:number;protectedLimit?:number;error?:string}>)=>{
        if(generation!==this.maskGeneration)return;
        this.previewBusy=false;
        if(event.data.error)this.say(event.data.error);
        else {
          const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
          canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(event.data.pixels),width,height),0,0);
          this.maskPreview=atlasPaint('image',{source:canvas.toDataURL(),x:b.x,y:b.y,width:b.width,height:b.height,pointer:false,data:{editorOnly:'true',landMaskDraft:'true',landscapeRaster:'true'}});
          if(event.data.protectedLimit!==undefined)this.say('Pinselwirkung am geschützten Verlauf lokal begrenzt. Eingriffsgrenzen wären sonst überschritten.');
          if(event.data.heightM!==undefined){this.heightPreviewM=event.data.heightM;this.renderHeightPrecision();}
          this.host.redraw();
        }
        if(this.pointer!==null)this.maskTimer=setTimeout(()=>void this.previewMask(),100);
      };
      this.brushWorker.onerror=()=>{this.previewBusy=false;this.say('Pinselvorschau fehlgeschlagen.');};
      this.brushWorker.postMessage({generation,records:reply.value.records,box:b,width,height,heightStroke:stroke,color,contours:this.contours(),displayMpp:mpp});
    }catch(error){this.previewBusy=false;this.say((error as Error).message);}
  }
  private clearMask(){clearTimeout(this.maskTimer);this.maskGeneration++;this.maskStroke=null;this.heightPreviewM=null;this.colorDraft=null;this.maskPreview=null;this.previewBusy=false;this.brushWorker?.terminate();this.brushWorker=null;if(this.active&&this.hovering)this.cursorHeight();}
  private installReliefStyle(){
    const root=document.createElement('details');root.id='land-relief-style';
    root.innerHTML='<summary>Reliefstil</summary><label>Darstellung<select id="land-relief-mode"><option value="drawn">Gezeichnet</option><option value="shaded">Nur Schattierung</option><option value="height">Höhenfarben</option></select></label><label>Unbemaltes Land<input id="land-relief-land" type="color" value="#eee5cf"></label><label>Felsstriche<input id="land-relief-ink" type="color" value="#685639"></label><label>Licht aus Richtung (Grad)<input id="land-relief-light" type="number" min="0" max="359" value="315"></label><label>Strich- und Schattenstärke<input id="land-relief-strength" type="range" min="0" max="1" step="0.05" value="0.65"></label><button id="land-relief-apply" type="button">Reliefstil übernehmen</button><p>Nur Darstellung. Höhenfarben sind eine Analyseansicht; Höhe erzeugt weder Schnee noch Biome.</p>';
    this.panel.append(root);
    root.querySelector<HTMLButtonElement>('button')!.onclick=()=>{
      if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}
      const style:TerrainStyle={version:1,mode:html<HTMLSelectElement>('land-relief-mode').value as TerrainStyle['mode'],land:html<HTMLInputElement>('land-relief-land').value,ink:html<HTMLInputElement>('land-relief-ink').value,lightDegrees:Number(html<HTMLInputElement>('land-relief-light').value),strength:Number(html<HTMLInputElement>('land-relief-strength').value)};
      void this.commit({kind:'landscape-terrain-style',style});
    };
  }
  private showReliefStyle(style:TerrainStyle|undefined){
    const s=style??DEFAULT_TERRAIN_STYLE;
    for(const [id,value]of Object.entries({mode:s.mode,land:s.land,ink:s.ink,light:s.lightDegrees,strength:s.strength})){
      const field=html<HTMLInputElement>('land-relief-'+id);field.value=String(value);
    }
  }
  private contourInterval=0;
  private heightTimer:ReturnType<typeof setTimeout>|undefined;
  contours(){return this.contourInterval;}
  private heightPreviewM:number|null=null;
  private heightRead:{point:Point;heightM:number;resolutionM:number|null;generation:number;request:number}|null=null;
  private renderHeightPrecision(){
    // Keep the physical reading, not a label in the previous unit system.
    const height=this.heightPreviewM??this.heightRead?.heightM,resolution=this.heightRead?.resolutionM;
    const heightLabel=height===undefined?'Höhe: –':'Höhe: '+lengthLabel(height)+(this.heightPreviewM!==null?' · Vorschau':resolution==null?'':' · Auflösung: '+lengthLabel(resolution)),heightOutput=html('land-cursor-height');
    if(heightOutput.textContent!==heightLabel)heightOutput.textContent=heightLabel;
    const radius=Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),brush=heightBrushResolution(radius);
    const visible=this.active&&['height','smooth'].includes(this.tool)&&Number.isFinite(radius)&&radius>0;
    const output=this.settings.precisionRoot.querySelector<HTMLOutputElement>('#land-brush-resolution')!,label=visible?'Pinselauflösung: '+lengthLabel(brush):'';
    if(output.textContent!==label)output.textContent=label;
    const read=this.heightRead,point=this.lastPoint;
    const protectedPoint=visible&&this.hovering&&!this.maskStroke&&read&&read.generation===this.maskGeneration&&read.request===this.request&&read.point.x===point.x&&read.point.y===point.y&&read.resolutionM!==null&&read.resolutionM<brush;
    const hint=this.settings.precisionRoot.querySelector<HTMLElement>('#land-height-protection')!;hint.hidden=!protectedPoint;
    if(protectedPoint&&read.resolutionM!==null){
      const fixed=(document.getElementById('land-radius-fixed') as HTMLInputElement|null)?.checked;
      const protection='Feine Höhendetails ('+lengthLabel(read.resolutionM)+') bleiben geschützt.',remedy='Radius verkleinern'+(fixed?'':' oder näher heranzoomen')+'.',text=protection+' '+remedy;
      if(hint.textContent!==text)hint.textContent=text;
      return [html('land-cursor-height').textContent??'',label,protection,remedy];
    }
    return [];
  }
  private cursorHeight(){
    if(this.heightTimer||this.maskStroke)return;
    this.heightTimer=setTimeout(async()=>{
      const token=this.token,p={...this.lastPoint},generation=this.maskGeneration,request=this.request;
      try{const r=await window.campaign.atlasHeight(token,p);
        if(token===this.token&&generation===this.maskGeneration&&request===this.request&&!this.maskStroke&&this.hovering&&p.x===this.lastPoint.x&&p.y===this.lastPoint.y&&r.ok){
          this.heightPreviewM=null;this.heightRead={point:p,heightM:r.value.heightM,resolutionM:r.value.resolutionM,generation,request};
          this.renderHeightPrecision();this.host.redraw();
        }
      }catch{/* A stale point must not replace a current height. */}finally{this.heightTimer=undefined;}
    },100);
  }
  private hit(e:MouseEvent,keys:string[]){return this.host.hit(e,keys);}
  private point(e: MouseEvent) {
    return this.host.point(e);
  }
  private say(s: string) {
    html("land-status").textContent = s;
  }
  private brushPointCount() {
    return this.points.length + this.brushStrokes.reduce((count, points) => count + points.length, 0);
  }
  get selectedLabel(){return this.selected?(this.selected.kind==='place'?'place:':'landscape:')+this.selected.id:undefined;}
  hasDraft() {
    return (
      (this.tool !== "measure" && this.points.length > 0) ||
      this.dirty ||
      !!this.calibration ||
      this.pointer !== null ||
      this.saving
    );
  }
  cancel() {
    this.clearMask();
    this.points = [];
    this.brushStrokes = [];
    this.measurement=[];
    this.dirty = false;
    this.pointer = null;
    this.calibration = null;
    this.dragging = false;
    this.selected = null;
    this.selectionRecords.clear();
    this.draftSeed=crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.doc = null;
    html("land-selection").replaceChildren();
    this.say("Zug verworfen.");
    this.host.redraw();
  }
  planTerrainRoute(kind:'road'|'river',tilt=45){return openTerrainRoute({token:this.token,box:this.host.box(),kind,tilt,navigate:b=>this.host.navigate?.(b),write:a=>this.commit(a),changed:()=>this.host.refresh?.()??Promise.resolve()});}
  private openRoute(record?:LandscapeRecord){return openTerrainRoute({token:this.token,box:this.host.box(),record,kind:record?.kind==='river'||this.tool==='river'?'river':'road',tilt:0,navigate:b=>this.host.navigate?.(b),write:a=>this.commit(a),changed:()=>this.host.refresh?.()??Promise.resolve()});}
  private toolFields() {
    const routePlan=document.getElementById('land-route-plan');if(routePlan)routePlan.hidden=this.tool!=='road'&&this.tool!=='river';
    this.settings.show(this.tool);
    this.vegetationFields.hidden=!this.tool.startsWith('vegetation');
    setAtlasElevationField(html<HTMLInputElement>('land-value'),html<HTMLSelectElement>('land-field').value==='elevationM');
    const brush = ["property", "hex", "reset"].includes(this.tool),
      line = ["river", "road"].includes(this.tool);
    for (const [id, visible] of [
      ["land-field", brush],
      [
        "land-value",
        brush && html<HTMLSelectElement>("land-field").value !== "terrain",
      ],
      ["land-radius", ["height", "smooth", "color", "property", "freshwater", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense", "vegetation-line"].includes(this.tool)],
      ["land-line-style", false],
      ["land-width", line],
      ["land-object", this.tool === "select"],
      ["vegetation-selection-filter", this.tool === "select"],
    ] as const)
      html(id).closest("label")!.hidden = !visible;
    const terrain = document.getElementById("atlas-terrain")?.closest("label");
    if (terrain) terrain.hidden = this.active && !(brush && html<HTMLSelectElement>("land-field").value === "terrain");
    const hex = document.getElementById("atlas-hex-level")?.closest("label");
    if (hex) hex.hidden = this.active && this.tool !== "hex" && html<HTMLInputElement>("land-auto-level").checked;
    const name = document.getElementById("atlas-new-name")?.closest("label");
    if (name) {
      name.hidden = this.active && !["place", "river", "road"].includes(this.tool);
      name.firstChild!.textContent = this.active
        ? this.tool === "place" ? "Name für neuen Ort" : "Name für neuen Verlauf"
        : "Name";
    }
  }
  setActive(active: boolean) {
    this.active = active;
    this.panel.hidden = !active;
    const palette = ["atlas-terrain", "atlas-hex-level"].flatMap(id => {
      const label = document.getElementById(id)?.closest("label");
      return label ? [label] : [];
    });
    if (active) html("land-tool").closest("label")!.after(...palette);
    else html("atlas-tool-fields").prepend(...palette);
    this.toolFields();
  }
  context(token: string) {
    if (this.token === token) return;
    this.token = token;
    this.heightRead=null;this.heightPreviewM=null;html('land-cursor-height').textContent='Höhe: –';
    this.autoGrid=null;this.gridFade=null;
    this.cancel();
    this.records = [];this.background=null;
    this.raster = undefined;this.publishedLayer=undefined;this.minimumRevision=0;
    this.assets.clear();this.unavailableAssets.clear();this.assetFence='';
    this.key = "";
    this.request++;
  }
  async openLocation(id: string, sectionId?: string) {
    const token = this.token,
      r = await window.campaign.landscapeFind(token, id);
    if (token !== this.token) return;
    if (!r.ok) throw new Error(r.error);
    const record = r.value.find((r) => r.locationId === id);
    if (!record) throw new Error("Ort ist nicht im Atlas platziert.");
    await this.select(record);
    if (sectionId) {
      const section = this.inspectorRoot.querySelector<HTMLTextAreaElement>(
        `[data-section-body="${sectionId}"]`,
      );
      if (section) {
        section.scrollIntoView({ block: "nearest" });
        section.focus();
      }
    }
    return record.points[0];
  }
  invalidate(revision:number){if(Number.isSafeInteger(revision)&&revision>=this.minimumRevision){this.minimumRevision=revision;this.request++;this.key="";}}
  async load(force = false) {
    const data = this.host.data();
    if (!data || !this.token || data.revision<this.minimumRevision) return;
    const token=this.token;
    const layer=data.region?.landscape;
    if(layer){
      const frameKey=JSON.stringify([token,data.region!.fence]);
      if(this.assetFence!==data.region!.fence){
        const calibration=this.calibration?.record.assetId,preview=calibration?this.assets.get(calibration):undefined;
        this.assets.clear();this.unavailableAssets.clear();if(calibration&&preview)this.assets.set(calibration,preview);
        this.assetFence=data.region!.fence;
      }
      if(!force&&this.key===frameKey&&this.publishedLayer===layer)return;
      if(layer.state==='ready'){
        const style=layer.terrainStyle??DEFAULT_TERRAIN_STYLE,previous=this.publishedLayer?.terrainStyle??DEFAULT_TERRAIN_STYLE;
        // Camera reads retain the whole form. Only a new confirmed style (or
        // campaign) replaces it, including a focused field after undo/redo.
        if(!this.publishedLayer||(Object.keys(DEFAULT_TERRAIN_STYLE) as (keyof TerrainStyle)[]).some(key=>style[key]!==previous[key]))this.showReliefStyle(style);
        this.publishedLayer=layer;
      }
      this.key=frameKey;
      this.request++;const generation=this.request;
      this.records=layer.records;this.raster=layer.tiles;if(document.activeElement!==html('land-sea-level'))html<HTMLInputElement>('land-sea-level').value=String(layer.seaLevelM??0);html('land-reload').hidden=layer.state==='ready';
      this.say(layer.state==='error'?layer.error??'Landschaft nicht verfügbar.':layer.coverage.mode==='raster'?'Dichte Landschaft als Übersicht. Anklicken liest das genaue Objekt.'+(layer.coverage.references>layer.records.filter(r=>r.kind==='reference').length?' Vorlagen sind als Umrisse dargestellt.':''):'Landschaft geladen.');
      this.objectOptions();this.host.redraw();
      const visibleAssets=new Set(this.records.filter(r=>r.kind==='reference'&&r.visible!==false).map(r=>r.assetId));
      for(const id of this.assets.keys())if(!visibleAssets.has(id)&&id!==this.calibration?.record.assetId)this.assets.delete(id);
      for(const id of this.unavailableAssets)if(!visibleAssets.has(id))this.unavailableAssets.delete(id);
      for(const r of this.records)if(r.assetId&&r.visible!==false&&!this.assets.has(r.assetId)){
        let result:import('./contracts').Result<string>;
        try{result=await window.campaign.referenceAssetPreview(token,r.assetId,1024);}catch(error){result={ok:false,error:(error as Error).message};}
        if(token!==this.token||generation!==this.request||this.host.data()?.region?.fence!==data.region?.fence)return;
        if(result.ok){this.unavailableAssets.delete(r.assetId);this.rememberAsset(r.assetId,result.value);}else {this.unavailableAssets.add(r.assetId);html('land-reload').hidden=false;this.say('Eine Bildvorlage ist nicht verfügbar. Erneut laden; übrige Karte bleibt nutzbar.');}
        this.host.redraw();
      }
      return;
    }
    // The shared Atlas frame owns loading, cancellation and source identity.
    // Never reconstruct a second landscape view from independent reads.
    this.request++;
    this.records=[];this.raster=undefined;this.background=null;this.key="";this.objectOptions();
    html("land-reload").hidden=false;
    this.say("Landschaftsframe nicht verfügbar. Ansicht erneut laden.");
    this.host.redraw();
  }
  private rememberAsset(id:string,data:string){
    const limit=8*1024*1024,size=data.length*2;if(size>limit){this.say('Bildvorschau zu groß. Original bleibt erhalten.');return;}
    this.assets.delete(id);let bytes=[...this.assets.values()].reduce((n,v)=>n+v.length*2,0);
    while(bytes+size>limit&&this.assets.size){const [key,value]=this.assets.entries().next().value!;this.assets.delete(key);bytes-=value.length*2;}
    this.assets.set(id,data);
  }
  private objectOptions(){
    const select=html<HTMLSelectElement>('land-object');select.replaceChildren(new Option('Auf der Karte auswählen',''));
    const records=this.selected&&!this.records.some(r=>r.id===this.selected!.id)?[...this.records,this.selected]:this.records;
    for(const r of records)select.add(new Option(r.name||r.kind,r.id));select.value=this.selected?.id??'';
  }
  async selectId(id:string){
    // Explicit selection leaves a temporary ruler just like a tool change.
    if(this.tool==='measure'&&!this.saving&&this.pointer===null){this.points=[];this.measurement=[];}
    const token=this.token,frame=this.host.data()?.region?.fence,generation=++this.selectionRequest;
    if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}
    const response=await window.campaign.atlasLandscapeObject(token,id);
    if(token!==this.token||generation!==this.selectionRequest||frame!==this.host.data()?.region?.fence)return;
    if(!response.ok)throw new Error(response.error);this.tool="select";html<HTMLSelectElement>("land-tool").value=this.tool;this.toolFields();await this.select(response.value);
  }
  draw(root: AtlasPaint, box: LandscapeBox, mpp: number) {
    const landscapeNode=atlasPaint;
    const key=[this.records,this.raster,this.selectionRecords.size,this.selected?.id,this.selected?.resolution,this.selected?.order,mpp,...[...this.assets].flat(),...this.unavailableAssets];
    let background=this.background;
    if(!background||background.key.length!==key.length||!background.key.every((v,i)=>v===key[i])){
      const node=atlasPaint('group',{retainGeometry:true});
      drawLandscape(node,this.selected?[...this.records.filter(r=>r.id!==this.selected!.id&&!this.selectionRecords.has(r.id)),...(this.selectionRecords.size?[...this.selectionRecords.values()]:[this.selected])]:this.records,box,mpp,this.assets,true,this.raster,this.unavailableAssets,true);
      this.background=background={key,node,box:{...box},selectedSlot:this.selected?node.children.findIndex(n=>n.data.landscapeId===this.selected!.id):-1};
    }
    const retained=atlasPaint('group',{matrix:[1,0,0,1,background.box.x-box.x,background.box.y-box.y],data:{atlasLandscapeBase:'true'}});
    let node=background.node;
    if(this.selected&&background.selectedSlot>=0&&this.selectionRecords.size<=1){
      // Keep the original painter slot, especially for references below terrain.
      const selected=atlasPaint('group');drawLandscape(selected,[this.selected.vegetation?{...this.selected,vegetationView:this.records.find(r=>r.id===this.selected!.id)?.vegetationView}:this.selected],background.box,mpp,this.assets,true,this.raster,this.unavailableAssets,true);
      node=atlasPaint('group',{retainGeometry:true});node.append(...background.node.children);
      node.children[background.selectedSlot]=selected.children.find(n=>n.data.landscapeId===this.selected!.id)!;
    }
    retained.append(node);root.append(retained);
    const pts =
      this.calibration?.points ??
      (this.points.length ? this.points : this.measurement);
    if(this.maskStroke||(this.tool==='color'&&this.points.length)){
      if(this.maskPreview){const group=atlasPaint('group',{matrix:[1,0,0,1,-box.x,-box.y],pointer:false,data:{editorOnly:'true'}});group.append(this.maskPreview);root.append(group);}
    } else if (pts.length && this.tool === "hex") {
      try {
        const polygons = hexStrokesPolygons([...this.brushStrokes, pts], gridMeters(html<HTMLSelectElement>("atlas-hex-level").value));
        root.append(landscapeNode("polygons", {polygons: polygons.map(p => ({outer: p.outer.map(v => ({x:v.x-box.x,y:v.y-box.y})), holes: []})), pointer:false, opacity:0.6, style:{fill:"#d46e38",stroke:"#d46e38",lineWidth:mpp}, data:{editorOnly:"true",landHexDraft:"true"}}));
      } catch (error) { this.say((error as Error).message); }
    } else if(pts.length&&['river','road'].includes(this.tool)){
      const r=this.draftLine([...pts,...(this.hovering?[this.tool==='river'?this.snapRiver(this.lastPoint):this.lastPoint]:[])]);
      const preview=atlasPaint('group',{pointer:false,data:{editorOnly:'true'}});drawLandscape(preview,[r],box,mpp,this.assets);root.append(preview);
    } else if (pts.length) {
      for (const path of (["height", "smooth", "color", "property", "freshwater", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense", "vegetation-line"].includes(this.tool) ? [...this.brushStrokes, pts] : [pts])) {
      root.append(
        landscapeNode("polyline", {points: path.map(p=>({x:p.x-box.x,y:p.y-box.y})), opacity: 0.6, style: {fill: null, stroke: "#d46e38", lineWidth: ["height", "smooth", "color", "property", "freshwater", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense", "vegetation-line"].includes(this.tool)
            ? Number(atlasFieldValue(html<HTMLInputElement>("land-radius"))) * 2
            : mpp * 3, lineCap: "round", lineJoin: "round"}, data: {editorOnly: String("true")}}),
      );
      for (const p of path)
        root.append(
          landscapeNode("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 4, style: {fill: "#d46e38"}, data: {editorOnly: String("true")}}),
        );
      }
      if (this.tool === "measure") this.say(lengthLabel(distance(pts)));
    }
    if(this.active&&this.hovering&&['height','smooth','color','property','freshwater','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool))root.append(landscapeNode('circle',{x:this.lastPoint.x-box.x,y:this.lastPoint.y-box.y,radius:Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),pointer:false,style:{fill:null,stroke:'#364354',lineWidth:mpp},data:{editorOnly:'true'}}));
    if(this.active&&this.selectionRecords.size>1)for(const r of this.selectionRecords.values())root.append(landscapeNode('polyline',{points:linePoints(r).map(p=>({x:p.x-box.x,y:p.y-box.y})),pointer:false,style:{fill:null,stroke:'#d46e38',lineWidth:mpp*2,lineDash:[mpp*4,mpp*3]},data:{editorOnly:'true'}}));
    if (this.calibration)
      drawLandscape(root, [this.calibration.record], box, mpp, this.assets);
    if (this.selected && !this.selected.vegetation && !this.selected.route && this.active && this.tool === "select" && this.selectionRecords.size<=1)
      this.selected.points.forEach((p, i) =>
        root.append(
          landscapeNode("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 6, style: {fill: i === this.vertex ? "#e1984b" : "#fff", stroke: "#a55d35", lineWidth: mpp * 2}, data: {landVertex: String(i), editorOnly: String("true")}}),
        ),
      );
    if (
      this.selected?.kind === "reference" &&
      !this.selected.locked &&
      this.active
    ) {
      const r = this.selected,
        o = r.points[0]!,
        w = r.width,
        h = (w * (r.imageHeight ?? 1)) / (r.imageWidth ?? 1),
        a = r.angle ?? 0;
      root.append(
        landscapeNode("circle", {x: o.x + w * Math.cos(a) - h * Math.sin(a) - box.x, y: o.y + w * Math.sin(a) + h * Math.cos(a) - box.y, radius: mpp * 7, style: {fill: "#e1984b"}, data: {landVertex: String(-1), editorOnly: String("true")}}),
      );
    }
  }

  private draftLine(points:Point[]):LandscapeRecord {
    const kind=this.tool==='river'?'river':'road',r=emptyRecord(kind);r.points=points;r.width=Number(atlasFieldValue(html<HTMLInputElement>('land-width')));r.line=this.settings.line(kind,this.draftSeed);return r;
  }
  private snapRiver(p:Point):Point{
    const tolerance=this.host.box().width/Math.max(1,document.getElementById('campaign-map')?.getBoundingClientRect().width??1000)*8;
    let nearest=p,best=tolerance;
    for(const r of this.records.filter(r=>r.kind==='river')){const pts=linePoints(r);for(let i=1;i<pts.length;i++){
      const a=pts[i-1]!,b=pts[i]!,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(q.x-p.x,q.y-p.y);
      if(d<best){nearest=q;best=d;}
    }}return nearest;
  }
  private async selectAdditional(id:string){
    if(this.hasDraft())throw Error('Änderung zuerst abschließen oder verwerfen.');
    const token=this.token,frame=this.host.data()?.region?.fence,response=await window.campaign.atlasLandscapeObject(token,id);
    if(token!==this.token||frame!==this.host.data()?.region?.fence)return;
    if(!response.ok)throw Error(response.error);const r=response.value;
    if(!['river','road'].includes(r.kind))return;
    if(r.route||this.selected?.route){await this.select(r);return;}
    if(!this.selected||!['river','road'].includes(this.selected.kind)){await this.select(r);return;}
    if(this.selected.kind!==r.kind){this.say('Straßen und Flüsse getrennt gemeinsam bearbeiten.');return;}
    if(!this.selectionRecords.size)this.selectionRecords.set(this.selected.id,this.selected);
    if(this.selectionRecords.has(id)&&id!==this.selected.id)this.selectionRecords.delete(id);else this.selectionRecords.set(id,id===this.selected.id?this.selected:structuredClone(r));
    this.inspector();this.background=null;this.host.redraw();
  }

  drawMeasurements(root:AtlasPaint,box:LandscapeBox,mpp:number){
    if(!this.active)return;
    let anchor=this.lastPoint,lines:string[]=[];
    const brush=['height','smooth','color','property','freshwater','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool);
    if(brush&&this.hovering)lines=radiusMeasures(Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))));
    else if(this.tool==='hex'&&this.hovering)lines=areaMeasures([hexPolygon(0,0,gridMeters(html<HTMLSelectElement>('atlas-hex-level').value))]);
    else if(['river','road','measure'].includes(this.tool)&&(this.points.length||this.measurement.length)){
      const points=[...(this.points.length?this.points:this.measurement),...(this.hovering&&this.points.length?[this.tool==='river'?this.snapRiver(this.lastPoint):this.lastPoint]:[])];
      const record=this.tool==='measure'?null:this.draftLine(points);
      lines=pathMeasures(record?linePoints(record):points,record?.width);
      anchor=points.at(-1)??anchor;
    }else if(this.selected&&this.tool==='select'){
      const r=this.selected;anchor=r.points.at(-1)??r.polygons[0]?.outer[0]??anchor;
      if(r.kind==='road'||r.kind==='river')lines=pathMeasures(linePoints(r),r.width);
      else if(r.kind==='patch')lines=areaMeasures(r.polygons);
      else if(r.kind==='reference')lines=[`${lengthLabel(r.width)} × ${lengthLabel(r.width*(r.imageHeight??1)/(r.imageWidth??1))}`];
    }
    if(brush&&this.hovering&&['height','smooth'].includes(this.tool)){
      const protection=this.renderHeightPrecision();if(protection.length)lines=protection;
    }
    drawMeasurements(root,box,mpp,anchor,lines);
  }
  private autoGrid: string | null = null;
  private gridFade: {from: string; to: string; start: number} | null = null;
  drawOverlay(root: AtlasPaint, box: LandscapeBox, mpp: number): boolean {
    this.renderHeightPrecision();
    const input = html<HTMLSelectElement>('atlas-hex-level');
    const draft = this.hasDraft();
    html('land-finish').hidden = html('land-cancel').hidden = !draft;
    input.disabled = draft;
    html<HTMLInputElement>('land-auto-level').disabled = draft;
    const auto = html<HTMLInputElement>('land-auto-level').checked && !draft;
    let level = input.value;
    if (auto) {
      level = automaticGrid(mpp, this.autoGrid);
      if (level !== this.autoGrid) {
        const old = this.autoGrid;
        this.autoGrid = level;
        this.gridFade = old ? {from:old,to:level,start:performance.now()} : null;
      }
      input.value = level;
    } else this.gridFade = null;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = this.gridFade && !reduced ? Math.min(1,(performance.now()-this.gridFade.start)/180) : 1;
    if (html<HTMLInputElement>('land-grid').checked) {
      if (this.gridFade && t < 1) {
        const old = atlasPaint('group',{opacity:1-t});
        drawLandscapeGrid(old,box,this.gridFade.from,mpp);root.append(old);
      }
      const current = atlasPaint('group',{opacity:t});
      drawLandscapeGrid(current,box,level,mpp);root.append(current);
    }
    drawScale(root,box,mpp,html<HTMLInputElement>('land-grid').checked?level:undefined);
    if(this.active && auto) {
      const preset=travelHexSizes.find(p=>p.id===level)!;
      this.sayIfIdle(`${preset.label} · ${lengthLabel(preset.meters)} Kante zu Kante · 8 Reisestunden/Tag`);
    }
    if(t===1)this.gridFade=null;
    return t<1;
  }
  private sayIfIdle(s: string) {
    if (!(this.tool === "measure" && (this.points.length || this.measurement.length)) && !this.hasDraft() && !this.selected && html("land-status").textContent!=="Gespeichert") this.say(s);
  }
  recovered() {
    this.cancel();
    this.disable(false);
  }
  private disable(value: boolean) {
    for(const root of [this.panel,this.inspectorRoot])root
      .querySelectorAll<
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLButtonElement
        | HTMLTextAreaElement
      >("input,select,button,textarea")
      .forEach((n) => (n.disabled = value));
  }
  private async commit(a: AtlasAction) {
    // Reject invalid visible drafts before journaling or taking a source fence.
    // Main repeats this same domain validation at the canonical write boundary.
    if(a.kind==='landscape-put'||a.kind==='landscape-place')validateVegetation(a.record);
    else if(a.kind==='landscape-batch')for(const {record} of a.records)validateVegetation(record);
    const token = this.token,
      keep = this.tool === 'select' && a.kind === 'landscape-put' &&
        (a.record.kind === 'road' || a.record.kind === 'river')
        ? a.record.id
        : null;
    this.saving = true;
    this.disable(true);
    try {
      const r = await this.host.write(a);
      if (!r)
        throw new Error("Änderung nicht bestätigt. Entwurf bleibt erhalten.");
      if (token !== this.token) return r;
      this.clearMask();
      this.points = [];
      this.brushStrokes = [];
      this.selectionRecords.clear();
      this.draftSeed = crypto.getRandomValues(new Uint32Array(1))[0]!;
      this.dirty = false;
      this.calibration = null;
      this.selected = null;
      this.selectionRecords.clear();
      this.doc = null;
      html("land-selection").replaceChildren();
      this.key = "";
      await this.load(true);
      if (keep) {
        const fence = this.host.data()?.region?.fence;
        // The acknowledged edit has a new revision. Read it before accepting
        // another handle drag; never reuse the pre-save inspector snapshot.
        try {
          const latest = await window.campaign.atlasLandscapeObject(token, keep);
          if (token !== this.token || fence !== this.host.data()?.region?.fence)
            return r;
          if (latest.ok) {
            this.selected = structuredClone(latest.value);
            this.inspector();
            this.objectOptions();
          }
        } catch { /* The edit is saved; reopening the selection remains available. */ }
      }
      this.say(keep && !this.selected
        ? "Gespeichert. Objekt erneut auswählen."
        : "Gespeichert");
      return r;
    } finally {
      this.saving = false;
      this.disable(!!pendingAtlasWrite(this.token));
      this.host.redraw();
    }
  }
  async finish() {
    if (this.pointer !== null || this.saving) return;
    if (this.calibration) {
      const { record, points } = this.calibration;
      if (points.length !== 2)
        throw new Error("Zwei Referenzpunkte im Bild wählen.");
      const measured = distance(points),
        meters = Number(
          atlasFieldValue(html<HTMLInputElement>("land-calibration-distance")),
        );
      if (measured <= 0 || meters <= 0)
        throw new Error("Positive Kalibrierstrecke wählen.");
      const ratio = meters / measured,
        p = record.points[0]!;
      record.points = [
        {
          x: points[0]!.x + (p.x - points[0]!.x) * ratio,
          y: points[0]!.y + (p.y - points[0]!.y) * ratio,
        },
      ];
      record.width *= ratio;
      return this.commit({
        kind: "landscape-put",
        record,
        expectedRevision: null,
      });
    }
    if (this.selected) {
      this.readInspector();
      if (this.selectionRecords.size > 1)
        return this.commit({
          kind: 'landscape-batch',
          records: [...this.selectionRecords.values()].map(record => ({
            record,
            expectedRevision: record.revision,
          })),
        });
      if (this.selected.kind === "place" && this.doc)
        return this.commit({
          kind: "landscape-place",
          record: this.selected,
          document: this.doc,
          expectedRevision: this.selected.revision,
          expectedLocationRevision: this.docRevision,
        });
      return this.commit({
        kind: "landscape-put",
        record: this.selected,
        expectedRevision: this.selected.revision,
      });
    }
    if (this.tool === "measure") {
      this.say(lengthLabel(distance(this.points)));
      this.measurement = this.points;
      this.points = [];
      this.host.redraw();
      return;
    }
    if (!this.points.length) return;
    if(this.tool.startsWith('vegetation'))return this.finishVegetation();
    if(this.maskStroke)return this.commit({kind:'landscape-height-stroke',stroke:this.maskStroke});
    if(this.tool==='color')return this.commit({kind:'landscape-color-stroke',record:this.colorRecord()});
    const res = gridMeters(html<HTMLSelectElement>("atlas-hex-level").value);
    if (["height", "smooth", "color", "property", "freshwater", "hex", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense"].includes(this.tool)) {
      let polygons: Polygon[];
      if (this.tool === "hex") {
        polygons = hexStrokesPolygons([...this.brushStrokes, this.points], res);
      } else {
        const radius = Number(atlasFieldValue(html<HTMLInputElement>("land-radius")));
        if (!Number.isFinite(radius) || radius <= 0)
          throw new Error("Pinselradius prüfen.");
        polygons = [...this.brushStrokes, this.points].flatMap(points =>
          brushFootprint(points, radius));
      }
      if(this.tool==='freshwater'){
        const mode=this.settings.mode() as Exclude<BrushMode,'terrain'>,radius=Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),r=emptyRecord('patch');
        if(html<HTMLInputElement>('land-water-level').value!=='')r.waterLevelM=Number(html<HTMLInputElement>('land-water-level').value);r.points=this.points;r.polygons=polygons;r.resolution=res;r.values={terrain:html<HTMLSelectElement>('atlas-terrain').value as any};
        return this.commit({kind:'landscape-brush',record:r,mode,radius,roughness:0,seed:this.draftSeed,fill:!!r.paint?.fill});
      }
      const field = html<HTMLSelectElement>("land-field").value as LandscapeField;
      if (this.tool === "reset")
        return this.commit({
          kind: "landscape-reset",
          propertyOnly: true,
          polygons,
          field,
          resolution: res,
        });
      const r = emptyRecord("patch"),
        raw = atlasFieldValue(html<HTMLInputElement>("land-value"));
      r.propertyOnly=true;
      r.resolution = res;
      r.polygons = polygons;
      r.values =
        field === "terrain"
          ? { terrain: html<HTMLSelectElement>("atlas-terrain").value as any }
          : field === "elevationM"
            ? { elevationM: Number(raw) }
            : { climate: raw as any };
      return this.commit({
        kind: "landscape-put",
        record: r,
        expectedRevision: null,
      });
    }
    if (this.tool === "river" || this.tool === "road") {
      if (this.points.length < 2)
        throw new Error("Mindestens zwei Verlaufpunkte wählen.");
      const r = this.draftLine(this.points);
      r.width = Number(atlasFieldValue(html<HTMLInputElement>("land-width")));
      r.name = html<HTMLInputElement>("atlas-new-name").value;
      r.style = (
        this.tool === "river"
          ? html<HTMLSelectElement>("land-line-style").value === "path"
            ? "stream"
            : "river"
          : html<HTMLSelectElement>("land-line-style").value
      ) as LandscapeRecord["style"];
      return this.commit({
        kind: "landscape-put",
        record: r,
        expectedRevision: null,
      });
    }
    if (this.tool === "place") {
      const r = emptyRecord("place");
      r.points = [this.points.at(-1)!];
      r.name = html<HTMLInputElement>("atlas-new-name").value || "Neuer Ort";
      const doc = newLocation(crypto.randomUUID(), r.name, "poi", [
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]);
      r.locationId = doc.id;
      await this.commit({
        kind: "landscape-place",
        record: r,
        document: doc,
        expectedRevision: null,
        expectedLocationRevision: null,
      });
      const saved = this.records.find((p) => p.id === r.id);
      if (saved) await this.select(saved);
    }
  }
  async select(record: LandscapeRecord) {
    if (this.hasDraft()) {
      this.say("Zuerst abschließen oder verwerfen.");
      return;
    }
    this.selected = structuredClone(record);
    this.selectionRecords.clear();
    this.doc = null;
    this.docRevision = null;
    this.vertex = 0;
    const token = this.token,frame=this.host.data()?.region?.fence;
    if (record.locationId) {
      const r = await window.campaign.deskContent(token, {kind:"location",id:record.locationId});
      if (token !== this.token || this.selected?.id !== record.id || frame!==this.host.data()?.region?.fence) return;
      if (!r.ok) throw new Error(r.error);
      if (!r.value.location || r.value.unavailable)throw new Error("Ortsinhalt nicht verfügbar. Originaldaten bleiben erhalten.");
      this.doc = structuredClone(r.value.location);
      this.docRevision = r.value.revision;
    }
    if(record.assetId&&!this.assets.has(record.assetId)){
      const image=await window.campaign.referenceAssetPreview(token,record.assetId,1024);
      if(token!==this.token||this.selected?.id!==record.id||frame!==this.host.data()?.region?.fence)return;if(image.ok)this.rememberAsset(record.assetId,image.value);else {html('land-reload').hidden=false;this.say('Bildvorlage nicht verfügbar. Original bleibt erhalten.');}
    }
    this.inspector();
    this.objectOptions();
    this.host.selected?.(record.id,record.kind);
    this.host.redraw();
  }
  private inspector() {
    const root = html("land-selection");
    root.replaceChildren();
    delete root.dataset.selectionId;
    const r = this.selected;
    if (!r) return;
    root.dataset.selectionId=r.id;
    if(r.route){
      const title=document.createElement('p');title.textContent=(r.name||'Geplanter Verlauf')+(r.route.conflict?' · '+r.route.conflict:' · Geländeform verbunden');
      const edit=document.createElement('button');edit.textContent='Verlauf und Gelände bearbeiten';edit.onclick=()=>void this.openRoute(r).catch(e=>this.host.error(e));root.append(title,edit);return;
    }
    if(r.vegetation){vegetationInspector(root,r,this.vegetationInstance,()=>{this.dirty=true;this.background=null;},()=>void this.finish().catch(e=>this.host.error(e)),()=>void this.commit({kind:'landscape-remove',id:r.id,expectedRevision:r.revision}).catch(e=>this.host.error(e)),o=>void this.linkVegetation(r,o).catch(e=>this.host.error(e)));return;}
    const label = (title: string, id: string, value: string, type = "text") => {
      const l = document.createElement("label");
      l.textContent = title;
      const input = document.createElement("input");
      input.id = id;
      input.type = type;
      input.value = value;
      input.oninput = () => {
        this.dirty = true;
        if(type==='number'&&input.value&&Number.isFinite(Number(input.value))){this.readInspector();this.background=null;this.host.redraw();}
      };
      l.append(input);
      root.append(l);
      return input;
    };
    if(r.kind==='road'||r.kind==='river'){const plan=document.createElement('button');plan.textContent='Geländegerecht planen';plan.onclick=()=>void this.openRoute(r).catch(e=>this.host.error(e));root.append(plan);}
    label("Name des ausgewählten Objekts", "land-name", r.name);
    if(r.kind!=="reference")mapLabelEditor(root,"land",r.label,()=>{this.dirty=true;});
    const x=label("X in m", "land-x", String(r.points[0]!?.x ?? 0), "number"),y=label("Y in m", "land-y", String(r.points[0]!?.y ?? 0), "number");
    let position:HTMLDetailsElement|undefined;
    if(r.kind==='place'){
      position=document.createElement('details');position.id='land-position';
      const title=document.createElement('summary');title.textContent='Position';position.append(title,x.closest('label')!,y.closest('label')!);
    }
    const button = (name: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.onclick = run;
      root.append(b);
    };
    if (r.kind === "river" || r.kind === "road") {
      label("Breite in m", "land-record-width", String(r.width), "number");
      const settings=document.createElement('div');settings.id='land-selected-line';root.append(settings);
      const legacy={...newLine(r.kind),curve:'linear' as const,roughness:0,meander:0,fadeIn:false,style:r.style==='path'?'dashed' as const:'solid' as const};
      lineControls(settings,'land-edit',r.line??legacy,r.kind==='river',()=>{r.line=readLineControls(settings,'land-edit',r.line??legacy);this.dirty=true;this.background=null;this.host.redraw();});
      if(this.selectionRecords.size>1){
        const note=document.createElement('p');note.textContent=this.selectionRecords.size+' Verläufe ausgewählt. Ziehen verschiebt alle gemeinsam.';root.append(note);
        button('Breite und Stil auf Auswahl anwenden',()=>{this.readInspector();for(const other of this.selectionRecords.values()){other.width=r.width;other.line={...(r.line??legacy),seed:other.line?.seed??this.draftSeed,continuity:other.line?.continuity};}this.dirty=true;this.background=null;this.host.redraw();});
      }
      button('Weitere Verläufe mit Umschalt-Klick auswählen',()=>this.say('Umschalt gedrückt halten und weitere Straßen oder Flüsse anklicken. Erneuter Umschalt-Klick entfernt sie aus der Auswahl.'));
      button("Punkt nach markiertem Punkt einfügen", () => {
        this.vertex=Math.max(0,this.vertex);
        const a = r.points[this.vertex]!,
          b = r.points[this.vertex + 1]! ?? a;
        r.points.splice(this.vertex + 1, 0, {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        });
        this.dirty = true;
        this.host.redraw();
      });
      button("Markierten Punkt entfernen", () => {
        if (r.points.length <= 2) return;
        r.points.splice(this.vertex, 1);
        this.vertex = 0;
        this.dirty = true;
        this.host.redraw();
      });
      button("Am markierten Punkt teilen", () => {
        if (this.vertex <= 0 || this.vertex >= r.points.length - 1) {
          this.say("Einen inneren Verlaufpunkt auswählen.");
          return;
        }
        this.readInspector();
        const [first,second]=splitLine(r,this.vertex,crypto.randomUUID());
        void this.commit({
          kind: "landscape-batch",
          records: [
            { record: first, expectedRevision: r.revision },
            { record: second, expectedRevision: null },
          ],
        }).catch((e) => this.host.error(e));
      });
    }
    if (r.kind === "reference") {
      label("Breite in m", "land-record-width", String(r.width), "number");
      label(
        "Drehung in Grad",
        "land-angle",
        String(((r.angle ?? 0) * 180) / Math.PI),
        "number",
      );
      label(
        "Deckkraft 0–1",
        "land-opacity",
        String(r.opacity ?? 0.4),
        "number",
      );
      for (const [id, title, value] of [
        ["land-visible", "Bild anzeigen", r.visible !== false],
        ["land-locked", "Bild sperren", r.locked !== false],
      ] as const) {
        const l = document.createElement("label"),
          input = document.createElement("input");
        input.id = id;
        input.type = "checkbox";
        input.checked = value;
        input.onchange = () => {
          this.dirty = true;
        };
        l.append(input, title);
        root.append(l);
      }
    }
    if (this.doc) {
      for (const s of this.doc.sections) {
        const l = document.createElement("label"),
          name = document.createElement("input"),
          body = document.createElement("textarea");
        name.value = s.title;
        name.dataset.sectionTitle = s.id;
        body.value = s.markdown;
        body.dataset.sectionBody = s.id;
        name.oninput = body.oninput = () => {
          this.dirty = true;
        };
        l.append(name, body);
        root.append(l);
        button("Abschnitt nach oben", () => {
          this.readInspector();
          const sections = [...this.doc!.sections],
            i = sections.findIndex((v) => v.id === s.id);
          if (i > 0)
            [sections[i - 1]!, sections[i]!] = [sections[i]!, sections[i - 1]!];
          this.doc = { ...this.doc!, sections };
          this.dirty = true;
          this.inspector();
        });
        button("Abschnittslink kopieren", () => {
          void navigator.clipboard
            .writeText(
              `[${s.title}](dungeon-ref:location/${this.doc!.id}#section=${s.id})`,
            )
            .catch((e) => this.host.error(e));
        });
      }
      button("Abschnitt hinzufügen", () => {
        this.readInspector();
        this.doc = {
          ...this.doc!,
          sections: [
            ...this.doc!.sections,
            { id: crypto.randomUUID(), title: "Neuer Abschnitt", markdown: "" },
          ],
        };
        this.dirty = true;
        this.inspector();
      });
    }
    if(position)root.append(position);
    button(
      "Auswahl speichern",
      () => void this.finish().catch((e) => this.host.error(e)),
    );
    button(
      "Aus Atlas entfernen",
      () =>
        void this.commit(this.selectionRecords.size>1?{kind:"landscape-batch",records:[],remove:[...this.selectionRecords.values()].map(r=>({id:r.id,expectedRevision:r.revision}))}:{
          kind: "landscape-remove",
          id: r.id,
          expectedRevision: r.revision,
        }).catch((e) => this.host.error(e)),
    );
    this.say(r.kind === "road" || r.kind === "river" ? "Punkte ziehen; beim Loslassen wird gespeichert. Rückgängig ist im Atlas verfügbar." : "Punkte ziehen; Änderungen anschließend speichern.");
  }
  private readInspector() {
    const r = this.selected;
    if (!r || r.vegetation || r.route) return;
    r.name = html<HTMLInputElement>("land-name").value;
    r.label=readMapLabelEditor(this.inspectorRoot,"land");
    const p = {
        x: Number(atlasFieldValue(html<HTMLInputElement>("land-x"))),
        y: Number(atlasFieldValue(html<HTMLInputElement>("land-y"))),
      },
      old = r.points[0]!;
    if (old) {
      const dx = p.x - old.x,
        dy = p.y - old.y;
      if (!r.locked || r.kind !== "reference")
        for(const record of this.selectionRecords.size?[...this.selectionRecords.values()]:[r])translateLine(record,dx,dy);
    }
    const width = document.getElementById(
      "land-record-width",
    ) as HTMLInputElement | null;
    if (width) r.width = Number(atlasFieldValue(width));
    if (r.kind === "reference") {
      r.angle =
        (Number(html<HTMLInputElement>("land-angle").value) * Math.PI) / 180;
      r.opacity = Number(html<HTMLInputElement>("land-opacity").value);
      r.visible = html<HTMLInputElement>("land-visible").checked;
      r.locked = html<HTMLInputElement>("land-locked").checked;
    }
    if (this.doc)
      this.doc = {
        ...this.doc,
        name: r.name,
        sections: this.doc.sections.map((s) => ({
          ...s,
          title: this.inspectorRoot.querySelector<HTMLInputElement>(
            `[data-section-title="${s.id}"]`,
          )!.value,
          markdown: this.inspectorRoot.querySelector<HTMLTextAreaElement>(
            `[data-section-body="${s.id}"]`,
          )!.value,
        })),
      };
  }
  async selectVegetation(id:string,instance?:VegetationInstance){
    this.vegetationInstance=instance;await this.selectId(id);this.inspector();
  }
  private async linkVegetation(r:LandscapeRecord,o:VegetationOverride){
    const doc=newLocation(crypto.randomUUID(),r.name+' · '+(o.asset==='rock'?'Felsen':'Baum'),'poi',[crypto.randomUUID(),crypto.randomUUID()]);
    o.locationId=doc.id;const v=r.vegetation!;v.overrides=v.overrides.filter(x=>x.id!==o.id);v.overrides.push(o);
    return this.commit({kind:'landscape-place',record:r,point:{x:o.x,y:o.y},document:doc,expectedLocationRevision:null,expectedRevision:r.revision});
  }
  private async finishVegetation(){
    const radius=Number(atlasFieldValue(html<HTMLInputElement>('land-radius')));
    if(!Number.isFinite(radius)||radius<=0)throw Error('Pinselradius prüfen.');
    let polygons:Polygon[];
    if(this.tool==='vegetation-area'){
      if(this.points.length<3)throw Error('Mindestens drei Eckpunkte wählen.');
      polygons=[{outer:[...this.points],holes:[]}];
    }else polygons=[...this.brushStrokes,this.points].flatMap(points=>points.length?brushFootprint(points,radius,0,this.draftSeed):[]);
    if(['vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool))return this.commit({kind:'landscape-vegetation-edit',polygons,mode:this.tool.slice(11) as 'clear'|'thin'|'dense'});
    if(this.tool==='vegetation-object'){
      const scene=await window.campaign.atlasVegetationScene(this.token,{x:this.lastPoint.x-1,y:this.lastPoint.y-1,width:2,height:2},1);
      if(!scene.ok)throw Error(scene.error);
      const r=scene.value.records.filter(r=>r.vegetation).sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0)).filter(r=>contains(this.lastPoint,r.polygons)).at(-1);
      if(!r)throw Error('Einzelobjekt innerhalb einer Landschaftsfläche setzen.');
      delete r.vegetationView;const asset=html<HTMLSelectElement>('vegetation-asset').value as VegetationOverride['asset'];
      r.vegetation!.overrides.push({id:'manual:'+crypto.randomUUID(),...this.lastPoint,asset,size:asset==='rock'?4:asset==='shrub'?2:this.vegetationSettings.preset.size,angle:0});
      return this.commit({kind:'landscape-put',record:r,expectedRevision:r.revision});
    }
    const r=emptyRecord('vegetation');r.name=this.vegetationSettings.preset.name;r.polygons=polygons;r.points=[...this.points];r.resolution=Math.max(1,radius/10);r.width=radius*2;
    r.vegetation=structuredClone(this.vegetationSettings);r.vegetation.seed=this.draftSeed;r.vegetation.spacing=Number(html<HTMLInputElement>('vegetation-spacing').value);
    r.vegetation.layout=this.tool==='vegetation-line'?html<HTMLSelectElement>('vegetation-layout').value as 'natural'|'row':'natural';
    if(this.tool==='vegetation-line'&&this.points.length<2)throw Error('Mindestens zwei Linienpunkte wählen.');
    r.values={terrain:r.vegetation.preset.terrain};
    return this.commit({kind:'landscape-put',record:r,expectedRevision:null});
  }
  private async importReference() {
    if (this.hasDraft())
      throw new Error("Zuerst Zug abschließen oder verwerfen.");
    const token = this.token,
      result = await window.campaign.referenceImage(token);
    if (token !== this.token) return;
    if (!result.ok) throw new Error(result.error);
    if (!result.value) return;
    await this.host.refresh?.();if(token!==this.token)return;
    const a = result.value,
      b = this.host.box(),
      r = emptyRecord("reference");
    const preview=await window.campaign.referenceAssetPreview(token,a.id,1024);
    if(token!==this.token)return;if(!preview.ok)throw new Error(preview.error);this.rememberAsset(a.id,preview.value);
    r.assetId = a.id;
    r.imageWidth = a.width;
    r.imageHeight = a.height;
    r.points = [{ x: b.x + b.width * 0.1, y: b.y + b.height * 0.1 }];
    r.width = b.width * 0.8;
    r.angle = 0;
    r.opacity = 0.5;
    r.visible = true;
    r.locked = true;
    this.calibration = { record: r, points: [] };
    this.tool = "measure";
    this.toolFields();
    html<HTMLSelectElement>("land-tool").value=this.tool;
    this.say(
      "Zwei Bildpunkte und die echte Entfernung wählen, dann abschließen.",
    );
    this.host.redraw();
  }
}

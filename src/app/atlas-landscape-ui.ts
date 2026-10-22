import {LandscapeInspector} from './landscape-inspector';
import {LandscapeRoutes} from './landscape-routes';
import {LandscapeBrushSession} from './landscape-brush-session';
import type {LandscapeHost,LandscapeTool as Tool} from './landscape-workbench-types';
import {vegetationInstances} from './vegetation-projection';

import {AUTO_CONTOURS} from './terrain-contour-style';
import {terrainDetailBox} from './terrain-detail';

import {validateVegetation,vegetationSpec,type VegetationInstance,type VegetationOverride} from './vegetation';
import {vegetationControls} from './vegetation-controls';
import {DEFAULT_TERRAIN_STYLE,type TerrainStyle} from './terrain-relief';
import {heightBrushResolution} from './terrain-brush';
import {drawMeasurements,areaMeasures,pathMeasures,radiusMeasures} from './atlas-measurements';
import {atlasFieldValue,setAtlasFieldValue,setAtlasElevationField,lengthLabel} from './atlas-units';
import {LandscapeToolSettings} from "./landscape-tool-settings";
import {brushFootprint,type BrushMode} from "./landscape-brush";
import {linePoints,translateLine} from "./landscape-line";
import { automaticGrid, gridMeters, travelHexSizes } from "./atlas-navigation-scale";
import {AtlasPaint,atlasPaint} from './atlas-paint';
import { pendingAtlasWrite } from "./campaign-atlas-author";
import type {AtlasAction} from "./campaign-atlas-contracts";
import type { Point, Polygon } from "./contracts";
import {
  contains,
  emptyRecord,
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
import {newLocation} from "../features/location/location-schema";
import { atlasHexAt } from "./campaign-atlas-model";
const html = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

export class LandscapeWorkbench {
  private brush: LandscapeBrushSession = this.createLandscapeBrushSession();
  private createLandscapeBrushSession(): LandscapeBrushSession {
      const source = this;
      return new LandscapeBrushSession({
          get effects() { return source.host; },
          get pointer() { return source.pointer; }, set pointer(value) { source.pointer = value; },
          disable: (...args) => this.disable(...args),
          say: (...args) => this.say(...args),
          get lastPoint() { return source.lastPoint; },
          get points() { return source.points; }, set points(value) { source.points = value; },
          colorRecord: (...args) => this.colorRecord(...args),
          get saving() { return source.saving; }, set saving(value) { source.saving = value; },
          get brushStrokes() { return source.brushStrokes; }, set brushStrokes(value) { source.brushStrokes = value; },
          get draftSeed() { return source.draftSeed; }, set draftSeed(value) { source.draftSeed = value; },
          get token() { return source.token; },
          get heightPreviewM() { return source.heightPreviewM; }, set heightPreviewM(value) { source.heightPreviewM = value; },
          get active() { return source.active; },
          get hovering() { return source.hovering; },
          cursorHeight: (...args) => this.cursorHeight(...args)
      });
  }

  private routes: LandscapeRoutes = this.createLandscapeRoutes();
  private createLandscapeRoutes(): LandscapeRoutes {
      const source = this;
      return new LandscapeRoutes({
          get tool() { return source.tool; },
          hasDraft: (...args) => this.hasDraft(...args),
          say: (...args) => this.say(...args),
          get selected() { return source.details.selected; }, set selected(value) { source.details.selected = value; },
          get selectionRecords() { return source.details.selectionRecords; },
          get inspectorRoot() { return source.inspectorRoot; },
          get effects() { return source.host; },
          get token() { return source.token; },
          get panel() { return source.panel; },
          get canvas() { return source.canvas; },
          point: (...args) => this.point(...args),
          hit: (...args) => this.hit(...args),
          get spacePan() { return source.spacePan; },
          commit: (...args) => this.commit(...args)
      });
  }

  private details: LandscapeInspector = this.createLandscapeInspector();
  private createLandscapeInspector(): LandscapeInspector {
      const source = this;
      return new LandscapeInspector({
          get inspectorRoot() { return source.inspectorRoot; },
          hasDraft: (...args) => this.hasDraft(...args),
          get token() { return source.token; },
          get effects() { return source.host; },
          say: (...args) => this.say(...args),
          get background() { return source.background; }, set background(value) { source.background = value; },
          get assets() { return source.assets; },
          rememberAsset: (...args) => this.rememberAsset(...args),
          objectOptions: (...args) => this.objectOptions(...args),
          get routes() { return source.routes; },
          finish: (...args) => this.finish(...args),
          commit: (...args) => this.commit(...args),
          get draftSeed() { return source.draftSeed; },
          selectId: (...args) => this.selectId(...args)
      });
  }

  readonly panel = document.createElement("section");
  private vegetationSettings=vegetationSpec();
  private vegetationFields=document.createElement('div');
  private inspectorRoot: HTMLElement;
  private settings:LandscapeToolSettings;
  private draftSeed=crypto.getRandomValues(new Uint32Array(1))[0]!;
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
  private pointer: number | null = null;
  private dragging = false;
  private lineDragChanged = false;
  private releaseClick = false;
  private saving = false;
  private measurement: Point[] = [];
  private calibration: {
    record: LandscapeRecord;
    points: Point[];
  } | null = null;
  private lastPoint: Point = { x: 0, y: 0 };
  constructor(
    private canvas: HTMLCanvasElement,
    private host: LandscapeHost,
  ) {
    this.panel.id = "atlas-landscape-tools";
    this.panel.hidden = true;
    this.panel.innerHTML = `<label>Werkzeug<select id="land-tool"><option value="select">Auswählen / Verlauf korrigieren</option><option value="height">Land formen</option><option value="smooth">Glätten</option><option value="color">Farbe auftragen / radieren</option><option value="property">Eigenschaften bearbeiten</option><option value="freshwater">Süßwasser bearbeiten</option><option value="hex">Hexfläche füllen</option><option value="reset">Eigenschaft zur Vorgabe zurücksetzen</option><option value="river">Fluss zeichnen</option><option value="road">Weg zeichnen</option><option value="place">Ort platzieren</option><option value="measure">Strecke messen</option></select></label><label>Eigenschaft<select id="land-field"><option value="terrain">Gelände</option><option value="elevationM">Höhe</option><option value="climate">Klima</option></select></label><label id="land-value-field">Wert<input id="land-value" placeholder="Höhe" value="0"></label><label>Pinselradius in m<input id="land-radius" type="number" min="1" value="500"></label><label>Verlaufstil<select id="land-line-style"><option value="path">Pfad / Bach</option><option value="road">Straße / Fluss</option></select></label><label>Verlaufbreite in m<input id="land-width" type="number" min="0.1" step="any" value="30"></label><p id="land-status" role="status">3 Meilen von Kante zu Kante. Orts-/Verlaufpunkte anklicken, dann abschließen.</p><div class="toolbar"><button id="land-finish">Zug abschließen</button><button id="land-cancel">Verwerfen</button><button id="land-reload" hidden>Ansicht erneut laden</button></div><label><input id="land-auto-level" type="checkbox" checked> Hexstufe automatisch anzeigen</label><label><input id="land-grid" type="checkbox" checked> Hexraster anzeigen</label><label>Objekt auswählen<select id="land-object"><option value="">Auf der Karte auswählen</option></select></label><div id="land-selection"></div><details><summary>Nachzeichenvorlage</summary><button id="land-reference">Bild laden und kalibrieren</button><label>Abstand der Bildpunkte in m<input id="land-calibration-distance" type="number" min="0.1" value="10000"></label><p>Nach dem Laden zwei Punkte im Bild anklicken. Anschließend Lage und Drehung bearbeiten.</p></details>`;
    const sea=document.createElement('details');sea.id='land-sea-options';sea.hidden=true;sea.innerHTML='<summary>Meeresspiegel</summary><label>Höhe in m<input id="land-sea-level" type="number" value="0" step="any"></label><button id="land-sea-apply" type="button">Meeresspiegel übernehmen</button>';this.panel.append(sea);
    sea.querySelector<HTMLButtonElement>('#land-sea-apply')!.onclick=()=>{if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}void this.commit({kind:'landscape-sea-level',seaLevelM:Number(html<HTMLInputElement>('land-sea-level').value)});};
    const relief=document.createElement('div');relief.innerHTML='<label>Höhenlinien<select id="land-contours"><option value="-1">Automatisch</option><option value="0">Aus</option><option value="10">Alle 10 m</option><option value="50">Alle 50 m</option><option value="100">Alle 100 m</option><option value="500">Alle 500 m</option></select></label><output id="land-cursor-height" aria-live="off">Höhe: –</output>';this.panel.append(relief);
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
    this.inspectorRoot=this.panel.querySelector<HTMLElement>('#land-selection')!;
    html("atlas-tool-fields").after(this.panel);
    this.settings=new LandscapeToolSettings(this.panel,()=>{this.toolFields();this.host.redraw();},()=>{if(this.hasDraft()){this.say("Zuerst abschließen oder verwerfen.");return false;}return true;});
    const routePlan=document.createElement('button');routePlan.id='land-route-plan';routePlan.textContent='Geländegerecht planen';routePlan.type='button';this.settings.lineRoot.after(routePlan);
    routePlan.onclick=()=>{if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}void this.routes.openRoute().catch(e=>this.host.error(e));};
    html<HTMLSelectElement>("land-tool").onchange = () => {
      // A ruler is temporary; leaving it must not require saving a drawing.
      if(this.tool==='measure'&&!this.saving&&this.pointer===null)this.points=[];
      if (this.hasDraft()) {
        html<HTMLSelectElement>("land-tool").value=this.tool;
        this.say("Zuerst abschließen oder verwerfen.");
        return;
      }
      this.tool = html<HTMLSelectElement>("land-tool").value as Tool;
      this.brush.liveFailureMessage=undefined;
      this.toolFields();
      this.say("Werkzeug wählen, auf der Karte arbeiten. Enter schließt Punktzüge ab; Escape verwirft.");
      this.measurement=[];
      this.details.selected = null;
      this.details.vegetationInstance=undefined;
      this.details.selectionRecords.clear();
      this.details.doc = null;
      html("land-selection").replaceChildren();
      this.host.redraw();
    };
    html<HTMLSelectElement>("land-object").onchange = () => {
      const r = this.records.find(
        (r) => r.id === html<HTMLSelectElement>("land-object").value,
      );
      if (r) void (this.host.data()?.region?.landscape?this.selectId(r.id):this.details.select(r)).catch((e) => this.host.error(e));
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
    html("land-reload").onclick = () => void (async()=>{await (this.host.refresh?this.host.refresh():this.load(true));if(this.details.selected?.assetId&&!this.assets.has(this.details.selected.assetId))await this.selectId(this.details.selected.id);})().catch(e=>this.host.error(e));
    html("land-reference").onclick = () =>
      void this.importReference().catch((e) => this.host.error(e));
    html("land-grid").onchange = () => this.host.redraw();
    html("land-auto-level").onchange = () => { this.toolFields(); this.host.redraw(); };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || e.button !== 0 || e.altKey || this.spacePan || this.saving || this.brush.live || this.host.navigation?.(e)) return;
        this.releaseClick = false;
        canvas.focus({preventScroll:true});
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
          const b=canvas.getBoundingClientRect(),pixel=canvas.getContext('2d')?.getImageData(Math.floor((e.clientX-b.left)*canvas.width/b.width),Math.floor((e.clientY-b.top)*canvas.height/b.height),1,1).data;
          if(pixel)this.settings.sample('#'+[...pixel.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join(''));this.releaseClick=true;return;
        }
        const handle = this.details.selectionRecords.size>1?null:this.hit(e, ["landVertex"]);
        if (handle && this.details.selected) {
          if (this.details.selected.kind === "reference" && this.details.selected.locked)
            return;
          this.details.vertex = Number(handle.data.landVertex);
          this.dragging = true;
          this.lineDragChanged = false;
          this.pointer = e.pointerId;
          canvas.setPointerCapture(e.pointerId);
          return;
        }
        if (this.tool === "select") {
          const filter=html<HTMLSelectElement>('vegetation-selection-filter').value;
          const plant=this.hit(e,[filter==='all'?'vegetationInstance':'vegetation-'+filter]);
          if(plant?.data.vegetationInstance&&plant.data.landscapeId){const record=this.records.find(r=>r.id===plant.data.landscapeId),instance=vegetationInstances(record?.vegetationView).find(i=>i.id===plant.data.vegetationInstance);if(instance){void this.details.selectVegetation(record!.id,instance).catch(e=>this.host.error(e));return;}}
          if(filter!=='all'){this.say('Kein Objekt des gewählten Typs an dieser Stelle.');return;}
          const id=this.hit(e,['landscapeId'])?.data.landscapeId;
          if(e.shiftKey&&id){void this.details.selectAdditional(id).catch(e=>this.host.error(e));return;}
          if(id&&this.details.selected&&(id===this.details.selected.id||this.details.selectionRecords.has(id))&&['river','road'].includes(this.details.selected.kind)){
            if(this.details.selected.route){void this.routes.openRoute(this.details.selected).catch(e=>this.host.error(e));return;}
            this.details.vertex=-2;this.dragOrigin=this.lastPoint;this.dragging=true;this.lineDragChanged=false;this.pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);return;
          }
          if(this.host.choose){void this.host.choose(this.lastPoint).catch(e=>this.host.error(e));return;}
          const r = this.records.find(
            (r) =>
              r.id ===
              this.hit(e, ["landscapeId"])
                ?.data.landscapeId,
          );
          if (r) void this.details.select(r);
          return;
        }
        if (["height", "smooth", "color", "property", "freshwater", "hex", "reset", "vegetation", "vegetation-clear", "vegetation-thin", "vegetation-dense"].includes(this.tool)) {
          if (this.brushPointCount() >= 1000) {
            this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
            return;
          }
          if(this.brush.maskStroke){this.say('Zuerst abschließen oder verwerfen.');return;}
          this.pointer = e.pointerId;
          if(this.tool==='color')this.brush.colorDraft??={...this.settings.color(Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),this.draftSeed),visibility:this.host.visibility?.()};
          if(this.tool==='height'||this.tool==='smooth'){this.brush.maskStart=e.timeStamp;this.brush.maskStroke={...this.settings.height(),visibility:this.host.visibility?.(),seed:this.draftSeed,radius:Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),samples:[{...this.lastPoint,t:0}]};}
          if (this.points.length) this.brushStrokes.push(this.points);
          this.points = [this.lastPoint];
          if(this.tool==='height'||this.tool==='smooth'||this.tool==='color')this.brush.startLive();
          canvas.setPointerCapture(e.pointerId);
          this.redrawPointer();
        }
      },
      true,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if(this.active&&this.pointer===null){this.lastPoint=this.point(e);this.hovering=true;this.cursorHeight();if(['height','smooth','color','property','freshwater','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool)||this.points.length)this.redrawPointer();}
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = this.point(e);
        this.lastPoint = p;
        if(this.brush.maskStroke){const events=e.getCoalescedEvents?.()??[];for(const sample of events.length?events:[e])if(this.brush.maskStroke.samples.length<20000)this.brush.maskStroke.samples.push({...this.point(sample),t:Math.min(300000,Math.max(this.brush.maskStroke.samples.at(-1)!.t,sample.timeStamp-this.brush.maskStart))});}
        if (this.dragging && this.details.selected) {
          if (this.details.selected.kind === "reference" && this.details.vertex === -1) {
            const o = this.details.selected.points[0]!,
              ratio =
                (this.details.selected.imageHeight ?? 1) /
                (this.details.selected.imageWidth ?? 1);
            this.details.selected.width =
              Math.hypot(p.x - o.x, p.y - o.y) / Math.hypot(1, ratio);
            this.details.selected.angle =
              Math.atan2(p.y - o.y, p.x - o.x) - Math.atan2(ratio, 1);
            setAtlasFieldValue(html<HTMLInputElement>("land-record-width"), String(
              this.details.selected.width,
            ));
            html<HTMLInputElement>("land-angle").value=String(
              (this.details.selected.angle * 180) / Math.PI,
            );
          } else if(this.details.vertex===-2&&this.dragOrigin){
            const dx=p.x-this.dragOrigin.x,dy=p.y-this.dragOrigin.y;
            for(const r of this.details.selectionRecords.size?[...this.details.selectionRecords.values()]:[this.details.selected])translateLine(r,dx,dy);
            this.dragOrigin=p;this.lineDragChanged ||= !!(dx||dy);
            setAtlasFieldValue(html<HTMLInputElement>('land-x'), String(this.details.selected.points[0]!.x));setAtlasFieldValue(html<HTMLInputElement>('land-y'), String(this.details.selected.points[0]!.y));
          } else {
            const before = this.details.selected.points[this.details.vertex];
            this.lineDragChanged ||= !!before && (before.x !== p.x || before.y !== p.y);
            this.details.selected.points[this.details.vertex] = p;
          }
          if (this.details.vertex === 0) {
            setAtlasFieldValue(html<HTMLInputElement>("land-x"), String(p.x));
            setAtlasFieldValue(html<HTMLInputElement>("land-y"), String(p.y));
          }
          this.details.dirty = true;
          if(this.details.selectionRecords.size>1)this.background=null;
        } else {
          const events=this.tool==='color'?(e.getCoalescedEvents?.()??[]):[];
          for(const sample of events.length?events:[e]){
          const p=this.point(sample);
          const previous = this.points.at(-1), size = gridMeters(html<HTMLSelectElement>("atlas-hex-level").value);
          const a = previous && atlasHexAt(previous, size), b = atlasHexAt(p, size);
          const changed = !previous || (this.tool === "hex"
            ? a!.q !== b.q || a!.r !== b.r
            : Math.hypot(p.x - previous.x, p.y - previous.y) > Math.max(1e-9, (this.brush.colorDraft?.radius??Number(atlasFieldValue(html<HTMLInputElement>('land-radius')))) / 3));
          if (changed) {
            if (this.brushPointCount() < 1000) this.points.push(p);
            else this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
          }
          }
        }
        this.brush.scheduleLive();this.redrawPointer();
      },
      true,
    );
    canvas.addEventListener(
      "pointerup",
      (e) => {
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        if(this.brush.maskStroke)this.brush.maskStroke.samples.push({...this.point(e),t:Math.min(300000,Math.max(this.brush.maskStroke.samples.at(-1)!.t,e.timeStamp-this.brush.maskStart))});
        clearTimeout(this.brush.maskTimer);
        const commitLine = this.dragging && this.lineDragChanged &&
          (this.details.selected?.kind === "road" || this.details.selected?.kind === "river");
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
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
        this.host.redraw();
      },
      true,
    );
    canvas.addEventListener("pointercancel", () => {
      if(this.brush.live){this.brush.endLiveInput();void this.brush.finishLive();return;}
      if(this.brush.maskStroke)this.brush.maskStroke.samples.push({...this.lastPoint,t:Math.min(300000,performance.now()-this.brush.maskStart)});
      clearTimeout(this.brush.maskTimer);
      this.pointer = null;
      this.dragging = false;
      this.say("Zug unterbrochen. Abschließen oder verwerfen.");
    });
    canvas.addEventListener(
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
        if (this.tool === "place" && this.details.selected) {
          if (this.details.dirty) {
            this.say("Ortsänderungen zuerst abschließen oder verwerfen.");
            return;
          }
          this.details.selected = null;
          this.details.doc = null;
          this.details.docRevision = null;
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
    canvas.addEventListener('pointerleave',()=>{this.hovering=false;this.heightRead=null;this.heightPreviewM=null;html('land-cursor-height').textContent='Höhe: –';this.renderHeightPrecision();this.redrawPointer();});
    canvas.addEventListener('contextmenu',e=>{if(this.active&&['river','road'].includes(this.tool)){e.preventDefault();e.stopImmediatePropagation();void this.finish().catch(e=>this.host.error(e));}});
    canvas.addEventListener("keydown", (e) => {
      if (!this.active || (e.target as HTMLElement).closest?.('input,select,textarea,[contenteditable=true]')) return;
      if(e.code==="Space"){this.spacePan=true;return;}
      if(e.key==="Backspace"){e.preventDefault();if(this.brush.live)return;this.points.pop();this.host.redraw();return;}
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
    window.addEventListener("blur",()=>{this.spacePan=false;if(this.brush.live){this.brush.endLiveInput();void this.brush.finishLive();return;}if(this.brush.maskStroke&&this.pointer!==null){this.brush.maskStroke.samples.push({...this.lastPoint,t:Math.min(300000,performance.now()-this.brush.maskStart)});const pointer=this.pointer;this.pointer=null;clearTimeout(this.brush.maskTimer);if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);this.say('Zug unterbrochen. Abschließen oder verwerfen.');}});
  }
  private colorRecord(){
    const radius=this.brush.colorDraft?.radius??Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),r=emptyRecord('patch');
    r.points=[...this.points];r.resolution=gridMeters(html<HTMLSelectElement>('atlas-hex-level').value);
    r.polygons=[...this.brushStrokes,this.points].flatMap(ps=>brushFootprint(ps,radius));
    r.paint={...(this.brush.colorDraft??this.settings.color(radius,this.draftSeed)),strokes:[...this.brushStrokes,this.points].map(ps=>[...ps])};r.values={};return r;
  }
  /** Direct brush pixels have their own presentation. Pointer/HUD changes
   * must not rebuild the unchanged author scene; geometry drags still do. */
  private redrawPointer(){
    if(!this.dragging&&['height','smooth','color'].includes(this.tool)&&this.host.redrawOverlay)this.host.redrawOverlay();
    else this.host.redraw();
  }
  get livePainting(){return this.brush.livePainting;}
  get selectedLabel(){return this.details.selectedLabel;}
  get selectionId(){return this.details.selectionId;}
  get routeGesture(){return this.routes.routeGesture;}
  routeHistory(kind:'undo'|'redo'){return this.routes.routeHistory(kind);}
  planTerrainRoute(kind:'road'|'river'){return this.routes.planTerrainRoute(kind);}
  select(record:LandscapeRecord){return this.details.select(record);}
  selectVegetation(id:string,instance?:VegetationInstance){return this.details.selectVegetation(id,instance);}

  terrainDetail(box:LandscapeBox){return terrainDetailBox(this.lastPoint,Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),box);}
  get spatialTool(){return this.tool;}
  get spatialSelection(){return this.details.selected?.points[0]??this.details.selected?.polygons[0]?.outer[0]??null;}
  spatialDraft():import("./terrain-spatial-ui").TerrainDraft|null {return this.routes.routeRecords?{routeRecords:this.routes.routeRecords}:null;}
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
  private contourInterval=AUTO_CONTOURS;
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
    const protectedPoint=visible&&this.hovering&&!this.brush.maskStroke&&read&&read.generation===this.brush.maskGeneration&&read.request===this.request&&read.point.x===point.x&&read.point.y===point.y&&read.resolutionM!==null&&read.resolutionM<brush;
    const hint=this.settings.precisionRoot.querySelector<HTMLElement>('#land-height-protection')!;hint.hidden=!protectedPoint;
    if(protectedPoint&&read.resolutionM!==null){
      const fixed=(document.getElementById('land-radius-fixed') as HTMLInputElement|null)?.checked;
      const protection='Feine Geländeformen ('+lengthLabel(read.resolutionM)+') bewegen sich mit.',remedy='Für ihre Form den Radius verkleinern'+(fixed?'':' oder näher heranzoomen')+'.',text=protection+' '+remedy;
      if(hint.textContent!==text)hint.textContent=text;
      return [html('land-cursor-height').textContent??'',label,protection,remedy];
    }
    return [];
  }
  private cursorHeight(){
    if(this.heightTimer||this.brush.maskStroke)return;
    this.heightTimer=setTimeout(async()=>{
      const token=this.token,p={...this.lastPoint},generation=this.brush.maskGeneration,request=this.request;
      try{const r=await window.campaign.atlasHeight(token,p);
        if(token===this.token&&generation===this.brush.maskGeneration&&request===this.request&&!this.brush.maskStroke&&this.hovering&&p.x===this.lastPoint.x&&p.y===this.lastPoint.y&&r.ok){
          this.heightPreviewM=null;this.heightRead={point:p,heightM:r.value.heightM,resolutionM:r.value.resolutionM,generation,request};
          this.renderHeightPrecision();this.redrawPointer();
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
  /** A released direct stroke still owns writes and parameters, but no longer the camera. */
  blocksNavigation(includeRoute=true) {
    return this.brush.live ? this.pointer !== null : this.hasDraft(includeRoute);
  }
  hasDraft(includeRoute=true) {
    return (
      includeRoute&&(this.routes.routeOpening||!!this.routes.routeSession?.hasDraft()) || !!this.routes.routeSession?.gesturing() ||
      (this.tool !== "measure" && this.points.length > 0) ||
      this.details.dirty ||
      !!this.calibration ||
      this.pointer !== null ||
      this.saving || !!this.brush.live
    );
  }
  cancel() {
    if(this.brush.live){void this.brush.finishLive(true);return;}
    this.brush.liveFailureMessage=undefined;
    this.routes.close();
    this.brush.clearMask();
    this.points = [];
    this.brushStrokes = [];
    this.measurement=[];
    this.details.dirty = false;
    this.pointer = null;
    this.calibration = null;
    this.dragging = false;
    this.details.selected = null;
    this.details.selectionRecords.clear();
    this.draftSeed=crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.details.doc = null;
    html("land-selection").replaceChildren();
    this.say("Zug verworfen.");
    this.host.redraw();
  }
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
    if(!active&&this.active){this.routes.routeGeneration++;this.routes.routeSession?.close();}
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
    await this.details.select(record);
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
  presentTerrain(layer:import('./atlas-region-contracts').AtlasLandscapeLayer){
    this.records=layer.records;this.raster=layer.tiles;this.background=null;
    this.host.redraw();
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
      if(layer.state==='error'||!this.brush.liveFailureMessage)this.say(layer.state==='error'?layer.error??'Landschaft nicht verfügbar.':layer.coverage.mode==='raster'?'Dichte Landschaft als Übersicht. Anklicken liest das genaue Objekt.'+(layer.coverage.references>layer.records.filter(r=>r.kind==='reference').length?' Vorlagen sind als Umrisse dargestellt.':''):'Landschaft geladen.');
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
    const records=this.details.selected&&!this.records.some(r=>r.id===this.details.selected!.id)?[...this.records,this.details.selected]:this.records;
    for(const r of records)select.add(new Option(r.name||r.kind,r.id));select.value=this.details.selected?.id??'';
  }
  async selectId(id:string){
    // Explicit selection leaves a temporary ruler just like a tool change.
    if(this.tool==='measure'&&!this.saving&&this.pointer===null){this.points=[];this.measurement=[];}
    const token=this.token,frame=this.host.data()?.region?.fence,generation=++this.selectionRequest;
    if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}
    const response=await window.campaign.atlasLandscapeObject(token,id);
    if(token!==this.token||generation!==this.selectionRequest||frame!==this.host.data()?.region?.fence)return;
    if(!response.ok)throw new Error(response.error);this.tool="select";html<HTMLSelectElement>("land-tool").value=this.tool;this.toolFields();await this.details.select(response.value);
  }
  draw(root: AtlasPaint, box: LandscapeBox, mpp: number) {
    const landscapeNode=atlasPaint;
    const key=[this.records,this.raster,this.details.selectionRecords.size,this.details.selected?.id,this.details.selected?.resolution,this.details.selected?.order,mpp,...[...this.assets].flat(),...this.unavailableAssets];
    let background=this.background;
    if(!background||background.key.length!==key.length||!background.key.every((v,i)=>v===key[i])){
      const node=atlasPaint('group',{retainGeometry:true});
      drawLandscape(node,this.details.selected?[...this.records.filter(r=>r.id!==this.details.selected!.id&&!this.details.selectionRecords.has(r.id)),...(this.details.selectionRecords.size?[...this.details.selectionRecords.values()]:[this.details.selected])]:this.records,box,mpp,this.assets,true,this.raster,this.unavailableAssets,true);
      this.background=background={key,node,box:{...box},selectedSlot:this.details.selected?node.children.findIndex(n=>n.data.landscapeId===this.details.selected!.id):-1};
    }
    const retained=atlasPaint('group',{matrix:[1,0,0,1,background.box.x-box.x,background.box.y-box.y],data:{atlasLandscapeBase:'true'}});
    let node=background.node;
    if(this.details.selected&&background.selectedSlot>=0&&this.details.selectionRecords.size<=1){
      // Keep the original painter slot, especially for references below terrain.
      const selected=atlasPaint('group');drawLandscape(selected,[this.details.selected.vegetation?{...this.details.selected,vegetationView:this.records.find(r=>r.id===this.details.selected!.id)?.vegetationView}:this.details.selected],background.box,mpp,this.assets,true,this.raster,this.unavailableAssets,true);
      node=atlasPaint('group',{retainGeometry:true});node.append(...background.node.children);
      node.children[background.selectedSlot]=selected.children.find(n=>n.data.landscapeId===this.details.selected!.id)!;
    }
    retained.append(node);root.append(retained);
    if(this.routes.routeAnchors.length){
      const points=this.routes.routeAnchors.map(p=>({x:p.x-box.x,y:p.y-box.y}));
      root.append(atlasPaint('polyline',{points,pointer:false,style:{stroke:'#c77d32',fill:null,lineWidth:mpp*2},data:{editorOnly:'true'}}));
      points.forEach((p,i)=>root.append(atlasPaint('circle',{...p,radius:mpp*6,style:{fill:'#fff1c9',stroke:'#a05a24',lineWidth:mpp*2},data:{routeAnchor:String(i),editorOnly:'true'}})));
    }
    const pts =
      this.calibration?.points ??
      (this.points.length ? this.points : this.measurement);
    if(this.brush.maskStroke||(this.tool==='color'&&this.points.length)){
      // Direct terrain strokes are rendered from the committed region.
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
    if(this.active&&this.details.selectionRecords.size>1)for(const r of this.details.selectionRecords.values())root.append(landscapeNode('polyline',{points:linePoints(r).map(p=>({x:p.x-box.x,y:p.y-box.y})),pointer:false,style:{fill:null,stroke:'#d46e38',lineWidth:mpp*2,lineDash:[mpp*4,mpp*3]},data:{editorOnly:'true'}}));
    if (this.calibration)
      drawLandscape(root, [this.calibration.record], box, mpp, this.assets);
    if (this.details.selected && !this.details.selected.vegetation && !this.details.selected.route && this.active && this.tool === "select" && this.details.selectionRecords.size<=1)
      this.details.selected.points.forEach((p, i) =>
        root.append(
          landscapeNode("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 6, style: {fill: i === this.details.vertex ? "#e1984b" : "#fff", stroke: "#a55d35", lineWidth: mpp * 2}, data: {landVertex: String(i), editorOnly: String("true")}}),
        ),
      );
    if (
      this.details.selected?.kind === "reference" &&
      !this.details.selected.locked &&
      this.active
    ) {
      const r = this.details.selected,
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

  drawMeasurements(root:AtlasPaint,box:LandscapeBox,mpp:number,project?:(p:Point)=>Point){
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
    }else if(this.details.selected&&this.tool==='select'){
      const r=this.details.selected;anchor=r.points.at(-1)??r.polygons[0]?.outer[0]??anchor;
      if(r.kind==='road'||r.kind==='river')lines=pathMeasures(linePoints(r),r.width);
      else if(r.kind==='patch')lines=areaMeasures(r.polygons);
      else if(r.kind==='reference')lines=[`${lengthLabel(r.width)} × ${lengthLabel(r.width*(r.imageHeight??1)/(r.imageWidth??1))}`];
    }
    if(brush&&this.hovering&&['height','smooth'].includes(this.tool)){
      const protection=this.renderHeightPrecision();if(protection.length)lines=protection;
    }
    drawMeasurements(root,box,mpp,anchor,lines,project);
  }
  private autoGrid: string | null = null;
  private gridFade: {from: string; to: string; start: number} | null = null;
  drawOverlay(root: AtlasPaint, box: LandscapeBox, mpp: number): boolean {
    this.renderHeightPrecision();
    // The main GPU view already owns the height/smooth/color cursor. Keep the
    // fallback and other tool cursors in the transient layer, never the map.
    const brush=['height','smooth','color','property','freshwater','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense'].includes(this.tool);
    const spatialCursor=['height','smooth','color'].includes(this.tool)&&!!this.host.visibility?.();
    if(this.active&&this.hovering&&brush&&!spatialCursor)root.append(atlasPaint('circle',{x:this.lastPoint.x-box.x,y:this.lastPoint.y-box.y,radius:Number(atlasFieldValue(html<HTMLInputElement>('land-radius'))),pointer:false,style:{fill:null,stroke:'#364354',lineWidth:mpp},data:{editorOnly:'true'}}));
    const input = html<HTMLSelectElement>('atlas-hex-level');
    const draft = this.hasDraft();
    html('land-finish').hidden = html('land-cancel').hidden = !draft||!!this.brush.live;
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
      const procedural=!!this.host.visibility?.();
      if (this.gridFade && t < 1) {
        const old = atlasPaint('group',{opacity:1-t});
        drawLandscapeGrid(old,box,this.gridFade.from,mpp,procedural);root.append(old);
      }
      const current = atlasPaint('group',{opacity:t});
      drawLandscapeGrid(current,box,level,mpp,procedural);root.append(current);
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
    if (!this.brush.liveFailureMessage && !(this.tool === "measure" && (this.points.length || this.measurement.length)) && !this.hasDraft() && !this.details.selected && html("land-status").textContent!=="Gespeichert") this.say(s);
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
      this.brush.clearMask();
      this.points = [];
      this.brushStrokes = [];
      this.details.selectionRecords.clear();
      this.draftSeed = crypto.getRandomValues(new Uint32Array(1))[0]!;
      this.details.dirty = false;
      this.calibration = null;
      this.details.selected = null;
      this.details.selectionRecords.clear();
      this.details.doc = null;
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
            this.details.selected = structuredClone(latest.value);
            this.details.inspector();
            this.objectOptions();
          }
        } catch { /* The edit is saved; reopening the selection remains available. */ }
      }
      this.say(keep && !this.details.selected
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
    if(this.brush.live){if(this.pointer===null)await this.brush.finishLive();return;}
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
    if (this.details.selected) {
      this.details.readInspector();
      if (this.details.selectionRecords.size > 1)
        return this.commit({
          kind: 'landscape-batch',
          records: [...this.details.selectionRecords.values()].map(record => ({
            record,
            expectedRevision: record.revision,
          })),
        });
      if (this.details.selected.kind === "place" && this.details.doc)
        return this.commit({
          kind: "landscape-place",
          record: this.details.selected,
          document: this.details.doc,
          expectedRevision: this.details.selected.revision,
          expectedLocationRevision: this.details.docRevision,
        });
      return this.commit({
        kind: "landscape-put",
        record: this.details.selected,
        expectedRevision: this.details.selected.revision,
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
    if(this.brush.maskStroke)return this.commit({kind:'landscape-height-stroke',stroke:this.brush.maskStroke});
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
      if (saved) await this.details.select(saved);
    }
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

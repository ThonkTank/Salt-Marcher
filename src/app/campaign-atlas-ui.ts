import {regionValue} from './atlas-region-contracts';
import {selectElement} from './drawing-ui';
import type {AtlasRegionQuery} from './atlas-region-contracts';
import {mountDungeonTravelConsole,dungeonTravelRoute} from './dungeon-travel-console';
import {atlasGeometryOnly} from './atlas-render-view';
import {LiveAtlasPortal} from './live-atlas-portal';
import {atlasExportTiles,type AtlasExportTile} from "./atlas-landscape-export";
import {atlasRegionPaint} from "./atlas-region-export";
import {LandscapeWorkbench} from "./atlas-landscape-ui";
import {earthView} from "./atlas-landscape";
import { atlasImage, publicAtlasPaint } from "./campaign-atlas-export";
import {AtlasLocationComposer,type AtlasLocationOwner} from './atlas-location-composer';
import {atlasLocationWrite} from './campaign-atlas-author';
import {appendAtlasRoomLabels} from './atlas-room-labels';
import { journeyPlayback } from "./journey-playback";
import { atlasPartyPoint,atlasWorldRoute } from "./atlas-runtime-model";
import type {
  AtlasLocalPreview,
  AtlasTravelAction,
} from "./atlas-travel-contracts";
import { openWorld, atlasWorldTarget, atlasWorldTravelState,previewAtlasWorldTravel,startAtlasWorldTravel,refreshWorldAfterAtlasTravel } from "./world-ui";
import type {CanvasBox} from "./passive-map-canvas";
import {AtlasCanvas} from "./atlas-canvas";
import {AtlasPaint,atlasPaint} from "./atlas-canvas-scene";
import {
  atlasFrame,
  localToAtlas,
  atlasToLocal,
  frameMatrix,
  atlasHexPoint,
  atlasHexAt,
} from "./campaign-atlas-model";
import {
  writeAtlasCommit,
  pendingAtlasWrite,
  recoverAtlasCommit,
} from "./campaign-atlas-author";
import type {
  AtlasRenderView,
  AtlasAction,
  AtlasBinding,
} from "./campaign-atlas-contracts";
import type { WorkspaceGeometry, Point, Room } from "./contracts";
import { terrainNames } from "./world-model";
import { cityPaint, posed, roadPoints } from "./city-model";
import { volumeProjection } from "./volume-model";
import { elementPaint, inside } from './drawing-model';
import { atlasCityPoint, atlasCityState, updateCityInteriors, atlasCityPlacementActive, atlasCityPlacementKey, atlasCityShapeHandles, atlasCityChooseShapeHandle, openCityReference } from './city-ui';
import {
  atlasDrawingPoint,
  atlasDrawingRectangle,
  cancelDrawingGesture,
  atlasDrawingDraft,
  drawingOverlay,
  atlasDrawingScope,
  reloadDrawing,
} from "./drawing-ui";
import {
  atlasDungeonTarget,
  atlasDungeonState,
  openDungeon,stopDungeonPlayback,
} from "./dungeon-ui";
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Selection =
  | { kind: "city"; id: string }
  | { kind: "place"; id: string }
  | { kind: "scope"; id: string }
  | { kind: "building"; id: string; cityId: string }
  | { kind: "city-unit"; id: string; cityId: string }
  | { kind: "room"; id: string }
  | null;
type Family =
  | "navigation"
  | "terrain"
  | "city"
  | "interior"
  | "decoration"
  | "travel";
const shape = atlasPaint;
export class CampaignAtlasWorkbench {
  readonly root = document.createElement("section");
  private svg: HTMLCanvasElement;
  private camera: AtlasCanvas;
  private landscape: LandscapeWorkbench;
  private projection:AtlasRenderView|null=null;
  private get data(){return this.projection;}
  private set data(value:AtlasRenderView|null){this.projection=value?atlasGeometryOnly(value):null;}
  private owner: WorkspaceGeometry | null = null;
  private request = 0;
  private hitDialog=document.createElement('dialog');
  private hitVersion=0;
  private regionTimer:ReturnType<typeof setTimeout>|null=null;
  private loadedRegionQuery:AtlasRegionQuery|null=null;
  private searchRequest=0;
  private opening:{owner:WorkspaceGeometry;task:Promise<void>}|null=null;
  private livePortal:LiveAtlasPortal|null=null;
  private liveVisible=false;
  private editingContext: {token:string;family:Exclude<Family,'travel'>;view:CanvasBox;selection:Selection;cityId:string|null;scopeId:string|null;floorId:string;groupView:boolean}|null=null;
  private busy = false;
  private exporting = false;
  private exportCancelled = false;
  private bindingDirty = false;
  private pendingTravel:
    | import("./atlas-travel-contracts").AtlasTravelCommand
    | null = null;
  private family: Family = "navigation";
  private selection: Selection = null;
  private cityId: string | null = null;
  private scopeId: string | null = null;
  private locationComposer:AtlasLocationComposer;
  private placeRequest=0;
  private floorId = "ground";
  private floorRequest=0;
  private navigationRequest = 0;
  private navigationJob:{settled:Promise<boolean>}|null=null;
  private groupView=false;
  private groupViewRequest=0;
  private lastPoint: Point = { x: 0, y: 0 };
  private renderQueued = false;
  private panelKey:unknown[]|null=null;
  private baseGeometry:{key:unknown[];node:AtlasPaint;origin:Point;authorSlot:number[]|null}|null=null;
  private entranceOptions='';
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private drag: {
    id: number;
    start: Point;
    last: Point;
    selection: Selection;
  } | null = null;
  private vertexDrag: {
    id: number;
    room: Room;
    polygon: number;
    vertex: number;
    point: Point;
  } | null = null;
  private cityShapeDrag:{id:number;token:string;cityId:string}|null=null;
  private rectangleDrag: {id:number;start:Point;last:Point}|null=null;
  private brushId: number | null = null;
  private brushQueue = Promise.resolve();
  private ignoreClick = false;
  private partyDrag: { id: number; start: Point; last: Point } | null = null;
  private placeIntent: {
    point: Point;
    token: string;
    sceneId: string;
    revision: number;
    membership: number;
  } | null = null;
  private travelReadState: "loading" | "ready" | "failed" = "loading";
  private previewRequest = 0;
  private localPreview: AtlasLocalPreview | null = null;
  private entranceId: string | null = null;
  private entranceDraft: Point[] | null = null;
  private playback: ReturnType<typeof journeyPlayback>;
  private adopted = new Map<
    string,
    { node: HTMLElement; parent: HTMLElement; next: ChildNode | null }
  >();
  constructor(
    private opts: {
      selectRoom: (id: string) => Promise<void>;
      roomDraft: () => Room | null;
      flush: () => Promise<boolean>;
      updated: (w: WorkspaceGeometry) => Promise<void>;
      status: (s: string, error?: boolean) => void;
      leadAtlas?:()=>Promise<void>;
      readLocation?:(id:string,current:()=>boolean)=>Promise<void>;
      editLocation?:(id:string,current:()=>boolean,back:()=>Promise<void>)=>Promise<void>;
    },
  ) {
    // These controls now use the shared Canvas surface, including at the Live desk.
    // Retire their old renderers explicitly; CSS hiding alone still builds SVG trees.
    for(const id of ['map','city-map','world-map','dungeon-map']){
      const legacy=document.getElementById(id);if(!legacy)continue;legacy.dataset.sharedAtlas='true';legacy.replaceChildren();
    }
    this.root.id = "campaign-atlas";
    this.root.hidden = true;
    this.root.innerHTML = `<div class="atlas-command-bar"><strong>Atlas bearbeiten</strong><button id="atlas-overview">Weltübersicht</button><button id="atlas-to-party">Zur Gruppe</button><button id="atlas-region-retry" hidden>Ansicht erneut laden</button><label>Ort finden<input id="atlas-search" type="search" placeholder="Ort, Stadt, Haus, Straße oder Raum"></label><span id="atlas-scale"></span><button id="atlas-recover" hidden>Speicherstand klären</button><button id="atlas-undo" disabled>↶ Rückgängig</button><button id="atlas-redo" disabled>↷ Wiederholen</button></div><div id="atlas-search-results"></div><dialog id="atlas-place-confirm"><h2>Gruppe versetzen</h2><p>Die Fokusgruppe wird an den gewählten Punkt gesetzt. Dabei vergeht keine Reisezeit.</p><div class="toolbar"><button id="atlas-place-accept">Platzieren</button><button id="atlas-place-cancel">Abbrechen</button></div></dialog><div class="atlas-layout"><div class="atlas-stage"><canvas id="campaign-map" tabindex="0" role="application" aria-label="Gemeinsamer Kampagnenatlas"></canvas><p id="atlas-save-status" role="status"></p></div><aside id="atlas-panel"><nav id="atlas-families" aria-label="Atlaswerkzeuge"></nav><h2 id="atlas-selection-title">Deine Kampagnenwelt</h2><p id="atlas-hint">Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.</p><section id="atlas-place-actions" hidden><p id="atlas-place-summary"></p><div class="toolbar"><button id="atlas-place-read">Ortsmappe öffnen</button><button id="atlas-place-edit">Ortstext bearbeiten…</button></div></section><section id="atlas-tool-fields"><label>Terrain<select id="atlas-terrain">${Object.entries(
      terrainNames,
    )
      .map(([id, title]) => `<option value="${id}">${title}</option>`)
      .join(
        "",
      )}</select></label><label>Hexstufe<select id="atlas-hex-level">${Array.from({ length: 9 }, (_, i) => `<option value="${i}">${(3*3**i).toLocaleString("de-DE")} Meilen Kante zu Kante</option>`).join("")}</select></label><button id="atlas-create-place">Ort hier anlegen…</button><label>Name für Stadt oder Dungeon<input id="atlas-new-name" value="Neue Stadt"></label><div id="atlas-create-tools"><button id="atlas-create-city">Stadt hier anlegen</button><button id="atlas-create-dungeon">Dungeon hier anlegen</button></div><button id="atlas-building-interior" hidden>Innenraumhülle anlegen</button><label id="atlas-floor-field">Geschoss<select id="atlas-floor"></select></label><label><input id="atlas-roofs" type="checkbox" checked> Dächer anzeigen</label><label><input id="atlas-slice-enabled" type="checkbox"> Höhenschnitt</label><label>Höhe in m<input id="atlas-slice" type="number" step="any" value="0"></label><p id="atlas-interior-context" hidden><span id="atlas-interior-house-name"></span> <button id="atlas-interior-house">Zum Haus</button></p><section id="atlas-drawing-tools" aria-label="Innenraum zeichnen" hidden></section><button id="atlas-draft-cancel" hidden>Zug verwerfen</button></section><section id="atlas-context-fields"><label><input id="atlas-perception" type="checkbox"> Wissen und Sicht der Gruppe</label><p id="atlas-view-status" role="status" hidden></p><button id="atlas-view-refresh" hidden>Gruppensicht neu laden</button><button id="atlas-connect-entrance" hidden>Eingang verbinden</button><div id="atlas-local-console" hidden><h3>Reise der Fokusgruppe</h3><p id="atlas-local-status" role="status"></p><button id="atlas-local-refresh" hidden>Reisekontext erneut laden</button><div class="toolbar"><button id="atlas-local-preview">Weg prüfen</button><button id="atlas-local-start" disabled>Reise starten</button><button id="atlas-local-step">Ein Schritt</button><button id="atlas-local-round">Eine Runde</button><button id="atlas-local-play">Wiedergabe starten</button><button id="atlas-local-pause">Pause</button><button id="atlas-local-end">Beenden</button></div><label id="atlas-entrance-field" hidden>Eingang<select id="atlas-entrance-choice"></select></label><button id="atlas-local-entrance" hidden>Durch Eingang</button><details><summary>Gruppe platzieren</summary><p>Versetzt die Fokusgruppe ohne Reisezeit an den zuletzt gewählten Punkt.</p><button id="atlas-local-place">Hier platzieren</button></details></div></section><details id="atlas-placement" hidden><summary>Räumliche Einordnung</summary><label>X in m<input id="atlas-binding-x" type="number" step="any"></label><label>Y in m<input id="atlas-binding-y" type="number" step="any"></label><label>Drehung in Grad<input id="atlas-binding-angle" type="number" step="any"></label><button id="atlas-binding-save">Einordnung übernehmen</button></details><details><summary>Atlas ausgeben</summary><label>Inhalt<select id="atlas-export-audience"><option value="gm">GM-Ansicht</option><option value="public">Wissen der Fokusgruppe</option></select></label><label>Format<select id="atlas-export-format"><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label><label>Längste Bildkante in Pixel<input id="atlas-export-size" type="number" min="256" max="8192" value="2048"></label><label><input id="atlas-export-grid" type="checkbox"> Hexraster ausgeben</label><label><input id="atlas-export-reference" type="checkbox"> Vorlage im GM-Bild ausgeben</label><p>Ohne gewählten Ausgaberahmen wird die aktuelle Ansicht verwendet.</p><button id="atlas-export-png">Bild ausgeben</button><button id="atlas-export-cancel" hidden>Ausgabe abbrechen</button></details><details id="atlas-advanced"><summary>Fachwerkzeuge und Details</summary><div id="atlas-advanced-fields"></div></details></aside></div>`;
    document.getElementById("workspace-navigation")!.after(this.root);
    get("atlas-building-interior").after(get("atlas-drawing-tools"));
    get("atlas-selection-title").after(get("atlas-interior-context"));
    mountDungeonTravelConsole(get("atlas-local-console"));
    this.svg = this.root.querySelector("#campaign-map")!;
    this.camera = new AtlasCanvas(this.svg, {
      redraw:()=>this.render(),
      relative: true,
      initial: { x: -15000, y: -10000, width: 30000, height: 20000 },
      minWidth: 0.1,
      maxWidth: () => earthView(this.svg.clientWidth / Math.max(1,this.svg.clientHeight)).width,
      pan: (e) =>
        e.button === 1 ||
        (e.button === 0 &&
          (e.altKey ||
            (this.family === "navigation" &&
              (!this.camera.hitAt(e, ["atlasObject"]) ||
                this.camera.hitAt(e, ["atlasObject"])
                  ?.data.kind === "city")))),
      locked: () =>
        !!this.cityShapeDrag ||
        !!this.drag ||
        !!this.vertexDrag ||
        !!this.partyDrag ||
        !!this.rectangleDrag ||
        this.brushId !== null,
      changed: () => {
        this.remember();this.svg.dataset.atlasOriginX=String(this.camera.view.x);this.svg.dataset.atlasOriginY=String(this.camera.view.y);
        this.scheduleRegion(true);
      },
    });
    get("atlas-export-cancel").onclick=()=>{this.exportCancelled=true;if(this.owner){void window.campaign.cancelLandscapeRaster(this.owner.token,'export');void window.campaign.cancelAtlasRegion(this.owner.token,'export');}};
    this.landscape=new LandscapeWorkbench(this.svg,{hit:(e,s)=>this.camera.hitAt(e,s),point:e=>this.camera.point(e),box:()=>this.camera.view,redraw:()=>this.scheduleRender(),write:a=>this.write(a),error:e=>this.error(e),data:()=>this.data,refresh:()=>this.refresh(),choose:p=>this.chooseAt(p,'landscape'),current:()=>this.geometryCurrent()&&this.camera.ready});
    this.hitDialog.id='atlas-hit-candidates';this.hitDialog.addEventListener('close',()=>this.hitVersion++);this.root.append(this.hitDialog);
    this.root.querySelectorAll<HTMLInputElement>('#atlas-hex-level,#atlas-terrain').forEach(n=>n.addEventListener('change',()=>{if(n.id==='atlas-hex-level')get<HTMLInputElement>('land-auto-level').checked=false;this.render();}));
    new ResizeObserver(()=>{const b=this.camera.view,aspect=this.svg.clientWidth/Math.max(1,this.svg.clientHeight);if(aspect>0){const height=b.width/aspect;this.camera.set({...b,y:this.liveDocked?b.y+(b.height-height)/2:b.y,height},true);}}).observe(this.svg);
    const lead=document.createElement('button');
    lead.id='atlas-lead';lead.type='button';lead.textContent='Atlas leiten';
    lead.onclick=()=>void this.opts.leadAtlas?.().catch(error=>this.error(error));
    get('atlas-overview').before(lead);
    const names: Partial<Record<Family, string>> = {
      navigation: "Navigation",
      terrain: "Landschaft",
      city: "Stadt",
      interior: "Innenräume",
      decoration: "Ausstattung",
    };
    for (const [id, name] of Object.entries(names)) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.family = id;
      b.textContent = name;
      b.onclick = () => void this.setFamily(id as Family);
      get("atlas-families").append(b);
    }
    get("atlas-entrance-choice").onchange = () => {
      this.entranceId =
        get<HTMLSelectElement>("atlas-entrance-choice").value || null;
      this.renderTravel();
    };
    get("atlas-region-retry").onclick=()=>void this.refresh();
    get("atlas-export-png").onclick = () => void this.exportPNG();
    for (const id of [
      "atlas-binding-x",
      "atlas-binding-y",
      "atlas-binding-angle",
    ])
      get(id).oninput = () => {
        this.bindingDirty = true;
        get("atlas-draft-cancel").hidden = false;
      };
    get("atlas-binding-save").onclick = () => {
      const binding = this.selectedBinding();
      if (binding)
        void this.write({
          kind: "bind",
          binding: {
            ...binding,
            x: Number(get<HTMLInputElement>("atlas-binding-x").value),
            y: Number(get<HTMLInputElement>("atlas-binding-y").value),
            angle:
              (Number(get<HTMLInputElement>("atlas-binding-angle").value) *
                Math.PI) /
              180,
          },
          expectedRevision: binding.revision,
        }).then((r) => {
          if (r) {
            this.bindingDirty = false;
            get("atlas-draft-cancel").hidden = true;
            this.render();
          }
        });
    };
    get("atlas-place-cancel").onclick = () => {
      this.placeIntent = null;
      get<HTMLDialogElement>("atlas-place-confirm").close();
    };
    get("atlas-place-accept").onclick = () => {
      const p = this.placeIntent;
      this.placeIntent = null;
      get<HTMLDialogElement>("atlas-place-confirm").close();
      if (
        !p ||
        p.token !== this.owner?.token ||
        p.sceneId !== this.data?.geometry.sceneId
      ) {
        this.error(new Error("Fokusgruppe inzwischen geändert."));
        return;
      }
      void this.travel({
        kind: "place",
        point: p.point,
        expectedPositionRevision: p.revision,
        expectedMembershipRevision: p.membership,
      });
    };
    get("atlas-recover").onclick = () =>
      void (async () => {
        if (!this.owner || this.busy) return;
        this.busy = true;
        const owner = this.owner;
        try {
          if (this.pendingTravel) {
            const r = await window.campaign.executeAtlasTravelCommit(
              this.pendingTravel,
            );
            if (this.owner !== owner) return;
            if (!r.ok) throw new Error(r.error);
            this.pendingTravel = null;await this.refresh();
          } else {
            const r = await recoverAtlasCommit(owner.token);
            if (this.owner !== owner || !r) return;
            if (!r.ok) throw new Error(r.error);
            const initial=await window.campaign.workspaceInitial(owner.token);if(!initial.ok)throw new Error("Gespeichert. Arbeitsansicht erneut laden: "+initial.error);await this.opts.updated(initial.value);await this.refresh();
            this.cancel();
            this.landscape.recovered();
          }
          this.status("Speicherstand geklärt");
        } catch (e) {
          if (this.owner === owner) this.error(e);
        } finally {
          if (this.owner === owner) {
            this.busy = false;
            this.render();
          }
        }
      })();
    document.addEventListener("atlas-write-state", () => this.scheduleRender());
    get("atlas-overview").onclick = () => this.overview();
    get("atlas-to-party").onclick = () => this.toParty();
    get("atlas-undo").onclick = () => void this.history("undo");
    get("atlas-redo").onclick = () => void this.history("redo");
    get("atlas-search").oninput = () => this.search();
    get("atlas-roofs").onchange = () => {this.render();this.scheduleRegion();};
    get("atlas-perception").onchange = () => void this.changeGroupView();
    get("atlas-view-refresh").onclick = () => void this.refresh();
    get("atlas-slice-enabled").onchange = () => {this.render();this.scheduleRegion();};
    get("atlas-slice").oninput = () => {this.render();this.scheduleRegion();};
    get("atlas-floor").onchange = () => void this.changeFloor();
    this.playback = journeyPlayback({
      read: () => {
        const j = this.data?.localJourney;
        if (
          !j ||
          j.status !== "active" ||
          this.root.hidden ||
          document.hidden ||
          !this.owner ||
          this.travelReadState !== "ready"
        )
          return null;
        return {
          key: this.owner.token + ":" + j.id,
          revision: j.revision,
          nextIndex: j.revision,
          seconds: 3600,
        };
      },
      step: async () => {
        const j = this.data?.localJourney;
        return (
          !!j &&
          (await this.travel({
            kind: "round",
            id: j.id,
            expectedRevision: j.revision,
          }))
        );
      },
      changed: () => this.renderTravel(),
    });
    for (const kind of [
      "preview",
      "start",
      "step",
      "round",
      "play",
      "pause",
      "end",
      "place",
      "entrance",
    ])
      get("atlas-local-" + kind).onclick = () => void this.travelControl(kind);
    get("atlas-local-refresh").onclick = () => void this.refresh();
    get("atlas-connect-entrance").onclick = () => {
      this.entranceDraft = [];
      get("atlas-hint").textContent =
        "Zuerst den Außenpunkt vor dem Eingang, dann einen Innenpunkt im gewählten Raum anklicken.";
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.playback.stop();
    });
    window.addEventListener("blur", () => this.playback.stop());
    this.locationComposer=new AtlasLocationComposer(()=>this.locationTarget(),()=>this.opts.flush(),async(_ack,id,owner)=>{if(this.owner?.token!==owner.token)return;await this.refresh();if(this.owner?.token!==owner.token)return;this.selection={kind:'place',id};this.render();get('atlas-panel').scrollTop=0;},this.opts.status,{
      prefix:'atlas-place',send:(command,owner)=>atlasLocationWrite(command,owner.point!),check:async(command,owner)=>{const result=await atlasLocationWrite(command,owner.point!);return result.ok?{ok:true,value:{outcome:'applied',ack:result.value}}:{ok:true,value:{outcome:'not-applied',ack:null}};}
    });
    get('atlas-create-place').onclick=()=>void this.locationComposer.open().catch(e=>this.error(e));
    get('atlas-place-read').onclick=()=>void this.openPlace(false);
    get('atlas-place-edit').onclick=()=>void this.openPlace(true);
    get("atlas-create-city").onclick = () => void this.createCity();
    get("atlas-create-dungeon").onclick = () => void this.createDungeon();
    get("atlas-building-interior").onclick = () => void this.createInterior().catch(e=>this.error(e));
    get("atlas-interior-house").onclick = () => void (async () => {
      const owner=this.owner,scope=this.scopeId;
      if(!await this.opts.flush()||this.owner!==owner||this.scopeId!==scope)return;
      const binding=this.data?.bindings.find(b=>b.kind==='dungeon'&&b.ownerId===this.scopeId&&b.parent==='building');
      const city=this.data?.cities.find(c=>c.units.some(u=>u.id===binding?.parentId));
      if(city&&binding)await this.navigate('city',city.header.id,binding.parentId!);
    })().catch(e=>this.error(e));
    get("atlas-draft-cancel").onclick = () => this.cancel();
    this.svg.addEventListener("click", (e) => void this.click(e));
    this.svg.addEventListener("pointerdown", (e) => this.down(e));
    this.svg.addEventListener("pointermove", (e) => this.move(e));
    this.svg.addEventListener("pointerup", (e) => void this.up(e));
    this.svg.addEventListener("pointercancel", () => this.cancel());
    this.svg.addEventListener("lostpointercapture", () => {
      if (
        this.rectangleDrag ||
        this.brushId !== null ||
        this.drag ||
        this.vertexDrag ||
        this.partyDrag
      )
        this.cancel();
    });
    this.svg.addEventListener("keydown", (e) => {
      if(atlasCityPlacementActive()&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();atlasCityPlacementKey(e.key);return;}
      if (e.key === "Enter") {
        e.preventDefault();
        get(this.family === "city" ? "city-finish" : "drawing-finish").click();
      }
      if (e.key === "Escape") this.cancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void this.history(e.shiftKey ? "redo" : "undo");
      }
    });
    document.addEventListener("atlas-written", (e) => {
      const a = (e as CustomEvent<AtlasRenderView>).detail;
      if (a?.workspace.token !== this.owner?.token) return;
      this.landscape.invalidate(a.revision);
      this.loadedRegionQuery=null;
      if(!this.root.hidden)void this.refresh();
    });
    document.addEventListener('atlas-invalidated',e=>{
      const detail=(e as CustomEvent<{campaignId:string;token?:string;revision?:number}>).detail;
      if(detail?.campaignId!==this.owner?.campaign.id||detail.token&&detail.token!==this.owner?.token)return;
      this.loadedRegionQuery=null;if(detail.revision!==undefined)this.landscape.invalidate(detail.revision);
      if(!this.busy&&!this.root.hidden)void this.refresh();
    });
    document.addEventListener("atlas-draft", () => this.scheduleRender());
    document.addEventListener('atlas-city-selection',e=>{
      const d=(e as CustomEvent<{token:string;cityId:string;unitId:string}>).detail,state=atlasCityState();
      if(this.root.hidden||this.family!=='city'||d.token!==this.owner?.token||d.cityId!==this.cityId||state?.token!==d.token||state.view.header.id!==d.cityId)return;
      const u=state.view.units.find(u=>u.id===d.unitId);if(!u||u.kind==='node')return;
      this.selection={kind:u.kind==='building'?'building':'city-unit',id:u.id,cityId:d.cityId};this.render();
    });
    document.addEventListener('atlas-city-focus',e=>{
      const detail=(e as CustomEvent<{token:string;cityId:string;unitId:string}>).detail;
      if(this.root.hidden||detail.token!==this.owner?.token||!this.data)return;
      const city=this.data.cities.find(c=>c.header.id===detail.cityId),unit=city?.units.find(u=>u.id===detail.unitId),binding=this.data.bindings.find(b=>b.kind==='city'&&b.ownerId===detail.cityId);
      if(unit?.position&&binding){this.cityId=detail.cityId;this.selection={kind:'building',id:detail.unitId,cityId:detail.cityId};this.focus(localToAtlas(unit.position,atlasFrame(this.data,binding)),60);}
    });
    document.addEventListener('atlas-city-area-focus',e=>{
      const detail=(e as CustomEvent<{token:string;cityId:string;box:CanvasBox}>).detail;
      if(this.root.hidden||this.groupView||detail.token!==this.owner?.token||this.family!=='city'||this.cityId!==detail.cityId||!this.data)return;
      const binding=this.data.bindings.find(b=>b.kind==='city'&&b.ownerId===detail.cityId);if(!binding)return;
      const b=detail.box,f=atlasFrame(this.data,binding),points=[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x,y:b.y+b.height},{x:b.x+b.width,y:b.y+b.height}].map(p=>localToAtlas(p,f));
      const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),width=Math.max(...points.map(p=>p.x))-x,height=Math.max(...points.map(p=>p.y))-y,ratio=this.svg.clientHeight/Math.max(1,this.svg.clientWidth);
      this.focus({x:x+width/2,y:y+height/2},Math.max(30,width,height/Math.max(.01,ratio))*1.15);
    });
    document.addEventListener('atlas-city-interior',e=>{
      const detail=(e as CustomEvent<{token:string;cityId:string;unitId:string}>).detail;
      if(this.root.hidden||this.groupView||detail.token!==this.owner?.token||this.family!=='city'||this.cityId!==detail.cityId||this.selection?.kind!=='building'||this.selection.id!==detail.unitId)return;
      void this.createInterior().catch(e=>this.error(e));
    });
    document.addEventListener("atlas-runtime", () => {
      if (this.root.hidden) return;this.loadedRegionQuery=null;
      if(this.liveDocked){this.request++;this.previewRequest++;this.localPreview=null;this.travelReadState='loading';this.playback.stop();this.renderTravel();}
      if(this.refreshTimer)return;
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        void this.refresh();
      }, 100);
    });
  }
  private status(text:string,error=false){
    const target=get('atlas-save-status');target.textContent=text;target.dataset.error=String(error);
  }
  private error(e: unknown) {
    const text = (e as Error).message;
    this.status(text,true);
    this.opts.status(text, true);
  }
  private regionQuery(buffered=false):AtlasRegionQuery{
    const box=this.camera.view,width=Math.max(1,Math.min(4096,Math.round(this.svg.clientWidth)||1024)),height=Math.max(1,Math.min(4096,Math.round(this.svg.clientHeight)||768));
    return{box:buffered?{x:box.x-box.width/2,y:box.y-box.height/2,width:box.width*2,height:box.height*2}:box,width:width*(buffered?2:1),height:height*(buffered?2:1),scopeId:this.scopeId,floorId:this.floorId,slice:get<HTMLInputElement>('atlas-slice-enabled').checked?Number(get<HTMLInputElement>('atlas-slice').value):null,roofs:get<HTMLInputElement>('atlas-roofs').checked,perception:get<HTMLInputElement>('atlas-perception').checked};
  }
  private scheduleRegion(camera=false){
    if(this.root.hidden||!this.owner)return;
    if(this.regionTimer){clearTimeout(this.regionTimer);this.regionTimer=null;}
    if(this.geometryCurrent()){this.root.dataset.regionState='ready';this.svg.setAttribute('aria-busy','false');return;}
    this.request++;this.root.dataset.regionState='loading';this.svg.setAttribute('aria-busy','true');
    // Keep a wheel burst on the retained scene; rebuild only after input settles.
    this.regionTimer=setTimeout(()=>{this.regionTimer=null;void this.refresh(camera);},camera?120:60);
  }
  private geometryCurrent(){
    const old=this.loadedRegionQuery,q=this.regionQuery();if(!old)return false;
    if(old.scopeId!==q.scopeId||old.floorId!==q.floorId||old.slice!==q.slice||old.roofs!==q.roofs||old.perception!==q.perception)return false;
    // Pan reuses the loaded buffer. Zoom uses a new frame so constant-pixel tools and hits keep their scale.
    const scale=old.box.width/old.width/(q.box.width/q.width);
    return Math.abs(scale-1)<1e-6&&old.box.x<=q.box.x&&old.box.y<=q.box.y&&old.box.x+old.box.width>=q.box.x+q.box.width&&old.box.y+old.box.height>=q.box.y+q.box.height;
  }
  private scheduleRender() {
    if (this.root.hidden || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }
  get insertionPoint() {
    return this.lastPoint;
  }
  get liveDocked(){return !!this.livePortal?.mounted;}
  liveSurface(){
    return this.livePortal??=new LiveAtlasPortal(this.root,this.svg,visible=>{
      if(this.liveVisible===visible&&this.root.hidden===!visible)return;
      this.liveVisible=visible;
      if(!visible){this.hide();return;}
      this.family='travel';this.landscape.setActive(false);
      void this.open().catch(error=>this.error(error));
    },factor=>this.camera.zoom(factor),mounted=>{
      if(mounted){
        if(this.owner&&this.family!=='travel')this.editingContext={token:this.owner.token,family:this.family,view:{...this.camera.view},selection:this.selection,cityId:this.cityId,scopeId:this.scopeId,floorId:this.floorId,groupView:this.groupView};
        void openDungeon().catch(error=>this.error(error));
      }else{
        const editing=this.editingContext;this.editingContext=null;
        if(editing&&editing.token===this.owner?.token){
          this.family=editing.family;this.selection=editing.selection;this.cityId=editing.cityId;this.scopeId=editing.scopeId;this.floorId=editing.floorId;this.groupView=editing.groupView;
          this.camera.set(editing.view,false);
        }else this.family='navigation';
        stopDungeonPlayback();
      }
    });
  }
  hide() {
    this.request++;this.hitVersion++;this.hitDialog.close();
    this.navigationRequest++;this.navigationJob=null;
    this.groupViewRequest++;

    if(this.regionTimer){clearTimeout(this.regionTimer);this.regionTimer=null;}this.loadedRegionQuery=null;
    if(this.owner)void window.campaign.cancelAtlasRegion(this.owner.token);
    this.previewRequest++;
    this.localPreview = null;
    this.playback.stop();
    this.root.hidden = true;
  }
  activate(w: WorkspaceGeometry) {
    this.navigationRequest++;this.navigationJob=null;
    this.groupViewRequest++;
    this.placeRequest++;this.locationComposer.contextChanged();
    this.hitVersion++;this.hitDialog.close();this.travelReadState = "loading";this.loadedRegionQuery=null;this.root.dataset.regionState='loading';this.svg.setAttribute('aria-busy','true');

    this.previewRequest++;
    this.playback.stop();
    this.localPreview = null;
    this.entranceId = null;
    this.entranceDraft = null;
    this.bindingDirty = false;
    this.owner = w;
    this.searchRequest++;get('atlas-search-results').replaceChildren();
    this.landscape.context(w.token);
    this.data = null;this.baseGeometry=null;this.panelKey=null;this.entranceOptions='';
    this.request++;
    this.selection = null;
    this.cityId = null;
    this.scopeId = null;
    this.camera.context(w.campaign.id, {
      x: -15000,
      y: -10000,
      width: 30000,
      height: 20000,
    });
    try {
      const p = JSON.parse(
        localStorage.getItem("atlas-camera:" + w.campaign.id) ?? "null",
      );
      if (
        p &&
        ["x", "y", "width", "height"].every((k) => Number.isFinite(p[k])) &&
        p.width > 0 &&
        p.height > 0
      )
        this.camera.set(p, false);
    } catch {
      /* local view preference */
    }
  }
  async open() {
    this.root.hidden=false;const owner=this.owner;if(!owner)return;
    if(this.opening?.owner===owner)return this.opening.task;
    const task=(async()=>{await this.refresh();if(this.owner!==owner||this.root.hidden)return;await this.setFamily(this.family,false);})();
    this.opening={owner,task};
    try{await task;}finally{if(this.opening?.task===task)this.opening=null;}
  }
  async refresh(keepScene=false) {
    if(this.regionTimer){clearTimeout(this.regionTimer);this.regionTimer=null;}
    const w = this.owner,
      request = ++this.request;
    if (!w) return;
    const cameraPreview=keepScene?this.localPreview:null,previewFence=this.data?.region?.fence;
    const previousSceneId=this.data?.geometry.sceneId;const retry = this.travelReadState === "failed";get("atlas-region-retry").hidden=true;if(!this.data)get("atlas-save-status").textContent="Kartenausschnitt wird geladen…";
    this.hitVersion++;this.hitDialog.close();this.travelReadState = "loading";this.loadedRegionQuery=null;this.root.dataset.regionState='loading';this.svg.setAttribute('aria-busy','true');
    get("atlas-hint").textContent=this.data?"Vorheriger Kartenstand · Ansicht wird geladen. Auswahl und Bearbeitung sind vorübergehend gesperrt.":"Ansicht wird geladen.";

    this.previewRequest++;
    this.localPreview = null;
    this.playback.stop();
    if(!keepScene)this.render();
    this.renderTravel();
    try {
      const query=this.regionQuery(true);
      const r = await window.campaign.atlasRegion(w.token,query);
      if (this.owner !== w || request !== this.request) return;
      if (!r.ok) throw new Error(r.error);
      this.hitVersion++;this.hitDialog.close();this.data = r.value;this.loadedRegionQuery=query;void this.landscape.load().catch(e=>this.error(e));this.root.dataset.regionState='ready';this.svg.setAttribute('aria-busy','false');
      get("atlas-hint").textContent=r.value.region.coverage.mode==='raster'?"Dichte Kartengeometrie als Bild · Auswahl liest das genaue Objekt. Weiter hineinzoomen für Konturwerkzeuge.":"Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.";
      if(r.value.region.coverage.unreadable)get("atlas-hint").textContent+=` ${r.value.region.coverage.unreadable} beschädigte Karteneinträge bleiben unverändert.`;
      const layer=r.value.region.landscape;if(layer?.state==='error')get('atlas-hint').textContent+=' Landschaft nicht verfügbar. Ansicht erneut laden; übrige Karte bleibt nutzbar.';else if(layer?.coverage.mode==='raster')get('atlas-hint').textContent+=' Dichte Landschaft als Übersicht; genaue Auswahl per Klick.'+(layer.coverage.references>layer.records.filter(r=>r.kind==='reference').length?' Bildvorlagen als Umrisse.':'');
      this.travelReadState = "ready";if(get("atlas-save-status").textContent==="Kartenausschnitt wird geladen…")get("atlas-save-status").textContent="Kartenausschnitt geladen";
      if(previousSceneId!==r.value.geometry.sceneId&&!pendingAtlasWrite(w.token)&&!this.pendingTravel)this.status('');
      if (retry) {
        this.status("Reisekontext aktualisiert");
        this.opts.status("Reisekontext aktualisiert");
      }
      // Camera reads do not change the intended route. Restore it only after
      // confirming exactly the same source; pending/failed reads stay locked.
      if(cameraPreview&&previewFence&&r.value.region.fence===previewFence)this.localPreview=cameraPreview;
      this.render();return true;
    } catch (e) {
      if (this.owner === w && request === this.request) {
        this.travelReadState = "failed";this.root.dataset.regionState='failed';this.svg.setAttribute('aria-busy','false');
        this.error(e);get("atlas-region-retry").hidden=false;get("atlas-hint").textContent="Ansicht nicht verfügbar. Vorheriger Kartenstand; erneut laden.";
        if(this.groupView)this.render();this.renderTravel();

      }return false;
    }
  }
  private remember() {
    if (!this.owner) return;
    try {
      localStorage.setItem(
        "atlas-camera:" + this.owner.campaign.id,
        JSON.stringify(this.camera.view),
      );
    } catch {
      /* author saving remains independent */
    }
  }
  async flush() {
    if(!this.locationComposer.flush())return false;
    this.playback.stop();
    await this.playback.settled();
    if (
      this.busy ||
      this.pendingTravel ||
      (this.owner && pendingAtlasWrite(this.owner.token))
    )
      return false;
    if (
      this.landscape.hasDraft() ||
      this.bindingDirty ||
      this.rectangleDrag ||
      this.brushId !== null ||
      this.drag ||
      this.vertexDrag ||
      this.partyDrag ||
      this.entranceDraft ||
      this.placeIntent
    ) {
      this.error(new Error("Begonnenen Atlaszug abschließen oder verwerfen."));
      return false;
    }
    return true;
  }
  private async write(action: AtlasAction, applyWorkspace = false) {
    const w = this.owner;
    if (!w || this.busy) return null;
    this.busy = true;
    this.status("Wird gespeichert…");
    try {
      const commandId = crypto.randomUUID(),
        a = structuredClone(action);
      if (a.kind === "city" || a.kind === "world" || a.kind === "drawing")
        a.command.commandId = commandId;
      if (a.kind === "room-edit") a.edit.commandId = commandId;
      const command={commandId,token:w.token,campaignId:w.campaign.id,action:a,...(this.data?.region?{sourceFence:this.data.region.fence}:{})};
      const ack=await writeAtlasCommit(command);
      if(this.owner!==w)return null;if(!ack.ok)throw new Error(ack.error);
      this.status('Gespeichert');
      this.playback.stop();this.localPreview=null;this.loadedRegionQuery=null;
      if(this.data)this.data={...this.data,revision:ack.value.revision,canUndo:ack.value.canUndo,canRedo:ack.value.canRedo};
      try{
        if(applyWorkspace){const initial=await window.campaign.workspaceInitial(w.token);if(!initial.ok)throw new Error(initial.error);await this.opts.updated(initial.value);}
        const loaded=await this.refresh();if(!loaded&&this.owner===w){get('atlas-save-status').textContent='Gespeichert. Kartenansicht erneut laden.';this.opts.status('Gespeichert. Kartenansicht erneut laden.',true);}
        if(a.kind==='city'&&(this.selection?.kind==='building'||this.selection?.kind==='city-unit'))await openCityReference(a.command.cityId,this.selection.id,true,true);
      }catch(error){if(this.owner===w)this.opts.status('Gespeichert. Kartenansicht erneut laden: '+(error as Error).message,true);}
      return{atlas:this.data!,result:ack.value.result??null};
    } catch (e) {
      if (this.owner === w) this.error(e);
      return null;
    } finally {
      if (this.owner === w) {
        this.busy = false;
        this.render();
      }
    }
  }
  private locationTarget():AtlasLocationOwner|null{const w=this.owner,a=this.data;return w&&a?{token:w.token,campaignId:w.campaign.id,mapId:a.terrain.id,mapRevision:a.terrain.revision,mapName:a.terrain.name,point:{...this.lastPoint},hex:atlasHexAt(this.lastPoint,a.terrain.hexMeters)}:null;}
  private async openPlace(edit:boolean){
    const w=this.owner,s=this.selection;if(!w||s?.kind!=='place')return;const request=++this.placeRequest,id=s.id,box=this.camera.view,current=()=>this.owner===w&&this.placeRequest===request;
    try{if(!await this.opts.flush()||!current())return;if(edit)await this.opts.editLocation?.(id,current,async()=>{if(!current())return;await this.open();if(!current())return;this.selection={kind:'place',id};await this.setFamily('navigation',false);this.camera.set(box,true);this.render();get('atlas-panel').scrollTop=0;});else await this.opts.readLocation?.(id,current);}catch(e){if(current())this.error(e);}
  }
  private async history(kind: "undo" | "redo") {
    const owner=this.owner;
    if (!(await this.opts.flush())||this.owner!==owner) return;
    if((!this.geometryCurrent()||this.travelReadState!=='ready')&&(!await this.refresh()||this.owner!==owner))return;
    const result = await this.write({ kind }, true);
    if (result && this.cityId){if(result.atlas.cities.some(c=>c.header.id===this.cityId)){const id=this.selection?.kind==='building'||this.selection?.kind==='city-unit'?this.selection.id:undefined;await openCityReference(this.cityId,id,false,false,true);if(id&&!atlasCityState()?.view.units.some(u=>u.id===id))this.selection={kind:'city',id:this.cityId};this.render();}else{this.cityId=null;this.selection=null;await this.setFamily('navigation',false);}}
    if(result&&this.selection?.kind==='place'&&!result.atlas.places.some(p=>p.locationId===this.selection!.id&&!p.trashed)){this.selection=null;this.render();}
  }
  private selectedBinding() {
    const s = this.selection;
    return s?.kind === "city"
      ? this.data?.bindings.find((b) => b.kind === "city" && b.ownerId === s.id)
      : s?.kind === "scope"
        ? this.data?.bindings.find(
            (b) =>
              b.kind === "dungeon" &&
              b.ownerId === s.id &&
              b.parent === "world",
          )
        : null;
  }
  private async navigationGuard() {
    const owner = this.owner, request = ++this.navigationRequest;
    const current = () => this.owner === owner &&
      this.navigationRequest === request && !this.root.hidden;
    if (!owner || !await this.opts.flush() || !current()) return null;
    return current;
  }
  private async chooseScope(id:string){await this.navigateScope(id);}
  private frame(scopeId: string) {
    const b = this.data?.bindings.find(
        (b) => b.kind === "dungeon" && b.ownerId === scopeId,
      ),
      f = b ? atlasFrame(this.data!, b) : null;
    if(!f)throw new Error("Räumliche Einordnung wird geladen. Ausschnitt erneut laden.");
    if (
      b?.parent === "building" &&
      this.drag?.selection?.kind === "building" &&
      b.parentId === this.drag.selection.id
    ) {
      f.x += this.drag.last.x - this.drag.start.x;
      f.y += this.drag.last.y - this.drag.start.y;
    }
    return f;
  }
  private point(e: MouseEvent) {
    return this.camera.point(e);
  }
  private cancel() {
    if(atlasCityPlacementActive())atlasCityPlacementKey('Escape');
    this.bindingDirty = false;
    this.cityShapeDrag = null;
    this.rectangleDrag = null;
    this.brushId = null;
    this.vertexDrag = null;
    this.partyDrag = null;
    if (this.family === "interior" || this.family === "decoration")
      cancelDrawingGesture();
    if (this.family === "city") get("city-cancel-path").click();
    this.entranceDraft = null;
    this.drag = null;
    get("atlas-draft-cancel").hidden = true;
    this.render();
  }
  private async setFamily(f: Family, flush = true) {
    if (flush && !(await this.opts.flush())) return;
    if(f!==this.family&&["interior","decoration"].includes(this.family))cancelDrawingGesture();
    this.family = f;
    this.landscape.setActive(f==="terrain"&&!this.groupView);
    for (const b of get("atlas-families").querySelectorAll<HTMLButtonElement>(
      "button",
    ))
      b.setAttribute("aria-pressed", String(b.dataset.family === f));
    get("atlas-tool-fields").dataset.family = f;
    get("atlas-advanced-fields").replaceChildren();
    // The original controls now dock beside this surface; their old canvases stay hidden.
    const ids =
      f === "city"
        ? ["city"]
        : f === "interior" || f === "decoration"
          ? ["atlas", "drawing-quick-tools", "drawing-toolbar", "drawing-tool-options", "drawing-feedback"]
          : f === "travel"
            ? ["world"]
            : f === "terrain"
              ? []
              : [];
    for (const [id, saved] of this.adopted) {
      saved.node.hidden = true;
      if (!ids.includes(id))
        saved.parent.insertBefore(
          saved.node,
          saved.next?.parentNode === saved.parent ? saved.next : null,
        );
    }
    for (const id of ids) {
      const n = this.adopted.get(id)?.node ?? get(id);
      if (!this.adopted.has(id))
        this.adopted.set(id, {
          node: n,
          parent: n.parentElement!,
          next: n.nextSibling,
        });
      get(id.startsWith("drawing-") ? "atlas-drawing-tools" : "atlas-advanced-fields").append(n);
      n.hidden = false;
    }
    this.root.dataset.family = f;
    if(f==="city")get<HTMLDetailsElement>("atlas-advanced").open=true;
    if(f==='interior'||f==='decoration')await reloadDrawing();
    if (f === "city" && this.cityId) await openCityReference(this.cityId,this.selection?.kind==='building'||this.selection?.kind==='city-unit'?this.selection.id:undefined,true);
    if (f === "travel") {
      await this.refresh();
      await openWorld();
      await openDungeon();
    }
    this.render();this.scheduleRegion();
  }
  private async changeGroupView() {
    const box=get<HTMLInputElement>('atlas-perception'),wanted=box.checked,
      owner=this.owner,request=++this.groupViewRequest;
    box.checked=this.groupView;
    if(wanted===this.groupView)return;
    try {
      if(!await this.opts.flush()||this.owner!==owner||request!==this.groupViewRequest||this.root.hidden)return;
      this.groupView=wanted;box.checked=wanted;
      await this.refresh();
    }catch(error){if(this.owner===owner&&request===this.groupViewRequest)this.error(error);}
  }
  private drawGroupView(root:AtlasPaint,data:AtlasRenderView,box:CanvasBox) {
    const group=shape('group',{style:{fontFamily:'Noto Sans, sans-serif'}});group.data.atlasPublicView='true';
    const status=get('atlas-view-status');status.hidden=false;
    try {
      if(this.travelReadState!=='ready')throw new Error(this.travelReadState==='failed'?'Gruppensicht nicht verfügbar. Bitte neu laden.':'Gruppensicht wird geladen…');
      const frame=data.publicFrame;
      if(!frame||!['map','dungeon'].includes(frame.mode))throw new Error(frame?.reason||'Für diesen Gruppenstandort ist keine Gruppensicht verfügbar.');
      const view=publicAtlasPaint(data,box,frame,[],box.width/Math.max(1,this.svg.clientWidth));
      group.append(...view.children);
      status.textContent=this.family==='travel'
        ? 'Gruppensicht · Ziel in einem bekannten Bereich wählen. Zum Bearbeiten die Gruppensicht ausschalten.'
        : 'Gruppensicht · Zum Bearbeiten „Wissen und Sicht der Gruppe“ ausschalten.';
    }catch(error){
      group.append(shape('rect',{width:box.width,height:box.height,style:{fill:'#20282a'}}));
      status.textContent=(error as Error).message;
    }
    root.append(group);
  }
  private async groupViewClick(p:Point) {
    const data=this.data;
    if(!data||this.family!=='travel'||this.travelReadState!=='ready'||!data.publicFrame)return;
    const pose=data.geometry.position;
    if(pose&&data.publicFrame.mode==='dungeon'&&data.perception){
      const local=atlasToLocal(p,this.frame(pose.scopeId));
      if(!inside(local,data.perception.known))return;
      const room=data.workspace.rooms.find(r=>r.scopeId===pose.scopeId&&r.floorId===pose.floorId&&inside(local,r.polygons));
      if(!room)return;
      this.playback.stop();this.previewRequest++;this.localPreview=null;
      this.selection={kind:'room',id:room.id};this.scopeId=room.scopeId;this.floorId=room.floorId;
      await atlasDungeonTarget(room.id,local);
    }else if(!pose&&data.publicFrame.mode==='map'&&data.publicFrame.map){
      const h=atlasHexAt(p,data.publicFrame.map.hexMeters);
      if(!data.publicFrame.map.cells.some(c=>c.q===h.q&&c.r===h.r))return;
      this.playback.stop();this.previewRequest++;this.localPreview=null;this.lastPoint=p;
      atlasWorldTarget(h);
    }
    this.render();
  }
  private async changeFloor() {
    const picker=get<HTMLSelectElement>('atlas-floor'),wanted=picker.value,
      request=++this.floorRequest,owner=this.owner,scope=this.scopeId,
      before=this.floorId,family=this.family,selection=this.selection;
    // Keep the displayed and drawing floors together while editors settle.
    picker.value=before;
    if(wanted===before||!scope||!owner)return;
    const current=()=>request===this.floorRequest&&this.owner===owner&&
      this.scopeId===scope&&this.floorId===before&&this.family===family&&
      this.selection===selection&&!this.root.hidden;
    try {
      if(!await this.opts.flush()||!current())return;
      if(!this.data?.workspace.floors.some(f=>f.scopeId===scope&&f.id===wanted))return;
      this.floorId=wanted;
      this.syncDrawingFloor();
      get<HTMLInputElement>('atlas-slice').value=String(
        this.data.geometry.floors.find(f=>f.scopeId===scope&&f.id===wanted)?.elevation??0,
      );
      this.render();
    }catch(error){if(current())this.error(error);}
  }
  private syncDrawingFloor() {
    if (!this.scopeId) return;
    atlasDrawingScope(
      this.data?.bindings.some(
        (b) => b.ownerId === this.scopeId && b.parent === "building",
      )
        ? this.scopeId
        : null,
    );
    const select = get<HTMLSelectElement>("floors"),
      v = JSON.stringify([this.scopeId, this.floorId]);
    if ([...select.options].some((o) => o.value === v)) {
      if(select.value!==v){select.value = v;select.dispatchEvent(new Event("change"));}
    }
  }
  async navigateLocation(id:string,sectionId?:string){await this.refresh();await this.setFamily('terrain',false);const p=await this.landscape.openLocation(id,sectionId);if(p)this.focus(p,15000);}
  async navigate(kind:"city"|"room",id:string,unitId?:string){
    let finish!:(ready:boolean)=>void;const job={settled:new Promise<boolean>(resolve=>{finish=resolve;})};this.navigationJob=job;let ready=false;this.render();
    try{
    const current=await this.navigationGuard();if(!current?.())return;const owner=this.owner!;
    this.request++;
    const request=++this.searchRequest,result=await window.campaign.atlasObjectFocus(owner.token,unitId?'building':kind,unitId??id);
    if(!current()||this.owner!==owner||request!==this.searchRequest)return;if(!result.ok)throw new Error(result.error);
    const target=result.value;
    if(kind==='city'){
      this.cityId=id;this.scopeId=target.interiorScopeId??null;this.floorId='ground';this.selection=unitId?{kind:target.kind==='building'?'building':'city-unit',id:unitId,cityId:id}:{kind:'city',id};
      await this.setFamily('city',false);if(!current()||this.owner!==owner)return;await openCityReference(id,unitId,true);
    }else{
      this.selection={kind:'room',id};this.scopeId=target.scopeId!;this.floorId=target.floorId!;
      await this.opts.selectRoom(id);if(!current()||this.owner!==owner)return;await this.setFamily('interior',false);this.syncDrawingFloor();
    }
    if(!current()||this.owner!==owner||request!==this.searchRequest)return;
    this.focus(target.point,Math.max(kind==='city'&&!unitId?60:30,target.box.width*1.4),Math.max(kind==='city'&&!unitId?60:30,target.box.height*1.4));
    ready=!!(await this.refresh());
    }finally{finish(ready);if(this.navigationJob===job){this.navigationJob=null;this.render();}}
  }
  private async navigateScope(id:string){
    const current=await this.navigationGuard();if(!current?.())return;const owner=this.owner!;
    const r=await window.campaign.atlasObjectFocus(owner.token,'scope',id);if(!current())return;if(!r.ok)throw new Error(r.error);
    this.scopeId=id;this.floorId=r.value.floorId!;this.selection={kind:'scope',id};await this.setFamily('interior',false);this.syncDrawingFloor();
    this.focus(r.value.point,Math.max(50,r.value.box.width*1.4),Math.max(50,r.value.box.height*1.4));await this.refresh();
  }
  private async navigateElement(id:string){
    const owner=this.owner;if(!owner||!await this.opts.flush())return;
    const r=await window.campaign.atlasObjectFocus(owner.token,'element',id);if(this.owner!==owner)return;if(!r.ok)throw new Error(r.error);
    this.scopeId=r.value.scopeId!;this.floorId=r.value.floorId!;
    const exact=await window.campaign.drawingElement(owner.token,id);if(this.owner!==owner)return;if(!exact.ok)throw new Error(exact.error);
    if(exact.value.roomId)await this.opts.selectRoom(exact.value.roomId);if(this.owner!==owner)return;
    await this.setFamily('decoration',false);this.syncDrawingFloor();await selectElement(id);
    this.focus(r.value.point,Math.max(30,r.value.box.width*2),Math.max(30,r.value.box.height*2));await this.refresh();
  }
  private async navigatePlace(id:string){const w=this.owner;if(!await this.opts.flush()||this.owner!==w)return;await this.refresh();if(this.owner!==w)return;const place=this.data?.places.find(p=>p.locationId===id&&!p.trashed);if(!place)return;this.selection={kind:'place',id};await this.setFamily('navigation',false);this.focus(place.point,Math.min(15000,Math.max(this.camera.view.width,300)));this.render();get('atlas-panel').scrollTop=0;}
  private focus(p: Point, width: number, height=width) {
    const ratio = Math.max(1,this.svg.clientHeight) / Math.max(1, this.svg.clientWidth);
    width=Math.max(width,height/ratio);
    this.camera.set(
      {
        x: p.x - width / 2,
        y: p.y - (width * ratio) / 2,
        width,
        height: width * ratio,
      },
      true,
    );
  }
  private overview() {
    const b=this.camera.view;this.camera.set(earthView(this.svg.clientWidth/Math.max(1,this.svg.clientHeight),{x:b.x+b.width/2,y:b.y+b.height/2}),true);
  }
  private toParty() {
    if(!this.data||this.travelReadState!=='ready'||this.navigationJob||this.busy)return;
    const p = this.data?.geometry.position;
    if (p) {
      this.scopeId = p.scopeId;
      this.floorId = p.floorId;
      this.focus(localToAtlas(p, this.frame(p.scopeId)), 50);
    } else if (this.data?.scene) {
      this.focus(
        atlasPartyPoint(this.data)!,
        this.data.scene.position.city || this.data.scene.position.outdoor
          ? 80
          : this.data.terrain.hexMeters * 5,
      );
    }
    this.render();
  }
  private search() {
    const request=++this.searchRequest;
    const root = get("atlas-search-results");
    root.replaceChildren();
    const text = get<HTMLInputElement>("atlas-search")
      .value.trim()
      .toLocaleLowerCase("de");
    if (!text || !this.owner) return;
    const resultKeys=new Set<string>();
    const add = (name: string, fn: () => void,key?:string) => {
      if(key&&resultKeys.has(key))return;if(key)resultKeys.add(key);
      const b = document.createElement("button");
      b.textContent = name;
      b.onclick = () => {
        this.searchRequest++;
        root.replaceChildren();
        fn();
      };
      root.append(b);
    };
    // A bounded/cold viewport may contain a city's place marker but not its city DTO.
    // Let the global city page claim that location before adding marker fallbacks.
    const cachedPlaces=(this.data?.places??[]).filter(place=>!place.trashed&&place.name.toLocaleLowerCase("de").includes(text));
    const token=this.owner!.token;
    let cityPage:Promise<void>=Promise.resolve();

    const current=()=>request===this.searchRequest&&this.owner?.token===token&&get<HTMLInputElement>('atlas-search').value.trim().toLocaleLowerCase('de')===text;
    const more=(title:string,load:()=>Promise<void>)=>{const b=document.createElement('button');b.textContent=title;b.onclick=()=>{b.remove();void load().catch(e=>{if(current())this.error(e);});};root.append(b);};
    const page=async(kind:'city'|'landscape'|'scope',cursor?:import('./campaign-atlas-contracts').AtlasObjectQuery['cursor'])=>{
      const result=await window.campaign.atlasObjects(token,{kind,text,limit:40,cursor});if(kind!=='city')await cityPage;if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.name,()=>void (kind==='landscape'?this.navigateLandscape(item.id).catch(e=>this.error(e)):kind==='scope'?this.navigateScope(item.id).catch(e=>this.error(e)):this.navigate(kind,item.id).catch(e=>this.error(e))),item.locationId?'location:'+item.locationId:kind+':'+item.id);
      if(result.value.next)more(kind==='city'?'Weitere Städte':kind==='scope'?'Weitere Dungeons':'Weitere Landschaftsobjekte',()=>page(kind,result.value.next!));
    };
    const rooms=async(cursor?:import('./contracts').RoomDirectoryQuery['cursor'])=>{
      const result=await window.campaign.roomDirectory(token,{text,limit:40,...(cursor?{cursor}: {})},'atlas');await cityPage;if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.number+' · '+item.name,()=>void this.navigate('room',item.id).catch(e=>this.error(e)));
      if(result.value.unreadable){const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent=result.value.unreadable+' Raumtexte konnten nicht durchsucht werden.';root.append(warning);}
      if(result.value.next)more('Weitere Räume',()=>rooms(result.value.next!));
    };
    const cityUnits=async(cursor?:import('./campaign-atlas-contracts').AtlasObjectQuery['cursor'])=>{
      const r=await window.campaign.atlasObjects(token,{kind:'city-unit',text,limit:40,cursor});await cityPage;if(!current())return;if(!r.ok)throw new Error(r.error);
      for(const item of r.value.items){
        const kind=({road:'Straße',wall:'Befestigung',district:'Viertel',plaza:'Platz',water:'Wasserfläche'} as Record<string,string>)[item.unitKind??'']??'Stadtelement';
        const at=Number.isFinite(item.startX)&&Number.isFinite(item.startY)?' · bei '+Math.round(item.startX!)+', '+Math.round(item.startY!)+' m':'';
        add(item.cityTitle+' · '+kind+': '+item.name+at,()=>void this.navigate('city',item.cityId!,item.id).catch(e=>this.error(e)),'city-unit:'+item.id);
      }
      if(r.value.next)more('Weitere Stadtelemente',()=>cityUnits(r.value.next!));
    };
    const buildings=async(offset=0)=>{const result=await window.campaign.cityBuildings(token,{text,offset});await cityPage;if(!current())return;if(!result.ok)throw new Error(result.error);for(const item of result.value.items)add(item.cityTitle+' · '+item.title,()=>void this.navigate('city',item.cityId,item.unitId).catch(e=>this.error(e)));if(result.value.next!==null)more('Weitere Häuser',()=>buildings(result.value.next!));};
    cityPage=page('city').catch(e=>{if(current())this.error(e);});
    void cityPage.then(()=>{if(!current())return;for(const place of cachedPlaces)add(place.name,()=>void this.navigatePlace(place.locationId),'location:'+place.locationId);});
    for(const task of [rooms(),page('landscape'),page('scope'),buildings(),cityUnits()])void task.catch(e=>{if(current())this.error(e);});

  }

  private async navigateLandscape(id:string) {
    const owner=this.owner;if(!owner||!await this.flush()||!await this.opts.flush()||this.owner!==owner)return;
    const result=await window.campaign.atlasLandscapeObject(owner.token,id);
    if(this.owner!==owner)return;
    if(!result.ok){this.error(new Error(result.error));return;}
    const record=result.value;
    if(record.kind==='place'&&record.locationId){
      // A global landscape result may refer to a canonical place outside the old viewport.
      if(record.points[0])this.focus(record.points[0],15000);
      await this.refresh();if(this.owner!==owner)return;
      if(this.data?.places.some(p=>p.locationId===record.locationId&&!p.trashed)){
        await this.navigatePlace(record.locationId);return;
      }
    }
    await this.setFamily('terrain',false);if(this.owner!==owner)return;
    if(record.points[0])this.focus(record.points[0],15000);
    await this.landscape.select(record);
  }

  private async createCity() {
    const r = await this.write({
      kind: "city-create",
      name: get<HTMLInputElement>("atlas-new-name").value,
      x: this.lastPoint.x,
      y: this.lastPoint.y,
      width: 500,
      height: 500,
    });
    if (r) {
      const id = (r.result as { id: string }).id;
      await this.navigate("city", id);
    }
  }
  private async createDungeon() {
    const r = await this.write(
      {
        kind: "dungeon-create",
        name: get<HTMLInputElement>("atlas-new-name").value,
        x: this.lastPoint.x,
        y: this.lastPoint.y,
      },
      true,
    );
    if (r) {
      this.scopeId = (r.result as { id: string }).id;
      this.floorId = "ground";
      this.selection = { kind: "scope", id: this.scopeId };
      await this.setFamily("interior", false);
      this.syncDrawingFloor();
      this.focus(this.lastPoint, 50);
    }
  }
  private async createInterior() {
    if (this.selection?.kind !== "building") return;
    const startOwner=this.owner,startBuilding=this.selection.id,intent=this.navigationRequest,pending=this.navigationJob;
    if(pending&&!await pending.settled)return;
    if(this.owner!==startOwner||this.selection?.id!==startBuilding||this.navigationRequest!==intent||this.root.hidden)return;
    const existingId=regionValue(this.data?.region?.interiors,this.selection.id),existing=this.data?.bindings.find(b=>b.kind==='dungeon'&&b.parent==='building'&&b.parentId===this.selection?.id)??(existingId?{ownerId:existingId}:null);
    if(existing){const owner=this.owner,buildingId=this.selection.id;if(!await this.opts.flush()||this.owner!==owner||this.selection?.id!==buildingId)return;}
    const r = existing ? null : await this.write(
      {
        kind: "dungeon-create",
        name: "Innenräume",
        x: 0,
        y: 0,
        buildingId: this.selection.id,
      },
      true,
    );
    if (r || existing) {
      this.scopeId = existing?.ownerId ?? (r!.result as { id: string }).id;
      this.floorId = "ground";
      if(!await this.refresh())return;
      const f = this.frame(this.scopeId);
      this.focus(f, 30);
      await this.setFamily("interior", false);
      this.syncDrawingFloor();
      this.render();
      get("atlas-panel").scrollTop=0;
    }
  }

  private async chooseAt(point:Point,layer:'geometry'|'landscape'|'all'='all',preferred?:{kind:import('./atlas-region-contracts').AtlasHit['kind'];id:string},visualElementId?:string){

    const owner=this.owner,query=this.loadedRegionQuery,fence=this.data?.region?.fence,version=++this.hitVersion;
    if(!owner||!query||!fence||!this.geometryCurrent())return;
    const valid=()=>this.owner===owner&&this.data?.region?.fence===fence&&this.hitVersion===version&&this.geometryCurrent();
    const choose=async(hit:import('./atlas-region-contracts').AtlasHit)=>{
      if(!valid())return;this.hitDialog.close();
      if(hit.kind==='landscape'){await this.setFamily('terrain');if(this.owner===owner&&this.data?.region?.fence===fence)await this.landscape.selectId(hit.id);}
      else if(hit.kind==='element')await this.navigateElement(hit.id);
      else if(hit.kind==='scope')await this.navigateScope(hit.id);
      else await this.navigate(hit.kind==='room'?'room':'city',hit.cityId??hit.id,hit.cityId?hit.id:undefined);
    };
    const page=async(offset:number)=>{
      const reply=await window.campaign.atlasRegionCandidates(owner.token,query,point,fence,offset,layer,visualElementId);
      if(!valid())return;if(!reply.ok)throw new Error(reply.error);const result=reply.value;
      const unavailable=[...new Set([...(result.unavailable??[]),...(layer!=='geometry'&&this.data?.region?.landscape?.state==='error'?['landscape' as const]:[])])],incomplete=!!unavailable.length;
      const direct=offset===0&&preferred?result.items.find(hit=>hit.kind===preferred.kind&&hit.id===preferred.id):undefined;
      if(direct){await choose(direct);return;}
      if(result.total===1&&offset===0&&!incomplete){await choose(result.items[0]!);return;}
      if(!result.items.length){this.opts.status(incomplete?'Auswahl unvollständig: Eine Kartenebene ist nicht verfügbar. Ansicht erneut laden.':'Hier ist kein passendes Objekt.',incomplete);return;}
      this.hitDialog.replaceChildren();const title=document.createElement('h2');title.textContent='Objekt an dieser Stelle auswählen';this.hitDialog.append(title);
      const count=document.createElement('p');count.textContent=result.total+' Treffer · '+(offset+1)+'–'+(offset+result.items.length);this.hitDialog.append(count);
      if(incomplete){const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent='Auswahl unvollständig: '+unavailable.map(layer=>layer==='landscape'?'Landschaft':'Raum-/Stadtgeometrie').join(', ')+' nicht verfügbar. Verfügbare Treffer können geöffnet werden; Ansicht erneut laden.';this.hitDialog.append(warning);}
      for(const hit of result.items){const button=document.createElement('button');button.type='button';button.textContent=({landscape:'Landschaft',room:'Raum',building:'Haus',element:'Objekt',scope:'Dungeon',city:'Stadt','city-unit':'Stadtelement'}[hit.kind])+': '+hit.name;button.onclick=()=>void choose(hit).catch(e=>this.error(e));this.hitDialog.append(button);}
      if(offset>0){const back=document.createElement('button');back.textContent='Vorige Treffer';back.onclick=()=>void page(Math.max(0,offset-40)).catch(e=>this.error(e));this.hitDialog.append(back);}
      if(result.next!==null){const next=document.createElement('button');next.textContent='Weitere Treffer';next.onclick=()=>void page(result.next!).catch(e=>this.error(e));this.hitDialog.append(next);}
      const cancel=document.createElement('button');cancel.textContent='Abbrechen';cancel.onclick=()=>this.hitDialog.close();this.hitDialog.append(cancel);if(!this.hitDialog.open)this.hitDialog.showModal();
    };await page(0);
  }
  private pointToolActive(){
    return this.root.dataset.roomDraw==='true'||this.entranceDraft!=null||
      (this.family==='interior'||this.family==='decoration')&&get<HTMLSelectElement>('drawing-tool').value!=='select'||
      this.family==='city'&&(atlasCityPlacementActive()||get<HTMLSelectElement>('city-tool').value!=='select');
  }
  private async click(e: MouseEvent) {
    if (this.ignoreClick) {
      this.ignoreClick = false;
      return;
    }
    if (this.busy || e.altKey || e.button !== 0 || this.drag || this.vertexDrag)
      return;
    if(!this.camera.ready||!this.geometryCurrent()){this.opts.status('Kartenausschnitt wird vorbereitet.');return;}
    const p = this.point(e);
    if(this.groupView){try{await this.groupViewClick(p);}catch(error){this.error(error);}return;}
    this.lastPoint = p;
    const target = this.camera.hitAt(e, ["atlasObject"]),
      kind = target?.data.kind,
      id = target?.data.id;
    if(this.family==='navigation'&&!target){this.selection=null;this.render();}
    try {
      if (this.family === "terrain") return;
      const shapeHandle=this.family==='city'?this.camera.hitAt(e,['cityShapeHandle']):null;
      if(shapeHandle){atlasCityChooseShapeHandle(Number(shapeHandle.data.cityShapeHandle),shapeHandle.data.cityShapeInsert==='true');return;}
      if(!this.geometryCurrent()&&(this.root.dataset.roomDraw==='true'||this.entranceDraft!==null||this.family==='city'&&(atlasCityPlacementActive()||get<HTMLSelectElement>('city-tool').value!=='select')||['interior','decoration'].includes(this.family)&&get<HTMLSelectElement>('drawing-tool').value!=='select'))throw new Error('Kartengeometrie wird geladen. Zug anschließend beginnen.');
      const selecting=this.root.dataset.roomDraw!=='true'&&this.entranceDraft===null&&(this.family==='navigation'||this.family==='interior'&&get<HTMLSelectElement>('drawing-tool').value==='select'||this.family==='decoration'&&get<HTMLSelectElement>('drawing-tool').value==='select'||this.family==='city'&&!atlasCityPlacementActive()&&get<HTMLSelectElement>('city-tool').value==='select');
      if(selecting&&this.geometryCurrent()&&kind!=='place'){
        const preferred=kind&&id&&['room','building','city-unit','element','scope','city'].includes(kind)?{kind:kind as import('./atlas-region-contracts').AtlasHit['kind'],id}:undefined;
        await this.chooseAt(p,'all',preferred,kind==='element'?id:undefined);return;
      }
      if(!this.pointToolActive()&&!target&&this.data?.region?.raster&&this.owner&&this.loadedRegionQuery){

        if(!this.geometryCurrent()){this.opts.status('Kartenausschnitt wird geladen.');return;}
        const owner=this.owner,r=await window.campaign.atlasRegionHit(owner.token,this.loadedRegionQuery,p,this.data.region.fence);
        if(this.owner!==owner)return;if(!r.ok)throw new Error(r.error);const hit=r.value;
        if(hit){if(hit.kind==='element')await this.navigateElement(hit.id);else if(hit.kind==='scope')await this.navigateScope(hit.id);else await this.navigate(hit.kind==='room'?'room':'city',hit.cityId??hit.id,hit.cityId?hit.id:undefined);}return;
      }

      if (
        this.entranceDraft !== null &&
        this.scopeId &&
        this.selection?.kind === "room"
      ) {
        this.entranceDraft.push(atlasToLocal(p, this.frame(this.scopeId)));
        if (this.entranceDraft.length === 2) {
          const r = this.data!.workspace.rooms.find(
            (r) => r.id === this.selection!.id,
          )!;
          const result = await this.write({
            kind: "entrance",
            entrance: {
              id: crypto.randomUUID(),
              scopeId: r.scopeId,
              roomId: r.id,
              floorId: r.floorId,
              outside: this.entranceDraft[0]!,
              inside: this.entranceDraft[1]!,
              revision: 0,
            },
          });
          if (result) this.entranceDraft = null;
        }
        this.render();
        return;
      }
      if (this.family === "travel") {
        this.playback.stop();
        this.previewRequest++;
        this.localPreview = null;
        if (kind === "entrance" && id) {
          this.entranceId = id;
          this.render();
          return;
        }
        this.entranceId = null;
        this.renderTravel();
      }
      if (
        this.family === "city" &&
        this.cityId &&
        (atlasCityPlacementActive()||get<HTMLSelectElement>("city-tool").value !== "select")
      ) {
        const b = this.data?.bindings.find(
          (b) => b.kind === "city" && b.ownerId === this.cityId,
        );
        if (b) {
          await atlasCityPoint(atlasToLocal(p, atlasFrame(this.data!, b)));
          this.render();
        }
        return;
      }
      if (
        (this.family === "decoration" || this.family === "interior") &&
        this.scopeId &&
        get<HTMLSelectElement>("drawing-tool").value !== "select"
      ) {
        await atlasDrawingPoint(atlasToLocal(p, this.frame(this.scopeId)));
        this.render();
        return;
      }
      if (kind === "party" && this.family === "travel") {
        const at = atlasPartyPoint(this.data!),
          near = this.data!.entrances.filter((e) => {
            const b = this.data!.bindings.find(
              (b) => b.kind === "dungeon" && b.ownerId === e.scopeId,
            );
            if (!b || !at) return false;
            const point = localToAtlas(
              this.data!.geometry.position ? e.inside : e.outside,
              atlasFrame(this.data!, b),
            );
            return Math.hypot(point.x - at.x, point.y - at.y) <= 3.048;
          });
        if (near.length === 1) this.entranceId = near[0]!.id;
        this.renderTravel();
        return;
      }
      if(kind==='place'&&id){const owner=this.owner;if(!await this.opts.flush()||this.owner!==owner)return;const place=this.data?.places.find(p=>p.locationId===id&&!p.trashed);if(!place)return;if(this.family==='travel'){this.lastPoint={...place.point};atlasWorldTarget(place,place.locationId);}else await this.setFamily('navigation',false);this.selection={kind:'place',id};this.render();get('atlas-panel').scrollTop=0;return;}
      if (kind === "scope" && id) {
        await this.chooseScope(id);
        return;
      }
      if (kind === "room" && id) {
        const room = this.data!.workspace.rooms.find((r) => r.id === id)!;
        this.selection = { kind: "room", id };
        this.scopeId = room.scopeId;
        this.floorId = room.floorId;
        if (this.family === "travel")
          await atlasDungeonTarget(
            id,
            atlasToLocal(p, this.frame(room.scopeId)),
          );
        else {
          await this.opts.selectRoom(id);
          this.syncDrawingFloor();
        }
        this.render();
        return;
      }
      if ((kind === "building" || kind === "city-unit") && id) {
        const cityId = target!.data.cityId!;
        this.cityId = cityId;
        this.selection = { kind: kind as "building" | "city-unit", id, cityId };
        const binding = this.data?.bindings.find(
          (b) => b.parent === "building" && b.parentId === id,
        );
        const interiorScope=binding?.ownerId??regionValue(this.data?.region?.interiors,id);
        if (interiorScope) {
          this.scopeId = interiorScope;
          this.floorId = "ground";
          this.syncDrawingFloor();
        }
        await openCityReference(cityId, id,true);
        this.render();this.scheduleRegion();
        return;
      }
      if (kind === "city" && id) {
        this.cityId = id;
        this.selection = { kind: "city", id };
        await openCityReference(id,undefined,true);
        this.render();
        return;
      }
      if (this.family === "travel")
        atlasWorldTarget(atlasHexAt(p, this.data!.terrain.hexMeters));
    } catch (e) {
      this.error(e);
    }
  }
  private suppressClick() {
    this.ignoreClick = true;
  }
  private queueBrush(p: Point) {
    const scope = this.scopeId;
    if (!scope) return;
    const local = atlasToLocal(p, this.frame(scope));
    this.brushQueue = this.brushQueue
      .then(() => atlasDrawingPoint(local))
      .then(() => {
        this.render();
      })
      .catch((e) => this.error(e));
  }
  private down(e: PointerEvent) {
    if(e.button===0&&!e.altKey&&!this.busy&&this.geometryCurrent()&&this.camera.ready&&this.family==='city'&&this.cityId&&this.owner){
      const handle=this.camera.hitAt(e,['cityShapeHandle']);
      if(handle){atlasCityChooseShapeHandle(Number(handle.data.cityShapeHandle),handle.data.cityShapeInsert==='true');this.cityShapeDrag={id:e.pointerId,token:this.owner.token,cityId:this.cityId};this.svg.setPointerCapture(e.pointerId);e.preventDefault();return;}
    }
    this.ignoreClick=false; // A real press starts a new gesture; delayed drag clicks are consumed by click().
    if (e.button !== 0 || e.altKey) return;
    if (this.busy || !this.geometryCurrent() || !this.camera.ready) {
      // A rejected press owns its release/click, even if the frame finishes meanwhile.
      this.suppressClick();
      return;
    }
    if(this.groupView||atlasCityPlacementActive())return;
    if (this.family === "terrain" && this.data) return;

    if (
      (this.family === "interior" || this.family === "decoration") &&
      this.scopeId &&
      ["room-cave", "room-erase", "scatter"].includes(
        get<HTMLSelectElement>("drawing-tool").value,
      )
    ) {
      this.brushId = e.pointerId;
      this.svg.setPointerCapture(e.pointerId);
      this.queueBrush(this.point(e));
      return;
    }
    if ((this.family === "interior" || this.family === "decoration") && this.scopeId &&
        get<HTMLSelectElement>("drawing-tool").value === "room-rectangle") {
      this.rectangleDrag={id:e.pointerId,start:this.point(e),last:this.point(e)};
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    if(this.pointToolActive())return;

    const hit = this.camera.hitAt(e, ["atlasObject"]);
    if (hit?.data.kind === "party" && this.family === "travel") {
      this.partyDrag = {
        id: e.pointerId,
        start: this.point(e),
        last: this.point(e),
      };
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    const handle = this.camera.hitAt(e, ["atlasVertex"]);
    if (handle && this.data) {
      const selected=this.opts.roomDraft();
      const room=selected?.id===handle.data.id?selected:null;
      if (room) {
        this.vertexDrag = {
          id: e.pointerId,
          room: structuredClone(room),
          polygon: Number(handle.data.polygon),
          vertex: Number(handle.data.atlasVertex),
          point: atlasToLocal(this.point(e), this.frame(room.scopeId)),
        };
        this.svg.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    const target = this.camera.hitAt(e, ["atlasObject"]);
    if (this.geometryCurrent() && this.family === "navigation" && target?.data.kind === "building") {
      this.drag = {
        id: e.pointerId,
        start: this.point(e),
        last: this.point(e),
        selection: {
          kind: "building",
          id: target.data.id!,
          cityId: target.data.cityId!,
        },
      };
      this.svg.setPointerCapture(e.pointerId);
    }
  }
  private move(e: PointerEvent) {
    const shape=this.cityShapeDrag;
    if(shape?.id===e.pointerId){
      if(shape.token!==this.owner?.token||shape.cityId!==this.cityId||this.family!=='city'||!this.geometryCurrent()){this.cityShapeDrag=null;return;}
      const binding=this.data?.bindings.find(b=>b.kind==='city'&&b.ownerId===shape.cityId);
      if(!binding||!this.data){this.cityShapeDrag=null;return;}
      void atlasCityPoint(atlasToLocal(this.point(e),atlasFrame(this.data,binding))).catch(error=>this.error(error));return;
    }
    if(this.rectangleDrag?.id===e.pointerId){this.rectangleDrag.last=this.point(e);this.render();return;}

    if (this.brushId === e.pointerId) {
      this.queueBrush(this.point(e));
      return;
    }
    if (this.partyDrag?.id === e.pointerId) {
      this.partyDrag.last = this.point(e);
      this.render();
    } else if (this.vertexDrag?.id === e.pointerId) {
      this.vertexDrag.point = atlasToLocal(
        this.point(e),
        this.frame(this.vertexDrag.room.scopeId),
      );
      this.render();
    } else if (this.drag?.id === e.pointerId) {
      this.drag.last = this.point(e);
      this.render();
    }
  }
  private async up(e: PointerEvent) {
    if(this.cityShapeDrag?.id===e.pointerId){this.cityShapeDrag=null;this.suppressClick();if(this.svg.hasPointerCapture(e.pointerId))this.svg.releasePointerCapture(e.pointerId);return;}
    if(!this.geometryCurrent()&&(this.vertexDrag||this.drag||this.brushId!==null)){this.cancel();this.opts.status('Kartengeometrie inzwischen geändert. Zug nach dem Laden erneut beginnen.',true);return;}
    if(this.rectangleDrag?.id===e.pointerId){
      const drag=this.rectangleDrag;this.rectangleDrag=null;
      if(this.scopeId&&Math.hypot(drag.last.x-drag.start.x,drag.last.y-drag.start.y)>this.camera.view.width/Math.max(1,this.svg.clientWidth)*3){
        this.suppressClick();
        try{await atlasDrawingRectangle(atlasToLocal(drag.start,this.frame(this.scopeId)),atlasToLocal(drag.last,this.frame(this.scopeId)));}catch(e){this.error(e);}
      }
      this.render();return;
    }

    if (this.brushId === e.pointerId) {
      this.brushId = null;
      this.suppressClick();
      await this.brushQueue;
      this.render();
      return;
    }
    if (this.partyDrag?.id === e.pointerId) {
      const p = this.partyDrag;
      this.partyDrag = null;
      if (Math.hypot(p.last.x - p.start.x, p.last.y - p.start.y) <= 0.05)
        return;
      if (this.owner && this.data?.scene) {
        this.suppressClick();
        this.placeIntent = {
          point: p.last,
          token: this.owner.token,
          sceneId: this.data.scene.scene.id,
          revision: this.data.scene.position.revision,
          membership: this.data.scene.scene.membershipRevision,
        };
        get<HTMLDialogElement>("atlas-place-confirm").showModal();
      }
      this.render();
      return;
    }
    if (this.vertexDrag?.id === e.pointerId) {
      const v = this.vertexDrag;
      this.vertexDrag = null;
      this.suppressClick();
      const room = structuredClone(v.room);
      room.polygons[v.polygon]!.outer[v.vertex] = { ...v.point };
      if (this.owner)
        await this.write(
          {
            kind: "drawing",
            command: {
              commandId: crypto.randomUUID(),
              campaignId: this.owner.campaign.id,
              token: this.owner.token,
              action: {
                kind: "shape",
                roomId: room.id,
                expectedRevision: v.room.revision,
                polygons: room.polygons,
              },
            },
          },
          true,
        );
      return;
    }
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    this.drag = null;
    const delta = {
      x: drag.last.x - drag.start.x,
      y: drag.last.y - drag.start.y,
    };
    if (Math.hypot(delta.x, delta.y) < 0.01) return;
    this.suppressClick();
    const s = drag.selection;
    if (s?.kind === "building" && this.data && this.owner) {
      const owner=this.owner;const exact=await window.campaign.atlasCitySite(owner.token,s.cityId,s.id);
      if(this.owner!==owner)return;if(!exact.ok)throw new Error(exact.error);if(!exact.value.unit)throw new Error('Haus fehlt.');
      const city={header:exact.value.header},unit=exact.value.unit,
        binding = this.data.bindings.find(
          (b) => b.kind === "city" && b.ownerId === s.cityId,
        )!,
        f = atlasFrame(this.data, binding),
        a = atlasToLocal(drag.start, f),
        b = atlasToLocal(drag.last, f);
      await this.write({
        kind: "city",
        command: {
          commandId: crypto.randomUUID(),
          campaignId: this.owner.campaign.id,
          token: this.owner.token,
          cityId: s.cityId,
          expectedRevision: city.header.revision,
          action: {
            kind: "change",
            upsert: [
              {
                ...unit,
                protected: true,
                position: {
                  x: unit.position!.x + b.x - a.x,
                  y: unit.position!.y + b.y - a.y,
                },
              },
            ],
            remove: [],
            label: "Haus mit Innenräumen verschieben",
          },
        },
      });
    }
  }
  private worldPreview() {
    const state = atlasWorldTravelState(), p = state.preview, a = this.data;
    return p && state.token === this.owner?.token && a?.scene && !a.geometry.position &&
      p.request.sceneId === a.geometry.sceneId && p.request.mapId === a.terrain.id &&
      !get<HTMLButtonElement>("travel-preview-accept").disabled ? p : null;
  }
  private renderTravel() {
    const console=document.getElementById("atlas-local-console");if(console)console.dataset.dungeon=String(!!this.data?.geometry.position);
    const unavailable = this.travelReadState === "loading"
      ? "Reisekontext wird geladen …"
      : this.travelReadState === "failed"
        ? "Reisekontext nicht verfügbar. Erneut laden, bevor du weiterreist."
        : !this.data?.scene ? "Keine Fokusgruppe für eine Reise vorhanden." : "";
    const locked = this.busy || !!this.pendingTravel || !!unavailable;
    get("atlas-advanced-fields").inert = this.family === "travel" && locked;
    get("atlas-local-refresh").hidden = this.travelReadState !== "failed";
    get<HTMLButtonElement>("atlas-local-refresh").disabled = this.busy;
    for (const kind of ["preview", "place", "entrance", "start", "step", "round", "play", "pause", "end"])
      get<HTMLButtonElement>("atlas-local-" + kind).disabled = locked;
    if (unavailable) get("atlas-local-status").textContent = unavailable;
    if (!this.data) return;
    const j = this.data.localJourney,
      dp = this.data.geometry.journey,
      hp = this.data.scene?.journey;
    const worldLeg=!this.data.geometry.position&&hp&&['active','paused','interrupted'].includes(hp.status)&&!j?.status.match(/^(active|paused)$/);
    get('atlas-local-round').textContent=worldLeg?'Bis nächste Grenze':'Eine Runde';
    const wp = this.worldPreview();
    const text = wp
      ? (wp.distanceMeters / 1000).toFixed(1) + " km · " + (wp.durationSeconds / 3600).toFixed(2) + " h · Ankunft " + wp.arrival + (wp.warnings.length ? " · " + wp.warnings.join(" · ") : "")
      : this.localPreview
      ? this.localPreview.distanceMeters.toFixed(1) +
        " m · " +
        this.localPreview.seconds +
        " s · geprüfte Vorschau"
      : j
        ? "Lokaler Weg: " +
          j.status +
          " · " +
          j.elapsedSeconds +
          " / " +
          j.seconds +
          " s" +
          (j.reason ? " · " + j.reason : "")
        : this.data.geometry.position
          ? "Gruppe im Innenraum. Raumziel wählen und Weg prüfen."
          : hp
            ? "Weltreise: " + hp.status
            : "Ziel in der Karte wählen und Weg prüfen.";
    get("atlas-local-status").textContent = unavailable || text;
    get<HTMLButtonElement>("atlas-local-start").disabled =
      locked || !(this.localPreview || wp || (this.data.geometry.position && atlasDungeonState().preview));
    get("atlas-local-play").textContent = this.playback?.running
      ? "Wiedergabe anhalten"
      : "Wiedergabe starten";
    const at = atlasPartyPoint(this.data),
      pose = this.data.geometry.position;
    const near = this.data.entrances.filter((e) => {
      const b = this.data!.bindings.find(
        (b) => b.kind === "dungeon" && b.ownerId === e.scopeId,
      );
      if (
        !b ||
        !at ||
        (pose &&
          (pose.scopeId !== e.scopeId ||
            pose.floorId !== e.floorId ||
            pose.roomId !== e.roomId))
      )
        return false;
      const p = localToAtlas(
        pose ? e.inside : e.outside,
        atlasFrame(this.data!, b),
      );
      return Math.hypot(p.x - at.x, p.y - at.y) <= 3.048;
    });
    if (!this.entranceId && near.length === 1) this.entranceId = near[0]!.id;
    const choices = get<HTMLSelectElement>("atlas-entrance-choice");
    const optionsKey=JSON.stringify([this.entranceId,near.map(e=>[e.id,this.data!.workspace.rooms.find(r=>r.id===e.roomId)?.name??'Eingang'])]);
    if(this.entranceOptions!==optionsKey){
      this.entranceOptions=optionsKey;
    choices.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Eingang wählen";
    choices.append(empty);
    for (const e of near) {
      const o = document.createElement("option");
      o.value = e.id;
      o.textContent =
        this.data.workspace.rooms.find((r) => r.id === e.roomId)?.name ??
        "Eingang";
      choices.append(o);
    }
    choices.value = this.entranceId ?? "";
    }
    get("atlas-entrance-field").hidden = near.length < 2;
    const e = this.data.entrances.find((e) => e.id === this.entranceId);
    get("atlas-local-entrance").hidden = !e;
    get("atlas-local-entrance").textContent = pose
      ? "Eingang verlassen"
      : "Eingang betreten";
    for (const kind of ["step", "round", "play", "pause", "end"])
      get<HTMLButtonElement>("atlas-local-" + kind).disabled =
        locked ||
        ![j?.status, dp?.status, hp?.status].some(
          (s) => s === "active" || s === "paused",
        );
  }
  private async travel(action: AtlasTravelAction) {
    const w = this.owner,
      sceneId = this.data?.geometry.sceneId;
    if (!w || !sceneId || this.busy || this.pendingTravel || this.travelReadState !== "ready") return false;
    const command = {
      commandId: crypto.randomUUID(),
      campaignId: w.campaign.id,
      token: w.token,
      sceneId,
      action,
    };
    let acknowledged = false;
    this.busy = true;
    try {
      const r = await window.campaign.executeAtlasTravelCommit(command);
      acknowledged = true;
      if (this.owner !== w) return false;
      if (!r.ok) throw new Error(r.error);
      this.localPreview = null;const loaded=await this.refresh();if(this.owner!==w)return false;
      this.status(loaded?"Reisestand gespeichert":"Reisestand gespeichert. Ansicht erneut laden.");
      this.render();
      try{await openDungeon();await refreshWorldAfterAtlasTravel(w.token,sceneId);}catch(error){if(this.owner===w)this.opts.status('Reisestand gespeichert. Weltkontext erneut laden: '+(error as Error).message,true);}
      return true;
    } catch (e) {
      if (this.owner === w && !acknowledged) {
        this.pendingTravel = command;
        get("atlas-recover").hidden = false;
        this.error(
          new Error(
            "Ausgang des Reiseauftrags unbekannt. Speicherstand klären, bevor du weiterreist.",
          ),
        );
      } else if (this.owner === w) this.error(e);
      return false;
    } finally {
      if (this.owner === w) {
        this.busy = false;
        this.renderTravel();
      }
    }
  }
  private async travelControl(kind: string) {
    if (kind === "play" && this.playback.running) {
      this.playback.stop();
      return;
    }
    if (kind !== "play") {
      this.playback.stop();
      await this.playback.settled();
    }
    const a = this.data;
    if (!a?.scene || this.travelReadState !== "ready" || this.busy || this.pendingTravel || this.root.hidden) return;
    try {
      if (kind === "place") {
        await this.travel({
          kind: "place",
          point: this.lastPoint,
          expectedPositionRevision: a.scene.position.revision,
          expectedMembershipRevision: a.scene.scene.membershipRevision,
        });
        return;
      }
      if (kind === "entrance") {
        const e = a.entrances.find((e) => e.id === this.entranceId);
        if (e) {
          await this.travel({
            kind: "entrance",
            id: e.id,
            revision: e.revision,
            direction: a.geometry.position ? "exit" : "enter",
            expectedPositionRevision: a.scene.position.revision,
            expectedMembershipRevision: a.scene.scene.membershipRevision,
          });
          await openDungeon();
          await openWorld();
        }
        return;
      }
      if (kind === "preview") {
        if (a.geometry.position) {
          get("dungeon-plan").click();
          return;
        }
        const start = atlasPartyPoint(a);
        if (
          start &&
          Math.hypot(start.x - this.lastPoint.x, start.y - this.lastPoint.y) >
            5000
        ) {
          this.localPreview = null;
          await previewAtlasWorldTravel();
          this.renderTravel();
          return;
        }
        this.localPreview = null;
        this.render();
        const owner = this.owner,
          request = ++this.previewRequest,
          r = await window.campaign.previewAtlasTravel(
            this.owner!.token,
            this.lastPoint,
          );
        if (owner !== this.owner || request !== this.previewRequest || a !== this.data || this.root.hidden || this.travelReadState !== "ready") return;
        if (!r.ok) throw new Error(r.error);
        if (r.value.sceneId !== a.geometry.sceneId) {
          this.travelReadState = "failed";this.root.dataset.regionState='failed';this.svg.setAttribute('aria-busy','false');
          this.localPreview = null;
          this.render();
          this.renderTravel();
          throw new Error("Fokusgruppe inzwischen geändert. Reisekontext erneut laden.");
        }
        this.localPreview = r.value;
        this.render();
        return;
      }
      if (kind === "start") {
        if (this.localPreview)
          await this.travel({ kind: "start", preview: this.localPreview });
        else if (a.geometry.position) get("dungeon-confirm").click();
        else if (this.worldPreview()) await startAtlasWorldTravel();
        return;
      }
      const j = a.localJourney;
      if (j && ["active", "paused"].includes(j.status)) {
        if (kind === "play") {
          if (j.status === "paused")
            await this.travel({
              kind: "resume",
              id: j.id,
              expectedRevision: j.revision,
            });
          this.playback.play();
          return;
        }
        await this.travel({
          kind:
            kind === "pause"
              ? j.status === "paused"
                ? "resume"
                : "pause"
              : (kind as "step" | "round" | "end"),
          id: j.id,
          expectedRevision: j.revision,
        });
        return;
      }
      if (a.geometry.position) {
        get(
          kind === "play"
            ? "dungeon-play"
            : kind === "pause"
              ? "dungeon-pause"
              : kind === "round"
                ? "dungeon-round-step"
                : kind === "step"
                  ? "dungeon-step"
                  : "dungeon-end",
        ).click();
      } else
        get(
          kind === "play"
            ? "journey-play"
            : kind === "pause"
              ? "journey-pause"
              : kind === "end"
                ? "journey-end"
                : kind === "round"
                  ? "journey-many"
                  : "journey-step",
        ).click();
    } catch (e) {
      this.error(e);
    }
  }
  private renderPanel(data:AtlasRenderView){
    const key=[data,this.owner?.token,this.groupView,this.navigationJob,this.travelReadState,this.family,this.selection?.kind,this.selection?.id,this.scopeId,this.floorId,this.busy,this.pendingTravel,pendingAtlasWrite(this.owner?.token??''),this.bindingDirty,get('atlas-placement').contains(document.activeElement),this.opts.roomDraft()?.name];
    if(this.panelKey?.length===key.length&&this.panelKey.every((v,i)=>v===key[i]))return;
    this.panelKey=key;

    get("atlas-recover").hidden =
      !this.pendingTravel &&
      (!this.owner || !pendingAtlasWrite(this.owner.token));
    const selectedBinding = this.selectedBinding();
    get("atlas-placement").hidden = !selectedBinding;
    if (
      selectedBinding &&
      !this.bindingDirty &&
      !get("atlas-placement").contains(document.activeElement)
    ) {
      get<HTMLInputElement>("atlas-binding-x").value = String(
        selectedBinding.x,
      );
      get<HTMLInputElement>("atlas-binding-y").value = String(
        selectedBinding.y,
      );
      get<HTMLInputElement>("atlas-binding-angle").value = String(
        (selectedBinding.angle * 180) / Math.PI,
      );
    }
    get<HTMLButtonElement>("atlas-undo").disabled = this.busy || atlasCityPlacementActive() || !data.canUndo;
    get<HTMLButtonElement>("atlas-redo").disabled = this.busy || atlasCityPlacementActive() || !data.canRedo;
    get("atlas-connect-entrance").hidden =
      this.selection?.kind !== "room" || this.family !== "interior";
    get("atlas-local-console").hidden = this.family !== "travel";
    get("atlas-create-tools").hidden = this.family !== "navigation";
    get("atlas-create-place").hidden=this.family!=="navigation";
    get("atlas-new-name").closest<HTMLElement>("label")!.hidden=this.family!=='navigation';
    get("atlas-drawing-tools").hidden=this.groupView||!this.scopeId||!['interior','decoration'].includes(this.family);
    get("atlas-floor-field").hidden = this.groupView || !this.scopeId;

    for (const id of ["atlas-slice-enabled", "atlas-slice", "atlas-roofs"])
      get(id).closest<HTMLElement>("label")!.hidden = this.groupView || !this.scopeId;
    get("atlas-building-interior").hidden = this.selection?.kind !== "building" || this.family !== "city";
    get("atlas-building-interior").textContent=(data.bindings.some(b=>b.kind==='dungeon'&&b.parentId===this.selection?.id)||!!(this.selection&&regionValue(data.region?.interiors,this.selection.id)))?'Innenraum öffnen':'Innenraum anlegen';
    const houseBinding=data.bindings.find(b=>b.kind==='dungeon'&&b.ownerId===this.scopeId&&b.parent==='building');
    const house=data.cities.flatMap(c=>c.units).find(u=>u.id===houseBinding?.parentId);
    get('atlas-interior-context').hidden=!house||!['interior','decoration'].includes(this.family);
    get('atlas-interior-house-name').textContent=house?'Innenraum · '+house.name:'';
    get<HTMLButtonElement>("atlas-building-interior").disabled=!!this.navigationJob||atlasCityPlacementActive();
    const place=this.selection?.kind==='place'?data.places.find(p=>p.locationId===this.selection!.id&&!p.trashed):null;
    get('atlas-hint').hidden=!!place||['interior','decoration'].includes(this.family);
    get('atlas-place-actions').hidden=!place;get('atlas-place-summary').textContent=place?'Beschreibung und SL-Notizen liegen in derselben Ortsmappe.':'';
    get<HTMLButtonElement>('atlas-place-read').disabled=!this.opts.readLocation;get<HTMLButtonElement>('atlas-place-edit').disabled=!this.opts.editLocation;
    const title =
      this.selection?.kind === 'place'?place?.name:
      this.selection?.kind === "room"
        ? (this.opts.roomDraft()?.id===this.selection.id?this.opts.roomDraft()?.name:null) ?? data.workspace.rooms.find((r) => r.id === this.selection!.id)?.name
        : this.selection?.kind === "building" ||
            this.selection?.kind === "city-unit"
          ? data.cities
              .find(
                (c) =>
                  c.header.id === (this.selection as { cityId: string }).cityId,
              )
              ?.units.find((u) => u.id === this.selection!.id)?.name
          : this.selection?.kind === "city"
            ? data.cities.find((c) => c.header.id === this.selection!.id)
                ?.header.name
            : null;
    get("atlas-selection-title").textContent = title || (this.selection?.kind==='building'?'Unbenanntes Haus':'Deine Kampagnenwelt');
    const floor = get<HTMLSelectElement>("atlas-floor"),
      floors = data.workspace.floors.filter((f) => f.scopeId === this.scopeId),
      old = floor.value;
    floor.replaceChildren();
    for (const f of floors) {
      const o = document.createElement("option");
      o.value = f.id;
      o.textContent = f.name + " · " + f.sourceElevation + " m";
      o.selected = f.id === this.floorId;
      floor.append(o);
    }
    if (old && floors.some((f) => f.id === old) && this.floorId === old)
      floor.value = old;
    this.landscape.setActive(this.family==="terrain"&&!this.groupView);
    get('atlas-view-status').hidden=!this.groupView;
    get('atlas-view-refresh').hidden=!this.groupView||this.travelReadState!=='failed';
    get<HTMLButtonElement>('atlas-view-refresh').disabled=this.busy;

  }
  private render() {
    const data=this.data;
    if(this.root.hidden)return;
    get<HTMLButtonElement>('atlas-to-party').disabled=this.busy||!!this.navigationJob||this.travelReadState!=='ready'||!data||(!data.geometry.position&&!data.scene);
    if(!data){if(this.groupView)this.camera.render(root=>{root.append(shape('rect',{width:this.camera.view.width,height:this.camera.view.height,style:{fill:'#20282a'}}));});return;}
    if(!this.groupView)updateCityInteriors(data);
    this.renderPanel(data);this.renderTravel();
    const box = this.camera.view;
    this.svg.dataset.atlasOriginX = String(box.x);
    this.svg.dataset.atlasOriginY = String(box.y);
    const mpp = box.width / Math.max(1, this.svg.clientWidth);
    get("atlas-scale").textContent =
      (mpp >= 1000
        ? (mpp / 1000).toFixed(2) + " km"
        : mpp.toFixed(mpp < 1 ? 3 : 1) + " m") + " / Pixel";
    // Keep the last confirmed scene intact while a new filter/source is loading.
    // In particular, never interpret old contours under new floor/roof/slice controls.
    if(!this.geometryCurrent()){if(this.groupView)this.camera.render(root=>this.drawGroupView(root,data,box));return;}

    this.camera.render((root) => {
      if(this.groupView){this.drawGroupView(root,data,box);return;}
      this.drawTerrain(root, box, mpp);
      if(this.family==='navigation')root.append(shape('circle',{x:this.lastPoint.x-box.x,y:this.lastPoint.y-box.y,radius:mpp*7,pointer:false,style:{fill:null,stroke:'#305e88',lineWidth:mpp*1.5,lineDash:[mpp*3,mpp*3]}}));
      this.landscape.draw(root,box,mpp,this.family==='terrain'?undefined:new Set(data.places.map(p=>p.locationId)));
      const draft=this.opts.roomDraft(),cacheable=!this.drag&&!atlasCityState()&&!atlasDungeonState().preview&&!get<HTMLInputElement>('atlas-perception').checked;
      const key=[data,this.scopeId,this.floorId,this.family,this.selection?.kind,this.selection?.id,get<HTMLInputElement>('atlas-roofs').checked,get<HTMLInputElement>('atlas-slice-enabled').checked,get<HTMLInputElement>('atlas-slice').value,get<HTMLInputElement>('atlas-perception').checked,mpp,draft?.id,draft?.name,draft?.number,draft?.polygons];
      let base=this.baseGeometry;
      if(!cacheable||!base||!base.key.every((v,i)=>v===key[i])){
        const root=shape('group',{retainGeometry:true,data:{mapScene:'true'}});

      for (const citySaved of data.cities) {
        const binding = data.bindings.find(
          (b) => b.kind === "city" && b.ownerId === citySaved.header.id,
        );
        if (!binding) continue;
        const preview = atlasCityState(),
          city =
            preview?.token === this.owner?.token && preview?.view.header.id === citySaved.header.id &&
            preview.view.header.revision >= citySaved.header.revision
              ? preview.partial
                ? {...citySaved,header:preview.view.header,units:[...new Map([...citySaved.units,...preview.view.units].map(u=>[u.id,u])).values()]}
                : preview.view
              : citySaved,
          f = atlasFrame(data, binding),
          g = shape("group", {matrix: frameMatrix(this.relative(f))});
        g.data.atlasObject = "true";
        g.data.kind = "city";
        g.data.id = city.header.id;
        const center = localToAtlas(
          { x: city.header.width / 2, y: city.header.height / 2 },
          f,
        );
        if (
          !this.visible(
            center,
            Math.max(city.header.width, city.header.height),
            data.region?.box??box,
          )
        )
          continue;
        if (mpp > city.header.width / 25) {
          const marker = shape("circle", {x: center.x - box.x, y: center.y - box.y, radius: 6 * mpp, style: {fill: "#c58a58", stroke: "#4f4230", lineWidth: mpp}});
          marker.data.atlasObject = "true";
          marker.data.kind = "city";
          marker.data.id = city.header.id;
          root.append(marker);
          this.label(root, city.header.name, center, mpp);
          continue;
        }
        let shownCity = city;
        if (
          this.drag?.selection?.kind === "building" &&
          this.drag.selection.cityId === city.header.id
        ) {
          const drag = this.drag,
            a = atlasToLocal(drag.start, f),
            b = atlasToLocal(drag.last, f);
          shownCity = {
            ...city,
            units: city.units.map((u) =>
              u.id === drag.selection!.id && u.position
                ? {
                    ...u,
                    position: {
                      x: u.position.x + b.x - a.x,
                      y: u.position.y + b.y - a.y,
                    },
                  }
                : u,
            ),
          };
        }
        const coverage=data.region?.box??box;
        const corners = [
            { x: coverage.x, y: coverage.y },
            { x: coverage.x + coverage.width, y: coverage.y },
            { x: coverage.x, y: coverage.y + coverage.height },
            { x: coverage.x + coverage.width, y: coverage.y + coverage.height },
          ].map((p) => atlasToLocal(p, f)),
          xmin = Math.min(...corners.map((p) => p.x)),
          xmax = Math.max(...corners.map((p) => p.x)),
          ymin = Math.min(...corners.map((p) => p.y)),
          ymax = Math.max(...corners.map((p) => p.y));
        const visibleUnits = shownCity.units.filter((u) => {
          if (u.kind === "node") return true;
          const pts =
            u.kind === "building"
              ? posed(u)
              : ["road", "wall"].includes(u.kind)
                ? roadPoints(u, shownCity.units)
                : (u.outline ?? []);
          if (
            u.kind === "building" &&
            pts.length &&
            Math.max(
              Math.max(...pts.map((p) => p.x)) -
                Math.min(...pts.map((p) => p.x)),
              Math.max(...pts.map((p) => p.y)) -
                Math.min(...pts.map((p) => p.y)),
            ) <
              mpp * 2
          )
            return false;
          return (
            pts.length &&
            Math.max(...pts.map((p) => p.x)) >= xmin &&
            Math.min(...pts.map((p) => p.x)) <= xmax &&
            Math.max(...pts.map((p) => p.y)) >= ymin &&
            Math.min(...pts.map((p) => p.y)) <= ymax
          );
        });
        const cityScene = cityPaint({ ...shownCity, units: visibleUnits });
        for (const c of cityScene.children) {
          const uid = c.data.cityUnit,
            interior = data.bindings.find(
              (b) => b.parent === "building" && b.parentId === uid,
            )??(uid&&regionValue(data.region?.interiors,uid)?{ownerId:regionValue(data.region?.interiors,uid)!}:null);
          if (
            interior &&
            this.interiorVisible(interior,mpp)
          ) {
            for (const p of c.children.filter(child => child.kind === "polygon")) {
              p.style.fill=null;
              p.style.stroke="#624337";
              p.style.lineWidth=Math.max(.15,mpp);
              if (
                interior.ownerId === this.scopeId &&
                this.floorId !== "ground"
              )
                p.geometry.hidden=true;
            }
          }
          if(interior?.ownerId===this.scopeId&&['interior','decoration'].includes(this.family))for(const text of c.children.filter(child=>child.kind==='text'))text.geometry.hidden=true;
          for (const text of [
            c,
            ...c.children.filter(child => child.kind === "text"),
          ].filter((n) => n.kind === "text"))
            text.style.fontSize=Math.min(text.style.fontSize??6,12*mpp);
          g.append(c);
        }
        for (const u of visibleUnits
          .filter((u) => u.kind !== "node")
          .sort(
            (a, b) =>
              Number(a.kind === "building") - Number(b.kind === "building"),
          )) {
          const line = ["road", "wall"].includes(u.kind),
            points =
              u.kind === "building"
                ? posed(u)
                : line
                  ? roadPoints(u, shownCity.units)
                  : (u.outline ?? []),
            path = shape(line ? "polyline" : "polygon", {
              points,style:{fill:line?null:"transparent",stroke:this.selection?.id===u.id?"#b85525":"transparent",lineWidth:line?Math.max(u.width??6,mpp*8):2*mpp},
            });
          path.data.atlasObject = "true";
          path.data.kind = u.kind === "building" ? "building" : "city-unit";
          path.data.id = u.id;
          path.data.cityId = city.header.id;
          g.append(path);
        }
        if (preview?.view.header.id === city.header.id && preview.path.length)
          g.append(
            shape("polyline", {points:preview.path,pointer:false,style:{fill:null,stroke:preview.conflicts?.length?'#ba3026aa':'#176c7480',lineWidth:preview.width??2*mpp,lineCap:'round',lineJoin:'round'}}),
          );
        if(preview?.view.header.id===city.header.id)for(const house of preview.conflicts??[])g.append(shape('polygon',{points:posed(house),pointer:false,data:{streetConflict:house.id},style:{fill:'#ba302633',stroke:'#ba3026',lineWidth:2*mpp}}));
        if(preview?.view.header.id===city.header.id)for(const junction of preview.junctions){
          g.append(shape('circle',{x:junction.point.x,y:junction.point.y,radius:7*mpp,pointer:false,style:{fill:'#e9fff4',stroke:'#176c74',lineWidth:2*mpp}}));
        }
        if(preview&&preview.token===this.owner?.token&&preview.view.header.id===citySaved.header.id&&preview.placement){
          const origin=shape('polygon',{points:posed(preview.placement.original),pointer:false,style:{fill:null,stroke:'#176c74',lineWidth:Math.max(.4,mpp*1.5),lineDash:[mpp*5,mpp*4]}});origin.data.cityPlacementOrigin=preview.placement.original.id;g.append(origin);
        }
        if(!this.groupView&&this.family==='city'&&preview?.view.header.id===city.header.id)atlasCityShapeHandles(g,mpp);
        root.append(g);
      }
      if(!get<HTMLInputElement>('atlas-perception').checked)for(const place of data.places){
        if(place.trashed||(this.family==='terrain'&&this.landscape.records.some(r=>r.kind==='place'&&r.locationId===place.locationId))||data.cities.some(c=>c.header.locationId===place.locationId)||!this.visible(place.point,mpp*30,box))continue;
        const marker=shape('group',{data:{atlasObject:'true',kind:'place',id:place.locationId},title:place.name});
        marker.append(shape('circle',{x:place.point.x-box.x,y:place.point.y-box.y,radius:mpp*7,style:{fill:this.selection?.id===place.locationId?'#305e88':'#f7f2df',stroke:'#305e88',lineWidth:mpp*2}}));
        this.label(marker,place.presentation?.title||place.name,{x:place.point.x-box.x,y:place.point.y-box.y+mpp*32},mpp);const label=marker.children.find(child=>child.kind==='text');if(label)label.geometry.pointer=true;root.append(marker);
      }
      for (const binding of data.bindings.filter((b) => b.kind === "dungeon"))
        if(!data.region?.raster)this.drawInterior(root, binding, box, mpp);
      if(data.region?.raster){const r=data.region.raster;const image=shape("image", {x: r.box.x-box.x, y: r.box.y-box.y, width: r.box.width, height: r.box.height, source: r.data});image.geometry.pointer=false;root.append(image);for(const b of data.bindings.filter(b=>b.kind==='dungeon')){const floor=data.geometry.position?.scopeId===b.ownerId?data.geometry.position.floorId:b.ownerId===this.scopeId?this.floorId:'ground',g=shape("group", {matrix: frameMatrix(this.relative(atlasFrame(data,b)))});this.drawInteriorRuntime(g,b,floor,mpp,[]);root.append(g);}}
        base={key,node:root,origin:{x:box.x,y:box.y},authorSlot:this.authorFaceSlot(root)};
        this.baseGeometry=cacheable?base:null;
      }
      const retained=shape('group',{matrix:[1,0,0,1,base.origin.x-box.x,base.origin.y-box.y],data:{atlasBase:'true'}});
      retained.append(base.authorSlot?this.withAuthorFace(base.node,base.authorSlot,mpp):base.node);root.append(retained);
      if (this.entranceDraft?.length && this.scopeId) {

        const f = this.frame(this.scopeId),
          p = localToAtlas(this.entranceDraft[0]!, f);
        root.append(
          shape("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 4, style: {fill: "#c65d28"}}),
        );
      }

      this.drawInteriorAuthor(root,mpp);
      const travel = atlasWorldTravelState(),
        route = atlasWorldRoute(data,travel.preview);
      if (route.length)
        root.append(
          shape("polyline", {points: route
              .map((p) => {
                const h = atlasHexPoint(p.q, p.r, data.terrain.hexMeters);
                return {x:h.x-box.x,y:h.y-box.y};
              }), style: {fill: null, stroke: "#be5939", lineWidth: mpp * 3}}),
        );
      for (const e of data.entrances) {
        const binding = data.bindings.find(
          (b) => b.kind === "dungeon" && b.ownerId === e.scopeId,
        );
        if (!binding) continue;
        const f = atlasFrame(data, binding),
          out = localToAtlas(e.outside, f),
          at = localToAtlas(e.inside, f);
        root.append(
          shape("line", {x: out.x - box.x, y: out.y - box.y, x2: at.x - box.x, y2: at.y - box.y, style: {stroke: "#27635a", lineWidth: mpp * 2}}),
        );
        const marker = shape("circle", {x: out.x - box.x, y: out.y - box.y, radius: mpp * 5, style: {fill: "#39766a", stroke: "white", lineWidth: mpp}});
        marker.data.atlasObject = "true";
        marker.data.kind = "entrance";
        marker.data.id = e.id;
        root.append(marker);
      }
      const localRoute = this.localPreview?.route ?? (data.localJourney&&['active','paused'].includes(data.localJourney.status)?data.localJourney.route:[]);
      if (localRoute?.length)
        root.append(
          shape("polyline", {points: localRoute
              .map(p=>({x:p.x-box.x,y:p.y-box.y})), style: {fill: null, stroke: "#b05d32", lineWidth: mpp * 2}}),
        );
      this.drawParty(root, mpp);
    });
  }
  private async exportPNG() {
    if (!this.data || !this.owner || this.exporting) return;
    const owner = this.owner;
    this.exporting = true;this.exportCancelled=false;get("atlas-export-cancel").hidden=false;
    get<HTMLButtonElement>("atlas-export-png").disabled = true;
    this.status("PNG wird vorbereitet…");
    try {
      if (!(await this.opts.flush()) || this.owner !== owner) return;
      const audience = get<HTMLSelectElement>("atlas-export-audience").value as
          | "gm"
          | "public",
        box = {...(this.landscape.exportBox??this.camera.view)};
      const exportQuery={...this.regionQuery(),box:{...box},perception:audience==='public'},references=get<HTMLInputElement>('atlas-export-reference').checked,grid=get<HTMLInputElement>('atlas-export-grid').checked,level=Number(get<HTMLSelectElement>('atlas-hex-level').value),labelWidth=Math.max(1,this.svg?.clientWidth??1000);
      const format=get<HTMLSelectElement>("atlas-export-format").value as 'png'|'jpeg',size=Number(get<HTMLInputElement>("atlas-export-size").value);
      if(!Number.isInteger(size)||size<256||size>8192)throw new Error("Ausgabegröße zwischen 256 und 8192 Pixel wählen.");
      const fresh=await window.campaign.atlasRegion(owner.token,exportQuery,'export');if(!fresh.ok)throw new Error(fresh.error);if(this.owner!==owner||this.exportCancelled)return;
      const snapshot=fresh.value;
      const width=Math.max(1,Math.round(size*Math.min(1,box.width/box.height))),height=Math.max(1,Math.round(size*Math.min(1,box.height/box.width)));
      let source:AtlasPaint|AsyncIterable<AtlasExportTile>;
      if(audience==='public'){
        if(snapshot.geometry.position&&snapshot.perception)source=publicAtlasPaint(snapshot,box);
        else {
          const frame=await window.campaign.playerView(owner.token);
          if(!frame.ok)throw new Error(frame.error);
          if(this.owner!==owner||this.exportCancelled)return;
          source=publicAtlasPaint(snapshot,box,frame.value.frame);
        }
      } else {
        source=atlasExportTiles(box,width,height,snapshot.campaignId,snapshot.revision,async(part,w,h)=>{
          const response=await window.campaign.atlasRegion(owner.token,{...exportQuery,box:part,width:w,height:h,revision:snapshot.revision,fence:snapshot.region!.fence,references},'export');if(!response.ok)return response;
          const tile=response.value,layer=tile.region.landscape;
          if(tile.revision!==snapshot.revision||tile.region.fence!==snapshot.region!.fence)throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
          if(!layer||layer.state!=='ready'||!layer.coverage.complete)throw new Error(layer?.error??'Landschaftsausgabe nicht vollständig. Erneut laden.');
          const assets=new Map<string,string>();
          if(references)for(const r of layer.records)if(r.assetId&&!assets.has(r.assetId)){const image=await window.campaign.referenceAssetPreview(owner.token,r.assetId,2048);if(!image.ok)throw new Error(image.error);assets.set(r.assetId,image.value);}
          const scene=atlasRegionPaint(tile,layer.records,part,w,assets,{rasters:layer.tiles,grid,level,references,floorId:exportQuery.floorId,roofs:exportQuery.roofs,scopeId:exportQuery.scopeId,labelUnitsPerPixel:box.width/labelWidth});
          return{ok:true,value:{campaignId:tile.campaignId,revision:tile.revision,box:tile.region.box,width:w,height:h,scene}};
        },()=>this.owner===owner&&!this.exportCancelled,(done,total)=>{get('atlas-save-status').textContent=`Atlas wird ausgegeben: ${done}/${total}`;});
        if(references&&snapshot.region?.landscape?.coverage.mode==='raster')get('atlas-save-status').textContent='Dichte Landschaft als Übersicht; Vorlagen als Umrisse.';
      }
      const bytes = await atlasImage(source,width,height,box,format,()=>this.owner===owner&&!this.exportCancelled);
      if (this.owner !== owner || this.exportCancelled) return;
      const r = await window.campaign.exportAtlasPNG(
        owner.token,
        bytes,
        audience,
        format,
        snapshot.region!.fence,
      );
      if (!r.ok) throw new Error(r.error);
      if (!r.value.cancelled) {
        this.opts.status("Atlas-"+format.toUpperCase()+" gespeichert.");
        this.status("Atlas-"+format.toUpperCase()+" gespeichert");
      }
    } catch (e) {
      if (this.owner === owner && !this.exportCancelled) this.error(e);
    } finally {
      if(this.exportCancelled&&this.owner===owner)this.status("Ausgabe abgebrochen");
      get("atlas-export-cancel").hidden=true;
      this.exporting = false;
      get<HTMLButtonElement>("atlas-export-png").disabled = false;
    }
  }
  private relativePoint(p: Point) {
    const b = this.camera.view;
    return { x: p.x - b.x, y: p.y - b.y };
  }
  private relative(f: import("./campaign-atlas-model").AtlasFrame) {
    return { ...f, ...this.relativePoint(f) };
  }
  private visible(p: Point, r: number, b: CanvasBox) {
    return (
      p.x + r >= b.x &&
      p.y + r >= b.y &&
      p.x - r <= b.x + b.width &&
      p.y - r <= b.y + b.height
    );
  }
  private label(root: AtlasPaint, text: string, p: Point, mpp: number) {
    if (root.data.mapScene) p = this.relativePoint(p);
    const t = shape("text", {x: p.x, y: p.y - 8 * mpp, pointer: false, style: {fontSize: 12 * mpp, textAlign: 'center', stroke: "#f2eee3", lineWidth: 3 * mpp, fill: "#283d3b"}});
    t.text = text;
    root.append(t);
  }
  private drawTerrain(root:AtlasPaint,box:CanvasBox,_mpp:number){const cover=this.data?.region?.box??box;root.append(shape("rect", {x: cover.x-box.x, y: cover.y-box.y, width: cover.width, height: cover.height, style: {fill: "#b8c896"}}));}
  private interiorVisible(binding:{parent?:string;ownerId:string},mpp:number){
    if(binding.parent&&binding.parent!=="building"||!get<HTMLInputElement>("atlas-roofs").checked)return true;
    if(binding.ownerId===this.scopeId&&["interior","decoration","travel"].includes(this.family))return true;
    return this.family!=="city"&&mpp<=.4;
  }

  private drawInterior(
    root: AtlasPaint,
    b: AtlasBinding,
    box: CanvasBox,
    mpp: number,
  ) {
    const data = this.data!,
      f = this.frame(b.ownerId),
      rooms = data.workspace.rooms.filter((r) => r.scopeId === b.ownerId),
      building =
        b.parent === "building"
          ? data.cities.flatMap((c) => c.units).find((u) => u.id === b.parentId)
          : null;
    if (building && !this.interiorVisible(b,mpp)) return;
    const floor = b.ownerId === this.scopeId ? this.floorId : "ground",
      shown = rooms.filter((r) => r.floorId === floor),
      elements=data.geometry.drawing.elements.filter(e=>e.scopeId===b.ownerId&&e.floorId===floor&&!e.archived);
    if (b.parent === "world" && (shown.length || elements.length || b.ownerId !== "local" || !!regionValue(data.region?.scopeBounds,b.ownerId))) {
      const points = [...shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)),...elements.flatMap(e=>e.points)],
        extent = regionValue(data.region?.scopeBounds,b.ownerId)?.width ?? (points.length
          ? Math.max(...points.map((p) => p.x)) -
            Math.min(...points.map((p) => p.x))
          : 0);
      if ((!shown.length&&!elements.length) || mpp > Math.max(1, extent / 25)) {
        const extentBox=regionValue(data.region?.scopeBounds,b.ownerId),center=extentBox?localToAtlas({x:extentBox.x+extentBox.width/2,y:extentBox.y+extentBox.height/2},f):f;
        const marker = shape("circle", {x: center.x - box.x, y: center.y - box.y, radius: mpp * 6, style: {fill: shown.length||elements.length ? "#685b50" : null, stroke: "#685b50", lineWidth: mpp * 2}});
        marker.data.atlasObject = "true";
        marker.data.kind = "scope";
        marker.data.id = b.ownerId;
        root.append(marker);
        this.label(
          root,
          data.scopes.find((s) => s.id === b.ownerId)?.name ?? "Dungeon",
          center,
          mpp,
        );
        return;
      }
    }
    if (!shown.length&&!elements.length) return;
    const g = shape("group", {matrix: frameMatrix(this.relative(f))}),labels=shape("group",{data:{atlasRoomLabels:b.ownerId}});
    for(const room of shown)appendAtlasRoomLabels(labels,room,mpp,p=>{const at=localToAtlas(p,f);return{x:at.x-box.x,y:at.y-box.y};});

    for (const saved of shown) {
      if(this.authorRoom(saved)){g.append(shape('group',{data:{authorRoomFace:saved.id}}));continue;}
      let room =
        this.opts.roomDraft()?.id === saved.id ? this.opts.roomDraft()! : saved;
      if (this.vertexDrag?.room.id === saved.id) {
        room = structuredClone(this.vertexDrag.room);
        room.polygons[this.vertexDrag.polygon]!.outer[this.vertexDrag.vertex] =
          { ...this.vertexDrag.point };
      }
      const at = localToAtlas(room.polygons[0]!.outer[0]!, f);
      if (
        !this.visible(
          at,
          Math.max(
            ...room.polygons.flatMap((p) =>
              p.outer.map((p) => Math.hypot(p.x, p.y)),
            ),
          ) + 30,
          data.region?.box??box,
        )
      )
        continue;
      const slice =
          get<HTMLInputElement>("atlas-slice-enabled").checked &&
          b.ownerId === this.scopeId,
        z = Number(get<HTMLInputElement>("atlas-slice").value),
        elevation =
          data.geometry.floors.find(
            (f) => f.scopeId === b.ownerId && f.id === floor,
          )?.elevation ?? 0,
        volume = data.geometry.drawing.volumes?.find(
          (v) => v.roomId === room.id,
        );
      const polygons = slice && !data.region
        ? volume
          ? volumeProjection(volume, (z - elevation) / 1.524)
          : z >= elevation &&
              z <
                elevation +
                  (data.geometry.drawing.styles.find((s) => s.id === room.id)
                    ?.ceilingMeters ?? 3.048)
            ? room.polygons
            : []
        : room.polygons;
      if (!polygons.length) continue;
      if(!this.authorRoom(room))this.drawRoomFace(g,{...room,polygons},mpp);
    }
    for (const e of elements) {
      const node = elementPaint(e, shown, data.geometry.drawing.elements);
      node.data.atlasObject='true';node.data.kind='element';node.data.id=e.id;
      g.append(node);
    }
    this.drawInteriorRuntime(g,b,floor,mpp,shown);
    root.append(g,labels);
  }
  private authorRoom(room:import('./contracts').RoomGeometry){
    return this.family==='interior' && this.selection?.kind==='room' && this.selection.id===room.id &&
      this.opts.roomDraft()?.id===room.id && room.scopeId===this.scopeId && room.floorId===this.floorId &&
      !get<HTMLInputElement>('atlas-slice-enabled').checked && !get<HTMLInputElement>('atlas-perception').checked;
  }
  private authorFaceSlot(node:AtlasPaint):number[]|null{
    if(node.data.authorRoomFace)return [];
    for(let i=0;i<node.children.length;i++){const child=this.authorFaceSlot(node.children[i]!);if(child)return [i,...child];}
    return null;
  }
  /** Clone only the ancestry of the dynamic face; retain all other immutable paths.
   * The slot preserves painter order, so the room fill cannot cover its objects. */
  private withAuthorFace(node:AtlasPaint,slot:number[],mpp:number):AtlasPaint{
    const copy=shape(node.kind,node.geometry,node.text);copy.title=node.title;
    if(slot.length){copy.append(...node.children);const index=slot[0]!;copy.children[index]=this.withAuthorFace(node.children[index]!,slot.slice(1),mpp);}
    else{const original=this.opts.roomDraft();if(original){const room=this.vertexDrag?.room.id===original.id?structuredClone(this.vertexDrag.room):original;if(this.vertexDrag?.room.id===room.id)room.polygons[this.vertexDrag.polygon]!.outer[this.vertexDrag.vertex]={...this.vertexDrag.point};this.drawRoomFace(copy,room,mpp);}}
    return copy;
  }
  private drawRoomFace(g:AtlasPaint,room:import('./contracts').RoomGeometry,mpp:number){
      const path = shape("polygons", {polygons: room.polygons, style: {fill: this.selection?.id === room.id ? "#e8d8ac" : "#e2dac4", stroke: "#3d4b45", lineWidth: Math.max(0.07, Math.min(0.18, mpp)), fillRule: "evenodd"}});

      path.data.atlasObject = "true";
      path.data.kind = "room";
      path.data.id = room.id;
      g.append(path);

  }
  /** Exact author data and open drafts outlive the background's detail/raster choice. */
  private drawInteriorAuthor(root: AtlasPaint, mpp: number) {
    const data = this.data;
    if (!data || !this.scopeId || !['interior', 'decoration'].includes(this.family) ||
      get<HTMLInputElement>('atlas-perception').checked) return;
    const binding = data.bindings.find(b => b.kind === 'dungeon' && b.ownerId === this.scopeId);
    if (!binding) return;
    const frame = atlasFrame(data, binding), g = shape('group', {
      matrix: frameMatrix(this.relative(frame)),
      data: {editorOnly: 'true'},
    });
    const original = this.opts.roomDraft();
    if (this.family === 'interior' && this.selection?.kind === 'room' &&
      original?.id === this.selection.id && original.scopeId === this.scopeId &&
      original.floorId === this.floorId && !get<HTMLInputElement>('atlas-slice-enabled').checked) {
      const room = this.vertexDrag?.room.id === original.id ? structuredClone(this.vertexDrag.room) : original;
      if (this.vertexDrag?.room.id === room.id)
        room.polygons[this.vertexDrag.polygon]!.outer[this.vertexDrag.vertex] = {...this.vertexDrag.point};
      if (data.region?.raster) g.append(shape('polygons', {
        polygons: room.polygons, pointer: false,
        style: {fill: null, stroke: '#b85525', lineWidth: Math.max(.07, mpp * 2)},
      }));
      // Stale backgrounds may stay visible; their author handles must not remain actionable.
      if (this.geometryCurrent()) {
        const cover = data.region?.box ?? this.camera.view, cells = new Set<string>();
        // A detailed original must not turn into thousands of overlapping handles.
        // Each retained handle still addresses its exact original polygon/vertex.
        let spacing = mpp * 8;
        while ((Math.ceil(cover.width / spacing) + 2) * (Math.ceil(cover.height / spacing) + 2) > 1500) spacing *= 2;
        room.polygons.forEach((poly, pi) => poly.outer.forEach((p, vi) => {
          const at = localToAtlas(p, frame);
          if (at.x < cover.x || at.y < cover.y || at.x > cover.x + cover.width || at.y > cover.y + cover.height) return;
          const cell = Math.floor(at.x / spacing) + ':' + Math.floor(at.y / spacing);
          if (cells.has(cell)) return;
          cells.add(cell);
          g.append(shape('circle', {
            x: p.x, y: p.y, radius: mpp * 4,
            style: {fill: 'white', stroke: '#244f87', lineWidth: mpp},
            data: {atlasObject: 'true', kind: 'vertex', id: room.id, atlasVertex: String(vi), polygon: String(pi)},
          }));
        }));
        const vertices = room.polygons.reduce((n, p) => n + p.outer.length, 0);
        if (cells.size < vertices) g.title = `${cells.size} von ${vertices} Eckpunkten als Griffe. Für weitere Griffe näher heranzoomen oder verschieben.`;
      }
    }
    if(this.rectangleDrag){const a=atlasToLocal(this.rectangleDrag.start,frame),z=atlasToLocal(this.rectangleDrag.last,frame);g.append(shape('polygons',{polygons:[{outer:[a,{x:z.x,y:a.y},z,{x:a.x,y:z.y}],holes:[]}],pointer:false,style:{fill:'#4f9da255',stroke:'#236871',lineWidth:mpp*1.5}}));}
    const draft = atlasDrawingDraft();
    if (draft.floor.scopeId === this.scopeId && draft.floor.floorId === this.floorId) {
      drawingOverlay(g, true);
      if (draft.polygons) g.append(shape('polygons', {
        polygons: draft.polygons,
        style: {fill: '#d98f5555', stroke: '#b85c23', lineWidth: .1},
      }));
    }
    if (g.children.length) root.append(g);
  }
  private drawInteriorRuntime(g:AtlasPaint,b:AtlasBinding,floor:string,mpp:number,shown:import('./contracts').RoomGeometry[]){
    const data=this.data!;
    const runtime = atlasDungeonState(),
      route =
        dungeonTravelRoute(data.geometry.journey,runtime.preview,data.geometry.sceneId);
    const points = route.filter(
      (p) => p.scopeId === b.ownerId && p.floorId === floor,
    );
    if (points.length)
      g.append(
        shape("polyline", {points, style: {fill: null, stroke: "#b05c36", lineWidth: Math.max(0.15, mpp * 2)}}),
      );
    const party = data.geometry.position,
      perception = data.perception,
      masked = get<HTMLInputElement>("atlas-perception").checked;
    for (const t of data.geometry.tracks.filter(
      (t) =>
        t.from.scopeId === b.ownerId &&
        t.from.floorId === floor &&
        t.to.floorId === floor,
    )) {
      if (
        masked &&
        !perception?.tracks?.some(
          (x) =>
            x.from.x === t.from.x &&
            x.from.y === t.from.y &&
            x.to.x === t.to.x &&
            x.to.y === t.to.y,
        )
      )
        continue;
      g.append(
        shape("line", {x:t.from.x,y:t.from.y,x2:t.to.x,y2:t.to.y, style: {fill: null, stroke: "#987cb0", lineWidth: Math.max(0.08, mpp), lineDash:[mpp*3,mpp*3]}}),
      );
    }
    for (const n of data.geometry.npcs.filter(
      (n) => n.pose?.scopeId === b.ownerId && n.pose.floorId === floor,
    )) {
      const observation = data.geometry.senses.observations.find(
        (o) =>
          o.subjectKind === "actor" &&
          o.subjectId === n.id &&
          o.known &&
          o.visible &&
          o.override !== "unknown",
      );
      if (masked && !observation) continue;
      const dot = shape("circle", {x: n.pose!.x, y: n.pose!.y, radius: Math.max(0.15, mpp * 5), style: {fill: "#8964a5", stroke: "#fff", lineWidth: mpp}});
      dot.title =
        n.name + (observation ? " · bekannt und sichtbar" : " · GM");
      g.append(dot);
      if (!masked) {
        const points = n.path.filter(
          (p) => p.scopeId === b.ownerId && p.floorId === floor,
        );
        if (points.length)
          g.append(
            shape("polyline", {points, style: {fill: null, stroke: "#8964a5", lineWidth: mpp}}),
          );
      }
    }
    if (
      masked &&
      party?.scopeId === b.ownerId &&
      party.floorId === floor &&
      perception
    ) {
      const points = shown.length?shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)):[{x:this.camera.view.x,y:this.camera.view.y},{x:this.camera.view.x+this.camera.view.width,y:this.camera.view.y},{x:this.camera.view.x+this.camera.view.width,y:this.camera.view.y+this.camera.view.height},{x:this.camera.view.x,y:this.camera.view.y+this.camera.view.height}].map(p=>atlasToLocal(p,this.frame(b.ownerId))),
        minX = Math.min(...points.map((p) => p.x)) - 1,
        minY = Math.min(...points.map((p) => p.y)) - 1,
        width = Math.max(...points.map((p) => p.x)) - minX + 1,
        height = Math.max(...points.map((p) => p.y)) - minY + 1;
      g.append(shape("rect",{x:minX,y:minY,width,height,opacity:.9,pointer:false,style:{fill:'#1e292b'},maskCuts:[
        ...perception.known.length?[{polygons:perception.known,alpha:.6}]:[],
        ...perception.visible.length?[{polygons:perception.visible,alpha:1}]:[],
      ]}));
    }
  }
  private drawParty(root: AtlasPaint, mpp: number) {
    const d = this.data!,
      position = this.partyDrag?.last ?? atlasPartyPoint(d);
    if (!position) return;
    const token = shape("circle", {x: position.x - this.camera.view.x, y: position.y - this.camera.view.y, radius: mpp * 7, pointer:this.family==='travel',style: {fill: "#244f87", stroke: "white", lineWidth: mpp * 2}});
    token.data.atlasObject = "true";
    token.data.kind = "party";
    root.append(token);
    this.label(root, d.geometry.sceneTitle, position, mpp);
  }
}

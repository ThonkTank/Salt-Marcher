import {atlasGeometryOnly} from './atlas-render-view';
import {landscapeExportTiles} from "./atlas-landscape-export";
import {atlasRegionSVG} from "./atlas-region-export";
import {LandscapeWorkbench} from "./atlas-landscape-ui";
import {earthView} from "./atlas-landscape";
import { appendRoomNumber } from "./room-number-label";
import { atlasPNG, publicAtlasSVG } from "./campaign-atlas-export";
import { journeyPlayback } from "./journey-playback";
import { atlasPartyPoint } from "./atlas-runtime-model";
import type {
  AtlasLocalPreview,
  AtlasTravelAction,
} from "./atlas-travel-contracts";
import { openWorld, atlasWorldTarget, atlasWorldTravelState } from "./world-ui";
import { PassiveMapCanvas, type CanvasBox } from "./passive-map-canvas";
import {
  atlasFrame,
  localToAtlas,
  atlasToLocal,
  frameTransform,
  atlasHexPoint,
  atlasHexAt,
} from "./campaign-atlas-model";
import {
  writeAtlas,
  writeAtlasCommit,
  pendingAtlasWrite,
  recoverAtlasWrite,
} from "./campaign-atlas-author";
import type {
  AtlasRenderView,
  AtlasAction,
  AtlasBinding,
} from "./campaign-atlas-contracts";
import type { WorkspaceGeometry, Point, Room } from "./contracts";
import { terrainNames, cellAt } from "./world-model";
import { citySvg, posed, roadPoints } from "./city-model";
import { volumeProjection } from "./volume-model";
import { roomPath, elementSvg } from "./drawing-model";
import { atlasCityPoint, atlasCityState, openCityReference } from "./city-ui";
import {
  atlasDrawingPoint,
  atlasDrawingDraft,
  drawingOverlay,
  atlasDrawingScope,
  reloadDrawing,
} from "./drawing-ui";
import {
  atlasDungeonTarget,
  atlasDungeonState,
  openDungeon,
} from "./dungeon-ui";
const ns = "http://www.w3.org/2000/svg",
  get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Selection =
  | { kind: "city"; id: string }
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
const shape = (tag: string, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
export class CampaignAtlasWorkbench {
  readonly root = document.createElement("section");
  private svg: SVGSVGElement;
  private camera: PassiveMapCanvas;
  private landscape: LandscapeWorkbench;
  private projection:AtlasRenderView|null=null;
  private get data(){return this.projection;}
  private set data(value:AtlasRenderView|null){this.projection=value?atlasGeometryOnly(value):null;}
  private owner: WorkspaceGeometry | null = null;
  private request = 0;
  private searchRequest=0;
  private opening:{owner:WorkspaceGeometry;task:Promise<void>}|null=null;
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
  private floorId = "ground";
  private draft: Point[] = [];
  private lastPoint: Point = { x: 0, y: 0 };
  private renderQueued = false;
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
  private brushId: number | null = null;
  private brushQueue = Promise.resolve();
  private paintDraft: {
    id: number;
    map: import("./world-contracts").AtlasMap;
    cells: Map<string, import("./world-contracts").AtlasCell>;
  } | null = null;
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
    },
  ) {
    this.root.id = "campaign-atlas";
    this.root.hidden = true;
    this.root.innerHTML = `<div class="atlas-command-bar"><strong>Atlas</strong><button id="atlas-overview">Weltübersicht</button><button id="atlas-to-party">Zur Gruppe</button><label>Ort finden<input id="atlas-search" type="search" placeholder="Stadt, Haus oder Raum"></label><span id="atlas-scale"></span><button id="atlas-recover" hidden>Speicherstand klären</button><button id="atlas-undo" disabled>↶ Rückgängig</button><button id="atlas-redo" disabled>↷ Wiederholen</button></div><div id="atlas-search-results"></div><dialog id="atlas-place-confirm"><h2>Gruppe versetzen</h2><p>Die Fokusgruppe wird an den gewählten Punkt gesetzt. Dabei vergeht keine Reisezeit.</p><div class="toolbar"><button id="atlas-place-accept">Platzieren</button><button id="atlas-place-cancel">Abbrechen</button></div></dialog><div class="atlas-layout"><div class="atlas-stage"><svg id="campaign-map" tabindex="0" role="application" aria-label="Gemeinsamer Kampagnenatlas"></svg><p id="atlas-save-status" role="status"></p></div><aside id="atlas-panel"><nav id="atlas-families" aria-label="Atlaswerkzeuge"></nav><h2 id="atlas-selection-title">Deine Kampagnenwelt</h2><p id="atlas-hint">Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.</p><section id="atlas-tool-fields"><label>Terrain<select id="atlas-terrain">${Object.entries(
      terrainNames,
    )
      .map(([id, title]) => `<option value="${id}">${title}</option>`)
      .join(
        "",
      )}</select></label><label>Hexstufe<select id="atlas-hex-level">${Array.from({ length: 9 }, (_, i) => `<option value="${i}">${(3*3**i).toLocaleString("de-DE")} Meilen Kante zu Kante</option>`).join("")}</select></label><label>Name<input id="atlas-new-name" value="Neue Stadt"></label><div id="atlas-create-tools"><button id="atlas-create-city">Stadt hier anlegen</button><button id="atlas-create-dungeon">Dungeon hier anlegen</button></div><button id="atlas-building-interior" hidden>Innenraumhülle anlegen</button><label id="atlas-floor-field">Geschoss<select id="atlas-floor"></select></label><label><input id="atlas-roofs" type="checkbox" checked> Dächer anzeigen</label><label><input id="atlas-slice-enabled" type="checkbox"> Höhenschnitt</label><label>Höhe in m<input id="atlas-slice" type="number" step="any" value="0"></label><button id="atlas-room-draw">Raumrechteck zeichnen</button><button id="atlas-draft-cancel" hidden>Zug verwerfen</button></section><section id="atlas-context-fields"><label><input id="atlas-perception" type="checkbox"> Wissen und Sicht der Gruppe</label><button id="atlas-connect-entrance" hidden>Eingang verbinden</button><div id="atlas-local-console" hidden><h3>Reise der Fokusgruppe</h3><p id="atlas-local-status" role="status"></p><button id="atlas-local-refresh" hidden>Reisekontext erneut laden</button><div class="toolbar"><button id="atlas-local-preview">Weg prüfen</button><button id="atlas-local-start" disabled>Reise starten</button><button id="atlas-local-step">Ein Schritt</button><button id="atlas-local-round">Eine Runde</button><button id="atlas-local-play">Wiedergabe starten</button><button id="atlas-local-pause">Pause</button><button id="atlas-local-end">Beenden</button></div><label id="atlas-entrance-field" hidden>Eingang<select id="atlas-entrance-choice"></select></label><button id="atlas-local-entrance" hidden>Durch Eingang</button><details><summary>Gruppe platzieren</summary><p>Versetzt die Fokusgruppe ohne Reisezeit an den zuletzt gewählten Punkt.</p><button id="atlas-local-place">Hier platzieren</button></details></div></section><details id="atlas-placement" hidden><summary>Räumliche Einordnung</summary><label>X in m<input id="atlas-binding-x" type="number" step="any"></label><label>Y in m<input id="atlas-binding-y" type="number" step="any"></label><label>Drehung in Grad<input id="atlas-binding-angle" type="number" step="any"></label><button id="atlas-binding-save">Einordnung übernehmen</button></details><details><summary>Atlas ausgeben</summary><label>Inhalt<select id="atlas-export-audience"><option value="gm">GM-Ansicht</option><option value="public">Wissen der Fokusgruppe</option></select></label><label>Format<select id="atlas-export-format"><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label><label>Längste Bildkante in Pixel<input id="atlas-export-size" type="number" min="256" max="8192" value="2048"></label><label><input id="atlas-export-grid" type="checkbox"> Hexraster ausgeben</label><label><input id="atlas-export-reference" type="checkbox"> Vorlage im GM-Bild ausgeben</label><p>Ohne gewählten Ausgaberahmen wird die aktuelle Ansicht verwendet.</p><button id="atlas-export-png">Bild ausgeben</button><button id="atlas-export-cancel" hidden>Ausgabe abbrechen</button></details><details id="atlas-advanced"><summary>Fachwerkzeuge und Details</summary><div id="atlas-advanced-fields"></div></details></aside></div>`;
    document.getElementById("workspace-navigation")!.after(this.root);
    this.svg = this.root.querySelector("svg")!;
    this.camera = new PassiveMapCanvas(this.svg, {
      relative: true,
      initial: { x: -15000, y: -10000, width: 30000, height: 20000 },
      minWidth: 0.1,
      maxWidth: () => earthView(this.svg.clientWidth / Math.max(1,this.svg.clientHeight)).width,
      pan: (e) =>
        e.button === 1 ||
        (e.button === 0 &&
          (e.altKey ||
            (this.family === "navigation" &&
              (!(e.target as Element).closest<SVGElement>(
                "[data-atlas-object]",
              ) ||
                (e.target as Element).closest<SVGElement>("[data-atlas-object]")
                  ?.dataset.kind === "city")))),
      locked: () =>
        !!this.drag ||
        !!this.vertexDrag ||
        !!this.partyDrag ||
        !!this.paintDraft ||
        this.brushId !== null,
      changed: () => {
        this.remember();
        this.render();
      },
    });
    get("atlas-export-cancel").onclick=()=>{this.exportCancelled=true;if(this.owner)void window.campaign.cancelLandscapeRaster(this.owner.token,'export');};
    this.landscape=new LandscapeWorkbench(this.svg,{box:()=>this.camera.view,redraw:()=>this.scheduleRender(),write:a=>this.write(a),error:e=>this.error(e),data:()=>this.data});
    this.root.querySelectorAll<HTMLInputElement>('#atlas-hex-level,#atlas-terrain').forEach(n=>n.addEventListener('change',()=>{if(n.id==='atlas-hex-level')get<HTMLInputElement>('land-auto-level').checked=false;this.render();}));
    new ResizeObserver(()=>{const b=this.camera.view,aspect=this.svg.clientWidth/Math.max(1,this.svg.clientHeight);if(aspect>0)this.camera.set({...b,height:b.width/aspect},true);}).observe(this.svg);
    const names: Record<Family, string> = {
      navigation: "Navigation",
      terrain: "Landschaft",
      city: "Stadt",
      interior: "Innenräume",
      decoration: "Ausstattung",
      travel: "Erkunden",
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
            const r = await window.campaign.executeAtlasTravel(
              this.pendingTravel,
            );
            if (this.owner !== owner) return;
            if (!r.ok) throw new Error(r.error);
            this.data = r.value;
            this.pendingTravel = null;
          } else {
            const r = await recoverAtlasWrite(owner.token);
            if (this.owner !== owner || !r) return;
            if (!r.ok) throw new Error(r.error);
            this.data = r.value.atlas;
            await this.opts.updated(r.value.atlas.workspace);
            this.cancel();
            this.landscape.recovered();
            this.landscape.recovered();
          }
          get("atlas-save-status").textContent = "Speicherstand geklärt";
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
    get("atlas-roofs").onchange = () => this.render();
    get("atlas-perception").onchange = () => this.render();
    get("atlas-slice-enabled").onchange = () => this.render();
    get("atlas-slice").oninput = () => this.render();
    get("atlas-floor").onchange = () => {
      this.floorId = get<HTMLSelectElement>("atlas-floor").value;
      this.syncDrawingFloor();
      get<HTMLInputElement>("atlas-slice").value = String(
        this.data?.geometry.floors.find(
          (f) => f.scopeId === this.scopeId && f.id === this.floorId,
        )?.elevation ?? 0,
      );
      this.render();
    };
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
    get("atlas-create-city").onclick = () => void this.createCity();
    get("atlas-create-dungeon").onclick = () => void this.createDungeon();
    get("atlas-building-interior").onclick = () => void this.createInterior();
    get("atlas-room-draw").onclick = () => {
      this.draft = [];
      this.root.dataset.roomDraw = "true";
      get("atlas-hint").textContent =
        "Zwei gegenüberliegende Ecken im Atlas wählen. Escape verwirft.";
    };
    get("atlas-draft-cancel").onclick = () => this.cancel();
    this.svg.addEventListener("click", (e) => void this.click(e));
    this.svg.addEventListener("pointerdown", (e) => this.down(e));
    this.svg.addEventListener("pointermove", (e) => this.move(e));
    this.svg.addEventListener("pointerup", (e) => void this.up(e));
    this.svg.addEventListener("pointercancel", () => this.cancel());
    this.svg.addEventListener("lostpointercapture", () => {
      if (
        this.paintDraft ||
        this.brushId !== null ||
        this.drag ||
        this.vertexDrag ||
        this.partyDrag
      )
        this.cancel();
    });
    this.svg.addEventListener("keydown", (e) => {
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
      this.data = a;
      this.scheduleRender();
    });
    document.addEventListener('atlas-invalidated',e=>{
      const detail=(e as CustomEvent<{campaignId:string;token?:string;revision?:number}>).detail;
      if(detail?.campaignId!==this.owner?.campaign.id||detail.token&&detail.token!==this.owner?.token)return;
      if(detail.revision!==undefined)this.landscape.invalidate(detail.revision);
      if(!this.busy&&!this.root.hidden)void this.refresh();
    });
    document.addEventListener("atlas-draft", () => this.scheduleRender());
    document.addEventListener("atlas-runtime", () => {
      if (this.root.hidden || this.refreshTimer) return;
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        void this.refresh();
      }, 100);
    });
  }
  private error(e: unknown) {
    const text = (e as Error).message;
    get("atlas-save-status").textContent = text;
    get("atlas-save-status").dataset.error = "true";
    this.opts.status(text, true);
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
  hide() {
    this.previewRequest++;
    this.localPreview = null;
    this.playback.stop();
    this.root.hidden = true;
  }
  activate(w: WorkspaceGeometry) {
    this.travelReadState = "loading";
    this.previewRequest++;
    this.playback.stop();
    this.localPreview = null;
    this.entranceId = null;
    this.entranceDraft = null;
    this.bindingDirty = false;
    this.owner = w;
    this.searchRequest++;get('atlas-search-results').replaceChildren();
    this.landscape.context(w.token);
    this.data = null;
    this.request++;
    this.selection = null;
    this.cityId = null;
    this.scopeId = null;
    this.draft = [];
    this.root.dataset.roomDraw = "false";
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
  async refresh() {
    const w = this.owner,
      request = ++this.request;
    if (!w) return;
    const retry = this.travelReadState === "failed";
    this.travelReadState = "loading";
    this.previewRequest++;
    this.localPreview = null;
    this.playback.stop();
    this.render();
    this.renderTravel();
    try {
      const r = await window.campaign.atlasRenderView(w.token);
      if (this.owner !== w || request !== this.request) return;
      if (!r.ok) throw new Error(r.error);
      this.data = r.value;
      this.travelReadState = "ready";
      if (retry) {
        get("atlas-save-status").textContent = "Reisekontext aktualisiert";
        get("atlas-save-status").dataset.error = "false";
        this.opts.status("Reisekontext aktualisiert");
      }
      this.render();
    } catch (e) {
      if (this.owner === w && request === this.request) {
        this.travelReadState = "failed";
        this.error(e);
        this.renderTravel();
      }
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
      this.draft.length ||
      this.paintDraft ||
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
    get("atlas-save-status").textContent = "Wird gespeichert…";
    try {
      const commandId = crypto.randomUUID(),
        a = structuredClone(action);
      if (a.kind === "city" || a.kind === "world" || a.kind === "drawing")
        a.command.commandId = commandId;
      if (a.kind === "room-edit") a.edit.commandId = commandId;
      const command={commandId,token:w.token,campaignId:w.campaign.id,action:a};
      const r = a.kind.startsWith('landscape-') && this.data
        ? await (async()=>{
          const ack=await writeAtlasCommit(command);
          if(!ack.ok)return ack;
          this.playback.stop();this.localPreview=null;
          return {ok:true as const,value:{atlas:{...this.data!,revision:ack.value.revision,canUndo:ack.value.canUndo,canRedo:ack.value.canRedo},result:null}};
        })()
        : await writeAtlas(command);
      if (this.owner !== w) return null;
      if (!r.ok) throw new Error(r.error);
      this.data = r.value.atlas;
      if (applyWorkspace) await this.opts.updated(r.value.atlas.workspace);
      get("atlas-save-status").textContent = "Gespeichert";
      get("atlas-save-status").dataset.error = "false";
      this.render();
      return r.value;
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
  private async history(kind: "undo" | "redo") {
    if (!(await this.opts.flush())) return;
    const result = await this.write({ kind }, true);
    if (result && this.cityId) await openCityReference(this.cityId);
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
  private chooseScope(id: string) {
    const b = this.data?.bindings.find(
      (b) => b.kind === "dungeon" && b.ownerId === id,
    );
    if (!b) return;
    this.scopeId = id;
    this.floorId =
      this.data!.workspace.floors.find((f) => f.scopeId === id)?.id ?? "ground";
    this.selection = { kind: "scope", id };
    void this.setFamily("interior", false).then(() => {
      this.syncDrawingFloor();
      this.focus(atlasFrame(this.data!, b), 50);
    });
  }
  private frame(scopeId: string) {
    const b = this.data?.bindings.find(
        (b) => b.kind === "dungeon" && b.ownerId === scopeId,
      ),
      f = b ? atlasFrame(this.data!, b) : { x: 0, y: 0, angle: 0 };
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
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      this.svg.getScreenCTM()!.inverse(),
    );
    return { x: p.x + this.camera.view.x, y: p.y + this.camera.view.y };
  }
  private cancel() {
    this.bindingDirty = false;
    this.paintDraft = null;
    this.brushId = null;
    this.vertexDrag = null;
    this.partyDrag = null;
    if (this.family === "interior" || this.family === "decoration")
      get("drawing-cancel").click();
    if (this.family === "city") get("city-cancel-path").click();
    this.entranceDraft = null;
    this.draft = [];
    this.drag = null;
    this.root.dataset.roomDraw = "false";
    get("atlas-draft-cancel").hidden = true;
    this.render();
  }
  private async setFamily(f: Family, flush = true) {
    if (flush && !(await this.opts.flush())) return;
    this.family = f;
    this.landscape.setActive(f==="terrain");
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
          ? ["atlas"]
          : f === "travel"
            ? ["dungeon", "world"]
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
      get("atlas-advanced-fields").append(n);
      n.hidden = false;
    }
    this.root.dataset.family = f;
    if(f==='interior'||f==='decoration')await reloadDrawing();
    if (f === "city" && this.cityId) await openCityReference(this.cityId);
    if (f === "travel") {
      await this.refresh();
      await openWorld();
      await openDungeon();
    }
    this.render();
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
  async navigate(kind: "city" | "room", id: string, unitId?: string) {
    await this.refresh();
    if (!this.data) return;
    if (kind === "city") {
      this.cityId = id;
      this.selection = unitId
        ? { kind: "building", id: unitId, cityId: id }
        : { kind: "city", id };
      await this.setFamily("city", false);
      await openCityReference(id, unitId);
      const c = this.data.cities.find((c) => c.header.id === id),
        b = this.data.bindings.find(
          (b) => b.kind === "city" && b.ownerId === id,
        );
      if (c && b) {
        const u = c.units.find((u) => u.id === unitId),
          at = localToAtlas(
            u?.position ?? { x: c.header.width / 2, y: c.header.height / 2 },
            atlasFrame(this.data, b),
          );
        this.focus(at, unitId ? 60 : c.header.width * 1.4);
      }
    } else {
      const r = this.data.workspace.rooms.find((r) => r.id === id);
      if (!r) {await this.opts.selectRoom(id);return;}
      this.selection = { kind: "room", id };
      this.scopeId = r.scopeId;
      this.floorId = r.floorId;
      await this.opts.selectRoom(id);
      await this.setFamily("interior", false);
      this.syncDrawingFloor();
      const points = r.polygons.flatMap((p) => p.outer),
        at = localToAtlas(
          {
            x: points.reduce((n, p) => n + p.x, 0) / points.length,
            y: points.reduce((n, p) => n + p.y, 0) / points.length,
          },
          this.frame(r.scopeId),
        );
      this.focus(
        at,
        Math.max(
          30,
          Math.max(...points.map((p) => p.x)) -
            Math.min(...points.map((p) => p.x)) +
            10,
        ),
      );
    }
    this.render();
  }
  private focus(p: Point, width: number) {
    const ratio = this.svg.clientHeight / Math.max(1, this.svg.clientWidth);
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
    if (!text || !this.data) return;
    const add = (name: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = name;
      b.onclick = () => {
        root.replaceChildren();
        fn();
      };
      root.append(b);
    };
    const token=this.owner!.token;

    const current=()=>request===this.searchRequest&&this.owner?.token===token&&get<HTMLInputElement>('atlas-search').value.trim().toLocaleLowerCase('de')===text;
    const more=(title:string,load:()=>Promise<void>)=>{const b=document.createElement('button');b.textContent=title;b.onclick=()=>{b.remove();void load().catch(e=>{if(current())this.error(e);});};root.append(b);};
    const page=async(kind:'city'|'landscape',cursor?:import('./campaign-atlas-contracts').AtlasObjectQuery['cursor'])=>{
      const result=await window.campaign.atlasObjects(token,{kind,text,limit:40,cursor});if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.name,()=>void (kind==='landscape'?this.navigateLandscape(item.id).catch(e=>this.error(e)):this.navigate(kind,item.id)));
      if(result.value.next)more(kind==='city'?'Weitere Städte':'Weitere Landschaftsobjekte',()=>page(kind,result.value.next!));
    };
    const rooms=async(cursor?:import('./contracts').RoomDirectoryQuery['cursor'])=>{
      const result=await window.campaign.roomDirectory(token,{text,limit:40,...(cursor?{cursor}: {})},'atlas');if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.number+' · '+item.name,()=>void this.navigate('room',item.id));
      if(result.value.unreadable){const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent=result.value.unreadable+' Raumtexte konnten nicht durchsucht werden.';root.append(warning);}
      if(result.value.next)more('Weitere Räume',()=>rooms(result.value.next!));
    };
    const buildings=async(offset=0)=>{const result=await window.campaign.cityBuildings(token,{text,offset});if(!current())return;if(!result.ok)throw new Error(result.error);for(const item of result.value.items)add(item.cityTitle+' · '+item.title,()=>void this.navigate('city',item.cityId,item.unitId));if(result.value.next!==null)more('Weitere Häuser',()=>buildings(result.value.next!));};
    for(const task of [rooms(),page('city'),page('landscape'),buildings()])void task.catch(e=>{if(current())this.error(e);});
    for (const scope of this.data.scopes)
      if(scope.name.toLocaleLowerCase('de').includes(text))add(scope.name,()=>this.chooseScope(scope.id));
  }

  private async navigateLandscape(id:string) {
    const owner=this.owner;if(!owner||!await this.flush()||!await this.opts.flush()||this.owner!==owner)return;
    const result=await window.campaign.atlasLandscapeObject(owner.token,id);
    if(this.owner!==owner)return;
    if(!result.ok){this.error(new Error(result.error));return;}
    const record=result.value;
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
    const r = await this.write(
      {
        kind: "dungeon-create",
        name: "Innenräume",
        x: 0,
        y: 0,
        buildingId: this.selection.id,
      },
      true,
    );
    if (r) {
      this.scopeId = (r.result as { id: string }).id;
      this.floorId = "ground";
      get<HTMLInputElement>("atlas-roofs").checked = false;
      const f = this.frame(this.scopeId);
      this.focus(f, 30);
      await this.setFamily("interior", false);
      this.syncDrawingFloor();
      this.render();
    }
  }

  private async click(e: MouseEvent) {
    if (this.ignoreClick) {
      this.ignoreClick = false;
      return;
    }
    if (this.busy || e.altKey || e.button !== 0 || this.drag || this.vertexDrag)
      return;
    const p = this.point(e);
    this.lastPoint = p;
    const target = (e.target as Element).closest<SVGElement>(
        "[data-atlas-object]",
      ),
      kind = target?.dataset.kind,
      id = target?.dataset.id;
    try {
      if (this.family === "terrain") return;
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
      if (this.root.dataset.roomDraw === "true") {
        if (!this.scopeId)
          throw new Error(
            "Zuerst einen Dungeon oder ein Gebäude mit Innenraumhülle wählen.",
          );
        const local = atlasToLocal(p, this.frame(this.scopeId));
        this.draft.push(local);
        get("atlas-draft-cancel").hidden = false;
        if (this.draft.length === 2) {
          const [a, b] = this.draft as [Point, Point];
          if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01)
            throw new Error("Raum benötigt eine Fläche.");
          const result = await this.write(
            {
              kind: "room-create",
              scopeId: this.scopeId,
              floorId: this.floorId,
              name: get<HTMLInputElement>("atlas-new-name").value,
              polygons: [
                {
                  outer: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }],
                  holes: [],
                },
              ],
            },
            true,
          );
          if (result) {
            this.cancel();
            const id = (result.result as { id: string }).id;
            await this.opts.selectRoom(id);
            this.selection = { kind: "room", id };
          }
        }
        this.render();
        return;
      }
      if (
        this.family === "city" &&
        this.cityId &&
        get<HTMLSelectElement>("city-tool").value !== "select"
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
      if (kind === "scope" && id) {
        this.chooseScope(id);
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
        const cityId = target!.dataset.cityId!;
        this.cityId = cityId;
        this.selection = { kind: kind as "building" | "city-unit", id, cityId };
        const binding = this.data?.bindings.find(
          (b) => b.parent === "building" && b.parentId === id,
        );
        if (binding) {
          this.scopeId = binding.ownerId;
          this.floorId = "ground";
          this.syncDrawingFloor();
        }
        await openCityReference(cityId, id);
        this.render();
        return;
      }
      if (kind === "city" && id) {
        this.cityId = id;
        this.selection = { kind: "city", id };
        await openCityReference(id);
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
    setTimeout(() => {
      this.ignoreClick = false;
    }, 0);
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
  private paintPoint(p: Point) {
    const d = this.paintDraft;
    if (!d) return;
    const level = Number(get<HTMLSelectElement>("atlas-hex-level").value),
      h = atlasHexAt(p, d.map.hexMeters * 3 ** level),
      key = level + ":" + h.q + "," + h.r;
    if (d.cells.has(key)) return;
    d.cells.set(key, {
      ...cellAt(d.map, h, level),
      ...h,
      level,
      terrain: get<HTMLSelectElement>("atlas-terrain")
        .value as import("./world-contracts").Terrain,
    });
    this.render();
  }
  private down(e: PointerEvent) {
    if (e.button !== 0 || e.altKey || this.busy) return;
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
    const hit = (e.target as Element).closest<SVGElement>(
      "[data-atlas-object]",
    );
    if (hit?.dataset.kind === "party") {
      this.partyDrag = {
        id: e.pointerId,
        start: this.point(e),
        last: this.point(e),
      };
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    const handle = (e.target as Element).closest<SVGElement>(
      "[data-atlas-vertex]",
    );
    if (handle && this.data) {
      const selected=this.opts.roomDraft();
      const room=selected?.id===handle.dataset.id?selected:null;
      if (room) {
        this.vertexDrag = {
          id: e.pointerId,
          room: structuredClone(room),
          polygon: Number(handle.dataset.polygon),
          vertex: Number(handle.dataset.atlasVertex),
          point: atlasToLocal(this.point(e), this.frame(room.scopeId)),
        };
        this.svg.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    const target = (e.target as Element).closest<SVGElement>(
      "[data-atlas-object]",
    );
    if (this.family === "navigation" && target?.dataset.kind === "building") {
      this.drag = {
        id: e.pointerId,
        start: this.point(e),
        last: this.point(e),
        selection: {
          kind: "building",
          id: target.dataset.id!,
          cityId: target.dataset.cityId!,
        },
      };
      this.svg.setPointerCapture(e.pointerId);
    }
  }
  private move(e: PointerEvent) {
    if (this.paintDraft?.id === e.pointerId) {
      this.paintPoint(this.point(e));
      return;
    }
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
    if (this.paintDraft?.id === e.pointerId) {
      const stroke = this.paintDraft;
      this.paintDraft = null;
      this.suppressClick();
      const cells = new Map(
        stroke.map.cells.map((c) => [c.level + ":" + c.q + "," + c.r, c]),
      );
      for (const [k, c] of stroke.cells) cells.set(k, c);
      if (this.owner)
        await this.write({
          kind: "world",
          command: {
            commandId: crypto.randomUUID(),
            token: this.owner.token,
            campaignId: this.owner.campaign.id,
            action: {
              kind: "map",
              map: { ...stroke.map, cells: [...cells.values()] },
              expectedRevision: stroke.map.revision,
            },
          },
        });
      return;
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
      const city = this.data.cities.find((c) => c.header.id === s.cityId)!,
        unit = city.units.find((u) => u.id === s.id)!,
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
  private renderTravel() {
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
    const text = this.localPreview
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
      locked || !(this.localPreview || (this.data.geometry.position && atlasDungeonState().preview));
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
      const r = await window.campaign.executeAtlasTravel(command);
      acknowledged = true;
      if (this.owner !== w) return false;
      if (!r.ok) throw new Error(r.error);
      this.data = r.value;
      this.localPreview = null;
      get("atlas-save-status").textContent = "Reisestand gespeichert";
      this.render();
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
          get<HTMLFormElement>("world-travel-form").requestSubmit();
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
          this.travelReadState = "failed";
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
        else get("dungeon-confirm").click();
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
  private render() {
    const data = this.data;
    if (!data || this.root.hidden) return;
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
    const box = this.camera.view;
    this.svg.dataset.atlasOriginX = String(box.x);
    this.svg.dataset.atlasOriginY = String(box.y);
    const mpp = box.width / Math.max(1, this.svg.clientWidth);
    get("atlas-scale").textContent =
      (mpp >= 1000
        ? (mpp / 1000).toFixed(2) + " km"
        : mpp.toFixed(mpp < 1 ? 3 : 1) + " m") + " / Pixel";
    get<HTMLButtonElement>("atlas-undo").disabled = this.busy || !data.canUndo;
    get<HTMLButtonElement>("atlas-redo").disabled = this.busy || !data.canRedo;
    get("atlas-connect-entrance").hidden =
      this.selection?.kind !== "room" || this.family !== "interior";
    get("atlas-local-console").hidden = this.family !== "travel";
    this.renderTravel();
    get("atlas-create-tools").hidden = this.family === "travel";
    get("atlas-floor-field").hidden = !this.scopeId;
    for (const id of ["atlas-slice-enabled", "atlas-slice", "atlas-roofs"])
      get(id).closest<HTMLElement>("label")!.hidden = !this.scopeId;
    get("atlas-building-interior").hidden =
      this.selection?.kind !== "building" ||
      data.bindings.some((b) => b.parentId === this.selection?.id);
    const title =
      this.selection?.kind === "room"
        ? data.workspace.rooms.find((r) => r.id === this.selection!.id)?.name
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
    get("atlas-selection-title").textContent = title || "Deine Kampagnenwelt";
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
    this.camera.render((root) => {
      this.drawTerrain(root, box, mpp);
      this.landscape.draw(root,box,mpp);
      for (const citySaved of data.cities) {
        const binding = data.bindings.find(
          (b) => b.kind === "city" && b.ownerId === citySaved.header.id,
        );
        if (!binding) continue;
        const preview = atlasCityState(),
          city =
            preview?.view.header.id === citySaved.header.id &&
            preview.view.header.revision >= citySaved.header.revision
              ? preview.view
              : citySaved,
          f = atlasFrame(data, binding),
          g = shape("g", { transform: frameTransform(this.relative(f)) });
        g.dataset.atlasObject = "true";
        g.dataset.kind = "city";
        g.dataset.id = city.header.id;
        const center = localToAtlas(
          { x: city.header.width / 2, y: city.header.height / 2 },
          f,
        );
        if (
          !this.visible(
            center,
            Math.max(city.header.width, city.header.height),
            box,
          )
        )
          continue;
        if (mpp > city.header.width / 25) {
          const marker = shape("circle", {
            cx: center.x - box.x,
            cy: center.y - box.y,
            r: 6 * mpp,
            fill: "#c58a58",
            stroke: "#4f4230",
            "stroke-width": mpp,
          });
          marker.dataset.atlasObject = "true";
          marker.dataset.kind = "city";
          marker.dataset.id = city.header.id;
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
        const corners = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x, y: box.y + box.height },
            { x: box.x + box.width, y: box.y + box.height },
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
        const doc = new DOMParser().parseFromString(
          citySvg({ ...shownCity, units: visibleUnits }),
          "image/svg+xml",
        );
        for (const c of Array.from(doc.documentElement.children)) {
          const uid = c.getAttribute("data-city-unit"),
            interior = data.bindings.find(
              (b) => b.parent === "building" && b.parentId === uid,
            );
          if (
            interior &&
            (!get<HTMLInputElement>("atlas-roofs").checked ||
              mpp <= 0.4 ||
              interior.ownerId === this.scopeId)
          ) {
            for (const p of c.querySelectorAll("polygon")) {
              p.setAttribute("fill", "none");
              p.setAttribute("stroke", "#624337");
              p.setAttribute("stroke-width", String(Math.max(0.15, mpp)));
              if (
                interior.ownerId === this.scopeId &&
                this.floorId !== "ground"
              )
                p.setAttribute("visibility", "hidden");
            }
          }
          if (c.tagName === "rect") {
            c.setAttribute("width", String(city.header.width));
            c.setAttribute("height", String(city.header.height));
          }
          for (const text of [
            c,
            ...Array.from(c.querySelectorAll("text")),
          ].filter((n) => n.tagName === "text"))
            text.setAttribute(
              "font-size",
              String(
                Math.min(Number(text.getAttribute("font-size")) || 6, 12 * mpp),
              ),
            );
          g.append(document.importNode(c, true));
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
              points: points.map((p) => `${p.x},${p.y}`).join(" "),
              fill: line ? "none" : "transparent",
              stroke: this.selection?.id === u.id ? "#b85525" : "transparent",
              "stroke-width": line ? Math.max(u.width ?? 6, mpp * 8) : 2 * mpp,
            });
          path.dataset.atlasObject = "true";
          path.dataset.kind = u.kind === "building" ? "building" : "city-unit";
          path.dataset.id = u.id;
          path.dataset.cityId = city.header.id;
          g.append(path);
        }
        if (preview?.view.header.id === city.header.id && preview.path.length)
          g.append(
            shape("polyline", {
              points: preview.path.map((p) => p.x + "," + p.y).join(" "),
              fill: "none",
              stroke: "#c65d28",
              "stroke-width": 2 * mpp,
            }),
          );
        root.append(g);
      }
      for (const binding of data.bindings.filter((b) => b.kind === "dungeon"))
        this.drawInterior(root, binding, box, mpp);
      if (this.draft.length && this.scopeId) {
        const f = this.frame(this.scopeId),
          p = localToAtlas(this.draft[0]!, f);
        root.append(
          shape("circle", {
            cx: p.x - box.x,
            cy: p.y - box.y,
            r: mpp * 4,
            fill: "#c65d28",
          }),
        );
      }
      const travel = atlasWorldTravelState(),
        route =
          travel.preview?.route ??
          data.scene?.journey?.route.slice(data.scene.journey.nextIndex) ??
          [];
      if (route.length)
        root.append(
          shape("polyline", {
            points: route
              .map((p) => {
                const h = atlasHexPoint(p.q, p.r, data.terrain.hexMeters);
                return h.x - box.x + "," + (h.y - box.y);
              })
              .join(" "),
            fill: "none",
            stroke: "#be5939",
            "stroke-width": mpp * 3,
          }),
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
          shape("line", {
            x1: out.x - box.x,
            y1: out.y - box.y,
            x2: at.x - box.x,
            y2: at.y - box.y,
            stroke: "#27635a",
            "stroke-width": mpp * 2,
          }),
        );
        const marker = shape("circle", {
          cx: out.x - box.x,
          cy: out.y - box.y,
          r: mpp * 5,
          fill: "#39766a",
          stroke: "white",
          "stroke-width": mpp,
        });
        marker.dataset.atlasObject = "true";
        marker.dataset.kind = "entrance";
        marker.dataset.id = e.id;
        root.append(marker);
      }
      const localRoute = this.localPreview?.route ?? data.localJourney?.route;
      if (localRoute?.length)
        root.append(
          shape("polyline", {
            points: localRoute
              .map((p) => p.x - box.x + "," + (p.y - box.y))
              .join(" "),
            fill: "none",
            stroke: "#b05d32",
            "stroke-width": mpp * 2,
          }),
        );
      this.drawParty(root, mpp);
    });
  }
  private async exportPNG() {
    if (!this.data || !this.owner || this.exporting) return;
    const owner = this.owner;
    this.exporting = true;this.exportCancelled=false;get("atlas-export-cancel").hidden=false;
    get<HTMLButtonElement>("atlas-export-png").disabled = true;
    get("atlas-save-status").textContent = "PNG wird vorbereitet…";
    try {
      if (!(await this.opts.flush()) || this.owner !== owner) return;
      const audience = get<HTMLSelectElement>("atlas-export-audience").value as
          | "gm"
          | "public",
        box = this.landscape.exportBox??this.camera.view;
      const snapshot=this.data;
      const format=get<HTMLSelectElement>("atlas-export-format").value as 'png'|'jpeg',size=Number(get<HTMLInputElement>("atlas-export-size").value);
      if(!Number.isInteger(size)||size<256||size>8192)throw new Error("Ausgabegröße zwischen 256 und 8192 Pixel wählen.");
      const width=Math.max(1,Math.round(size*Math.min(1,box.width/box.height))),height=Math.max(1,Math.round(size*Math.min(1,box.height/box.width)));
      let svg:SVGSVGElement;
      if(audience==='public'){
        if(snapshot.geometry.position&&snapshot.perception)svg=publicAtlasSVG(snapshot,box);
        else {
          const frame=await window.campaign.playerView(owner.token);
          if(!frame.ok)throw new Error(frame.error);
          if(this.owner!==owner||this.exportCancelled)return;
          svg=publicAtlasSVG(snapshot,box,frame.value.frame);
        }
      } else {
        const region=await window.campaign.landscapeRegion(owner.token,box,box.width/width,false);
        if(!region.ok)throw new Error(region.error);
        if(this.owner!==owner)return;
        if(region.value.revision!==snapshot.revision)throw new Error("Atlas wurde während der Ausgabe geändert. Erneut ausgeben.");
        const rasters=await landscapeExportTiles(box,width,height,snapshot.campaignId,snapshot.revision,(part,w,h)=>window.campaign.landscapeRaster(owner.token,part,w,h,'export'),()=>this.owner===owner&&!this.exportCancelled,(done,total)=>{get('atlas-save-status').textContent=`Bild wird vorbereitet: ${done}/${total}`;});
        const assets=new Map(this.landscape.assets);
        if(get<HTMLInputElement>("atlas-export-reference").checked)for(const r of region.value.records)if(r.assetId&&!assets.has(r.assetId)){const image=await window.campaign.referenceAsset(owner.token,r.assetId);if(!image.ok)throw new Error(image.error);assets.set(r.assetId,image.value);}
        svg=atlasRegionSVG(snapshot,region.value.records,box,width,assets,{rasters,grid:get<HTMLInputElement>("atlas-export-grid").checked,level:Number(get<HTMLSelectElement>("atlas-hex-level").value),references:get<HTMLInputElement>("atlas-export-reference").checked,floorId:this.floorId,roofs:get<HTMLInputElement>("atlas-roofs").checked});
      }
      const bytes = await atlasPNG(svg, width, height,format);
      if (this.owner !== owner || this.exportCancelled) return;
      const r = await window.campaign.exportAtlasPNG(
        owner.token,
        bytes,
        audience,
        format,
      );
      if (!r.ok) throw new Error(r.error);
      if (!r.value.cancelled) {
        this.opts.status("Atlas-"+format.toUpperCase()+" gespeichert.");
        get("atlas-save-status").textContent = "Atlas-"+format.toUpperCase()+" gespeichert";
      }
    } catch (e) {
      if (this.owner === owner && !this.exportCancelled) this.error(e);
    } finally {
      if(this.exportCancelled&&this.owner===owner)get("atlas-save-status").textContent="Ausgabe abgebrochen";
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
  private label(root: SVGElement, text: string, p: Point, mpp: number) {
    if ((root as SVGGElement).dataset.mapScene) p = this.relativePoint(p);
    const t = shape("text", {
      x: p.x,
      y: p.y - 8 * mpp,
      "font-size": 12 * mpp,
      "text-anchor": "middle",
      "paint-order": "stroke",
      stroke: "#f2eee3",
      "stroke-width": 3 * mpp,
      fill: "#283d3b",
      "pointer-events": "none",
    });
    t.textContent = text;
    root.append(t);
  }
  private drawTerrain(root:SVGElement,box:CanvasBox,_mpp:number){root.append(shape("rect",{width:box.width,height:box.height,fill:"#b8c896"}));}
  private drawInterior(
    root: SVGElement,
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
    if (
      building &&
      get<HTMLInputElement>("atlas-roofs").checked &&
      mpp > 0.4 &&
      b.ownerId !== this.scopeId
    )
      return;
    const floor = b.ownerId === this.scopeId ? this.floorId : "ground",
      shown = rooms.filter((r) => r.floorId === floor);
    if (b.parent === "world" && (shown.length || b.ownerId !== "local")) {
      const points = shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)),
        extent = points.length
          ? Math.max(...points.map((p) => p.x)) -
            Math.min(...points.map((p) => p.x))
          : 0;
      if (!shown.length || mpp > Math.max(1, extent / 25)) {
        const marker = shape("circle", {
          cx: f.x - box.x,
          cy: f.y - box.y,
          r: mpp * 6,
          fill: shown.length ? "#685b50" : "none",
          stroke: "#685b50",
          "stroke-width": mpp * 2,
        });
        marker.dataset.atlasObject = "true";
        marker.dataset.kind = "scope";
        marker.dataset.id = b.ownerId;
        root.append(marker);
        this.label(
          root,
          data.scopes.find((s) => s.id === b.ownerId)?.name ?? "Dungeon",
          f,
          mpp,
        );
        return;
      }
    }
    if (!shown.length) return;
    const g = shape("g", { transform: frameTransform(this.relative(f)) });
    for (const saved of shown) {
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
          box,
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
      const polygons = slice
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
      const path = shape("path", {
        d: roomPath(polygons),
        fill: this.selection?.id === room.id ? "#e8d8ac" : "#e2dac4",
        stroke: "#3d4b45",
        "stroke-width": Math.max(0.07, Math.min(0.18, mpp)),
        "fill-rule": "evenodd",
      });
      path.dataset.atlasObject = "true";
      path.dataset.kind = "room";
      path.dataset.id = room.id;
      g.append(path);
      appendRoomNumber(g, room, mpp);
      const vertices = room.polygons[0]!.outer;
      if (
        (Math.max(...vertices.map((p) => p.x)) -
          Math.min(...vertices.map((p) => p.x))) /
          mpp >
        60
      )
        this.label(
          g,
          room.name.slice(0, 40),
          {
            x: vertices.reduce((n, p) => n + p.x, 0) / vertices.length,
            y: vertices.reduce((n, p) => n + p.y, 0) / vertices.length,
          },
          mpp,
        );
      if (
        this.selection?.kind === "room" &&
        this.selection.id === room.id &&
        this.family === "interior" &&
        !slice
      )
        room.polygons.forEach((poly, pi) =>
          poly.outer.forEach((p, vi) => {
            const h = shape("circle", {
              cx: p.x,
              cy: p.y,
              r: Math.max(0.05, mpp * 4),
              fill: "white",
              stroke: "#244f87",
              "stroke-width": mpp,
            });
            h.dataset.atlasObject = "true";
            h.dataset.kind = "vertex";
            h.dataset.id = room.id;
            h.dataset.atlasVertex = String(vi);
            h.dataset.polygon = String(pi);
            g.append(h);
          }),
        );
    }
    for (const e of data.geometry.drawing.elements.filter(
      (e) => e.scopeId === b.ownerId && e.floorId === floor && !e.archived,
    )) {
      const node = shape("g");
      node.innerHTML = elementSvg(e, shown, data.geometry.drawing.elements);
      g.append(node);
    }
    if (
      b.ownerId === this.scopeId &&
      (this.family === "interior" || this.family === "decoration")
    ) {
      drawingOverlay(g);
      const draft = atlasDrawingDraft();
      if (draft.polygons)
        g.append(
          shape("path", {
            d: roomPath(draft.polygons),
            fill: "#d98f5555",
            stroke: "#b85c23",
            "stroke-width": 0.1,
          }),
        );
    }
    const runtime = atlasDungeonState(),
      route =
        runtime.preview?.route ??
        data.geometry.journey?.route.slice(data.geometry.journey.nextIndex) ??
        [];
    const points = route.filter(
      (p) => p.scopeId === b.ownerId && p.floorId === floor,
    );
    if (points.length)
      g.append(
        shape("polyline", {
          points: points.map((p) => p.x + "," + p.y).join(" "),
          fill: "none",
          stroke: "#b05c36",
          "stroke-width": Math.max(0.15, mpp * 2),
        }),
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
        shape("path", {
          d: `M${t.from.x},${t.from.y}L${t.to.x},${t.to.y}`,
          fill: "none",
          stroke: "#987cb0",
          "stroke-width": Math.max(0.08, mpp),
          "stroke-dasharray": `${mpp * 3} ${mpp * 3}`,
        }),
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
      const dot = shape("circle", {
        cx: n.pose!.x,
        cy: n.pose!.y,
        r: Math.max(0.15, mpp * 5),
        fill: "#8964a5",
        stroke: "#fff",
        "stroke-width": mpp,
      });
      const title = shape("title");
      title.textContent =
        n.name + (observation ? " · bekannt und sichtbar" : " · GM");
      dot.append(title);
      g.append(dot);
      if (!masked) {
        const points = n.path.filter(
          (p) => p.scopeId === b.ownerId && p.floorId === floor,
        );
        if (points.length)
          g.append(
            shape("polyline", {
              points: points.map((p) => `${p.x},${p.y}`).join(" "),
              fill: "none",
              stroke: "#8964a5",
              "stroke-width": mpp,
            }),
          );
      }
    }
    if (
      masked &&
      party?.scopeId === b.ownerId &&
      party.floorId === floor &&
      perception
    ) {
      const points = shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)),
        minX = Math.min(...points.map((p) => p.x)) - 1,
        minY = Math.min(...points.map((p) => p.y)) - 1,
        width = Math.max(...points.map((p) => p.x)) - minX + 1,
        height = Math.max(...points.map((p) => p.y)) - minY + 1;
      const mask = shape("mask", {
        id: "atlas-sight-" + b.id,
        maskUnits: "userSpaceOnUse",
        x: minX,
        y: minY,
        width,
        height,
      });
      mask.append(
        shape("rect", { x: minX, y: minY, width, height, fill: "white" }),
      );
      if (perception.known.length)
        mask.append(
          shape("path", {
            d: roomPath(perception.known),
            fill: "#666",
            "fill-rule": "evenodd",
          }),
        );
      if (perception.visible.length)
        mask.append(
          shape("path", {
            d: roomPath(perception.visible),
            fill: "black",
            "fill-rule": "evenodd",
          }),
        );
      const defs = shape("defs");
      defs.append(mask);
      g.append(
        defs,
        shape("rect", {
          x: minX,
          y: minY,
          width,
          height,
          fill: "#1e292b",
          opacity: 0.9,
          mask: `url(#atlas-sight-${b.id})`,
          "pointer-events": "none",
        }),
      );
    }
    root.append(g);
  }
  private drawParty(root: SVGElement, mpp: number) {
    const d = this.data!,
      position = this.partyDrag?.last ?? atlasPartyPoint(d);
    if (!position) return;
    const token = shape("circle", {
      cx: position.x - this.camera.view.x,
      cy: position.y - this.camera.view.y,
      r: mpp * 7,
      fill: "#244f87",
      stroke: "white",
      "stroke-width": mpp * 2,
    });
    token.dataset.atlasObject = "true";
    token.dataset.kind = "party";
    root.append(token);
    this.label(root, d.geometry.sceneTitle, position, mpp);
  }
}

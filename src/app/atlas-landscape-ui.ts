import {AtlasPaint,atlasPaint} from './atlas-paint';
import { pendingAtlasWrite } from "./campaign-atlas-author";
import polygonClipping from "polygon-clipping";
import type { AtlasRenderView, AtlasAction } from "./campaign-atlas-contracts";
import type { Point, Polygon } from "./contracts";
import {
  emptyRecord,
  hexSize,
  hexStrokesPolygons,
  distance,
  formatDistance,
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
  | "select"
  | "paint"
  | "hex"
  | "reset"
  | "river"
  | "road"
  | "place"
  | "measure";
function strokePolygon(points: Point[], radius: number): Polygon[] {
  const rings: Polygon[] = points.map((p) => ({
    outer: Array.from({ length: 20 }, (_, i) => ({
      x: p.x + radius * Math.cos((i * Math.PI) / 10),
      y: p.y + radius * Math.sin((i * Math.PI) / 10),
    })),
    holes: [],
  }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      l = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      x = (-(b.y - a.y) / l) * radius,
      y = ((b.x - a.x) / l) * radius;
    rings.push({
      outer: [
        { x: a.x + x, y: a.y + y },
        { x: b.x + x, y: b.y + y },
        { x: b.x - x, y: b.y - y },
        { x: a.x - x, y: a.y - y },
      ],
      holes: [],
    });
  }
  const [first, ...rest] = rings.map((p) => [
    p.outer.map((p) => [p.x, p.y] as [number, number]),
  ]);
  return polygonClipping.union(first!, ...rest).map((p) => ({
    outer: p[0]!.map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((r) => r.map(([x, y]) => ({ x, y }))),
  }));
}
export class LandscapeWorkbench {
  readonly panel = document.createElement("section");
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
  private selected: LandscapeRecord | null = null;
  private vertex = 0;
  private dragging = false;
  private lineDragChanged = false;
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
      hit:(e:MouseEvent,keys:string[])=>{data:Record<string,string>}|null;
      point:(e:MouseEvent)=>Point;
      refresh?:()=>Promise<unknown>;
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
    this.panel.innerHTML = `<label>Werkzeug<select id="land-tool"><option value="select">Auswählen / Verlauf korrigieren</option><option value="paint">Gelände / Küste malen</option><option value="hex">Hexfläche füllen</option><option value="reset">Eigenschaft zur Vorgabe zurücksetzen</option><option value="river">Fluss zeichnen</option><option value="road">Weg zeichnen</option><option value="place">Ort platzieren</option><option value="measure">Strecke messen</option></select></label><label>Eigenschaft<select id="land-field"><option value="terrain">Gelände</option><option value="elevationM">Höhe</option><option value="climate">Klima</option></select></label><label id="land-value-field">Wert<input id="land-value" placeholder="Höhe in Metern" value="0"></label><label>Pinselradius in m<input id="land-radius" type="number" min="1" value="500"></label><label>Verlaufstil<select id="land-line-style"><option value="path">Pfad / Bach</option><option value="road">Straße / Fluss</option></select></label><label>Verlaufbreite in m<input id="land-width" type="number" min="0.1" step="any" value="30"></label><p id="land-status" role="status">3 Meilen von Kante zu Kante. Orts-/Verlaufpunkte anklicken, dann abschließen.</p><div class="toolbar"><button id="land-finish">Zug abschließen</button><button id="land-cancel">Verwerfen</button><button id="land-reload" hidden>Ansicht erneut laden</button></div><label><input id="land-auto-level" type="checkbox" checked> Hexstufe automatisch anzeigen</label><label><input id="land-grid" type="checkbox" checked> Hexraster anzeigen</label><label>Objekt auswählen<select id="land-object"><option value="">Auf der Karte auswählen</option></select></label><div id="land-selection"></div><details><summary>Nachzeichenvorlage</summary><button id="land-reference">Bild laden und kalibrieren</button><label>Abstand der Bildpunkte in m<input id="land-calibration-distance" type="number" min="0.1" value="10000"></label><p>Nach dem Laden zwei Punkte im Bild anklicken. Anschließend Lage und Drehung bearbeiten.</p></details>`;
    html("atlas-tool-fields").after(this.panel);
    html<HTMLSelectElement>("land-tool").onchange = () => {
      if (this.hasDraft()) {
        html<HTMLSelectElement>("land-tool").value = this.tool;
        this.say("Zuerst abschließen oder verwerfen.");
        return;
      }
      this.tool = html<HTMLSelectElement>("land-tool").value as Tool;
      this.toolFields();
      this.say("Werkzeug wählen, auf der Karte arbeiten. Enter schließt Punktzüge ab; Escape verwirft.");
      this.measurement=[];
      this.selected = null;
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
      if (field === "climate")
        html<HTMLInputElement>("land-value").value = "temperate";
      else html<HTMLInputElement>("land-value").value = "0";
      html<HTMLInputElement>("land-value").placeholder =
        field === "climate"
          ? "temperate / cold / arid / tropical"
          : "Höhe in Metern";
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
        if(this.host.current&&!this.host.current()){this.say('Kartenausschnitt wird geladen. Zug danach beginnen.');return;}
        if (
          this.tool === "select" && !this.host.choose &&
          !this.hit(e, ["landscapeId","landVertex"])
        )
          return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.lastPoint = this.point(e);
        const handle = this.hit(e, ["landVertex"]);
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
        if (["paint", "hex", "reset"].includes(this.tool)) {
          if (this.brushPointCount() >= 1000) {
            this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
            return;
          }
          this.pointer = e.pointerId;
          if (this.points.length) this.brushStrokes.push(this.points);
          this.points = [this.lastPoint];
          svg.setPointerCapture(e.pointerId);
          this.host.redraw();
        }
      },
      true,
    );
    svg.addEventListener(
      "pointermove",
      (e) => {
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = this.point(e);
        this.lastPoint = p;
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
            html<HTMLInputElement>("land-record-width").value = String(
              this.selected.width,
            );
            html<HTMLInputElement>("land-angle").value = String(
              (this.selected.angle * 180) / Math.PI,
            );
          } else {
            const before = this.selected.points[this.vertex];
            this.lineDragChanged ||= !!before && (before.x !== p.x || before.y !== p.y);
            this.selected.points[this.vertex] = p;
          }
          if (this.vertex === 0) {
            html<HTMLInputElement>("land-x").value = String(p.x);
            html<HTMLInputElement>("land-y").value = String(p.y);
          }
          this.dirty = true;
        } else {
          const previous = this.points.at(-1), size = hexSize(Number(html<HTMLSelectElement>("atlas-hex-level").value));
          const a = previous && atlasHexAt(previous, size), b = atlasHexAt(p, size);
          const changed = !previous || (this.tool === "hex"
            ? a!.q !== b.q || a!.r !== b.r
            : Math.hypot(p.x - previous.x, p.y - previous.y) > Math.max(1, Number(html<HTMLInputElement>("land-radius").value) / 3));
          if (changed) {
            if (this.brushPointCount() < 1000) this.points.push(p);
            else this.say("Entwurf voll. Zuerst abschließen oder verwerfen.");
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
        const commitLine = this.dragging && this.lineDragChanged &&
          (this.selected?.kind === "road" || this.selected?.kind === "river");
        this.pointer = null;
        this.dragging = false;
        this.lineDragChanged = false;
        if (commitLine) void this.finish().catch(e => this.host.error(e));
        if (["paint", "hex", "reset"].includes(this.tool))
          void this.finish().catch(e=>this.host.error(e));
        if (svg.hasPointerCapture(e.pointerId))
          svg.releasePointerCapture(e.pointerId);
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener("pointercancel", () => {
      this.pointer = null;
      this.dragging = false;
      this.say("Zug unterbrochen. Abschließen oder verwerfen.");
    });
    svg.addEventListener(
      "click",
      (e) => {
        if (!this.active || this.saving || this.spacePan || e.altKey) return;
        if (this.tool === "select") {
          if (
            this.hit(e, ["landscapeId","landVertex"])
          )
            e.stopImmediatePropagation();
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        if (["paint", "hex", "reset"].includes(this.tool)) return;
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
        } else {this.points.push(p);this.say(this.points.length+" Punkte · Enter oder Zug abschließen übernimmt. Backspace entfernt den letzten Punkt.");}
        if (this.tool === "place")
          this.say('Ortspunkt gesetzt. Mit „Zug abschließen“ anlegen.');
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener("keydown", (e) => {
      if (!this.active) return;
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
    window.addEventListener("blur",()=>{this.spacePan=false;});
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
  hasDraft() {
    return (
      this.points.length > 0 ||
      this.dirty ||
      !!this.calibration ||
      this.pointer !== null ||
      this.saving
    );
  }
  cancel() {
    this.points = [];
    this.brushStrokes = [];
    this.measurement=[];
    this.dirty = false;
    this.pointer = null;
    this.calibration = null;
    this.dragging = false;
    this.selected = null;
    this.doc = null;
    html("land-selection").replaceChildren();
    this.say("Zug verworfen.");
    this.host.redraw();
  }
  private toolFields() {
    const brush = ["paint", "hex", "reset"].includes(this.tool),
      line = ["river", "road"].includes(this.tool);
    for (const [id, visible] of [
      ["land-field", brush],
      [
        "land-value",
        brush && html<HTMLSelectElement>("land-field").value !== "terrain",
      ],
      ["land-radius", ["paint", "reset"].includes(this.tool)],
      ["land-line-style", line],
      ["land-width", line],
      ["land-object", this.tool === "select"],
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
    this.cancel();
    this.records = [];this.background=null;
    this.raster = undefined;this.minimumRevision=0;
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
      const section = this.panel.querySelector<HTMLTextAreaElement>(
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
      if(!force&&this.key===frameKey&&this.publishedLayer===layer)return;this.key=frameKey;this.publishedLayer=layer;
      this.request++;const generation=this.request;
      this.records=layer.records;this.raster=layer.tiles;html('land-reload').hidden=layer.state==='ready';
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
    this.records=[];this.raster=undefined;this.background=null;this.publishedLayer=undefined;this.key="";this.objectOptions();
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
    for(const r of this.records)select.add(new Option(r.name||r.kind,r.id));select.value=this.selected?.id??'';
  }
  async selectId(id:string){
    const token=this.token,frame=this.host.data()?.region?.fence,generation=++this.selectionRequest;
    if(this.hasDraft()){this.say('Zuerst abschließen oder verwerfen.');return;}
    const response=await window.campaign.atlasLandscapeObject(token,id);
    if(token!==this.token||generation!==this.selectionRequest||frame!==this.host.data()?.region?.fence)return;
    if(!response.ok)throw new Error(response.error);this.tool="select";html<HTMLSelectElement>("land-tool").value=this.tool;this.toolFields();await this.select(response.value);
  }
  draw(root: AtlasPaint, box: LandscapeBox, mpp: number) {
    const landscapeNode=atlasPaint;
    const key=[this.records,this.raster,this.selected?.id,this.selected?.resolution,this.selected?.order,mpp,...[...this.assets].flat(),...this.unavailableAssets];
    let background=this.background;
    if(!background||background.key.length!==key.length||!background.key.every((v,i)=>v===key[i])){
      const node=atlasPaint('group',{retainGeometry:true});
      drawLandscape(node,this.selected?[...this.records.filter(r=>r.id!==this.selected!.id),this.selected]:this.records,box,mpp,this.assets,true,this.raster,this.unavailableAssets);
      this.background=background={key,node,box:{...box},selectedSlot:this.selected?node.children.findIndex(n=>n.data.landscapeId===this.selected!.id):-1};
    }
    const retained=atlasPaint('group',{matrix:[1,0,0,1,background.box.x-box.x,background.box.y-box.y],data:{atlasLandscapeBase:'true'}});
    let node=background.node;
    if(this.selected&&background.selectedSlot>=0){
      // Keep the original painter slot, especially for references below terrain.
      const selected=atlasPaint('group');drawLandscape(selected,[this.selected],background.box,mpp,this.assets,true,this.raster,this.unavailableAssets);
      node=atlasPaint('group',{retainGeometry:true});node.append(...background.node.children);
      node.children[background.selectedSlot]=selected.children.find(n=>n.data.landscapeId===this.selected!.id)!;
    }
    retained.append(node);root.append(retained);
    // An open draft owns its Hex size; the camera only chooses it between edits.
    const auto = html<HTMLInputElement>("land-auto-level").checked && !this.hasDraft(),
      level = auto
        ? Math.max(
            0,
            Math.min(
              8,
              Math.round(
                Math.log(Math.max(1, box.width / hexSize(0) / 12)) /
                  Math.log(3),
              ),
            ),
          )
        : Number(html<HTMLSelectElement>("atlas-hex-level").value);
    if (html<HTMLInputElement>("land-grid").checked)
      drawLandscapeGrid(root, box, level, mpp);
    const hud=landscapeNode("group", {hud:true});drawScale(hud,box,mpp);root.append(hud);
    if (auto)
      html<HTMLSelectElement>("atlas-hex-level").value = String(level);
    if (this.active && auto)
      this.sayIfIdle(
        `${3 * 3 ** level} Meilen Kante zu Kante · ${formatDistance(box.width)} sichtbar`,
      );
    const pts =
      this.calibration?.points ??
      (this.points.length ? this.points : this.measurement);
    if (pts.length && this.tool === "hex") {
      try {
        const polygons = hexStrokesPolygons([...this.brushStrokes, pts], hexSize(Number(html<HTMLSelectElement>("atlas-hex-level").value)));
        root.append(landscapeNode("polygons", {polygons: polygons.map(p => ({outer: p.outer.map(v => ({x:v.x-box.x,y:v.y-box.y})), holes: []})), pointer:false, opacity:0.6, style:{fill:"#d46e38",stroke:"#d46e38",lineWidth:mpp}, data:{editorOnly:"true",landHexDraft:"true"}}));
      } catch (error) { this.say((error as Error).message); }
    } else if (pts.length) {
      for (const path of (["paint", "reset"].includes(this.tool) ? [...this.brushStrokes, pts] : [pts])) {
      root.append(
        landscapeNode("polyline", {points: path.map(p=>({x:p.x-box.x,y:p.y-box.y})), opacity: 0.6, style: {fill: null, stroke: "#d46e38", lineWidth: ["paint", "reset"].includes(this.tool)
            ? Number(html<HTMLInputElement>("land-radius").value) * 2
            : mpp * 3, lineCap: "round", lineJoin: "round"}, data: {editorOnly: String("true")}}),
      );
      for (const p of path)
        root.append(
          landscapeNode("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 4, style: {fill: "#d46e38"}, data: {editorOnly: String("true")}}),
        );
      }
      if (this.tool === "measure") this.say(formatDistance(distance(pts)));
    }
    if (this.calibration)
      drawLandscape(root, [this.calibration.record], box, mpp, this.assets);
    if (this.selected && this.active && this.tool === "select")
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

  private sayIfIdle(s: string) {
    if (!this.hasDraft() && !this.selected && html("land-status").textContent!=="Gespeichert") this.say(s);
  }
  recovered() {
    this.cancel();
    this.disable(false);
  }
  private disable(value: boolean) {
    this.panel
      .querySelectorAll<
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLButtonElement
        | HTMLTextAreaElement
      >("input,select,button,textarea")
      .forEach((n) => (n.disabled = value));
  }
  private async commit(a: AtlasAction) {
    this.saving = true;
    this.disable(true);
    try {
      const r = await this.host.write(a);
      if (!r)
        throw new Error("Änderung nicht bestätigt. Entwurf bleibt erhalten.");
      this.points = [];
      this.brushStrokes = [];
      this.dirty = false;
      this.calibration = null;
      this.selected = null;
      this.doc = null;
      html("land-selection").replaceChildren();
      this.key = "";
      await this.load(true);
      this.say("Gespeichert");
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
          html<HTMLInputElement>("land-calibration-distance").value,
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
      this.say(formatDistance(distance(this.points)));
      this.measurement = this.points;
      this.points = [];
      this.host.redraw();
      return;
    }
    if (!this.points.length) return;
    const res = hexSize(
      Number(html<HTMLSelectElement>("atlas-hex-level").value),
    );
    if (["paint", "hex", "reset"].includes(this.tool)) {
      let polygons: Polygon[];
      if (this.tool === "hex") {
        polygons = hexStrokesPolygons([...this.brushStrokes, this.points], res);
      } else {
        const radius = Number(html<HTMLInputElement>("land-radius").value);
        if (!Number.isFinite(radius) || radius <= 0)
          throw new Error("Pinselradius prüfen.");
        polygons = [...this.brushStrokes, this.points].flatMap(points => strokePolygon(points, radius));
      }
      const field = html<HTMLSelectElement>("land-field")
        .value as LandscapeField;
      if (this.tool === "reset")
        return this.commit({
          kind: "landscape-reset",
          polygons,
          field,
          resolution: res,
        });
      const r = emptyRecord("patch"),
        raw = html<HTMLInputElement>("land-value").value;
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
      const r = emptyRecord(this.tool);
      r.points = this.points;
      r.width = Number(html<HTMLInputElement>("land-width").value);
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
    this.host.redraw();
  }
  private inspector() {
    const root = html("land-selection");
    root.replaceChildren();
    const r = this.selected;
    if (!r) return;
    const label = (title: string, id: string, value: string, type = "text") => {
      const l = document.createElement("label");
      l.textContent = title;
      const input = document.createElement("input");
      input.id = id;
      input.type = type;
      input.value = value;
      input.oninput = () => {
        this.dirty = true;
      };
      l.append(input);
      root.append(l);
      return input;
    };
    label("Name des ausgewählten Objekts", "land-name", r.name);
    label("X in m", "land-x", String(r.points[0]!?.x ?? 0), "number");
    label("Y in m", "land-y", String(r.points[0]!?.y ?? 0), "number");
    const button = (name: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.onclick = run;
      root.append(b);
    };
    if (r.kind === "river" || r.kind === "road") {
      label("Breite in m", "land-record-width", String(r.width), "number");
      button("Punkt nach markiertem Punkt einfügen", () => {
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
        const second = {
          ...structuredClone(r),
          id: crypto.randomUUID(),
          revision: 0,
          points: r.points.slice(this.vertex),
        };
        const first = { ...r, points: r.points.slice(0, this.vertex + 1) };
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
    button(
      "Auswahl speichern",
      () => void this.finish().catch((e) => this.host.error(e)),
    );
    button(
      "Aus Atlas entfernen",
      () =>
        void this.commit({
          kind: "landscape-remove",
          id: r.id,
          expectedRevision: r.revision,
        }).catch((e) => this.host.error(e)),
    );
    this.say(r.kind === "road" || r.kind === "river" ? "Punkte ziehen; beim Loslassen wird gespeichert. Rückgängig ist im Atlas verfügbar." : "Punkte ziehen; Änderungen anschließend speichern.");
  }
  private readInspector() {
    const r = this.selected;
    if (!r) return;
    r.name = html<HTMLInputElement>("land-name").value;
    const p = {
        x: Number(html<HTMLInputElement>("land-x").value),
        y: Number(html<HTMLInputElement>("land-y").value),
      },
      old = r.points[0]!;
    if (old) {
      const dx = p.x - old.x,
        dy = p.y - old.y;
      if (!r.locked || r.kind !== "reference")
        r.points = r.points.map((v) => ({ x: v.x + dx, y: v.y + dy }));
    }
    const width = document.getElementById(
      "land-record-width",
    ) as HTMLInputElement | null;
    if (width) r.width = Number(width.value);
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
          title: this.panel.querySelector<HTMLInputElement>(
            `[data-section-title="${s.id}"]`,
          )!.value,
          markdown: this.panel.querySelector<HTMLTextAreaElement>(
            `[data-section-body="${s.id}"]`,
          )!.value,
        })),
      };
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
    html<HTMLSelectElement>("land-tool").value = this.tool;
    this.say(
      "Zwei Bildpunkte und die echte Entfernung wählen, dann abschließen.",
    );
    this.host.redraw();
  }
}

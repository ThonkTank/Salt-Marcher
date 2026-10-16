import { pendingAtlasWrite } from "./campaign-atlas-author";
import polygonClipping from "polygon-clipping";
import type { CampaignAtlas, AtlasAction } from "./campaign-atlas-contracts";
import type { Point, Polygon } from "./contracts";
import {
  emptyRecord,
  HEX_METERS,
  hexSize,
  hexPolygon,
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
  landscapeNode,
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
  | "measure"
  | "export";
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
  records: LandscapeRecord[] = [];
  private raster: import("./landscape-raster").LandscapeRaster | undefined;
  exportBox: LandscapeBox | null = null;
  private token = "";
  private key = "";
  private request = 0;
  private active = false;
  private tool: Tool = "select";
  private points: Point[] = [];
  private pointer: number | null = null;
  private selected: LandscapeRecord | null = null;
  private vertex = 0;
  private dragging = false;
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
    private svg: SVGSVGElement,
    private host: {
      box: () => LandscapeBox;
      redraw: () => void;
      write: (a: AtlasAction) => Promise<unknown>;
      error: (e: unknown) => void;
      data: () => CampaignAtlas | null;
    },
  ) {
    this.panel.id = "atlas-landscape-tools";
    this.panel.hidden = true;
    this.panel.innerHTML = `<h3>Region vorbereiten</h3><label>Werkzeug<select id="land-tool"><option value="select">Auswählen / Verlauf korrigieren</option><option value="paint">Gelände / Küste malen</option><option value="hex">Hexfläche füllen</option><option value="reset">Eigenschaft zur Vorgabe zurücksetzen</option><option value="river">Fluss zeichnen</option><option value="road">Weg zeichnen</option><option value="place">Ort platzieren</option><option value="measure">Strecke messen</option><option value="export">Ausgabebereich wählen</option></select></label><label>Eigenschaft<select id="land-field"><option value="terrain">Gelände</option><option value="elevationM">Höhe</option><option value="climate">Klima</option></select></label><label id="land-value-field">Wert<input id="land-value" placeholder="Höhe in Metern" value="0"></label><label>Pinselradius in m<input id="land-radius" type="number" min="1" value="500"></label><label>Verlaufstil<select id="land-line-style"><option value="path">Pfad / Bach</option><option value="road">Straße / Fluss</option></select></label><label>Verlaufbreite in m<input id="land-width" type="number" min="0.1" step="any" value="30"></label><label><input id="land-auto-level" type="checkbox" checked> Hexstufe automatisch anzeigen</label><label><input id="land-grid" type="checkbox" checked> Hexraster anzeigen</label><p id="land-status" role="status">3 Meilen von Kante zu Kante. Orts-/Verlaufpunkte anklicken, dann abschließen.</p><div class="toolbar"><button id="land-finish">Zug abschließen</button><button id="land-cancel">Verwerfen</button><button id="land-reload" hidden>Ansicht erneut laden</button></div><label>Objekt auswählen<select id="land-object"><option value="">Auf der Karte auswählen</option></select></label><div id="land-selection"></div><details><summary>Nachzeichenvorlage</summary><button id="land-reference">Bild laden und kalibrieren</button><label>Abstand der Bildpunkte in m<input id="land-calibration-distance" type="number" min="0.1" value="10000"></label><p>Nach dem Laden zwei Punkte im Bild anklicken. Anschließend Lage und Drehung bearbeiten.</p></details>`;
    html("atlas-tool-fields").after(this.panel);
    html<HTMLSelectElement>("land-tool").onchange = () => {
      if (this.hasDraft()) {
        html<HTMLSelectElement>("land-tool").value = this.tool;
        this.say("Zuerst abschließen oder verwerfen.");
        return;
      }
      this.tool = html<HTMLSelectElement>("land-tool").value as Tool;
      this.toolFields();
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
      if (r) void this.select(r).catch((e) => this.host.error(e));
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
    html("land-field").onchange = property;
    property();
    html("land-finish").onclick = () =>
      void this.finish().catch((e) => this.host.error(e));
    html("land-cancel").onclick = () => this.cancel();
    html("land-reload").onclick = () => void this.load(this.host.box(), true);
    html("land-reference").onclick = () =>
      void this.importReference().catch((e) => this.host.error(e));
    html("land-grid").onchange = () => this.host.redraw();
    html("land-auto-level").onchange = () => this.host.redraw();
    svg.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || e.button !== 0 || e.altKey || this.saving) return;
        if (
          this.tool === "select" &&
          !(e.target as Element).closest(
            "[data-landscape-id],[data-land-vertex]",
          )
        )
          return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.lastPoint = this.point(e);
        const handle = (e.target as Element).closest<SVGElement>(
          "[data-land-vertex]",
        );
        if (handle && this.selected) {
          if (this.selected.kind === "reference" && this.selected.locked)
            return;
          this.vertex = Number(handle.dataset.landVertex);
          this.dragging = true;
          this.pointer = e.pointerId;
          svg.setPointerCapture(e.pointerId);
          return;
        }
        if (this.tool === "select") {
          const r = this.records.find(
            (r) =>
              r.id ===
              (e.target as Element).closest<SVGElement>("[data-landscape-id]")
                ?.dataset.landscapeId,
          );
          if (r) void this.select(r);
          return;
        }
        if (["paint", "hex", "reset"].includes(this.tool)) {
          this.pointer = e.pointerId;
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
          } else this.selected.points[this.vertex] = p;
          if (this.vertex === 0) {
            html<HTMLInputElement>("land-x").value = String(p.x);
            html<HTMLInputElement>("land-y").value = String(p.y);
          }
          this.dirty = true;
        } else if (
          !this.points.length ||
          Math.hypot(p.x - this.points.at(-1)!.x, p.y - this.points.at(-1)!.y) >
            Math.max(1, Number(html<HTMLInputElement>("land-radius").value) / 3)
        ) {
          if (this.points.length < 1000) this.points.push(p);
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
        this.pointer = null;
        this.dragging = false;
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
        if (!this.active || this.saving || e.altKey) return;
        if (this.tool === "select") {
          if (
            (e.target as Element).closest(
              "[data-landscape-id],[data-land-vertex]",
            )
          )
            e.stopImmediatePropagation();
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        if (["paint", "hex", "reset"].includes(this.tool)) return;
        const p = this.point(e);
        this.lastPoint = p;
        if (this.calibration) {
          this.calibration.points.push(p);
          this.say(
            "Bildpunkt " +
              this.calibration.points.length +
              " von 2. Danach abschließen.",
          );
        } else this.points.push(p);
        this.host.redraw();
      },
      true,
    );
    svg.addEventListener("keydown", (e) => {
      if (!this.active) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void this.finish().catch((e) => this.host.error(e));
      }
    });
  }
  private point(e: MouseEvent) {
    const b = this.host.box(),
      p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        this.svg.getScreenCTM()!.inverse(),
      );
    return { x: p.x + b.x, y: p.y + b.y };
  }
  private say(s: string) {
    html("land-status").textContent = s;
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
    this.exportBox=null;
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
  }
  setActive(active: boolean) {
    this.active = active;
    this.panel.hidden = !active;
    if (active) this.toolFields();
  }
  context(token: string) {
    if (this.token === token) return;
    this.token = token;
    this.cancel();
    this.records = [];
    this.raster = undefined;
    this.assets.clear();
    this.key = "";
    this.request++;
    this.exportBox = null;
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
  async load(box = this.host.box(), force = false) {
    const data = this.host.data();
    if (!data || !this.token) return;
    const key = JSON.stringify([this.token, data.revision, box]);
    if (!force && this.key === key) return;
    this.key = key;
    const n = ++this.request,
      token = this.token;
    const mpp=box.width/Math.max(1,this.svg.clientWidth);
    const r = await window.campaign.landscapeRegion(token, box,mpp,false);
    if (n !== this.request || token !== this.token) return;
    if (!r.ok) {
      this.records=[];this.raster=undefined;html("land-reload").hidden=false;
      this.say("Ansicht nicht verfügbar. Ansicht erneut laden.");
      this.host.error(new Error(r.error));
      this.host.redraw();
      return;
    }
    let raster: import("./landscape-raster").LandscapeRaster | undefined;
    {
      const aspect=box.width/box.height,width=Math.max(1,Math.round(512*Math.min(1,aspect))),height=Math.max(1,Math.round(512*Math.min(1,1/aspect)));
      const image=await window.campaign.landscapeRaster(token,box,width,height);
      if(n!==this.request||token!==this.token)return;
      if(!image.ok||image.value.revision!==r.value.revision){this.records=[];this.raster=undefined;html('land-reload').hidden=false;this.say('Übersicht nicht verfügbar. Ansicht erneut laden.');this.host.error(new Error(image.ok?'Atlasstand geändert. Übersicht erneut laden.':image.error));this.host.redraw();return;}
      raster=image.value;
    }
    this.records = r.value.records;
    this.raster = raster;
    html("land-reload").hidden = true;
    const select = html<HTMLSelectElement>("land-object");
    select.replaceChildren(new Option("Auf der Karte auswählen", ""));
    for (const record of this.records.filter((r) => r.kind !== "patch"))
      select.add(
        new Option(
          record.name ||
            (
              {
                reference: "Bildvorlage",
                river: "Fluss",
                road: "Weg",
                place: "Ort",
              } as Record<string, string>
            )[record.kind],
          record.id,
        ),
      );
    select.value = this.selected?.id ?? "";
    const visibleAssets=new Set(this.records.filter(r=>r.kind==='reference'&&r.visible!==false).map(r=>r.assetId));for(const id of this.assets.keys())if(!visibleAssets.has(id)&&id!==this.calibration?.record.assetId)this.assets.delete(id);
    for (const record of this.records)
      if (record.visible!==false&&record.assetId && !this.assets.has(record.assetId)) {
        const a = await window.campaign.referenceAsset(token, record.assetId);
        if (token !== this.token || n !== this.request) return;
        if (a.ok) this.assets.set(record.assetId, a.value);
      }
    this.host.redraw();
  }
  draw(root: SVGElement, box: LandscapeBox, mpp: number) {
    void this.load().catch((e) => this.host.error(e));
    const records = this.selected
      ? this.records.map((r) =>
          r.id === this.selected!.id ? this.selected! : r,
        )
      : this.records;
    drawLandscape(root, records, box, mpp, this.assets,true,this.raster);
    const auto = html<HTMLInputElement>("land-auto-level").checked,
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
    drawScale(root, box, mpp);
    if (auto && !this.hasDraft())
      html<HTMLSelectElement>("atlas-hex-level").value = String(level);
    if (this.active && auto)
      this.sayIfIdle(
        `${3 * 3 ** level} Meilen Kante zu Kante · ${formatDistance(box.width)} sichtbar`,
      );
    const pts =
      this.calibration?.points ??
      (this.points.length ? this.points : this.measurement);
    if (pts.length) {
      root.append(
        landscapeNode("polyline", {
          points: pts.map((p) => `${p.x - box.x},${p.y - box.y}`).join(" "),
          fill: "none",
          stroke: "#d46e38",
          "stroke-width": ["paint", "reset"].includes(this.tool)
            ? Number(html<HTMLInputElement>("land-radius").value) * 2
            : mpp * 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          opacity: 0.6,
          "data-editor-only": "true",
        }),
      );
      for (const p of pts)
        root.append(
          landscapeNode("circle", {
            cx: p.x - box.x,
            cy: p.y - box.y,
            r: mpp * 4,
            fill: "#d46e38",
            "data-editor-only": "true",
          }),
        );
      if (this.tool === "measure") this.say(formatDistance(distance(pts)));
    }
    if (this.calibration)
      drawLandscape(root, [this.calibration.record], box, mpp, this.assets);
    if (this.selected && this.active && this.tool === "select")
      this.selected.points.forEach((p, i) =>
        root.append(
          landscapeNode("circle", {
            cx: p.x - box.x,
            cy: p.y - box.y,
            r: mpp * 6,
            fill: i === this.vertex ? "#e1984b" : "#fff",
            stroke: "#a55d35",
            "stroke-width": mpp * 2,
            "data-land-vertex": i,
            "data-editor-only": "true",
          }),
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
        landscapeNode("circle", {
          cx: o.x + w * Math.cos(a) - h * Math.sin(a) - box.x,
          cy: o.y + w * Math.sin(a) + h * Math.cos(a) - box.y,
          r: mpp * 7,
          fill: "#e1984b",
          "data-land-vertex": -1,
          "data-editor-only": "true",
        }),
      );
    }
    if (this.exportBox) {
      const b = this.exportBox;
      root.append(
        landscapeNode("rect", {
          x: b.x - box.x,
          y: b.y - box.y,
          width: b.width,
          height: b.height,
          fill: "none",
          stroke: "#b05d32",
          "stroke-width": mpp * 2,
          "stroke-dasharray": `${mpp * 8} ${mpp * 5}`,
          "data-editor-only": "true",
        }),
      );
    }
  }
  private sayIfIdle(s: string) {
    if (!this.hasDraft() && !this.selected) this.say(s);
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
      this.dirty = false;
      this.calibration = null;
      this.selected = null;
      this.doc = null;
      html("land-selection").replaceChildren();
      this.key = "";
      await this.load(this.host.box(), true);
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
    if (this.tool === "export") {
      if (this.points.length !== 2)
        throw new Error("Zwei gegenüberliegende Ecken wählen.");
      const [a, b] = this.points as [Point, Point];
      this.exportBox = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x),
        height: Math.abs(a.y - b.y),
      };
      if (!this.exportBox.width || !this.exportBox.height)
        throw new Error("Ausgabebereich braucht Fläche.");
      this.points = [];
      this.say("Ausgabebereich gewählt. Unten „Atlas ausgeben“ öffnen.");
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
        const unique = new Map<string, Polygon>();
        for (const p of this.points) {
          const h = atlasHexAt(p, res);
          unique.set(h.q + "," + h.r, hexPolygon(h.q, h.r, res));
        }
        polygons = [...unique.values()];
      } else {
        const radius = Number(html<HTMLInputElement>("land-radius").value);
        if (!Number.isFinite(radius) || radius <= 0)
          throw new Error("Pinselradius prüfen.");
        polygons = strokePolygon(this.points, radius);
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
    const token = this.token;
    if (record.locationId) {
      const r = await window.campaign.preparation(token, "");
      if (token !== this.token || this.selected?.id !== record.id) return;
      if (!r.ok) throw new Error(r.error);
      const row = r.value.locations.find(
        (l) => l.document.id === record.locationId,
      );
      if (row) {
        this.doc = structuredClone(row.document);
        this.docRevision = row.revision;
      }
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
    label("Name", "land-name", r.name);
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
    this.say("Punkte ziehen; Änderungen anschließend speichern.");
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
    const a = result.value,
      b = this.host.box(),
      r = emptyRecord("reference");
    this.assets.set(a.id, a.data);
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

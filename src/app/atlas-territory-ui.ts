import type {
  AtlasAction,
  AtlasRenderView,
  AtlasObjectPage,
} from "./campaign-atlas-contracts";
import type { Point } from "./contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import {
  newTerritory,
  layerRecord,
  defaultRegionLayers,
  territoryPresets,
  territoryStroke,
  combineTerritory,
  territoryContains,
  territoryBox,
  validateTerritory,
  type AtlasRegionLayer,
} from "./atlas-territory";
import { atlasPaint, type AtlasPaint } from "./atlas-paint";
import { drawTerritories } from "./atlas-territory-view";
type Host = {
  token: () => string | undefined;
  point: (e: MouseEvent) => Point;
  box: () => LandscapeBox;
  data: () => AtlasRenderView | null;
  write: (a: AtlasAction) => Promise<unknown>;
  redraw: () => void;
  error: (e: unknown) => void;
  focus: (b: LandscapeBox) => void;
  current: () => boolean;
};
export class TerritoryWorkbench {
  readonly panel = document.createElement("section");
  private enabled = false;
  private generation = 0;
  private campaignToken = "";
  private busy = false;
  private layers: AtlasRegionLayer[] = [...defaultRegionLayers];
  private items: AtlasObjectPage["items"] = [];
  private selected: LandscapeRecord | null = null;
  private dirty = false;
  private drag: {
    id: number;
    points: Point[];
    before: LandscapeRecord;
    wasDirty: boolean;
    moved?: boolean;
    vertex?: [number, number, number];
    label?: boolean;
  } | null = null;
  private vertex: [number, number, number] | null = null;
  constructor(
    private canvas: HTMLCanvasElement,
    private host: Host,
  ) {
    this.panel.id = "atlas-territory-tools";
    this.panel.hidden = true;
    this.panel.innerHTML = `<h3>Regionen</h3><label>Ebene<select id="territory-layer"></select></label><div id="territory-layers"></div><button id="territory-layer-add">Eigene Ebene</button><label>Regionssuche<input id="territory-search" type="search"></label><div id="territory-list" role="list" aria-label="Regionen"></div><button id="territory-new">Neue Region</button><label>Name<input id="territory-name"></label><label>Übergeordnetes Gebiet<select id="territory-parent"></select></label><label>Preset<select id="territory-preset">${territoryPresets.map(([n, v]) => `<option value="${v}">${n}</option>`).join("")}</select></label><label>Prominenz<input id="territory-prominence" type="number" min="0" max="100" value="40"></label><label>Werkzeug<select id="territory-mode"><option value="select">Auswahl</option><option value="add">Gebiet malen</option><option value="erase">Gebiet radieren</option><option value="points">Grenzpunkte</option><option value="label">Name verschieben</option></select></label><label>Pinselradius in m<input id="territory-radius" type="number" min="0.1" value="50" step="any"></label><label>Farbe<input id="territory-color" type="color" value="#806040"></label><label>Flächentönung<input id="territory-opacity" type="number" min="0" max="1" step="0.05" value="0.12"></label><label><input id="territory-border" type="checkbox" checked>Grenze anzeigen</label><label>Schriftgröße<input id="territory-size" type="number" min="8" max="96" value="16"></label><label>Drehung in Grad<input id="territory-angle" type="number" min="-180" max="180" value="0"></label><button id="territory-label-auto">Name automatisch platzieren</button><label>Ortsinformationen<textarea id="territory-notes" rows="4"></textarea></label><button id="territory-save">Änderungen speichern</button><button id="territory-cancel">Änderungen verwerfen</button><button id="territory-delete">Region löschen</button><p id="territory-status" role="status">Region wählen oder neu anlegen. Ein Pinselzug wird beim Loslassen gespeichert.</p>`;
    this.on("territory-new", () => {
      if (this.hasDraft())
        throw Error("Änderungen zuerst speichern oder verwerfen.");
      this.generation++;
      this.selected = newTerritory(
        crypto.randomUUID(),
        this.value("territory-layer"),
      );
      this.form();
      this.input<HTMLSelectElement>("territory-mode").value = "add";
      this.dirty = true;
      this.host.redraw();
    });
    this.on("territory-save", () => this.commit());
    this.on("territory-cancel", async () => {
      this.drag = null;
      this.dirty = false;
      if (this.selected?.revision) await this.select(this.selected.id);
      else {
        this.selected = null;
        this.host.redraw();
      }
    });
    this.on("territory-delete", async () => {
      if (!this.selected?.revision) return;
      if (
        !(await this.host.write({
          kind: "landscape-territory-delete",
          id: this.selected.id,
          expectedRevision: this.selected.revision,
        }))
      )
        throw Error("Region nicht gelöscht. Bitte erneut versuchen.");
      this.selected = null;
      this.dirty = false;
      await this.load();
    });
    this.on("territory-label-auto", () => {
      if (this.selected) {
        this.readForm();
        this.selected.territory!.label.position = null;
        this.dirty = true;
        this.host.redraw();
      }
    });
    this.on("territory-layer-add", async () => {
      const l = {
        id: crypto.randomUUID(),
        name: "Eigene Ebene",
        order: this.layers.length,
        visible: true,
      };
      if (
        !(await this.host.write({
          kind: "landscape-region-layer",
          record: layerRecord(l),
          expectedRevision: null,
        }))
      )
        throw Error("Ebene nicht gespeichert. Bitte erneut versuchen.");
      await this.load();
      this.input<HTMLSelectElement>("territory-layer").value = l.id;
    });
    this.input("territory-search").oninput = () => this.list();
    this.input("territory-mode").onchange = () => this.host.redraw();
    this.input("territory-preset").onchange = () => {
      this.input<HTMLInputElement>("territory-prominence").value =
        this.value("territory-preset");
      this.changed();
    };
    for (const id of [
      "name",
      "prominence",
      "parent",
      "color",
      "opacity",
      "border",
      "size",
      "angle",
      "notes",
    ])
      this.input("territory-" + id).oninput = () => this.changed();
    this.input("territory-layer").onchange = () => {
      this.parents();
      this.changed();
    };
    const run = (f: () => Promise<unknown> | unknown) => {
      void Promise.resolve()
        .then(f)
        .catch((e) => this.host.error(e));
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (
        !this.enabled ||
        e.button ||
        e.altKey ||
        this.busy ||
        !this.host.current() ||
        document.getElementById("campaign-atlas")?.dataset.panMode === "true"
      )
        return;
      const mode = this.value("territory-mode"),
        p = host.point(e);
      if (mode === "select") {
        const hits = (host.data()?.region?.landscape?.territories ?? [])
          .filter((r) => territoryContains(r, p))
          .sort((a, b) => a.territory!.prominence - b.territory!.prominence);
        if (hits[0]) run(() => this.select(hits[0]!.id));
        return;
      }
      if (!this.selected) return;
      try {
        this.readForm();
        const before = structuredClone(this.selected);
        this.drag = {
          id: e.pointerId,
          points: [p],
          before,
          wasDirty: this.dirty,
        };
        if (mode === "points") {
          const v = this.nearest(p);
          if (!v) {
            this.drag = null;
            return;
          }
          this.vertex = v;
          this.drag.vertex = v;
        }
        if (mode === "label") this.drag.label = true;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        canvas.focus();
        if (!this.drag.vertex) this.preview(p);
      } catch (error) {
        this.drag = null;
        host.error(error);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.drag?.id !== e.pointerId) return;
      try {
        this.preview(host.point(e));
      } catch (error) {
        host.error(error);
      }
    });
    canvas.addEventListener("pointerup", (e) => {
      if (this.drag?.id !== e.pointerId) return;
      const d = this.drag;
      this.drag = null;
      if (!d.vertex || d.moved) run(() => this.commit());
    });
    canvas.addEventListener("pointercancel", () => this.cancelStroke());
    canvas.addEventListener("lostpointercapture", () => this.cancelStroke());
    canvas.addEventListener("keydown", (e) => {
      if (!this.enabled || this.busy || e.defaultPrevented) return;
      if (e.key === "Escape") {
        this.cancelStroke();
        e.preventDefault();
      } else if (
        e.key === "Delete" &&
        this.value("territory-mode") === "points" &&
        this.vertex &&
        this.selected
      ) {
        const ring = this.ring(this.selected, this.vertex);
        if (ring.length <= 3) return;
        ring.splice(this.vertex[2], 1);
        this.vertex = null;
        this.dirty = true;
        host.redraw();
        e.preventDefault();
        run(() => this.commit());
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      if (
        !this.enabled ||
        this.value("territory-mode") !== "points" ||
        !this.selected ||
        this.busy
      )
        return;
      const p = host.point(e),
        v = this.nearest(p, true);
      if (!v) return;
      this.ring(this.selected, v).splice(v[2] + 1, 0, p);
      this.vertex = [v[0], v[1], v[2] + 1];
      this.dirty = true;
      this.status("Neuen Grenzpunkt ziehen oder Änderungen speichern.");
      host.redraw();
    });
  }
  private input<T extends HTMLElement = HTMLInputElement>(id: string) {
    return this.panel.querySelector("#" + id) as T;
  }
  private value(id: string) {
    return this.input<HTMLInputElement>(id).value;
  }
  private on(id: string, f: () => unknown) {
    this.input(id).onclick = () =>
      void Promise.resolve()
        .then(f)
        .catch((e) => this.host.error(e));
  }
  private status(s: string) {
    this.input("territory-status").textContent = s;
  }
  get active() {
    return this.enabled;
  }
  get dragging() {
    return !!this.drag;
  }
  hasDraft() {
    return this.dirty || !!this.drag;
  }
  setActive(v: boolean) {
    this.enabled = v;
    this.panel.hidden = !v;
    if (v) void this.load().catch(this.host.error);
  }
  context(token: string) {
    if (token === this.campaignToken) return;
    this.campaignToken = token;
    this.generation++;
    this.selected = null;
    this.dirty = false;
    this.drag = null;
    this.items = [];
  }
  async load() {
    const token = this.host.token();
    if (!token) return;
    const generation = ++this.generation,
      overview = await window.campaign.atlasOverview(token);
    if (generation !== this.generation || token !== this.host.token()) return;
    if (!overview.ok) throw Error(overview.error);
    this.layers = overview.value.regionLayers ?? [...defaultRegionLayers];
    const items: AtlasObjectPage["items"] = [];
    let cursor: AtlasObjectPage["next"] = null;
    do {
      const r = await window.campaign.atlasObjects(token, {
        kind: "territory",
        text: "",
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      if (generation !== this.generation || token !== this.host.token()) return;
      if (!r.ok) throw Error(r.error);
      items.push(...r.value.items);
      cursor = r.value.next;
    } while (cursor);
    this.items = items;
    this.layerControls();
    this.parents();
    this.list();
    if (this.selected && !this.dirty && !this.drag) {
      const r = await window.campaign.atlasLandscapeObject(
        token,
        this.selected.id,
      );
      if (generation !== this.generation || token !== this.host.token()) return;
      if (this.dirty || this.drag) return;
      if (r.ok) {
        this.selected = r.value;
        this.form();
      } else {
        this.selected = null;
        this.host.redraw();
      }
    }
    this.host.redraw();
  }
  private layerControls() {
    const select = this.input<HTMLSelectElement>("territory-layer"),
      old = this.selected?.territory?.layerId ?? select.value;
    select.replaceChildren(...this.layers.map((l) => new Option(l.name, l.id)));
    select.value = old || "political";
    const root = this.input("territory-layers");
    root.replaceChildren();
    for (const layer of this.layers) {
      const row = document.createElement("div"),
        check = document.createElement("input"),
        name = document.createElement("input"),
        up = document.createElement("button");
      check.type = "checkbox";
      check.checked = layer.visible;
      check.setAttribute("aria-label", layer.name + " anzeigen");
      name.value = layer.name;
      name.setAttribute("aria-label", "Ebenenname");
      up.textContent = "↑";
      up.setAttribute("aria-label", layer.name + " nach oben");
      const save = async (next: AtlasRegionLayer) => {
        if (this.hasDraft())
          throw Error("Region zuerst speichern oder verwerfen.");
        const token = this.host.token()!,
          old = await window.campaign.atlasLandscapeObject(
            token,
            "region-layer:" + layer.id,
          );
        if (
          !(await this.host.write({
            kind: "landscape-region-layer",
            record: layerRecord(next),
            expectedRevision: old.ok ? old.value.revision : null,
          }))
        )
          throw Error("Ebene nicht gespeichert. Bitte erneut versuchen.");
        await this.load();
      };
      check.onchange = () =>
        void save({ ...layer, visible: check.checked }).catch(this.host.error);
      name.onchange = () =>
        void save({ ...layer, name: name.value }).catch(this.host.error);
      up.onclick = () =>
        void save({
          ...layer,
          order: Math.min(...this.layers.map((l) => l.order)) - 1,
        }).catch(this.host.error);
      row.append(check, name, up);
      root.append(row);
    }
  }
  private parents() {
    const select = this.input<HTMLSelectElement>("territory-parent"),
      old = this.selected?.territory?.parentId ?? select.value;
    const layer = this.value("territory-layer"),
      descendants = new Set<string>(this.selected ? [this.selected.id] : []);
    let change = true;
    while (change) {
      change = false;
      for (const r of this.items)
        if (
          r.parentId &&
          descendants.has(r.parentId) &&
          !descendants.has(r.id)
        ) {
          descendants.add(r.id);
          change = true;
        }
    }
    select.replaceChildren(
      new Option("Kein übergeordnetes Gebiet", ""),
      ...this.items
        .filter((r) => r.layerId === layer && !descendants.has(r.id))
        .map((r) => new Option(r.name, r.id)),
    );
    select.value = old ?? "";
  }
  private list() {
    const root = this.input("territory-list"),
      text = this.value("territory-search").toLocaleLowerCase();
    root.replaceChildren();
    const visit = (r: AtlasObjectPage["items"][number], depth: number) => {
      if (!text || r.name.toLocaleLowerCase().includes(text)) {
        const b = document.createElement("button");
        b.textContent = r.name;
        b.style.paddingLeft = 8 + Math.min(depth, 12) * 12 + "px";
        b.setAttribute("role", "listitem");
        b.onclick = () => void this.select(r.id, true).catch(this.host.error);
        root.append(b);
      }
      for (const child of this.items
        .filter((c) => c.parentId === r.id)
        .sort((a, b) => a.name.localeCompare(b.name)))
        visit(child, depth + 1);
    };
    for (const layer of this.layers) {
      const items = this.items.filter((r) => r.layerId === layer.id);
      if (!items.length) continue;
      const heading = document.createElement("strong");
      heading.textContent = layer.name;
      root.append(heading);
      for (const r of items
        .filter((r) => !r.parentId || !items.some((p) => p.id === r.parentId))
        .sort((a, b) => a.name.localeCompare(b.name)))
        visit(r, 0);
    }
  }
  async recovered() {
    this.drag = null;
    this.dirty = false;
    await this.load();
    this.host.redraw();
  }
  async select(id: string, focus = false) {
    if (this.hasDraft())
      throw Error("Änderungen zuerst speichern oder verwerfen.");
    const generation = ++this.generation,
      token = this.host.token()!,
      r = await window.campaign.atlasLandscapeObject(token, id);
    if (
      generation !== this.generation ||
      token !== this.host.token() ||
      this.hasDraft()
    )
      return;
    if (!r.ok) throw Error(r.error);
    if (r.value.kind !== "territory") return;
    this.selected = r.value;
    this.dirty = false;
    this.vertex = null;
    this.form();
    this.input<HTMLSelectElement>("territory-mode").value = "select";
    if (focus && r.value.polygons.length)
      this.host.focus(territoryBox(r.value));
    this.host.redraw();
  }
  private form() {
    if (!this.selected) return;
    const r = this.selected,
      t = r.territory!;
    for (const [id, v] of Object.entries({
      name: r.name,
      prominence: t.prominence,
      color: t.color,
      opacity: t.fillOpacity,
      size: t.label.size,
      angle: t.label.angle,
      notes: t.notes,
      layer: t.layerId,
    }))
      this.input<HTMLInputElement>("territory-" + id).value = String(v);
    this.input<HTMLSelectElement>("territory-preset").value = String(
      t.prominence,
    );
    this.input<HTMLInputElement>("territory-border").checked = t.border;
    this.parents();
    this.status(
      r.polygons.length
        ? "Grenze und Beschriftung gehören zu dieser Region."
        : "Noch ohne Fläche – mit dem Pinsel einzeichnen.",
    );
  }
  private readForm() {
    if (!this.selected) return;
    const t = this.selected.territory!;
    this.selected.name = this.value("territory-name");
    Object.assign(t, {
      layerId: this.value("territory-layer"),
      parentId: this.value("territory-parent") || null,
      prominence: Number(this.value("territory-prominence")),
      color: this.value("territory-color"),
      fillOpacity: Number(this.value("territory-opacity")),
      border: this.input<HTMLInputElement>("territory-border").checked,
      notes:
        this.value("territory-notes") === t.notes.replace(/\r\n?/g, "\n")
          ? t.notes
          : this.value("territory-notes"),
    });
    t.label.size = Number(this.value("territory-size"));
    t.label.angle = Number(this.value("territory-angle"));
    validateTerritory(this.selected);
  }
  private changed() {
    if (!this.selected || this.busy) return;
    this.dirty = true;
    try {
      this.readForm();
      this.host.redraw();
    } catch {
      /* incomplete form is checked when committed */
    }
  }
  private ring(r: LandscapeRecord, v: [number, number, number]) {
    const p = r.polygons[v[0]]!;
    return v[1] === -1 ? p.outer : p.holes[v[1]]!;
  }
  private nearest(p: Point, edge = false): [number, number, number] | null {
    let best: [number, number, number] | null = null,
      distance =
        (this.host.box().width / Math.max(1, this.canvas.clientWidth)) * 12;
    this.selected?.polygons.forEach((poly, i) =>
      [poly.outer, ...poly.holes].forEach((ring, j) =>
        ring.forEach((v, k) => {
          const b = ring[(k + 1) % ring.length]!,
            dx = b.x - v.x,
            dy = b.y - v.y,
            t = edge
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    ((p.x - v.x) * dx + (p.y - v.y) * dy) /
                      (dx * dx + dy * dy || 1),
                  ),
                )
              : 0,
            d = Math.hypot(p.x - v.x - dx * t, p.y - v.y - dy * t);
          if (d < distance) {
            distance = d;
            best = [i, j - 1, k];
          }
        }),
      ),
    );
    return best;
  }
  private preview(p: Point) {
    const d = this.drag;
    if (!d || !this.selected) return;
    if (d.vertex) {
      this.ring(this.selected, d.vertex)[d.vertex[2]] = p;
      d.moved = true;
    } else if (d.label) this.selected.territory!.label.position = p;
    else {
      if (d.points.length >= 4000) throw Error("Pinselzug abschließen.");
      const radius = Number(this.value("territory-radius"));
      if (
        d.points.length === 1 ||
        Math.hypot(p.x - d.points.at(-1)!.x, p.y - d.points.at(-1)!.y) >
          radius / 4
      )
        d.points.push(p);
      this.selected.polygons = combineTerritory(
        d.before.polygons,
        territoryStroke(d.points, radius),
        this.value("territory-mode") === "erase" ? "erase" : "add",
      );
    }
    this.dirty = true;
    this.host.redraw();
  }
  private cancelStroke() {
    if (this.drag) {
      this.selected = this.drag.before;
      this.dirty = this.drag.wasDirty;
      this.drag = null;
      this.host.redraw();
    }
  }
  private async commit() {
    if (!this.selected || this.busy) return;
    this.readForm();
    const record = structuredClone(this.selected),
      token = this.host.token();
    this.busy = true;
    this.panel.inert = true;
    this.status("Region wird gespeichert …");
    let confirmed = false;
    try {
      const result = await this.host.write({
        kind: "landscape-territory",
        record,
        expectedRevision: record.revision || null,
      });
      if (!result)
        throw Error("Region nicht gespeichert. Entwurf bleibt erhalten.");
      if (token !== this.host.token()) return;
      confirmed = true;
      this.vertex = null;
      this.dirty = false;
      await this.load();
      this.status("Region gespeichert.");
      this.host.redraw();
    } catch (error) {
      this.status(
        confirmed
          ? "Region gespeichert. Ansicht erneut laden."
          : "Nicht gespeichert. Entwurf bleibt zum Wiederholen erhalten.",
      );
      throw error;
    } finally {
      this.busy = false;
      this.panel.inert = false;
    }
  }
  draw(root: AtlasPaint, box: LandscapeBox, mpp: number) {
    const layer = this.host.data()?.region?.landscape,
      records = (layer?.territories ?? []).filter(
        (r) => !this.enabled || r.id !== this.selected?.id,
      );
    if (this.selected && this.enabled) records.push(this.selected);
    drawTerritories(
      root,
      records,
      box,
      mpp,
      layer?.regionLayers ?? this.layers,
      this.enabled ? this.selected?.id : undefined,
    );
    if (
      this.enabled &&
      this.selected &&
      this.layers.some(
        (l) => l.id === this.selected!.territory!.layerId && l.visible,
      ) &&
      this.value("territory-mode") === "points"
    )
      for (const p of this.selected.polygons)
        for (const ring of [p.outer, ...p.holes])
          for (const v of ring)
            root.append(
              atlasPaint("circle", {
                x: v.x - box.x,
                y: v.y - box.y,
                radius: 4 * mpp,
                pointer: false,
                style: { fill: "#fff", stroke: "#265f67", lineWidth: mpp },
                data: { editorOnly: "true" },
              }),
            );
  }
}

import type { AtlasAction, AtlasRenderView } from './campaign-atlas-contracts';
import type { Point } from './contracts';
import { contains, type LandscapeBox } from './atlas-landscape';
import { atlasPaint, type AtlasPaint } from './atlas-paint';
import {
  defaultTerritoryLayers,
  territoryStroke,
  territoryVertex,
  territoryBounds,
  type AtlasTerritory,
  type TerritoryState,
  type TerritoryAction,
} from './atlas-territories';
const el = <T extends HTMLElement>(root: ParentNode, id: string) =>
  root.querySelector<T>('#' + id)!;
const propertyFields = {
  region: [
    'territory-name',
    'territory-type',
    'territory-rank',
    'territory-parent',
    'territory-location',
    'territory-color',
    'territory-opacity',
    'territory-border',
  ],
  layer: ['territory-visible', 'territory-layer-name', 'territory-layer-order', 'territory-types'],
} as const;
type PropertyOwner = keyof typeof propertyFields;
export class TerritoryWorkbench {
  readonly panel = document.createElement('section');
  private state: TerritoryState = {
    layers: defaultTerritoryLayers(),
    territories: [],
  };
  private selected = '';
  private layer = 'politics';
  private token = '';
  private revision = -1;
  private loading = false;
  private generation = 0;
  private points: Point[] = [];
  private pointer: number | null = null;
  private pending: TerritoryAction | null = null;
  private preview: AtlasTerritory[] = [];
  private conflict = '';
  private saving = false;
  private dirty = new Set<PropertyOwner>();
  private spacePan = false;
  private cursor: Point | null = null;
  private vertex: { polygon: number; ring: number; vertex: number } | null = null;
  constructor(
    canvas: HTMLCanvasElement,
    private host: {
      data: () => AtlasRenderView | null;
      enabled: () => boolean;
      point: (e: MouseEvent) => Point;
      box: () => LandscapeBox;
      current: () => boolean;
      write: (action: AtlasAction) => Promise<unknown>;
      redraw: () => void;
      focus: (box: LandscapeBox) => void;
      error: (e: unknown) => void;
    },
  ) {
    this.panel.id = 'atlas-territory-tools';
    this.panel.hidden = true;
    this.panel.innerHTML = `<label>Ebene<select id="territory-layer"></select></label><label>Region<select id="territory-region"></select></label><div class="toolbar"><button id="territory-new">Region anlegen</button><button id="territory-focus">Region einpassen</button></div><label>Wirkung<select id="territory-operation"><option value="add">Auftragen</option><option value="erase">Abtragen</option><option value="vertices">Grenze verfeinern</option><option value="label">Beschriftung platzieren</option></select></label><label>Pinselradius in m<input id="territory-radius" type="number" min="0.1" max="100000000" value="500" step="any"></label><div class="toolbar"><button id="territory-retry" hidden>Erneut speichern</button><button id="territory-cancel" hidden>Verwerfen</button></div><p id="territory-status" role="status">Region wählen und Fläche malen.</p><details><summary>Region und Beschriftung</summary><label>Name<input id="territory-name" maxlength="1000"></label><label>Typ<select id="territory-type"></select></label><label>Bedeutung<select id="territory-rank">${['Detail', 'Stadtteil', 'Ort', 'Stadt / Landschaft', 'Großregion', 'Welt'].map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select></label><label>Gehört zu<select id="territory-parent"></select></label><label>Ortskennung (optional)<input id="territory-location"></label><label>Farbe<input id="territory-color" type="color" value="#b58445"></label><label>Füllung<input id="territory-opacity" type="range" min="0" max="0.6" step="0.05" value="0.15"></label><label>Grenze<select id="territory-border"><option value="solid">Durchgezogen</option><option value="dashed">Gestrichelt</option></select></label><button id="territory-save">Eigenschaften übernehmen</button><button id="territory-label-auto">Beschriftung automatisch</button><button id="territory-delete">Region entfernen</button><button id="territory-vertex-delete">Gewählten Grenzpunkt entfernen</button></details><details><summary>Ebenen und Typen</summary><label><input id="territory-visible" type="checkbox" checked> Ebene anzeigen</label><label>Ebenenname<input id="territory-layer-name"></label><label>Reihenfolge<input id="territory-layer-order" type="number" value="0"></label><label>Typen: Name = Rang (0–5), eine Zeile je Typ<textarea id="territory-types"></textarea></label><button id="territory-layer-save">Ebene übernehmen</button><button id="territory-layer-new">Eigene Ebene anlegen</button></details>`;
    const run = (f: () => Promise<unknown> | void) => () => {
      try {
        void Promise.resolve(f()).catch((e) => this.host.error(e));
      } catch (e) {
        this.host.error(e);
      }
    };
    el<HTMLSelectElement>(this.panel, 'territory-layer').onchange = () => {
      if (this.hasDraft()) return this.restoreChoice();
      this.layer = this.value('territory-layer');
      this.selected = '';
      this.controls();
    };
    el<HTMLSelectElement>(this.panel, 'territory-region').onchange = () => {
      if (this.hasDraft()) return this.restoreChoice();
      this.selected = this.value('territory-region');
      this.vertex = null;
      this.controls();
      this.host.redraw();
    };
    el(this.panel, 'territory-focus').onclick = () => {
      const t = this.chosen();
      if (t?.polygons.length) this.host.focus(territoryBounds(t.polygons));
    };
    el(this.panel, 'territory-new').onclick = run(async () => {
      if (this.pending || this.pointer !== null || this.saving)
        throw Error('Zug zuerst abschließen.');
      if (this.selected && this.dirty.has('region'))
        throw Error('Regionseigenschaften zuerst übernehmen oder verwerfen.');
      const name =
          (this.dirty.has('region') ? this.value('territory-name').trim() : '') || 'Neue Region',
        type = this.state.layers.find((l) => l.id === this.layer)!.types[0]!;
      const t: AtlasTerritory = {
        id: crypto.randomUUID(),
        revision: 0,
        name,
        layerId: this.layer,
        parentId: this.value('territory-parent') || null,
        typeId: type.id,
        rank: type.rank,
        polygons: [],
        color: '#b58445',
        opacity: 0.15,
        border: 'solid',
      };
      this.selected = t.id;
      await this.commit({
        kind: 'territory-put',
        territory: t,
        expectedRevision: null,
      });
    });
    el(this.panel, 'territory-save').onclick = run(() => {
      const old = this.chosen();
      if (!old) throw Error('Region wählen.');
      const t = {
        ...old,
        name: old.locationId ? old.name : this.value('territory-name'),
        typeId: this.value('territory-type'),
        rank: Number(this.value('territory-rank')),
        parentId: this.value('territory-parent') || null,
        locationId: this.value('territory-location') || undefined,
        color: this.value('territory-color'),
        opacity: Number(this.value('territory-opacity')),
        border: this.value('territory-border') as AtlasTerritory['border'],
      };
      return this.commit({
        kind: 'territory-put',
        territory: t,
        expectedRevision: old.revision,
      });
    });
    el<HTMLSelectElement>(this.panel, 'territory-type').onchange = () => {
      el<HTMLInputElement>(this.panel, 'territory-rank').value = String(
        this.state.layers
          .find((l) => l.id === this.layer)
          ?.types.find((t) => t.id === this.value('territory-type'))?.rank ?? 2,
      );
    };
    el(this.panel, 'territory-delete').onclick = run(() => {
      if (this.hasDraft()) throw Error('Entwurf zuerst übernehmen oder verwerfen.');
      const t = this.chosen();
      if (t)
        return this.commit({
          kind: 'territory-remove',
          id: t.id,
          expectedRevision: t.revision,
        });
    });
    el(this.panel, 'territory-label-auto').onclick = run(() => {
      if (this.hasDraft()) throw Error('Entwurf zuerst übernehmen oder verwerfen.');
      const t = this.chosen();
      if (t)
        return this.commit({
          kind: 'territory-put',
          territory: { ...t, labelPoint: undefined },
          expectedRevision: t.revision,
        });
    });
    el(this.panel, 'territory-vertex-delete').onclick = run(() => {
      const t = this.chosen();
      if (t && this.vertex) {
        const action: TerritoryAction = {
          kind: 'territory-vertex',
          id: t.id,
          expectedRevision: t.revision,
          ...this.vertex,
          point: null,
        };
        try {
          territoryVertex(this.state, t.id, action);
        } catch (error) {
          this.say(error instanceof Error ? error.message : String(error));
          return;
        }
        return this.commit(action);
      }
    });
    el(this.panel, 'territory-layer-new').onclick = run(() => {
      if (this.dirty.has('region') || this.pending || this.pointer !== null || this.saving)
        throw Error('Regionsentwurf zuerst übernehmen oder verwerfen.');
      const id = crypto.randomUUID();
      this.layer = id;
      this.selected = '';
      return this.commit({
        kind: 'territory-layer',
        expectedRevision: null,
        layer: {
          id,
          revision: 0,
          name: this.value('territory-layer-name').trim() || 'Eigene Ebene',
          order: this.state.layers.length,
          visible: true,
          types: [{ id: 'area', name: 'Gebiet', rank: 3 }],
        },
      });
    });
    const saveLayer = () => {
      const l = this.state.layers.find((l) => l.id === this.layer)!;
      const used = new Set<string>();
      const types = this.value('territory-types')
        .split('\n')
        .filter((s) => s.trim())
        .map((s, i) => {
          const split = s.lastIndexOf('=');
          if (split < 1) throw Error('Typ als Name = Rang (0–5) eintragen.');
          const name = s.slice(0, split).trim(),
            id =
              l.types.find((t) => t.name === name && !used.has(t.id))?.id ??
              (l.types[i] && !used.has(l.types[i]!.id) ? l.types[i]!.id : crypto.randomUUID());
          used.add(id);
          return { id, name, rank: Number(s.slice(split + 1)) };
        });
      return this.commit({
        kind: 'territory-layer',
        expectedRevision: l.revision || null,
        layer: {
          ...l,
          name: this.value('territory-layer-name'),
          order: Number(this.value('territory-layer-order')),
          visible: el<HTMLInputElement>(this.panel, 'territory-visible').checked,
          types,
        },
      });
    };
    el(this.panel, 'territory-layer-save').onclick = run(saveLayer);
    el(this.panel, 'territory-visible').onchange = run(saveLayer);
    el(this.panel, 'territory-retry').onclick = run(() =>
      this.pending ? this.commit(this.pending) : undefined,
    );
    el(this.panel, 'territory-cancel').onclick = () => {
      this.clear();
      this.controls();
      this.host.redraw();
    };
    this.panel.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).closest('details')) {
        const id = (e.target as HTMLElement).id;
        for (const owner of ['region', 'layer'] as const)
          if ((propertyFields[owner] as readonly string[]).includes(id)) this.dirty.add(owner);
        el(this.panel, 'territory-cancel').hidden = false;
        this.say('Eigenschaften übernehmen oder verwerfen.');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === canvas) this.spacePan = true;
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spacePan = false;
    });
    window.addEventListener('blur', () => {
      this.spacePan = false;
    });
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.active() || e.button !== 0 || e.altKey || e.ctrlKey || this.spacePan) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        canvas.focus();
        if (this.saving || this.loading || this.hasDraft() || !this.host.current()) return;
        const t = this.chosen();
        if (!t) {
          this.say('Zuerst eine Region wählen oder anlegen.');
          return;
        }
        const p = this.host.point(e),
          mode = this.value('territory-operation');
        if (mode === 'label') {
          if (!contains(p, t.polygons)) {
            this.say('Beschriftung innerhalb der Region platzieren.');
            return;
          }
          void this.commit({
            kind: 'territory-put',
            territory: { ...t, labelPoint: p },
            expectedRevision: t.revision,
          }).catch((e) => this.host.error(e));
          return;
        }
        this.points = [p];
        this.pointer = e.pointerId;
        this.vertex = null;
        if (mode === 'vertices') {
          const tolerance = (this.host.box().width / canvas.clientWidth) * 10;
          let best = tolerance;
          t.polygons.forEach((polygon, pi) =>
            [polygon.outer, ...polygon.holes].forEach((ring, ri) =>
              ring.forEach((q, vi) => {
                const d = Math.hypot(p.x - q.x, p.y - q.y);
                if (d < best) {
                  best = d;
                  this.vertex = { polygon: pi, ring: ri, vertex: vi };
                }
              }),
            ),
          );
          if (e.shiftKey) {
            let nearest: {
                polygon: number;
                ring: number;
                vertex: number;
                point: Point;
              } | null = null,
              distance = tolerance;
            t.polygons.forEach((poly, pi) =>
              [poly.outer, ...poly.holes].forEach((r, ri) =>
                r.forEach((a, vi) => {
                  const b = r[(vi + 1) % r.length]!,
                    dx = b.x - a.x,
                    dy = b.y - a.y,
                    u = Math.max(
                      0,
                      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
                    ),
                    q = { x: a.x + u * dx, y: a.y + u * dy },
                    d = Math.hypot(q.x - p.x, q.y - p.y);
                  if (u > 0 && u < 1 && d < distance) {
                    distance = d;
                    nearest = { polygon: pi, ring: ri, vertex: vi, point: q };
                  }
                }),
              ),
            );
            this.pointer = null;
            if (nearest)
              void this.commit({
                kind: 'territory-vertex',
                id: t.id,
                expectedRevision: t.revision,
                ...(nearest as {
                  polygon: number;
                  ring: number;
                  vertex: number;
                  point: Point;
                }),
                insert: true,
              }).catch((e) => this.host.error(e));
            return;
          }
          if (!this.vertex) {
            this.clear();
            this.say('Grenzpunkt ziehen. Umschalt + Klick auf eine Kante fügt einen Punkt ein.');
            return;
          }
          const selected = this.vertex as {
              polygon: number;
              ring: number;
              vertex: number;
            },
            polygon = t.polygons[selected.polygon]!;
          this.points = [
            {
              ...[polygon.outer, ...polygon.holes][selected.ring]![selected.vertex]!,
            },
          ];
        }
        canvas.setPointerCapture(e.pointerId);
        this.updatePreview();
      },
      true,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.active()) {
          this.cursor = this.host.point(e);
          if (this.pointer === null) this.host.redraw();
        }
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = this.host.point(e);
        if (this.vertex) this.points = [p];
        else if (
          Math.hypot(p.x - this.points.at(-1)!.x, p.y - this.points.at(-1)!.y) >=
            Number(this.value('territory-radius')) / 4 &&
          this.points.length < 2000
        )
          this.points.push(p);
        this.updatePreview();
      },
      true,
    );
    canvas.addEventListener(
      'pointerup',
      (e) => {
        if (this.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.pointer = null;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (this.conflict) {
          this.say(this.conflict);
          this.clear(false);
          this.host.redraw();
          return;
        }
        if (this.pending) void this.commit(this.pending).catch((e) => this.host.error(e));
      },
      true,
    );
    canvas.addEventListener('pointerleave', () => {
      this.cursor = null;
      this.host.redraw();
    });
    canvas.addEventListener(
      'pointercancel',
      (e) => {
        if (this.pointer === e.pointerId) {
          this.clear();
          this.host.redraw();
        }
      },
      true,
    );
    canvas.addEventListener(
      'click',
      (e) => {
        if (this.active()) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true,
    );
    canvas.addEventListener(
      'keydown',
      (e) => {
        if (this.active() && e.key === 'Escape') {
          e.stopImmediatePropagation();
          this.clear();
          this.controls();
          this.host.redraw();
        }
      },
      true,
    );
  }
  private value(id: string) {
    return el<HTMLInputElement>(this.panel, id).value;
  }
  private chosen() {
    return this.state.territories.find((t) => t.id === this.selected);
  }
  private active() {
    return (
      this.host.enabled() &&
      (document.getElementById('land-tool') as HTMLSelectElement | null)?.value === 'territory'
    );
  }
  get selectedLabel() {
    return this.active() && this.selected ? 'territory:' + this.selected : undefined;
  }
  hasDraft() {
    return this.dirty.size > 0 || !!this.pending || this.pointer !== null || this.saving;
  }
  private say(s: string) {
    el(this.panel, 'territory-status').textContent = s;
  }
  private restoreChoice() {
    el<HTMLSelectElement>(this.panel, 'territory-layer').value = this.layer;
    el<HTMLSelectElement>(this.panel, 'territory-region').value = this.selected;
    this.say('Zug zuerst speichern oder verwerfen.');
  }
  private clear(message = true, preserveProperties = false) {
    if (!preserveProperties) this.dirty.clear();
    this.points = [];
    this.pointer = null;
    this.pending = null;
    this.preview = [];
    this.conflict = '';
    el(this.panel, 'territory-retry').hidden = el(this.panel, 'territory-cancel').hidden = true;
    el(this.panel, 'territory-cancel').hidden = this.dirty.size === 0;
    if (message) this.say('Region wählen und Fläche malen.');
  }
  private updatePreview() {
    const t = this.chosen()!;
    try {
      this.conflict = '';
      if (this.vertex) {
        const polygon = t.polygons[this.vertex.polygon]!,
          source = [polygon.outer, ...polygon.holes][this.vertex.ring]![this.vertex.vertex]!,
          point = this.points[0]!;
        if (point.x === source.x && point.y === source.y) {
          this.pending = null;
          this.preview = [];
          this.say('Grenzpunkt ausgewählt. Ziehen zum Verschieben oder Punktaktion zum Entfernen.');
          this.host.redraw();
          return;
        }
        this.pending = {
          kind: 'territory-vertex',
          id: t.id,
          expectedRevision: t.revision,
          ...this.vertex,
          point: this.points[0]!,
        };
        this.preview = territoryVertex(this.state, t.id, {
          ...this.vertex,
          point: this.points[0]!,
        });
      } else {
        this.pending = {
          kind: 'territory-stroke',
          id: t.id,
          expectedRevision: t.revision,
          points: [...this.points],
          radius: Number(this.value('territory-radius')),
          operation: this.value('territory-operation') as 'add' | 'erase',
        };
        this.preview = territoryStroke(
          this.state,
          t.id,
          this.points,
          this.pending.radius,
          this.pending.operation,
        );
      }
      this.say('Vorschau · ' + this.preview.length + ' betroffene Regionen');
    } catch (e) {
      this.conflict = e instanceof Error ? e.message : String(e);
      this.say(this.conflict);
    }
    this.host.redraw();
  }
  private async commit(action: TerritoryAction) {
    if (this.saving) return;
    if (this.pending && this.pending !== action)
      throw Error('Offenen Schreibentwurf zuerst klären oder verwerfen.');
    if (!this.host.current()) throw Error('Kartenausschnitt wird geladen.');
    this.saving = true;
    this.panel
      .querySelectorAll('button,select,input,textarea')
      .forEach((e) => ((e as HTMLInputElement).disabled = true));
    this.pending = action;
    try {
      const result = await this.host.write(action);
      if (!result) throw Error('Speicherung nicht bestätigt. Entwurf bleibt erhalten.');
      if (action.kind === 'territory-put') this.dirty.delete('region');
      if (action.kind === 'territory-layer') this.dirty.delete('layer');
      this.clear(false, true);
      this.revision = -1;
      await this.load();
      // Canonical noding may insert a neighbour junction before the old index.
      // Keep the edited point selected by its position, never a stale index.
      this.vertex = null;
      if (action.kind === 'territory-vertex' && action.point) {
        const point = action.point;
        this.chosen()?.polygons.forEach((p, polygon) =>
          [p.outer, ...p.holes].forEach((r, ring) => {
            const vertex = r.findIndex((v) => Math.hypot(v.x - point.x, v.y - point.y) < 1e-7);
            if (vertex >= 0) this.vertex = { polygon, ring, vertex };
          }),
        );
      }
      this.say(this.dirty.size ? 'Gespeichert · weitere Eigenschaften noch offen.' : 'Gespeichert');
    } catch (e) {
      el(this.panel, 'territory-retry').hidden = el(this.panel, 'territory-cancel').hidden = false;
      this.say(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      this.saving = false;
      this.panel
        .querySelectorAll('button,select,input,textarea')
        .forEach((e) => ((e as HTMLInputElement).disabled = false));
      el<HTMLInputElement>(this.panel, 'territory-name').readOnly = !!this.chosen()?.locationId;
      this.host.redraw();
    }
  }
  async select(id: string) {
    if (this.hasDraft()) throw Error('Gebietszug zuerst abschließen oder verwerfen.');
    const token = this.token;
    await this.load();
    if (this.token !== token) return;
    const area = this.state.territories.find((t) => t.id === id);
    if (!area) throw Error('Gebiet nicht mehr vorhanden.');
    this.layer = area.layerId;
    this.selected = id;
    this.vertex = null;
    this.controls();
    if (area.polygons.length) this.host.focus(territoryBounds(area.polygons));
    this.host.redraw();
  }
  private async load() {
    const data = this.host.data();
    if (!data || !this.token) return;
    const token = this.token,
      generation = ++this.generation;
    this.loading = true;
    try {
      const result = await window.campaign.atlasTerritories(token);
      if (token !== this.token || generation !== this.generation) return;
      if (!result.ok) throw Error(result.error);
      if (this.vertex) this.say('Region neu geladen. Grenzpunkt erneut wählen.');
      this.vertex = null;
      this.state = result.value;
      this.revision = data.revision;
      this.controls();
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  sync(token: string) {
    if (token !== this.token) {
      this.token = token;
      this.clear();
      this.selected = '';
      this.state = { layers: defaultTerritoryLayers(), territories: [] };
      this.loading = false;
      this.revision = -1;
      this.generation++;
    }
    this.panel.hidden = !this.active();
    if (
      this.active() &&
      !this.loading &&
      !this.hasDraft() &&
      this.revision !== this.host.data()?.revision
    )
      void this.load().catch((e) => this.host.error(e));
  }
  private controls() {
    // A canonical refresh belongs to both forms, but a save belongs to only one.
    // Capture at render time so edits made while a read was pending survive too.
    const drafts = [...this.dirty].flatMap((owner) =>
      propertyFields[owner].map((id) => {
        const input = el<HTMLInputElement>(this.panel, id);
        return { id, value: input.value, checked: input.checked };
      }),
    );
    const options = (id: string, items: { id: string; name: string }[], value: string) => {
      const s = el<HTMLSelectElement>(this.panel, id);
      s.replaceChildren(...items.map((i) => new Option(i.name, i.id)));
      s.value = value;
    };
    if (!this.state.layers.some((l) => l.id === this.layer)) this.layer = this.state.layers[0]!.id;
    const l = this.state.layers.find((l) => l.id === this.layer)!,
      t = this.chosen();
    options('territory-layer', this.state.layers, this.layer);
    options(
      'territory-region',
      [
        { id: '', name: 'Region wählen' },
        ...this.state.territories.filter((t) => t.layerId === this.layer),
      ],
      this.selected,
    );
    options('territory-type', l.types, t?.typeId ?? l.types[0]!.id);
    options(
      'territory-parent',
      [
        { id: '', name: 'Keine Oberregion' },
        ...this.state.territories.filter((r) => r.layerId === this.layer && r.id !== t?.id),
      ],
      t?.parentId ?? '',
    );
    for (const [id, value] of Object.entries({
      'territory-name': t?.name ?? '',
      'territory-rank': t?.rank ?? 3,
      'territory-color': t?.color ?? '#b58445',
      'territory-opacity': t?.opacity ?? 0.15,
      'territory-border': t?.border ?? 'solid',
      'territory-location': t?.locationId ?? '',
      'territory-layer-name': l.name,
      'territory-layer-order': l.order,
      'territory-types': l.types.map((t) => t.name + ' = ' + t.rank).join('\n'),
    }))
      el<HTMLInputElement>(this.panel, id).value = String(value);
    el<HTMLInputElement>(this.panel, 'territory-visible').checked = l.visible;
    el<HTMLInputElement>(this.panel, 'territory-name').readOnly = !!t?.locationId;
    el(this.panel, 'territory-name').title = t?.locationId
      ? 'Name wird vom verknüpften Ort übernommen.'
      : '';
    for (const draft of drafts) {
      const input = el<HTMLInputElement>(this.panel, draft.id);
      input.value = draft.value;
      input.checked = draft.checked;
    }
  }
  draw(root: AtlasPaint, box: LandscapeBox, mpp: number) {
    if (!this.active()) return;
    if (this.cursor && ['add', 'erase'].includes(this.value('territory-operation')))
      root.append(
        atlasPaint('circle', {
          x: this.cursor.x - box.x,
          y: this.cursor.y - box.y,
          radius: Number(this.value('territory-radius')),
          pointer: false,
          style: {
            fill: null,
            stroke: this.value('territory-operation') === 'erase' ? '#a33' : '#c65d28',
            lineWidth: mpp,
            lineDash: [4 * mpp, 3 * mpp],
          },
          data: { editorOnly: 'true' },
        }),
      );
    for (const t of this.preview)
      root.append(
        atlasPaint('polygons', {
          polygons: t.polygons.map((p) => ({
            outer: p.outer.map((v) => ({ x: v.x - box.x, y: v.y - box.y })),
            holes: p.holes.map((h) => h.map((v) => ({ x: v.x - box.x, y: v.y - box.y }))),
          })),
          pointer: false,
          style: {
            fill: t.color,
            fillOpacity: 0.2,
            stroke: this.conflict ? '#b22' : '#c65d28',
            lineWidth: 2 * mpp,
          },
          data: { editorOnly: 'true' },
        }),
      );
    if (this.value('territory-operation') === 'vertices')
      for (const [pi, p] of (this.chosen()?.polygons ?? []).entries())
        for (const [ri, ring] of [p.outer, ...p.holes].entries())
          for (const [vi, v] of ring.entries())
            if (
              v.x >= box.x &&
              v.x <= box.x + box.width &&
              v.y >= box.y &&
              v.y <= box.y + box.height
            )
              root.append(
                atlasPaint('circle', {
                  x: v.x - box.x,
                  y: v.y - box.y,
                  radius: mpp * 4,
                  style: {
                    fill:
                      this.vertex?.polygon === pi &&
                      this.vertex.ring === ri &&
                      this.vertex.vertex === vi
                        ? '#c65d28'
                        : '#fff',
                    stroke: '#654',
                    lineWidth: mpp,
                  },
                  data: { editorOnly: 'true' },
                }),
              );
  }
}

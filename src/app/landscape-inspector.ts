import { prominenceEditor } from './atlas-prominence-editor';
import { onlyProminenceChanged } from './atlas-prominence';
import type { LandscapeRoutes } from './landscape-routes';
import type { LandscapeHost } from './landscape-workbench-types';
import { mapLabelEditor, readMapLabelEditor } from './map-label-editor';
import { type VegetationInstance, type VegetationOverride } from './vegetation';
import { vegetationInspector } from './vegetation-controls';
import { atlasFieldValue } from './atlas-units';
import { lineControls, readLineControls } from './landscape-tool-settings';
import { newLine, linePoints, translateLine, splitLine } from './landscape-line';
import { AtlasPaint } from './atlas-paint';
import type { AtlasAction } from './campaign-atlas-contracts';
import { type LandscapeBox, type LandscapeRecord } from './atlas-landscape';
import { newLocation, type LocationDocument } from '../features/location/location-schema';
const html = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
interface LandscapeInspectorHost {
  readonly inspectorRoot: HTMLElement;
  readonly hasDraft: (includeRoute?: boolean) => boolean;
  readonly token: string;
  readonly effects: Pick<LandscapeHost, 'data' | 'error' | 'redraw' | 'selected'>;
  readonly say: (message: string) => void;
  background: null | {
    key: unknown[];
    node: AtlasPaint;
    box: LandscapeBox;
    selectedSlot: number;
  };
  readonly assets: Map<string, string>;
  readonly rememberAsset: (id: string, data: string) => void;
  readonly objectOptions: () => void;
  readonly routes: Pick<LandscapeRoutes, 'openRoute'>;
  readonly finish: () => Promise<unknown>;
  readonly commit: (action: AtlasAction) => Promise<unknown>;
  readonly draftSeed: number;
  readonly selectId: (id: string) => Promise<void>;
}
/** Owns selected landscape records and their editable inspector draft. */
export class LandscapeInspector {
  constructor(private host: LandscapeInspectorHost) {}
  clearSelection() {
    this.selected = null;
    this.original = null;
    this.prominenceControl = undefined;
    this.selectionRecords.clear();
    this.vegetationInstance = undefined;
    this.doc = null;
    this.docRevision = null;
    this.vertex = 0;
    this.dirty = false;
    this.host.inspectorRoot.replaceChildren();
    delete this.host.inspectorRoot.dataset.selectionId;
    this.host.background = null;
  }
  vegetationInstance: VegetationInstance | undefined;
  selectionRecords = new Map<string, LandscapeRecord>();
  selected: LandscapeRecord | null = null;
  private original: LandscapeRecord | null = null;
  private prominenceChangeOnly = false;
  private prominenceControl: ReturnType<typeof prominenceEditor> | undefined;
  prominenceAction() {
    const r = this.selected;
    if (
      !this.prominenceChangeOnly ||
      !r ||
      !this.original ||
      !onlyProminenceChanged(this.original, r)
    )
      return;
    return {
      kind: 'landscape-prominence' as const,
      id: r.id,
      expectedRevision: r.revision,
      prominence: r.prominence ?? null,
    };
  }
  get selectionId() {
    return this.selected && this.host.inspectorRoot.dataset.selectionId === this.selected.id
      ? this.selected.id
      : null;
  }
  vertex = 0;
  dirty = false;
  doc: LocationDocument | null = null;
  docRevision: number | null = null;
  get selectedLabel() {
    return this.selected
      ? (this.selected.kind === 'place' ? 'place:' : 'landscape:') + this.selected.id
      : undefined;
  }
  async selectAdditional(id: string) {
    if (this.host.hasDraft()) throw Error('Änderung zuerst abschließen oder verwerfen.');
    const token = this.host.token,
      frame = this.host.effects.data()?.region?.fence,
      response = await window.campaign.atlasLandscapeObject(token, id);
    if (token !== this.host.token || frame !== this.host.effects.data()?.region?.fence) return;
    if (!response.ok) throw Error(response.error);
    const r = response.value;
    if (!['river', 'road'].includes(r.kind)) return;
    if (r.route || this.selected?.route) {
      await this.select(r);
      return;
    }
    if (!this.selected || !['river', 'road'].includes(this.selected.kind)) {
      await this.select(r);
      return;
    }
    if (this.selected.kind !== r.kind) {
      this.host.say('Straßen und Flüsse getrennt gemeinsam bearbeiten.');
      return;
    }
    if (!this.selectionRecords.size) this.selectionRecords.set(this.selected.id, this.selected);
    if (this.selectionRecords.has(id) && id !== this.selected.id) this.selectionRecords.delete(id);
    else
      this.selectionRecords.set(id, id === this.selected.id ? this.selected : structuredClone(r));
    this.inspector();
    this.host.background = null;
    this.host.effects.redraw();
  }
  async select(record: LandscapeRecord) {
    if (this.host.hasDraft()) {
      this.host.say('Zuerst abschließen oder verwerfen.');
      return;
    }
    this.selected = structuredClone(record);
    this.original = structuredClone(record);
    this.selectionRecords.clear();
    this.doc = null;
    this.docRevision = null;
    this.vertex = 0;
    const token = this.host.token,
      frame = this.host.effects.data()?.region?.fence;
    if (record.locationId) {
      const r = await window.campaign.deskContent(token, {
        kind: 'location',
        id: record.locationId,
      });
      if (
        token !== this.host.token ||
        this.selected?.id !== record.id ||
        frame !== this.host.effects.data()?.region?.fence
      )
        return;
      if (!r.ok) throw new Error(r.error);
      if (!r.value.location || r.value.unavailable)
        throw new Error('Ortsinhalt nicht verfügbar. Originaldaten bleiben erhalten.');
      this.doc = structuredClone(r.value.location);
      this.docRevision = r.value.revision;
    }
    if (record.assetId && !this.host.assets.has(record.assetId)) {
      const image = await window.campaign.referenceAssetPreview(token, record.assetId, 1024);
      if (
        token !== this.host.token ||
        this.selected?.id !== record.id ||
        frame !== this.host.effects.data()?.region?.fence
      )
        return;
      if (image.ok) this.host.rememberAsset(record.assetId, image.value);
      else {
        html('land-reload').hidden = false;
        this.host.say('Bildvorlage nicht verfügbar. Original bleibt erhalten.');
      }
    }
    this.inspector();
    this.host.objectOptions();
    this.host.effects.selected?.(record.id, record.kind);
    this.host.effects.redraw();
  }
  inspector() {
    const root = html('land-selection');
    root.replaceChildren();
    this.prominenceChangeOnly = false;
    this.prominenceControl = undefined;
    root.oninput = root.onchange = (e) => {
      if ((e.target as HTMLElement)?.id !== 'land-prominence') this.prominenceChangeOnly = false;
    };
    delete root.dataset.selectionId;
    const r = this.selected;
    if (!r) return;
    root.dataset.selectionId = r.id;
    if (r.kind === 'road' || r.kind === 'river')
      this.prominenceControl = prominenceEditor(
        root,
        'land-prominence',
        () => r,
        () => {
          this.prominenceChangeOnly = !this.dirty || this.prominenceChangeOnly;
          this.dirty = true;
          this.host.background = null;
          this.host.effects.redraw();
        },
      );
    if (r.route) {
      const title = document.createElement('p');
      title.textContent =
        (r.name || 'Geplanter Verlauf') +
        (r.route.conflict ? ' · ' + r.route.conflict : ' · Geländeform verbunden');
      const edit = document.createElement('button');
      edit.textContent = 'Verlauf und Gelände bearbeiten';
      edit.onclick = () =>
        void this.host.routes.openRoute(r).catch((e) => this.host.effects.error(e));
      const save = document.createElement('button');
      save.textContent = 'Kartenprominenz speichern';
      save.onclick = () => void this.host.finish().catch((e) => this.host.effects.error(e));
      root.append(title, edit, save);
      return;
    }
    if (r.vegetation) {
      vegetationInspector(
        root,
        r,
        this.vegetationInstance,
        () => {
          this.dirty = true;
          this.host.background = null;
        },
        () => void this.host.finish().catch((e) => this.host.effects.error(e)),
        () =>
          void this.host
            .commit({ kind: 'landscape-remove', id: r.id, expectedRevision: r.revision })
            .catch((e) => this.host.effects.error(e)),
        (o) => void this.linkVegetation(r, o).catch((e) => this.host.effects.error(e)),
      );
      return;
    }
    const label = (title: string, id: string, value: string, type = 'text') => {
      const l = document.createElement('label');
      l.textContent = title;
      const input = document.createElement('input');
      input.id = id;
      input.type = type;
      input.value = value;
      input.oninput = () => {
        this.dirty = true;
        if (type === 'number' && input.value && Number.isFinite(Number(input.value))) {
          this.readInspector();
          this.host.background = null;
          this.host.effects.redraw();
        }
      };
      l.append(input);
      root.append(l);
      return input;
    };
    if (r.kind === 'road' || r.kind === 'river') {
      const plan = document.createElement('button');
      plan.textContent = 'Geländegerecht planen';
      plan.onclick = () =>
        void this.host.routes.openRoute(r).catch((e) => this.host.effects.error(e));
      root.append(plan);
    }
    label('Name des ausgewählten Objekts', 'land-name', r.name);
    if (r.kind !== 'reference')
      mapLabelEditor(root, 'land', r.label, () => {
        this.dirty = true;
      });
    const x = label('X in m', 'land-x', String(r.points[0]!?.x ?? 0), 'number'),
      y = label('Y in m', 'land-y', String(r.points[0]!?.y ?? 0), 'number');
    let position: HTMLDetailsElement | undefined;
    if (r.kind === 'place') {
      position = document.createElement('details');
      position.id = 'land-position';
      const title = document.createElement('summary');
      title.textContent = 'Position';
      position.append(title, x.closest('label')!, y.closest('label')!);
    }
    const button = (name: string, run: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.onclick = run;
      root.append(b);
    };
    if (r.kind === 'river' || r.kind === 'road') {
      const profile = document.createElement('button');
      profile.id = 'land-inspect-profile';
      profile.textContent = 'Geländehöhen entlang des Verlaufs';
      profile.onclick = () =>
        document.dispatchEvent(
          new CustomEvent('terrain-profile-request', {
            detail: { points: linePoints(r), kind: r.kind },
          }),
        );
      root.append(profile);
      label('Breite in m', 'land-record-width', String(r.width), 'number');
      const settings = document.createElement('div');
      settings.id = 'land-selected-line';
      root.append(settings);
      const legacy = {
        ...newLine(r.kind),
        curve: 'linear' as const,
        roughness: 0,
        meander: 0,
        fadeIn: false,
        style: r.style === 'path' ? ('dashed' as const) : ('solid' as const),
      };
      lineControls(settings, 'land-edit', r.line ?? legacy, r.kind === 'river', () => {
        r.line = readLineControls(settings, 'land-edit', r.line ?? legacy);
        this.dirty = true;
        this.host.background = null;
        this.host.effects.redraw();
      });
      if (this.selectionRecords.size > 1) {
        const note = document.createElement('p');
        note.textContent =
          this.selectionRecords.size + ' Verläufe ausgewählt. Ziehen verschiebt alle gemeinsam.';
        root.append(note);
        button('Breite und Stil auf Auswahl anwenden', () => {
          this.readInspector();
          for (const other of this.selectionRecords.values()) {
            other.width = r.width;
            other.line = {
              ...(r.line ?? legacy),
              seed: other.line?.seed ?? this.host.draftSeed,
              continuity: other.line?.continuity,
            };
          }
          this.dirty = true;
          this.host.background = null;
          this.host.effects.redraw();
        });
      }
      button('Weitere Verläufe mit Umschalt-Klick auswählen', () =>
        this.host.say(
          'Umschalt gedrückt halten und weitere Straßen oder Flüsse anklicken. Erneuter Umschalt-Klick entfernt sie aus der Auswahl.',
        ),
      );
      button('Punkt nach markiertem Punkt einfügen', () => {
        this.vertex = Math.max(0, this.vertex);
        const a = r.points[this.vertex]!,
          b = r.points[this.vertex + 1]! ?? a;
        r.points.splice(this.vertex + 1, 0, {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        });
        this.dirty = true;
        this.host.effects.redraw();
      });
      button('Markierten Punkt entfernen', () => {
        if (r.points.length <= 2) return;
        r.points.splice(this.vertex, 1);
        this.vertex = 0;
        this.dirty = true;
        this.host.effects.redraw();
      });
      button('Am markierten Punkt teilen', () => {
        if (this.vertex <= 0 || this.vertex >= r.points.length - 1) {
          this.host.say('Einen inneren Verlaufpunkt auswählen.');
          return;
        }
        this.readInspector();
        const [first, second] = splitLine(r, this.vertex, crypto.randomUUID());
        void this.host
          .commit({
            kind: 'landscape-batch',
            records: [
              { record: first, expectedRevision: r.revision },
              { record: second, expectedRevision: null },
            ],
          })
          .catch((e) => this.host.effects.error(e));
      });
    }
    if (r.kind === 'reference') {
      label('Breite in m', 'land-record-width', String(r.width), 'number');
      label('Drehung in Grad', 'land-angle', String(((r.angle ?? 0) * 180) / Math.PI), 'number');
      label('Deckkraft 0–1', 'land-opacity', String(r.opacity ?? 0.4), 'number');
      for (const [id, title, value] of [
        ['land-visible', 'Bild anzeigen', r.visible !== false],
        ['land-locked', 'Bild sperren', r.locked !== false],
      ] as const) {
        const l = document.createElement('label'),
          input = document.createElement('input');
        input.id = id;
        input.type = 'checkbox';
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
        const l = document.createElement('label'),
          name = document.createElement('input'),
          body = document.createElement('textarea');
        name.value = s.title;
        name.dataset.sectionTitle = s.id;
        body.value = s.markdown;
        body.dataset.sectionBody = s.id;
        name.oninput = body.oninput = () => {
          this.dirty = true;
        };
        l.append(name, body);
        root.append(l);
        button('Abschnitt nach oben', () => {
          this.readInspector();
          const sections = [...this.doc!.sections],
            i = sections.findIndex((v) => v.id === s.id);
          if (i > 0) [sections[i - 1]!, sections[i]!] = [sections[i]!, sections[i - 1]!];
          this.doc = { ...this.doc!, sections };
          this.dirty = true;
          this.inspector();
        });
        button('Abschnittslink kopieren', () => {
          void navigator.clipboard
            .writeText(`[${s.title}](dungeon-ref:location/${this.doc!.id}#section=${s.id})`)
            .catch((e) => this.host.effects.error(e));
        });
      }
      button('Abschnitt hinzufügen', () => {
        this.readInspector();
        this.doc = {
          ...this.doc!,
          sections: [
            ...this.doc!.sections,
            { id: crypto.randomUUID(), title: 'Neuer Abschnitt', markdown: '' },
          ],
        };
        this.dirty = true;
        this.inspector();
      });
    }
    if (position) root.append(position);
    button(
      'Auswahl speichern',
      () => void this.host.finish().catch((e) => this.host.effects.error(e)),
    );
    button(
      'Aus Atlas entfernen',
      () =>
        void this.host
          .commit(
            this.selectionRecords.size > 1
              ? {
                  kind: 'landscape-batch',
                  records: [],
                  remove: [...this.selectionRecords.values()].map((r) => ({
                    id: r.id,
                    expectedRevision: r.revision,
                  })),
                }
              : {
                  kind: 'landscape-remove',
                  id: r.id,
                  expectedRevision: r.revision,
                },
          )
          .catch((e) => this.host.effects.error(e)),
    );
    this.host.say(
      r.kind === 'road' || r.kind === 'river'
        ? 'Punkte ziehen; beim Loslassen wird gespeichert. Rückgängig ist im Atlas verfügbar.'
        : 'Punkte ziehen; Änderungen anschließend speichern.',
    );
  }
  readInspector() {
    const r = this.selected;
    if (!r || r.vegetation || r.route) return;
    r.name = html<HTMLInputElement>('land-name').value;
    r.label = readMapLabelEditor(this.host.inspectorRoot, 'land');
    const p = {
        x: Number(atlasFieldValue(html<HTMLInputElement>('land-x'))),
        y: Number(atlasFieldValue(html<HTMLInputElement>('land-y'))),
      },
      old = r.points[0]!;
    if (old) {
      const dx = p.x - old.x,
        dy = p.y - old.y;
      if (!r.locked || r.kind !== 'reference')
        for (const record of this.selectionRecords.size ? [...this.selectionRecords.values()] : [r])
          translateLine(record, dx, dy);
    }
    const width = document.getElementById('land-record-width') as HTMLInputElement | null;
    if (width) r.width = Number(atlasFieldValue(width));
    this.prominenceControl?.refresh();
    if (r.kind === 'reference') {
      r.angle = (Number(html<HTMLInputElement>('land-angle').value) * Math.PI) / 180;
      r.opacity = Number(html<HTMLInputElement>('land-opacity').value);
      r.visible = html<HTMLInputElement>('land-visible').checked;
      r.locked = html<HTMLInputElement>('land-locked').checked;
    }
    if (this.doc)
      this.doc = {
        ...this.doc,
        name: r.name,
        sections: this.doc.sections.map((s) => ({
          ...s,
          title: this.host.inspectorRoot.querySelector<HTMLInputElement>(
            `[data-section-title="${s.id}"]`,
          )!.value,
          markdown: this.host.inspectorRoot.querySelector<HTMLTextAreaElement>(
            `[data-section-body="${s.id}"]`,
          )!.value,
        })),
      };
  }
  async selectVegetation(id: string, instance?: VegetationInstance) {
    this.vegetationInstance = instance;
    await this.host.selectId(id);
    this.inspector();
  }
  async linkVegetation(r: LandscapeRecord, o: VegetationOverride) {
    const doc = newLocation(
      crypto.randomUUID(),
      r.name + ' · ' + (o.asset === 'rock' ? 'Felsen' : 'Baum'),
      'poi',
      [crypto.randomUUID(), crypto.randomUUID()],
    );
    // The proposed location belongs to the command until it is acknowledged.
    // A failed creation must leave the editable object free of phantom links.
    const record = structuredClone(r),
      v = record.vegetation!;
    v.overrides = v.overrides.filter((x) => x.id !== o.id);
    v.overrides.push({ ...o, locationId: doc.id });
    return this.host.commit({
      kind: 'landscape-place',
      record,
      point: { x: o.x, y: o.y },
      document: doc,
      expectedLocationRevision: null,
      expectedRevision: r.revision,
    });
  }
}

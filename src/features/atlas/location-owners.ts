import { safePath } from "../../model";
import { FileConflict, type FileStore } from "../../persistence";
import {
  type LocationDocument,
  checkedLocationDocument,
  parseLocationDocument,
  serializeLocationDocument,
} from "../location/location-schema";
import {
  LocationSource,
  locationDocumentChange,
} from "../location/location-source";
import type { DraftLocation } from "./atlas-draft";
import {
  checkedLocationPlacement,
  locationPlacementsChange,
  type LocationPlacement,
} from "./location-placement";
import { nativeId } from "./native-values";
import type { OverworldDocument } from "./overworld";
import type { TerrainSource } from "./terrain-source";

export interface AtlasLocationOptions {
  /** Remains opt-in until marker/Key editing is connected in the host. */
  readonly locations?: boolean;
  readonly resolveLocation?: (id: string) => Promise<string>;
  readonly makeId?: () => string;
}
interface Base {
  readonly path: string;
  readonly before: string | null;
}
export function newLocationPath(id: string): string {
  return `Orte/${nativeId(id)}.location`;
}
export function locationPath(path: string): string {
  safePath(path);
  if (!path.endsWith(".location")) throw new Error("Unzulässige Ortsdatei.");
  return path;
}
function document(raw: string, id: string): LocationDocument {
  const value = parseLocationDocument(raw);
  if (value.id !== id)
    throw new Error("Ortsdatei besitzt eine andere Kennung.");
  return value;
}
/** Unloaded owners have a resolved path, never a fabricated empty document. */
export class LocationOwners {
  private paths = new Map<string, string>();
  private bases = new Map<string, Base>();
  private sources = new Map<string, LocationSource>();
  constructor(
    readonly store: FileStore,
    readonly terrain: TerrainSource,
    readonly options: AtlasLocationOptions,
  ) {}
  async resolve(id: string): Promise<string> {
    return locationPath(
      await (this.options.resolveLocation?.(id) ??
        Promise.resolve(newLocationPath(id))),
    );
  }
  async initialize(
    world: OverworldDocument,
    deltas: readonly DraftLocation[] = [],
  ): Promise<void> {
    const paths = new Set<string>();
    for (const p of world.placements) {
      const path = await this.resolve(p.locationId);
      if (paths.has(path))
        throw new Error("Mehrere Ortskennungen besitzen dieselbe Datei.");
      paths.add(path);
      this.paths.set(p.locationId, path);
    }
    for (const delta of deltas) {
      const expected = this.paths.get(delta.id) ?? newLocationPath(delta.id);
      if (delta.path !== expected)
        throw new Error("Ortsentwurf besitzt eine fremde Datei.");
      if (
        [...this.paths].some(
          ([id, path]) => id !== delta.id && path === expected,
        )
      )
        throw new Error("Mehrere Ortskennungen besitzen dieselbe Datei.");
      if ((await this.store.read(expected)) !== delta.before)
        throw new FileConflict(expected);
      this.paths.set(delta.id, expected);
      this.bases.set(delta.id, { path: expected, before: delta.before });
      this.sources.set(
        delta.id,
        new LocationSource(
          delta.id,
          this.terrain.history,
          delta.after === null ? null : document(delta.after, delta.id),
        ),
      );
    }
  }
  get pathsOwned(): readonly string[] {
    return [...this.paths.values()];
  }
  private enabled(): void {
    if (!this.options.locations)
      throw new Error("Ortsbearbeitung ist noch nicht angeschlossen.");
  }
  async ensure(id: string): Promise<LocationSource> {
    this.enabled();
    const loaded = this.sources.get(id);
    if (loaded) return loaded;
    if (!this.terrain.placements().some((p) => p.locationId === id))
      throw new Error("Ort ist nicht im Atlas verortet.");
    const path = this.paths.get(id);
    if (!path) throw new Error("Ortsdatei ist nicht aufgelöst.");
    const raw = await this.store.read(path);
    if (raw === null)
      throw new Error("Ortsdatei fehlt; Atlasdaten bleiben erhalten.");
    const base = this.bases.get(id);
    if (base && base.before !== raw) throw new FileConflict(path);
    const source = new LocationSource(
      id,
      this.terrain.history,
      document(raw, id),
    );
    this.bases.set(id, { path, before: raw });
    this.sources.set(id, source);
    return source;
  }
  get(id: string): LocationSource {
    const source = this.sources.get(id);
    if (!source) throw new Error("Ortsdatei ist noch nicht geladen.");
    return source;
  }
  create(raw: LocationDocument, rawPlacement: LocationPlacement): boolean {
    this.enabled();
    const doc = checkedLocationDocument(raw),
      p = checkedLocationPlacement(rawPlacement),
      before = this.terrain.placements();
    const after = [...before, p];
    // Validate the whole World delta before registering an owner.
    const change = locationPlacementsChange(
      this.terrain.world.id,
      before,
      after,
    );
    if (
      p.locationId !== doc.id ||
      doc.id === this.terrain.world.id ||
      this.paths.has(doc.id)
    )
      throw new Error("Die Ortsanlage benötigt eine neue, passende Kennung.");
    const path = newLocationPath(doc.id);
    if (this.pathsOwned.includes(path))
      throw new Error("Ortsdatei ist bereits vergeben.");
    const source = new LocationSource(doc.id, this.terrain.history);
    this.paths.set(doc.id, path);
    this.bases.set(doc.id, { path, before: null });
    this.sources.set(doc.id, source);
    return this.terrain.history.execute({
      label: "Ort anlegen",
      changes: [change, locationDocumentChange(doc.id, null, doc)],
    });
  }
  edit(doc: LocationDocument): boolean {
    this.enabled();
    doc = checkedLocationDocument(doc);
    if (
      !this.terrain.placements().some((p) => p.locationId === doc.id) ||
      this.get(doc.id).read() === null
    )
      throw new Error("Ort ist nicht im Atlas verortet.");
    return this.terrain.history.execute({
      label: "Orts-Key bearbeiten",
      changes: [locationDocumentChange(doc.id, this.get(doc.id).read(), doc)],
    });
  }
  move(id: string, position: LocationPlacement["position"]): boolean {
    this.enabled();
    const before = this.terrain.placements();
    if (!before.some((p) => p.locationId === id))
      throw new Error("Ort ist nicht im Atlas verortet.");
    return this.terrain.history.execute({
      label: "Ort verschieben",
      changes: [
        locationPlacementsChange(
          this.terrain.world.id,
          before,
          before.map((p) => (p.locationId === id ? { ...p, position } : p)),
        ),
      ],
    });
  }
  remove(id: string): boolean {
    this.enabled();
    const before = this.terrain.placements();
    if (!before.some((p) => p.locationId === id))
      throw new Error("Ort ist nicht im Atlas verortet.");
    return this.terrain.history.execute({
      label: "Ort entfernen",
      changes: [
        locationPlacementsChange(
          this.terrain.world.id,
          before,
          before.filter((p) => p.locationId !== id),
        ),
        locationDocumentChange(id, this.get(id).read(), null),
      ],
    });
  }
  snapshot(): ReadonlyMap<string, string | null> {
    return new Map(
      [...this.sources].map(([id, source]) => [
        id,
        source.read() === null
          ? null
          : serializeLocationDocument(source.read()!),
      ]),
    );
  }
  changes(
    world: OverworldDocument,
    loaded: ReadonlyMap<string, string | null>,
  ): readonly DraftLocation[] {
    const current = new Set(world.placements.map((p) => p.locationId)),
      changes: DraftLocation[] = [];
    for (const [id, after] of loaded) {
      const base = this.bases.get(id)!;
      if (current.has(id) !== (after !== null))
        throw new Error("Ortsdatei und Atlasposition passen nicht zusammen.");
      const equivalent =
        base.before === null || after === null
          ? base.before === after
          : serializeLocationDocument(document(base.before, id)) === after;
      if (!equivalent)
        changes.push({ id, path: base.path, before: base.before, after });
    }
    return changes.sort((a, b) => a.id.localeCompare(b.id));
  }
  guards() {
    return [...this.bases.values()].map((b) => ({
      path: b.path,
      before: b.before,
      after: b.before,
    }));
  }
  saved(changes: readonly DraftLocation[]): void {
    for (const c of changes)
      this.bases.set(c.id, { path: c.path, before: c.after });
  }
  async captured(
    id: string,
    loaded: ReadonlyMap<string, string | null>,
  ): Promise<{
    path: string;
    saved: string | null;
    document: LocationDocument;
  }> {
    const path = this.paths.get(id);
    if (!path) throw new Error("Ortsdatei ist nicht aufgelöst.");
    const saved = await this.store.read(path),
      base = this.bases.get(id);
    if (base && saved !== base.before) throw new FileConflict(path);
    const raw = loaded.has(id) ? loaded.get(id) : saved;
    if (raw === null || raw === undefined)
      throw new Error("Ortsdatei fehlt; Kopie wurde nicht angelegt.");
    return { path, saved, document: document(raw, id) };
  }
}

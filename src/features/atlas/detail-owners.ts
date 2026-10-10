import { FileConflict, type FileStore } from "../../persistence";
import { parseDocument } from "../../model";
import { parseCityDocument, serializeCityDocument } from "../city/codec";
import { CitySource } from "../city/commands";
import { DungeonAtlasSource } from "../dungeon/atlas-source";
import type { AtlasLocationOptions } from "./location-owners";
import {
  canonicalDetail,
  detailDocument,
  detailPath,
  type DetailKind,
  type DetailRecord,
  type DraftDetail,
} from "./detail-record";
import { nativeId } from "./native-values";
import type { TerrainSource } from "./terrain-source";

export interface AtlasSpatialOptions extends AtlasLocationOptions {
  /** Core opt-in only; the UI stays closed until native I01b. */
  readonly details?: boolean;
  /** Host supplies all matches in this atlas's verified scope; never a guessed filename. */
  readonly resolveDetail?: (
    worldId: string,
    kind: DetailKind,
    id: string,
  ) => Promise<readonly string[]>;
}
type Source = CitySource | DungeonAtlasSource;
interface Entry {
  readonly kind: DetailKind;
  readonly id: string;
  readonly path: string;
  before: string;
  readonly source: Source;
}
/** Uses the calling Repository queue, History and journal; owns no independent write path. */
export class DetailOwners {
  private entries = new Map<string, Entry>();
  private generation = 0;
  private retired = false;
  constructor(
    readonly store: FileStore,
    readonly terrain: TerrainSource,
    readonly options: AtlasSpatialOptions,
  ) {}
  retire(): void {
    this.retired = true;
    this.generation++;
  }
  private live(stamp: number): void {
    if (this.retired || stamp !== this.generation)
      throw new Error("Veralteter Detail-Ladevorgang.");
  }
  async resolve(kind: DetailKind, id: string): Promise<string> {
    nativeId(id);
    const stamp = this.generation;
    if (!this.options.details || !this.options.resolveDetail)
      throw new Error("Geprüfte Detailauflösung ist nicht angeschlossen.");
    const matches = await this.options.resolveDetail(
      this.terrain.world.id,
      kind,
      id,
    );
    this.live(stamp);
    if (
      !Array.isArray(matches) ||
      matches.length !== 1 ||
      typeof matches[0] !== "string"
    )
      throw new Error("Detailkennung fehlt, ist fremd oder mehrdeutig.");
    return detailPath(kind, matches[0]);
  }
  async ensure(
    kind: DetailKind,
    id: string,
    delta?: DraftDetail,
  ): Promise<Source> {
    const stamp = this.generation,
      path = await this.resolve(kind, id);
    this.live(stamp);
    const entry = this.entries.get(id);
    if (entry) {
      if (entry.kind !== kind || entry.path !== path)
        throw new FileConflict(path);
      return entry.source;
    }
    if ([...this.entries.values()].some((e) => e.path === path))
      throw new Error("Mehrere Detailowner besitzen dieselbe Datei.");
    const before = await this.store.read(path);
    this.live(stamp);
    if (before === null)
      throw new Error("Detaildatei fehlt; kein Ersatz wird angelegt.");
    detailDocument(kind, id, before);
    if (
      delta &&
      (delta.kind !== kind ||
        delta.id !== id ||
        delta.path !== path ||
        delta.before !== before)
    )
      throw new FileConflict(path);
    const current = delta?.after ?? before;
    const source =
      kind === "city"
        ? new CitySource(parseCityDocument(current), this.terrain.history)
        : new DungeonAtlasSource(parseDocument(current), this.terrain.history);
    this.entries.set(id, { kind, id, path, before, source });
    return source;
  }
  get(kind: DetailKind, id: string): Source {
    const entry = this.entries.get(id);
    if (!entry || entry.kind !== kind)
      throw new Error("Detaildatei ist ungeladen oder hat einen anderen Typ.");
    return entry.source;
  }
  get sources(): readonly Source[] {
    return [...this.entries.values()].map((e) => e.source);
  }
  get pathsOwned(): readonly string[] {
    return [...this.entries.values()].map((e) => e.path);
  }
  snapshot(): ReadonlyMap<string, DetailRecord> {
    return new Map(
      [...this.entries.values()].map((e) => [
        e.id,
        Object.freeze({
          kind: e.kind,
          id: e.id,
          path: e.path,
          bytes:
            e.source instanceof CitySource
              ? serializeCityDocument(e.source.read())
              : e.source.read().documentBytes,
        }),
      ]),
    );
  }
  changes(snapshot: ReadonlyMap<string, DetailRecord>): readonly DraftDetail[] {
    return [...snapshot.values()]
      .flatMap((r) => {
        const entry = this.entries.get(r.id);
        if (!entry || entry.kind !== r.kind || entry.path !== r.path)
          throw new Error("Detailmomentaufnahme ist fremd.");
        return canonicalDetail(r.kind, r.id, entry.before) ===
          canonicalDetail(r.kind, r.id, r.bytes)
          ? []
          : [
              {
                kind: r.kind,
                id: r.id,
                path: r.path,
                before: entry.before,
                after: r.bytes,
              },
            ];
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  async verify(snapshot: ReadonlyMap<string, DetailRecord>): Promise<void> {
    for (const r of snapshot.values()) {
      const entry = this.entries.get(r.id);
      if (
        !entry ||
        entry.kind !== r.kind ||
        entry.path !== r.path ||
        (await this.resolve(r.kind, r.id)) !== r.path
      )
        throw new FileConflict(r.path);
      if ((await this.store.read(r.path)) !== entry.before)
        throw new FileConflict(r.path);
    }
  }
  guards(snapshot = this.snapshot()) {
    return [...snapshot.values()].map((r) => {
      const entry = this.entries.get(r.id)!;
      return { path: entry.path, before: entry.before, after: entry.before };
    });
  }
  saved(changes: readonly DraftDetail[]): void {
    for (const c of changes) this.entries.get(c.id)!.before = c.after;
  }
  async captured(
    kind: DetailKind,
    id: string,
    snapshot: ReadonlyMap<string, DetailRecord>,
  ): Promise<{ record: DetailRecord; saved: string }> {
    const path = await this.resolve(kind, id),
      entry = this.entries.get(id),
      saved = await this.store.read(path);
    if (
      saved === null ||
      (entry &&
        (entry.kind !== kind || entry.path !== path || entry.before !== saved))
    )
      throw new FileConflict(path);
    const record = snapshot.get(id) ?? { kind, id, path, bytes: saved };
    if (record.kind !== kind || record.path !== path)
      throw new FileConflict(path);
    detailDocument(kind, id, record.bytes);
    return { record, saved };
  }
}

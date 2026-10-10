import { safePath } from "../../model";
import { FileConflict, type FileStore } from "../../persistence";
import { AtlasHistory, sameAtlasValue, type AtlasValue } from "./atlas-history";
import {
  isTerrainFile,
  parseAtlasDraft,
  serializeAtlasDraft,
  type DraftChunk,
  type DraftLocation,
} from "./atlas-draft";
import {
  FileTransaction,
  type AtlasFileWrite,
  type AtlasRecovery,
  type AtlasFileJournal,
} from "./file-transaction";
import { parseOverworld, serializeOverworld } from "./overworld";
import {
  parseTerrainChunk,
  serializeTerrainChunk,
  terrainChunkFile,
  type TerrainReference,
} from "./terrain-schema";
import { TerrainSource } from "./terrain-source";
import {
  LocationOwners,
  newLocationPath,
  locationPath,
} from "./location-owners";
import {
  projectAtlasNativeCapture,
  type AtlasCaptureRequest,
  type AtlasNativeCaptureV1,
  type AtlasNativeFile,
} from "./atlas-campaign-source";
import {
  parseLocationDocument,
  serializeLocationDocument,
  type LocationDocument,
} from "../location/location-schema";
import type { LocationPlacement } from "./location-placement";
import { nativeId } from "./native-values";
import { DetailOwners, type AtlasSpatialOptions } from "./detail-owners";
import type { DetailKind, DetailRecord, DraftDetail } from "./detail-record";
import { SpatialGraph } from "./spatial-graph";
import {
  parseSpatialWorld,
  serializeSpatialWorld,
  spatialBase,
  spatialState,
  type SpatialWorld,
} from "./spatial-schema";
import { checkSpatialSnapshot, detailReferences } from "./spatial-storage";
import { remapSpatialCopy } from "./spatial-copy";
import {
  validateSpatialRecovery,
  validateSpatialCopyJournal,
} from "./spatial-recovery";

interface Snapshot {
  readonly world: SpatialWorld;
  readonly loaded: ReadonlyMap<string, string>;
  readonly locations: ReadonlyMap<string, string | null>;
  readonly details: ReadonlyMap<string, DetailRecord>;
}
interface NativeCapturePin {
  readonly source: TerrainSource;
  readonly generation: number;
  readonly historyEpoch: number;
  readonly repositoryEpoch: number;
  readonly assertCurrent: () => void;
}
// All Atlas leaves of one backend share the queue, including draft/open operations.
const queues = new WeakMap<object, Promise<unknown>>();
function same(a: unknown, b: unknown): boolean {
  return sameAtlasValue(a as AtlasValue, b as AtlasValue);
}
function sameWorld(a: SpatialWorld, b: SpatialWorld): boolean {
  const normalized = (w: SpatialWorld) => ({
    ...w,
    chunks: [...w.chunks].sort((a, b) => a.file.localeCompare(b.file)),
  });
  return same(normalized(a), normalized(b));
}
export class AtlasRepository {
  readonly draftPath: string;
  readonly journalPath: string;
  private baseline!: string;
  private baselineWorld!: SpatialWorld;
  private draftRaw: string | null = null;
  private bases = new Map<string, string | null>();
  private restored = new Map<string, string | null>();
  private transaction!: FileTransaction;
  private source?: TerrainSource;
  private locations!: LocationOwners;
  private locationPaths = new Set<string>();
  private details?: DetailOwners;
  private graph?: SpatialGraph;
  private generation = 0;
  private nativeEpoch = 0;
  private nativeCaptures = new WeakMap<
    AtlasNativeCaptureV1,
    {
      pin: NativeCapturePin;
      extraLocations: ReadonlySet<string>;
      draft: string | null;
      journal: string | null;
    }
  >();
  constructor(
    readonly store: FileStore,
    readonly worldPath: string,
    private scope: object = store,
    private options: AtlasSpatialOptions = {},
  ) {
    safePath(worldPath);
    if (options.details && !options.locations)
      throw new Error("Räumliche Details benötigen Ortsowner.");
    this.draftPath = worldPath + ".draft";
    this.journalPath = worldPath + ".journal";
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = (queues.get(this.scope) ?? Promise.resolve()).then(
      operation,
    );
    queues.set(
      this.scope,
      result.catch(() => {}),
    );
    return result;
  }
  /** Baseline/journal activity invalidates captures even if eventual native bytes equal before. */
  private mutating<T>(operation: () => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      this.nativeEpoch++;
      try {
        return await operation();
      } finally {
        this.nativeEpoch++;
      }
    });
  }
  private dataPath(file: string): string {
    if (!isTerrainFile(file)) throw new Error("Unzulässige Landschaftsdatei.");
    return `Atlasdaten/${this.baselineWorld.id}/${file}`;
  }
  private parseWorld(raw: string): SpatialWorld {
    return this.options.details
      ? parseSpatialWorld(raw)
      : parseOverworld(raw, this.options.locations);
  }
  private worldText(world: SpatialWorld): string {
    if (this.options.details) return serializeSpatialWorld(world);
    if (world.version !== 1)
      throw new Error("Räumliche Details sind noch nicht angeschlossen.");
    return serializeOverworld(world, this.options.locations);
  }
  private terrainPath(path: string): boolean {
    const prefix = `Atlasdaten/${this.baselineWorld.id}/`;
    return path.startsWith(prefix) && isTerrainFile(path.slice(prefix.length));
  }
  /** Broad parsing is confined to recovery; exact owner/manifest validation precedes repair. */
  private async validateRecovery(journal: AtlasFileJournal): Promise<void> {
    if (this.options.details)
      return validateSpatialRecovery(
        this.store,
        this.worldPath,
        this.baselineWorld,
        this.options,
        journal,
      );
    const root = journal.writes.find((w) => w.path === this.worldPath);
    const before = root
      ? this.parseWorld(root.before ?? "null")
      : this.baselineWorld;
    const after = root
      ? this.parseWorld(root.after ?? "null")
      : this.baselineWorld;
    if (before.id !== this.baselineWorld.id || after.id !== before.id)
      throw new Error("Speicherjournal gehört zu einer anderen Welt.");
    const beforeIds = new Set(before.placements.map((p) => p.locationId));
    const afterIds = new Set(after.placements.map((p) => p.locationId));
    const paths = new Map<string, string>();
    for (const id of new Set([...beforeIds, ...afterIds])) {
      const path = beforeIds.has(id)
        ? await (this.options.resolveLocation?.(id) ??
            Promise.resolve(newLocationPath(id)))
        : newLocationPath(id);
      safePath(path);
      if (!path.endsWith(".location") || paths.has(path))
        throw new Error("Doppelte oder unzulässige Ortsdatei.");
      paths.set(path, id);
    }
    const written = new Set<string>();
    for (const w of journal.writes) {
      if (w.path === this.worldPath || this.terrainPath(w.path)) continue;
      if (w.path === this.draftPath) {
        for (const raw of [w.before, w.after])
          if (raw !== null) {
            const draft = parseAtlasDraft(raw);
            if (draft.worldId !== before.id)
              throw new Error("Fremder Atlasentwurf im Speicherjournal.");
            if (draft.version === 2)
              for (const c of draft.locations) {
                const expected = beforeIds.has(c.id)
                  ? await (this.options.resolveLocation?.(c.id) ??
                      Promise.resolve(newLocationPath(c.id)))
                  : newLocationPath(c.id);
                if (c.path !== expected)
                  throw new Error("Fremde Ortsdatei im Entwurfjournal.");
              }
          }
        continue;
      }
      const id = paths.get(w.path);
      if (
        !id ||
        (w.before !== null) !== beforeIds.has(id) ||
        (w.after !== null) !== afterIds.has(id)
      )
        throw new Error(
          "Fremder Ortsbesitzer im Speicherjournal; Dateien bleiben erhalten.",
        );
      for (const raw of [w.before, w.after])
        if (raw !== null && parseLocationDocument(raw).id !== id)
          throw new Error(
            "Ortskennung im Speicherjournal stimmt nicht überein.",
          );
      written.add(id);
    }
    for (const id of new Set([...beforeIds, ...afterIds]))
      if (beforeIds.has(id) !== afterIds.has(id) && !written.has(id))
        throw new Error(
          "Unvollständiges Ortsjournal; Dateien bleiben erhalten.",
        );
  }
  open(): Promise<TerrainSource> {
    return this.mutating(async () => {
      if (this.source) throw new Error("Atlas ist bereits geöffnet.");
      let raw = await this.store.read(this.worldPath);
      if (raw === null) throw new Error("Atlasdatei fehlt.");
      this.baselineWorld = this.parseWorld(raw);
      const recovery = new FileTransaction(
        this.store,
        this.journalPath,
        (p) =>
          p === this.worldPath ||
          p === this.draftPath ||
          this.terrainPath(p) ||
          (this.options.locations === true && p.endsWith(".location")) ||
          (this.options.details === true &&
            (p.endsWith(".city") || p.endsWith(".dungeon"))),
        this.scope,
        (journal) => this.validateRecovery(journal),
      );
      await recovery.recover();
      raw = await this.store.read(this.worldPath);
      if (raw === null)
        throw new Error("Atlasdatei fehlt nach Wiederherstellung.");
      const recovered = this.parseWorld(raw);
      if (recovered.id !== this.baselineWorld.id)
        throw new FileConflict(this.worldPath);
      this.baseline = raw;
      this.baselineWorld = recovered;
      this.draftRaw = await this.store.read(this.draftPath);
      let current = this.baselineWorld;
      let locationDeltas: readonly DraftLocation[] = [];
      let detailDeltas: readonly DraftDetail[] = [];
      if (this.draftRaw !== null) {
        const draft = parseAtlasDraft(this.draftRaw);
        if (draft.baselineWorld !== raw) throw new FileConflict(this.draftPath);
        for (const c of draft.chunks) {
          if ((await this.store.read(this.dataPath(c.file))) !== c.before)
            throw new FileConflict(this.dataPath(c.file));
          this.bases.set(c.file, c.before);
          this.restored.set(c.file, c.after);
        }
        current = this.parseWorld(draft.currentWorld);
        if (draft.version !== 1) {
          if (!this.options.locations)
            throw new Error("Ortsbearbeitung ist noch nicht angeschlossen.");
          locationDeltas = draft.locations;
          if (draft.version === 3) {
            if (!this.options.details)
              throw new Error("Detailentwurf ist noch nicht angeschlossen.");
            detailDeltas = draft.details;
          }
        }
      }
      await this.initializeSource(current, locationDeltas, detailDeltas);
      this.transaction = new FileTransaction(
        this.store,
        this.journalPath,
        (p) =>
          p === this.worldPath ||
          p === this.draftPath ||
          this.terrainPath(p) ||
          this.locationPaths.has(p) ||
          !!this.details?.pathsOwned.includes(p),
        this.scope,
        (journal) => this.validateRecovery(journal),
      );
      return this.source!;
    });
  }
  private live(stamp: number): void {
    if (stamp !== this.generation)
      throw new Error("Veralteter Atlas-Ladevorgang.");
  }
  private async initializeSource(
    current: SpatialWorld,
    locations: readonly DraftLocation[] = [],
    details: readonly DraftDetail[] = [],
    reload: readonly DetailRecord[] = [],
  ): Promise<void> {
    this.graph?.dispose();
    this.graph = undefined;
    this.details?.retire();
    const stamp = ++this.generation;
    this.source = new TerrainSource(
      spatialBase(current),
      new AtlasHistory(),
      (ref) => this.load(ref, stamp),
      this.options.details ? spatialState(current) : undefined,
    );
    this.locations = new LocationOwners(
      this.store,
      this.source,
      this.options,
      (owner) => this.graph?.include(owner),
    );
    await this.locations.initialize(this.baselineWorld, locations);
    this.locationPaths = new Set(this.locations.pathsOwned);
    if (!this.options.details) return;
    this.details = new DetailOwners(this.store, this.source, this.options);
    for (const r of details) await this.details.ensure(r.kind, r.id, r);
    for (const r of reload) await this.details.ensure(r.kind, r.id);
    if (current.version === 2)
      for (const p of current.detailPlacements)
        if (p.parent.kind === "location")
          await this.locations.ensure(p.parent.locationId);
    await this.loadClosure(current);
    this.graph = new SpatialGraph(this.source, [
      ...this.locations.loadedSources,
      ...this.details.sources,
    ]);
  }
  private async loadClosure(world: SpatialWorld): Promise<void> {
    if (!this.details) return;
    const seen = new Set<string>();
    for (;;) {
      const pending = this.locations.loadedSources.filter(
        (s) => !seen.has(s.id),
      );
      if (!pending.length) break;
      for (const s of pending) {
        seen.add(s.id);
        for (const ref of s.read()?.keyLinks ?? [])
          if (ref.kind === "location" && ref.atlasId === world.id)
            await this.locations.ensure(ref.documentId);
      }
    }
    for (const [id, kind] of detailReferences(
      world,
      this.locations.snapshot(),
    )) {
      const owner = await this.details.ensure(kind, id);
      this.graph?.include(owner);
    }
  }
  get spatialGraph(): SpatialGraph {
    if (!this.graph)
      throw new Error("Räumliche Owner sind noch nicht angeschlossen.");
    return this.graph;
  }
  ensureDetail(kind: DetailKind, id: string) {
    const stamp = this.generation;
    return this.exclusive(async () => {
      this.live(stamp);
      if (!this.details)
        throw new Error("Räumliche Details sind noch nicht angeschlossen.");
      const owner = await this.details.ensure(kind, id);
      this.live(stamp);
      this.graph!.include(owner);
      return owner;
    });
  }
  detail(kind: DetailKind, id: string) {
    if (!this.details)
      throw new Error("Räumliche Details sind noch nicht angeschlossen.");
    return this.details.get(kind, id);
  }
  private load(
    ref: TerrainReference,
    stamp = this.generation,
  ): Promise<string> {
    return this.exclusive(async () => {
      this.live(stamp);
      if (this.restored.has(ref.file)) {
        const text = this.restored.get(ref.file);
        if (text === null)
          throw new Error("Gelöschter Landschaftsbereich wird nicht geladen.");
        return text!;
      }
      const raw = await this.store.read(this.dataPath(ref.file));
      if (raw === null)
        throw new Error(
          "Ein Landschaftsbereich fehlt; Atlasdaten bleiben erhalten.",
        );
      this.live(stamp);
      // Never adopt foreign changes as the baseline of an already-read or saved chunk.
      if (this.bases.has(ref.file) && this.bases.get(ref.file) !== raw)
        throw new FileConflict(this.dataPath(ref.file));
      parseTerrainChunk(raw, this.baselineWorld.id, ref);
      this.bases.set(ref.file, raw);
      return raw;
    });
  }
  private snapshot(): Snapshot {
    if (!this.source) throw new Error("Atlas wurde noch nicht geöffnet.");
    return {
      world: this.graph?.world() ?? {
        ...this.source.world,
        chunks: this.source.references(),
        placements: this.source.placements(),
      },
      loaded: new Map(
        this.source
          .loadedChunks()
          .map((c) => [terrainChunkFile(c), serializeTerrainChunk(c)]),
      ),
      locations: this.locations.snapshot(),
      details: this.details?.snapshot() ?? new Map(),
    };
  }
  private captureCurrent(pin: NativeCapturePin): void {
    const result: unknown = pin.assertCurrent();
    if (result !== undefined)
      throw new Error("Captureprüfung muss synchron und schreibfrei sein.");
    if (
      this.source !== pin.source ||
      this.generation !== pin.generation ||
      this.nativeEpoch !== pin.repositoryEpoch ||
      pin.source.history.epoch !== pin.historyEpoch
    )
      throw new Error("Native Atlas-Erfassung ist veraltet.");
  }
  /** Full referenced native bytes; never hydrates Sources, writes files or asserts Campaign authority. */
  captureNative(request: AtlasCaptureRequest): Promise<AtlasNativeCaptureV1> {
    if (!this.source || nativeId(request.worldId) !== this.source.world.id)
      throw new Error(
        "Native Atlas-Erfassung benötigt die aktuelle Weltkennung.",
      );
    const assertCurrent = request.assertCurrent ?? (() => {});
    const guardResult: unknown = assertCurrent();
    if (guardResult !== undefined)
      throw new Error("Captureprüfung muss synchron und schreibfrei sein.");
    const pin: NativeCapturePin = {
      source: this.source,
      generation: this.generation,
      historyEpoch: this.source.history.epoch,
      repositoryEpoch: this.nativeEpoch,
      assertCurrent,
    };
    const snapshot = this.snapshot();
    const extra = (request.additionalLocations ?? []).map((loc) => ({
      id: nativeId(loc.id),
      path: locationPath(loc.path),
    }));
    const seenExtra = new Set<string>(),
      seenPaths = new Set<string>();
    for (const loc of extra) {
      if (seenExtra.has(loc.id) || seenPaths.has(loc.path))
        throw new Error("Mehrdeutiger zusätzlicher Ortsbestand.");
      seenExtra.add(loc.id);
      seenPaths.add(loc.path);
    }
    return this.exclusive(async () => {
      this.captureCurrent(pin);
      const files: AtlasNativeFile[] = [
        {
          kind: "world",
          id: snapshot.world.id,
          path: this.worldPath,
          before: this.baseline,
          after: sameWorld(snapshot.world, this.baselineWorld)
            ? this.baseline
            : this.worldText(snapshot.world),
        },
      ];
      const locations = new Map(snapshot.locations);
      const locationIds = new Set([
        ...snapshot.world.placements.map((p) => p.locationId),
        ...locations.keys(),
      ]);
      const extraLocations = new Set<string>();
      for (const id of locationIds) {
        const bytes = await this.locations.captureBytes(id, locations);
        this.captureCurrent(pin);
        files.push({ kind: "location", id, ...bytes });
        locations.set(id, bytes.after);
      }
      for (const loc of extra) {
        const existing = files.find((file) => file.id === loc.id);
        if (existing) {
          if (existing.kind !== "location" || existing.path !== loc.path)
            throw new Error(
              "Zusätzlicher Ortsbestand besitzt eine fremde Bindung.",
            );
          continue;
        }
        const bytes = await this.store.read(loc.path);
        this.captureCurrent(pin);
        if (bytes === null || parseLocationDocument(bytes).id !== loc.id)
          throw new Error(
            "Zusätzliche Ortsdatei fehlt oder besitzt eine fremde Kennung.",
          );
        files.push({
          kind: "location",
          id: loc.id,
          path: loc.path,
          before: bytes,
          after: bytes,
        });
        locations.set(loc.id, bytes);
        extraLocations.add(loc.id);
      }
      const details = new Map(snapshot.details);
      const references = new Map(detailReferences(snapshot.world, locations));
      for (const record of details.values()) {
        if (
          references.has(record.id) &&
          references.get(record.id) !== record.kind
        )
          throw new Error("Fremder nativer Detailtyp.");
        references.set(record.id, record.kind);
      }
      for (const [id, kind] of references) {
        if (!this.details)
          throw new Error("Native Detailquellen sind nicht angeschlossen.");
        const captured = await this.details.captured(kind, id, details);
        this.captureCurrent(pin);
        const record = captured.record;
        details.set(id, record);
        files.push({
          kind,
          id,
          path: record.path,
          before: captured.saved,
          after: same(record.bytes, captured.saved)
            ? captured.saved
            : record.bytes,
        });
      }
      checkSpatialSnapshot(snapshot.world, locations, details);
      const currentRefs = new Map(
        snapshot.world.chunks.map((ref) => [ref.file, ref]),
      );
      const beforeRefs = new Map(
        this.baselineWorld.chunks.map((ref) => [ref.file, ref]),
      );
      const chunkFiles = new Set([
        ...currentRefs.keys(),
        ...beforeRefs.keys(),
        ...this.bases.keys(),
        ...this.restored.keys(),
      ]);
      for (const file of chunkFiles) {
        const path = this.dataPath(file),
          before = await this.store.read(path);
        this.captureCurrent(pin);
        if (
          (this.bases.has(file) && this.bases.get(file) !== before) ||
          (beforeRefs.has(file) && before === null) ||
          (!beforeRefs.has(file) && !this.bases.has(file) && before !== null)
        )
          throw new FileConflict(path);
        if (beforeRefs.has(file))
          parseTerrainChunk(before!, snapshot.world.id, beforeRefs.get(file)!);
        const ref = currentRefs.get(file);
        const after = ref
          ? (snapshot.loaded.get(file) ??
            (this.restored.has(file) ? this.restored.get(file)! : before))
          : null;
        if (ref) {
          if (after === null)
            throw new Error("Referenzierte Landschaftsdatei fehlt.");
          parseTerrainChunk(after, snapshot.world.id, ref);
        }
        // Nonreferenced files retained by the Source may represent a deleted/new local chunk.
        if (before !== null || after !== null)
          files.push({ kind: "terrain", id: null, path, before, after });
      }
      const draft = await this.store.read(this.draftPath),
        journal = await this.store.read(this.journalPath);
      this.captureCurrent(pin);
      if (draft !== this.draftRaw || journal !== null)
        throw new FileConflict(
          journal !== null ? this.journalPath : this.draftPath,
        );
      const capture = await projectAtlasNativeCapture(
        {
          generation: pin.generation,
          historyEpoch: pin.historyEpoch,
          repositoryEpoch: pin.repositoryEpoch,
        },
        snapshot.world,
        files,
      );
      this.captureCurrent(pin);
      const entry = { pin, extraLocations, draft, journal };
      await this.verifyNativeFiles(capture, entry);
      this.nativeCaptures.set(capture, entry);
      return capture;
    });
  }
  /** Verify only a capture issued by this Repository, under its original consumer guard. */
  verifyNativeCapture(capture: AtlasNativeCaptureV1): Promise<void> {
    const entry = this.nativeCaptures.get(capture);
    if (!entry)
      return Promise.reject(
        new Error("Native Erfassung gehört zu einer fremden Lebensdauer."),
      );
    return this.exclusive(() => this.verifyNativeFiles(capture, entry));
  }
  private async verifyNativeFiles(
    capture: AtlasNativeCaptureV1,
    entry: {
      pin: NativeCapturePin;
      extraLocations: ReadonlySet<string>;
      draft: string | null;
      journal: string | null;
    },
  ): Promise<void> {
    this.captureCurrent(entry.pin);
    for (const file of capture.files) {
      if (file.kind === "location" && !entry.extraLocations.has(file.id!)) {
        if ((await this.locations.resolve(file.id!)) !== file.path)
          throw new FileConflict(file.path);
      } else if (file.kind === "city" || file.kind === "dungeon") {
        if (
          !this.details ||
          (await this.details.resolve(file.kind, file.id!)) !== file.path
        )
          throw new FileConflict(file.path);
      }
      this.captureCurrent(entry.pin);
      if ((await this.store.read(file.path)) !== file.before)
        throw new FileConflict(file.path);
      this.captureCurrent(entry.pin);
    }
    for (const [path, bytes] of [
      [this.draftPath, entry.draft],
      [this.journalPath, entry.journal],
    ] as const) {
      if ((await this.store.read(path)) !== bytes)
        throw new Error("Native Atlas-Dateigrenze ist veraltet.");
      this.captureCurrent(entry.pin);
    }
  }
  private changes(snapshot: Snapshot): readonly DraftChunk[] {
    const refs = new Map(snapshot.world.chunks.map((r) => [r.file, r])),
      beforeRefs = new Map(this.baselineWorld.chunks.map((r) => [r.file, r])),
      files = new Set([
        ...snapshot.loaded.keys(),
        ...this.bases.keys(),
        ...this.restored.keys(),
      ]),
      changes: DraftChunk[] = [];
    for (const file of files) {
      // A referenced but unloaded chunk is retained, never guessed empty or removed.
      const after =
        snapshot.loaded.get(file) ??
        (refs.has(file)
          ? (this.restored.get(file) ?? this.bases.get(file))
          : null);
      if (after === undefined) continue;
      const before = this.bases.get(file) ?? null;
      if (beforeRefs.has(file) && !this.bases.has(file))
        throw new Error("Landschaftsbasis wurde noch nicht geladen.");
      const equivalent =
        before === null || after === null
          ? before === after
          : serializeTerrainChunk(
              parseTerrainChunk(
                before,
                this.baselineWorld.id,
                beforeRefs.get(file)!,
              ),
            ) ===
            serializeTerrainChunk(
              parseTerrainChunk(after, this.baselineWorld.id, refs.get(file)!),
            );
      if (!equivalent) changes.push({ file, before, after });
    }
    return changes.sort((a, b) => a.file.localeCompare(b.file));
  }
  get dirty(): boolean {
    if (!this.source) return false;
    const snapshot = this.snapshot();
    return (
      !sameWorld(snapshot.world, this.baselineWorld) ||
      !!this.changes(snapshot).length ||
      !!this.locations.changes(snapshot.world, snapshot.locations).length ||
      !!this.details?.changes(snapshot.details).length
    );
  }
  get hasDraft(): boolean {
    return this.draftRaw !== null;
  }
  ensureLocation(id: string) {
    const stamp = this.generation;
    return this.exclusive(async () => {
      this.live(stamp);
      const owner = await this.locations.ensure(id);
      this.live(stamp);
      if (this.graph) {
        const state = this.source!.spatialState();
        const world = parseSpatialWorld(
          JSON.stringify({
            ...this.source!.world,
            placements: this.source!.placements(),
            version: state.version,
            ...(state.version === 2
              ? { detailPlacements: state.detailPlacements }
              : {}),
          }),
        );
        await this.loadClosure(world);
        this.graph.validate(this.source!.history);
      }
      return owner;
    });
  }
  location(id: string) {
    return this.locations.get(id);
  }
  createLocation(
    document: LocationDocument,
    placement: LocationPlacement,
  ): boolean {
    const changed = this.locations.create(document, placement);
    this.locationPaths = new Set(this.locations.pathsOwned);
    return changed;
  }
  editLocation(document: LocationDocument): boolean {
    return this.locations.edit(document);
  }
  moveLocation(id: string, position: LocationPlacement["position"]): boolean {
    return this.locations.move(id, position);
  }
  removeLocation(id: string): boolean {
    return this.locations.remove(id);
  }
  /** Explicitly recover only a closed new-copy journal, even without its root file. */
  recoverCopy(): Promise<AtlasRecovery> {
    return this.mutating(async () => {
      if (!this.worldPath.endsWith(".overworld"))
        throw new Error("Die Wiederherstellung benötigt einen Atlasnamen.");
      const transaction = new FileTransaction(
        this.store,
        this.journalPath,
        (p) =>
          p === this.worldPath ||
          p.startsWith("Atlasdaten/") ||
          (this.options.locations === true && p.endsWith(".location")) ||
          (this.options.details === true &&
            (p.endsWith(".city") || p.endsWith(".dungeon"))),
        this.scope,
      );
      return transaction.recover(async (journal) => {
        if ((await this.store.read(this.draftPath)) !== null)
          throw new FileConflict(this.draftPath);
        const root = journal.writes.find((w) => w.path === this.worldPath);
        if (!root || root.before !== null || root.after === null)
          throw new Error(
            "Kein geschlossenes Kopierjournal; Dateien bleiben erhalten.",
          );
        if (this.options.details) {
          validateSpatialCopyJournal(this.worldPath, journal);
          return;
        }
        const world = this.parseWorld(root.after),
          children = new Map(
            world.chunks.map((r) => [`Atlasdaten/${world.id}/${r.file}`, r]),
          );
        const locations = new Map(
          world.placements.map((p) => [
            newLocationPath(p.locationId),
            p.locationId,
          ]),
        );
        if (journal.writes.length !== children.size + locations.size + 1)
          throw new Error(
            "Unvollständiges Kopierjournal; Dateien bleiben erhalten.",
          );
        for (const write of journal.writes) {
          if (write.before !== null || write.after === null)
            throw new Error("Fremder Speicherstand; Dateien bleiben erhalten.");
          if (write === root) continue;
          const ref = children.get(write.path);
          const locationId = locations.get(write.path);
          if (locationId) {
            if (parseLocationDocument(write.after).id !== locationId)
              throw new Error("Fremde Ortskennung im Kopierjournal.");
          } else if (!ref)
            throw new Error("Fremdes Kopierziel; Dateien bleiben erhalten.");
          else parseTerrainChunk(write.after, world.id, ref);
        }
      });
    });
  }
  /** Copy the captured content into a fresh identity; canonical source files stay unchanged. */
  copy(path: string, id: string, name: string): Promise<void> {
    safePath(path);
    const snapshot = this.snapshot(),
      world = this.parseWorld(JSON.stringify({ ...snapshot.world, id, name }));
    if (
      path === this.worldPath ||
      !path.endsWith(".overworld") ||
      id === this.baselineWorld.id
    )
      throw new Error(
        "Die Kopie benötigt einen eigenen Atlasnamen und eine neue Weltkennung.",
      );
    return this.mutating(async () => {
      // Never recover or replace another owner's destination journal/draft.
      for (const target of [path, path + ".draft", path + ".journal"])
        if ((await this.store.read(target)) !== null)
          throw new FileConflict(target);
      await this.persist(this.snapshot());
      if (this.details) return this.copySpatial(path, id, name, snapshot);
      const writes: AtlasFileWrite[] = [
        { path: this.worldPath, before: this.baseline, after: this.baseline },
        { path: path + ".draft", before: null, after: null },
      ];
      for (const ref of snapshot.world.chunks) {
        const sourcePath = this.dataPath(ref.file),
          saved = await this.store.read(sourcePath);
        if (this.bases.has(ref.file) && this.bases.get(ref.file) !== saved)
          throw new FileConflict(sourcePath);
        const text =
          snapshot.loaded.get(ref.file) ?? this.restored.get(ref.file) ?? saved;
        if (text === null || text === undefined)
          throw new Error(
            "Ein Landschaftsbereich fehlt; Kopie wurde nicht angelegt.",
          );
        const chunk = parseTerrainChunk(text, snapshot.world.id, ref);
        writes.push(
          { path: sourcePath, before: saved, after: saved },
          {
            path: `Atlasdaten/${id}/${ref.file}`,
            before: null,
            after: serializeTerrainChunk({ ...chunk, worldId: id }),
          },
        );
      }
      const ids = new Set([
        snapshot.world.id,
        id,
        ...snapshot.world.placements.flatMap((p) => [p.id, p.locationId]),
      ]);
      const allocate = () => {
        const value = nativeId(this.options.makeId?.() ?? crypto.randomUUID());
        if (ids.has(value))
          throw new Error(
            "Die Kopie benötigt neue Orts- und Platzierungskennungen.",
          );
        ids.add(value);
        return value;
      };
      if (
        snapshot.world.placements.some(
          (p) => p.id === id || p.locationId === id,
        )
      )
        throw new Error("Neue Weltkennung kollidiert mit einer Ortskennung.");
      const locationIds = new Map(
        snapshot.world.placements.map((p) => [p.locationId, allocate()]),
      );
      const placements = snapshot.world.placements.map((p) => ({
        ...p,
        id: allocate(),
        locationId: locationIds.get(p.locationId)!,
      }));
      for (const p of snapshot.world.placements) {
        const captured = await this.locations.captured(
          p.locationId,
          snapshot.locations,
        );
        const document = captured.document,
          nextId = locationIds.get(p.locationId)!;
        const keyLinks = document.keyLinks.map((key) =>
          key.atlasId === snapshot.world.id
            ? {
                ...key,
                atlasId: id,
                documentId:
                  key.kind === "location"
                    ? (locationIds.get(key.documentId) ?? key.documentId)
                    : key.documentId,
              }
            : key,
        );
        writes.push(
          {
            path: captured.path,
            before: captured.saved,
            after: captured.saved,
          },
          {
            path: newLocationPath(nextId),
            before: null,
            after: serializeLocationDocument({
              ...document,
              id: nextId,
              keyLinks,
            }),
          },
        );
      }
      writes.push({
        path,
        before: null,
        after: this.worldText({ ...world, placements }),
      });
      const allowed = new Set(writes.map((w) => w.path));
      await new FileTransaction(
        this.store,
        path + ".journal",
        (p) => allowed.has(p),
        this.scope,
      ).commit(writes);
    });
  }
  private async copySpatial(
    path: string,
    id: string,
    name: string,
    snapshot: Snapshot,
  ): Promise<void> {
    const locations = new Map<string, string | null>(),
      details = new Map<string, DetailRecord>();
    const writes: AtlasFileWrite[] = [
      { path: this.worldPath, before: this.baseline, after: this.baseline },
      { path: path + ".draft", before: null, after: null },
    ];
    for (const p of snapshot.world.placements) {
      const captured = await this.locations.captured(
        p.locationId,
        snapshot.locations,
      );
      locations.set(p.locationId, serializeLocationDocument(captured.document));
      writes.push({
        path: captured.path,
        before: captured.saved,
        after: captured.saved,
      });
    }
    for (const [doc, kind] of detailReferences(snapshot.world, locations)) {
      const captured = await this.details!.captured(
        kind,
        doc,
        snapshot.details,
      );
      details.set(doc, captured.record);
      writes.push({
        path: captured.record.path,
        before: captured.saved,
        after: captured.saved,
      });
    }
    const next = remapSpatialCopy(
      snapshot.world,
      locations,
      details,
      id,
      name,
      () => this.options.makeId?.() ?? crypto.randomUUID(),
    );
    for (const ref of snapshot.world.chunks) {
      const sourcePath = this.dataPath(ref.file),
        saved = await this.store.read(sourcePath);
      if (this.bases.has(ref.file) && this.bases.get(ref.file) !== saved)
        throw new FileConflict(sourcePath);
      const text =
        snapshot.loaded.get(ref.file) ?? this.restored.get(ref.file) ?? saved;
      if (text === null || text === undefined)
        throw new Error(
          "Landschaft fehlt; räumliche Kopie wurde nicht angelegt.",
        );
      const chunk = parseTerrainChunk(text, snapshot.world.id, ref);
      writes.push(
        { path: sourcePath, before: saved, after: saved },
        {
          path: `Atlasdaten/${id}/${ref.file}`,
          before: null,
          after: serializeTerrainChunk({ ...chunk, worldId: id }),
        },
      );
    }
    for (const [doc, bytes] of next.locations)
      writes.push({ path: newLocationPath(doc), before: null, after: bytes });
    for (const r of next.details.values())
      writes.push({ path: r.path, before: null, after: r.bytes });
    writes.push({ path, before: null, after: this.worldText(next.world) });
    const allowed = new Set(writes.map((w) => w.path));
    await new FileTransaction(
      this.store,
      path + ".journal",
      (p) => allowed.has(p),
      this.scope,
      (j) => validateSpatialCopyJournal(path, j),
    ).commit(writes);
  }
  /** Retire only this draft; return a fresh saved source without changing canonical files. */
  discard(): Promise<TerrainSource> {
    const snapshot = this.snapshot();
    const unchanged = () => {
      const current = this.snapshot();
      return (
        sameWorld(current.world, snapshot.world) &&
        same([...current.loaded], [...snapshot.loaded]) &&
        same([...current.locations], [...snapshot.locations]) &&
        same([...current.details], [...snapshot.details])
      );
    };
    return this.mutating(async () => {
      if (!unchanged())
        throw new Error("Atlas wurde während des Verwerfens weiterbearbeitet.");
      await this.details?.verify(snapshot.details);
      const writes: AtlasFileWrite[] = [
        { path: this.worldPath, before: this.baseline, after: this.baseline },
        ...[...this.bases].map(([file, before]) => ({
          path: this.dataPath(file),
          before,
          after: before,
        })),
        ...this.locations.guards(),
        ...(this.details?.guards(snapshot.details) ?? []),
        { path: this.draftPath, before: this.draftRaw, after: null },
      ];
      await this.transaction.commit(writes);
      this.draftRaw = null;
      if (!unchanged()) {
        // A newer edit must survive even if it arrived during the draft deletion.
        await this.persist(this.snapshot());
        throw new Error(
          "Atlas wurde während des Verwerfens weiterbearbeitet; Entwurf bleibt erhalten.",
        );
      }
      this.restored.clear();
      this.bases.clear();
      await this.initializeSource(
        this.baselineWorld,
        [],
        [],
        [...snapshot.details.values()],
      );
      return this.source!;
    });
  }
  persistDraft(): Promise<void> {
    const snapshot = this.snapshot();
    return this.mutating(() => this.persist(snapshot));
  }
  private async persist(snapshot: Snapshot): Promise<void> {
    if (this.details)
      checkSpatialSnapshot(
        snapshot.world,
        snapshot.locations,
        snapshot.details,
      );
    const detailChanges = this.details?.changes(snapshot.details) ?? [];
    const chunks = this.changes(snapshot),
      locations = this.locations.changes(snapshot.world, snapshot.locations),
      changed =
        !sameWorld(snapshot.world, this.baselineWorld) ||
        chunks.length > 0 ||
        locations.length > 0 ||
        detailChanges.length > 0;
    const common = {
      kind: "overworld-draft" as const,
      worldId: this.baselineWorld.id,
      baselineWorld: this.baseline,
      currentWorld: this.worldText(snapshot.world),
      chunks,
    };
    const next = changed
      ? serializeAtlasDraft(
          this.details
            ? { ...common, version: 3, locations, details: detailChanges }
            : this.baselineWorld.placements.length ||
                snapshot.world.placements.length ||
                locations.length
              ? { ...common, version: 2, locations }
              : { ...common, version: 1 },
        )
      : null;
    // Check even the clean case: another leaf's draft must never be silently retired.
    if ((await this.store.read(this.draftPath)) !== this.draftRaw)
      throw new FileConflict(this.draftPath);
    if (next === this.draftRaw) return;
    await this.transaction.commit([
      { path: this.draftPath, before: this.draftRaw, after: next },
    ]);
    this.draftRaw = next;
  }
  save(): Promise<void> {
    const snapshot = this.snapshot();
    return this.mutating(async () => {
      // Retain the complete local work even if the subsequent canonical save conflicts.
      await this.persist(snapshot);
      await this.details?.verify(snapshot.details);
      const detailChanges = this.details?.changes(snapshot.details) ?? [];
      const chunks = this.changes(snapshot),
        locations = this.locations.changes(snapshot.world, snapshot.locations),
        worldText = sameWorld(snapshot.world, this.baselineWorld)
          ? this.baseline
          : this.worldText(snapshot.world);
      const writes: AtlasFileWrite[] = chunks.map((c) => ({
        path: this.dataPath(c.file),
        before: c.before,
        after: c.after,
      }));
      writes.push(
        ...locations.map((c) => ({
          path: c.path,
          before: c.before,
          after: c.after,
        })),
      );
      writes.push(
        ...detailChanges.map((c) => ({
          path: c.path,
          before: c.before,
          after: c.after,
        })),
      );
      // Native files used by the captured graph stay guarded even if only the World changed.
      if (this.details) {
        const written = new Set(writes.map((w) => w.path));
        for (const guard of [
          ...this.locations.guards(),
          ...this.details.guards(snapshot.details),
        ])
          if (!written.has(guard.path)) writes.push(guard);
      }
      writes.push(
        { path: this.worldPath, before: this.baseline, after: worldText },
        { path: this.draftPath, before: this.draftRaw, after: null },
      );
      await this.transaction.commit(writes);
      this.baseline = worldText;
      this.baselineWorld = this.parseWorld(worldText);
      for (const c of chunks) this.bases.set(c.file, c.after);
      this.restored.clear();
      this.draftRaw = null;
      this.locations.saved(locations);
      this.details?.saved(detailChanges);
      // The captured save is complete; an edit that arrived during it remains a new draft.
      if (this.dirty) await this.persist(this.snapshot());
    });
  }
}

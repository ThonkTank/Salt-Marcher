import { safePath } from "../../model";
import { FileConflict, type FileStore } from "../../persistence";
import { AtlasHistory, sameAtlasValue, type AtlasValue } from "./atlas-history";
import {
  isTerrainFile,
  parseAtlasDraft,
  serializeAtlasDraft,
  type DraftChunk,
} from "./atlas-draft";
import {
  FileTransaction,
  type AtlasFileWrite,
  type AtlasRecovery,
} from "./file-transaction";
import {
  parseOverworld,
  serializeOverworld,
  type OverworldDocument,
} from "./overworld";
import {
  parseTerrainChunk,
  serializeTerrainChunk,
  terrainChunkFile,
  type TerrainReference,
} from "./terrain-schema";
import { TerrainSource } from "./terrain-source";

interface Snapshot {
  readonly world: OverworldDocument;
  readonly loaded: ReadonlyMap<string, string>;
}
// All Atlas leaves of one backend share the queue, including draft/open operations.
const queues = new WeakMap<object, Promise<unknown>>();
function same(a: unknown, b: unknown): boolean {
  return sameAtlasValue(a as AtlasValue, b as AtlasValue);
}
function sameWorld(a: OverworldDocument, b: OverworldDocument): boolean {
  const normalized = (w: OverworldDocument) => ({
    ...w,
    chunks: [...w.chunks].sort((a, b) => a.file.localeCompare(b.file)),
  });
  return same(normalized(a), normalized(b));
}
export class AtlasRepository {
  readonly draftPath: string;
  readonly journalPath: string;
  private baseline!: string;
  private baselineWorld!: OverworldDocument;
  private draftRaw: string | null = null;
  private bases = new Map<string, string | null>();
  private restored = new Map<string, string | null>();
  private transaction!: FileTransaction;
  private source?: TerrainSource;
  constructor(
    readonly store: FileStore,
    readonly worldPath: string,
    private scope: object = store,
  ) {
    safePath(worldPath);
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
  private dataPath(file: string): string {
    if (!isTerrainFile(file)) throw new Error("Unzulässige Landschaftsdatei.");
    return `Atlasdaten/${this.baselineWorld.id}/${file}`;
  }
  open(): Promise<TerrainSource> {
    return this.exclusive(async () => {
      if (this.source) throw new Error("Atlas ist bereits geöffnet.");
      let raw = await this.store.read(this.worldPath);
      if (raw === null) throw new Error("Atlasdatei fehlt.");
      this.baselineWorld = parseOverworld(raw);
      const prefix = `Atlasdaten/${this.baselineWorld.id}/`;
      this.transaction = new FileTransaction(
        this.store,
        this.journalPath,
        (p) =>
          p === this.worldPath ||
          p === this.draftPath ||
          (p.startsWith(prefix) && isTerrainFile(p.slice(prefix.length))),
        this.scope,
      );
      await this.transaction.recover();
      raw = await this.store.read(this.worldPath);
      if (raw === null)
        throw new Error("Atlasdatei fehlt nach Wiederherstellung.");
      const recovered = parseOverworld(raw);
      if (recovered.id !== this.baselineWorld.id)
        throw new FileConflict(this.worldPath);
      this.baseline = raw;
      this.baselineWorld = recovered;
      this.draftRaw = await this.store.read(this.draftPath);
      let current = this.baselineWorld;
      if (this.draftRaw !== null) {
        const draft = parseAtlasDraft(this.draftRaw);
        if (draft.baselineWorld !== raw) throw new FileConflict(this.draftPath);
        for (const c of draft.chunks) {
          if ((await this.store.read(this.dataPath(c.file))) !== c.before)
            throw new FileConflict(this.dataPath(c.file));
          this.bases.set(c.file, c.before);
          this.restored.set(c.file, c.after);
        }
        current = parseOverworld(draft.currentWorld);
      }
      this.source = new TerrainSource(current, new AtlasHistory(), (ref) =>
        this.load(ref),
      );
      return this.source;
    });
  }
  private load(ref: TerrainReference): Promise<string> {
    return this.exclusive(async () => {
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
      world: { ...this.source.world, chunks: this.source.references() },
      loaded: new Map(
        this.source
          .loadedChunks()
          .map((c) => [terrainChunkFile(c), serializeTerrainChunk(c)]),
      ),
    };
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
      !!this.changes(snapshot).length
    );
  }
  get hasDraft(): boolean {
    return this.draftRaw !== null;
  }
  /** Explicitly recover only a closed new-copy journal, even without its root file. */
  recoverCopy(): Promise<AtlasRecovery> {
    return this.exclusive(async () => {
      if (!this.worldPath.endsWith(".overworld"))
        throw new Error("Die Wiederherstellung benötigt einen Atlasnamen.");
      const transaction = new FileTransaction(
        this.store,
        this.journalPath,
        (p) => p === this.worldPath || p.startsWith("Atlasdaten/"),
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
        const world = parseOverworld(root.after),
          children = new Map(
            world.chunks.map((r) => [`Atlasdaten/${world.id}/${r.file}`, r]),
          );
        if (journal.writes.length !== children.size + 1)
          throw new Error(
            "Unvollständiges Kopierjournal; Dateien bleiben erhalten.",
          );
        for (const write of journal.writes) {
          if (write.before !== null || write.after === null)
            throw new Error("Fremder Speicherstand; Dateien bleiben erhalten.");
          if (write === root) continue;
          const ref = children.get(write.path);
          if (!ref)
            throw new Error("Fremdes Kopierziel; Dateien bleiben erhalten.");
          parseTerrainChunk(write.after, world.id, ref);
        }
      });
    });
  }
  /** Copy the captured content into a fresh identity; canonical source files stay unchanged. */
  copy(path: string, id: string, name: string): Promise<void> {
    safePath(path);
    const snapshot = this.snapshot(),
      world = parseOverworld(JSON.stringify({ ...snapshot.world, id, name }));
    if (
      path === this.worldPath ||
      !path.endsWith(".overworld") ||
      id === this.baselineWorld.id
    )
      throw new Error(
        "Die Kopie benötigt einen eigenen Atlasnamen und eine neue Weltkennung.",
      );
    return this.exclusive(async () => {
      // Never recover or replace another owner's destination journal/draft.
      for (const target of [path, path + ".draft", path + ".journal"])
        if ((await this.store.read(target)) !== null)
          throw new FileConflict(target);
      await this.persist(this.snapshot());
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
      writes.push({ path, before: null, after: serializeOverworld(world) });
      const allowed = new Set(writes.map((w) => w.path));
      await new FileTransaction(
        this.store,
        path + ".journal",
        (p) => allowed.has(p),
        this.scope,
      ).commit(writes);
    });
  }
  /** Retire only this draft; return a fresh saved source without changing canonical files. */
  discard(): Promise<TerrainSource> {
    const snapshot = this.snapshot();
    const unchanged = () => {
      const current = this.snapshot();
      return (
        sameWorld(current.world, snapshot.world) &&
        same([...current.loaded], [...snapshot.loaded])
      );
    };
    return this.exclusive(async () => {
      if (!unchanged())
        throw new Error("Atlas wurde während des Verwerfens weiterbearbeitet.");
      const writes: AtlasFileWrite[] = [
        { path: this.worldPath, before: this.baseline, after: this.baseline },
        ...[...this.bases].map(([file, before]) => ({
          path: this.dataPath(file),
          before,
          after: before,
        })),
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
      this.source = new TerrainSource(
        this.baselineWorld,
        new AtlasHistory(),
        (ref) => this.load(ref),
      );
      return this.source;
    });
  }
  persistDraft(): Promise<void> {
    const snapshot = this.snapshot();
    return this.exclusive(() => this.persist(snapshot));
  }
  private async persist(snapshot: Snapshot): Promise<void> {
    const chunks = this.changes(snapshot),
      changed =
        !sameWorld(snapshot.world, this.baselineWorld) || chunks.length > 0;
    const next = changed
      ? serializeAtlasDraft({
          kind: "overworld-draft",
          version: 1,
          worldId: this.baselineWorld.id,
          baselineWorld: this.baseline,
          currentWorld: serializeOverworld(snapshot.world),
          chunks,
        })
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
    return this.exclusive(async () => {
      // Retain the complete local work even if the subsequent canonical save conflicts.
      await this.persist(snapshot);
      const chunks = this.changes(snapshot),
        worldText = sameWorld(snapshot.world, this.baselineWorld)
          ? this.baseline
          : serializeOverworld(snapshot.world);
      const writes: AtlasFileWrite[] = chunks.map((c) => ({
        path: this.dataPath(c.file),
        before: c.before,
        after: c.after,
      }));
      writes.push(
        { path: this.worldPath, before: this.baseline, after: worldText },
        { path: this.draftPath, before: this.draftRaw, after: null },
      );
      await this.transaction.commit(writes);
      this.baseline = worldText;
      this.baselineWorld = parseOverworld(worldText);
      for (const c of chunks) this.bases.set(c.file, c.after);
      this.restored.clear();
      this.draftRaw = null;
    });
  }
}

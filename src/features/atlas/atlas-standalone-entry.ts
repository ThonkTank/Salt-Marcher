import { FileConflict, type FileStore } from "../../persistence";
import { parseAtlasDraft, isTerrainFile } from "./atlas-draft";
import { detailDocument, detailPath, type DetailKind, type DetailRecord } from "./detail-record";
import type { AtlasSpatialOptions } from "./detail-owners";
import { FileTransaction } from "./file-transaction";
import { locationPath, newLocationPath } from "./location-owners";
import { parseLocationDocument } from "../location/location-schema";
import { parseSpatialWorld, type SpatialWorld } from "./spatial-schema";
import { validateSpatialRecovery } from "./spatial-recovery";
import { checkSpatialSnapshot, detailReferences } from "./spatial-storage";
import { parseTerrainChunk } from "./terrain-schema";

/** Read-only entry evidence, never a Campaign/Registry membership or Save participant. */
export interface AtlasStandaloneEntry {
  readonly worldId: string;
  readonly identities: readonly string[];
  /** Pins the inspected inputs until the existing Repository has completed open/recovery. */
  readonly store: FileStore;
  finishOpen(): Promise<void>;
}

/** Inspect native closure and simulate the existing recovery in memory, before any vault write.
 * No live Sources, History, renderer, or replacement documents are created here.
 */
export async function inspectStandaloneAtlas(
  store: FileStore,
  worldPath: string,
  options: AtlasSpatialOptions,
  assertCurrent: () => void,
): Promise<AtlasStandaloneEntry> {
  const inputs = new Map<string, string | null>(), overlay = new Map<string, string | null>(),
    repairs = new Set<string>(), identities = new Set<string>();
  const inspect: FileStore = {
    read: async (path) => {
      assertCurrent();
      if (overlay.has(path)) return overlay.get(path)!;
      const raw = await store.read(path); assertCurrent();
      inputs.set(path, raw); overlay.set(path, raw); return raw;
    },
    compareAndWrite: async (path, before, after) => {
      if (await inspect.read(path) !== before) throw new FileConflict(path);
      assertCurrent(); repairs.add(path); overlay.set(path, after);
    },
  };
  const required = async (files: Pick<FileStore, "read">, path: string) => {
    const raw = await files.read(path);
    if (raw === null) throw new Error("Native Atlasclosure fehlt: " + path);
    return raw;
  };
  const collect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      // Copy retains shared/catalog definitions. Only document-local identities are reserved.
      if (key === "definitions") continue;
      if (key === "id" && typeof child === "string") identities.add(child);
      else collect(child);
    }
  };
  const resolveLocation = async (id: string) => locationPath(
    await (options.resolveLocation?.(id) ?? Promise.resolve(newLocationPath(id))),
  );
  const resolveDetail = async (worldId: string, kind: DetailKind, id: string) => {
    const paths = await options.resolveDetail?.(worldId, kind, id); assertCurrent();
    if (!paths || paths.length !== 1) throw new Error("Native Detailkennung fehlt oder ist mehrdeutig.");
    return detailPath(kind, paths[0]!);
  };
  const initial = parseSpatialWorld(await required(inspect, worldPath));
  const draftPath = worldPath + ".draft", journalPath = worldPath + ".journal",
    terrainPrefix = `Atlasdaten/${initial.id}/`;
  await new FileTransaction(inspect, journalPath, (path) =>
    path === worldPath || path === draftPath ||
    (path.startsWith(terrainPrefix) && isTerrainFile(path.slice(terrainPrefix.length))) ||
    path.endsWith(".location") || path.endsWith(".city") || path.endsWith(".dungeon"),
  inspect, async (journal) => {
    await validateSpatialRecovery(inspect, worldPath, initial, options, journal);
    for (const side of ["before", "after"] as const) {
      const root = journal.writes.find((write) => write.path === worldPath),
        world = root ? parseSpatialWorld(root[side] ?? "null") : initial;
      for (const ref of world.chunks) {
        const path = terrainPrefix + ref.file, write = journal.writes.find((write) => write.path === path),
          raw = write ? write[side] : await inspect.read(path);
        if (raw === null) throw new Error("Landschaftsclosure im Journal fehlt.");
        parseTerrainChunk(raw, world.id, ref);
      }
    }
    // Even a rolled-back identity must not adopt an existing Campaign owner.
    for (const write of journal.writes) for (const raw of [write.before, write.after]) {
      if (raw === null || write.path === draftPath || write.path.startsWith(terrainPrefix)) continue;
      collect(JSON.parse(raw));
    }
  }, assertCurrent).recover();
  const baseline = await required(inspect, worldPath), world = parseSpatialWorld(baseline);
  if (world.id !== initial.id) throw new FileConflict(worldPath);
  const closure = async (current: SpatialWorld, files: Pick<FileStore, "read">) => {
    collect(current);
    for (const ref of current.chunks)
      parseTerrainChunk(await required(files, `${terrainPrefix}${ref.file}`), current.id, ref);
    const locations = new Map<string, string | null>(), paths = new Set<string>(),
      pending = new Set(current.placements.map((p) => p.locationId));
    for (const id of pending) {
      const path = await resolveLocation(id);
      if (paths.has(path)) throw new Error("Mehrdeutige native Ortsdatei.");
      paths.add(path);
      const raw = await required(files, path), doc = parseLocationDocument(raw);
      if (doc.id !== id) throw new Error("Native Ortsdatei besitzt eine fremde Kennung.");
      locations.set(id, raw); collect(doc);
      for (const ref of doc.keyLinks)
        if (ref.atlasId === current.id && ref.kind === "location") pending.add(ref.documentId);
    }
    const details = new Map<string, DetailRecord>();
    for (const [id, kind] of detailReferences(current, locations)) {
      const path = await resolveDetail(current.id, kind, id), bytes = await required(files, path);
      if (paths.has(path)) throw new Error("Mehrdeutige native Ownerdatei.");
      paths.add(path); collect(detailDocument(kind, id, bytes));
      details.set(id, { kind, id, path, bytes });
    }
    checkSpatialSnapshot(current, locations, details);
  };
  await closure(world, inspect);
  const draftRaw = await inspect.read(draftPath);
  if (draftRaw !== null) {
    const draft = parseAtlasDraft(draftRaw), deltas = new Map<string, string | null>();
    if (draft.baselineWorld !== baseline) throw new FileConflict(draftPath);
    for (const chunk of draft.chunks) {
      const path = terrainPrefix + chunk.file;
      if (await inspect.read(path) !== chunk.before) throw new FileConflict(path);
      deltas.set(path, chunk.after);
    }
    if (draft.version !== 1) for (const location of draft.locations) {
      if (await resolveLocation(location.id) !== location.path ||
          await inspect.read(location.path) !== location.before) throw new FileConflict(location.path);
      deltas.set(location.path, location.after);
    }
    if (draft.version === 3) for (const detail of draft.details) {
      if (await resolveDetail(world.id, detail.kind, detail.id) !== detail.path ||
          await inspect.read(detail.path) !== detail.before) throw new FileConflict(detail.path);
      deltas.set(detail.path, detail.after);
      collect(detailDocument(detail.kind, detail.id, detail.after));
    }
    await closure(parseSpatialWorld(draft.currentWorld), {
      read: (path) => deltas.has(path) ? Promise.resolve(deltas.get(path)!) : inspect.read(path),
    });
  }
  const unchanged = async () => {
    assertCurrent();
    for (const [path, raw] of inputs) {
      if (await store.read(path) !== raw) throw new FileConflict(path);
      assertCurrent();
    }
  };
  await unchanged();
  let opening = true, repairWon = false;
  return {
    worldId: world.id, identities: Object.freeze([...identities]),
    store: {
      read: async (path) => {
        if (!opening) return store.read(path);
        if (!repairWon) assertCurrent();
        const raw = await store.read(path);
        if (!repairWon) assertCurrent();
        if (inputs.has(path) && raw !== inputs.get(path)) throw new FileConflict(path);
        return raw;
      },
      compareAndWrite: async (path, before, after) => {
        // After entry, FileTransaction owns a won old journal, including completion on host closure.
        if (!opening) return store.compareAndWrite(path, before, after);
        if (!repairWon) await unchanged();
        if (!repairs.has(path) || after !== overlay.get(path)) throw new FileConflict(path);
        // The same rule applies to Recovery: revocation blocks attachment, not finishing old paths.
        repairWon = true;
        await store.compareAndWrite(path, before, after);
        inputs.set(path, after);
      },
    },
    finishOpen: async () => { await unchanged(); opening = false; },
  };
}

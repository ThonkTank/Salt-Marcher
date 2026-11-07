import type { FileStore } from "../../persistence";
import { parseAtlasDraft } from "./atlas-draft";
import {
  detailDocument,
  detailPath,
  newDetailPath,
  type DetailKind,
  type DetailRecord,
} from "./detail-record";
import type { AtlasSpatialOptions } from "./detail-owners";
import type { AtlasFileJournal } from "./file-transaction";
import { locationPath, newLocationPath } from "./location-owners";
import { parseLocationDocument } from "../location/location-schema";
import { parseSpatialWorld, type SpatialWorld } from "./spatial-schema";
import { checkSpatialSnapshot, detailReferences } from "./spatial-storage";
import { parseTerrainChunk } from "./terrain-schema";

async function resolve(
  options: AtlasSpatialOptions,
  worldId: string,
  kind: DetailKind,
  id: string,
): Promise<string> {
  const matches = await options.resolveDetail?.(worldId, kind, id);
  if (
    !Array.isArray(matches) ||
    matches.length !== 1 ||
    typeof matches[0] !== "string"
  )
    throw new Error(
      "Journal-Detailowner ist fremd, fehlt oder ist mehrdeutig.",
    );
  return detailPath(kind, matches[0]);
}
/** Validate actual native before/after closure before the existing journal performs any repair. */
export async function validateSpatialRecovery(
  store: FileStore,
  worldPath: string,
  baseline: SpatialWorld,
  options: AtlasSpatialOptions,
  journal: AtlasFileJournal,
): Promise<void> {
  const root = journal.writes.find((w) => w.path === worldPath),
    draftPath = worldPath + ".draft";
  const before = root ? parseSpatialWorld(root.before ?? "null") : baseline,
    after = root ? parseSpatialWorld(root.after ?? "null") : baseline;
  if (before.id !== baseline.id || after.id !== before.id)
    throw new Error("Fremde Welt im räumlichen Journal.");
  const beforeIds = new Set(before.placements.map((p) => p.locationId)),
    afterIds = new Set(after.placements.map((p) => p.locationId));
  const paths = new Map<string, string>();
  for (const id of new Set([...beforeIds, ...afterIds])) {
    const p = beforeIds.has(id)
      ? locationPath(
          await (options.resolveLocation?.(id) ??
            Promise.resolve(newLocationPath(id))),
        )
      : newLocationPath(id);
    if (paths.has(p)) throw new Error("Mehrdeutige Ortsdatei im Journal.");
    paths.set(p, id);
  }
  const native = new Map<
    string,
    {
      kind: DetailKind;
      id: string;
      path: string;
      before: string;
      after: string;
    }
  >();
  for (const w of journal.writes) {
    if (w.path === worldPath) continue;
    if (w.path === draftPath) {
      for (const raw of [w.before, w.after])
        if (raw !== null) {
          const d = parseAtlasDraft(raw);
          if (d.worldId !== before.id)
            throw new Error("Fremder räumlicher Entwurf.");
          if (d.version !== 1)
            for (const l of d.locations) {
              const expected = beforeIds.has(l.id)
                ? locationPath(
                    await (options.resolveLocation?.(l.id) ??
                      Promise.resolve(newLocationPath(l.id))),
                  )
                : newLocationPath(l.id);
              if (l.path !== expected)
                throw new Error("Fremder Ortsentwurfpfad.");
            }
          if (d.version === 3)
            for (const r of d.details)
              if ((await resolve(options, before.id, r.kind, r.id)) !== r.path)
                throw new Error("Fremder Detailentwurfpfad.");
        }
      continue;
    }
    const prefix = `Atlasdaten/${before.id}/`;
    if (w.path.startsWith(prefix)) {
      const file = w.path.slice(prefix.length),
        a = before.chunks.find((r) => r.file === file),
        b = after.chunks.find((r) => r.file === file);
      if ((w.before !== null) !== !!a || (w.after !== null) !== !!b)
        throw new Error("Fremder Landschaftsbereich im Journal.");
      if (w.before !== null) parseTerrainChunk(w.before, before.id, a!);
      if (w.after !== null) parseTerrainChunk(w.after, after.id, b!);
      continue;
    }
    const loc = paths.get(w.path);
    if (loc) {
      if (
        (w.before !== null) !== beforeIds.has(loc) ||
        (w.after !== null) !== afterIds.has(loc)
      )
        throw new Error("Unvollständige Ortsmutation.");
      for (const raw of [w.before, w.after])
        if (raw !== null && parseLocationDocument(raw).id !== loc)
          throw new Error("Fremde Ortskennung.");
      continue;
    }
    const kind: DetailKind | undefined = w.path.endsWith(".city")
      ? "city"
      : w.path.endsWith(".dungeon")
        ? "dungeon"
        : undefined;
    if (!kind || w.before === null || w.after === null)
      throw new Error("Unzulässige Detailmutation; Dateien bleiben erhalten.");
    const id = (JSON.parse(w.before) as { id?: string }).id;
    if (
      typeof id !== "string" ||
      native.has(id) ||
      (await resolve(options, before.id, kind, id)) !== w.path
    )
      throw new Error("Fremder oder mehrfacher Detailowner.");
    detailDocument(kind, id, w.before);
    detailDocument(kind, id, w.after);
    native.set(id, {
      kind,
      id,
      path: w.path,
      before: w.before,
      after: w.after,
    });
  }
  // Draft-only journals never modify canonical documents. Their strict codec and scoped paths suffice.
  if (journal.writes.every((w) => w.path === draftPath)) return;
  for (const id of new Set([...beforeIds, ...afterIds]))
    if (
      beforeIds.has(id) !== afterIds.has(id) &&
      !journal.writes.some((w) => paths.get(w.path) === id)
    )
      throw new Error("Ortsdatei fehlt im Journal.");
  for (const [side, world] of [
    ["before", before],
    ["after", after],
  ] as const) {
    const locations = new Map<string, string | null>();
    for (const [path, id] of paths) {
      const write = journal.writes.find((w) => w.path === path),
        raw = write ? write[side] : await store.read(path);
      const placed = world.placements.some((p) => p.locationId === id);
      if (placed && raw === null) throw new Error("Journal-Ortsclosure fehlt.");
      if (placed) locations.set(id, raw); // Removed locations are not resurrected as navigation targets.
    }
    const refs = new Map(detailReferences(world, locations));
    for (const r of native.values()) {
      if (refs.has(r.id) && refs.get(r.id) !== r.kind)
        throw new Error("Falscher Detailtyp im Journal.");
      refs.set(r.id, r.kind);
    }
    const details = new Map<string, DetailRecord>();
    for (const [id, kind] of refs) {
      const path = await resolve(options, world.id, kind, id),
        w = native.get(id),
        bytes = w ? w[side] : await store.read(path);
      if (bytes === null) throw new Error("Journal-Detailclosure fehlt.");
      detailDocument(kind, id, bytes);
      details.set(id, { kind, id, path, bytes });
    }
    checkSpatialSnapshot(world, locations, details);
  }
}

/** Closed new-copy payloads can be recovered before their new root exists. No existing native owner is adopted. */
export function validateSpatialCopyJournal(
  worldPath: string,
  journal: AtlasFileJournal,
): void {
  const root = journal.writes.find((w) => w.path === worldPath);
  if (!root || root.before !== null || root.after === null)
    throw new Error("Kein geschlossenes räumliches Kopierjournal.");
  const world = parseSpatialWorld(root.after),
    locations = new Map<string, string | null>(),
    details = new Map<string, DetailRecord>();
  const chunks = new Map(
    world.chunks.map((r) => [`Atlasdaten/${world.id}/${r.file}`, r]),
  );
  const locs = new Map(
    world.placements.map((p) => [newLocationPath(p.locationId), p.locationId]),
  );
  for (const w of journal.writes) {
    if (w.before !== null || w.after === null)
      throw new Error("Fremder Kopierspeicherstand.");
    if (w === root) continue;
    const chunk = chunks.get(w.path),
      loc = locs.get(w.path);
    if (chunk) {
      parseTerrainChunk(w.after, world.id, chunk);
      continue;
    }
    if (loc) {
      if (parseLocationDocument(w.after).id !== loc)
        throw new Error("Fremder Kopierort.");
      locations.set(loc, w.after);
      continue;
    }
    const kind = w.path.endsWith(".city")
      ? "city"
      : w.path.endsWith(".dungeon")
        ? "dungeon"
        : undefined;
    const id = (JSON.parse(w.after) as { id?: string }).id;
    if (
      !kind ||
      typeof id !== "string" ||
      details.has(id) ||
      w.path !== newDetailPath(kind, id)
    )
      throw new Error("Fremdes natives Kopierziel.");
    detailDocument(kind, id, w.after);
    details.set(id, { kind, id, path: w.path, bytes: w.after });
  }
  const refs = detailReferences(world, locations);
  if (
    journal.writes.length !== 1 + chunks.size + locs.size + refs.size ||
    locations.size !== locs.size ||
    details.size !== refs.size ||
    [...refs].some(([id, kind]) => details.get(id)?.kind !== kind)
  )
    throw new Error("Unvollständige native Kopierclosure.");
  checkSpatialSnapshot(world, locations, details);
}

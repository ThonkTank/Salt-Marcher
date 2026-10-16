import { sameAtlasValue, type AtlasValue } from "./atlas-history";
import { parseOverworld } from "./overworld";
import { parseSpatialWorld, type SpatialWorld } from "./spatial-schema";
import { checkedDraftDetail, type DraftDetail } from "./detail-record";
import { safePath } from "../../model";
import { parseLocationDocument } from "../location/location-schema";
import { checkedLocationPlacements } from "./location-placement";
import { nativeArray, nativeId, nativeRecord } from "./native-values";
import {
  checkedAxial,
  parseTerrainChunk,
  terrainChunkFile,
} from "./terrain-schema";

export interface DraftChunk {
  readonly file: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface TerrainAtlasDraft {
  readonly kind: "overworld-draft";
  readonly version: 1;
  readonly worldId: string;
  readonly baselineWorld: string;
  readonly currentWorld: string;
  readonly chunks: readonly DraftChunk[];
}
export interface DraftLocation {
  readonly id: string;
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface LocationAtlasDraft extends Omit<TerrainAtlasDraft, "version"> {
  readonly version: 2;
  readonly locations: readonly DraftLocation[];
}
export interface SpatialAtlasDraft extends Omit<LocationAtlasDraft, "version"> {
  readonly version: 3;
  readonly details: readonly DraftDetail[];
}
export type AtlasDraft =
  | TerrainAtlasDraft
  | LocationAtlasDraft
  | SpatialAtlasDraft;
type DraftWorld = SpatialWorld;
export function isTerrainFile(file: string): boolean {
  const match = /^terrain\/0_(-?(?:0|[1-9]\d*))_(-?(?:0|[1-9]\d*))\.json$/.exec(
    file,
  );
  if (!match) return false;
  try {
    const a = { q: Number(match[1]), r: Number(match[2]) };
    checkedAxial(a.q, a.r);
    return terrainChunkFile(a) === file;
  } catch {
    return false;
  }
}
function sameWorld(a: DraftWorld, b: DraftWorld, version: 1 | 2 | 3): boolean {
  return sameAtlasValue(
    {
      ...a,
      chunks: [],
      ...(version >= 2 ? { placements: [] } : {}),
      ...(version === 3 ? { version: 0, detailPlacements: [] } : {}),
    } as unknown as AtlasValue,
    {
      ...b,
      chunks: [],
      ...(version >= 2 ? { placements: [] } : {}),
      ...(version === 3 ? { version: 0, detailPlacements: [] } : {}),
    } as unknown as AtlasValue,
  );
}
/** V2 validates the reserved placement field without activating it in the runtime World parser. */
function draftWorld(raw: string, version: 1 | 2 | 3): DraftWorld {
  if (version === 3) return parseSpatialWorld(raw);
  if (version === 1) return parseOverworld(raw);
  const value = JSON.parse(raw),
    placements = checkedLocationPlacements(value?.placements);
  const world = parseOverworld(JSON.stringify({ ...value, placements: [] }));
  if (placements.some((p) => p.locationId === world.id))
    throw new Error("Ort und Welt benötigen verschiedene Dokumentkennungen.");
  return Object.freeze({ ...world, placements });
}
/** Strict, native deltas. Unknown data is rejected before any file is changed. */
export function checkedAtlasDraft(value: unknown): AtlasDraft {
  const version =
    value && typeof value === "object"
      ? Object.getOwnPropertyDescriptor(value, "version")?.value
      : undefined;
  const keys = [
    "kind",
    "version",
    "worldId",
    "baselineWorld",
    "currentWorld",
    "chunks",
  ];
  const d = nativeRecord(
    value,
    version === 3
      ? [...keys, "locations", "details"]
      : version === 2
        ? [...keys, "locations"]
        : keys,
  );
  if (
    d.kind !== "overworld-draft" ||
    (d.version !== 1 && d.version !== 2 && d.version !== 3) ||
    typeof d.baselineWorld !== "string" ||
    typeof d.currentWorld !== "string" ||
    typeof d.worldId !== "string"
  )
    throw new Error("Unlesbarer Atlasentwurf; Datei bleibt erhalten.");
  const baseline = draftWorld(d.baselineWorld, d.version),
    current = draftWorld(d.currentWorld, d.version);
  if (d.worldId !== baseline.id || !sameWorld(baseline, current, d.version))
    throw new Error(
      "Atlasentwurf gehört zu einer anderen Welt oder einem anderen Maßstab.",
    );
  const beforeRefs = new Map(baseline.chunks.map((r) => [r.file, r])),
    afterRefs = new Map(current.chunks.map((r) => [r.file, r])),
    files = new Set<string>();
  const chunks = nativeArray(d.chunks).map((value) => {
    const c = nativeRecord(value, ["file", "before", "after"]);
    if (
      typeof c.file !== "string" ||
      !isTerrainFile(c.file) ||
      files.has(c.file) ||
      ![c.before, c.after].every((v) => v === null || typeof v === "string") ||
      c.before === c.after
    )
      throw new Error("Ungültiger Landschaftsentwurf; Datei bleibt erhalten.");
    files.add(c.file);
    for (const [value, refs] of [
      [c.before, beforeRefs],
      [c.after, afterRefs],
    ] as const) {
      const ref = refs.get(c.file);
      if (value === null ? !!ref : !ref)
        throw new Error(
          "Entwurf und Landschaftsverweise passen nicht zusammen.",
        );
      if (value !== null)
        parseTerrainChunk(value as string, d.worldId as string, ref!);
    }
    return Object.freeze({
      file: c.file,
      before: c.before as string | null,
      after: c.after as string | null,
    });
  });
  for (const file of new Set([...beforeRefs.keys(), ...afterRefs.keys()]))
    if (
      !sameAtlasValue(
        (beforeRefs.get(file) ?? null) as unknown as AtlasValue,
        (afterRefs.get(file) ?? null) as unknown as AtlasValue,
      ) &&
      !files.has(file)
    )
      throw new Error("Landschaftsänderung fehlt im Atlasentwurf.");
  const common = {
    kind: "overworld-draft" as const,
    worldId: d.worldId,
    baselineWorld: d.baselineWorld,
    currentWorld: d.currentWorld,
    chunks: Object.freeze(chunks),
  };
  if (d.version === 1) return Object.freeze({ ...common, version: 1 });
  const beforeIds = new Set(baseline.placements.map((p) => p.locationId)),
    afterIds = new Set(current.placements.map((p) => p.locationId)),
    ids = new Set<string>(),
    paths = new Set<string>();
  const locations = nativeArray(d.locations).map((value) => {
    const l = nativeRecord(value, ["id", "path", "before", "after"]),
      id = nativeId(l.id);
    if (
      typeof l.path !== "string" ||
      !l.path.endsWith(".location") ||
      ids.has(id) ||
      paths.has(l.path) ||
      id === d.worldId ||
      ![l.before, l.after].every((v) => v === null || typeof v === "string") ||
      l.before === l.after
    )
      throw new Error("Ungültiger Ortsentwurf; Datei bleibt erhalten.");
    safePath(l.path);
    if (l.before === null && l.path !== `Orte/${id}.location`)
      throw new Error("Neuer Ort benötigt seinen eigenen Dateipfad.");
    ids.add(id);
    paths.add(l.path);
    for (const [text, manifest] of [
      [l.before, beforeIds],
      [l.after, afterIds],
    ] as const) {
      if (text === null ? manifest.has(id) : !manifest.has(id))
        throw new Error(
          "Ortsentwurf und Atlasplatzierungen passen nicht zusammen.",
        );
      if (text !== null && parseLocationDocument(text as string).id !== id)
        throw new Error("Ortsentwurf besitzt eine fremde Kennung.");
    }
    return Object.freeze({
      id,
      path: l.path,
      before: l.before as string | null,
      after: l.after as string | null,
    });
  });
  for (const id of new Set([...beforeIds, ...afterIds]))
    if (beforeIds.has(id) !== afterIds.has(id) && !ids.has(id))
      throw new Error("Ortsanlage oder Entfernung fehlt im Atlasentwurf.");
  if (d.version === 2)
    return Object.freeze({
      ...common,
      version: 2,
      locations: Object.freeze(locations),
    });
  const detailIds = new Set<string>();
  const details = nativeArray(d.details).map((value) => {
    const detail = checkedDraftDetail(value);
    if (
      detailIds.has(detail.id) ||
      ids.has(detail.id) ||
      beforeIds.has(detail.id) ||
      afterIds.has(detail.id) ||
      detail.id === d.worldId ||
      paths.has(detail.path)
    )
      throw new Error("Doppelte oder fremde Detailentwurfskennung.");
    detailIds.add(detail.id);
    paths.add(detail.path);
    for (const w of [baseline, current])
      if (
        w.version === 2 &&
        "detailPlacements" in w &&
        w.detailPlacements.some(
          (p) => p.documentId === detail.id && p.kind !== detail.kind,
        )
      )
        throw new Error("Detailentwurf besitzt einen falschen Kartentyp.");
    return detail;
  });
  return Object.freeze({
    ...common,
    version: 3,
    locations: Object.freeze(locations),
    details: Object.freeze(details),
  });
}
export function parseAtlasDraft(raw: string): AtlasDraft {
  return checkedAtlasDraft(JSON.parse(raw));
}
export function serializeAtlasDraft(draft: AtlasDraft): string {
  return JSON.stringify(checkedAtlasDraft(draft), null, 2) + "\n";
}

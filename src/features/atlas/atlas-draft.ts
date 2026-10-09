import { sameAtlasValue, type AtlasValue } from "./atlas-history";
import { parseOverworld, type OverworldDocument } from "./overworld";
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
export interface AtlasDraft {
  readonly kind: "overworld-draft";
  readonly version: 1;
  readonly worldId: string;
  readonly baselineWorld: string;
  readonly currentWorld: string;
  readonly chunks: readonly DraftChunk[];
}
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
function sameWorld(a: OverworldDocument, b: OverworldDocument): boolean {
  return sameAtlasValue(
    { ...a, chunks: [] } as unknown as AtlasValue,
    { ...b, chunks: [] } as unknown as AtlasValue,
  );
}
/** Strict, native deltas. Unknown data is rejected before any file is changed. */
export function parseAtlasDraft(raw: string): AtlasDraft {
  const d = JSON.parse(raw) as AtlasDraft;
  if (
    !d ||
    typeof d !== "object" ||
    Object.keys(d).length !== 6 ||
    ![
      "kind",
      "version",
      "worldId",
      "baselineWorld",
      "currentWorld",
      "chunks",
    ].every((k) => Object.hasOwn(d, k)) ||
    d.kind !== "overworld-draft" ||
    d.version !== 1 ||
    typeof d.baselineWorld !== "string" ||
    typeof d.currentWorld !== "string" ||
    !Array.isArray(d.chunks)
  )
    throw new Error("Unlesbarer Atlasentwurf; Datei bleibt erhalten.");
  const baseline = parseOverworld(d.baselineWorld),
    current = parseOverworld(d.currentWorld);
  if (d.worldId !== baseline.id || !sameWorld(baseline, current))
    throw new Error(
      "Atlasentwurf gehört zu einer anderen Welt oder einem anderen Maßstab.",
    );
  const beforeRefs = new Map(baseline.chunks.map((r) => [r.file, r])),
    afterRefs = new Map(current.chunks.map((r) => [r.file, r])),
    files = new Set<string>();
  const chunks = d.chunks.map((c) => {
    if (
      !c ||
      typeof c !== "object" ||
      Object.keys(c).length !== 3 ||
      !["file", "before", "after"].every((k) => Object.hasOwn(c, k)) ||
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
      if (value !== null) parseTerrainChunk(value, d.worldId, ref!);
    }
    return Object.freeze({ ...c });
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
  return Object.freeze({ ...d, chunks: Object.freeze(chunks) });
}
export function serializeAtlasDraft(draft: AtlasDraft): string {
  return JSON.stringify(parseAtlasDraft(JSON.stringify(draft)), null, 2) + "\n";
}

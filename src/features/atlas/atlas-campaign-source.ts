import { immutable } from "../../model";
import { parseLocationDocument } from "../location/location-schema";
import type { SpatialWorld } from "./spatial-schema";
import { nativeId } from "./native-values";

export interface AtlasCaptureRequest {
  readonly worldId: string;
  /** Consumer pins its expected Context/Registry lifetime. This callback grants no authority. */
  readonly assertCurrent?: () => void;
  /** Explicit native owner inputs, including unplaced records; never inferred Campaign inventory. */
  readonly additionalLocations?: readonly {
    readonly id: string;
    readonly path: string;
  }[];
}
export interface AtlasCaptureBasis {
  readonly generation: number;
  readonly historyEpoch: number;
  readonly repositoryEpoch: number;
}
export interface AtlasNativeFile {
  readonly kind: "world" | "terrain" | "location" | "city" | "dungeon";
  readonly id: string | null;
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface AtlasNativeFileEvidence extends AtlasNativeFile {
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
}
export interface AtlasNativeReference {
  readonly kind: string;
  readonly id: string;
  readonly schema: string;
  /** A Registry/schema owner must classify local/shared/external before Campaign publication. */
  readonly scope: "unclassified";
}
export interface AtlasNativeRecord {
  readonly kind:
    | "world"
    | "location"
    | "location-section"
    | "location-placement"
    | "city-placement"
    | "dungeon-placement";
  readonly id: string;
  readonly payloadDigest: string;
  readonly references: readonly AtlasNativeReference[];
}
export interface AtlasNativeCaptureV1 {
  readonly kind: "atlas-native-capture";
  readonly version: 1;
  readonly coverage: "spatial-closure";
  readonly worldId: string;
  readonly basis: AtlasCaptureBasis;
  readonly world: SpatialWorld;
  readonly files: readonly AtlasNativeFileEvidence[];
  readonly records: readonly AtlasNativeRecord[];
  /** Foreign native payloads remain dependencies, not fabricated City/Dungeon owner inventories. */
  readonly dependencies: readonly {
    readonly kind: "city" | "dungeon";
    readonly id: string;
    readonly payloadDigest: string;
  }[];
  readonly sourceDigest: string;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Canonical object keys; all native arrays (including sections/Markdown) retain their order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort(compare)
        .map((key) => JSON.stringify(key) + ":" + canonical(record[key]))
        .join(",") +
      "}"
    );
  }
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error("Unvollständige native Digestdaten.");
  return text;
}
export async function atlasNativeDigest(bytes: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(bytes),
  );
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("")
  );
}
const reference = (
  kind: string,
  id: string,
  schema: string,
): AtlasNativeReference => ({
  kind,
  id: nativeId(id),
  schema,
  scope: "unclassified",
});

/** Pure projection of already captured native values. No stores, History or Campaign writes. */
export async function projectAtlasNativeCapture(
  basis: AtlasCaptureBasis,
  rawWorld: SpatialWorld,
  rawFiles: readonly AtlasNativeFile[],
): Promise<AtlasNativeCaptureV1> {
  // Clone before the first await; callers retain no mutable arrays/objects in the projection.
  const world: SpatialWorld = JSON.parse(JSON.stringify(rawWorld));
  const input: AtlasNativeFile[] = rawFiles.map((file) => ({ ...file }));
  const capturedBasis = { ...basis };
  const paths = new Set<string>();
  for (const file of input) {
    if (paths.has(file.path))
      throw new Error("Mehrdeutige native Capturedatei.");
    paths.add(file.path);
  }
  input.sort((a, b) => compare(a.path, b.path));
  const files: AtlasNativeFileEvidence[] = [];
  for (const file of input)
    files.push({
      ...file,
      beforeDigest:
        file.before === null ? null : await atlasNativeDigest(file.before),
      afterDigest:
        file.after === null ? null : await atlasNativeDigest(file.after),
    });
  const dependencies: AtlasNativeCaptureV1["dependencies"][number][] =
    files.flatMap((file) =>
      (file.kind === "city" || file.kind === "dungeon") &&
      file.afterDigest !== null
        ? [
            {
              kind: file.kind,
              id: nativeId(file.id),
              payloadDigest: file.afterDigest,
            },
          ]
        : [],
    );
  const ids = new Set(dependencies.map((d) => d.id)),
    records: AtlasNativeRecord[] = [];
  const add = async (
    kind: AtlasNativeRecord["kind"],
    id: string,
    payload: unknown,
    references: readonly AtlasNativeReference[],
  ) => {
    nativeId(id);
    if (ids.has(id)) throw new Error("Mehrdeutige native Capturekennung.");
    ids.add(id);
    records.push({
      kind,
      id,
      payloadDigest: await atlasNativeDigest(
        canonical({ schema: "atlas-native-record-v1", kind, payload }),
      ),
      references,
    });
  };
  const details = world.version === 2 ? world.detailPlacements : [];
  // Terrain is subordinate World payload: equal extents/counts do not imply equal landscape.
  const terrain = files
    .filter((file) => file.kind === "terrain" && file.after !== null)
    .map((file) => ({ path: file.path, bytes: file.after }));
  await add("world", world.id, { document: world, terrain }, [
    ...world.placements.map((p) =>
      reference("location-placement", p.id, "atlas.world.v1"),
    ),
    ...details.map((p) =>
      reference(p.kind + "-placement", p.id, "atlas.world.v2"),
    ),
  ]);
  for (const p of world.placements)
    await add("location-placement", p.id, p, [
      reference("world", world.id, "atlas.location-placement.v1"),
      reference("location", p.locationId, "atlas.location-placement.v1"),
    ]);
  for (const p of details) {
    const refs = [reference(p.kind, p.documentId, "atlas.detail-placement.v1")];
    if (p.parent.kind === "location")
      refs.push(
        reference("location", p.parent.locationId, "atlas.detail-placement.v1"),
      );
    else
      refs.push(
        reference("city", p.parent.cityId, "atlas.detail-placement.v1"),
        reference("building", p.parent.buildingId, "atlas.detail-placement.v1"),
      );
    if (p.kind === "dungeon") {
      refs.push(
        reference("floor", p.surfaceFloorId, "atlas.detail-placement.v1"),
      );
      for (const e of p.entrances)
        refs.push(
          reference("route", e.routeId, "atlas.detail-placement.v1"),
          reference("floor", e.floorId, "atlas.detail-placement.v1"),
          reference("room", e.roomId, "atlas.detail-placement.v1"),
        );
    }
    await add(
      (p.kind + "-placement") as AtlasNativeRecord["kind"],
      p.id,
      p,
      refs,
    );
  }
  for (const file of files) {
    if (file.kind !== "location" || file.after === null) continue;
    const doc = parseLocationDocument(file.after);
    if (doc.id !== file.id) throw new Error("Fremde native Ortskennung.");
    const refs = [
      ...doc.sections.map((s) =>
        reference("location-section", s.id, "atlas.location.v1"),
      ),
      ...doc.detailMaps.map((d) =>
        reference(d.kind, d.documentId, "atlas.location.v1"),
      ),
    ];
    for (const key of doc.keyLinks) {
      if (key.atlasId !== null)
        refs.push(reference("world", key.atlasId, "atlas.key-target.v1"));
      refs.push(
        reference(
          key.kind === "room" ? "dungeon" : "location",
          key.documentId,
          "atlas.key-target.v1",
        ),
      );
      if (key.kind === "room")
        refs.push(reference("room", key.roomId, "atlas.key-target.v1"));
      if (key.sectionId !== null)
        refs.push(reference("section", key.sectionId, "atlas.key-target.v1"));
    }
    await add("location", doc.id, doc, refs);
    for (const section of doc.sections)
      await add("location-section", section.id, section, [
        reference("location", doc.id, "atlas.location.v1"),
      ]);
  }
  records.sort((a, b) => compare(a.id, b.id));
  dependencies.sort((a, b) => compare(a.id, b.id));
  // Epochs bind freshness separately; the digest denotes native content, not a Registry revision.
  const content = {
    schema: "atlas-native-capture-v1",
    world,
    files,
    records,
    dependencies,
  };
  return immutable({
    kind: "atlas-native-capture",
    version: 1,
    coverage: "spatial-closure",
    worldId: world.id,
    basis: capturedBasis,
    world,
    files,
    records,
    dependencies,
    sourceDigest: await atlasNativeDigest(canonical(content)),
  });
}

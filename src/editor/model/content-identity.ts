import {
  HEIGHT_LEVELS,
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  heightSpacing,
  validateHeightTile,
  type Bounds,
  type HeightSnapshot,
} from "./types";

export type ContentIdentity = `height-controls-v1:${string}`;

/** The query includes its complete sparse negative read, not a runtime revision. */
export interface HeightDependency {
  kind: "height";
  bounds: Bounds;
  identity: ContentIdentity;
}

export const HEIGHT_CONTENT_IDENTITY_PREFIX = "height-controls-v1:";
export const HEIGHT_DEPENDENCY_MAX_CONTROLS = 100_000;
const CHUNK_CONTROLS = 256;

export type HeightDependencyInput = Pick<
  HeightSnapshot,
  "bounds" | "levels" | "tiles"
>;

export function validateHeightDependency(value: HeightDependency): void {
  if (
    !value ||
    value.kind !== "height" ||
    typeof value.identity !== "string" ||
    !/^height-controls-v1:[a-f0-9]{64}$/.test(value.identity)
  )
    throw new RangeError("Ungültige Gelände-Inhaltsidentität.");
  assertBounds(value.bounds);
}

export function cloneHeightDependency(
  value: HeightDependency,
): HeightDependency {
  return {
    kind: "height",
    bounds: [...value.bounds],
    identity: value.identity,
  };
}

export function sameHeightDependency(
  a: HeightDependency,
  b: HeightDependency,
): boolean {
  return (
    a.identity === b.identity && a.bounds.every((n, i) => n === b.bounds[i])
  );
}

/**
 * Canonical SHA-256 input for a COMPLETE all-level snapshot.
 * Header: UTF-8 "height-controls-v1\0", then four little-endian Float64 bounds.
 * Records: level Uint8, control X/Y Int32 little-endian, value Float64 little-endian.
 * Order: level, tile Y, tile X, local row, local column. Zero (including -0) is
 * omitted: known sparse absence and explicitly zero height have identical meaning.
 * Only controls with positive cubic support intersecting the closed query count.
 * Empty yielded chunks are budget checkpoints, not additional encoded data.
 */
export function* encodeHeightDependency(
  snapshot: HeightDependencyInput,
): Generator<Uint8Array, void> {
  assertBounds(snapshot.bounds);
  if (
    snapshot.levels.length !== HEIGHT_LEVELS.length ||
    new Set(snapshot.levels).size !== HEIGHT_LEVELS.length ||
    !HEIGHT_LEVELS.every((level) => snapshot.levels.includes(level)) ||
    snapshot.tiles.length > HEIGHT_MAX_ACTION_TILES
  )
    throw new RangeError(
      "Die Inhaltsprüfung benötigt einen vollständigen begrenzten Höhenread.",
    );
  const prefix = new TextEncoder().encode("height-controls-v1\0");
  const header = new Uint8Array(prefix.length + 32);
  header.set(prefix);
  const headerView = new DataView(header.buffer);
  snapshot.bounds.forEach((value, i) =>
    headerView.setFloat64(prefix.length + i * 8, value === 0 ? 0 : value, true),
  );
  yield header;
  const seen = new Set<string>();
  const tiles = [...snapshot.tiles].sort(
    (a, b) => a.level - b.level || a.tileY - b.tileY || a.tileX - b.tileX,
  );
  let examined = 0;
  for (const tile of tiles) {
    validateHeightTile(tile);
    if (seen.has(tile.key))
      throw new RangeError("Doppelte Quelle im Inhaltsread.");
    seen.add(tile.key);
    const step = heightSpacing(tile.level);
    const firstX = Math.max(
      tile.tileX * HEIGHT_TILE_SIZE,
      Math.floor(snapshot.bounds[0] / step) - 1,
      Math.ceil(-WORLD_LIMIT / step),
    );
    const lastX = Math.min(
      (tile.tileX + 1) * HEIGHT_TILE_SIZE - 1,
      Math.ceil(snapshot.bounds[2] / step) + 1,
      Math.floor(WORLD_LIMIT / step),
    );
    const firstY = Math.max(
      tile.tileY * HEIGHT_TILE_SIZE,
      Math.floor(snapshot.bounds[1] / step) - 1,
      Math.ceil(-WORLD_LIMIT / step),
    );
    const lastY = Math.min(
      (tile.tileY + 1) * HEIGHT_TILE_SIZE - 1,
      Math.ceil(snapshot.bounds[3] / step) + 1,
      Math.floor(WORLD_LIMIT / step),
    );
    let bytes = new Uint8Array(CHUNK_CONTROLS * 17);
    let view = new DataView(bytes.buffer);
    let records = 0;
    let steps = 0;
    for (let cy = firstY; cy <= lastY; cy++) {
      for (let cx = firstX; cx <= lastX; cx++) {
        if (++examined > HEIGHT_DEPENDENCY_MAX_CONTROLS)
          throw new RangeError(
            "Der Gelände-Inhaltsread überschreitet sein Kontrollwertebudget.",
          );
        const index =
          (cy - tile.tileY * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE +
          cx -
          tile.tileX * HEIGHT_TILE_SIZE;
        const value = tile.values[index];
        if (value !== 0) {
          const offset = records++ * 17;
          view.setUint8(offset, tile.level);
          view.setInt32(offset + 1, cx, true);
          view.setInt32(offset + 5, cy, true);
          view.setFloat64(offset + 9, value, true);
        }
        if (++steps === CHUNK_CONTROLS) {
          yield bytes.subarray(0, records * 17);
          bytes = new Uint8Array(CHUNK_CONTROLS * 17);
          view = new DataView(bytes.buffer);
          records = steps = 0;
        }
      }
    }
    if (steps || !records) yield bytes.subarray(0, records * 17);
  }
}

/** Convenience for bounded tasks; renderers can advance the encoder themselves. */
export async function heightDependency(
  snapshot: HeightDependencyInput,
  yieldWork?: () => Promise<void>,
): Promise<HeightDependency> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (const chunk of encodeHeightDependency(snapshot)) {
    if (chunk.length) {
      chunks.push(chunk);
      size += chunk.length;
    }
    if (yieldWork) await yieldWork();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return {
    kind: "height",
    bounds: [...snapshot.bounds],
    identity: `${HEIGHT_CONTENT_IDENTITY_PREFIX}${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`,
  };
}

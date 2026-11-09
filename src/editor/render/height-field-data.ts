import { HEIGHT_SUM_SCALE, splineWeights } from "../model/height";
import {
  HEIGHT_OVERVIEW_SIZE,
  minimumCoarseHeightLevel,
} from "../model/overview";
import {
  HEIGHT_MAX_LEVEL,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  cloneHeightTile,
  heightSpacing,
  heightTileKey,
  heightTileSupport,
  intersectsBounds,
  parseHeightTileKey,
  validateHeightTile,
  type Bounds,
  type HeightTile,
} from "../model/types";

/** A source page includes the complete positive cubic reconstruction halo. */
export const HEIGHT_PAGE_SIZE = HEIGHT_TILE_SIZE + 4;
export const HEIGHT_PAGE_TEXELS = HEIGHT_PAGE_SIZE ** 2;
export const HEIGHT_ATLAS_WIDTH = 2048;
export const HEIGHT_MAX_PAGES = Math.floor(
  HEIGHT_ATLAS_WIDTH ** 2 / HEIGHT_PAGE_TEXELS,
);
// Nine source-page slots plus one metadata texel for the separable row layout.
export const HEIGHT_DESCRIPTOR_WIDTH = 4;
export const HEIGHT_DESCRIPTOR_HEIGHT = HEIGHT_MAX_LEVEL + 1;

// Rendering is a derived projection. Values outside this ordinary range retain
// the canonical Float64 projection; they are never clamped or rejected as data.
export const HEIGHT_GPU_MAX_SCALED_VALUE = 1_000_000 / HEIGHT_SUM_SCALE;
export const HEIGHT_GPU_MIN_SCALED_VALUE = 1e-30;
/** Additional absolute error, in feet, from zeroing one projected level. */
export const HEIGHT_GPU_VALUE_ZERO_ERROR =
  HEIGHT_GPU_MIN_SCALED_VALUE * HEIGHT_SUM_SCALE;
/** Positive normalized cubic weights bound the complete 22-level sum. */
export const HEIGHT_GPU_PROJECTION_ZERO_ERROR =
  (HEIGHT_MAX_LEVEL + 1) * HEIGHT_GPU_VALUE_ZERO_ERROR;

export function heightGpuValueSafe(value: number): boolean {
  return (
    Number.isFinite(value) && Math.abs(value) <= HEIGHT_GPU_MAX_SCALED_VALUE
  );
}

/** Retain the low residual instead of truncating a document coefficient to f32. */
export function splitHeightFloat(value: number): [number, number] {
  const high = Math.fround(value);
  return [high, Math.fround(value - high)];
}

/** Only the derived height transport drops tiny values; authors remain Float64. */
export function encodeHeightValue(value: number): [number, number] {
  return Math.abs(value) < HEIGHT_GPU_MIN_SCALED_VALUE
    ? [0, 0]
    : splitHeightFloat(value);
}

interface SourcePage {
  key: string;
  slot: number;
  references: number;
  unsafe: boolean;
  needsEncoding: boolean;
}

interface SourceMetadata {
  source: HeightTile;
  bounds: Bounds;
  magnitude: number;
  safe: boolean;
}

interface SourceRow {
  columns: number[];
  sources: Map<number, SourceMetadata>;
}

interface SourceLevel {
  rows: number[];
  sources: Map<number, SourceRow>;
}

function lowerBound(values: readonly number[], value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

export interface HeightDescriptor {
  data: Float32Array;
  levelCount: number;
  pages: string[];
  fallback: boolean;
  levels: number[];
  width: number;
  pageStride: number;
  horizontalRows: number;
  rows: { first: number; offset: number; count: number }[];
  /** Inclusive lower / exclusive upper sample indices, including the world edge. */
  clip: [number, number, number, number];
}

/**
 * Bounded, derived GPU storage. Each page is linear in the atlas, so a changed
 * 68x68 source window needs one contiguous partial upload, not a wide atlas band.
 * No display-height pixels are calculated here.
 */
export class HeightSourceAtlas {
  readonly sources = new Map<string, HeightTile>();
  /** Sorted local index; source validation and coefficient scans happen on writes. */
  private levels = new Map<number, SourceLevel>();
  private pages = new Map<string, SourcePage>();
  private slots = new Map<number, SourcePage>();
  private free: number[] = [];
  private nextSlot = 0;
  private capacity = 16;
  private growth: {
    data: Float32Array;
    capacity: number;
    copied: number;
  } | null = null;
  private pageEncodingBytes = 0;
  private dirty = new Set<number>();
  private allocation = true;
  data = new Float32Array(
    HEIGHT_ATLAS_WIDTH *
      Math.ceil((16 * HEIGHT_PAGE_TEXELS) / HEIGHT_ATLAS_WIDTH) *
      2,
  );

  get height(): number {
    return this.data.length / 2 / HEIGHT_ATLAS_WIDTH;
  }

  get sourceBytes(): number {
    return this.sources.size * HEIGHT_TILE_SIZE ** 2 * 8;
  }

  get pageCount(): number {
    return this.pages.size;
  }

  /** Both old and replacement buffers are live until a growth copy is complete. */
  get preparationBytes(): number {
    return (this.growth?.data.byteLength ?? 0) + this.pageEncodingBytes;
  }

  /** Additional peak CPU reserve required before the next page can start. */
  get nextPageAllocationBytes(): number {
    const pageBytes = HEIGHT_PAGE_TEXELS * 8;
    if (
      this.growth ||
      this.free.length ||
      this.nextSlot < this.capacity ||
      this.nextSlot >= HEIGHT_MAX_PAGES
    )
      return pageBytes;
    const capacity = Math.min(HEIGHT_MAX_PAGES, this.capacity * 2);
    return (
      HEIGHT_ATLAS_WIDTH *
        Math.ceil((capacity * HEIGHT_PAGE_TEXELS) / HEIGHT_ATLAS_WIDTH) *
        8 +
      pageBytes
    );
  }

  get pendingTexels(): number {
    return this.allocation
      ? this.data.length / 2
      : this.dirty.size * HEIGHT_PAGE_TEXELS;
  }

  /** GPU storage was lost; the retained CPU mirror must be uploaded completely. */
  invalidateUploads(): void {
    this.allocation = true;
  }

  updateSources(
    tiles: readonly HeightTile[],
    removed: readonly string[] = [],
  ): Bounds[] {
    const changed = new Set<string>();
    const bounds: Bounds[] = [];
    for (const key of removed) {
      const previous = this.sources.get(key);
      if (!previous) continue;
      this.sources.delete(key);
      this.removeMetadata(previous);
      changed.add(key);
      bounds.push(heightTileSupport(previous));
    }
    for (const tile of tiles) {
      validateHeightTile(tile);
      const previous = this.sources.get(tile.key);
      if (
        previous &&
        previous.values.every((value, i) => value === tile.values[i])
      )
        continue;
      const owned = cloneHeightTile(tile);
      this.sources.set(tile.key, owned);
      this.writeMetadata(owned);
      changed.add(tile.key);
      bounds.push(heightTileSupport(tile));
    }
    const affected = new Set<SourcePage>();
    for (const key of changed) {
      const at = parseHeightTileKey(key);
      for (let y = at.tileY - 1; y <= at.tileY + 1; y++)
        for (let x = at.tileX - 1; x <= at.tileX + 1; x++) {
          const page = this.pages.get(heightTileKey(at.level, x, y));
          if (page) affected.add(page);
        }
    }
    // Encoding belongs to selected display preparation, never to an unbounded
    // eager re-projection of every resident page touched by an author batch.
    for (const page of affected) page.needsEncoding = true;
    return bounds;
  }

  private writeMetadata(source: HeightTile): void {
    let level = this.levels.get(source.level);
    if (!level) {
      level = { rows: [], sources: new Map() };
      this.levels.set(source.level, level);
    }
    let row = level.sources.get(source.tileY);
    if (!row) {
      row = { columns: [], sources: new Map() };
      level.sources.set(source.tileY, row);
      level.rows.splice(lowerBound(level.rows, source.tileY), 0, source.tileY);
    }
    if (!row.sources.has(source.tileX))
      row.columns.splice(
        lowerBound(row.columns, source.tileX),
        0,
        source.tileX,
      );
    let magnitude = 0;
    let safe = true;
    for (const value of source.values) {
      magnitude = Math.max(magnitude, Math.abs(value));
      safe &&= heightGpuValueSafe(value / HEIGHT_SUM_SCALE);
    }
    row.sources.set(source.tileX, {
      source,
      bounds: heightTileSupport(source),
      magnitude,
      safe,
    });
  }

  private removeMetadata(source: HeightTile): void {
    const level = this.levels.get(source.level)!;
    const row = level.sources.get(source.tileY)!;
    row.sources.delete(source.tileX);
    row.columns.splice(lowerBound(row.columns, source.tileX), 1);
    if (row.columns.length) return;
    level.sources.delete(source.tileY);
    level.rows.splice(lowerBound(level.rows, source.tileY), 1);
    if (!level.rows.length) this.levels.delete(source.level);
  }

  private *metadataIn(
    bounds: Bounds,
    minimum: number,
    maximum: number,
  ): Generator<SourceMetadata> {
    for (
      let at = Math.max(0, Math.ceil(minimum));
      at <= Math.min(HEIGHT_MAX_LEVEL, maximum);
      at++
    ) {
      const level = this.levels.get(at);
      if (!level) continue;
      const spacing = heightSpacing(at);
      const span = HEIGHT_TILE_SIZE * spacing;
      // Include cubic support on both sides, then use the exact intersection
      // predicate at boundaries. Binary search skips every unrelated row/column.
      const x0 = Math.floor((bounds[0] - 2 * spacing) / span);
      const x1 = Math.floor((bounds[2] + 2 * spacing) / span);
      const y0 = Math.floor((bounds[1] - 2 * spacing) / span);
      const y1 = Math.floor((bounds[3] + 2 * spacing) / span);
      for (let y = lowerBound(level.rows, y0); y < level.rows.length; y++) {
        const tileY = level.rows[y];
        if (tileY > y1) break;
        const row = level.sources.get(tileY)!;
        for (let x = lowerBound(row.columns, x0); x < row.columns.length; x++) {
          const tileX = row.columns[x];
          if (tileX > x1) break;
          const metadata = row.sources.get(tileX)!;
          if (intersectsBounds(metadata.bounds, bounds)) yield metadata;
        }
      }
    }
  }

  /** Immutable local inputs for the exceptional Float64 projection. */
  sourcesIn(
    bounds: Bounds,
    minimum = 0,
    maximum = HEIGHT_MAX_LEVEL,
  ): HeightTile[] {
    return [...this.metadataIn(bounds, minimum, maximum)].map(
      ({ source }) => source,
    );
  }

  safeIn(bounds: Bounds, minimum = 0, maximum = HEIGHT_MAX_LEVEL): boolean {
    for (const metadata of this.metadataIn(bounds, minimum, maximum))
      if (!metadata.safe) return false;
    return true;
  }

  /** Positive normalized spline weights cannot exceed a level's coefficient maximum. */
  magnitudeIn(bounds: Bounds, minimum = 0, maximum = HEIGHT_MAX_LEVEL): number {
    const levels = new Map<number, number>();
    for (const { source, magnitude } of this.metadataIn(
      bounds,
      minimum,
      maximum,
    )) {
      levels.set(
        source.level,
        Math.max(levels.get(source.level) ?? 0, magnitude),
      );
    }
    return [...levels.values()].reduce((sum, magnitude) => sum + magnitude, 0);
  }

  pageRanges(keys: readonly string[]): [number, number][] {
    return keys.flatMap((key) => {
      const page = this.pages.get(key);
      return page
        ? [
            [
              page.slot * HEIGHT_PAGE_TEXELS,
              (page.slot + 1) * HEIGHT_PAGE_TEXELS,
            ] as [number, number],
          ]
        : [];
    });
  }

  pagesPending(keys: readonly string[]): boolean {
    return (
      this.allocation ||
      keys.some((key) => {
        const page = this.pages.get(key);
        return !page || page.needsEncoding || this.dirty.has(page.slot);
      })
    );
  }

  private hasSupport(level: number, tileX: number, tileY: number): boolean {
    for (let y = tileY - 1; y <= tileY + 1; y++)
      for (let x = tileX - 1; x <= tileX + 1; x++)
        if (this.sources.has(heightTileKey(level, x, y))) return true;
    return false;
  }

  private *acquireSteps(
    level: number,
    tileX: number,
    tileY: number,
  ): Generator<void, SourcePage | null, void> {
    if (!this.hasSupport(level, tileX, tileY)) return null;
    const key = heightTileKey(level, tileX, tileY);
    for (;;) {
      // No page can write to the old buffer midway through this copy. Multiple
      // interrupted descriptors resume the same one replacement, never fork it.
      if (this.growth) {
        const growth = this.growth;
        const end = Math.min(this.data.length, growth.copied + 16_384);
        growth.data.set(this.data.subarray(growth.copied, end), growth.copied);
        growth.copied = end;
        if (end === this.data.length) {
          this.data = growth.data;
          this.capacity = growth.capacity;
          this.growth = null;
          this.allocation = true;
        }
        yield;
        continue;
      }
      let page = this.pages.get(key);
      if (!page) {
        const slot = this.free.at(-1) ?? this.nextSlot;
        if (slot >= HEIGHT_MAX_PAGES)
          throw new Error(
            "Die sichtbaren Höhenquellen überschreiten das GPU-Budget.",
          );
        if (slot >= this.capacity) {
          const capacity = Math.min(HEIGHT_MAX_PAGES, this.capacity * 2);
          this.growth = {
            data: new Float32Array(
              HEIGHT_ATLAS_WIDTH *
                Math.ceil(
                  (capacity * HEIGHT_PAGE_TEXELS) / HEIGHT_ATLAS_WIDTH,
                ) *
                2,
            ),
            capacity,
            copied: 0,
          };
          yield;
          continue;
        }
        if (this.free.length) this.free.pop();
        else this.nextSlot++;
        page = { key, slot, references: 0, unsafe: false, needsEncoding: true };
        this.pages.set(key, page);
        this.slots.set(slot, page);
      }
      page.references++;
      let completed = false;
      try {
        if (page.needsEncoding) yield* this.writePageSteps(page);
        completed = true;
        return page;
      } finally {
        if (!completed) this.release([page.key]);
      }
    }
  }

  release(keys: readonly string[]): void {
    for (const key of keys) {
      const page = this.pages.get(key);
      if (!page || --page.references > 0) continue;
      this.pages.delete(key);
      this.slots.delete(page.slot);
      this.dirty.delete(page.slot);
      this.free.push(page.slot);
    }
  }

  private *writePageSteps(page: SourcePage): Generator<void, void, void> {
    const { level, tileX, tileY } = parseHeightTileKey(page.key);
    const spacing = heightSpacing(level);
    let unsafe = false;
    const encoded = new Float32Array(HEIGHT_PAGE_TEXELS * 2);
    this.pageEncodingBytes += encoded.byteLength;
    // A complete cubic page references only these nine source tiles. Do not
    // rebuild a string key and hash-map lookup for every one of its 4,624 cells.
    const neighbours: (HeightTile | undefined)[] = [];
    for (let y = tileY - 1; y <= tileY + 1; y++)
      for (let x = tileX - 1; x <= tileX + 1; x++)
        neighbours.push(this.sources.get(heightTileKey(level, x, y)));
    try {
      for (let y = 0; y < HEIGHT_PAGE_SIZE; y++) {
        const cy = tileY * HEIGHT_TILE_SIZE + y - 2;
        const sy = Math.floor(cy / HEIGHT_TILE_SIZE);
        for (let x = 0; x < HEIGHT_PAGE_SIZE; x++) {
          const cx = tileX * HEIGHT_TILE_SIZE + x - 2;
          const sx = Math.floor(cx / HEIGHT_TILE_SIZE);
          const source = neighbours[(sy - tileY + 1) * 3 + sx - tileX + 1];
          const value =
            source &&
            Math.abs(cx * spacing) <= WORLD_LIMIT &&
            Math.abs(cy * spacing) <= WORLD_LIMIT
              ? source.values[
                  (cy - sy * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE +
                    cx -
                    sx * HEIGHT_TILE_SIZE
                ] / HEIGHT_SUM_SCALE
              : 0;
          const safe = heightGpuValueSafe(value);
          if (!safe) unsafe = true;
          if (safe && Math.abs(value) >= HEIGHT_GPU_MIN_SCALED_VALUE) {
            const offset = (y * HEIGHT_PAGE_SIZE + x) * 2;
            const high = Math.fround(value);
            encoded[offset] = high;
            encoded[offset + 1] = Math.fround(value - high);
          }
        }
        if (y % 8 === 7) yield;
      }
      // A partial page never replaces the last complete transport or receives an
      // upload receipt. Publish its one small buffer only after all rows finish.
      this.data.set(encoded, page.slot * HEIGHT_PAGE_TEXELS * 2);
      page.unsafe = unsafe;
      page.needsEncoding = false;
      this.dirty.add(page.slot);
    } finally {
      this.pageEncodingBytes -= encoded.byteLength;
    }
  }

  descriptor(
    bounds: Bounds,
    power: number,
    selection: { minimum?: number; maximum?: number; include?: number } = {},
  ): HeightDescriptor {
    return finishPreparation(this.descriptorSteps(bounds, power, selection));
  }

  /** One bounded page encoding per step; cancellation releases unpublished refs. */
  *descriptorSteps(
    bounds: Bounds,
    power: number,
    selection: { minimum?: number; maximum?: number; include?: number } = {},
  ): Generator<void, HeightDescriptor, void> {
    const minimum = selection.minimum ?? minimumCoarseHeightLevel(power);
    const maximum = selection.maximum ?? HEIGHT_MAX_LEVEL;
    const selected = new Set<number>();
    for (const { source } of this.metadataIn(bounds, minimum, maximum))
      selected.add(source.level);
    if (selection.include !== undefined)
      for (const { source } of this.metadataIn(
        bounds,
        selection.include,
        selection.include,
      ))
        selected.add(source.level);
    const levels = [...selected].sort((a, b) => b - a);
    // A small brush may author below the presentation's coarse/fine split.
    // Its contribution uses this exact output lattice, with as many source pages
    // as its finer spacing requires; it must never be silently downsampled.
    const pageStride = Math.max(
      3,
      levels.length
        ? Math.ceil(
            (HEIGHT_OVERVIEW_SIZE * 2 ** power) /
              (HEIGHT_TILE_SIZE *
                heightSpacing(levels.at(-1) ?? Math.min(21, minimum))),
          ) + 1
        : 3,
    );
    if (pageStride > 16)
      throw new RangeError(
        "Der lokale Höhenbeitrag benötigt zu viele Quellseiten.",
      );
    const pageColumns = Math.ceil((pageStride * pageStride) / 4);
    const width = pageColumns + 1;
    const data = new Float32Array(width * HEIGHT_DESCRIPTOR_HEIGHT * 4);
    const pages: string[] = [];
    const step = 2 ** power;
    const rows: HeightDescriptor["rows"] = [];
    let horizontalRows = 0;
    let fallback = false;
    let completed = false;
    try {
      for (let index = 0; index < levels.length; index++) {
        const level = levels[index];
        const spacing = heightSpacing(level);
        const x = bounds[0] + step / 2;
        const y = bounds[1] + step / 2;
        const ix = Math.floor(x / spacing);
        const iy = Math.floor(y / spacing);
        const tx = Math.floor(ix / HEIGHT_TILE_SIZE);
        const ty = Math.floor(iy / HEIGHT_TILE_SIZE);
        const offset = index * width * 4;
        const first = iy - ty * HEIGHT_TILE_SIZE - 1;
        const last =
          Math.floor((bounds[3] - step / 2) / spacing) -
          ty * HEIGHT_TILE_SIZE +
          2;
        const count = last - first + 1;
        rows.push({ first, offset: horizontalRows, count });
        data.set(
          [first, horizontalRows, count, level],
          offset + pageColumns * 4,
        );
        horizontalRows += count;
        for (let py = 0; py < pageStride; py++)
          for (let px = 0; px < pageStride; px++) {
            const page = yield* this.acquireSteps(level, tx + px, ty + py);
            data[offset + py * pageStride + px] = page?.slot ?? -1;
            if (page) {
              pages.push(page.key);
              fallback ||= page.unsafe;
            }
            yield;
          }
      }
      const first = (origin: number) =>
        Math.max(
          0,
          Math.min(128, Math.ceil((-WORLD_LIMIT - origin) / step - 0.5)),
        );
      const last = (origin: number) =>
        Math.max(
          0,
          Math.min(128, Math.floor((WORLD_LIMIT - origin) / step - 0.5) + 1),
        );
      completed = true;
      return {
        data,
        levelCount: levels.length,
        pages,
        fallback,
        levels,
        width,
        pageStride,
        horizontalRows,
        rows,
        clip: [
          first(bounds[0]),
          first(bounds[1]),
          last(bounds[0]),
          last(bounds[1]),
        ],
      };
    } finally {
      if (!completed) this.release(pages);
    }
  }

  /** Merged linear texel ranges. An allocation uploads its complete new buffer. */
  takeUpdates(): { allocation: boolean; ranges: [number, number][] } {
    const allocation = this.allocation;
    this.allocation = false;
    const slots = [...this.dirty].sort((a, b) => a - b);
    this.dirty.clear();
    if (allocation) return { allocation, ranges: [[0, this.data.length / 2]] };
    const ranges: [number, number][] = [];
    for (const slot of slots) {
      const start = slot * HEIGHT_PAGE_TEXELS;
      const previous = ranges.at(-1);
      if (previous && previous[1] === start) previous[1] += HEIGHT_PAGE_TEXELS;
      else ranges.push([start, start + HEIGHT_PAGE_TEXELS]);
    }
    return { allocation, ranges };
  }
}

function finishPreparation<T>(steps: Generator<void, T, void>): T {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

interface HeightAxes {
  data: Float32Array;
  width: number;
  height: number;
}

/** Source-independent cubic weights, shared by all pixels of each raster row/column. */
export function createHeightAxes(
  bounds: Bounds,
  power: number,
  levels: readonly number[],
): HeightAxes {
  return finishPreparation(createHeightAxesSteps(bounds, power, levels));
}

/** Pure preparation; never calculate an entire dense 22-level transport at once. */
export function* createHeightAxesSteps(
  bounds: Bounds,
  power: number,
  levels: readonly number[],
): Generator<void, HeightAxes, void> {
  const width = levels.length ? HEIGHT_OVERVIEW_SIZE * 5 : 1;
  const height = Math.max(1, levels.length * 2);
  const data = new Float32Array(width * height * 2);
  const step = 2 ** power;
  for (let level = 0; level < levels.length; level++) {
    const spacing = heightSpacing(levels[level]);
    for (let axis = 0; axis < 2; axis++) {
      const origin = bounds[axis];
      const first = Math.floor((origin + step / 2) / spacing);
      const controlOrigin =
        Math.floor(first / HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE;
      for (let pixel = 0; pixel < HEIGHT_OVERVIEW_SIZE; pixel++) {
        const position = origin + (pixel + 0.5) * step;
        const index = Math.floor(position / spacing);
        const weights = splineWeights((position - index * spacing) / spacing);
        const offset = ((level * 2 + axis) * width + pixel * 5) * 2;
        data[offset] = index - controlOrigin;
        for (let weight = 0; weight < 4; weight++)
          data.set(splitHeightFloat(weights[weight]), offset + 2 + weight * 2);
        if (pixel % 16 === 15) yield;
      }
    }
  }
  return { data, width, height };
}

/** The exact horizontal stencil rows needed by a submitted output rectangle. */
export function createHeightProjection(
  descriptor: HeightDescriptor,
  axes: ReturnType<typeof createHeightAxes>,
  rect: readonly [number, number, number, number],
): {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  samples: number;
} {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  let samples = 0;
  const [x0, y0, x1, y1] = rect;
  if (x0 >= x1 || y0 >= y1)
    return {
      positions: new Float32Array(),
      uvs: new Float32Array(),
      indices: new Uint32Array(),
      samples,
    };
  for (let level = 0; level < descriptor.levelCount; level++) {
    const { first, offset, count } = descriptor.rows[level];
    const axis = (level * 2 + 1) * axes.width * 2;
    const from = axes.data[axis + y0 * 10] - 1 - first;
    const to = axes.data[axis + (y1 - 1) * 10] + 3 - first;
    const index = positions.length / 2;
    positions.push(
      x0 / 128,
      (offset + from) / descriptor.horizontalRows,
      x1 / 128,
      (offset + from) / descriptor.horizontalRows,
      x1 / 128,
      (offset + to) / descriptor.horizontalRows,
      x0 / 128,
      (offset + to) / descriptor.horizontalRows,
    );
    // UV.y selects the level and its local control row. Each level is one quad,
    // so the fragment needs one metadata fetch rather than a scan over levels.
    uvs.push(
      x0 / 128,
      level + from / count,
      x1 / 128,
      level + from / count,
      x1 / 128,
      level + to / count,
      x0 / 128,
      level + to / count,
    );
    indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
    samples += (x1 - x0) * (to - from);
  }
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    samples,
  };
}

export function encodeHeightOverview(values?: Float64Array): {
  data: Float32Array;
  fallback: boolean;
  /** Absolute magnitude and extra tiny-value transport error, both in feet. */
  magnitude: number;
  encodingError: number;
} {
  const data = new Float32Array(HEIGHT_OVERVIEW_SIZE ** 2 * 2);
  let fallback = false;
  let magnitude = 0;
  let encodingError = 0;
  if (values)
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      magnitude = Math.max(magnitude, Math.abs(value) * HEIGHT_SUM_SCALE);
      if (!heightGpuValueSafe(value)) fallback = true;
      else {
        data.set(encodeHeightValue(value), i * 2);
        if (value !== 0 && Math.abs(value) < HEIGHT_GPU_MIN_SCALED_VALUE)
          encodingError = HEIGHT_GPU_VALUE_ZERO_ERROR;
      }
    }
  return { data, fallback, magnitude, encodingError };
}

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
export const HEIGHT_DESCRIPTOR_WIDTH = 3;
export const HEIGHT_DESCRIPTOR_HEIGHT = HEIGHT_MAX_LEVEL + 1;

// Rendering is a derived projection. Values outside this ordinary range retain
// the canonical Float64 projection; they are never clamped or rejected as data.
export const HEIGHT_GPU_MAX_SCALED_VALUE = 1_000_000 / HEIGHT_SUM_SCALE;
export const HEIGHT_GPU_MIN_SCALED_VALUE = 1e-30;

export function heightGpuValueSafe(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value) <= HEIGHT_GPU_MAX_SCALED_VALUE &&
    (value === 0 || Math.abs(value) >= HEIGHT_GPU_MIN_SCALED_VALUE)
  );
}

/** Retain the low residual instead of truncating a document coefficient to f32. */
export function splitHeightFloat(value: number): [number, number] {
  const high = Math.fround(value);
  return [high, Math.fround(value - high)];
}

interface SourcePage {
  key: string;
  slot: number;
  references: number;
  unsafe: boolean;
}

export interface HeightDescriptor {
  data: Float32Array;
  levelCount: number;
  pages: string[];
  fallback: boolean;
  levels: number[];
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
  private pages = new Map<string, SourcePage>();
  private slots = new Map<number, SourcePage>();
  private free: number[] = [];
  private nextSlot = 0;
  private capacity = 16;
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

  get pendingTexels(): number {
    return this.allocation
      ? this.data.length / 2
      : this.dirty.size * HEIGHT_PAGE_TEXELS;
  }

  /** GPU storage was lost; the retained CPU mirror must be uploaded completely. */
  invalidateUploads(): void {
    this.allocation = true;
  }

  replaceSources(tiles: readonly HeightTile[]): void {
    this.sources.clear();
    for (const tile of tiles) {
      validateHeightTile(tile);
      this.sources.set(tile.key, cloneHeightTile(tile));
    }
    for (const page of this.pages.values()) this.writePage(page);
  }

  updateSources(
    tiles: readonly HeightTile[],
    removed: readonly string[] = [],
  ): void {
    const changed = new Set<string>(removed);
    for (const key of removed) this.sources.delete(key);
    for (const tile of tiles) {
      validateHeightTile(tile);
      this.sources.set(tile.key, cloneHeightTile(tile));
      changed.add(tile.key);
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
    for (const page of affected) this.writePage(page);
  }

  private hasSupport(level: number, tileX: number, tileY: number): boolean {
    for (let y = tileY - 1; y <= tileY + 1; y++)
      for (let x = tileX - 1; x <= tileX + 1; x++)
        if (this.sources.has(heightTileKey(level, x, y))) return true;
    return false;
  }

  private acquire(
    level: number,
    tileX: number,
    tileY: number,
  ): SourcePage | null {
    if (!this.hasSupport(level, tileX, tileY)) return null;
    const key = heightTileKey(level, tileX, tileY);
    let page = this.pages.get(key);
    if (!page) {
      const slot = this.free.pop() ?? this.nextSlot++;
      if (slot >= HEIGHT_MAX_PAGES)
        throw new Error(
          "Die sichtbaren Höhenquellen überschreiten das GPU-Budget.",
        );
      if (slot >= this.capacity) {
        this.capacity = Math.min(HEIGHT_MAX_PAGES, this.capacity * 2);
        const grown = new Float32Array(
          HEIGHT_ATLAS_WIDTH *
            Math.ceil(
              (this.capacity * HEIGHT_PAGE_TEXELS) / HEIGHT_ATLAS_WIDTH,
            ) *
            2,
        );
        grown.set(this.data);
        this.data = grown;
        this.allocation = true;
      }
      page = { key, slot, references: 0, unsafe: false };
      this.pages.set(key, page);
      this.slots.set(slot, page);
      this.writePage(page);
    }
    page.references++;
    return page;
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

  private writePage(page: SourcePage): void {
    const { level, tileX, tileY } = parseHeightTileKey(page.key);
    const spacing = heightSpacing(level);
    let unsafe = false;
    const start = page.slot * HEIGHT_PAGE_TEXELS * 2;
    for (let y = 0; y < HEIGHT_PAGE_SIZE; y++) {
      const cy = tileY * HEIGHT_TILE_SIZE + y - 2;
      const sy = Math.floor(cy / HEIGHT_TILE_SIZE);
      for (let x = 0; x < HEIGHT_PAGE_SIZE; x++) {
        const cx = tileX * HEIGHT_TILE_SIZE + x - 2;
        const sx = Math.floor(cx / HEIGHT_TILE_SIZE);
        const source = this.sources.get(heightTileKey(level, sx, sy));
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
        const offset = start + (y * HEIGHT_PAGE_SIZE + x) * 2;
        const pair = safe ? splitHeightFloat(value) : [0, 0];
        this.data[offset] = pair[0];
        this.data[offset + 1] = pair[1];
      }
    }
    page.unsafe = unsafe;
    this.dirty.add(page.slot);
  }

  descriptor(bounds: Bounds, power: number): HeightDescriptor {
    const minimum = minimumCoarseHeightLevel(power);
    const levels = [
      ...new Set(
        [...this.sources.values()]
          .filter(
            (tile) =>
              tile.level >= minimum &&
              intersectsBounds(heightTileSupport(tile), bounds),
          )
          .map((tile) => tile.level),
      ),
    ].sort((a, b) => b - a);
    const data = new Float32Array(
      HEIGHT_DESCRIPTOR_WIDTH * HEIGHT_DESCRIPTOR_HEIGHT * 4,
    );
    const pages: string[] = [];
    const step = 2 ** power;
    let fallback = false;
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
        const offset = index * HEIGHT_DESCRIPTOR_WIDTH * 4;
        for (let py = 0; py < 3; py++)
          for (let px = 0; px < 3; px++) {
            const page = this.acquire(level, tx + px, ty + py);
            data[offset + py * 3 + px] = page?.slot ?? -1;
            if (page) {
              pages.push(page.key);
              fallback ||= page.unsafe;
            }
          }
      }
    } catch (error) {
      this.release(pages);
      throw error;
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
    return {
      data,
      levelCount: levels.length,
      pages,
      fallback,
      levels,
      clip: [
        first(bounds[0]),
        first(bounds[1]),
        last(bounds[0]),
        last(bounds[1]),
      ],
    };
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

/** Source-independent cubic weights, shared by all pixels of each raster row/column. */
export function createHeightAxes(
  bounds: Bounds,
  power: number,
  levels: readonly number[],
): {
  data: Float32Array;
  width: number;
  height: number;
} {
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
      }
    }
  }
  return { data, width, height };
}

export function encodeHeightOverview(values?: Float64Array): {
  data: Float32Array;
  fallback: boolean;
} {
  const data = new Float32Array(HEIGHT_OVERVIEW_SIZE ** 2 * 2);
  let fallback = false;
  if (values)
    for (let i = 0; i < values.length; i++) {
      if (!heightGpuValueSafe(values[i])) fallback = true;
      else data.set(splitHeightFloat(values[i]), i * 2);
    }
  return { data, fallback };
}

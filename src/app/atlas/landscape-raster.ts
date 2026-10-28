import { vegetationWaterSuitable, vegetationFurrowShade } from './vegetation-surface';
import { terrainColors } from '../runtime/world-model';
import type { Polygon } from '../shared/contracts';
import { type LandscapeBox } from './landscape-bounds';
import { type LandscapeRecord } from './landscape-contracts';
import { reduceAtlasMaterialRows } from './atlas-raster-kernel';
import { mapLineWidth, mapRecordOpacity, mapRecordVisible } from './atlas-scale-policy';
import { MASK_SEA_LEVEL, maskAt } from './land-mask';
import { colorParts, mergePolygons } from './landscape-brush';
import {
  coverDisplayPolygons,
  coverFeatherSamplerSteps,
  coverViewParts,
} from './landscape-cover-feather';
import { bounds } from './landscape-geometry';
import { lineParts } from './landscape-line';
import { pigmentStrokeCoverage } from './landscape-pigment-coverage';
import { polygonCoverageRows } from './raster-polygon-coverage';
import { paintTerrainCoast } from './terrain-coast';
import { terrainContourInk, terrainContourStep } from './terrain-contour-style';
import type { TerrainField, TerrainLattice } from './terrain-field-stream';
import { DEFAULT_HEIGHT_M, TerrainSampler } from './terrain-height';
import {
  CHANNEL_NAMES,
  COVER_CHANNEL_NAMES,
  MACRO_RELIEF_RADIUS,
  MACRO_RIDGE_GAIN,
  type TerrainCoverChannel,
  type TerrainMaterialChannel,
  type TerrainMaterialRaster,
} from './terrain-material';
import {
  DEFAULT_TERRAIN_STYLE,
  elevationColor,
  mountainMaterial,
  reliefLighting,
  reliefMarks,
  reliefRgb,
  rockCoverage,
  snowCoverage,
  type TerrainStyle,
} from './terrain-relief';

// Read a halo as well as the visible tile: a tile edge is never a coastline.
export const LANDSCAPE_RASTER_PAD = 16;
export function landscapeRasterBounds(
  box: LandscapeBox,
  width: number,
  height: number,
): LandscapeBox {
  const dx = (box.width / width) * LANDSCAPE_RASTER_PAD,
    dy = (box.height / height) * LANDSCAPE_RASTER_PAD;
  return { x: box.x - dx, y: box.y - dy, width: box.width + 2 * dx, height: box.height + 2 * dy };
}

/** Keep the source pixel lattice, but omit unseen parts of a large world tile.
 * Block-aligned edges retain reuse for small pans and the raster's own halo
 * supplies shading/coast neighbours. This changes coverage, never resolution. */
export function landscapeRasterSlice(tile: LandscapeBox, pixels: number, view: LandscapeBox) {
  const block = Math.min(128, pixels),
    dx = tile.width / pixels,
    dy = tile.height / pixels;
  const left = Math.max(0, Math.floor((view.x - tile.x) / dx / block) * block),
    top = Math.max(0, Math.floor((view.y - tile.y) / dy / block) * block);
  const right = Math.min(pixels, Math.ceil((view.x + view.width - tile.x) / dx / block) * block),
    bottom = Math.min(pixels, Math.ceil((view.y + view.height - tile.y) / dy / block) * block);
  if (right <= left || bottom <= top) throw Error('Landschaftsausschnitt ohne Rasterüberdeckung.');
  return {
    box: {
      x: tile.x + left * dx,
      y: tile.y + top * dy,
      width: (right - left) * dx,
      height: (bottom - top) * dy,
    },
    width: right - left,
    height: bottom - top,
  };
}

/** Display-only supersampled raster. Exact queries always use author geometry. */
export class LandscapeRasterizer {
  readonly pixels: Uint8Array;
  /** Optional semantic forest coverage, independent of colour/alpha. Populated by finish(). */
  readonly forest?: Uint8Array;
  private readonly forestSamples?: Uint8Array;
  private readonly coverSamples: Partial<Record<TerrainCoverChannel, Uint8Array>> = {};
  private readonly samples: Uint8Array;
  private readonly water: Uint8Array;
  private readonly w: number;
  private readonly h: number;
  private colorBase: Uint8Array | null = null;
  private colorLayer: Uint8Array | null = null;
  private covers: LandscapeRecord[] = [];
  private coverPending = false;
  private masks: LandscapeRecord[] = [];
  private heights: LandscapeRecord[] = [];
  private fresh: LandscapeRecord[] = [];
  private maskPending = false;
  private coastPending = false;
  private waterLevels: Float32Array | undefined;
  private elevations: Float32Array | null = null;
  private field: Pick<TerrainField, 'heights' | 'water' | 'levels'> | null = null;
  private terrainStyle: Readonly<TerrainStyle> = DEFAULT_TERRAIN_STYLE;
  private seaLevelM = 0;
  private materialCaptured = false;
  private surfacePrepared = false;
  private finished = false;
  readonly sampleBox: LandscapeBox;
  private readonly scale: number;
  constructor(
    readonly box: LandscapeBox,
    readonly width: number,
    readonly height: number,
    readonly contours = 0,
    readonly displayMpp = box.width / width,
    forest = false,
    private readonly rasterOptions: {
      samples?: 2 | 4;
      areaCoverage?: boolean;
      worldFeather?: boolean;
      cover?: boolean;
    } = {},
  ) {
    if (
      !box ||
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0 ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 1024 ||
      height > 1024
    )
      throw new Error('Landschaftsübersicht prüfen.');
    this.sampleBox = landscapeRasterBounds(box, width, height);
    this.scale = rasterOptions.samples ?? 2;
    this.w = (width + 2 * LANDSCAPE_RASTER_PAD) * this.scale;
    this.h = (height + 2 * LANDSCAPE_RASTER_PAD) * this.scale;
    this.samples = new Uint8Array(this.w * this.h * 4);
    this.water = new Uint8Array(this.w * this.h).fill(1);
    this.pixels = new Uint8Array(width * height * 4);
    if (rasterOptions.cover)
      for (const c of COVER_CHANNEL_NAMES) this.coverSamples[c] = new Uint8Array(this.w * this.h);
    if (forest) {
      this.forest = new Uint8Array(width * height);
      this.forestSamples = new Uint8Array(this.w * this.h);
    }
  }
  sampleLattice(): TerrainLattice {
    const dx = this.sampleBox.width / this.w,
      dy = this.sampleBox.height / this.h;
    return {
      x: this.sampleBox.x + dx / 2,
      y: this.sampleBox.y + dy / 2,
      dx,
      dy,
      columns: this.w,
      rows: this.h,
    };
  }
  setTerrainField(field: TerrainField) {
    this.assertMaterialNotCaptured();
    if (field.heights.length !== this.w * this.h || field.water.length !== this.w * this.h)
      throw Error('Geländerastergröße prüfen.');
    this.field = { heights: field.heights, water: field.water, levels: field.levels };
    this.maskPending = true;
    this.coastPending = true;
  }
  /** Reader supplies covers in display order after all base polygons, without retaining them. */
  paintCover(record: LandscapeRecord) {
    for (const _ of this.paintCoverSteps(record, function* () {})) {
    }
  }
  *paintCoverSteps(record: LandscapeRecord, checkpoint: () => Generator<void>): Generator<void> {
    this.assertMaterialNotCaptured();
    this.applyMasks();
    if (!record.vegetation) return;
    const preset = record.vegetation.preset,
      rgb = [1, 3, 5].map((i) => parseInt(preset.ground.slice(i, i + 2), 16));
    // Union only multipart display geometry: internal overlaps are not a forest edge.
    const radius =
      preset.edge > 0
        ? this.rasterOptions.worldFeather
          ? preset.edge
          : Math.max(preset.edge, this.displayMpp * 3)
        : 0;
    const parts = coverViewParts(record.polygons, this.sampleBox, radius);
    const union = parts.disjoint ? parts.polygons : mergePolygons(parts.polygons);
    const polygons =
      preset.edge > 0
        ? coverDisplayPolygons(
            union,
            Math.min(this.sampleBox.width / this.w, this.sampleBox.height / this.h) / 4,
          )
        : union;
    const fade =
      preset.edge > 0
        ? yield* coverFeatherSamplerSteps(
            polygons,
            this.sampleBox,
            this.w,
            this.h,
            radius,
            checkpoint,
          )
        : undefined;
    // Rasterize corrections once per visible edit, never point-in-polygon for
    // every sample against every author polygon. This field is display-only.
    let density: Float32Array | undefined;
    if (this.forestSamples && record.vegetation.edits.length) {
      density = new Float32Array(this.w * this.h).fill(preset.density);
      for (const edit of record.vegetation.edits) {
        const parts = coverViewParts(edit.polygons, this.sampleBox, 0),
          polygons = parts.disjoint ? parts.polygons : mergePolygons(parts.polygons);
        for (const p of polygons)
          yield* this.polygonSteps(
            p,
            [],
            0,
            undefined,
            undefined,
            checkpoint,
            undefined,
            (i, coverage) => {
              const old = density![i]!,
                next =
                  edit.mode === 'clear'
                    ? 0
                    : edit.mode === 'thin'
                      ? old * 0.3
                      : Math.min(1, old + 0.5);
              density![i] = old + (next - old) * coverage;
            },
          );
      }
    }
    const mainChannel =
      preset.tree === 'pine' ? 'conifer' : preset.tree === 'oak' ? 'deciduous' : 'shrub';
    const underChannel =
      preset.groundPattern === 'furrows'
        ? 'furrows'
        : preset.undergrowthAsset === 'crop'
          ? 'grass'
          : preset.undergrowthAsset;
    const coverEntries = COVER_CHANNEL_NAMES.filter((c) => this.coverSamples[c]).map((c) => ({
      active: c === mainChannel || c === underChannel || c === 'debris',
      samples: this.coverSamples[c]!,
      maximumWaterDepth:
        c === mainChannel
          ? preset.waterDepth.trees
          : c === underChannel
            ? preset.waterDepth.undergrowth
            : preset.waterDepth.rocks,
      // Two definition families can share one byte coverage channel.
      value: Math.min(
        1,
        (c === mainChannel ? preset.density : 0) +
          (c === underChannel ? preset.undergrowth : 0) +
          (c === 'debris' ? preset.rocks : 0),
      ),
    }));
    // Edits apply to every candidate family, exactly as the individual generator.
    const corrected = coverEntries.map((entry) => {
      const values = record.vegetation!.edits.length
        ? new Float32Array(this.w * this.h).fill(entry.value)
        : undefined;
      return { ...entry, values };
    });
    for (const edit of record.vegetation.edits) {
      const parts = coverViewParts(edit.polygons, this.sampleBox, 0),
        polygons = parts.disjoint ? parts.polygons : mergePolygons(parts.polygons);
      for (const p of polygons)
        yield* this.polygonSteps(
          p,
          [],
          0,
          undefined,
          undefined,
          checkpoint,
          undefined,
          (i, coverage) => {
            for (const entry of corrected)
              if (entry.values && entry.active) {
                const old = entry.values[i]!,
                  next =
                    edit.mode === 'clear'
                      ? 0
                      : edit.mode === 'thin'
                        ? old * 0.3
                        : Math.min(1, old + 0.5);
                entry.values[i] = old + (next - old) * coverage;
              }
          },
        );
    }
    const forest = this.forestSamples,
      coverage = forest
        ? (i: number, fade: number) => {
            const value =
              preset.tree === 'shrub' || this.water[i]
                ? 0
                : Math.min(1, (density?.[i] ?? preset.density) / 0.8) * 255;
            forest[i] = Math.round(forest[i]! * (1 - fade) + value * fade);
            for (const entry of corrected)
              entry.samples[i] = Math.round(
                entry.samples[i]! * (1 - fade) +
                  (this.suitableWater(i, entry.maximumWaterDepth)
                    ? (entry.values?.[i] ?? entry.value)
                    : 0) *
                    255 *
                    fade,
              );
          }
        : undefined;
    const shade =
      preset.groundPattern === 'furrows'
        ? (i: number) =>
            vegetationFurrowShade(
              this.sampleBox.y + ((Math.floor(i / this.w) + 0.5) * this.sampleBox.height) / this.h,
              record.vegetation!.spacing,
              this.displayMpp,
              this.sampleBox.height / this.h,
            )
        : undefined;
    for (const polygon of polygons)
      yield* this.polygonSteps(
        polygon,
        rgb,
        0.78,
        (i) =>
          this.suitableWater(
            i,
            Math.max(
              preset.waterDepth.trees,
              preset.waterDepth.undergrowth,
              preset.waterDepth.rocks,
            ),
          ),
        undefined,
        checkpoint,
        fade,
        coverage,
        shade,
      );
  }
  paint(record: LandscapeRecord) {
    this.assertMaterialNotCaptured();
    if (record.terrainSettings) {
      this.terrainStyle = record.terrainSettings.style ?? DEFAULT_TERRAIN_STYLE;
      this.seaLevelM = record.terrainSettings.seaLevelM;
    }
    if (record.vegetation) {
      this.covers.push(record);
      this.coverPending = true;
      return;
    }
    if (record.height || record.terrainSettings || record.route) {
      this.heights.push(record);
      this.maskPending = true;
      this.coastPending = true;
      return;
    }
    if (record.propertyOnly) return;
    if (record.mask) {
      this.masks.push(record);
      this.maskPending = true;
      this.coastPending = true;
      return;
    }
    if (record.surface === 'freshwater') {
      this.fresh.push(record);
      this.maskPending = true;
      this.coastPending = true;
      return;
    }
    if (record.kind !== 'patch' || !record.values.terrain) return;
    this.coastPending = true;
    if (record.maskManaged) this.maskPending = true;
    const color = terrainColors[record.values.terrain];
    if (!color) throw new Error('Geländefarbe fehlt.');
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (const polygon of record.polygons) {
      const coverage = this.forestSamples
        ? (i: number, coverage: number) => {
            const value = record.values.terrain === 'forest' ? 255 : 0;
            this.forestSamples![i] = Math.round(
              this.forestSamples![i]! * (1 - coverage) + value * coverage,
            );
            for (const c of COVER_CHANNEL_NAMES) {
              const data = this.coverSamples[c];
              if (data) data[i] = Math.round(data[i]! * (1 - coverage));
            }
          }
        : undefined;
      for (const _ of this.polygonSteps(
        polygon,
        rgb,
        1,
        undefined,
        record.maskManaged ? undefined : record.values.terrain === 'water',
        function* () {},
        undefined,
        coverage,
      )) {
      }
    }
  }
  private applyVegetation() {
    this.applyMasks();
    if (!this.coverPending) return;
    this.coverPending = false;
    for (const r of this.covers.sort(
      (a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
    ))
      this.paintCover(r);
  }

  private applyMasks() {
    if (!this.maskPending) return;
    this.maskPending = false;
    const land = reliefRgb(this.terrainStyle.land),
      sea = [127, 168, 189];
    for (const r of this.masks.sort((a, b) => b.resolution - a.resolution)) {
      const m = r.mask!,
        size = 256 * m.pixel,
        x0 = Math.max(0, Math.floor(((m.x - this.sampleBox.x) / this.sampleBox.width) * this.w)),
        x1 = Math.min(
          this.w,
          Math.ceil(((m.x + size - this.sampleBox.x) / this.sampleBox.width) * this.w),
        ),
        y0 = Math.max(0, Math.floor(((m.y - this.sampleBox.y) / this.sampleBox.height) * this.h)),
        y1 = Math.min(
          this.h,
          Math.ceil(((m.y + size - this.sampleBox.y) / this.sampleBox.height) * this.h),
        );
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const v = maskAt(m, {
            x: this.sampleBox.x + ((x + 0.5) / this.w) * this.sampleBox.width,
            y: this.sampleBox.y + ((y + 0.5) / this.h) * this.sampleBox.height,
          });
          if (v !== undefined) this.water[y * this.w + x] = v < MASK_SEA_LEVEL ? 1 : 0;
        }
    }
    if (this.field) {
      this.water.set(this.field.water);
      this.elevations = this.field.heights;
      this.waterLevels = this.field.levels;
    } else if (this.heights.length) {
      const sampler = new TerrainSampler([...this.heights, ...this.fresh]);
      this.waterLevels = new Float32Array(this.w * this.h).fill(sampler.seaLevelM);
      this.water.fill(DEFAULT_HEIGHT_M <= sampler.seaLevelM ? 1 : 0);
      this.elevations = new Float32Array(this.w * this.h).fill(DEFAULT_HEIGHT_M);
      // Only the union of authored supports needs sampling. Distant ocean stays implicit.
      const spans = new Int32Array(this.h * 2);
      for (let y = 0; y < this.h; y++) {
        spans[y * 2] = this.w;
        spans[y * 2 + 1] = 0;
      }
      for (const r of [...this.heights.filter((r) => r.height || r.route), ...this.fresh]) {
        const b = bounds(r),
          left = b.x,
          top = b.y,
          right = b.x + b.width,
          bottom = b.y + b.height;
        const x0 = Math.max(
            0,
            Math.floor(((left - this.sampleBox.x) / this.sampleBox.width) * this.w),
          ),
          x1 = Math.min(
            this.w,
            Math.ceil(((right - this.sampleBox.x) / this.sampleBox.width) * this.w),
          ),
          y0 = Math.max(0, Math.floor(((top - this.sampleBox.y) / this.sampleBox.height) * this.h)),
          y1 = Math.min(
            this.h,
            Math.ceil(((bottom - this.sampleBox.y) / this.sampleBox.height) * this.h),
          );
        for (let y = y0; y < y1; y++) {
          spans[y * 2] = Math.min(spans[y * 2]!, x0);
          spans[y * 2 + 1] = Math.max(spans[y * 2 + 1]!, x1);
        }
      }
      for (let y = 0; y < this.h; y++)
        for (let x = spans[y * 2]!; x < spans[y * 2 + 1]!; x++) {
          const p = {
              x: this.sampleBox.x + ((x + 0.5) / this.w) * this.sampleBox.width,
              y: this.sampleBox.y + ((y + 0.5) / this.h) * this.sampleBox.height,
            },
            z = sampler.sample(p).heightM;
          this.elevations[y * this.w + x] = z;
          this.water[y * this.w + x] = sampler.water(p, z) ? 1 : 0;
          this.waterLevels[y * this.w + x] = sampler.waterLevel(p, z) ?? -Infinity;
        }
    }
    for (let i = 0; i < this.water.length; i++) {
      const at = i * 4;
      if (
        this.water[i] ||
        !this.samples[at + 3] ||
        (this.samples[at] === 127 && this.samples[at + 1] === 168 && this.samples[at + 2] === 189)
      ) {
        const rgb = this.water[i] ? sea : land;
        for (let c = 0; c < 3; c++) this.samples[at + c] = rgb[c]!;
        this.samples[at + 3] = 255;
      }
    }
    if (!this.field && !this.heights.length)
      for (const r of this.fresh)
        for (const p of r.polygons) this.polygon(p, sea, 1, undefined, true);
  }
  paintColor(record: LandscapeRecord) {
    for (const _ of this.paintColorSteps(record, function* () {})) {
    }
  }
  /** Same pigment composition for synchronous previews and interruptible tiles. */
  *paintColorSteps(record: LandscapeRecord, checkpoint: () => Generator<void>): Generator<void> {
    this.assertMaterialNotCaptured();
    this.applyVegetation();
    yield* checkpoint();
    const p = record.paint;
    if (!p) return;
    this.colorBase ??= this.samples.slice();
    this.colorLayer ??= new Uint8Array(this.samples.length);
    const pigment = new LandscapeRasterizer(
      this.box,
      this.width,
      this.height,
      0,
      this.displayMpp,
      false,
      this.rasterOptions,
    );
    let coverage: Float32Array | undefined, color: number[] | undefined;
    if (p.version === 1) {
      for (const part of colorParts(record))
        yield* pigment.paintPolygonsSteps(part.polygons, part.color, part.opacity, checkpoint);
    } else {
      // A bounded raster coverage mask avoids polygon clipping for every soft dab.
      yield* pigment.paintPolygonsSteps(record.polygons, '#ffffff', 1, checkpoint);
      color = [1, 3, 5].map((i) => parseInt(p.color.slice(i, i + 2), 16));
      if (!p.fill)
        coverage = yield* pigmentStrokeCoverage(
          this.sampleBox,
          this.w,
          this.h,
          record,
          pigment.samples,
          checkpoint,
        );
      // Keep constant pigment RGB outside the mask. Filled areas need neither
      // dab coverage nor an extra full-pixel colour conversion pass.
    }
    const layer = this.colorLayer,
      base = this.colorBase;
    for (let i = 0; i < this.water.length; i++) {
      if (i % 8192 === 0) yield* checkpoint();
      if ((p.target === 'water') !== !!this.water[i]) continue;
      const at = i * 4,
        mask = pigment.samples[at + 3]!,
        alpha = ((coverage ? Math.round(mask * coverage[i]!) : mask) / 255) * p.opacity;
      if (!alpha) continue;
      const old = layer[at + 3]! / 255;
      if (p.version === 2 && p.operation === 'erase')
        layer[at + 3] = Math.round(old * (1 - alpha) * 255);
      else {
        const combined = alpha + old * (1 - alpha);
        for (let c = 0; c < 3; c++)
          layer[at + c] = Math.round(
            ((color ? color[c]! : pigment.samples[at + c]!) * alpha +
              layer[at + c]! * old * (1 - alpha)) /
              (combined || 1),
          );
        layer[at + 3] = Math.round(combined * 255);
      }
      const paintAlpha = layer[at + 3]! / 255,
        baseAlpha = base[at + 3]! / 255,
        total = paintAlpha + baseAlpha * (1 - paintAlpha);
      for (let c = 0; c < 3; c++)
        this.samples[at + c] = Math.round(
          (layer[at + c]! * paintAlpha + base[at + c]! * baseAlpha * (1 - paintAlpha)) /
            (total || 1),
        );
      this.samples[at + 3] = Math.round(total * 255);
    }
  }
  private applyCoast() {
    for (const _ of this.prepareSurfaceSteps(function* () {})) {
    }
  }
  /** Complete ground shading before lines; yield only with owned in-memory data. */
  *prepareSurfaceSteps(checkpoint: () => Generator<void>): Generator<void> {
    this.surfacePrepared = true;
    this.applyVegetation();
    if (!this.coastPending) return;
    this.coastPending = false;
    yield* this.applyReliefSteps(checkpoint);
    yield* paintTerrainCoast(
      this.samples,
      this.water,
      this.w,
      this.h,
      LANDSCAPE_RASTER_PAD * this.scale,
      checkpoint,
    );
  }

  private *applyReliefSteps(checkpoint: () => Generator<void>): Generator<void> {
    const z = this.elevations;
    if (!z) return;
    const dx = this.sampleBox.width / this.w,
      dy = this.sampleBox.height / this.h,
      style = this.terrainStyle,
      inkRgb = reliefRgb(style.ink),
      lighting = reliefLighting(style);
    const material = mountainMaterial(style, Math.max(dx, dy)),
      snowline = style.snowlineM ?? 2500;
    // A small symmetric footprint limits high-frequency shading without changing heights or coasts.
    const step = 2 * this.scale,
      stride = step * this.w,
      contourStep = terrainContourStep(this.displayMpp);
    // The halo supplies height derivatives, shore distances and mark anchors;
    // its own shaded colours are never read by a neighbouring output pixel.
    const pad = LANDSCAPE_RASTER_PAD * this.scale;
    for (let y = pad; y < this.h - pad; y++) {
      for (let x = pad; x < this.w - pad; x++) {
        const i = y * this.w + x;
        if (this.water[i]) continue;
        // Uniform terrain has unit lighting, no ridge and no contour ink.
        // Keep its existing pigment untouched instead of shading every sample.
        const height = z[i]!;
        if (
          style.mode !== 'height' &&
          (!material || height <= snowline) &&
          height === z[i - 1] &&
          height === z[i + 1] &&
          height === z[i - this.w] &&
          height === z[i + this.w] &&
          height === z[i - step] &&
          height === z[i + step] &&
          height === z[i - stride] &&
          height === z[i + stride]
        )
          continue;
        const zx = (z[i + 1]! - z[i - 1]!) / 2,
          zy = (z[i + this.w]! - z[i - this.w]!) / 2,
          sx = (z[i + step]! - z[i - step]!) / (2 * dx * step),
          sy = (z[i + stride]! - z[i - stride]!) / (2 * dy * step);
        const light = lighting(sx, sy);
        material?.(
          this.samples,
          i * 4,
          this.sampleBox.x + (x + 0.5) * dx,
          this.sampleBox.y + (y + 0.5) * dy,
          height,
          sx,
          sy,
        );
        const convex = Math.max(
          0,
          (z[i]! * 4 - z[i - step]! - z[i + step]! - z[i - stride]! - z[i + stride]!) /
            (step * (dx + dy)),
        );
        const ridge = style.mode === 'drawn' ? Math.min(0.14, convex * 0.24) * style.strength : 0;
        // Height derivatives use the 2x sample grid; contour spacing is in output pixels.
        const contour =
          this.contours === 0
            ? 0
            : terrainContourInk(
                z[i]!,
                Math.hypot(zx, zy),
                this.contours,
                this.seaLevelM,
                this.scale,
                contourStep,
              );
        const ink = Math.max(ridge, contour),
          analysis = style.mode === 'height' ? elevationColor(z[i]!, this.seaLevelM) : null;
        for (let c = 0; c < 3; c++) {
          const at = i * 4 + c,
            value = analysis?.[c] ?? this.samples[at]!;
          this.samples[at] = Math.round(
            Math.max(0, Math.min(255, value * light)) * (1 - ink) + inkRgb[c]! * ink,
          );
        }
      }
      if ((y - pad + 1) % 16 === 0) yield* checkpoint();
    }
    if (style.mode !== 'drawn' || !style.strength) return;
    const sample = (p: { x: number; y: number }) => {
      const x = Math.round((p.x - this.sampleBox.x) / dx - 0.5),
        y = Math.round((p.y - this.sampleBox.y) / dy - 0.5);
      if (x < step || y < step || x >= this.w - step || y >= this.h - step)
        return { heightM: 0, sx: 0, sy: 0, water: true };
      const i = y * this.w + x;
      return {
        heightM: z[i]!,
        sx: (z[i + step]! - z[i - step]!) / (2 * dx * step),
        sy: (z[i + stride]! - z[i - stride]!) / (2 * dy * step),
        water: !!this.water[i],
      };
    };
    const mpp = Math.max(
      this.box.width / this.width,
      Math.min(this.displayMpp, (this.box.width / this.width) * 2),
    );
    // Marks affect only relief pixels; symbols, labels and roads are drawn later.
    for (const mark of reliefMarks(this.box, mpp, sample, style.strength)) {
      const points = mark.points.map((p) => ({
        x: (p.x - this.sampleBox.x) / dx - 0.5,
        y: (p.y - this.sampleBox.y) / dy - 0.5,
      }));
      const radius = mark.width / Math.max(dx, dy) / 2;
      const left = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) - radius - 1)),
        right = Math.min(this.w - 1, Math.ceil(Math.max(...points.map((p) => p.x)) + radius + 1));
      const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) - radius - 1)),
        bottom = Math.min(this.h - 1, Math.ceil(Math.max(...points.map((p) => p.y)) + radius + 1));
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const i = y * this.w + x;
          if (this.water[i]) continue;
          let distance = Infinity;
          for (let j = 1; j < points.length; j++) {
            const a = points[j - 1]!,
              b = points[j]!,
              vx = b.x - a.x,
              vy = b.y - a.y,
              t = Math.max(
                0,
                Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)),
              );
            distance = Math.min(distance, Math.hypot(x - a.x - vx * t, y - a.y - vy * t));
          }
          const alpha = mark.opacity * Math.max(0, Math.min(1, radius + 0.5 - distance));
          if (alpha)
            for (let c = 0; c < 3; c++) {
              const at = i * 4 + c;
              this.samples[at] = Math.round(this.samples[at]! * (1 - alpha) + inkRgb[c]! * alpha);
            }
        }
    }
  }
  paintRecordLine(record: LandscapeRecord, mpp = 0) {
    if (!mapRecordVisible(record, mpp)) return;
    const opacity = mapRecordOpacity(record, mpp);
    this.applyCoast();
    if (!record.line) {
      this.paintLine(
        record.points,
        mapLineWidth(record.width, mpp),
        record.kind === 'river' ? '#629ebc' : '#a37e51',
        opacity,
      );
      return;
    }
    for (const part of lineParts(record)) {
      if (part.polygons) this.paintPolygons(part.polygons, part.color, part.opacity * opacity);
      else
        this.paintStyledLine(
          part.points,
          mapLineWidth(part.width, mpp),
          part.color,
          part.opacity * opacity,
          part.dash,
          part.dashOffset,
        );
    }
  }
  private paintStyledLine(
    points: { x: number; y: number }[],
    width: number,
    color: string,
    opacity: number,
    dash?: number[],
    dashOffset = 0,
  ) {
    // Rasterize the bounded visible sample lattice, not one object per dash across the world.
    const pixel = this.sampleBox.width / this.w,
      radius = Math.max(width / 2, pixel / 2),
      period = dash?.reduce((a, b) => a + b, 0) ?? 0;
    const coverage = new Uint8Array(this.w * this.h);
    let travel = dashOffset;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy);
      if (!len) continue;
      const fromX = Math.max(
          0,
          Math.floor(
            ((Math.min(a.x, b.x) - radius - this.sampleBox.x) / this.sampleBox.width) * this.w,
          ),
        ),
        toX = Math.min(
          this.w - 1,
          Math.ceil(
            ((Math.max(a.x, b.x) + radius - this.sampleBox.x) / this.sampleBox.width) * this.w,
          ),
        );
      const fromY = Math.max(
          0,
          Math.floor(
            ((Math.min(a.y, b.y) - radius - this.sampleBox.y) / this.sampleBox.height) * this.h,
          ),
        ),
        toY = Math.min(
          this.h - 1,
          Math.ceil(
            ((Math.max(a.y, b.y) + radius - this.sampleBox.y) / this.sampleBox.height) * this.h,
          ),
        );
      for (let y = fromY; y <= toY; y++)
        for (let x = fromX; x <= toX; x++) {
          const px = this.sampleBox.x + ((x + 0.5) / this.w) * this.sampleBox.width,
            py = this.sampleBox.y + ((y + 0.5) / this.h) * this.sampleBox.height,
            t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (len * len)));
          if (Math.hypot(px - a.x - dx * t, py - a.y - dy * t) > radius) continue;
          let strength = 1;
          if (dash && period) {
            if (period < pixel)
              strength = dash.reduce((v, n, j) => v + (j % 2 ? 0 : n), 0) / period;
            else {
              let phase = (travel + t * len) % period,
                j = 0;
              while (j < dash.length - 1 && phase > dash[j]!) {
                phase -= dash[j]!;
                j++;
              }
              if (j % 2 && Math.min(phase, dash[j]! - phase) > radius) continue;
            }
          }
          coverage[y * this.w + x] = Math.max(
            coverage[y * this.w + x]!,
            Math.round(strength * 255),
          );
        }
      travel += len;
    }
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (let i = 0; i < coverage.length; i++)
      if (coverage[i]) {
        const at = i * 4,
          alpha = (opacity * coverage[i]!) / 255,
          old = this.samples[at + 3]! / 255,
          combined = alpha + old * (1 - alpha);
        for (let c = 0; c < 3; c++)
          this.samples[at + c] = Math.round(
            (rgb[c]! * alpha + this.samples[at + c]! * old * (1 - alpha)) / combined,
          );
        this.samples[at + 3] = Math.round(combined * 255);
        if (this.forestSamples)
          this.forestSamples[i] = Math.round(this.forestSamples[i]! * (1 - alpha));
      }
  }
  paintPolygons(polygons: Polygon[], color: string, opacity = 1) {
    for (const _ of this.paintPolygonsSteps(polygons, color, opacity, function* () {})) {
    }
  }
  private *paintPolygonsSteps(
    polygons: Polygon[],
    color: string,
    opacity: number,
    checkpoint: () => Generator<void>,
  ): Generator<void> {
    if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Darstellungsfarbe fehlt.');
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (const p of polygons)
      yield* this.polygonSteps(
        p,
        rgb,
        opacity,
        undefined,
        undefined,
        checkpoint,
        undefined,
        this.forestSamples
          ? (i, coverage) => {
              this.forestSamples![i] = Math.round(
                this.forestSamples![i]! * (1 - opacity * coverage),
              );
            }
          : undefined,
      );
  }
  paintLine(points: { x: number; y: number }[], width: number, color: string, opacity = 1) {
    this.applyCoast();
    const radius = Math.max(width / 2, this.sampleBox.width / this.w);
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!,
        a = points[i - 1];
      if (a) {
        const d = Math.hypot(p.x - a.x, p.y - a.y) || 1,
          x = (-(p.y - a.y) / d) * radius,
          y = ((p.x - a.x) / d) * radius;
        this.paintPolygons(
          [
            {
              outer: [
                { x: a.x + x, y: a.y + y },
                { x: p.x + x, y: p.y + y },
                { x: p.x - x, y: p.y - y },
                { x: a.x - x, y: a.y - y },
              ],
              holes: [],
            },
          ],
          color,
          opacity,
        );
      }
      this.paintPolygons(
        [
          {
            outer: Array.from({ length: 12 }, (_, i) => ({
              x: p.x + Math.cos((i * Math.PI) / 6) * radius,
              y: p.y + Math.sin((i * Math.PI) / 6) * radius,
            })),
            holes: [],
          },
        ],
        color,
        opacity,
      );
    }
  }
  private suitableWater(i: number, maximum: number) {
    if (!this.water[i]) return true;
    const level = this.waterLevels?.[i],
      height = this.elevations?.[i];
    return (
      level !== undefined &&
      height !== undefined &&
      vegetationWaterSuitable(level - height, maximum)
    );
  }
  private polygon(
    p: Polygon,
    rgb: number[],
    alpha = 1,
    target?: 'ground' | 'water' | ((i: number) => boolean),
    water?: boolean,
  ) {
    for (const _ of this.polygonSteps(p, rgb, alpha, target, water, function* () {})) {
    }
  }
  private *polygonSteps(
    p: Polygon,
    rgb: number[],
    alpha: number,
    target: 'ground' | 'water' | ((i: number) => boolean) | undefined,
    water: boolean | undefined,
    checkpoint: () => Generator<void>,
    fade?: (x: number, y: number) => number,
    coverage?: (pixel: number, fade: number) => void,
    shade?: (pixel: number) => number,
  ): Generator<void> {
    // Opaque spans overwrite their background. Use the platform's packed byte
    // order, and retain per-pixel blending for alpha or land/water clipping.
    const opaque = alpha === 1 && !target && !fade ? new Uint32Array(this.samples.buffer) : null;
    const packed = opaque
      ? new Uint32Array(Uint8Array.of(...rgb.map(Math.round), 255).buffer)[0]!
      : 0;
    const rings = [p.outer, ...p.holes].map((r) =>
      r.map((v) => ({
        x: ((v.x - this.sampleBox.x) / this.sampleBox.width) * this.w,
        y: ((v.y - this.sampleBox.y) / this.sampleBox.height) * this.h,
      })),
    );
    if (this.rasterOptions.areaCoverage) {
      for (const { y, values } of polygonCoverageRows(rings, this.w, this.h)) {
        yield* checkpoint();
        for (let x = 0; x < this.w; x++) {
          const area = values[x]!;
          if (!area) continue;
          const pixel = y * this.w + x,
            at = pixel * 4;
          if (
            typeof target === 'function'
              ? !target(pixel)
              : target && (target === 'water') !== !!this.water[pixel]
          )
            continue;
          if (water !== undefined && area >= 0.5) this.water[pixel] = water ? 1 : 0;
          const feather = area * (fade?.(x, y) ?? 1);
          coverage?.(pixel, feather);
          const opacity = alpha * feather;
          if (!opacity) continue;
          const tint = shade?.(pixel) ?? 1;
          const old = this.samples[at + 3]! / 255,
            combined = opacity + old * (1 - opacity);
          for (let c = 0; c < rgb.length; c++)
            this.samples[at + c] = Math.round(
              (rgb[c]! * tint * opacity + this.samples[at + c]! * old * (1 - opacity)) /
                (combined || 1),
            );
          this.samples[at + 3] = Math.round(combined * 255);
        }
      }
      return;
    }
    let minY = this.h,
      maxY = -1;
    for (const ring of rings)
      for (const v of ring) {
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
    const rowsPerCheckpoint = fade ? Math.max(1, Math.floor(4096 / this.w)) : 16;
    for (
      let y = Math.max(0, Math.ceil(minY - 0.5));
      y <= Math.min(this.h - 1, Math.floor(maxY - 0.5));
      y++
    ) {
      if (y % rowsPerCheckpoint === 0) yield* checkpoint();
      const intersections: number[] = [],
        scan = y + 0.5;
      for (const ring of rings)
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[j]!,
            b = ring[i]!;
          if (a.y > scan !== b.y > scan)
            intersections.push(a.x + ((scan - a.y) * (b.x - a.x)) / (b.y - a.y));
        }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const from = Math.max(0, Math.ceil(intersections[i]! - 0.5)),
          to = Math.min(this.w - 1, Math.floor(intersections[i + 1]! - 0.5));
        if (to < from) continue;
        if (opaque) {
          const start = y * this.w + from,
            end = y * this.w + to + 1;
          opaque.fill(packed, start, end);
          if (water !== undefined) this.water.fill(water ? 1 : 0, start, end);
          if (coverage) for (let i = start; i < end; i++) coverage(i, 1);
          continue;
        }
        for (let x = from; x <= to; x++) {
          const pixel = y * this.w + x,
            at = pixel * 4;
          if (
            typeof target === 'function'
              ? !target(pixel)
              : target && (target === 'water') !== !!this.water[pixel]
          )
            continue;
          if (water !== undefined) this.water[pixel] = water ? 1 : 0;
          const feather = fade?.(x, y) ?? 1;
          coverage?.(pixel, feather);
          const opacity = alpha * feather;
          if (!opacity) continue;
          const tint = shade?.(pixel) ?? 1;
          const old = this.samples[at + 3]! / 255,
            combined = opacity + old * (1 - opacity);
          for (let c = 0; c < 3; c++)
            this.samples[at + c] = Math.round(
              (rgb[c]! * tint * opacity + this.samples[at + c]! * old * (1 - opacity)) /
                (combined || 1),
            );
          this.samples[at + 3] = Math.round(combined * 255);
        }
      }
    }
  }
  finish(): Uint8Array {
    this.applyCoast();
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const out = (y * this.width + x) * 4,
          top =
            (y + LANDSCAPE_RASTER_PAD) * this.scale * this.w +
            (x + LANDSCAPE_RASTER_PAD) * this.scale;
        let alpha = 0,
          forest = 0;
        const sum = [0, 0, 0];
        for (let sy = 0; sy < this.scale; sy++)
          for (let sx = 0; sx < this.scale; sx++) {
            const i = top + sy * this.w + sx,
              a = this.samples[i * 4 + 3]!;
            alpha += a;
            for (let c = 0; c < 3; c++) sum[c]! += this.samples[i * 4 + c]! * a;
            if (this.forestSamples && !this.water[i]) forest += this.forestSamples[i]!;
          }
        if (this.forest)
          this.forest[y * this.width + x] = Math.round(forest / (this.scale * this.scale));
        if (alpha) {
          for (let c = 0; c < 3; c++) this.pixels[out + c] = Math.round(sum[c]! / alpha);
          this.pixels[out + 3] = Math.round(alpha / (this.scale * this.scale));
        }
      }
    this.finished = true;
    return this.pixels;
  }

  /**
   * Reduce the authored/sample materials before relief, coast shading and route overlays.
   * Capture is deliberately single-use: once display composition has started the sample
   * lattice no longer contains the independent source channels.
   */
  *materialChannelsSteps(
    checkpoint: () => Generator<void>,
    requested?: ReadonlySet<TerrainMaterialChannel>,
  ): Generator<void, TerrainMaterialRaster> {
    if (this.materialCaptured || this.surfacePrepared || this.finished)
      throw Error(
        'Materialkanäle müssen vor Oberflächenbeleuchtung und Rasterabschluss erfasst werden.',
      );
    const names = requested ?? new Set<TerrainMaterialChannel>(CHANNEL_NAMES);
    for (const name of names)
      if (!(CHANNEL_NAMES as readonly string[]).includes(name))
        throw Error('Unbekannter Geländekanal.');
    if (names.has('forest') && !this.forestSamples)
      throw Error('Waldkanal benötigt einen Raster mit aktivierter Walderfassung.');
    this.applyMasks();
    this.applyVegetation();
    const channels: TerrainMaterialRaster = {};
    if (names.has('baseColor')) channels.baseColor = new Uint8Array(this.width * this.height * 4);
    if (names.has('water')) {
      channels.water = new Uint8Array(this.width * this.height);
      channels.waterTopology = new Uint16Array(this.width * this.height);
    }
    if (names.has('forest')) channels.forest = new Uint8Array(this.width * this.height);
    if (names.has('relief')) channels.relief = new Uint8Array(this.width * this.height * 4);
    for (const c of COVER_CHANNEL_NAMES)
      if (names.has(c)) channels[c] = new Uint8Array(this.width * this.height);
    if (names.has('rock')) channels.rock = new Uint8Array(this.width * this.height);
    if (names.has('snow')) channels.snow = new Uint8Array(this.width * this.height);
    const z = this.elevations,
      forest = this.forestSamples,
      lattice = this.sampleLattice(),
      step = 2 * this.scale,
      stride = step * this.w;
    const materialEnabled = this.terrainStyle.mountains === true;
    const materialRequested = names.has('rock') || names.has('snow');
    const snowline = this.terrainStyle.snowlineM ?? 2500;
    if (channels.relief && z) {
      const radius = MACRO_RELIEF_RADIUS * this.scale,
        vertical = radius * this.w,
        dx = radius * lattice.dx,
        dy = radius * lattice.dy;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const i =
            (y + LANDSCAPE_RASTER_PAD) * this.scale * this.w +
            (x + LANDSCAPE_RASTER_PAD) * this.scale +
            Math.floor(this.scale / 2) * (this.w + 1);
          const sx = (z[i + radius]! - z[i - radius]!) / (2 * dx),
            sy = (z[i + vertical]! - z[i - vertical]!) / (2 * dy),
            n = Math.hypot(sx, sy, 1);
          const ridge = Math.max(
            0,
            (4 * z[i]! - z[i - radius]! - z[i + radius]! - z[i - vertical]! - z[i + vertical]!) /
              (dx + dy),
          );
          const at = (y * this.width + x) * 4;
          channels.relief[at] = Math.round((1 - sx / n) * 127.5);
          channels.relief[at + 1] = Math.round((1 - sy / n) * 127.5);
          channels.relief[at + 2] = Math.round((1 + 1 / n) * 127.5);
          channels.relief[at + 3] = Math.round(Math.min(1, ridge * MACRO_RIDGE_GAIN) * 255);
        }
        if (y % 16 === 15) yield* checkpoint();
      }
    }
    if (this.rasterOptions.areaCoverage && !materialRequested) {
      for (let y = 0; y < this.height; y += 16) {
        reduceAtlasMaterialRows(
          {
            samples: this.samples,
            water: this.water,
            forest: this.forestSamples,
            covers: this.coverSamples,
            stride: this.w,
            left: LANDSCAPE_RASTER_PAD * this.scale,
            top: (y + LANDSCAPE_RASTER_PAD) * this.scale,
            width: this.width,
            rows: Math.min(16, this.height - y),
            scale: this.scale,
          },
          channels,
          y,
        );
        yield* checkpoint();
      }
      this.materialCaptured = true;
      return channels;
    }
    const covers = COVER_CHANNEL_NAMES.filter((c) => channels[c]),
      coverSums = new Float64Array(covers.length);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        coverSums.fill(0);
        const out = y * this.width + x,
          top =
            (y + LANDSCAPE_RASTER_PAD) * this.scale * this.w +
            (x + LANDSCAPE_RASTER_PAD) * this.scale;
        const count = this.scale * this.scale;
        let waterSum = 0,
          forestSum = 0,
          rockSum = 0,
          snowSum = 0,
          alphaSum = 0,
          topology = 0;
        const color = channels.baseColor;
        const sums = color ? [0, 0, 0] : undefined;
        for (let sample = 0; sample < count; sample++) {
          const i = top + Math.floor(sample / this.scale) * this.w + (sample % this.scale),
            isWater = !!this.water[i],
            at = i * 4,
            alpha = this.samples[at + 3]!;
          if (isWater) {
            waterSum += 255;
            topology |= 1 << sample;
          }
          if (forest && !isWater) forestSum += forest[i]!;
          for (let c = 0; c < covers.length; c++)
            coverSums[c] =
              coverSums[c]! +
              (!isWater || covers[c] === 'reed' ? (this.coverSamples[covers[c]!]?.[i] ?? 0) : 0);
          if (!isWater && materialEnabled && materialRequested && z) {
            const sx = (z[i + step]! - z[i - step]!) / (2 * lattice.dx * step);
            const sy = (z[i + stride]! - z[i - stride]!) / (2 * lattice.dy * step);
            const slope = Math.hypot(sx, sy);
            if (names.has('rock')) rockSum += Math.round(rockCoverage(slope) * 255);
            if (names.has('snow'))
              snowSum += Math.round(snowCoverage(z[i]!, slope, snowline) * 255);
          }
          if (color && sums && alpha) {
            alphaSum += alpha;
            for (let c = 0; c < 3; c++) sums[c] = (sums[c] ?? 0) + this.samples[at + c]! * alpha;
          }
        }
        for (let c = 0; c < covers.length; c++)
          channels[covers[c]!]![out] = Math.round(coverSums[c]! / count);
        if (channels.water) channels.water[out] = Math.round(waterSum / count);
        if (channels.waterTopology) channels.waterTopology[out] = topology;
        if (channels.forest) channels.forest[out] = Math.round(forestSum / count);
        if (channels.rock) channels.rock[out] = Math.round(rockSum / count);
        if (channels.snow) channels.snow[out] = Math.round(snowSum / count);
        if (color && sums) {
          const at = out * 4;
          if (alphaSum) {
            for (let c = 0; c < 3; c++) color[at + c] = Math.round(sums[c]! / alphaSum);
          }
          color[at + 3] = Math.round(alphaSum / count);
        }
      }
      if (y % 16 === 15) yield* checkpoint();
    }
    this.materialCaptured = true;
    yield* checkpoint();
    return channels;
  }

  private assertMaterialNotCaptured() {
    if (this.materialCaptured)
      throw Error('Rasterquellen können nach Materialkanalerfassung nicht geändert werden.');
  }
}
export interface LandscapeRaster {
  /** Transparent aggregate drawn above a separately projected terrain surface. */
  content?: 'objects';
  campaignId: string;
  revision: number;
  box: LandscapeBox;
  width: number;
  height: number;
  data: string;
}
// Worker/PNG/database code belongs to desktop, not this browser-safe module.

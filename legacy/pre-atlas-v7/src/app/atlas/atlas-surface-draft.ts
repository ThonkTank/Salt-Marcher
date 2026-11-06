import { applyLakeBrush } from './terrain-lake-brush';
import type { LakeStroke } from './landscape-action-contracts';
import { TerrainSampler } from './terrain-height';
import { terrainGridLayout } from './terrain-grid-layout';
import {
  MACRO_RELIEF_RADIUS,
  MACRO_RIDGE_GAIN,
  COVER_CHANNEL_NAMES,
  type TerrainCoverChannel,
} from './terrain-material';
import type { AtlasSurfaceTile } from './atlas-surface-tile-stream';
import { TerrainBrushDraft, terrainDraftBounds } from './terrain-brush-draft';
import type { HeightStroke } from './terrain-brush-contracts';
import type { prepareHeightBrush } from './terrain-brush';
import { applyCoupledTerrainBrush } from './terrain-lake-coupling';
import { gridHeight, terrainVisibility } from './terrain-spatial-model';
import { type TerrainView } from './terrain-view-contracts';
import type { TerrainEditingSource } from './terrain-grid-contracts';
import type { LandscapeRecord } from './landscape-contracts';
import { atlasWorldTileBounds } from './atlas-world-tiles';
import { LandscapeRasterizer } from './landscape-raster';
import { pigmentStrokeCoverage } from './landscape-pigment-coverage';
import { reliefRgb, DEFAULT_TERRAIN_STYLE } from './terrain-relief';
import { terrainColors } from '../runtime/world-model';

/** Display-only draft. Each new gesture starts from the previous local result,
 * including its editing ground; canonical receipt adoption happens separately. */
export class AtlasSurfaceDraft {
  private heights = new Map<AtlasSurfaceTile, TerrainBrushDraft>();
  private bases: readonly AtlasSurfaceTile[];
  private authorRecords: LandscapeRecord[];
  private consumed = 1;
  get appliedSamples() {
    return this.consumed;
  }
  private source?: TerrainEditingSource;
  tiles: readonly AtlasSurfaceTile[];
  get baseTiles() {
    return this.bases;
  }
  constructor(
    tiles: readonly AtlasSurfaceTile[],
    private visibility: TerrainView,
    private land = DEFAULT_TERRAIN_STYLE.land,
    source?: TerrainEditingSource,
  ) {
    // Install the independently loaded author snapshot only for this draft.
    // Existing local successors override its canonical records.
    const local = tiles.flatMap((t) => t.terrain.projection.grid.editing?.author?.records ?? []);
    if (source) {
      const removed = new Set(
        tiles.flatMap((t) => t.terrain.projection.grid.editing?.author?.removed ?? []),
      );
      const records = [
        ...new Map(
          [...source.records, ...local].filter((r) => !removed.has(r.id)).map((r) => [r.id, r]),
        ).values(),
      ];
      tiles = tiles.map((t) => ({
        ...t,
        terrain: {
          ...t.terrain,
          projection: {
            ...t.terrain.projection,
            grid: {
              ...t.terrain.projection.grid,
              editing: {
                ...t.terrain.projection.grid.editing!,
                author: { ...source, records, removed: [...removed] },
              },
            },
          },
        },
      }));
    }
    this.source = source;
    this.bases = tiles;
    this.tiles = tiles;
    this.authorRecords = [
      ...new Map(
        tiles
          .flatMap((tile) => tile.terrain.projection.grid.editing?.author?.records ?? [])
          .map((r) => [r.id, r]),
      ).values(),
    ];
  }
  private visibilityGrid() {
    if (this.visibility.surface) {
      // Camera, layout and base meshes are frozen together at pointer-down.
      // No second lattice is sampled between picking and the author kernel.
      const first = this.bases[0]!.terrain.projection.grid;
      return {
        ...first,
        view: this.visibility,
        surface: this.bases.map((t) => t.terrain.projection.grid),
      };
    }
    const view = this.visibility,
      heights = new Float32Array(view.columns * view.rows);
    const layout = terrainGridLayout(view),
      sampler = new TerrainSampler(this.authorRecords, false),
      currentWater = new TerrainSampler(this.authorRecords),
      canonical = this.source?.visibility,
      original = canonical ? new TerrainSampler(this.source!.records, false) : null;
    for (let y = 0; y < view.rows; y++)
      for (let x = 0; x < view.columns; x++) {
        const p = { x: layout.x.values[x]!, y: layout.y.values[y]! };
        const tile = this.bases.find((t) => {
          const b = t.terrain.projection.grid.view.box;
          return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
        });
        const g = tile?.terrain.projection.grid;
        const water = g?.editing
          ? gridHeight({ ...g, heights: g.editing.water }, p)
          : this.bases[0]!.terrain.projection.grid.seaLevelM;
        if (canonical && original) {
          const ground = canonical.editing
            ? gridHeight({ ...canonical, heights: canonical.editing.ground }, p)
            : gridHeight(canonical, p);
          const b = this.source!.box,
            local = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
          // A queued successor may already have lifted/erased local water
          // while the independently loaded visibility snapshot is still old.
          const level = local
            ? Math.max(canonical.seaLevelM, currentWater.waterLevel(p, -Infinity) ?? -Infinity)
            : canonical.editing
              ? gridHeight({ ...canonical, heights: canonical.editing.water }, p)
              : canonical.seaLevelM;
          heights[y * view.columns + x] = Math.max(
            level,
            ground + sampler.sample(p).heightM - original.sample(p).heightM,
          );
        } else {
          const b = this.source?.box;
          const local =
            !b || (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height);
          heights[y * view.columns + x] = local
            ? Math.max(sampler.sample(p).heightM, water)
            : g
              ? gridHeight(g, p)
              : water;
        }
      }
    return { view, heights, seaLevelM: this.bases[0]!.terrain.projection.grid.seaLevelM };
  }
  height(
    stroke: HeightStroke | LakeStroke,
    prepared?: ReturnType<typeof prepareHeightBrush>,
  ): boolean {
    if (stroke.samples.length <= this.consumed) return false;
    let changed = false;
    // All visible tiles share one author computation and fixed visibility.
    // Tile edges cannot invent smoothing neighbours or duplicate attenuation.
    const visibility = this.visibilityGrid();
    const changes =
      'waterLevelM' in stroke
        ? applyLakeBrush(this.authorRecords, stroke, visibility, prepared)
        : applyCoupledTerrainBrush(
            this.authorRecords,
            stroke,
            undefined,
            visibility,
            undefined,
            prepared,
          );
    changed = Array.isArray(changes)
      ? changes.length > 0
      : changes.records.length > 0 || changes.remove.length > 0;
    const affected = terrainDraftBounds(
      this.authorRecords,
      Array.isArray(changes) ? changes : changes.records,
      Array.isArray(changes) ? [] : changes.remove,
    );
    this.tiles = this.bases.map((tile, index) => {
      const old = this.tiles[index]!,
        b = tile.terrain.projection.grid.view.box;

      let draft = this.heights.get(tile);
      if (!draft) {
        const g = tile.terrain.projection.grid;
        draft = new TerrainBrushDraft({
          ...g,
          editing: {
            ...g.editing!,
            author: { ...g.editing!.author!, records: this.authorRecords },
          },
          view: {
            ...g.view,
            ...this.visibility,
            surface: undefined,
            box: g.view.box,
            rows: g.view.rows,
            columns: g.view.columns,
          },
        });
        this.heights.set(tile, draft);
      }
      const updated = draft.update(stroke, changes, affected);
      if (!updated)
        return {
          ...old,
          terrain: {
            ...old.terrain,
            projection: {
              ...old.terrain.projection,
              grid: { ...old.terrain.projection.grid, editing: draft.grid.editing },
            },
          },
        };
      changed = true;
      const grid = {
        ...draft.grid,
        editing: draft.grid.editing!,
      };
      const { width, height, channels } = tile.material,
        current = old.material.channels,
        r = draft.changedRect;
      const raw = { ...grid, heights: draft.ground },
        before = { ...grid, heights: tile.terrain.projection.grid.editing!.ground },
        waterGrid = { ...grid, heights: grid.editing.water },
        beforeWater = { ...grid, heights: tile.terrain.projection.grid.editing!.water };
      let water: Uint8Array | undefined,
        baseColor: Uint8Array | undefined,
        forest: Uint8Array | undefined;
      const covers: Partial<Record<TerrainCoverChannel, Uint8Array>> = {};
      const relief = current.relief.slice(),
        radius = (b.width / width) * MACRO_RELIEF_RADIUS;
      const land = reliefRgb(this.land),
        sea = reliefRgb(terrainColors.water),
        v = grid.view;
      const left = Math.max(0, Math.floor(((r.x - 1) / (v.columns - 1)) * width)),
        right = Math.min(width, Math.ceil(((r.x + r.width) / (v.columns - 1)) * width));
      const top = Math.max(0, Math.floor(((r.y - 1) / (v.rows - 1)) * height)),
        bottom = Math.min(height, Math.ceil(((r.y + r.height) / (v.rows - 1)) * height));
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          const p = {
              x: b.x + ((x + 0.5) / width) * b.width,
              y: b.y + ((y + 0.5) / height) * b.height,
            },
            level = gridHeight(waterGrid, p);
          const wet = gridHeight(raw, p) <= level,
            wasWet = gridHeight(before, p) <= gridHeight(beforeWater, p),
            i = y * width + x,
            crossed = wet !== wasWet;
          const mask = crossed ? (wet ? 255 : 0) : channels.water[i]!,
            cover = crossed && wet ? 0 : channels.forest[i]!;
          const rgb = crossed ? (wet ? sea : land) : channels.baseColor.subarray(i * 4, i * 4 + 3);
          const h = gridHeight(grid, p),
            leftH = gridHeight(grid, { x: p.x - radius, y: p.y }),
            rightH = gridHeight(grid, { x: p.x + radius, y: p.y }),
            topH = gridHeight(grid, { x: p.x, y: p.y - radius }),
            bottomH = gridHeight(grid, { x: p.x, y: p.y + radius });
          const sx = (rightH - leftH) / (2 * radius),
            sy = (bottomH - topH) / (2 * radius),
            n = Math.hypot(sx, sy, 1),
            ridge = Math.max(0, (4 * h - leftH - rightH - topH - bottomH) / (2 * radius));
          relief.set(
            [
              Math.round((1 - sx / n) * 127.5),
              Math.round((1 - sy / n) * 127.5),
              Math.round((1 + 1 / n) * 127.5),
              Math.round(Math.min(1, ridge * MACRO_RIDGE_GAIN) * 255),
            ],
            i * 4,
          );
          for (const c of COVER_CHANNEL_NAMES) {
            const value = crossed && wet ? 0 : channels[c][i]!;
            if (current[c][i] !== value) {
              covers[c] ??= current[c].slice();
              covers[c]![i] = value;
            }
          }
          if (
            current.water[i] === mask &&
            current.forest[i] === cover &&
            rgb.every((v, c) => v === current.baseColor[i * 4 + c])
          )
            continue;
          water ??= current.water.slice();
          baseColor ??= current.baseColor.slice();
          forest ??= current.forest.slice();
          water[i] = mask;
          forest[i] = cover;
          for (let c = 0; c < 3; c++) baseColor[i * 4 + c] = rgb[c]!;
        }
      return {
        ...tile,
        terrain: { ...tile.terrain, projection: { ...tile.terrain.projection, grid } },
        material: {
          ...tile.material,
          channels: {
            ...current,
            ...covers,
            relief,
            ...(water ? { water, baseColor: baseColor!, forest: forest! } : {}),
          },
        },
      };
    });
    this.consumed = stroke.samples.length;
    return changed;
  }
  color(record: LandscapeRecord): boolean {
    const paint = record.paint;
    if (!paint) return false;
    const rgb = reliefRgb(paint.color),
      erase = reliefRgb(
        paint.target === 'water' ? terrainColors.water : DEFAULT_TERRAIN_STYLE.land,
      );
    let changed = false;
    const visible = terrainVisibility(this.visibilityGrid());
    this.tiles = this.bases.map((tile, index) => {
      const b = atlasWorldTileBounds(tile.tile),
        points = paint.strokes?.flat() ?? record.points;
      if (!touches(points, paint.radius, b.minX, b.minY, b.maxX, b.maxY)) return this.tiles[index]!;
      const { width, height, channels } = tile.material;
      const xs = points.map((p) => p.x),
        ys = points.map((p) => p.y),
        mpp = b.sizeM / width;
      const left = Math.max(0, Math.floor((Math.min(...xs) - paint.radius - b.minX) / mpp)),
        right = Math.min(width, Math.ceil((Math.max(...xs) + paint.radius - b.minX) / mpp));
      const top = Math.max(0, Math.floor((Math.min(...ys) - paint.radius - b.minY) / mpp)),
        bottom = Math.min(height, Math.ceil((Math.max(...ys) + paint.radius - b.minY) / mpp));
      if (right <= left || bottom <= top) return this.tiles[index]!;
      const w = right - left,
        h = bottom - top,
        box = { x: b.minX + left * mpp, y: b.minY + top * mpp, width: w * mpp, height: h * mpp };
      // Immediate feedback samples only the touched rectangle. The canonical
      // tile still owns bounded 4x4 sampling and exact hard masks after receipt.
      const raster = new LandscapeRasterizer(box, w, h, 0, 0, false);
      raster.paintPolygons(record.polygons, '#ffffff', 1);
      const mask = raster.finish();
      const iterator = pigmentStrokeCoverage(box, w, h, record, mask, function* () {});
      let next = iterator.next();
      while (!next.done) next = iterator.next();
      const coverage = next.value;
      const color = channels.baseColor.slice();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y + top) * width + x + left,
            j = y * w + x;
          const target =
            paint.target === 'water' ? channels.water[i]! / 255 : 1 - channels.water[i]! / 255;
          const alpha = ((coverage[j]! * mask[j * 4 + 3]!) / 255) * paint.opacity * target;
          if (!alpha || !visible({ x: box.x + (x + 0.5) * mpp, y: box.y + (y + 0.5) * mpp }))
            continue;
          for (let c = 0; c < 3; c++)
            color[i * 4 + c] = Math.round(
              color[i * 4 + c]! * (1 - alpha) +
                (paint.operation === 'erase' ? erase[c]! : rgb[c]!) * alpha,
            );
        }
      changed = true;
      return {
        ...tile,
        material: { ...tile.material, channels: { ...channels, baseColor: color } },
      };
    });
    return changed;
  }
}

/** Include segments crossing a tile even when neither endpoint lies inside it. */
function touches(
  points: readonly { x: number; y: number }[],
  radius: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]!,
      b = points[i]!;
    if (
      Math.max(a.x, b.x) + radius >= left &&
      Math.min(a.x, b.x) - radius <= right &&
      Math.max(a.y, b.y) + radius >= top &&
      Math.min(a.y, b.y) - radius <= bottom
    )
      return true;
  }
  return false;
}

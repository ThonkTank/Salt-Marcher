import {
  MACRO_RELIEF_RADIUS,
  MACRO_RIDGE_GAIN,
  COVER_CHANNEL_NAMES,
  type TerrainCoverChannel,
} from './terrain-material';
import type { AtlasSurfaceTile } from './atlas-surface-tile-stream';
import { TerrainBrushDraft } from './terrain-brush-draft';
import type { HeightStroke } from './terrain-brush';
import { gridHeight, terrainVisibility, type TerrainView } from './terrain-spatial-model';
import type { LandscapeRecord } from './atlas-landscape';
import { atlasWorldTileBounds } from './atlas-world-tiles';
import { LandscapeRasterizer } from './landscape-raster';
import { pigmentStrokeCoverage } from './landscape-pigment-coverage';
import { reliefRgb, DEFAULT_TERRAIN_STYLE } from './terrain-relief';
import { terrainColors } from './world-model';

/** Display-only draft. Each new gesture starts from the previous local result,
 * including its editing ground; canonical receipt adoption happens separately. */
export class AtlasSurfaceDraft {
  private heights = new Map<AtlasSurfaceTile, TerrainBrushDraft>();
  private bases: readonly AtlasSurfaceTile[];
  tiles: readonly AtlasSurfaceTile[];
  get baseTiles() {
    return this.bases;
  }
  constructor(
    tiles: readonly AtlasSurfaceTile[],
    private visibility: TerrainView,
    private land = DEFAULT_TERRAIN_STYLE.land,
  ) {
    this.bases = tiles;
    this.tiles = tiles;
  }
  height(stroke: HeightStroke): boolean {
    let changed = false;
    this.tiles = this.bases.map((tile, index) => {
      const old = this.tiles[index]!,
        b = tile.terrain.projection.grid.view.box;
      if (!touches(stroke.samples, stroke.radius, b.x, b.y, b.x + b.width, b.y + b.height))
        return old;
      let draft = this.heights.get(tile);
      if (!draft) {
        const g = tile.terrain.projection.grid;
        draft = new TerrainBrushDraft({
          ...g,
          view: {
            ...g.view,
            ...this.visibility,
            box: g.view.box,
            rows: g.view.rows,
            columns: g.view.columns,
          },
        });
        this.heights.set(tile, draft);
      }
      if (!draft.update(stroke)) return old;
      changed = true;
      const grid = {
        ...draft.grid,
        editing: { ground: draft.ground, water: tile.terrain.projection.grid.editing!.water },
      };
      const { width, height, channels } = tile.material,
        current = old.material.channels,
        r = draft.changedRect;
      const raw = { ...grid, heights: draft.ground },
        before = { ...grid, heights: tile.terrain.projection.grid.editing!.ground },
        waterGrid = { ...grid, heights: grid.editing.water };
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
            wasWet = gridHeight(before, p) <= level,
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
      const color = channels.baseColor.slice(),
        g = tile.terrain.projection.grid;
      const visible = terrainVisibility({
        ...g,
        view: {
          ...g.view,
          ...this.visibility,
          box: g.view.box,
          columns: g.view.columns,
          rows: g.view.rows,
        },
      });
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

import { BudgetCache } from "./budgetCache";
import type { TerrainResponse } from "./generated/TerrainResponse";
import type { TerrainArgs } from "./generated/TerrainArgs";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainPreview } from "./generated/TerrainPreview";
import type { Bounds, WorldPoint } from "./model";

export function terrainRequest(bounds: Bounds, scale: number): TerrainArgs {
  let level = Math.max(0, Math.ceil(Math.log2(8 / (5 * scale))));
  const keys = (level: number): [number, number][] => {
    const width = 160 * 2 ** level,
      out: [number, number][] = [];
    const x0 = Math.floor(Math.max(-5e6, bounds[0]) / width),
      x1 = Math.floor(Math.min(5e6, bounds[2]) / width);
    const y0 = Math.floor(Math.max(-5e6, bounds[1]) / width),
      y1 = Math.floor(Math.min(5e6, bounds[3]) / width);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) return [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) out.push([x, y]);
    return out;
  };
  while (level < 21 && !keys(level).length) level++;
  return { level: Math.min(21, level), tiles: keys(Math.min(21, level)) };
}
export function heightAt(view: TerrainResponse, p: WorldPoint): number | null {
  const step = 5 * 2 ** view.level,
    x = Math.floor(p[0] / step),
    y = Math.floor(p[1] / step);
  const tx = Math.floor(x / 32),
    ty = Math.floor(y / 32),
    tile = view.tiles.find((t) => t.x === tx && t.y === ty);
  if (!tile) return null;
  const dx = x - tx * 32,
    dy = y - ty * 32,
    z = (a: number, b: number) => tile.heights[(dy + b) * 33 + dx + a];
  const u = p[0] / step - x,
    v = p[1] / step - y;
  return u >= v
    ? z(0, 0) * (1 - u) + z(1, 0) * (u - v) + z(1, 1) * v
    : z(0, 0) * (1 - v) + z(1, 1) * u + z(0, 1) * (v - u);
}
type Vertex = [number, number, number];
function clipped(tri: Vertex[], level: number): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < tri.length; i++) {
    const a = tri[i],
      b = tri[(i + 1) % tri.length],
      inside = a[2] < level;
    if (inside) out.push(a);
    if (inside !== b[2] < level) {
      const t = (level - a[2]) / (b[2] - a[2]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), level]);
    }
  }
  return out;
}
function paintTerrainRaw(
  c: CanvasRenderingContext2D,
  view: TerrainResponse,
  scale: number,
  contours: boolean,
  preview?: TerrainPreview,
  waterOnly = false,
  relief = true,
) {
  const step = 5 * 2 ** view.level,
    water = preview?.waterLevel ?? view.waterLevel;
  const overrides = new Map(
    preview?.points.map(([x, y, z]) => [`${x}:${y}`, z]),
  );
  const interval = 5 * 2 ** Math.max(0, Math.ceil(Math.log2(0.4 / scale)));
  const path = (v: Vertex[]) => {
    c.beginPath();
    v.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
  };
  for (const tile of view.tiles) {
    const vertex = (x: number, y: number): Vertex => {
      const wx = (tile.x * 32 + x) * step,
        wy = (tile.y * 32 + y) * step;
      return [
        wx,
        wy,
        overrides.get(`${wx / 5}:${wy / 5}`) ?? tile.heights[y * 33 + x],
      ];
    };
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const a = vertex(x, y),
          b = vertex(x + 1, y),
          d = vertex(x, y + 1),
          e = vertex(x + 1, y + 1);
        for (const tri of [
          [a, b, e],
          [a, e, d],
        ]) {
          if (!waterOnly) {
            const dx = (tri[1] === b ? b[2] - a[2] : e[2] - d[2]) / step,
              dy = (tri[1] === b ? e[2] - b[2] : d[2] - a[2]) / step;
            const shade = Math.max(
              0.45,
              Math.min(
                1.2,
                (1 + 0.45 * dx - 0.55 * dy) / Math.sqrt(1 + dx * dx + dy * dy),
              ),
            );
            if (relief) {
              c.fillStyle = `rgb(${Math.round(178 * shade)},${Math.round(185 * shade)},${Math.round(151 * shade)})`;
              path(tri);
              c.fill();
            }
            if (contours) {
              const lo = Math.min(...tri.map((p) => p[2])),
                hi = Math.max(...tri.map((p) => p[2]));
              // Bound line work on very steep triangles at wide zoom.
              const every =
                interval * Math.max(1, Math.ceil((hi - lo) / interval / 16));
              for (
                let level = Math.ceil(lo / every) * every;
                level < hi;
                level += every
              ) {
                const intersections: Vertex[] = [];
                for (let i = 0; i < 3; i++) {
                  const p = tri[i],
                    q = tri[(i + 1) % 3];
                  if (p[2] < level !== q[2] < level) {
                    const t = (level - p[2]) / (q[2] - p[2]);
                    intersections.push([
                      p[0] + t * (q[0] - p[0]),
                      p[1] + t * (q[1] - p[1]),
                      level,
                    ]);
                  }
                }
                if (intersections.length === 2) {
                  c.beginPath();
                  c.moveTo(intersections[0][0], intersections[0][1]);
                  c.lineTo(intersections[1][0], intersections[1][1]);
                  c.lineWidth = 0.7 / scale;
                  c.strokeStyle = "#55674e80";
                  c.stroke();
                }
              }
            }
          } else {
            const wet = clipped(tri, water);
            if (wet.length >= 3) {
              path(wet);
              c.fillStyle = "#86b8c6";
              c.fill();
            }
          }
        }
      }
  }
}

type Raster = {
  key: string;
  land: HTMLCanvasElement;
  water: HTMLCanvasElement;
};
export class TerrainPainter {
  private rasters = new BudgetCache<SurfaceTile, Raster>(32 * 1024 * 1024);
  paint(
    c: CanvasRenderingContext2D,
    view: TerrainResponse,
    scale: number,
    contours: boolean,
    preview?: TerrainPreview,
    waterOnly = false,
  ) {
    if (preview) {
      paintTerrainRaw(c, view, scale, contours, preview, waterOnly);
      return;
    }
    const width = 160 * 2 ** view.level;
    const pixels = Math.max(
      128,
      Math.min(
        1024,
        2 **
          Math.floor(
            Math.log2(
              Math.sqrt(
                (32 * 1024 * 1024) / (8 * Math.max(1, view.tiles.length)),
              ),
            ),
          ),
        2 **
          Math.ceil(
            Math.log2(width * scale * (globalThis.devicePixelRatio || 1)),
          ),
      ),
    );
    const key = `${pixels}:${view.level}:${view.waterLevel}:${contours}`;
    const neighboringTiles = new Map(
      view.tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]),
    );
    const sample = (x: number, y: number): number | undefined => {
      const tx = Math.floor(x / 32),
        ty = Math.floor(y / 32),
        tile = neighboringTiles.get(`${tx}:${ty}`);
      return tile?.heights[(y - ty * 32) * 33 + x - tx * 32];
    };
    for (const tile of view.tiles) {
      let cached = this.rasters.get(tile);
      // Keep the contour preference identical between the land and water passes.
      if (
        !cached ||
        (!waterOnly && cached.key !== key) ||
        (waterOnly &&
          !cached.key.startsWith(`${pixels}:${view.level}:${view.waterLevel}:`))
      ) {
        const make = (wet: boolean) => {
          const canvas = document.createElement("canvas");
          canvas.width = pixels;
          canvas.height = pixels;
          const context = canvas.getContext("2d")!;
          if (!wet) {
            const shades = tile.heights.map((_, i) => {
              const x = i % 33,
                y = Math.floor(i / 33),
                x0 = Math.max(0, x - 1),
                x1 = Math.min(32, x + 1),
                y0 = Math.max(0, y - 1),
                y1 = Math.min(32, y + 1);
              const gx = tile.x * 32 + x,
                gy = tile.y * 32 + y;
              const left = sample(gx - 1, gy),
                right = sample(gx + 1, gy),
                up = sample(gx, gy - 1),
                down = sample(gx, gy + 1);
              const dx =
                ((right ?? tile.heights[y * 33 + x1]) -
                  (left ?? tile.heights[y * 33 + x0])) /
                ((((right === undefined ? x1 : x + 1) -
                  (left === undefined ? x0 : x - 1)) *
                  width) /
                  32);
              const dy =
                ((down ?? tile.heights[y1 * 33 + x]) -
                  (up ?? tile.heights[y0 * 33 + x])) /
                ((((down === undefined ? y1 : y + 1) -
                  (up === undefined ? y0 : y - 1)) *
                  width) /
                  32);
              return Math.max(
                0.58,
                Math.min(
                  1.15,
                  0.38 +
                    (0.62 * (1 + 0.45 * dx - 0.55 * dy)) /
                      Math.sqrt(1 + dx * dx + dy * dy),
                ),
              );
            });
            const raster = context.createImageData(pixels, pixels);
            for (let y = 0; y < pixels; y++)
              for (let x = 0; x < pixels; x++) {
                const gx = ((x + 0.5) * 32) / pixels,
                  gy = ((y + 0.5) * 32) / pixels,
                  ix = Math.floor(gx),
                  iy = Math.floor(gy),
                  u = gx - ix,
                  v = gy - iy,
                  i = iy * 33 + ix;
                const shade =
                  shades[i] * (1 - u) * (1 - v) +
                  shades[i + 1] * u * (1 - v) +
                  shades[i + 33] * (1 - u) * v +
                  shades[i + 34] * u * v;
                const at = (y * pixels + x) * 4;
                raster.data[at] = 178 * shade;
                raster.data[at + 1] = 185 * shade;
                raster.data[at + 2] = 151 * shade;
                raster.data[at + 3] = 255;
              }
            context.putImageData(raster, 0, 0);
          } else {
            const raster = context.createImageData(pixels, pixels),
              step = width / 32;
            for (let y = 0; y < pixels; y++)
              for (let x = 0; x < pixels; x++) {
                const gx = ((x + 0.5) * 32) / pixels,
                  gy = ((y + 0.5) * 32) / pixels,
                  ix = Math.floor(gx),
                  iy = Math.floor(gy),
                  u = gx - ix,
                  v = gy - iy,
                  i = iy * 33 + ix;
                const a = tile.heights[i],
                  b = tile.heights[i + 1],
                  d = tile.heights[i + 33],
                  e = tile.heights[i + 34];
                const z =
                  u >= v
                    ? a * (1 - u) + b * (u - v) + e * v
                    : a * (1 - v) + e * u + d * (v - u);
                const slope =
                  Math.hypot(u >= v ? b - a : e - d, u >= v ? e - b : d - a) /
                  step;
                const coverage =
                  slope < 1e-9
                    ? z < view.waterLevel
                      ? 1
                      : 0
                    : Math.max(
                        0,
                        Math.min(
                          1,
                          0.5 +
                            ((view.waterLevel - z) * pixels) / width / slope,
                        ),
                      );
                const at = (y * pixels + x) * 4;
                raster.data[at] = 134;
                raster.data[at + 1] = 184;
                raster.data[at + 2] = 198;
                raster.data[at + 3] = 255 * coverage;
              }
            context.putImageData(raster, 0, 0);
          }
          context.setTransform(
            pixels / width,
            0,
            0,
            pixels / width,
            -tile.x * pixels,
            -tile.y * pixels,
          );
          if (!wet)
            paintTerrainRaw(
              context,
              { ...view, tiles: [tile] },
              scale,
              contours,
              undefined,
              wet,
              false,
            );
          return canvas;
        };
        cached = { key, land: make(false), water: make(true) };
        this.rasters.set(tile, cached, cached.land.width ** 2 * 8);
        this.rasters.trim();
      }
      c.drawImage(
        waterOnly ? cached.water : cached.land,
        tile.x * width,
        tile.y * width,
        width,
        width,
      );
    }
  }
}

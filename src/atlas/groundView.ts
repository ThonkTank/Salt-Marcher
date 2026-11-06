import { tileRequest } from "./lod";
import { heightAt } from "./terrainView";
import type { TerrainResponse } from "./generated/TerrainResponse";
import type { GroundArgs } from "./generated/GroundArgs";
import type { GroundResponse } from "./generated/GroundResponse";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { GroundTile } from "./generated/GroundTile";
import type { Bounds, WorldPoint } from "./model";
import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";

const decoded = new WeakMap<GroundTile, Uint8Array>();
function groundPixels(tile: GroundTile): Uint8Array {
  let pixels = decoded.get(tile);
  if (!pixels) {
    pixels = Uint8Array.from(atob(tile.pixels), (c) => c.charCodeAt(0));
    decoded.set(tile, pixels);
  }
  return pixels;
}
export function groundRequest(bounds: Bounds, level: number): GroundArgs {
  return tileRequest(bounds, level, 64, 24);
}
export function groundColorAt(
  view: GroundResponse | undefined,
  point: WorldPoint,
): [number, number, number] | null {
  if (!view) return null;
  const step = 2 ** view.level,
    x = point[0] / step,
    y = point[1] / step;
  const tx = Math.floor(x / 64),
    ty = Math.floor(y / 64);
  const tile = view.tiles.find((t) => t.x === tx && t.y === ty);
  if (!tile) return null;
  const i =
    ((Math.floor(y) - ty * 64 + 1) * 66 + Math.floor(x) - tx * 64 + 1) * 4;
  const pixels = groundPixels(tile);
  const a = pixels[i + 3] / 255;
  const base = [178, 185, 151];
  return base.map((c, k) => Math.round(pixels[i + k] + c * (1 - a))) as [
    number,
    number,
    number,
  ];
}
type GroundRaster = {
  raster: HTMLCanvasElement;
  level: number;
  terrainLevel: number | undefined;
  neighbors: SurfaceTile[];
};
export class GroundPainter {
  private cache = new BudgetCache<GroundTile, GroundRaster>(
    CACHE_BUDGETS.rasterGround.bytes,
    CACHE_BUDGETS.rasterGround.entries,
  );
  paint(
    c: CanvasRenderingContext2D,
    view: GroundResponse,
    terrain?: TerrainResponse,
  ) {
    c.save();
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = "source-over";
    const step = 2 ** view.level,
      width = 64 * step;
    for (const tile of view.tiles) {
      // Include the pixel halo and all four relief samples. Compare immutable
      // tiles, not response wrappers: panning often publishes the same surface.
      const margin = 2 * step + (terrain ? 5 * 2 ** terrain.level : 0);
      const terrainWidth = terrain ? 160 * 2 ** terrain.level : 0;
      const neighbors =
        terrain?.tiles.filter(
          (t) =>
            t.x * terrainWidth <= (tile.x + 1) * width + margin &&
            (t.x + 1) * terrainWidth >= tile.x * width - margin &&
            t.y * terrainWidth <= (tile.y + 1) * width + margin &&
            (t.y + 1) * terrainWidth >= tile.y * width - margin,
        ) ?? [];
      const cached = this.cache.get(tile);
      let raster = cached?.raster;
      if (
        !cached ||
        cached.level !== view.level ||
        cached.terrainLevel !== terrain?.level ||
        cached.neighbors.length !== neighbors.length ||
        cached.neighbors.some((t, i) => t !== neighbors[i])
      ) {
        raster = document.createElement("canvas");
        raster.width = 66;
        raster.height = 66;
        const context = raster.getContext("2d")!;
        const data = context.createImageData(66, 66);
        const pixels = groundPixels(tile);
        for (let i = 0; i < data.data.length; i += 4) {
          const a = pixels[i + 3];
          let shade = 1;
          if (a && terrain) {
            const x = (tile.x * 64 + ((i / 4) % 66) - 0.5) * step,
              y = (tile.y * 64 + Math.floor(i / 4 / 66) - 0.5) * step;
            const h = 5 * 2 ** terrain.level;
            const left = heightAt(terrain, [x - h, y]),
              right = heightAt(terrain, [x + h, y]),
              up = heightAt(terrain, [x, y - h]),
              down = heightAt(terrain, [x, y + h]);
            const dx =
                left !== null && right !== null ? (right - left) / (2 * h) : 0,
              dy = up !== null && down !== null ? (down - up) / (2 * h) : 0;
            shade = Math.max(
              0.58,
              Math.min(
                1.15,
                0.38 +
                  (0.62 * (1 + 0.45 * dx - 0.55 * dy)) /
                    Math.sqrt(1 + dx * dx + dy * dy),
              ),
            );
          }
          for (let k = 0; k < 3; k++)
            data.data[i + k] = a
              ? Math.round(((pixels[i + k] * 255) / a) * shade)
              : 0;
          data.data[i + 3] = a;
        }
        context.putImageData(data, 0, 0);
        this.cache.set(
          tile,
          {
            raster,
            level: view.level,
            terrainLevel: terrain?.level,
            neighbors,
          },
          66 * 66 * 4,
        );
      }
      c.save();
      c.beginPath();
      c.rect(tile.x * width, tile.y * width, width, width);
      c.clip();
      c.drawImage(
        raster!,
        tile.x * width - step,
        tile.y * width - step,
        width + 2 * step,
        width + 2 * step,
      );
      c.restore();
    }
    this.cache.trim();
    c.restore();
  }
}

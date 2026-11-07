import { tileRequest } from "./lod";
import { decodeBytes, prepareMaterialSampler } from "./terrainRaster";
import type { TerrainResponse } from "./generated/TerrainResponse";
import type { GroundArgs } from "./generated/GroundArgs";
import type { GroundResponse } from "./generated/GroundResponse";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { GroundTile } from "./generated/GroundTile";
import type { Bounds, WorldPoint } from "./model";
import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";

const soilBase = [178, 185, 151],
  rockBase = [145, 142, 137],
  snowBase = [245, 247, 250];

const decoded = new WeakMap<GroundTile, Uint8Array>();
function groundPixels(tile: GroundTile): Uint8Array {
  let pixels = decoded.get(tile);
  if (!pixels) {
    pixels = decodeBytes(tile.pixels);
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
  layer: "soil" | "rock" = "soil",
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
    (layer === "rock" ? 66 * 66 * 4 : 0) +
    ((Math.floor(y) - ty * 64 + 1) * 66 + Math.floor(x) - tx * 64 + 1) * 4;
  const pixels = groundPixels(tile);
  const a = (pixels[i + 3] ?? 0) / 255;
  const base = layer === "rock" ? rockBase : soilBase;
  return base.map((c, k) => Math.round((pixels[i + k] ?? 0) + c * (1 - a))) as [
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
    const materialAt = terrain ? prepareMaterialSampler(terrain) : undefined;
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
          const soilAlpha = pixels[i + 3] / 255;
          const rockAt = i + 66 * 66 * 4;
          const rockAlpha = (pixels[rockAt + 3] ?? 0) / 255;
          const alpha = Math.max(soilAlpha, rockAlpha);
          if (!alpha) continue;
          const x = (tile.x * 64 + ((i / 4) % 66) - 0.5) * step;
          const y = (tile.y * 64 + Math.floor(i / 4 / 66) - 0.5) * step;
          const [rock, snow, shade] = materialAt?.(x, y) ?? [0, 0, 1];
          // Exact overlay over the automatic material mixture. Each pigment
          // replaces only its own base color; snow remains above both layers.
          for (let k = 0; k < 3; k++) {
            const soil = pixels[i + k] + soilBase[k] * (alpha - soilAlpha);
            const stone =
              (pixels[rockAt + k] ?? 0) + rockBase[k] * (alpha - rockAlpha);
            data.data[i + k] = Math.round(
              (((soil * (1 - rock) + stone * rock) / alpha) * (1 - snow) +
                snowBase[k] * snow) *
                shade,
            );
          }
          data.data[i + 3] = Math.round(alpha * 255);
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

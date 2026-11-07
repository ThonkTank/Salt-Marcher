import { forestCanopyAt } from "./forestCanopy";
import type { LandscapeResponse } from "./generated/LandscapeResponse";
import {
  landscapeColors,
  landscapeBiomes,
  landscapeDetails,
  landscapeSymbols,
  type LandscapeWeights,
} from "./landscapeView";
import { paintScenery } from "./sceneryPaint";
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
/** Editor cameras are axis-aligned. Keep a device-pixel guard for rounded clips. */
function visibleRasterTile(
  tile: GroundTile,
  width: number,
  transform: DOMMatrix,
  canvas: HTMLCanvasElement,
): boolean {
  const left = tile.x * width * transform.a + transform.e;
  const top = tile.y * width * transform.d + transform.f;
  return (
    left <= canvas.width + 1 &&
    top <= canvas.height + 1 &&
    left + width * transform.a >= -1 &&
    top + width * transform.d >= -1
  );
}
type GroundRaster = {
  raster: HTMLCanvasElement;
  canopy?: HTMLCanvasElement | null;
  level: number;
  terrainLevel: number | undefined;
  neighbors: SurfaceTile[];
};
export class GroundPainter {
  private landscapeCache = new BudgetCache<GroundTile, GroundRaster>(
    CACHE_BUDGETS.rasterLandscape.bytes,
    CACHE_BUDGETS.rasterLandscape.entries,
  );
  private cache = new BudgetCache<GroundTile, GroundRaster>(
    CACHE_BUDGETS.rasterGround.bytes,
    CACHE_BUDGETS.rasterGround.entries,
  );
  paintLandscape(
    c: CanvasRenderingContext2D,
    view: LandscapeResponse,
    terrain: TerrainResponse | undefined,
    scale = 0,
  ) {
    if (view.tiles.every((tile) => !tile.pixels)) return;
    const step = 2 ** view.level,
      width = 64 * step;
    const materialAt = terrain ? prepareMaterialSampler(terrain) : undefined;
    c.save();
    c.imageSmoothingEnabled = true;
    const transform = c.getTransform();
    const canopyAlpha =
      landscapeDetails(scale).find((detail) => !detail.near)?.alpha ?? 0;
    for (const tile of view.tiles) {
      if (!tile.pixels || !visibleRasterTile(tile, width, transform, c.canvas))
        continue;
      const tw = terrain ? 160 * 2 ** terrain.level : 0;
      const margin = 2 * step + (terrain ? 5 * 2 ** terrain.level : 0);
      const neighbors =
        terrain?.tiles.filter(
          (t) =>
            t.x * tw <= (tile.x + 1) * width + margin &&
            (t.x + 1) * tw >= tile.x * width - margin &&
            t.y * tw <= (tile.y + 1) * width + margin &&
            (t.y + 1) * tw >= tile.y * width - margin,
        ) ?? [];
      const old = this.landscapeCache.get(tile);
      let raster = old?.raster;
      let canopy = old?.canopy;
      if (
        !old ||
        old.level !== view.level ||
        old.terrainLevel !== terrain?.level ||
        old.neighbors.length !== neighbors.length ||
        old.neighbors.some((t, i) => t !== neighbors[i])
      ) {
        canopy = undefined;
        raster = document.createElement("canvas");
        raster.width = raster.height = 66;
        const ctx = raster.getContext("2d")!,
          data = ctx.createImageData(66, 66),
          pixels = groundPixels(tile);
        for (let i = 0; i < data.data.length; i += 4) {
          const total =
            (pixels[i] ?? 0) +
            (pixels[i + 1] ?? 0) +
            (pixels[i + 2] ?? 0) +
            (pixels[i + 3] ?? 0);
          if (!total) continue;
          const x = (tile.x * 64 + ((i / 4) % 66) - 0.5) * step,
            y = (tile.y * 64 + Math.floor(i / 4 / 66) - 0.5) * step;
          const [, snow, shade] = materialAt?.(x, y) ?? [0, 0, 1];
          for (let k = 0; k < 3; k++)
            data.data[i + k] = Math.round(
              ((landscapeColors.reduce(
                (sum, color, b) => sum + color[k] * (pixels[i + b] ?? 0),
                0,
              ) /
                total) *
                (1 - snow) +
                snowBase[k] * snow) *
                shade,
            );
          data.data[i + 3] = total;
        }
        ctx.putImageData(data, 0, 0);
        this.landscapeCache.set(
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
      if (canopyAlpha > 0 && canopy === undefined) {
        const pixels = groundPixels(tile);
        canopy = null;
        if (pixels.some((v, i) => i % 4 === 0 && v > 0)) {
          canopy = document.createElement("canvas");
          canopy.width = canopy.height = 130;
          const ctx = canopy.getContext("2d")!;
          const data = ctx.createImageData(130, 130);
          for (let y = 0; y < 130; y++)
            for (let x = 0; x < 130; x++) {
              // Two foliage samples per author texel, with one output halo texel.
              const px = (x - 0.5) / 2 + 0.5,
                py = (y - 0.5) / 2 + 0.5;
              const ix = Math.floor(px),
                iy = Math.floor(py);
              const fx = px - ix,
                fy = py - iy;
              let density = 0;
              for (let yy = 0; yy < 2; yy++)
                for (let xx = 0; xx < 2; xx++)
                  density +=
                    ((pixels[((iy + yy) * 66 + ix + xx) * 4] ?? 0) *
                      (xx ? fx : 1 - fx) *
                      (yy ? fy : 1 - fy)) /
                    255;
              if (!density) continue;
              const wx = (tile.x * 64 + (x - 0.5) / 2) * step;
              const wy = (tile.y * 64 + (y - 0.5) / 2) * step;
              const rgba = forestCanopyAt(wx, wy, density);
              if (!rgba[3]) continue;
              const [, snow, shade] = materialAt?.(wx, wy) ?? [0, 0, 1];
              const i = (y * 130 + x) * 4;
              for (let k = 0; k < 3; k++) data.data[i + k] = rgba[k] * shade;
              data.data[i + 3] = rgba[3] * (1 - snow);
            }
          ctx.putImageData(data, 0, 0);
        }
        this.landscapeCache.set(
          tile,
          {
            raster: raster!,
            canopy,
            level: view.level,
            terrainLevel: terrain?.level,
            neighbors,
          },
          (66 * 66 + (canopy ? 130 * 130 : 0)) * 4,
        );
      }
      c.save();
      c.beginPath();
      // Keep both clipping and image destinations in device space. WebKit can
      // lose precision for large world image coordinates even with a device clip.
      // Fractional image bounds retain the world-aligned source halo/filtering.
      const x = Math.round(tile.x * width * transform.a + transform.e);
      const y = Math.round(tile.y * width * transform.d + transform.f);
      const right = Math.round(
        (tile.x + 1) * width * transform.a + transform.e,
      );
      const bottom = Math.round(
        (tile.y + 1) * width * transform.d + transform.f,
      );
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.rect(x, y, right - x, bottom - y);
      c.clip();
      c.drawImage(
        raster!,
        tile.x * width * transform.a + transform.e - step * transform.a,
        tile.y * width * transform.d + transform.f - step * transform.d,
        (width + 2 * step) * transform.a,
        (width + 2 * step) * transform.d,
      );
      if (canopy && canopyAlpha > 0) {
        c.globalAlpha *= canopyAlpha;
        c.drawImage(
          canopy,
          tile.x * width * transform.a + transform.e - (step * transform.a) / 2,
          tile.y * width * transform.d + transform.f - (step * transform.d) / 2,
          (width + step) * transform.a,
          (width + step) * transform.d,
        );
      }
      c.restore();
    }
    this.landscapeCache.trim();
    c.restore();
  }
  paintLandscapeSymbols(
    c: CanvasRenderingContext2D,
    view: LandscapeResponse,
    terrain: TerrainResponse | undefined,
    scale: number,
  ) {
    const details = landscapeDetails(scale);
    if (!details.length || view.tiles.every((tile) => !tile.pixels)) return;
    const step = 2 ** view.level,
      width = 64 * step;
    const materialAt = terrain ? prepareMaterialSampler(terrain) : undefined;
    const tiles = new Map(view.tiles.map((t) => [`${t.x}:${t.y}`, t]));
    const sample = (x: number, y: number): LandscapeWeights => {
      const tx = Math.floor(x / width),
        ty = Math.floor(y / width);
      const tile = tiles.get(`${tx}:${ty}`);
      if (!tile) return [0, 0, 0, 0];
      const pixels = groundPixels(tile),
        px = x / step - tx * 64 + 0.5,
        py = y / step - ty * 64 + 0.5;
      const ix = Math.floor(px),
        iy = Math.floor(py),
        fx = px - ix,
        fy = py - iy;
      const weights = [0, 0, 0, 0];
      for (let yy = 0; yy < 2; yy++)
        for (let xx = 0; xx < 2; xx++) {
          const at = ((iy + yy) * 66 + ix + xx) * 4,
            a = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
          for (let k = 0; k < 4; k++) weights[k] += (pixels[at + k] ?? 0) * a;
        }
      const snow = materialAt?.(x, y)[1] ?? 0;
      return weights.map((w) => w * (1 - snow)) as unknown as LandscapeWeights;
    };
    c.save();
    {
      const t = c.getTransform();
      const bounds: Bounds = [
        -t.e / t.a,
        -t.f / t.d,
        (c.canvas.width - t.e) / t.a,
        (c.canvas.height - t.f) / t.d,
      ];
      const symbols = landscapeSymbols(bounds, scale, sample);
      for (const detail of details) {
        c.globalAlpha = detail.alpha;
        for (const biome of landscapeBiomes)
          paintScenery(
            c,
            {
              id: "",
              biome,
              assets: symbols
                .filter((s) => s.biome === biome && s.near === detail.near)
                .map((s) => s.asset),
            },
            scale,
            undefined,
            !detail.near,
          );
      }
    }
    c.restore();
  }
  paint(
    c: CanvasRenderingContext2D,
    view: GroundResponse,
    terrain?: TerrainResponse,
  ) {
    if (view.tiles.every((tile) => !tile.pixels)) return;
    c.save();
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = "source-over";
    const step = 2 ** view.level,
      width = 64 * step;
    const materialAt = terrain ? prepareMaterialSampler(terrain) : undefined;
    const transform = c.getTransform();
    for (const tile of view.tiles) {
      if (!tile.pixels || !visibleRasterTile(tile, width, transform, c.canvas))
        continue;
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

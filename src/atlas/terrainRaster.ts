import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainResponse } from "./generated/TerrainResponse";

type Decoded = {
  relief: Uint8Array;
  land?: HTMLCanvasElement;
  water?: HTMLCanvasElement;
};
const decoded = new BudgetCache<string, Decoded>(
  CACHE_BUDGETS.rasterTerrain.bytes,
  CACHE_BUDGETS.rasterTerrain.entries,
);
export function decodeBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function entry(tile: SurfaceTile): Decoded {
  let value = decoded.get(tile.contentId);
  if (!value) {
    value = { relief: decodeBytes(tile.raster!.relief) };
    decoded.set(
      tile.contentId,
      value,
      value.relief.length +
        128 +
        (value.relief.length === 4 ? 4 : (tile.raster!.pixels + 2) ** 2 * 4) +
        (tile.raster!.water.length === 4
          ? 4
          : (tile.raster!.pixels + 2) ** 2 * 4),
    );
    decoded.trim();
  }
  return value;
}
/** Only decodes prepared drawing data. The kernel owns surface and coverage math. */
export function terrainImage(
  tile: SurfaceTile,
  wet: boolean,
): HTMLCanvasElement {
  const value = entry(tile),
    key = wet ? "water" : "land";
  if (value[key]) return value[key];
  const raster = tile.raster!;
  const alpha = wet ? decodeBytes(raster.water) : undefined;
  // A constant texture needs one texel, including its logically constant halo.
  const constant = wet ? alpha!.length === 1 : value.relief.length === 4;
  const size = constant ? 1 : raster.pixels + 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!,
    data = c.createImageData(size, size);
  if (wet) {
    for (let i = 0; i < size * size; i++) {
      const at = i * 4;
      data.data[at] = 134;
      data.data[at + 1] = 184;
      data.data[at + 2] = 198;
      data.data[at + 3] = alpha![constant ? 0 : i];
    }
  } else data.data.set(value.relief);
  c.putImageData(data, 0, 0);
  value[key] = canvas;
  return canvas;
}
/** Ground colors reuse the prepared relief; this is image sampling, not terrain reconstruction. */
export function prepareReliefSampler(
  view: TerrainResponse,
): (x: number, y: number) => number {
  const width = 160 * 2 ** view.level;
  let tx = NaN,
    ty = NaN;
  let tile: SurfaceTile | undefined;
  let bytes: Uint8Array | undefined;
  // Scanline callers stay in the same tile for many pixels. Keep only that
  // decoded reference for this paint call, not another persistent cache.
  return (x, y) => {
    const nextX = Math.floor(x / width),
      nextY = Math.floor(y / width);
    if (nextX !== tx || nextY !== ty) {
      tx = nextX;
      ty = nextY;
      tile = view.tiles.find((t) => t.x === tx && t.y === ty);
      bytes = tile?.raster ? entry(tile).relief : undefined;
    }
    if (!tile?.raster || !bytes) return 1;
    if (bytes.length === 4) return bytes[0] / 178;
    const n = tile.raster.pixels;
    const px = Math.floor((x / width - tx) * n) + 1;
    const py = Math.floor((y / width - ty) * n) + 1;
    return bytes[(py * (n + 2) + px) * 4] / 178;
  };
}

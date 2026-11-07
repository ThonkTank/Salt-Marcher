import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainResponse } from "./generated/TerrainResponse";

type Decoded = {
  materials?: Uint8Array;
  contours?: Path2D;
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
function rasterCost(tile: SurfaceTile): number {
  const raster = tile.raster!;
  // Base64 length conservatively bounds decoded bytes (up to two padding bytes).
  // Reserve both possible textures without decoding unused channels.
  return (
    raster.materials.length * 0.75 +
    128 +
    (raster.relief.length === 8 ? 4 : (raster.pixels + 2) ** 2 * 4) +
    (raster.water.length === 4 ? 4 : (raster.pixels + 2) ** 2 * 4)
  );
}
function entry(tile: SurfaceTile): Decoded {
  let value = decoded.get(tile.contentId);
  if (!value) {
    value = {};
    decoded.set(tile.contentId, value, rasterCost(tile));
    decoded.trim();
  }
  return value;
}
/** Reuse exact worker segments; optional geometry cannot evict retained textures. */
export function terrainContourPath(tile: SurfaceTile): Path2D | null {
  const segments = tile.raster?.contours;
  if (!segments?.length) return null;
  const value = decoded.get(tile.contentId) ?? {};
  if (value.contours) return value.contours;
  const path = new Path2D();
  for (const [x, y, u, v] of segments) {
    path.moveTo(x, y);
    path.lineTo(u, v);
  }
  // Estimated Path2D storage, not a measurement of browser-native allocations.
  decoded.setIfFits(
    tile.contentId,
    { ...value, contours: path },
    rasterCost(tile) + 256 + segments.length * 64,
  );
  return path;
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
  // The canvas owns the prepared image; keeping these source bytes would
  // duplicate its RGBA pixels for the entire cache lifetime.
  const relief = wet ? undefined : decodeBytes(raster.relief);
  // A constant texture needs one texel, including its logically constant halo.
  const constant = wet ? alpha!.length === 1 : relief!.length === 4;
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
  } else data.data.set(relief!);
  c.putImageData(data, 0, 0);
  value[key] = canvas;
  return canvas;
}
/** Sample prepared material weights and illumination, without reconstructing terrain. */
export function prepareMaterialSampler(
  view: TerrainResponse,
): (x: number, y: number) => [number, number, number] {
  const width = 160 * 2 ** view.level;
  let tx = NaN,
    ty = NaN;
  // Raster cache hits never sample materials, so build only on first use.
  let tiles: Map<string, SurfaceTile> | undefined;
  let tile: SurfaceTile | undefined;
  let bytes: Uint8Array | undefined;
  return (x, y) => {
    const nextX = Math.floor(x / width),
      nextY = Math.floor(y / width);
    if (nextX !== tx || nextY !== ty) {
      tx = nextX;
      ty = nextY;
      tiles ??= new Map(view.tiles.map((t) => [`${t.x},${t.y}`, t]));
      tile = tiles.get(`${tx},${ty}`);
      const value = tile?.raster ? entry(tile) : undefined;
      bytes = value
        ? (value.materials ??= decodeBytes(tile!.raster!.materials))
        : undefined;
    }
    if (!tile?.raster || !bytes) return [0, 0, 1];
    if (bytes.length === 3)
      return [bytes[0] / 255, bytes[1] / 255, (bytes[2] / 255) * 1.15];
    const gx = (x / width - tx) * 32 + 1,
      gy = (y / width - ty) * 32 + 1;
    const ix = Math.floor(gx),
      iy = Math.floor(gy),
      u = gx - ix,
      v = gy - iy;
    const i = iy * 35 + ix;
    const channel = (k: number) =>
      Math.round(
        bytes![i * 3 + k] * (1 - u) * (1 - v) +
          bytes![(i + 1) * 3 + k] * u * (1 - v) +
          bytes![(i + 35) * 3 + k] * (1 - u) * v +
          bytes![(i + 36) * 3 + k] * u * v,
      ) / 255;
    return [channel(0), channel(1), channel(2) * 1.15];
  };
}

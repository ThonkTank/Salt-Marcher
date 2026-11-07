/** Maximum retained presentation data; active response objects may also hold tiles. */
const MiB = 1024 * 1024;
export const CACHE_BUDGETS = {
  city: { bytes: 64 * MiB, entries: 256 },
  landscape: { bytes: 16 * MiB, entries: 256 },
  rasterLandscape: { bytes: 16 * MiB, entries: 256 },
  ground: { bytes: 32 * MiB, entries: 256 },
  terrain: { bytes: 32 * MiB, entries: 256 },
  rasterTerrain: { bytes: 32 * MiB, entries: 256 },
  rasterGround: { bytes: 16 * MiB, entries: 256 },
  exteriorGeometry: { bytes: 16 * MiB, entries: 256 },
  riverGeometry: { bytes: 16 * MiB, entries: 256 },
} as const;

// RGBA relief, alpha and a fixed material control grid as UTF-16 Base64, decoded arrays and two canvases.
// The request allowance includes halo/array overhead; payload costs use actual lengths.
export const TERRAIN_RASTER_BYTES = {
  decoded: 12,
  request: 28,
  materials: 16 * 1024,
} as const;

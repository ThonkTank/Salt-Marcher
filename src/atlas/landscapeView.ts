import { landscapeMargin } from "./landscapeRequest";
import type { Biome } from "./generated/Biome";
import type { SceneryAsset } from "./generated/SceneryAsset";
import type { Bounds } from "./model";

export const landscapeBiomes: Biome[] = ["forest", "scrub", "meadow", "rocks"];
export const landscapeColors = [
  [77, 112, 70],
  [124, 139, 83],
  [155, 172, 104],
  [146, 145, 133],
];
export type LandscapeWeights = readonly [number, number, number, number];
export type LandscapeSettings = {
  biome: Biome;
  radius: number;
  density: number;
  mode?: "paint" | "erase";
};
const random = (x: number, y: number, salt: number) => {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
export function landscapeDetails(
  scale: number,
): { spacing: number; alpha: number; near: boolean }[] {
  // Both representations coexist only in the transition band. No tree
  // candidates are generated for continental/world views.
  if (scale <= 0.03) return [];
  const nearAlpha = Math.max(0, Math.min(1, (scale - 0.35) / 0.15));
  const details = [];
  if (nearAlpha < 1)
    details.push({
      spacing: 512,
      alpha: Math.min(1, (scale - 0.03) / 0.03) * (1 - nearAlpha),
      near: false,
    });
  if (nearAlpha > 0)
    details.push({ spacing: 32, alpha: nearAlpha, near: true });
  return details;
}
/** Bounded, stateless projection. Candidate identity depends on world cells,
 * never on camera, tile boundaries, sampling order or density. */
export function landscapeSymbols(
  bounds: Bounds,
  scale: number,
  sample: (x: number, y: number) => LandscapeWeights,
): { biome: Biome; asset: SceneryAsset; near: boolean }[] {
  const details = landscapeDetails(scale);
  const margin = landscapeMargin(scale);
  const ranges = details.map((detail) => {
    const { spacing } = detail;
    return {
      ...detail,
      left: Math.floor((bounds[0] - margin) / spacing),
      right: Math.floor((bounds[2] + margin) / spacing),
      top: Math.floor((bounds[1] - margin) / spacing),
      bottom: Math.floor((bounds[3] + margin) / spacing),
    };
  });
  // The shared budget includes both representations during crossfade.
  if (
    ranges.reduce(
      (n, r) => n + (r.right - r.left + 1) * (r.bottom - r.top + 1),
      0,
    ) > 16384
  )
    return [];
  const result: ReturnType<typeof landscapeSymbols> = [];
  for (const { spacing, near, left, right, top, bottom } of ranges) {
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const px = (x + 0.15 + 0.7 * random(x, y, 19)) * spacing;
        const py = (y + 0.15 + 0.7 * random(x, y, 73)) * spacing;
        const weights = sample(px, py);
        const threshold = random(x, y, 101) * 255;
        let total = 0;
        for (let k = 0; k < 4; k++) {
          total += weights[k];
          if (threshold >= total) continue;
          // Medium forest is a continuous density field in the landscape raster.
          if (!near && k === 0) break;
          const size =
            (near ? (k === 0 ? 12 : k === 1 ? 7 : 5) : 130) *
            (0.8 + random(x, y, 43) * 0.4);
          const radius = size * 1.2;
          if (
            px + radius < bounds[0] ||
            py + radius < bounds[1] ||
            px - radius > bounds[2] ||
            py - radius > bounds[3]
          )
            break;
          result.push({
            biome: landscapeBiomes[k],
            near,
            asset: {
              point: [px, py],
              size,
              angle: random(x, y, 37) * Math.PI * 2,
              variant: Math.floor(random(x, y, 59) * 4),
            },
          });
          break;
        }
      }
  }
  return result;
}

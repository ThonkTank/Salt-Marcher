import type { Point } from '../shared/contracts';

/** Shared by the canvas raster, worker preview and export. Materials never write biomes. */
export interface TerrainStyle {
  version: 1;
  mode: 'drawn' | 'shaded' | 'height';
  land: string;
  ink: string;
  lightDegrees: number;
  strength: number;
  /** Absent on legacy profiles: preserve their original appearance. */
  mountains?: boolean;
  snowlineM?: number;
}
export const DEFAULT_TERRAIN_STYLE: Readonly<TerrainStyle> = Object.freeze({
  version: 1,
  mode: 'drawn',
  land: '#eee5cf',
  ink: '#685639',
  lightDegrees: 315,
  strength: 0.65,
  mountains: true,
  snowlineM: 2500,
});
export function validateTerrainStyle(s: TerrainStyle) {
  if (
    !s ||
    s.version !== 1 ||
    !['drawn', 'shaded', 'height'].includes(s.mode) ||
    !/^#[0-9a-f]{6}$/i.test(s.land) ||
    !/^#[0-9a-f]{6}$/i.test(s.ink) ||
    !Number.isFinite(s.lightDegrees) ||
    s.lightDegrees < 0 ||
    s.lightDegrees >= 360 ||
    !Number.isFinite(s.strength) ||
    s.strength < 0 ||
    s.strength > 1 ||
    (s.mountains !== undefined && typeof s.mountains !== 'boolean') ||
    (s.snowlineM !== undefined &&
      (!Number.isFinite(s.snowlineM) || Math.abs(s.snowlineM) > 1000000)) ||
    Object.keys(s).some(
      (k) =>
        ![
          'version',
          'mode',
          'land',
          'ink',
          'lightDegrees',
          'strength',
          'mountains',
          'snowlineM',
        ].includes(k),
    )
  )
    throw Error('Reliefstil prüfen.');
}
export const reliefRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function reliefLighting(style: TerrainStyle) {
  const angle = (style.lightDegrees * Math.PI) / 180,
    sin = Math.sin(angle),
    cos = Math.cos(angle),
    strength = style.strength * 0.55;
  return (sx: number, sy: number) =>
    1 + strength * ((-sx * sin + sy * cos + 1) / Math.hypot(sx, sy, 1) - 1);
}
export function reliefLight(sx: number, sy: number, style: TerrainStyle) {
  return reliefLighting(style)(sx, sy);
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (lo: number, hi: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
/** Pure material coverages shared by raster channels and the legacy colour path. */
export function rockCoverage(slope: number) {
  return 0.85 * smooth(0.35, 1.2, slope);
}
export function snowCoverage(heightM: number, slope: number, snowlineM: number) {
  return smooth(snowlineM, snowlineM + 300, heightM) * (1 - 0.8 * smooth(1, 2.5, slope));
}
/** Display-only material, before lighting/contours. Physical height and slope,
 * not camera tilt, exaggeration or the loaded height range, choose coverage.
 * Fixed world grain fades below its sampling limit; zoom never moves snow.
 * Mutate only the derived pixel buffer, with no per-pixel allocation. */
export function mountainMaterial(style: TerrainStyle, footprintM: number) {
  if (!style.mountains || style.mode === 'height') return undefined;
  const snowline = style.snowlineM ?? 2500,
    grainScale = 160;
  const grainWeight = 1 - smooth(grainScale / 8, grainScale / 2, footprintM);
  return (
    pixels: Uint8Array,
    at: number,
    x: number,
    y: number,
    height: number,
    sx: number,
    sy: number,
  ) => {
    const slope = Math.hypot(sx, sy),
      rock = rockCoverage(slope);
    const snow = snowCoverage(height, slope, snowline);
    if (!rock && !snow) return;
    let grain = 0;
    if (grainWeight) {
      const u = x / grainScale,
        v = y / grainScale,
        ix = Math.floor(u),
        iy = Math.floor(v),
        fx = smooth(0, 1, u - ix),
        fy = smooth(0, 1, v - iy);
      grain =
        (mix(
          mix(noise(ix, iy, 137), noise(ix + 1, iy, 137), fx),
          mix(noise(ix, iy + 1, 137), noise(ix + 1, iy + 1, 137), fx),
          fy,
        ) -
          0.5) *
        grainWeight;
    }
    for (let c = 0; c < 3; c++) {
      const stone = (c === 0 ? 144 : c === 1 ? 139 : 129) + grain * 18,
        ice = (c === 0 ? 246 : c === 1 ? 248 : 244) + grain * 4;
      pixels[at + c] = Math.round(mix(mix(pixels[at + c]!, stone, rock), ice, snow));
    }
  };
}
/** Explicit analysis mode, relative to sea level. No snow or terrain-type writes. */
export function elevationColor(heightM: number, seaLevelM: number) {
  const t = Math.min(1, Math.max(0, (heightM - seaLevelM) / 3000)),
    low = [189, 209, 148],
    mid = [206, 177, 111],
    high = [145, 105, 92];
  return low.map((v, i) =>
    t < 0.4 ? mix(v, mid[i]!, t / 0.4) : mix(mid[i]!, high[i]!, (t - 0.4) / 0.6),
  );
}
function noise(x: number, y: number, salt: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export interface ReliefMark {
  points: Point[];
  opacity: number;
  width: number;
}
/** Two world-anchored dyadic lattices crossfade; pan/tile origin never seeds marks. */
export function reliefMarks(
  box: { x: number; y: number; width: number; height: number },
  mpp: number,
  sample: (p: Point) => { heightM: number; sx: number; sy: number; water: boolean },
  strength: number,
): ReliefMark[] {
  if (!Number.isFinite(mpp) || mpp <= 0 || !strength) return [];
  const level = Math.log2(mpp * 11),
    base = Math.floor(level),
    blend = level - base,
    out: ReliefMark[] = [];
  for (const [exponent, opacity] of [
    [base, 1 - blend],
    [base + 1, blend],
  ]) {
    if (opacity! < 0.001) continue;
    const spacing = 2 ** exponent!,
      pad = spacing * 0.65;
    const x0 = Math.floor((box.x - pad) / spacing),
      x1 = Math.ceil((box.x + box.width + pad) / spacing),
      y0 = Math.floor((box.y - pad) / spacing),
      y1 = Math.ceil((box.y + box.height + pad) / spacing);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 100000) throw Error('Reliefausschnitt zu groß.');
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (noise(x, y, 31) < 0.18) continue;
        const p = {
          x: (x + 0.15 + 0.7 * noise(x, y, 13)) * spacing,
          y: (y + 0.15 + 0.7 * noise(x, y, 71)) * spacing,
        };
        const q = sample(p),
          slope = Math.hypot(q.sx, q.sy),
          density = Math.min(1, Math.max(0, (slope - 0.065) / 0.32));
        if (q.water || density === 0) continue;
        const length = spacing * (0.28 + 0.28 * noise(x, y, 19)) * Math.min(1, 0.5 + slope),
          dx = (-q.sx / slope) * length,
          dy = (-q.sy / slope) * length,
          bend = (noise(x, y, 47) - 0.5) * 0.22;
        const end = { x: p.x + dx, y: p.y + dy };
        if (sample(end).water) continue;
        out.push({
          points: [p, { x: p.x + dx * 0.5 - dy * bend, y: p.y + dy * 0.5 + dx * bend }, end],
          opacity: opacity! * strength * density * (0.22 + 0.2 * noise(x, y, 97)),
          width: mpp * 0.8,
        });
      }
  }
  return out;
}

/** Smooth, non-periodic world texture avoids the old sine-product checkerboard. */
export function terrainRoughness(x: number, y: number, seed: number) {
  const octave = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      tx = fx * fx * (3 - 2 * fx),
      ty = fy * fy * (3 - 2 * fy);
    return mix(
      mix(noise(ix, iy, seed), noise(ix + 1, iy, seed), tx),
      mix(noise(ix, iy + 1, seed), noise(ix + 1, iy + 1, seed), tx),
      ty,
    );
  };
  return octave(x * 3, y * 3) * 0.65 + octave(x * 7, y * 7) * 0.25 + octave(x * 15, y * 15) * 0.1;
}

import { type HeightStroke } from './terrain-brush-contracts';
import type { TerrainScreenGeometry } from './terrain-screen-geometry';
import { planTerrainScreenInput, validateTerrainScreenInput } from './terrain-screen-input';
import {
  terrainSupportTiles,
  terrainCentrelineTiles,
  terrainSupportBoxes,
  terrainBoxesBounds,
} from './terrain-stroke-support';
import { heightPatch } from './terrain-interpolation';
import { coupleRouteEdits } from './terrain-route-planner';
import {
  terrainGrid,
  terrainVisibility,
  terrainSourceBounds,
  validateTerrainView,
} from './terrain-spatial-model';
import { type TerrainGrid } from './terrain-grid-contracts';
import { terrainRoughness } from './terrain-relief';
import { prepareTerrainForm } from './terrain-form-brush';
import type { LandscapeRecord } from './landscape-contracts';
import { strokeBox, validateStroke } from './land-mask';

import { decodeHeights, encodeHeights, editHeight, TerrainSampler } from './terrain-height';
export function validateHeightStroke(s: HeightStroke) {
  if (
    !s ||
    !['raise', 'lower', 'roughen', 'smooth', 'level'].includes(s.mode) ||
    (s.preserveDetails !== undefined && typeof s.preserveDetails !== 'boolean') ||
    !Number.isFinite(s.strength) ||
    s.strength <= 0 ||
    s.strength > 100000 ||
    !Number.isFinite(s.feather) ||
    s.feather < 0 ||
    s.feather > 1 ||
    (s.targetM !== undefined && (!Number.isFinite(s.targetM) || Math.abs(s.targetM) > 1e6)) ||
    (s.mode === 'level' && s.targetM === undefined) ||
    (s.mode === 'roughen' && s.targetM !== undefined) ||
    (s.form !== undefined &&
      (!['hills', 'mountains', 'canyon'].includes(s.form) ||
        s.mode !== (s.form === 'canyon' ? 'lower' : 'raise') ||
        s.targetM !== undefined ||
        s.roughness !== undefined ||
        s.seed === undefined)) ||
    (s.roughness !== undefined &&
      (!Number.isFinite(s.roughness) || s.roughness < 0 || s.roughness > 2)) ||
    (s.seed !== undefined && (!Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff)) ||
    Object.keys(s).some(
      (k) =>
        ![
          'mode',
          'form',
          'preserveDetails',
          'radius',
          'strength',
          'feather',
          'targetM',
          'roughness',
          'seed',
          'samples',
          'visibility',
          'screenInput',
        ].includes(k),
    )
  )
    throw Error('Höhenpinsel prüfen.');
  if (s.visibility) validateTerrainView(s.visibility);
  if (s.screenInput !== undefined) validateTerrainScreenInput(s.screenInput, s.visibility);
  validateStroke({ ...s, mode: 'raise', roughness: 0, seed: 0 });
}
export function heightBrushBounds(s: HeightStroke) {
  validateHeightStroke(s);
  const b = strokeBox(s),
    pad = s.mode === 'smooth' ? s.radius / 2 : 0;
  const box = { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad };
  return s.visibility ? terrainSourceBounds(s.visibility, pad) : box;
}
/** Authored height bands retain the existing sub-metre editing range. */
export const heightBrushResolution = (radius: number) =>
  Math.max(2 ** -24, 2 ** Math.floor(Math.log2(radius / 32)));
export const heightBrushPixel = heightBrushResolution;
/** Filter only the legacy base; fine additive bands remain untouched by coarser tools. */
export function scaleHeightSampler(records: LandscapeRecord[], pixel: number) {
  const base = new TerrainSampler(
    records.filter((r) => r.height?.version !== 2),
    false,
  );
  const bands = new TerrainSampler(
    records.filter((r) => r.height?.version === 2 && r.height.pixel >= pixel),
    false,
  );
  // The legacy low pass lives on the same author lattice in both runtimes.
  // Round at the two Float32 boundaries used by the stored scale pyramid.
  const nodes = new Map<string, number>();
  const node = (x: number, y: number) => {
    const key = x + ':' + y;
    let height = nodes.get(key);
    if (height !== undefined) return height;
    height = 0;
    for (const dy of [-0.375, -0.125, 0.125, 0.375])
      for (const dx of [-0.375, -0.125, 0.125, 0.375])
        height +=
          Math.fround(base.sample({ x: (x + dx) * pixel, y: (y + dy) * pixel }).heightM) / 16;
    height = Math.fround(height);
    nodes.set(key, height);
    return height;
  };
  return (p: { x: number; y: number }) => {
    const x = p.x / pixel,
      y = p.y / pixel,
      gx = Math.floor(x),
      gy = Math.floor(y);
    const values = new Float64Array(16);
    for (let iy = 0; iy < 4; iy++)
      for (let ix = 0; ix < 4; ix++) values[iy * 4 + ix] = node(gx + ix - 1, gy + iy - 1);
    return heightPatch(values, x - gx, y - gy, -100) + bands.sample(p).heightM + 100;
  };
}
export function heightBrushDabs(s: Pick<HeightStroke, 'samples' | 'radius'>) {
  // Midpoint integration along the whole gesture, independent of event frequency.
  const dabs: { x: number; y: number; seconds: number }[] = [];
  for (let i = 1; i < s.samples.length; i++) {
    const a = s.samples[i - 1]!,
      b = s.samples[i]!,
      dt = (b.t - a.t) / 1000;
    const n = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (s.radius / 8)),
      Math.ceil(dt * 30),
    );
    if (n + dabs.length > 20000) throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t,
        last = dabs.at(-1);
      // Holding the brush still adds duration, not thousands of identical evaluations.
      if (last && last.x === x && last.y === y) last.seconds += dt / n;
      else dabs.push({ x, y, seconds: dt / n });
    }
  }
  return dabs;
}

/** Prepared once per complete gesture; shared by live forms and canonical edits. */
export function prepareHeightBrush(
  s: HeightStroke,
  visibility?: TerrainGrid,
  geometry?: TerrainScreenGeometry,
) {
  if (s.screenInput && !visibility) throw Error('Gebundene Geländeoberfläche fehlt. Erneut laden.');
  const screen = s.screenInput
      ? planTerrainScreenInput(
          s.screenInput,
          s.radius,
          visibility!,
          s.form ? 'exposure' : 'radial',
          geometry,
        )
      : undefined,
    dabs = screen?.dabs ?? heightBrushDabs(s),
    centrelines = screen?.centrelines ?? [s.samples],
    pixel = heightBrushPixel(s.radius),
    tiles = s.form
      ? terrainCentrelineTiles(centrelines, s.radius + s.radius / 12, pixel)
      : terrainSupportTiles(dabs, s.radius, pixel);
  let geometryTiles: ReturnType<typeof terrainCentrelineTiles> | undefined;
  const footprintTiles = () =>
    (geometryTiles ??= terrainCentrelineTiles(centrelines, s.radius, pixel));
  if (s.form)
    return {
      dabs,
      dose: prepareTerrainForm(s, dabs, centrelines),
      tilePairs: undefined,
      tiles,
      centrelines,
      sections: screen?.sections ?? [],
      footprintTiles,
    };
  // Keep each tile's dabs in original order. A silhouette can put adjacent
  // screen samples far apart in world space; most bounding-box tiles then
  // cannot receive most dabs. Index only intersecting circular supports.
  const edge = 64 * heightBrushPixel(s.radius),
    cells = new Map<string, typeof dabs>();
  let tilePairs = 0;
  for (const d of dabs)
    for (let y = Math.floor((d.y - s.radius) / edge); y <= Math.floor((d.y + s.radius) / edge); y++)
      for (
        let x = Math.floor((d.x - s.radius) / edge);
        x <= Math.floor((d.x + s.radius) / edge);
        x++
      ) {
        const dx = Math.max(x * edge - d.x, 0, d.x - (x + 1) * edge),
          dy = Math.max(y * edge - d.y, 0, d.y - (y + 1) * edge);
        if (Math.hypot(dx, dy) >= s.radius) continue;
        const key = x + ':' + y;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = []));
        cell.push(d);
        tilePairs++;
      }
  let lastX = NaN,
    lastY = NaN,
    nearby: typeof dabs = [];
  const dose = (p: { x: number; y: number }) => {
    const x = Math.floor(p.x / edge),
      y = Math.floor(p.y / edge);
    if (x !== lastX || y !== lastY) {
      nearby = cells.get(x + ':' + y) ?? [];
      lastX = x;
      lastY = y;
    }
    let total = 0;
    for (const d of nearby) {
      const r = Math.hypot(p.x - d.x, p.y - d.y) / s.radius;
      if (r >= 1) continue;
      const t = s.feather === 0 ? 1 : Math.min(1, (1 - r) / s.feather);
      total += d.seconds * t * t * (3 - 2 * t);
    }
    return total;
  };
  return {
    dabs,
    dose,
    tilePairs,
    tiles,
    centrelines,
    sections: screen?.sections ?? [],
    footprintTiles,
  };
}

/** Shared numeric effect; the caller owns the source snapshot and visibility. */
export function heightBrushAmount(
  s: HeightStroke,
  p: { x: number; y: number },
  dose: number,
  source?: (p: { x: number; y: number }) => number,
) {
  const old = source?.(p) ?? 0;
  let amount = s.strength * dose;
  // Signed, world-anchored noise adds peaks and hollows without changing
  // the existing directional modulation. Preview and commit use the same seed.
  if (s.mode === 'roughen')
    return amount * (2 * terrainRoughness(p.x / s.radius, p.y / s.radius, s.seed ?? 0) - 1);
  if (s.mode === 'raise' || s.mode === 'lower') {
    // World-anchored modulation stays fixed throughout preview, retry and commit.
    // Its positive factor preserves direction even at maximum roughness.
    const seed = s.seed ?? 0;
    if (s.roughness)
      amount *= 1 - s.roughness * 0.15 * terrainRoughness(p.x / s.radius, p.y / s.radius, seed);
    if (s.mode === 'raise')
      return s.targetM === undefined ? amount : Math.max(0, Math.min(s.targetM - old, amount));
    return -(s.targetM === undefined ? amount : Math.max(0, Math.min(old - s.targetM, amount)));
  }
  let target = s.targetM ?? 0;
  if (s.mode === 'smooth') {
    // A fixed source snapshot makes smoothing independent of tile traversal.
    // Symmetric samples preserve planes and never overshoot local extrema.
    target = 0;
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++)
        target += source!({ x: p.x + (x * s.radius) / 4, y: p.y + (y * s.radius) / 4 }) / 9;
  }
  return Math.sign(target - old) * Math.min(Math.abs(target - old), amount);
}

export function applyTerrainBrush(
  records: LandscapeRecord[],
  s: HeightStroke,
  limited?: (factor: number) => void,
  canonicalVisibility?: TerrainGrid,
  scaleHeight?: (p: { x: number; y: number }) => number,
  uncoupled = false,
  prepared?: ReturnType<typeof prepareHeightBrush>,
): LandscapeRecord[] {
  validateHeightStroke(s);
  if (s.screenInput && !canonicalVisibility)
    throw Error('Gebundene Geländeoberfläche fehlt. Erneut laden.');
  const pixel = heightBrushPixel(s.radius),
    visibility = s.visibility
      ? (canonicalVisibility ?? terrainGrid(records, s.visibility))
      : undefined,
    { dabs, dose, tilePairs, tiles } = prepared ?? prepareHeightBrush(s, visibility),
    box = s.screenInput ? terrainBoxesBounds(terrainSupportBoxes(tiles, pixel)) : strokeBox(s);
  if ((tilePairs ?? dabs.length * tiles.length) * 4096 > 60000000)
    throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
  const needsSource = s.mode === 'smooth' || s.targetM !== undefined,
    source = needsSource ? (scaleHeight ?? scaleHeightSampler(records, pixel)) : undefined;
  const visible = visibility
    ? terrainVisibility(visibility, s.screenInput ? 'clip' : 'reject')
    : undefined;
  const edited = editHeight(
    records,
    box,
    pixel,
    (p, prior) => {
      const exposure = dose(p);
      if (!exposure || (visible && !visible(p))) return undefined;
      return prior + heightBrushAmount(s, p, exposure, source);
    },
    2,
    tiles,
  );
  // Fine bands are relaxed at their own author nodes, never removed as whole
  // tiles. The complete gesture dose is evaluated against its fixed source.
  if (s.preserveDetails === false) {
    const coarseBase = scaleHeightSampler(
      records.filter((r) => r.height?.version !== 2),
      pixel,
    );
    for (const r of records) {
      const t = r.height;
      if (!t || t.pixel >= pixel) continue;
      if (
        t.x > box.x + box.width ||
        t.y > box.y + box.height ||
        t.x + 63 * t.pixel < box.x ||
        t.y + 63 * t.pixel < box.y
      )
        continue;
      const values = decodeHeights(t).slice();
      let changed = false;
      for (let iy = 0; iy < 64; iy++)
        for (let ix = 0; ix < 64; ix++) {
          const i = iy * 64 + ix,
            prior = values[i]!;
          if (!Number.isFinite(prior) || (t.version === 2 && prior === 0)) continue;
          const p = { x: t.x + ix * t.pixel, y: t.y + iy * t.pixel };
          const exposure = dose(p);
          if (!exposure || (visible && !visible(p))) continue;
          const target = t.version === 2 ? 0 : coarseBase(p);
          const retained = Math.exp((-s.strength * exposure) / s.radius);
          values[i] = target + (prior - target) * retained;
          changed ||= values[i] !== prior;
        }
      if (changed) edited.push({ ...r, height: { ...t, data: encodeHeights(values) } });
    }
  }
  return uncoupled ? edited : coupleRouteEdits(records, edited, limited);
}

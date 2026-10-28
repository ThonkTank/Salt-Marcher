import { type LandMode, type LandMask, type MaskStroke } from './land-mask-contracts';
import type { Point } from '../shared/contracts';
import { type LandscapeBox } from './landscape-bounds';
import { type LandscapeRecord } from './landscape-contracts';
import { bounds } from './landscape-geometry';

export const MASK_EDGE = 256,
  MASK_MAX = 65535,
  MASK_SEA_LEVEL = 32768;
export const isLandMode = (mode: string): mode is LandMode =>
  ['land', 'land-erase', 'raise', 'lower'].includes(mode);
const decoded = new WeakMap<LandMask, Uint16Array>();
export function decodeMask(mask: LandMask): Uint16Array {
  const hit = decoded.get(mask);
  if (hit) return hit;
  if (
    mask.version !== 1 ||
    ![mask.x, mask.y, mask.pixel].every(Number.isFinite) ||
    mask.pixel <= 0 ||
    !Number.isInteger(Math.log2(mask.pixel)) ||
    !Number.isSafeInteger(mask.x / (MASK_EDGE * mask.pixel)) ||
    !Number.isSafeInteger(mask.y / (MASK_EDGE * mask.pixel)) ||
    typeof mask.data !== 'string' ||
    mask.data.length > 350000
  )
    throw Error('Landmaske prüfen.');
  const raw = atob(mask.data);
  if (raw.length % 4) throw Error('Landmaske prüfen.');
  const values = new Uint16Array(MASK_EDGE * MASK_EDGE);
  let at = 0;
  for (let i = 0; i < raw.length; i += 4) {
    const count = raw.charCodeAt(i) | (raw.charCodeAt(i + 1) << 8),
      value = raw.charCodeAt(i + 2) | (raw.charCodeAt(i + 3) << 8);
    if (!count || at + count > values.length) throw Error('Landmaske prüfen.');
    values.fill(value, at, at + count);
    at += count;
  }
  if (at !== values.length) throw Error('Landmaske prüfen.');
  decoded.set(mask, values);
  return values;
}
export function encodeMask(values: Uint16Array): string {
  let raw = '';
  for (let i = 0; i < values.length; ) {
    const value = values[i]!,
      start = i;
    while (i < values.length && values[i] === value && i - start < 65535) i++;
    const n = i - start;
    raw += String.fromCharCode(n & 255, n >> 8, value & 255, value >> 8);
  }
  return btoa(raw);
}
export function maskAt(mask: LandMask, p: Point): number | undefined {
  const x = Math.floor((p.x - mask.x) / mask.pixel),
    y = Math.floor((p.y - mask.y) / mask.pixel);
  return x < 0 || y < 0 || x >= MASK_EDGE || y >= MASK_EDGE
    ? undefined
    : decodeMask(mask)[y * MASK_EDGE + x];
}
export function validateMask(record: LandscapeRecord) {
  if (record.mask) {
    decodeMask(record.mask);
    const b = bounds(record),
      m = record.mask;
    if (
      record.kind !== 'patch' ||
      record.resolution !== m.pixel ||
      b.x !== m.x ||
      b.y !== m.y ||
      b.width !== MASK_EDGE * m.pixel ||
      b.height !== MASK_EDGE * m.pixel
    )
      throw Error('Landmaskenbereich prüfen.');
  }
}
export function validateStroke(s: MaskStroke) {
  if (
    !isLandMode(s.mode) ||
    !Number.isFinite(s.radius) ||
    s.radius <= 0 ||
    !Number.isFinite(s.roughness) ||
    s.roughness < 0 ||
    s.roughness > 2 ||
    !Number.isSafeInteger(s.seed) ||
    s.seed < 0 ||
    s.seed > 0xffffffff ||
    !Array.isArray(s.samples) ||
    !s.samples.length ||
    s.samples.length > 20000
  )
    throw Error('Landpinsel prüfen.');
  if (s.samples[0]!.t !== 0) throw Error('Pinselzeit prüfen.');
  let last = -1;
  for (const p of s.samples) {
    if (![p.x, p.y, p.t].every(Number.isFinite) || p.t < last || p.t < 0 || p.t > 300000)
      throw Error('Pinselzeit prüfen.');
    last = p.t;
  }
}
export function strokeBox(s: Pick<MaskStroke, 'radius' | 'samples'>): LandscapeBox {
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of s.samples) {
    x = Math.min(x, p.x - s.radius);
    y = Math.min(y, p.y - s.radius);
    right = Math.max(right, p.x + s.radius);
    bottom = Math.max(bottom, p.y + s.radius);
  }
  if (
    ![x, y, right, bottom, right - x, bottom - y].every(Number.isFinite) ||
    right <= x ||
    bottom <= y
  )
    throw Error('Pinselbereich nicht präzise darstellbar.');
  return { x, y, width: right - x, height: bottom - y };
}
function noise(x: number, y: number, seed: number) {
  const hash = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  return (
    (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
  );
}
function fractal(p: Point, s: MaskStroke) {
  let n = 0,
    weight = 0;
  for (let i = 0; i < 4; i++) {
    const w = 2 ** -i,
      f = (2 ** i * 6) / s.radius;
    n += noise(p.x * f, p.y * f, s.seed + i * 1013) * w;
    weight += w;
  }
  return 1 - (s.roughness / 2) * 0.85 + ((s.roughness / 2) * 0.85 * n) / weight;
}
/** Fixed wall-time quadrature; event frequency does not control brush strength. */
function dabs(s: MaskStroke) {
  const out: { x: number; y: number; dt: number }[] = [],
    ps = s.samples,
    end = ps.at(-1)!.t;
  let at = 0;
  for (let t = 0; t < end; t += 1000 / 60) {
    const dt = Math.min(1000 / 60, end - t),
      mid = t + dt / 2;
    while (at < ps.length - 2 && ps[at + 1]!.t < mid) at++;
    const a = ps[at]!,
      b = ps[Math.min(at + 1, ps.length - 1)]!,
      f = Math.max(0, Math.min(1, (mid - a.t) / (b.t - a.t || 1)));
    const x = a.x + (b.x - a.x) * f,
      y = a.y + (b.y - a.y) * f,
      last = out.at(-1);
    if (last && last.x === x && last.y === y) last.dt += dt / 1000;
    else out.push({ x, y, dt: dt / 1000 });
  }
  return out;
}
const overlaps = (a: LandscapeBox, b: LandscapeBox) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function tileRecord(x: number, y: number, pixel: number): LandscapeRecord {
  const edge = MASK_EDGE * pixel;
  return {
    id: `land-mask:${Math.log2(pixel)}:${x / edge}:${y / edge}`,
    revision: 0,
    kind: 'patch',
    name: 'Land-/Wassermaske',
    points: [],
    polygons: [
      {
        outer: [
          { x, y },
          { x: x + edge, y },
          { x: x + edge, y: y + edge },
          { x, y: y + edge },
        ],
        holes: [],
      },
    ],
    resolution: pixel,
    width: 0,
    values: {},
    mask: { version: 1, x, y, pixel, data: '' },
  };
}
/** Existing finer tiles stay authoritative and receive each coarse edit as well. */
function editTiles(
  records: LandscapeRecord[],
  box: LandscapeBox,
  pixel: number,
  edit: (values: Uint16Array, tile: LandMask) => void,
  areas: LandscapeBox[] = [box],
): LandscapeRecord[] {
  const masks = records.filter((r) => r.mask),
    tiles = new Map<string, LandscapeRecord>(),
    edge = pixel * MASK_EDGE;
  for (const area of areas) {
    const nx = Math.ceil((area.x + area.width) / edge) - Math.floor(area.x / edge),
      ny = Math.ceil((area.y + area.height) / edge) - Math.floor(area.y / edge);
    if (nx * ny > 256) throw Error('Pinselzug zu groß. In kürzeren Zügen bearbeiten.');
    for (let y = Math.floor(area.y / edge); y < Math.ceil((area.y + area.height) / edge); y++)
      for (let x = Math.floor(area.x / edge); x < Math.ceil((area.x + area.width) / edge); x++) {
        const r =
          masks.find(
            (a) => a.mask!.x === x * edge && a.mask!.y === y * edge && a.mask!.pixel === pixel,
          ) ?? tileRecord(x * edge, y * edge, pixel);
        tiles.set(r.id, r);
        if (tiles.size > 256) throw Error('Pinselzug zu groß. In kürzeren Zügen bearbeiten.');
      }
  }
  for (const r of masks)
    if (
      r.mask!.pixel <= pixel &&
      overlaps(bounds(r), box) &&
      areas.some((a) => overlaps(bounds(r), a))
    )
      tiles.set(r.id, r);
  if (tiles.size > 256) throw Error('Pinselzug zu groß. In kürzeren Zügen bearbeiten.');
  const result: LandscapeRecord[] = [];
  for (const r of tiles.values()) {
    const m = r.mask!,
      old = masks.find((a) => a.id === r.id),
      values = old ? decodeMask(old.mask!).slice() : new Uint16Array(MASK_EDGE * MASK_EDGE);
    if (!old) {
      const parents = masks
        .filter((a) => a.mask!.pixel > pixel && overlaps(bounds(a), bounds(r)))
        .sort((a, b) => b.resolution - a.resolution);
      for (const p of parents)
        for (let i = 0; i < values.length; i++) {
          const v = maskAt(p.mask!, {
            x: m.x + ((i % MASK_EDGE) + 0.5) * pixel,
            y: m.y + (Math.floor(i / MASK_EDGE) + 0.5) * pixel,
          });
          if (v !== undefined) values[i] = v;
        }
    }
    const before = old ? null : values.slice();
    edit(values, m);
    if (before && values.every((v, i) => v === before[i])) continue;
    const data = encodeMask(values);
    if (old?.mask!.data === data) continue;
    result.push({ ...r, revision: old?.revision ?? 0, mask: { ...m, data } });
  }
  return result;
}
export function applyMaskStroke(records: LandscapeRecord[], s: MaskStroke): LandscapeRecord[] {
  validateStroke(s);
  const pixel = 2 ** Math.floor(Math.log2(s.radius / 64)),
    box = strokeBox(s),
    timed = s.mode === 'raise' || s.mode === 'lower',
    dots = timed ? dabs(s) : [];
  const areas: LandscapeBox[] = [];
  for (let i = 0; i < s.samples.length; i++) {
    const a = s.samples[Math.max(0, i - 1)]!,
      b = s.samples[i]!,
      steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (pixel * 128)));
    if (steps > 2048) throw Error('Pinselzug zu groß. In kürzeren Zügen bearbeiten.');
    for (let j = 0; j <= steps; j++) {
      const x = a.x + ((b.x - a.x) * j) / steps,
        y = a.y + ((b.y - a.y) * j) / steps;
      areas.push({
        x: x - s.radius,
        y: y - s.radius,
        width: s.radius * 2,
        height: s.radius * 2,
      });
    }
  }
  return editTiles(
    records,
    box,
    pixel,
    (values, m) => {
      const accum = timed ? Float64Array.from(values) : null,
        edge = m.pixel * MASK_EDGE;
      const visit = (b: LandscapeBox, fn: (i: number, p: Point) => void) => {
        if (!overlaps(b, { x: m.x, y: m.y, width: edge, height: edge })) return;
        const x0 = Math.max(0, Math.floor((b.x - m.x) / m.pixel)),
          x1 = Math.min(MASK_EDGE - 1, Math.floor((b.x + b.width - m.x) / m.pixel)),
          y0 = Math.max(0, Math.floor((b.y - m.y) / m.pixel)),
          y1 = Math.min(MASK_EDGE - 1, Math.floor((b.y + b.height - m.y) / m.pixel));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++)
            fn(y * MASK_EDGE + x, {
              x: m.x + (x + 0.5) * m.pixel,
              y: m.y + (y + 0.5) * m.pixel,
            });
      };
      if (timed) {
        const texture = new Float32Array(values.length);
        for (const d of dots)
          visit(
            {
              x: d.x - s.radius,
              y: d.y - s.radius,
              width: 2 * s.radius,
              height: 2 * s.radius,
            },
            (i, p) => {
              const r2 = ((p.x - d.x) ** 2 + (p.y - d.y) ** 2) / s.radius ** 2;
              if (r2 >= 1) return;
              const n = texture[i] || (texture[i] = fractal(p, s));
              accum![i] = Math.max(
                0,
                Math.min(
                  MASK_MAX,
                  accum![i]! + (s.mode === 'raise' ? 1 : -1) * MASK_MAX * d.dt * (1 - r2) ** 2 * n,
                ),
              );
            },
          );
        for (let i = 0; i < values.length; i++) values[i] = Math.round(accum![i]!);
      } else
        for (let j = 0; j < s.samples.length; j++) {
          const a = s.samples[Math.max(0, j - 1)]!,
            b = s.samples[j]!,
            dx = b.x - a.x,
            dy = b.y - a.y,
            l = dx * dx + dy * dy;
          visit(
            {
              x: Math.min(a.x, b.x) - s.radius,
              y: Math.min(a.y, b.y) - s.radius,
              width: Math.abs(dx) + 2 * s.radius,
              height: Math.abs(dy) + 2 * s.radius,
            },
            (i, p) => {
              const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (l || 1)));
              if ((p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2 <= s.radius ** 2)
                values[i] = s.mode === 'land' ? MASK_MAX : 0;
            },
          );
        }
    },
    areas,
  );
}
/** Terrain/hex authorship and one-time legacy conversion use the same occupancy. */
export function applyMaskArea(
  records: LandscapeRecord[],
  r: LandscapeRecord,
  water = r.values.terrain === 'water',
) {
  const b = bounds(r),
    pixel = 2 ** Math.floor(Math.log2(Math.max(b.width, b.height, 1) / 128));
  return editTiles(records, b, pixel, (values, m) => {
    // Scanline spans keep large imported contours linear in rows × vertices.
    for (const polygon of r.polygons) {
      const rings = [polygon.outer, ...polygon.holes].map((ring) =>
        ring.map((p) => ({
          x: (p.x - m.x) / m.pixel,
          y: (p.y - m.y) / m.pixel,
        })),
      );
      let minY = MASK_EDGE,
        maxY = -1;
      for (const ring of rings)
        for (const p of ring) {
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      for (
        let y = Math.max(0, Math.ceil(minY - 0.5));
        y <= Math.min(MASK_EDGE - 1, Math.floor(maxY - 0.5));
        y++
      ) {
        const crossings: number[] = [],
          scan = y + 0.5;
        for (const ring of rings)
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const a = ring[j]!,
              b = ring[i]!;
            if (a.y > scan !== b.y > scan)
              crossings.push(a.x + ((scan - a.y) * (b.x - a.x)) / (b.y - a.y));
          }
        crossings.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const from = Math.max(0, Math.ceil(crossings[i]! - 0.5)),
            to = Math.min(MASK_EDGE - 1, Math.floor(crossings[i + 1]! - 0.5));
          if (to >= from)
            values.fill(water ? 0 : MASK_MAX, y * MASK_EDGE + from, y * MASK_EDGE + to + 1);
        }
      }
    }
  });
}

/** Derived horizontal spans for existing polygon-only fill operations; never persisted as land geometry. */
export function maskLandSpans(mask: LandMask): import('../shared/contracts').Polygon[] {
  const values = decodeMask(mask),
    rects: { x: number; y: number; width: number; height: number }[] = [];
  let prior = new Map<string, number>();
  for (let y = 0; y < MASK_EDGE; y++) {
    const next = new Map<string, number>();
    for (let x = 0; x < MASK_EDGE; ) {
      if (values[y * MASK_EDGE + x]! < MASK_SEA_LEVEL) {
        x++;
        continue;
      }
      const start = x;
      while (x < MASK_EDGE && values[y * MASK_EDGE + x]! >= MASK_SEA_LEVEL) x++;
      const key = `${start}:${x}`,
        old = prior.get(key);
      if (old !== undefined) {
        rects[old]!.height++;
        next.set(key, old);
      } else {
        next.set(key, rects.length);
        rects.push({ x: start, y, width: x - start, height: 1 });
      }
    }
    prior = next;
  }
  return rects.map((r) => {
    const x = mask.x + r.x * mask.pixel,
      y = mask.y + r.y * mask.pixel,
      w = r.width * mask.pixel,
      h = r.height * mask.pixel;
    return {
      outer: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      holes: [],
    };
  });
}

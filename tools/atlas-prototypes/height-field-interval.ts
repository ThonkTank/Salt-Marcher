import { decodeHeights } from "../../src/app/terrain-height";
import type { LandscapeBox, LandscapeRecord } from "../../src/app/atlas-landscape";
import type { Point } from "../../src/app/contracts";

export interface HeightFieldIntervals {
  range(box: LandscapeBox): [number, number];
  integrationCut(triangle: readonly Point[]): { axis: "x" | "y"; value: number } | undefined;
}

interface Interval { lo: number; hi: number }
interface Tile { gx: number; gy: number; values: Float32Array }
interface Level { pixel: number; additive: boolean; tiles: Map<string, Tile> }
const CAP = 64;
const bits = new DataView(new ArrayBuffer(8));
function nextUp(value: number): number {
  if (Number.isNaN(value) || value === Infinity) return value;
  if (value === 0) return Number.MIN_VALUE;
  bits.setFloat64(0, value, false);
  let n = bits.getBigUint64(0, false);
  bits.setBigUint64(0, value > 0 ? n + 1n : n - 1n, false);
  return bits.getFloat64(0, false);
}
function nextDown(value: number): number {
  if (Number.isNaN(value) || value === -Infinity) return value;
  if (value === 0) return -Number.MIN_VALUE;
  bits.setFloat64(0, value, false);
  let n = bits.getBigUint64(0, false);
  bits.setBigUint64(0, value > 0 ? n - 1n : n + 1n, false);
  return bits.getFloat64(0, false);
}
const point = (n: number): Interval => ({ lo: n, hi: n });
function rounded(value: number): Interval { return Number.isNaN(value) ? { lo: -Infinity, hi: Infinity } : point(value); }
const add = (a: Interval, b: Interval): Interval => a.lo === a.hi && b.lo === b.hi ? rounded(a.lo + b.lo) : ({ lo: nextDown(a.lo + b.lo), hi: nextUp(a.hi + b.hi) });
const sub = (a: Interval, b: Interval): Interval => a.lo === a.hi && b.lo === b.hi ? rounded(a.lo - b.lo) : ({ lo: nextDown(a.lo - b.hi), hi: nextUp(a.hi - b.lo) });
function mul(a: Interval, b: Interval): Interval {
  if (a.lo === a.hi && b.lo === b.hi) return rounded(a.lo * b.lo);
  const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  if (products.some(Number.isNaN)) return { lo: -Infinity, hi: Infinity };
  return { lo: nextDown(Math.min(...products)), hi: nextUp(Math.max(...products)) };
}
function div(a: Interval, b: Interval): Interval {
  if (b.lo <= 0 && b.hi >= 0) return { lo: -Infinity, hi: Infinity };
  if (a.lo === a.hi && b.lo === b.hi) return rounded(a.lo / b.lo);
  const quotients = [a.lo / b.lo, a.lo / b.hi, a.hi / b.lo, a.hi / b.hi];
  if (quotients.some(Number.isNaN)) return { lo: -Infinity, hi: Infinity };
  return { lo: nextDown(Math.min(...quotients)), hi: nextUp(Math.max(...quotients)) };
}
const scale = (a: Interval, n: number): Interval => mul(a, point(n));
function tangent(a: Interval, b: Interval): Interval {
  const product = mul(a, b);
  if ((a.lo > 0 && b.lo > 0 || a.hi < 0 && b.hi < 0) && (product.lo > 0 || product.hi < 0))
    return div(mul(scale(a, 2), b), add(a, b));
  const pos = Math.min(Math.max(0, a.hi), Math.max(0, b.hi));
  const neg = Math.min(Math.max(0, -a.lo), Math.max(0, -b.lo));
  // Ambiguous signs also include subnormal products. If fl(a*b)>0 then
  // a*b>MIN_VALUE/2, so the rounded 2*a*b numerator is <=3*a*b.
  // Four times the smaller slope (plus a subnormal rounding unit) safely
  // encloses the rounded quotient; the real-only 2*min bound is insufficient.
  return { lo: nextDown(-4 * neg-Number.MIN_VALUE), hi: nextUp(4 * pos+Number.MIN_VALUE) };
}
function hermite(a: Interval, b: Interval, c: Interval, d: Interval, t: Interval): Interval {
  // Preserve the canonical constant and endpoint branches exactly.
  if (b === c || b.lo === b.hi && b.lo === c.lo && c.lo === c.hi) return b;
  if (t.lo === 0 && t.hi === 0) return b;
  if (t.lo === 1 && t.hi === 1) return c;
  const delta = sub(c, b), m0 = tangent(sub(b, a), delta), m1 = tangent(delta, sub(d, c));
  const outer = sub(sub(scale(delta, 3), scale(m0, 2)), m1);
  const inner = sub(add(m0, m1), scale(delta, 2));
  const evaluated=add(b, mul(t, add(m0, mul(t, add(outer, mul(t, inner))))));
  // Real harmonic Hermite is b*(1-w)+c*w with t*t<=w<=2*t-t*t:
  // both tangent/delta ratios lie in [0,2]. Unlike the entire endpoint hull,
  // these positive weights retain distance from a zero-height endpoint.
  // Rounded evaluation can stray, so pad this independent real-arithmetic hull.
  // The bound propagates slope/tangent/coefficient/Horner error separately;
  // the derivation is in docs/reference/atlas-material-field-area-20261024/roundoff.md.
  // A subnormal slope product can have large relative error: its smaller slope
  // is <=sqrt(MIN_NORMAL), so charge that absolute scale too (not just MIN_VALUE).
  const magnitude=Math.max(...[a,b,c,d].flatMap(v=>[Math.abs(v.lo),Math.abs(v.hi)]));
  if(t.lo<0||t.hi>1||!Number.isFinite(magnitude)||magnitude>2**500)return evaluated;
  const error=nextUp(16384*2**-53*magnitude+16384*Math.sqrt(2**-1022));
  // Widen the scalar weight calculation too: singleton interval operations
  // intentionally describe rounded canonical operations, whereas w is real.
  const weights=[Math.max(0,nextDown(t.lo*t.lo)),Math.min(1,nextUp(2*t.hi-nextDown(t.hi*t.hi)))];
  const blend=(left:number,right:number,w:number)=>add(mul(point(left),{lo:nextDown(1-w),hi:nextUp(1-w)}),mul(point(right),{lo:nextDown(w),hi:nextUp(w)}));
  const low=weights.map(w=>blend(b.lo,c.lo,w).lo),high=weights.map(w=>blend(b.hi,c.hi,w).hi);
  const envelope={lo:nextDown(Math.min(...low)-error),hi:nextUp(Math.max(...high)+error)};
  if(Number.isNaN(evaluated.lo)||Number.isNaN(evaluated.hi))return envelope;
  const lo=Math.max(evaluated.lo,envelope.lo),hi=Math.min(evaluated.hi,envelope.hi);
  return lo<=hi?{lo,hi}:evaluated;
}

function validateBox(box: LandscapeBox): void {
  if (![box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)
    throw Error("Höhenbereich prüfen.");
}
function key(x: number, y: number): string { return `${x},${y}`; }

/** Encloses TerrainSampler's canonical x-then-y Hermite evaluation. */
export function createHeightFieldIntervals(records: readonly LandscapeRecord[]): HeightFieldIntervals {
  const grouped = new Map<string, Level>();
  for (const record of records) if (record.height) {
    const tile = record.height, id = `${tile.version}:${tile.pixel}`;
    let level = grouped.get(id);
    if (!level) grouped.set(id, level = { pixel: tile.pixel, additive: tile.version === 2, tiles: new Map() });
    const gx = tile.x / tile.pixel, gy = tile.y / tile.pixel, tk = key(gx / 64, gy / 64);
    if (level.tiles.has(tk)) throw Error("Doppelte Höhenkachel.");
    const values = decodeHeights(tile);
    level.tiles.set(tk, { gx, gy, values });
  }
  const levels = [...grouped.values()].sort((a, b) => Number(a.additive) - Number(b.additive) || b.pixel - a.pixel);
  const node = (level: Level, x: number, y: number): number => {
    const tx = Math.floor(x / 64) * 64, ty = Math.floor(y / 64) * 64;
    const tile = level.tiles.get(key(tx / 64, ty / 64));
    return tile?.values[(y - tile.gy) * 64 + x - tile.gx] ?? NaN;
  };
  function cellRange(level: Level, gx: number, gy: number, fx: Interval, fy: Interval, fill: Interval): Interval {
    const rows: Interval[] = [], stencils: number[][] = [];
    for (let y = 0; y < 4; y++) {
      const a = node(level, gx - 1, gy + y - 1), b = node(level, gx, gy + y - 1), c = node(level, gx + 1, gy + y - 1), d = node(level, gx + 2, gy + y - 1);
      const stencil = [a,b,c,d];
      // Equal source stencils use the SAME fx and inherited fill expression.
      // Reuse that expression, not just equal numeric interval endpoints: the
      // canonical y pass then takes its b===c branch for every point in the box.
      const previous = stencils.findIndex(s=>s.every((v,i)=>Object.is(v,stencil[i])));
      rows.push(previous>=0?rows[previous]!:hermite(Number.isNaN(a) ? fill : point(a), Number.isNaN(b) ? fill : point(b), Number.isNaN(c) ? fill : point(c), Number.isNaN(d) ? fill : point(d), fx));
      stencils.push(stencil);
    }
    // heightPatch's constant sea/corner shortcut is retained when provable.
    const center = [node(level, gx, gy), node(level, gx + 1, gy), node(level, gx, gy + 1), node(level, gx + 1, gy + 1)].map(v => Number.isNaN(v) ? fill : point(v));
    if (center.every(v => v.lo === center[0]!.lo && v.hi === center[0]!.hi)) return center[0]!;
    return hermite(rows[0]!, rows[1]!, rows[2]!, rows[3]!, fy);
  }
  function boundaries(start: number, end: number): number[] {
    const out = [start];
    for (const level of levels) {
      const first = Math.floor(start / level.pixel) + 1;
      const last = Math.ceil(end / level.pixel) - 1;
      // Beyond exact integer coordinates, n++ may no longer advance at all.
      // Leave the range unknown instead of hanging or skipping source cells.
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return [];
      if (last - first + 1 > CAP) return [];
      for (let n = first; n <= last; n++) out.push(n * level.pixel);
    }
    out.push(end);
    return [...new Set(out)].sort((a, b) => a - b);
  }
  function range(box: LandscapeBox): [number, number] {
    validateBox(box);
    if (!levels.length) return [-100, -100];
    const xs = boundaries(box.x, box.x + box.width), ys = boundaries(box.y, box.y + box.height);
    if (!xs.length || !ys.length) return [-Infinity, Infinity];
    // Bound the Cartesian work as well as each axis. The fallback is deliberately
    // unbounded: it remains sound even for extreme coordinates or numeric overflow.
    if (Math.max(1, xs.length - 1) * Math.max(1, ys.length - 1) > CAP) return [-Infinity, Infinity];
    let result: Interval = { lo: Infinity, hi: -Infinity };
    for (let ix = 0; ix < xs.length - 1 || box.width === 0 && ix === 0; ix++)
      for (let iy = 0; iy < ys.length - 1 || box.height === 0 && iy === 0; iy++) {
        const x0 = xs[ix]!, x1 = xs[ix + 1] ?? x0, y0 = ys[iy]!, y1 = ys[iy + 1] ?? y0;
        const mx = x0 === x1 ? x0 : x0 + (x1 - x0) / 2, my = y0 === y1 ? y0 : y0 + (y1 - y0) / 2;
        let ground = point(-100), additions = point(0);
        for (const level of levels) {
          const gx = Math.floor(mx / level.pixel), gy = Math.floor(my / level.pixel);
          const fx = { lo: Math.max(0, nextDown(x0 / level.pixel - gx)), hi: Math.min(1, nextUp(x1 / level.pixel - gx)) };
          const fy = { lo: Math.max(0, nextDown(y0 / level.pixel - gy)), hi: Math.min(1, nextUp(y1 / level.pixel - gy)) };
          const value = cellRange(level, gx, gy, fx, fy, level.additive ? point(0) : ground);
          if (level.additive) additions = add(additions, value); else ground = value;
        }
        const value = add(ground, additions);
        result = { lo: Math.min(result.lo, value.lo), hi: Math.max(result.hi, value.hi) };
        if (result.lo === -Infinity && result.hi === Infinity) return [-Infinity, Infinity];
      }
    return [result.lo, result.hi];
  }
  function integrationCut(triangle: readonly Point[]) {
    if (triangle.length !== 3 || triangle.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw Error("Höhendreieck prüfen.");
    const axes = ["x", "y"] as const;
    for (const level of levels) for (const axis of axes) {
      const values = triangle.map(p => p[axis]), lo = Math.min(...values), hi = Math.max(...values);
      const first = Math.floor(lo / level.pixel) + 1, last = Math.ceil(hi / level.pixel) - 1;
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) continue;
      if (last >= first) {
        const value = (first + Math.floor((last - first) / 2)) * level.pixel;
        if (value > lo && value < hi && Number.isFinite(value)) return { axis, value };
      }
    }
    return undefined;
  }
  return { range, integrationCut };
}

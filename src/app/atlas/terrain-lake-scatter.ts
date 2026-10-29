import type { TerrainGrid } from './terrain-grid-contracts';
import type { LakeStroke } from './landscape-action-contracts';
import type { Point, Polygon } from '../shared/contracts';
import type { MaskSample } from './land-mask-contracts';
import { contains } from './landscape-geometry';
import { brushFootprint, intersectPolygons, unionPolygons } from './landscape-brush';
import { heightBrushPixel, prepareHeightBrush } from './terrain-brush';

export type LakeScatterStroke = Extract<LakeStroke, { mode: 'scatter' }>;

/** Remove only redundant observations of the same piecewise linear timed path.
 * This includes holding. Additional collinear input events cannot change dose,
 * clipping, candidate enumeration or ownership at author nodes. */
export function lakeScatterSamples(samples: MaskSample[]) {
  const result: MaskSample[] = [];
  for (const c of samples) {
    while (result.length > 1) {
      const a = result.at(-2)!,
        b = result.at(-1)!,
        dt = c.t - a.t;
      if (!dt) break;
      const f = (b.t - a.t) / dt;
      if (
        Math.abs(b.x - (a.x + (c.x - a.x) * f)) > 1e-8 ||
        Math.abs(b.y - (a.y + (c.y - a.y) * f)) > 1e-8
      )
        break;
      result.pop();
    }
    result.push(c);
  }
  return result;
}

function random(x: number, y: number, seed: number, channel: number) {
  let h =
    seed ^
    Math.imul(x | 0, 0x9e3779b1) ^
    Math.imul(y | 0, 0x85ebca77) ^
    Math.imul(Math.floor(x / 0x100000000), 0x27d4eb2d) ^
    Math.imul(Math.floor(y / 0x100000000), 0x165667b1) ^
    Math.imul(channel, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** World anchored jittered candidates; the rotated lattice is only a search
 * index. Each basin has its own eccentric, lobed contour and permanent key. */
export function prepareLakeScatter(
  s: LakeScatterStroke,
  visibility?: TerrainGrid,
  heightPlan?: ReturnType<typeof prepareHeightBrush>,
) {
  const legacySamples = lakeScatterSamples(s.samples),
    prepared =
      heightPlan ??
      prepareHeightBrush(
        {
          mode: 'lower',
          radius: s.radius,
          feather: s.feather,
          strength: s.strength,
          samples: s.screenInput ? s.samples : legacySamples,
          screenInput: s.screenInput,
          visibility: s.visibility,
        },
        visibility,
      ),
    lines = s.screenInput ? prepared.centrelines : [legacySamples],
    samples = lines.flat(),
    footprint = lines.reduce<Polygon[]>(
      (all, line) => unionPolygons(all, brushFootprint(line, s.radius)),
      [],
    ),
    pixel = heightBrushPixel(s.radius),
    spacing = s.radius * (0.92 - 0.61 * s.noise),
    radius = s.radius * (0.35 - 0.23 * s.noise),
    angle = random(0, 0, s.seed, 1) * Math.PI * 2,
    ca = Math.cos(angle),
    sa = Math.sin(angle),
    pad = s.radius / spacing + 2;
  const cells = new Map<string, { x: number; y: number }>();
  for (const line of lines) {
    if (!line.length) continue;
    const local = line.map((p) => ({
        x: (p.x * ca + p.y * sa) / spacing,
        y: (-p.x * sa + p.y * ca) / spacing,
      })),
      x0 = Math.floor(Math.min(...local.map((p) => p.x)) - pad),
      x1 = Math.ceil(Math.max(...local.map((p) => p.x)) + pad),
      y0 = Math.floor(Math.min(...local.map((p) => p.y)) - pad),
      y1 = Math.ceil(Math.max(...local.map((p) => p.y)) + pad);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 20000)
      throw Error('Seezug zu lang. In kürzeren Zügen bearbeiten.');
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        cells.set(`${x}:${y}`, { x, y });
        if (cells.size > 20000) throw Error('Seezug zu lang. In kürzeren Zügen bearbeiten.');
      }
  }
  const { dose, dabs } = prepared;
  const basins: {
    key: string;
    anchor: Point;
    polygons: Polygon[];
    profile: (p: Point) => number;
  }[] = [];
  for (const { x, y } of [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const rand = (c: number) => random(x, y, s.seed, c),
      lx = (x + 0.5 + (rand(2) - 0.5) * 0.88) * spacing,
      ly = (y + 0.5 + (rand(3) - 0.5) * 0.88) * spacing,
      anchor = { x: lx * ca - ly * sa, y: lx * sa + ly * ca },
      rotation = rand(4) * 2 * Math.PI,
      cr = Math.cos(rotation),
      sr = Math.sin(rotation),
      major = radius * (0.9 + rand(5) * 0.35),
      minor = radius * (0.72 + rand(6) * 0.25),
      phase = rand(7) * Math.PI * 2,
      rim = (a: number) => 1 + 0.13 * Math.sin(3 * a + phase) + 0.07 * Math.cos(5 * a - phase),
      outer = Array.from({ length: 40 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2,
          r = rim(a),
          u = Math.cos(a) * major * r,
          v = Math.sin(a) * minor * r;
        return { x: anchor.x + u * cr - v * sr, y: anchor.y + u * sr + v * cr };
      }),
      polygons = intersectPolygons([{ outer, holes: [] }], footprint);
    // Grazing slivers below the author resolution must not become random pixels.
    const area = polygons.reduce(
      (sum, p) =>
        sum +
        Math.abs(
          p.outer.reduce((a, p, i, ps) => {
            const q = ps[(i + 1) % ps.length]!;
            return a + (p.x - anchor.x) * (q.y - anchor.y) - (q.x - anchor.x) * (p.y - anchor.y);
          }, 0),
        ) /
          2,
      0,
    );
    if (area < pixel * pixel * 24) continue;
    basins.push({
      key: `${x}:${y}`,
      anchor,
      polygons,
      profile: (p) => {
        const dx = p.x - anchor.x,
          dy = p.y - anchor.y;
        if (
          Math.abs(dx) > Math.max(major, minor) * 1.2 ||
          Math.abs(dy) > Math.max(major, minor) * 1.2
        )
          return 0;
        const u = (dx * cr + dy * sr) / major,
          v = (-dx * sr + dy * cr) / minor,
          r = Math.hypot(u, v) / rim(Math.atan2(v, u));
        if (r >= 1 || !contains(p, polygons)) return 0;
        const t = 1 - r * r;
        return t * t;
      },
    });
  }
  if (dabs.length * basins.length > 2000000)
    throw Error('Seezug zu lang. In kürzeren Zügen bearbeiten.');
  return {
    samples: s.screenInput ? samples.map((p) => ({ ...p, t: 0 })) : legacySamples,
    footprint,
    basins,
    dabs,
    dose,
    tiles: prepared.tiles,
    owner: (p: Point) => {
      let owner = -1,
        profile = 0;
      for (let i = 0; i < basins.length; i++) {
        const value = basins[i]!.profile(p);
        if (value > profile) {
          profile = value;
          owner = i;
        }
      }
      return { owner, profile };
    },
  };
}

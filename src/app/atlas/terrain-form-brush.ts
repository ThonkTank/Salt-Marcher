import { terrainRoughness } from './terrain-relief';

type Point = { x: number; y: number };
type Dab = Point & { seconds: number };
export type TerrainForm = 'hills' | 'mountains' | 'canyon';
/** The same world field is used by adjacent gestures, retries and the writer. */
export const TERRAIN_FORM_SEED = 0x51a7c3;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Arc-length sampling, then a bounded corner round. Event count does not set
 * the shape scale. Appending a segment can move an old endpoint's neighbour,
 * which is why a form draft must be evaluated from its original ground. */
function centreline(samples: readonly Point[], radius: number): Point[] {
  const points: Point[] = [{ ...samples[0]! }],
    step = radius / 12;
  let remaining = step;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!,
      b = samples[i]!,
      length = Math.hypot(b.x - a.x, b.y - a.y);
    let distance = remaining;
    while (distance <= length) {
      points.push({
        x: a.x + ((b.x - a.x) * distance) / length,
        y: a.y + ((b.y - a.y) * distance) / length,
      });
      if (points.length > 20000) throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
      distance += step;
    }
    remaining = distance - length;
  }
  const last = samples.at(-1)!;
  if (Math.hypot(last.x - points.at(-1)!.x, last.y - points.at(-1)!.y) > radius * 1e-9)
    points.push({ ...last });
  return points.map((p, i) =>
    i === 0 || i === points.length - 1
      ? p
      : {
          x: (points[i - 1]!.x + 2 * p.x + points[i + 1]!.x) / 4,
          y: (points[i - 1]!.y + 2 * p.y + points[i + 1]!.y) / 4,
        },
  );
}

/** A bounded spatial index keeps evaluation local even on long strokes. */
function buckets<T>(items: readonly T[], box: (item: T) => number[], size: number, origin: Point) {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const [left, top, right, bottom] = box(item) as [number, number, number, number];
    const x0 = Math.floor((left - origin.x) / size),
      x1 = Math.floor((right - origin.x) / size),
      y0 = Math.floor((top - origin.y) / size),
      y1 = Math.floor((bottom - origin.y) / size);
    if (![x0, x1, y0, y1].every(Number.isSafeInteger))
      throw Error('Höhenbereich zu groß. In kürzeren Zügen bearbeiten.');
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const key = x + ':' + y;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = []));
        cell.push(item);
      }
  }
  return {
    cells,
    at: (p: Point) =>
      cells.get(Math.floor((p.x - origin.x) / size) + ':' + Math.floor((p.y - origin.y) / size)) ??
      [],
  };
}

/** The complete painted corridor shares its time exposure. Normalising by its
 * union area makes retracing build up while pointer pauses cannot cut a necklace
 * of separate pits. Crossings use continuous distance, never a segment label.
 * No intermediate terrain or event-indexed random phase enters this function. */
export function prepareTerrainForm(
  s: {
    form?: TerrainForm;
    radius: number;
    feather: number;
    seed?: number;
    samples: readonly Point[];
  },
  dabs: readonly Dab[],
) {
  const r = s.radius,
    points = centreline(s.samples, r),
    segments = points.map((b, i) => ({ a: points[Math.max(0, i - 1)]!, b })),
    nearbySegments = buckets(
      segments,
      ({ a, b }) => [
        Math.min(a.x, b.x) - r,
        Math.min(a.y, b.y) - r,
        Math.max(a.x, b.x) + r,
        Math.max(a.y, b.y) + r,
      ],
      r,
      points[0]!,
    ),
    seed = s.seed ?? TERRAIN_FORM_SEED;
  const distance = (p: Point) => {
    let distance2 = r * r;
    for (const { a, b } of nearbySegments.at(p)) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        length2 = dx * dx + dy * dy,
        t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
      distance2 = Math.min(distance2, (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2);
    }
    return Math.sqrt(distance2) / r;
  };
  // Integrate only occupied index cells, not the path's potentially huge box.
  // A fixed soft coverage boundary keeps the normalisation continuous as the
  // endpoint moves. The radial reference integral is pi*(1-f+0.3*f*f).
  const coverageFeather = 0.2,
    referenceArea = Math.PI * (1 - coverageFeather + 0.3 * coverageFeather ** 2);
  let area = 0;
  for (const key of nearbySegments.cells.keys()) {
    const [x, y] = key.split(':').map(Number) as [number, number];
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const d = distance({
          x: points[0]!.x + (x + (i + 0.5) / 4) * r,
          y: points[0]!.y + (y + (j + 0.5) / 4) * r,
        });
        area += smooth(Math.max(0, Math.min(1, (1 - d) / coverageFeather))) / 16;
      }
  }
  const exposure = (dabs.reduce((total, dab) => total + dab.seconds, 0) * referenceArea) / area;
  return (p: Point) => {
    const d = distance(p);
    if (d >= 1 || !exposure) return 0;
    // Every form has a soft outer edge, including feather=0.
    const dose = exposure * smooth(Math.min(1, (1 - d) / Math.max(0.12, s.feather)));
    const field = terrainRoughness(p.x / (r * 2), p.y / (r * 2), seed);
    if (s.form === 'hills') {
      // Broad, world-bound knolls and shallow hollows across the whole area.
      // A long stroke is a field of hills rather than its centreline extruded.
      return dose * (0.15 + 1.7 * field * field);
    }
    if (s.form === 'mountains') {
      const slope = (1 - d) ** 1.3,
        ridge = Math.exp(-((d / 0.16) ** 2)),
        shoulders = 0.12 * Math.exp(-(((d - 0.38) / 0.2) ** 2)) * field;
      // A positive main ridge cannot be cut by the bounded peak modulation.
      return dose * (0.43 * slope + 0.57 * ridge + shoulders) * (0.72 + 0.6 * field);
    }
    // Narrow floor, continuous banks and a smooth meeting with the hillside.
    const bank = smooth(Math.max(0, Math.min(1, (1 - d) / 0.86)));
    return dose * bank * (0.88 + 0.24 * field);
  };
}

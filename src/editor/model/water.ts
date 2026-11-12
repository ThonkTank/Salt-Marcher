import {
  cloneHeightDependency,
  validateHeightDependency,
  type HeightDependency,
} from "./content-identity";
import { assertPoint, clipBounds, type Bounds, type Point } from "./types";

interface WaterAuthor {
  id: string;
  revision: number;
  name: string;
  /** Complete natural-height input of the confirmed mask/profile. */
  terrain: HeightDependency;
}

export interface LakeSource extends WaterAuthor {
  kind: "lake";
  /** An open outer ring followed by open hole rings. */
  rings: Point[][];
  level: number;
}

export interface RiverSample {
  point: Point;
  /** Full channel width, in feet. */
  width: number;
  level: number;
}

export interface RiverSource extends WaterAuthor {
  kind: "river";
  samples: RiverSample[];
}

export type WaterSource = LakeSource | RiverSource;
export interface WaterPatch {
  key: string;
  before: WaterSource | null;
  after: WaterSource | null;
}

export const WATER_MAX_REGION_SOURCES = 128;
export const WATER_MAX_SOURCE_POINTS = 512;
export const WATER_MAX_SOURCE_BYTES = 128 * 1024;
export const WATER_NAME_MAX_LENGTH = 160;
export const RIVER_SAMPLE_SUPPORT = Math.SQRT2 * 5;

export function waterKey(id: string): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id))
    throw new RangeError("Ungültige Gewässeridentität.");
  return `water:${id}`;
}

export function parseWaterKey(key: string): string {
  if (typeof key !== "string" || !key.startsWith("water:"))
    throw new RangeError("Ungültiger Gewässerschlüssel.");
  const id = key.slice(6);
  if (waterKey(id) !== key)
    throw new RangeError("Nichtkanonischer Gewässerschlüssel.");
  return id;
}

/** Conservative payload/accounting charge, including arrays and numeric text. */
export function waterSourceBytes(source: WaterSource): number {
  const points =
    source.kind === "lake"
      ? source.rings.reduce((sum, ring) => sum + ring.length, 0)
      : source.samples.length;
  return (
    2048 +
    (source.id.length + source.name.length) * 4 +
    points * 192 +
    (source.kind === "lake" ? source.rings.length * 32 : 0)
  );
}

export function waterBounds(source: WaterSource): Bounds {
  let bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const include = ([x, y]: Point, radius = 0) => {
    bounds = [
      Math.min(bounds[0], x - radius),
      Math.min(bounds[1], y - radius),
      Math.max(bounds[2], x + radius),
      Math.max(bounds[3], y + radius),
    ];
  };
  if (source.kind === "lake") for (const p of source.rings[0]) include(p);
  else
    for (let i = 1; i < source.samples.length; i++) {
      const a = source.samples[i - 1],
        b = source.samples[i];
      const width = Math.max(a.width, b.width);
      const radius = width / 2 + Math.max(width, 5) + RIVER_SAMPLE_SUPPORT;
      include(a.point, radius);
      include(b.point, radius);
    }
  return clipBounds(bounds);
}

export function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const px = p[0] - a[0],
    py = p[1] - a[1];
  const tolerance =
    Number.EPSILON *
    32 *
    Math.max(1, Math.abs(dx), Math.abs(dy), Math.abs(px), Math.abs(py)) ** 2;
  return (
    Math.abs(px * dy - py * dx) <= tolerance &&
    px * dx + py * dy >= -tolerance &&
    px * dx + py * dy <= dx * dx + dy * dy + tolerance
  );
}

export function ringContainsPoint(ring: readonly Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i];
    if (pointOnSegment(p, a, b)) return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
    )
      inside = !inside;
  }
  return inside;
}

export function lakeContainsPoint(source: LakeSource, point: Point): boolean {
  return (
    ringContainsPoint(source.rings[0], point) &&
    !source.rings.slice(1).some((ring) => ringContainsPoint(ring, point))
  );
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  if (
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d) ||
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b)
  )
    return true;
  const side = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return (
    Math.sign(side(a, b, c)) !== Math.sign(side(a, b, d)) &&
    Math.sign(side(c, d, a)) !== Math.sign(side(c, d, b))
  );
}

function validateRings(rings: Point[][]): void {
  if (
    !Array.isArray(rings) ||
    !rings.length ||
    rings.some((ring) => !Array.isArray(ring) || ring.length < 3) ||
    rings.reduce((n, ring) => n + ring.length, 0) > WATER_MAX_SOURCE_POINTS
  )
    throw new RangeError("Ungültige oder zu große Seemaske.");
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    ring.forEach(assertPoint);
    let area = 0;
    const origin = ring[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      if (a[0] === b[0] && a[1] === b[1])
        throw new RangeError("Eine Seemaske enthält eine leere Kante.");
      area +=
        (a[0] - origin[0]) * (b[1] - origin[1]) -
        (a[1] - origin[1]) * (b[0] - origin[0]);
      for (let j = i + 2; j < ring.length; j++) {
        if (i === 0 && j === ring.length - 1) continue;
        if (segmentsIntersect(a, b, ring[j], ring[(j + 1) % ring.length]))
          throw new RangeError("Eine Seemaske schneidet sich selbst.");
      }
    }
    if (!Number.isFinite(area) || area === 0)
      throw new RangeError("Eine Seemaske benötigt eine Fläche.");
    if (r && !ringContainsPoint(rings[0], ring[0]))
      throw new RangeError("Ein Seeloch liegt außerhalb der Außenkontur.");
    for (let previous = 0; previous < r; previous++) {
      const other = rings[previous];
      if (
        previous &&
        (ringContainsPoint(other, ring[0]) || ringContainsPoint(ring, other[0]))
      )
        throw new RangeError("Seelöcher dürfen sich nicht überlagern.");
      for (let i = 0; i < ring.length; i++)
        for (let j = 0; j < other.length; j++)
          if (
            segmentsIntersect(
              ring[i],
              ring[(i + 1) % ring.length],
              other[j],
              other[(j + 1) % other.length],
            )
          )
            throw new RangeError(
              "Konturen einer Seemaske dürfen sich nicht berühren.",
            );
    }
  }
}

export function validateWaterSource(source: WaterSource): void {
  if (!source || (source.kind !== "lake" && source.kind !== "river"))
    throw new RangeError("Ungültige Gewässerquelle.");
  waterKey(source.id);
  if (
    !Number.isSafeInteger(source.revision) ||
    source.revision < 0 ||
    typeof source.name !== "string" ||
    source.name.length > WATER_NAME_MAX_LENGTH
  )
    throw new RangeError("Ungültiger Gewässerheader.");
  validateHeightDependency(source.terrain);
  const validLevel = (level: number) =>
    Number.isFinite(level) && Math.abs(level) <= 100_000;
  if (source.kind === "lake") {
    if (!validLevel(source.level)) throw new RangeError("Ungültiger Seepegel.");
    validateRings(source.rings);
  } else {
    if (
      !Array.isArray(source.samples) ||
      source.samples.length < 2 ||
      source.samples.length > WATER_MAX_SOURCE_POINTS
    )
      throw new RangeError("Ungültiges oder zu großes Flussprofil.");
    source.samples.forEach((sample, i) => {
      if (
        !sample ||
        !Number.isFinite(sample.width) ||
        sample.width <= 0 ||
        sample.width > 10_000 ||
        !validLevel(sample.level) ||
        sample.level < -99_998
      )
        throw new RangeError("Ungültiges Flusssample.");
      assertPoint(sample.point);
      if (
        i &&
        (sample.level > source.samples[i - 1].level ||
          Math.hypot(
            sample.point[0] - source.samples[i - 1].point[0],
            sample.point[1] - source.samples[i - 1].point[1],
          ) <= 1e-7)
      )
        throw new RangeError(
          "Ein bestätigtes Flussprofil muss abwärts und ohne leere Segmente verlaufen.",
        );
    });
  }
  const bounds = waterBounds(source);
  if (
    bounds[0] >= bounds[2] ||
    bounds[1] >= bounds[3] ||
    waterSourceBytes(source) > WATER_MAX_SOURCE_BYTES
  )
    throw new RangeError(
      "Die Gewässerquelle überschreitet ihre räumliche oder Speichergrenze.",
    );
  const read = source.terrain.bounds;
  if (
    read[0] > bounds[0] ||
    read[1] > bounds[1] ||
    read[2] < bounds[2] ||
    read[3] < bounds[3]
  )
    throw new RangeError(
      "Die Geländeabhängigkeit muss den vollständigen Gewässereinfluss abdecken.",
    );
}

export function cloneWaterSource(source: WaterSource): WaterSource {
  const header = {
    id: source.id,
    revision: source.revision,
    name: source.name,
    terrain: cloneHeightDependency(source.terrain),
  };
  return source.kind === "lake"
    ? {
        ...header,
        kind: "lake",
        level: source.level,
        rings: source.rings.map((ring) => ring.map((p) => [...p])),
      }
    : {
        ...header,
        kind: "river",
        samples: source.samples.map((sample) => ({
          point: [...sample.point],
          width: sample.width,
          level: sample.level,
        })),
      };
}

export function sameWaterSource(
  a: WaterSource | null,
  b: WaterSource | null,
): boolean {
  if (!a || !b) return a === b;
  // Cloning fixes field order and rejects attached metadata from identity checks.
  return (
    JSON.stringify(cloneWaterSource(a)) === JSON.stringify(cloneWaterSource(b))
  );
}

export function freezeWaterSource(source: WaterSource): WaterSource {
  const owned = cloneWaterSource(source);
  Object.freeze(owned.terrain.bounds);
  Object.freeze(owned.terrain);
  if (owned.kind === "lake") {
    for (const ring of owned.rings) {
      ring.forEach(Object.freeze);
      Object.freeze(ring);
    }
    Object.freeze(owned.rings);
  } else {
    for (const sample of owned.samples) {
      Object.freeze(sample.point);
      Object.freeze(sample);
    }
    Object.freeze(owned.samples);
  }
  return Object.freeze(owned);
}

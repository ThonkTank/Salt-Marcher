import type { Point, Polygon } from "./contracts";
import type { AtlasCell, Terrain } from "./world-contracts";
export const HEX_METERS = 4828.032;
export const EARTH_WIDTH = 40000000,
  EARTH_HEIGHT = 20000000;
export const hexSize = (level: number) => HEX_METERS * 3 ** level;
export interface LandscapeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type LandscapeField =
  | "terrain"
  | "elevationM"
  | "climate"
  | "road"
  | "river"
  | "label"
  | "faction"
  | "interrupt"
  | "access";
export interface LandscapeRecord {
  id: string;
  revision: number;
  kind: "patch" | "river" | "road" | "reference" | "place";
  name: string;
  points: Point[];
  polygons: Polygon[];
  resolution: number;
  width: number;
  values: Partial<Omit<AtlasCell, "q" | "r" | "level">>;
  order?: number;
  style?: "path" | "road" | "stream" | "river";
  locationId?: string;
  assetId?: string;
  imageWidth?: number;
  imageHeight?: number;
  angle?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}
export interface LandscapeRegion {
  revision: number;
  records: LandscapeRecord[];
}
export type LandscapeAction =
  | {
      kind: "landscape-batch";
      records: {
        record: LandscapeRecord;
        expectedRevision: number | null;
      }[];
    }
  | {
      kind: "landscape-put";
      record: LandscapeRecord;
      expectedRevision: number | null;
    }
  | {
      kind: "landscape-remove";
      id: string;
      expectedRevision: number;
    }
  | {
      kind: "landscape-reset";
      polygons: Polygon[];
      field: LandscapeField;
      resolution: number;
    }
  | {
      kind: "landscape-place";
      record: LandscapeRecord;
      document: import("../features/location/location-schema").LocationDocument;
      expectedLocationRevision: number | null;
      expectedRevision: number | null;
    };
export function hexPolygon(q: number, r: number, size: number): Polygon {
  return {
    outer: Array.from({ length: 6 }, (_, i) => {
      const a = ((30 + i * 60) * Math.PI) / 180;
      return {
        x: (q + r / 2) * size + (Math.cos(a) * size) / Math.sqrt(3),
        y:
          ((r * Math.sqrt(3)) / 2) * size + (Math.sin(a) * size) / Math.sqrt(3),
      };
    }),
    holes: [],
  };
}
export function contains(p: Point, polys: Polygon[]) {
  const ring = (a: Point[]) => {
    let c = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++)
      if (
        a[i]!.y > p.y !== a[j]!.y > p.y &&
        p.x <
          ((a[j]!.x - a[i]!.x) * (p.y - a[i]!.y)) / (a[j]!.y - a[i]!.y) +
            a[i]!.x
      )
        c = !c;
    return c;
  };
  return polys.some((poly) => ring(poly.outer) && !poly.holes.some(ring));
}
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function effectiveLandscape(
  records: LandscapeRecord[],
  p: Point,
  base: Partial<AtlasCell> = {},
) {
  const out = { ...base };
  for (const record of records
    .filter((r) => r.kind === "patch")
    .sort(
      (a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
    ))
    if (contains(p, record.polygons)) Object.assign(out, record.values);
  // Rivers are water surfaces. Roads never turn water into a crossing.
  for (const r of records)
    if (
      r.kind === "river" &&
      r.points.some(
        (v, i) =>
          i > 0 && segmentDistance(p, r.points[i - 1]!, v) <= r.width / 2,
      )
    ) {
      out.terrain = "water";
      out.river = true;
    }
  for (const r of records)
    if (
      r.kind === "road" &&
      out.terrain !== "water" &&
      r.points.some(
        (v, i) =>
          i > 0 && segmentDistance(p, r.points[i - 1]!, v) <= r.width / 2,
      )
    )
      out.road = true;
  return out;
}
export function bounds(record: LandscapeRecord): LandscapeBox {
  const pts = [...record.points, ...record.polygons.flatMap((p) => p.outer)];
  if (!pts.length) throw new Error("Geometrie fehlt.");
  if (record.kind === "reference") {
    const p = record.points[0]!,
      w = record.width,
      h = (w * (record.imageHeight ?? 1)) / (record.imageWidth ?? 1),
      a = record.angle ?? 0;
    pts.push(
      ...[
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ].map((v) => ({
        x: p.x + v.x * Math.cos(a) - v.y * Math.sin(a),
        y: p.y + v.x * Math.sin(a) + v.y * Math.cos(a),
      })),
    );
  }
  const pad =
      record.kind === "river" || record.kind === "road" ? record.width / 2 : 0,
    x = Math.min(...pts.map((p) => p.x)) - pad,
    y = Math.min(...pts.map((p) => p.y)) - pad;
  return {
    x,
    y,
    width: Math.max(...pts.map((p) => p.x)) - x + pad,
    height: Math.max(...pts.map((p) => p.y)) - y + pad,
  };
}
export function earthView(
  aspect: number,
  center: Point = { x: 0, y: 0 },
): LandscapeBox {
  const width = Math.max(EARTH_WIDTH, EARTH_HEIGHT * aspect),
    height = width / aspect;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}
export function distance(points: Point[]) {
  return points.reduce(
    (n, p, i) =>
      n + (i ? Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) : 0),
    0,
  );
}
export const formatDistance = (m: number) =>
  `${m < 1000 ? m.toFixed(1) + " m" : (m / 1000).toFixed(2) + " km"} · ${(m / 1609.344).toFixed(3)} Meilen`;
export const emptyRecord = (
  kind: LandscapeRecord["kind"],
): LandscapeRecord => ({
  id: crypto.randomUUID(),
  revision: 0,
  kind,
  name: "",
  points: [],
  polygons: [],
  resolution: HEX_METERS,
  width: kind === "river" ? 30 : kind === "road" ? 5 : 0,
  values: {},
});
export const terrainValue = (v: unknown): v is Terrain =>
  typeof v === "string" &&
  [
    "plains",
    "forest",
    "hills",
    "mountains",
    "water",
    "marsh",
    "desert",
    "snow",
  ].includes(v);

import type { LandscapeRecord } from "./atlas-landscape";
import type { CityUnitGeometry } from "./atlas-region-contracts";
import type { Point, Polygon } from "./contracts";
import { linePoints } from "./landscape-line";
import {
  extent,
  lineMaxMpp,
  simplifyMapPath,
  type MapLabel,
} from "./atlas-cartography";
export interface RegionLabelSource {
  kind: "territory";
  id: string;
  name: string;
  polygons: Polygon[];
  visible?: boolean;
  territory: {
    prominence: number;
    label: { position: Point | null; size: number; angle: number };
  };
}
export function landscapeLabel(
  r: LandscapeRecord | RegionLabelSource,
  mpp: number,
): MapLabel | null {
  if (!r.name.trim() || r.visible === false) return null;
  if (r.kind === "territory")
    return regionMapLabel(
      r.id,
      r.name,
      r.polygons,
      r.territory.prominence,
      r.territory.label.position ?? undefined,
    );
  if (r.kind === "place")
    return {
      id: "landscape:" + r.id,
      text: r.name,
      kind: "place",
      point: r.points[0],
      priority: 80,
    };
  if (r.kind === "road" || r.kind === "river")
    return {
      id: "landscape:" + r.id,
      text: r.name,
      kind: r.kind,
      path: simplifyMapPath(linePoints(r), mpp * 0.5),
      priority: r.kind === "river" ? 60 : 50,
      maxMpp: lineMaxMpp(r.kind, r.width) * 0.5,
    };
  return null;
}
export function cityUnitLabel(
  u: CityUnitGeometry,
  points: Point[],
  mpp: number,
): MapLabel | null {
  if (
    !u.name.trim() ||
    !points.length ||
    u.kind === "node" ||
    u.kind === "wall"
  )
    return null;
  const b = extent(points),
    point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (u.kind === "road")
    return {
      id: "unit:" + u.id,
      text: u.name,
      kind: "road",
      path: simplifyMapPath(points, mpp * 0.5),
      priority: 50,
      maxMpp: lineMaxMpp("road", u.width ?? 6) * 0.5,
    };
  const kind =
    u.kind === "building"
      ? "building"
      : u.kind === "water"
        ? "water"
        : "district";
  return {
    id: "unit:" + u.id,
    text: u.name,
    kind,
    polygons: [{ outer: points, holes: [] }],
    ...(kind === "building" ? { point } : {}),
    priority: kind === "building" ? 30 : kind === "water" ? 65 : 70,
    ...(kind === "district"
      ? { minMpp: Math.max(b.width, b.height) / 3000 }
      : {}),
    maxMpp: Math.max(b.width, b.height) / (kind === "building" ? 18 : 50),
  };
}
/** Region authors supply their existing geometry and prominence; this adds no stored region schema. */
export function regionMapLabel(
  id: string,
  text: string,
  polygons: Polygon[],
  prominence = 60,
  point?: Point,
): MapLabel {
  const bounds = extent(polygons.flatMap((p) => p.outer));
  return {
    id: "region:" + id,
    text,
    kind: "region",
    polygons,
    point,
    priority: 90 + prominence / 10,
    minMpp: Math.max(bounds.width, bounds.height) / 3000,
    maxMpp: 0.5 * 10 ** (prominence / 20),
  };
}

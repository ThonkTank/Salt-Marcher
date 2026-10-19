import polygonClipping from "polygon-clipping";
import type { Point, Polygon } from "./contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { contains } from "./atlas-landscape";
export interface AtlasRegionLayer {
  id: string;
  name: string;
  order: number;
  visible: boolean;
}
export interface AtlasTerritory {
  layerId: string;
  parentId: string | null;
  prominence: number;
  notes: string;
  color: string;
  fillOpacity: number;
  border: boolean;
  label: { position: Point | null; size: number; angle: number };
}
export const territoryPresets = [
  ["Gebäude", 0],
  ["Viertel", 20],
  ["Dungeon", 20],
  ["Stadt", 40],
  ["Provinz", 60],
  ["Königreich", 80],
  ["Kontinent", 100],
] as const;
export const defaultRegionLayers: readonly AtlasRegionLayer[] = [
  { id: "political", name: "Politisch", order: 0, visible: true },
  { id: "geographic", name: "Geografisch", order: 1, visible: true },
];
export const territoryThreshold = (prominence: number) =>
  0.5 * 10 ** (prominence / 20);
export function territoryOpacity(prominence: number, mpp: number) {
  const limit = territoryThreshold(prominence);
  return Math.max(0, Math.min(1, (limit - mpp) / (limit * 0.15)));
}
export function newTerritory(
  id: string,
  layerId = "political",
): LandscapeRecord {
  return {
    id,
    revision: 0,
    kind: "territory",
    name: "Neue Region",
    points: [],
    polygons: [],
    resolution: 1,
    width: 0,
    values: {},
    territory: {
      layerId,
      parentId: null,
      prominence: 40,
      notes: "",
      color: "#806040",
      fillOpacity: 0.12,
      border: true,
      label: { position: null, size: 16, angle: 0 },
    },
  };
}
export function layerRecord(
  layer: AtlasRegionLayer,
  revision = 0,
): LandscapeRecord {
  return {
    id: "region-layer:" + layer.id,
    revision,
    kind: "region-layer",
    name: layer.name,
    points: [{ x: 0, y: 0 }],
    polygons: [],
    resolution: 1,
    width: 0,
    values: {},
    regionLayer: layer,
  };
}
const point = (p: Point) =>
  p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  Math.abs(p.x) < 1e12 &&
  Math.abs(p.y) < 1e12;
export function validateTerritory(r: LandscapeRecord) {
  const t = r.territory;
  if (
    r.kind !== "territory" ||
    !t ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 1000 ||
    typeof t.layerId !== "string" ||
    !t.layerId ||
    !(
      t.parentId === null ||
      (typeof t.parentId === "string" && !!t.parentId)
    ) ||
    !Number.isFinite(t.prominence) ||
    t.prominence < 0 ||
    t.prominence > 100 ||
    typeof t.notes !== "string" ||
    t.notes.length > 2000000 ||
    !/^#[0-9a-f]{6}$/i.test(t.color) ||
    !Number.isFinite(t.fillOpacity) ||
    t.fillOpacity < 0 ||
    t.fillOpacity > 1 ||
    typeof t.border !== "boolean" ||
    !t.label ||
    !(t.label.position === null || point(t.label.position)) ||
    !Number.isFinite(t.label.size) ||
    t.label.size < 8 ||
    t.label.size > 96 ||
    !Number.isFinite(t.label.angle) ||
    Math.abs(t.label.angle) > 180
  )
    throw Error("Region: Name, Ebene, Prominenz und Darstellung prüfen.");
  if (
    !Array.isArray(r.polygons) ||
    r.polygons
      .flatMap((p) => [p.outer, ...p.holes])
      .some((r) => r.length < 3 || r.some((p) => !point(p))) ||
    r.polygons.reduce(
      (n, p) => n + p.outer.length + p.holes.reduce((n, h) => n + h.length, 0),
      0,
    ) > 20000
  )
    throw Error("Regionsgrenze prüfen (höchstens 20.000 Punkte).");
}
export function validateLayer(l: AtlasRegionLayer) {
  if (
    !l ||
    typeof l.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(l.id) ||
    typeof l.name !== "string" ||
    !l.name.trim() ||
    l.name.length > 200 ||
    !Number.isSafeInteger(l.order) ||
    Math.abs(l.order) > 10000 ||
    typeof l.visible !== "boolean"
  )
    throw Error("Regionsebene prüfen.");
}
const clip = (polys: Polygon[]) =>
  polys.map((p) =>
    [p.outer, ...p.holes].map((r) =>
      r.map((p) => [p.x, p.y] as [number, number]),
    ),
  );
const unclip = (ps: ReturnType<typeof polygonClipping.union>): Polygon[] =>
  ps.map((p) => ({
    outer: p[0]!.slice(0, -1).map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((h) => h.slice(0, -1).map(([x, y]) => ({ x, y }))),
  }));
export function combineTerritory(
  a: Polygon[],
  b: Polygon[],
  mode: "add" | "erase" | "intersect",
): Polygon[] {
  if (!a.length)
    return mode === "add" ? unclip(polygonClipping.union(clip(b))) : [];
  if (!b.length) return mode === "intersect" ? [] : a;
  return unclip(
    (mode === "add"
      ? polygonClipping.union
      : mode === "erase"
        ? polygonClipping.difference
        : polygonClipping.intersection)(clip(a), clip(b)),
  );
}
/** Capsule strokes do not skip ground between pointer events and do not depend on zoom. */
export function territoryStroke(points: Point[], radius: number): Polygon[] {
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 1e8 ||
    !points.length ||
    points.length > 4000 ||
    points.some((p) => !point(p))
  )
    throw Error("Regionspinsel prüfen.");
  const shapes: Polygon[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    shapes.push({
      outer: Array.from({ length: 20 }, (_, j) => ({
        x: p.x + radius * Math.cos((j * Math.PI) / 10),
        y: p.y + radius * Math.sin((j * Math.PI) / 10),
      })),
      holes: [],
    });
    if (i) {
      const a = points[i - 1]!,
        d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d) {
        const x = (-(p.y - a.y) / d) * radius,
          y = ((p.x - a.x) / d) * radius;
        shapes.push({
          outer: [
            { x: a.x + x, y: a.y + y },
            { x: p.x + x, y: p.y + y },
            { x: p.x - x, y: p.y - y },
            { x: a.x - x, y: a.y - y },
          ],
          holes: [],
        });
      }
    }
  }
  let result: Polygon[] = [];
  for (const shape of shapes) result = combineTerritory(result, [shape], "add");
  return result;
}
/** Compute a whole hierarchy update before storage publishes any changed record. */
export function applyTerritory(
  records: LandscapeRecord[],
  candidate: LandscapeRecord,
): LandscapeRecord[] {
  validateTerritory(candidate);
  const map = new Map(records.map((r) => [r.id, structuredClone(r)]));
  map.set(candidate.id, structuredClone(candidate));
  const target = map.get(candidate.id)!;
  const ancestors = (r: LandscapeRecord) => {
    const ids = new Set<string>([r.id]);
    let parent = r.territory!.parentId;
    while (parent) {
      if (ids.has(parent))
        throw Error("Regionshierarchie enthält einen Kreis.");
      ids.add(parent);
      const p = map.get(parent);
      if (!p || p.territory!.layerId !== r.territory!.layerId)
        throw Error(
          "Übergeordnete Region fehlt oder gehört zu einer anderen Ebene.",
        );
      parent = p.territory!.parentId;
    }
    return ids;
  };
  for (const r of map.values()) ancestors(r);
  target.polygons = combineTerritory([], target.polygons, "add");
  if (target.territory!.parentId)
    target.polygons = combineTerritory(
      target.polygons,
      map.get(target.territory!.parentId)!.polygons,
      "intersect",
    );
  const lineage = ancestors(target);
  for (const r of map.values())
    if (
      r.id !== target.id &&
      r.territory!.layerId === target.territory!.layerId &&
      !lineage.has(r.id) &&
      !ancestors(r).has(target.id)
    )
      r.polygons = combineTerritory(r.polygons, target.polygons, "erase");
  for (const r of [...map.values()].sort(
    (a, b) => ancestors(a).size - ancestors(b).size,
  )) {
    if (r.territory!.parentId)
      r.polygons = combineTerritory(
        r.polygons,
        map.get(r.territory!.parentId)!.polygons,
        "intersect",
      );
    validateTerritory(r);
  }
  return [...map.values()].filter(
    (r) =>
      JSON.stringify(r) !== JSON.stringify(records.find((x) => x.id === r.id)),
  );
}
/** Scanline interior point, including concavities and holes; no invented exterior label. */
export function territoryLabelPoint(r: LandscapeRecord): Point | null {
  if (!r.polygons.length) return null;
  if (r.territory!.label.position) return r.territory!.label.position;
  let best: Point | null = null,
    span = -1;
  for (const p of r.polygons) {
    const ys = p.outer.map((p) => p.y),
      min = Math.min(...ys),
      max = Math.max(...ys);
    for (let i = 1; i < 20; i++) {
      const y = min + ((max - min) * i) / 20,
        xs: number[] = [];
      for (const ring of [p.outer, ...p.holes])
        for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) {
          const a = ring[j]!,
            b = ring[k]!;
          if (a.y > y !== b.y > y)
            xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
        }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        if (
          xs[k + 1]! - xs[k]! > span ||
          (xs[k + 1]! - xs[k]! === span &&
            best &&
            Math.abs(y - (min + max) / 2) < Math.abs(best.y - (min + max) / 2))
        ) {
          span = xs[k + 1]! - xs[k]!;
          best = { x: (xs[k + 1]! + xs[k]!) / 2, y };
        }
    }
  }
  return best;
}
export function territoryContains(r: LandscapeRecord, p: Point) {
  return contains(p, r.polygons);
}
export function territoryBox(r: LandscapeRecord): LandscapeBox {
  const points = r.polygons.flatMap((p) => p.outer);
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}

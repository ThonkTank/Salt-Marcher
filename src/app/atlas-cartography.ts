import type { Point, Polygon } from "./contracts";

export type MapLabelKind =
  | "region"
  | "place"
  | "district"
  | "water"
  | "road"
  | "river"
  | "building"
  | "room";
/** Display projection only: never accepted by an authoring command. Coordinates are in the owning frame. */
export interface MapLabel {
  id: string;
  text: string;
  kind: MapLabelKind;
  point?: Point;
  path?: Point[];
  polygons?: Polygon[];
  priority: number;
  minMpp?: number;
  maxMpp?: number;
  selected?: boolean;
}
export const LABEL_LIMIT = 512;
export const LABEL_BYTES = 192 * 1024;
export const labelOrder = (a: MapLabel, b: MapLabel) =>
  Number(!!b.selected) - Number(!!a.selected) ||
  b.priority - a.priority ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const extent = (points: readonly Point[]) => {
  let x = Infinity,
    y = Infinity,
    xx = -Infinity,
    yy = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    xx = Math.max(xx, p.x);
    yy = Math.max(yy, p.y);
  }
  return { x, y, width: xx - x, height: yy - y };
};
export const mapLabelFont = (kind: MapLabelKind) =>
  kind === "region"
    ? 18
    : ["place", "water", "river"].includes(kind)
      ? 15
      : kind === "district"
        ? 16
        : 13;
export function lineMaxMpp(kind: string, width: number) {
  return kind === "river"
    ? Math.max(30, width * 150)
    : Math.max(8, width * (width >= 6 ? 250 : 30));
}
export function linePresentation(
  kind: string,
  width: number,
  mpp: number,
  selected = false,
) {
  const max = lineMaxMpp(kind, width);
  const opacity =
    selected || mpp <= 0
      ? 1
      : Math.max(0, Math.min(1, (max - mpp) / (max * 0.18)));
  return {
    opacity,
    width: Math.max(
      width,
      mpp * (kind === "river" ? 1.6 : width >= 6 ? 1.8 : 1.1),
    ),
    simplified: mpp > width / 2,
  };
}
export function buildingOpacity(
  points: readonly Point[],
  mpp: number,
  selected = false,
) {
  if (selected || mpp <= 0) return 1;
  const b = extent(points),
    size = Math.max(b.width, b.height) / mpp;
  return Math.max(0, Math.min(1, (size - 3) / 2));
}
export function simplifyMapPath(
  points: readonly Point[],
  tolerance: number,
): Point[] {
  if (points.length < 3 || tolerance <= 0) return points.slice();
  const keep = new Set([0, points.length - 1]),
    stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!,
      a = points[first!]!,
      b = points[last!]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      d = dx * dx + dy * dy;
    let best = tolerance * tolerance,
      index = -1;
    for (let i = first! + 1; i < last!; i++) {
      const p = points[i]!,
        t = d
          ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d))
          : 0;
      const v = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (v > best) {
        best = v;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([first!, index], [index, last!]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]!);
}
/** Deterministic bounded top-k; long names are retained verbatim or omitted, never shortened. */
export class MapLabelPool {
  private labels = new Map<string, MapLabel>();
  private used = 0;
  constructor(
    private limit = LABEL_LIMIT,
    private budget = LABEL_BYTES,
  ) {}
  add(label: MapLabel | null) {
    if (!label?.text.trim()) return;
    const size = JSON.stringify(label).length * 2;
    if (size > this.budget) return;
    const old = this.labels.get(label.id);
    if (old) {
      if (labelOrder(old, label) < 0) return;
      this.used -= JSON.stringify(old).length * 2;
      this.labels.delete(label.id);
    }
    this.labels.set(label.id, label);
    this.used += size;
    while (this.labels.size > this.limit || this.used > this.budget) {
      let worst: MapLabel | undefined;
      for (const v of this.labels.values())
        if (!worst || labelOrder(v, worst) > 0) worst = v;
      this.labels.delete(worst!.id);
      this.used -= JSON.stringify(worst).length * 2;
    }
  }
  values() {
    return [...this.labels.values()].sort(labelOrder);
  }
}
export function transformLabel(
  label: MapLabel,
  at: (p: Point) => Point,
): MapLabel {
  return {
    ...label,
    point: label.point && at(label.point),
    path: label.path?.map(at),
    polygons: label.polygons?.map((p) => ({
      outer: p.outer.map(at),
      holes: p.holes.map((h) => h.map(at)),
    })),
  };
}

import {
  MapLabelCollisions,
  type MapLabelRect as Rect,
} from "./map-label-collisions";
import { mapLineThreshold } from "./atlas-scale-policy";
import type { MapLabelStyle } from "./map-label-style";
import { atlasPaint, type AtlasPaint, type PaintStyle } from "./atlas-paint";
import type { Point, Polygon } from "./contracts";
import {
  contains,
  type LandscapeBox,
  type LandscapeRecord,
} from "./atlas-landscape";
import { linePoints } from "./landscape-line";
import {
  territoryAnchor,
  territoryBounds,
  type TerritoryState,
} from "./atlas-territories";
export type { MapLabelKind, MapLabelCandidate } from "./atlas-label-source";
import type {
  MapLabelKind,
  MapLabelCandidate,
  MapLabelSource,
} from "./atlas-label-source";
export const labelScaleLimits = [2, 12, 100, 1000, 10000, Infinity];
const footprintVisible = (width: number, mpp: number) =>
  width / mpp >= 2;
export function labelFromPolygon(
  id: string,
  text: string,
  kind: MapLabelKind,
  polygons: Polygon[],
  rank: number,
  preferred?: Point,
): MapLabelCandidate | null {
  if (!text.trim() || !polygons.length) return null;
  const b = territoryBounds(polygons),
    center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const p =
    preferred && contains(preferred, polygons)
      ? preferred
      : contains(center, polygons)
        ? center
        : territoryAnchor(polygons);
  if (!p) return null;
  const span = (axis: "x" | "y", v: number) => {
    const cross = axis === "x" ? "y" : "x",
      hits: number[] = [];
    for (const poly of polygons)
      for (const ring of [poly.outer, ...poly.holes])
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]!,
            q = ring[(i + 1) % ring.length]!;
          if (a[cross] > v === q[cross] > v) continue;
          hits.push(
            a[axis] +
              ((v - a[cross]) / (q[cross] - a[cross])) * (q[axis] - a[axis]),
          );
        }
    hits.sort((a, b) => a - b);
    const index = hits.findIndex((x) => x > p[axis]);
    return index > 0
      ? Math.max(
          0,
          2 * Math.min(p[axis] - hits[index - 1]!, hits[index]! - p[axis]),
        )
      : 0;
  };
  const vertical = span("y", p.x),
    horizontal = span("x", p.y),
    height = Math.min(vertical * 0.6, horizontal / 5),
    available =
      Math.min(
        horizontal,
        span("x", p.y - height / 2),
        span("x", p.y + height / 2),
      ) * 0.9;
  return { id, text, kind, point: p, rank, available, height };
}
export function lineLabels(
  id: string,
  text: string,
  kind: "road" | "river",
  points: Point[],
  rank = 2,
  box?: LandscapeBox,
): MapLabelCandidate[] {
  if (box) {
    const runs: Point[][] = [];
    let run: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!,
        dx = b.x - a.x,
        dy = b.y - a.y;
      let lo = 0,
        hi = 1,
        visible = true;
      for (const [p, q] of [
        [-dx, a.x - box.x],
        [dx, box.x + box.width - a.x],
        [-dy, a.y - box.y],
        [dy, box.y + box.height - a.y],
      ]) {
        if (p === 0) {
          if (q! < 0) visible = false;
        } else {
          const t = q! / p!;
          if (p! < 0) lo = Math.max(lo, t);
          else hi = Math.min(hi, t);
        }
      }
      if (!visible || lo > hi) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      const from = { x: a.x + lo * dx, y: a.y + lo * dy },
        to = { x: a.x + hi * dx, y: a.y + hi * dy };
      if (
        run.length &&
        Math.hypot(run.at(-1)!.x - from.x, run.at(-1)!.y - from.y) > 1e-7
      ) {
        runs.push(run);
        run = [];
      }
      if (!run.length) run.push(from);
      run.push(to);
    }
    if (run.length > 1) runs.push(run);
    return runs
      .flatMap((run, i) =>
        lineLabels(id + ":run" + i, text, kind, run, rank).map((c) => ({
          ...c,
          objectId: id,
        })),
      )
      .sort((a, b) => (b.available ?? 0) - (a.available ?? 0))
      .slice(0, 12);
  }
  if (!text.trim() || points.length < 2) return [];
  const out: MapLabelCandidate[] = [];
  let start = 0;
  const emit = (end: number) => {
    const a = points[start]!,
      b = points[end]!,
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0) {
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      out.push({
        id: id + ":" + start,
        objectId: id,
        text,
        kind,
        rank,
        point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        available: length * 0.85,
        angle,
      });
    }
    start = end;
  };
  for (let i = 2; i < points.length; i++) {
    const a = points[start]!,
      b = points[i - 1]!,
      c = points[i]!,
      u = Math.atan2(b.y - a.y, b.x - a.x),
      v = Math.atan2(c.y - b.y, c.x - b.x),
      turn = Math.abs(Math.atan2(Math.sin(v - u), Math.cos(v - u)));
    if (turn > 0.28) emit(i - 1);
  }
  emit(points.length - 1);
  return out
    .sort(
      (a, b) =>
        (b.available ?? 0) - (a.available ?? 0) || a.id.localeCompare(b.id),
    )
    .slice(0, 12);
}
export function styledLabels(
  candidates: MapLabelCandidate[],
  style?: MapLabelStyle,
): MapLabelCandidate[] {
  if (style?.hidden) return [];
  const selected = style?.point ? candidates.slice(0, 1) : candidates;
  return selected.map((c) => ({
    ...c,
    ...(style?.rank === undefined ? {} : { rank: style.rank }),
    ...(style?.point
      ? { point: style.point, available: undefined, height: undefined }
      : {}),
    ...(style?.angle === undefined ? {} : { angle: style.angle }),
  }));
}
export function landscapeLabels(
  r: LandscapeRecord,
  box?: LandscapeBox,
): MapLabelCandidate[] {
  let labels: MapLabelCandidate[] = [];
  if (r.kind === "place" && r.points[0] && r.name)
    labels = [
      {
        id: "place:" + r.id,
        text: r.name,
        kind: "place",
        point: r.points[0],
        rank: 2,
        locationId: r.locationId,
      },
    ];
  if (r.kind === "road" || r.kind === "river")
    labels = lineLabels(
      "landscape:" + r.id,
      r.name,
      r.kind,
      linePoints(r),
      r.width >= 100 ? 4 : r.width >= 20 ? 3 : r.width >= 5 ? 2 : 1,
      box,
    ).map((c) => ({
      ...c,
      maxMpp:
        r.width /
        mapLineThreshold(
          r.kind === "river" ? "river" : "road",
          r.style === "path" || r.style === "stream",
        ),
    }));
  if (r.kind === "patch" && r.surface === "freshwater" && r.name) {
    const c = labelFromPolygon("water:" + r.id, r.name, "area", r.polygons, 3);
    if (c) labels = [c];
  }
  return styledLabels(labels, r.label);
}
/** A spatially distributed budget keeps a dense corner from consuming every label slot. */
export function boundedLabels(
  candidates: Iterable<MapLabelCandidate>,
  box: LandscapeBox,
  limit = 1200,
) {
  const buckets = new Map<string, MapLabelCandidate[]>();
  for (const c of candidates) {
    if (!c.text || !Number.isFinite(c.point.x + c.point.y)) continue;
    const x = Math.floor(((c.point.x - box.x) / box.width) * 16),
      y = Math.floor(((c.point.y - box.y) / box.height) * 16),
      key = x + "," + y;
    if (x < -1 || x > 16 || y < -1 || y > 16) continue;
    const list = buckets.get(key) ?? [];
    list.push(c);
    list.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
    if (list.length > 12) list.length = 12;
    buckets.set(key, list);
  }
  const all = [...buckets.values()]
      .flat()
      .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id)),
    out: MapLabelCandidate[] = [];
  let bytes = 0;
  for (const c of all) {
    const n = JSON.stringify(c).length * 2;
    if (bytes + n > 320 * 1024 || out.length === limit) break;
    bytes += n;
    out.push(c);
  }
  return out;
}
export function territoryLabels(state: TerritoryState): MapLabelCandidate[] {
  return state.territories.flatMap((t) => {
    if (!state.layers.find((l) => l.id === t.layerId)?.visible) return [];
    const c = labelFromPolygon(
      "territory:" + t.id,
      t.name,
      "area",
      t.polygons,
      t.rank,
      t.labelPoint,
    );
    return c ? [{ ...c, locationId: t.locationId }] : [];
  });
}
export function drawTerritories(
  root: AtlasPaint,
  state: TerritoryState,
  box: LandscapeBox,
  mpp: number,
) {
  const edges = new Set<string>();
  for (const layer of [...state.layers].sort((a, b) => a.order - b.order))
    if (layer.visible)
      for (const t of state.territories
        .filter((t) => t.layerId === layer.id)
        .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))) {
        const b = territoryBounds(t.polygons);
        if (!footprintVisible(Math.max(b.width, b.height), mpp)) continue;
        root.append(
          atlasPaint("polygons", {
            polygons: t.polygons.map((p) => ({
              outer: p.outer.map((v) => ({ x: v.x - box.x, y: v.y - box.y })),
              holes: p.holes.map((h) =>
                h.map((v) => ({ x: v.x - box.x, y: v.y - box.y })),
              ),
            })),
            pointer: false,
            style: {
              fill: t.color,
              fillOpacity: t.opacity,
              fillRule: "evenodd",
            },
            data: { territory: t.id },
          }),
        );
        if (mpp > labelScaleLimits[t.rank]! * 4) continue;
        for (const poly of t.polygons)
          for (const ring of [poly.outer, ...poly.holes])
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i]!,
                b = ring[(i + 1) % ring.length]!,
                ends = [a.x + "," + a.y, b.x + "," + b.y].sort(),
                key = layer.id + ":" + ends.join(":");
              if (edges.has(key)) continue;
              edges.add(key);
              root.append(
                atlasPaint("line", {
                  x: a.x - box.x,
                  y: a.y - box.y,
                  x2: b.x - box.x,
                  y2: b.y - box.y,
                  pointer: false,
                  style: {
                    stroke: t.color,
                    lineWidth: mpp * (t.rank >= 4 ? 1.8 : 1.1),
                    lineDash: t.border === "dashed" ? [5 * mpp, 3 * mpp] : [],
                    lineCap: "round",
                  },
                }),
              );
            }
      }
}
export interface PlacedMapLabel {
  candidate: MapLabelCandidate;
  point: Point;
  font: number;
  box: Rect;
  opacity?: number;
  angle?: number;
}
export interface MapLabelProjection {
  point: Point;
  mpp: number;
  angle: number;
  available?: number;
  height?: number;
}
export class MapLabelLayout {
  private previous = new Map<string, number>();
  private appeared = new Map<string, number>();
  animating = false;
  layout(
    candidates: MapLabelCandidate[],
    box: LandscapeBox,
    mpp: number,
    measure: (s: string, size: number) => number,
    selected?: string,
    animate = false,
    project?: (candidate: MapLabelCandidate) => MapLabelProjection | null,
    visible?: (candidate: MapLabelCandidate) => boolean,
  ): PlacedMapLabel[] {
    const now = performance.now();
    this.animating = false;
    const placed: PlacedMapLabel[] = [],
      occupied = new MapLabelCollisions(box.width / mpp),
      next = new Map<string, number>(),
      locations = new Set<string>(),
      objects = new Set<string>();
    const rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const important = (c: MapLabelCandidate) =>
      selected !== undefined && (c.id === selected || c.objectId === selected);
    const kindPriority: Record<MapLabelKind, number> = {
      city: 5,
      place: 4,
      area: 3,
      river: 2,
      road: 1,
      building: 1,
      room: 0,
    };
    for (const c of [...candidates].sort(
      (a, b) =>
        Number(important(b)) - Number(important(a)) ||
        b.rank - a.rank ||
        Number(this.previous.has(b.id)) - Number(this.previous.has(a.id)) ||
        kindPriority[b.kind] - kindPriority[a.kind] ||
        (b.available ?? 0) - (a.available ?? 0) ||
        a.id.localeCompare(b.id),
    )) {
      if (
        (c.locationId && locations.has(c.locationId)) ||
        (c.objectId && objects.has(c.objectId))
      )
        continue;
      const projected = project?.(c);
      if (project && !projected) continue;
      const localMpp = projected?.mpp ?? mpp,
        available =
          projected?.available ??
          (c.available === undefined ? undefined : c.available / localMpp),
        availableHeight =
          projected?.height ??
          (c.height === undefined ? undefined : c.height / localMpp);
      const was = this.previous.has(c.id),
        isSelected = important(c),
        font = mapLabelFont(c),
        scaleLimit = Math.min(labelScaleLimits[c.rank]!, c.maxMpp ?? Infinity);
      if (!isSelected && localMpp > scaleLimit * (projected || was ? 1.15 : 1))
        continue;
      const width = measure(c.text, font) + 8,
        height = font + 6;
      if (
        !isSelected &&
        available !== undefined &&
        available < width * (projected || was ? 0.9 : 1.1)
      )
        continue;
      if (
        !isSelected &&
        availableHeight !== undefined &&
        availableHeight < height
      )
        continue;
      const options =
        c.kind === "place" || c.kind === "city"
          ? [
              [0, -14],
              [0, 18],
              [width / 2 + 9, 0],
              [-width / 2 - 9, 0],
            ]
          : [[0, 0]];
      const first = this.previous.get(c.id),
        order = [
          ...(first === undefined ? [] : [first]),
          ...options.map((_, i) => i).filter((i) => i !== first),
        ];
      const angle = projected?.angle ?? c.angle ?? 0,
        w =
          Math.abs(Math.cos(angle)) * width +
          Math.abs(Math.sin(angle)) * height,
        h =
          Math.abs(Math.sin(angle)) * width +
          Math.abs(Math.cos(angle)) * height;
      for (const index of order) {
        const [dx, dy] = options[index]!,
          px = projected ? projected.point.x + dx! : c.point.x + dx! * mpp,
          py = projected ? projected.point.y + dy! : c.point.y + dy! * mpp,
          r = rect;
        r.x = (projected ? px : (px - box.x) / mpp) - w / 2;
        r.y = (projected ? py : (py - box.y) / mpp) - h / 2;
        r.w = w;
        r.h = h;
        if (
          r.x < 2 ||
          r.y < 2 ||
          r.x + w > box.width / mpp - 2 ||
          r.y + h > box.height / mpp - 2
        )
          continue;
        if (occupied.overlaps(r)) continue;
        if (visible && !visible(c)) continue;
        const placedBox = { ...r };
        occupied.add(placedBox);
        const started = this.appeared.get(c.id) ?? now;
        this.appeared.set(c.id, started);
        const ease = (x: number) => {
          const t = Math.max(0, Math.min(1, x));
          return t * t * (3 - 2 * t);
        };
        const scaleOpacity =
          projected && !isSelected
            ? ease((1.15 - localMpp / scaleLimit) / 0.3) *
              (available === undefined
                ? 1
                : ease((available / width - 0.9) / 0.2))
            : 1;
        const opacity =
          (animate ? Math.min(1, (now - started) / 160) : 1) * scaleOpacity;
        this.animating ||= animate && now - started < 160;
        placed.push({
          candidate: c,
          point: { x: px, y: py },
          font,
          box: placedBox,
          opacity,
          ...(projected ? { angle } : {}),
        });
        next.set(c.id, index);
        if (c.locationId) locations.add(c.locationId);
        if (c.objectId) objects.add(c.objectId);
        break;
      }
    }
    this.previous = next;
    for (const id of this.appeared.keys())
      if (!next.has(id)) this.appeared.delete(id);
    return placed;
  }
}
let context: CanvasRenderingContext2D | null | undefined;
export function measureMapText(text: string, font: number) {
  if (context === undefined)
    context =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  if (context) {
    context.font = `${font}px sans-serif`;
    return context.measureText(text).width;
  }
  return Array.from(text).length * font * 0.62;
}
export const mapLabelFont = (c: MapLabelCandidate) =>
  c.kind === "area" ? 14 + c.rank : 12 + (c.rank >= 4 ? 2 : 0);
export function mapLabelStyle(
  kind: MapLabelKind,
  font: number,
  mpp = 1,
): PaintStyle {
  return {
    fontSize: font * mpp,
    textAlign: "center",
    textBaseline: "middle",
    fill: kind === "river" ? "#285f80" : "#293c38",
    stroke: "#f8f3e5",
    lineWidth: 3 * mpp,
    lineJoin: "round",
  };
}
export function paintMapLabels(
  root: AtlasPaint,
  placed: PlacedMapLabel[],
  box: LandscapeBox,
  mpp: number,
  source?: MapLabelSource,
) {
  if (source) root.mapLabels = source;
  for (const { candidate: c, point: p, font, opacity } of placed) {
    const angle = c.angle ?? 0,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    root.append(
      atlasPaint(
        "text",
        {
          x: 0,
          y: 0,
          matrix: [cos, sin, -sin, cos, p.x - box.x, p.y - box.y],
          opacity: opacity ?? 1,
          pointer: false,
          style: mapLabelStyle(c.kind, font, mpp),
          data: { mapLabel: c.id },
        },
        c.text,
      ),
    );
  }
}

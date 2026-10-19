import type { Point, Polygon } from "./contracts";
import {
  extent,
  labelOrder,
  mapLabelFont,
  type MapLabel,
} from "./atlas-cartography";
export interface PlacedMapLabel {
  label: MapLabel;
  key: string;
  x: number;
  y: number;
  angle: number;
  fontSize: number;
  width: number;
  height: number;
  opacity: number;
  box: { x: number; y: number; width: number; height: number };
}
export type MeasureMapText = (
  text: string,
  size: number,
) => { width: number; height: number };
const overlaps = (a: PlacedMapLabel["box"], b: PlacedMapLabel["box"]) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const inRing = (p: Point, r: Point[]) => {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!,
      b = r[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
};
const inside = (p: Point, poly: Polygon) =>
  inRing(p, poly.outer) && !poly.holes.some((h) => inRing(p, h));
function segmentClip(
  a: Point,
  b: Point,
  box: { x: number; y: number; width: number; height: number },
) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, box.x, box.x + box.width],
    [a.y, b.y - a.y, box.y, box.y + box.height],
  ]) {
    if (!delta) {
      if (start! < min! || start! > max!) return null;
      continue;
    }
    const x = (min! - start!) / delta,
      y = (max! - start!) / delta;
    lo = Math.max(lo, Math.min(x, y));
    hi = Math.min(hi, Math.max(x, y));
    if (lo > hi) return null;
  }
  return [lo, hi] as const;
}
function areaFits(
  poly: Polygon,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const box = {
    x: x - width / 2 - 4,
    y: y - height / 2 - 4,
    width: width + 8,
    height: height + 8,
  };
  if (
    ![
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].every(([dx, dy]) =>
      inside(
        { x: x + dx! * (width / 2 + 4), y: y + dy! * (height / 2 + 4) },
        poly,
      ),
    )
  )
    return false;
  for (const ring of [poly.outer, ...poly.holes])
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
      if (segmentClip(ring[j]!, ring[i]!, box)) return false;
  return true;
}
/** Scanline intervals avoid centroids outside concave areas and respect holes. */
function areaPositions(
  polygons: Polygon[],
  width: number,
  height: number,
  viewport: { width: number; height: number },
) {
  const result: { point: Point; key: string; angle: number }[] = [];
  for (let index = 0; index < polygons.length; index++) {
    const poly = polygons[index]!,
      b = extent(poly.outer),
      top = Math.max(height / 2, b.y),
      bottom = Math.min(viewport.height - height / 2, b.y + b.height);
    if (bottom <= top) continue;
    for (const fraction of [0.5, 0.375, 0.625, 0.25, 0.75, 0.125, 0.875]) {
      const y = top + (bottom - top) * fraction,
        xs: number[] = [];
      for (const ring of [poly.outer, ...poly.holes])
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i]!,
            c = ring[j]!;
          if (a.y > y !== c.y > y)
            xs.push(a.x + ((y - a.y) * (c.x - a.x)) / (c.y - a.y));
        }
      xs.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const left = Math.max(0, xs[i]!),
          right = Math.min(viewport.width, xs[i + 1]!);
        if (right - left >= width + 12) intervals.push({ left, right });
      }
      intervals.sort((a, b) => b.right - b.left - (a.right - a.left));
      for (let i = 0; i < intervals.length; i++) {
        const { left, right } = intervals[i]!,
          x = (left + right) / 2;
        if (areaFits(poly, x, y, width, height))
          result.push({
            point: { x, y },
            key: `area:${index}:${fraction}:${i}`,
            angle: 0,
          });
      }
    }
  }
  return result;
}
function linePositions(
  path: Point[],
  width: number,
  viewport: { width: number; height: number },
) {
  const positions: { point: Point; key: string; angle: number }[] = [];
  const distances = [0];
  for (let i = 1; i < path.length; i++)
    distances.push(
      distances[i - 1]! +
        Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y),
    );
  const total = distances.at(-1) ?? 0;
  if (total < width + 24) return positions;
  const at = (d: number) => {
    let i = 1;
    while (i < distances.length - 1 && distances[i]! < d) i++;
    const t =
        (d - distances[i - 1]!) / (distances[i]! - distances[i - 1]! || 1),
      a = path[i - 1]!,
      b = path[i]!;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  // Candidates follow the full path, not the clipped viewport; panning cannot reset repetition.
  const step = Math.max(440, width + 80),
    count = Math.max(1, Math.floor(total / step)),
    spacing = total / count,
    indices = new Set<number>();
  for (let i = 1; i < path.length; i++) {
    const clip = segmentClip(path[i - 1]!, path[i]!, {
      x: 0,
      y: 0,
      ...viewport,
    });
    if (!clip) continue;
    const length = distances[i]! - distances[i - 1]!,
      from = distances[i - 1]! + clip[0] * length,
      to = distances[i - 1]! + clip[1] * length;
    for (
      let j = Math.max(0, Math.ceil(from / spacing - 0.5));
      j <= Math.min(count - 1, Math.floor(to / spacing - 0.5)) &&
      indices.size < 256;
      j++
    )
      indices.add(j);
  }
  for (const i of indices) {
    const d = (total * (i + 0.5)) / count,
      p = at(d);
    const a = at(Math.max(0, d - width / 2 - 8)),
      b = at(Math.min(total, d + width / 2 + 8));
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (Math.hypot(b.x - a.x, b.y - a.y) < width * 0.9) continue;
    let straight = true;
    for (const offset of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const q = at(d + offset * width);
      if (
        Math.abs(
          -(q.x - p.x) * Math.sin(angle) + (q.y - p.y) * Math.cos(angle),
        ) > 5
      ) {
        straight = false;
        break;
      }
    }
    if (!straight) continue;
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    positions.push({ point: p, key: `line:${count}:${i}`, angle });
  }
  return positions;
}
/** One layout owner per canvas; only bounded placement preferences survive a frame. */
export class MapLabelLayout {
  private previous = new Map<string, { key: string; x: number; y: number }>();
  clear() {
    this.previous.clear();
  }
  layout(
    labels: readonly MapLabel[],
    viewport: { width: number; height: number },
    mpp: number,
    measure: MeasureMapText,
  ): PlacedMapLabel[] {
    const placed: PlacedMapLabel[] = [],
      next = new Map<string, { key: string; x: number; y: number }>(),
      bins = new Map<string, PlacedMapLabel[]>();
    const keys = (b: PlacedMapLabel["box"]) => {
      const result: string[] = [];
      for (
        let x = Math.floor(b.x / 64);
        x <= Math.floor((b.x + b.width) / 64);
        x++
      )
        for (
          let y = Math.floor(b.y / 64);
          y <= Math.floor((b.y + b.height) / 64);
          y++
        )
          result.push(x + ":" + y);
      return result;
    };
    for (const label of [...labels].sort(labelOrder)) {
      const old = this.previous.get(label.id),
        limit = label.maxMpp ?? Infinity,
        minimum = label.minMpp ?? 0;
      if (
        !label.selected &&
        (mpp > limit * (old ? 1.12 : 1) || mpp < minimum * (old ? 0.88 : 1))
      )
        continue;
      const fontSize = mapLabelFont(label.kind),
        metrics = measure(label.text, fontSize),
        width = metrics.width,
        height = metrics.height;
      if (
        !Number.isFinite(width) ||
        width <= 0 ||
        width + 12 > viewport.width ||
        height + 12 > viewport.height
      )
        continue;
      let candidates: { point: Point; key: string; angle: number }[] = [];
      if (label.path) candidates = linePositions(label.path, width, viewport);
      else if (label.polygons)
        candidates = areaPositions(label.polygons, width, height, viewport);
      if (label.point) {
        const p = label.point;
        for (const [i, [dx, dy]] of [
          [0, -1],
          [1, 0],
          [-1, 0],
          [0, 1],
          [1, -1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ].entries())
          candidates.push({
            point: {
              x: p.x + dx! * (width / 2 + 12),
              y: p.y + dy! * (height / 2 + 10),
            },
            key: "point:" + i,
            angle: 0,
          });
      }
      if (old)
        candidates.sort(
          (a, b) => Number(b.key === old.key) - Number(a.key === old.key),
        );
      for (const c of candidates) {
        const cos = Math.abs(Math.cos(c.angle)),
          sin = Math.abs(Math.sin(c.angle)),
          w = cos * width + sin * height + 12,
          h = sin * width + cos * height + 12;
        const box = {
          x: c.point.x - w / 2,
          y: c.point.y - h / 2,
          width: w,
          height: h,
        };
        if (
          box.x < 2 ||
          box.y < 2 ||
          box.x + w > viewport.width - 2 ||
          box.y + h > viewport.height - 2
        )
          continue;
        const cells = keys(box);
        if (cells.some((k) => bins.get(k)?.some((p) => overlaps(box, p.box))))
          continue;
        if (
          placed.some(
            (p) =>
              p.label.id === label.id &&
              Math.hypot(p.x - c.point.x, p.y - c.point.y) < 400,
          )
        )
          continue;
        const opacity = label.selected
          ? 1
          : Math.min(
              minimum
                ? Math.max(
                    0.15,
                    Math.min(1, (mpp - minimum * 0.88) / (minimum * 0.22)),
                  )
                : 1,
              Number.isFinite(limit)
                ? Math.max(
                    0.15,
                    Math.min(1, (limit * 1.12 - mpp) / (limit * 0.22)),
                  )
                : 1,
            );
        const p: PlacedMapLabel = {
          label,
          key: c.key,
          x: c.point.x,
          y: c.point.y,
          angle: c.angle,
          fontSize,
          width,
          height,
          box,
          opacity,
        };
        placed.push(p);
        for (const k of cells) {
          const bin = bins.get(k) ?? [];
          bin.push(p);
          bins.set(k, bin);
        }
        next.set(label.id, { key: c.key, x: p.x, y: p.y });
        if (!label.path) break;
      }
    }
    this.previous = next;
    return placed;
  }
}
export function paintMapLabels(
  ctx: CanvasRenderingContext2D,
  labels: PlacedMapLabel[],
  ratio = 1,
) {
  if (!labels.length) return;
  ctx.save();
  try {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const p of labels) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = p.opacity;
      ctx.font = `${p.label.selected ? "600" : "500"} ${p.fontSize}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff9eb";
      ctx.fillStyle = ["water", "river"].includes(p.label.kind)
        ? "#28566c"
        : "#344335";
      const lines = p.label.text.split("\n");
      lines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * p.fontSize * 1.2;
        ctx.strokeText(line, 0, y);
        ctx.fillText(line, 0, y);
      });
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
}
export function mapTextMeasurer(ctx: CanvasRenderingContext2D) {
  const cache = new Map<string, { width: number; height: number }>();
  return (text: string, size: number) => {
    const key = size + ":" + text;
    let result = cache.get(key);
    if (!result) {
      ctx.save();
      ctx.font = `600 ${size}px sans-serif`;
      const lines = text.split("\n");
      result = {
        width: Math.max(...lines.map((s) => ctx.measureText(s).width)),
        height: Math.max(size * 1.2, lines.length * size * 1.2),
      };
      ctx.restore();
      if (cache.size >= 2048) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
    }
    return result;
  };
}

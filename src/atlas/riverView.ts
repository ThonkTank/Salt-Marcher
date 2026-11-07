import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";
import type { RiverView } from "./generated/RiverView";
import type { RiverDelta } from "./generated/RiverDelta";
import type { WorldPoint } from "./model";
export function riverDisplay(
  views: RiverView[],
  delta?: RiverDelta | null,
): RiverView[] {
  if (!delta) return views;
  const replaced = new Set(
    [...delta.before, ...delta.after].map((v) => v.river.id),
  );
  return [...views.filter((v) => !replaced.has(v.river.id)), ...delta.after];
}
export function riverHit(views: RiverView[], p: WorldPoint, scale: number) {
  let best: {
    view: RiverView;
    distance: number;
    point: WorldPoint;
    segment: number;
    t: number;
  } | null = null;
  for (const view of views)
    for (let i = 1; i < view.samples.length; i++) {
      const a = view.samples[i - 1],
        b = view.samples[i],
        dx = b.point[0] - a.point[0],
        dy = b.point[1] - a.point[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a.point[0]) * dx + (p[1] - a.point[1]) * dy) /
            (dx * dx + dy * dy),
        ),
      );
      const point: WorldPoint = [a.point[0] + t * dx, a.point[1] + t * dy];
      const distance = Math.hypot(p[0] - point[0], p[1] - point[1]);
      if (
        distance <=
          Math.max(8 / scale, (a.width + (b.width - a.width) * t) / 2) &&
        (!best || distance < best.distance)
      )
        best = { view, distance, point, segment: i - 1, t };
    }
  return best;
}
const ribbons = new BudgetCache<RiverView, { scale: number; path: Path2D }>(
  CACHE_BUDGETS.riverGeometry.bytes,
  CACHE_BUDGETS.riverGeometry.entries,
);
function ribbon(view: RiverView, scale: number): Path2D {
  const cached = ribbons.get(view);
  if (cached && cached.scale === scale) return cached.path;
  const s = view.samples;
  const c = new Path2D();
  const sides = s.map((v, i) => {
    const a = s[Math.max(0, i - 1)].point,
      b = s[Math.min(s.length - 1, i + 1)].point;
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy) || 1;
    const half = Math.max(v.width, 1.5 / scale) / 2;
    return {
      left: [
        v.point[0] - (dy / length) * half,
        v.point[1] + (dx / length) * half,
      ] as WorldPoint,
      right: [
        v.point[0] + (dy / length) * half,
        v.point[1] - (dx / length) * half,
      ] as WorldPoint,
      angle: Math.atan2(dx, -dy),
      half,
    };
  });
  c.moveTo(sides[0].left[0], sides[0].left[1]);
  for (const p of sides.slice(1)) c.lineTo(p.left[0], p.left[1]);
  const end = sides.at(-1)!,
    last = s.at(-1)!;
  c.arc(...last.point, end.half, end.angle, end.angle - Math.PI, true);
  for (let i = sides.length - 2; i >= 0; i--)
    c.lineTo(sides[i].right[0], sides[i].right[1]);
  const start = sides[0];
  c.arc(...s[0].point, start.half, start.angle + Math.PI, start.angle, true);
  c.closePath();
  ribbons.setIfFits(view, { scale, path: c }, 256 + s.length * 96);
  return c;
}
export function paintRivers(
  c: CanvasRenderingContext2D,
  views: RiverView[],
  scale: number,
  selected = "",
  preview = false,
  waters: import("./generated/WaterBody").WaterBody[] = [],
) {
  ribbons.retain(views);
  for (const [view, cached] of ribbons)
    if (cached.scale !== scale) ribbons.delete(view);
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Clip submerged river banks as well as their fill; retain islands in lake holes.
  for (const water of waters) {
    c.beginPath();
    c.rect(-100000001, -100000001, 200000002, 200000002);
    for (const polygon of water.polygons)
      for (const ring of [polygon.outer, ...polygon.holes]) {
        ring.forEach((p, i) =>
          i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]),
        );
        c.closePath();
      }
    c.clip("evenodd");
  }
  const visible = views
    .filter((v) => v.samples.length >= 2)
    .map((v) => ({ v, s: v.samples, path: ribbon(v, scale) }));
  // All banks precede all water surfaces, so a confluence has no line across it.
  for (const bank of [true, false])
    for (const { v, path } of visible) {
      if (bank) {
        c.strokeStyle = v.river.id === selected ? "#ffe397" : "#547d85";
        c.lineWidth = 2 / scale;
        c.stroke(path);
      } else {
        c.fillStyle = "#72b8cf";
        c.fill(path);
      }
    }
  for (const { v, s } of visible) {
    if (preview)
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1],
          b = s[i],
          cut = Math.max(a.cut, b.cut);
        if (cut < 10) continue;
        c.strokeStyle = cut >= 30 ? "#df765f" : "#e5ac52";
        c.lineWidth = 3 / scale;
        c.beginPath();
        c.moveTo(...a.point);
        c.lineTo(...b.point);
        c.stroke();
      }
    if (preview || v.river.id === selected) {
      let run = 0;
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1].point,
          b = s[i].point,
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        run += Math.hypot(dx, dy) * scale;
        if (run < 70) continue;
        run = 0;
        c.save();
        c.translate(...b);
        c.rotate(Math.atan2(dy, dx));
        c.strokeStyle = "#f5f0cb";
        c.lineWidth = 2 / scale;
        c.beginPath();
        c.moveTo(-7 / scale, -4 / scale);
        c.lineTo(0, 0);
        c.lineTo(-7 / scale, 4 / scale);
        c.stroke();
        c.restore();
      }
    }
  }
  c.restore();
}

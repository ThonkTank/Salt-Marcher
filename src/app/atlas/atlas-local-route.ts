import type { Point } from '../contracts';
import { inside } from './city-model';
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function blocks(a: Point, b: Point, polygon: Point[]) {
  if (inside(a, polygon) || inside(b, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i]!,
      d = polygon[(i + 1) % polygon.length]!;
    if (cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10)
      return true;
  }
  return inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, polygon);
}
/** Derived walking graph only: source polygons keep their exact metric coordinates. */
export function atlasLocalRoute(
  start: Point,
  end: Point,
  obstacles: Point[][],
  accessible: (p: Point) => boolean = () => true,
): Point[] {
  if (obstacles.some((poly) => inside(start, poly) || inside(end, poly)))
    throw new Error(
      'Start oder Ziel liegt in einem Gebäude, Wasser oder einer Mauer. Einen verbundenen Eingang verwenden.',
    );
  const clear = (a: Point, b: Point) => {
    if (obstacles.some((poly) => blocks(a, b, poly))) return false;
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20);
    for (let i = 0; i <= count; i++)
      if (
        !accessible({
          x: a.x + ((b.x - a.x) * i) / Math.max(1, count),
          y: a.y + ((b.y - a.y) * i) / Math.max(1, count),
        })
      )
        return false;
    return true;
  };
  if (clear(start, end)) return [start, end];
  const step = 1.524,
    origin = start,
    point = (x: number, y: number) => ({
      x: origin.x + x * step,
      y: origin.y + y * step,
    }),
    key = (x: number, y: number) => x + ',' + y;
  type Node = { x: number; y: number; cost: number; score: number };
  const heap: Node[] = [];
  const push = (v: Node) => {
    heap.push(v);
    let i = heap.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p]!.score <= v.score) break;
      heap[i] = heap[p]!;
      i = p;
    }
    heap[i] = v;
  };
  const pop = () => {
    const out = heap[0]!,
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1]!.score < heap[c]!.score) c++;
        if (heap[c]!.score >= last.score) break;
        heap[i] = heap[c]!;
        i = c;
      }
      heap[i] = last;
    }
    return out;
  };
  const best = new Map<string, number>([['0,0', 0]]),
    parents = new Map<string, string>();
  push({
    x: 0,
    y: 0,
    cost: 0,
    score: Math.hypot(start.x - end.x, start.y - end.y),
  });
  let visited = 0;
  while (heap.length && visited++ < 60000) {
    const n = pop(),
      k = key(n.x, n.y);
    if (n.cost !== best.get(k)) continue;
    const p = point(n.x, n.y);
    if (Math.hypot(p.x - end.x, p.y - end.y) < step * 2 && clear(p, end)) {
      const result = [end, p];
      let at = k;
      while (parents.has(at)) {
        at = parents.get(at)!;
        const [x, y] = at.split(',').map(Number);
        result.push(point(x!, y!));
      }
      return result.reverse();
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const x = n.x + dx,
          y = n.y + dy,
          q = point(x, y),
          next = key(x, y),
          cost = n.cost + Math.hypot(dx, dy) * step;
        if (cost >= (best.get(next) ?? Infinity) || !clear(p, q)) continue;
        best.set(next, cost);
        parents.set(next, k);
        push({
          x,
          y,
          cost,
          score: cost + Math.hypot(q.x - end.x, q.y - end.y),
        });
      }
  }
  throw new Error(
    'Kein begehbarer lokaler Weg gefunden. Gebäude/Wasser meiden oder einen näheren Zwischenpunkt wählen.',
  );
}

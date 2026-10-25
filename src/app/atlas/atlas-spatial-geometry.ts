import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { AtlasPaint } from './atlas-paint';
import type { Point } from '../shared/contracts';

/** Numeric Atlas primitives stay numeric. Only authored SVG symbol literals need parsing. */
export function atlasSpatialPaths(node: AtlasPaint): {
  shapes: THREE.Shape[];
  lines: THREE.Vector2[][];
} {
  const g = node.geometry,
    shapes: THREE.Shape[] = [],
    lines: THREE.Vector2[][] = [];
  const vectors = (points: Point[]) => points.map((p) => new THREE.Vector2(p.x, p.y));
  const ring = (points: Point[], closed = true) => {
    const path = vectors(points);
    if (path.length < 2) return;
    if (closed && !path[0]!.equals(path.at(-1)!)) path.push(path[0]!.clone());
    lines.push(path);
    if (closed) shapes.push(new THREE.Shape(path));
  };
  const x = g.x ?? 0,
    y = g.y ?? 0;
  switch (node.kind) {
    case 'polygons':
      for (const polygon of g.polygons ?? []) {
        const start = shapes.length;
        ring(polygon.outer);
        const shape = shapes[start];
        if (!shape) continue;
        for (const hole of polygon.holes) {
          const path = vectors(hole);
          if (path.length < 3) continue;
          shape.holes.push(new THREE.Path(path));
          if (!path[0]!.equals(path.at(-1)!)) path.push(path[0]!.clone());
          lines.push(path);
        }
      }
      break;
    case 'polygon':
    case 'polyline':
      ring(g.points ?? [], node.kind === 'polygon');
      break;
    case 'line':
      ring(
        [
          { x, y },
          { x: g.x2 ?? 0, y: g.y2 ?? 0 },
        ],
        false,
      );
      break;
    case 'rect': {
      const w = g.width ?? 0,
        h = g.height ?? 0,
        r = Math.min(Math.abs(w) / 2, Math.abs(h) / 2, g.radiusX ?? 0);
      if (r <= 0)
        ring([
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ]);
      else {
        const shape = new THREE.Shape();
        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
        shapes.push(shape);
        lines.push(shape.getPoints(8));
      }
      break;
    }
    case 'circle':
    case 'ellipse': {
      const rx = Math.max(0, node.kind === 'circle' ? (g.radius ?? 0) : (g.radiusX ?? 0)),
        ry = Math.max(0, node.kind === 'circle' ? (g.radius ?? 0) : (g.radiusY ?? 0));
      ring(
        Array.from({ length: 48 }, (_, i) => ({
          x: x + rx * Math.cos((i * Math.PI) / 24),
          y: y + ry * Math.sin((i * Math.PI) / 24),
        })),
      );
      break;
    }
    case 'path': {
      // Escape the literal as data; never interpret embedded markup or URLs.
      const literal = (g.path ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
      for (const path of new SVGLoader().parse(
        `<svg xmlns="http://www.w3.org/2000/svg"><path d="${literal}" fill-rule="${node.style.fillRule ?? 'nonzero'}"/></svg>`,
      ).paths) {
        shapes.push(...SVGLoader.createShapes(path));
        for (const sub of path.subPaths) lines.push(sub.getPoints(16));
      }
      break;
    }
  }
  return { shapes, lines };
}

type StrokeWindow = (a: THREE.Vector2, b: THREE.Vector2) => [number, number] | undefined;
/** Clip before expanding a world-length line into screen-sized dashes. Keep
 * original travelled distances, so zoom/crop does not restart the dash phase. */
function clippedStrokePaths(points: THREE.Vector2[], window: StrokeWindow) {
  const paths: { points: THREE.Vector2[]; distance: number }[] = [];
  let part: THREE.Vector2[] = [],
    distance = 0,
    start = 0;
  const flush = () => {
    if (part.length > 1) paths.push({ points: part, distance: start });
    part = [];
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      length = a.distanceTo(b);
    if (!length) continue;
    const range = window(a, b);
    if (!range) {
      flush();
      distance += length;
      continue;
    }
    const [lo, hi] = range;
    if (lo > 0) flush();
    if (!part.length) {
      start = distance + lo * length;
      part.push(a.clone().lerp(b, lo));
    }
    part.push(a.clone().lerp(b, hi));
    if (hi < 1) flush();
    distance += length;
  }
  flush();
  return paths;
}

/** Split dashes in local coordinates, preserving phase across every segment. */
export function atlasStrokeParts(
  points: THREE.Vector2[],
  dash: number[] = [],
  offset = 0,
  window?: StrokeWindow,
): THREE.Vector2[][] {
  if (window)
    return clippedStrokePaths(points, window).flatMap((path) =>
      atlasStrokeParts(path.points, dash, offset + path.distance),
    );
  let pattern = dash.filter((n) => Number.isFinite(n) && n >= 0);
  if (pattern.length % 2) pattern = [...pattern, ...pattern];
  const period = pattern.reduce((a, b) => a + b, 0);
  if (!period) return [points];
  let phase = ((offset % period) + period) % period,
    index = 0;
  while (phase >= pattern[index]!) {
    phase -= pattern[index]!;
    index = (index + 1) % pattern.length;
  }
  let remaining = pattern[index]! - phase,
    part: THREE.Vector2[] = [],
    result: THREE.Vector2[][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      length = a.distanceTo(b);
    if (!length) continue;
    let used = 0;
    while (used < length) {
      const step = Math.min(remaining, length - used),
        end = used + step;
      if (index % 2 === 0) {
        if (!part.length) part.push(a.clone().lerp(b, used / length));
        part.push(a.clone().lerp(b, end / length));
      }
      used = end;
      remaining -= step;
      if (remaining <= Number.EPSILON * period) {
        if (part.length) {
          result.push(part);
          part = [];
        }
        index = (index + 1) % pattern.length;
        remaining = pattern[index]!;
      }
    }
  }
  if (part.length) result.push(part);
  return result;
}

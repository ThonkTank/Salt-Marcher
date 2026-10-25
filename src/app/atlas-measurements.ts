import type { Point, Polygon } from './contracts';
import { atlasPaint, type AtlasPaint } from './atlas-paint';
import { lengthLabel, areaLabel } from './atlas-units';
import type { CanvasBox } from './passive-map-canvas';
export const pathLength = (points: readonly Point[]) =>
  points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0);
function ringArea(points: readonly Point[]) {
  const origin = points[0];
  if (!origin) return 0;
  return (
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length]!;
        return sum + (p.x - origin.x) * (q.y - origin.y) - (q.x - origin.x) * (p.y - origin.y);
      }, 0),
    ) / 2
  );
}
export const polygonArea = (polygons: readonly Polygon[]) =>
  polygons.reduce(
    (sum, p) => sum + Math.max(0, ringArea(p.outer) - p.holes.reduce((a, h) => a + ringArea(h), 0)),
    0,
  );
export function extent(points: readonly Point[]) {
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return { x, y, width: right - x, height: bottom - y };
}
export function areaMeasures(polygons: readonly Polygon[]) {
  const points = polygons.flatMap((p) => p.outer);
  if (!points.length) return [];
  const b = extent(points);
  return [
    `Fläche: ${areaLabel(polygonArea(polygons))}`,
    `${lengthLabel(b.width)} × ${lengthLabel(b.height)}`,
  ];
}
export function pathMeasures(points: readonly Point[], width?: number) {
  return [
    `Länge: ${lengthLabel(pathLength(points))}`,
    ...(width !== undefined ? [`Breite: ${lengthLabel(width)}`] : []),
  ];
}
export const radiusMeasures = (radius: number) => [
  `Radius: ${lengthLabel(radius)}`,
  `Durchmesser: ${lengthLabel(radius * 2)}`,
];
export function wrapMeasurementLines(lines: readonly string[], maxCharacters: number) {
  const out: string[] = [];
  for (const line of lines) {
    let row = '';
    for (const word of line.split(' ')) {
      if (row && row.length + 1 + word.length > maxCharacters) {
        out.push(row);
        row = word;
      } else row += (row ? ' ' : '') + word;
    }
    if (row) out.push(row);
  }
  return out;
}
/** Screen-space label, positioned from a world-space anchor. Never a hit target. */
export function drawMeasurements(
  root: AtlasPaint,
  box: CanvasBox,
  mpp: number,
  anchor: Point,
  lines: readonly string[],
  project?: (p: Point) => Point,
) {
  if (
    !lines.length ||
    lines.some((line) => /NaN|Infinity/.test(line)) ||
    !Number.isFinite(anchor.x + anchor.y) ||
    mpp <= 0
  )
    return;
  anchor = project?.(anchor) ?? anchor;
  const maxWidth = Math.max(40, box.width / mpp - 16);
  const wrapped = wrapMeasurementLines(lines, Math.max(4, Math.floor((maxWidth - 20) / 7)));
  const width = Math.min(maxWidth, Math.max(...wrapped.map((l) => l.length)) * 7 + 20),
    height = wrapped.length * 18 + 12;
  const x = Math.max(8, Math.min(box.width / mpp - width - 8, (anchor.x - box.x) / mpp + 18));
  let y = (anchor.y - box.y) / mpp + 22;
  if (y + height > box.height / mpp - 8) y = (anchor.y - box.y) / mpp - height - 22;
  y = Math.max(8, y);
  const group = atlasPaint('group', {
    hud: true,
    matrix: [mpp, 0, 0, mpp, x * mpp, y * mpp],
    pointer: false,
    data: { editorOnly: 'true', atlasMeasurement: 'true' },
  });
  group.append(
    atlasPaint('rect', {
      width,
      height,
      style: { fill: '#fffaf0', fillOpacity: 0.96, stroke: '#8b785e', lineWidth: 1 },
      pointer: false,
    }),
  );
  wrapped.forEach((line, i) =>
    group.append(
      atlasPaint(
        'text',
        { x: 10, y: 20 + i * 18, style: { fontSize: 12, fill: '#26382e' }, pointer: false },
        line,
      ),
    ),
  );
  root.append(group);
}
export function elementMeasures(e: {
  kind: string;
  points: Point[];
  width: number;
  height: number;
  triggerRadius?: number;
}) {
  if (['terrain', 'water', 'roof'].includes(e.kind))
    return e.points.length >= 3
      ? areaMeasures([{ outer: e.points, holes: [] }])
      : pathMeasures(e.points);
  if (['wall', 'path'].includes(e.kind)) return pathMeasures(e.points, e.width);
  if (e.kind === 'light') return radiusMeasures(e.width);
  if (e.kind === 'feature') return radiusMeasures(e.triggerRadius ?? 0);
  return [`${lengthLabel(e.width)} × ${lengthLabel(e.height)}`];
}

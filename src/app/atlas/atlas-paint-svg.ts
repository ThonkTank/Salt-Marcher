import type { Polygon } from '../shared/contracts';
import { AtlasPaint } from './atlas-paint';
export const svgNamespace = 'http://www.w3.org/2000/svg';
const escapeXML = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
/** Serialize numeric contours only at an explicitly requested vector boundary. */
export function polygonMarkupPath(polygons: Polygon[]) {
  return polygons
    .flatMap((p) => [p.outer, ...p.holes])
    .map((r) => 'M' + r.map((p) => p.x + ',' + p.y).join('L') + 'Z')
    .join(' ');
}
export function paintSvgAttributes(n: AtlasPaint) {
  const p = n.geometry,
    a: Record<string, string | number> = {};
  const coords =
    n.kind === 'circle' || n.kind === 'ellipse'
      ? { x: 'cx', y: 'cy' }
      : n.kind === 'line'
        ? { x: 'x1', y: 'y1' }
        : { x: 'x', y: 'y' };
  for (const k of ['x', 'y'] as const) if (p[k] !== undefined) a[coords[k]] = p[k]!;
  for (const k of ['width', 'height', 'x2', 'y2'] as const) if (p[k] !== undefined) a[k] = p[k]!;
  if (p.radius !== undefined) a.r = p.radius;
  if (p.radiusX !== undefined) a.rx = p.radiusX;
  if (p.radiusY !== undefined) a.ry = p.radiusY;
  if (p.path !== undefined) a.d = p.path;
  if (p.polygons) a.d = polygonMarkupPath(p.polygons);
  if (p.points) a.points = p.points.map((p) => p.x + ',' + p.y).join(' ');
  if (p.source !== undefined) a.href = p.source;
  if (p.matrix) a.transform = 'matrix(' + p.matrix.join(' ') + ')';
  if (p.opacity !== undefined) a.opacity = p.opacity;
  if (p.pointer === false) a['pointer-events'] = 'none';
  if (p.hidden) a.visibility = 'hidden';
  if (p.size)
    Object.assign(a, {
      xmlns: svgNamespace,
      viewBox: `0 0 ${p.size.width} ${p.size.height}`,
      width: p.size.width,
      height: p.size.height,
    });
  const keys = {
    fill: 'fill',
    stroke: 'stroke',
    lineWidth: 'stroke-width',
    fillRule: 'fill-rule',
    lineCap: 'stroke-linecap',
    lineJoin: 'stroke-linejoin',
    lineDashOffset: 'stroke-dashoffset',
    fontSize: 'font-size',
    fontFamily: 'font-family',
    fontWeight: 'font-weight',
    fillOpacity: 'fill-opacity',
    strokeOpacity: 'stroke-opacity',
  } as const;
  for (const [k, key] of Object.entries(keys))
    if (n.style[k as keyof typeof keys] !== undefined)
      a[key] = n.style[k as keyof typeof keys] ?? 'none';
  if (n.kind === 'text' && n.style.stroke) a['paint-order'] = 'stroke';
  if (n.data.roomNumber) a['aria-hidden'] = 'true';
  if (n.style.lineDash)
    a['stroke-dasharray'] = n.style.lineDash.length ? n.style.lineDash.join(' ') : 'none';
  if (n.style.textAlign)
    a['text-anchor'] =
      n.style.textAlign === 'center' ? 'middle' : n.style.textAlign === 'right' ? 'end' : 'start';
  if (n.style.textBaseline) a['dominant-baseline'] = n.style.textBaseline;
  for (const [k, v] of Object.entries(n.data))
    a['data-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())] = v;
  return a;
}
export const paintSvgTag = (n: AtlasPaint) =>
  n.geometry.size ? 'svg' : n.kind === 'group' ? 'g' : n.kind === 'polygons' ? 'path' : n.kind;
/** Adapter for historical standalone hosts and their existing vector/document interfaces. Atlas screen and raster export never serialize SVG. */
export function paintMarkup(n: AtlasPaint): string {
  const name = paintSvgTag(n),
    a = Object.entries(paintSvgAttributes(n))
      .map(([k, v]) => ` ${k}="${escapeXML(v)}"`)
      .join('');
  return `<${name}${a}>${n.title ? '<title>' + escapeXML(n.title) + '</title>' : ''}${escapeXML(n.text)}${n.children.map(paintMarkup).join('')}</${name}>`;
}

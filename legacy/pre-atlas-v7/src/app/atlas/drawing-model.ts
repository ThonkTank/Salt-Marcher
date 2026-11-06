import { atlasPaint, rotation } from './atlas-paint';
import { paintMarkup, polygonMarkupPath as roomPath } from './atlas-paint-svg';
import { visibility } from '../../compute';
import clipping, { type MultiPolygon } from 'polygon-clipping';
import type { Point, Polygon, RoomGeometry } from '../shared/contracts';
import type {
  DrawingElement,
  DrawingElementGeometry,
  RoomStyle,
} from './drawing-element-contracts';
import type { DrawingView } from './drawing-view-contracts';
const toMulti = (p: Polygon[]): MultiPolygon =>
  p.map((p) =>
    [p.outer, ...p.holes].map((r) => [
      ...r.map((p) => [p.x, p.y] as [number, number]),
      [r[0]!.x, r[0]!.y] as [number, number],
    ]),
  );
const fromMulti = (p: MultiPolygon): Polygon[] =>
  p
    .map((p) => ({
      outer: p[0]!.slice(0, -1).map(([x, y]) => ({ x, y })),
      holes: p.slice(1).map((r) => r.slice(0, -1).map(([x, y]) => ({ x, y }))),
    }))
    .filter((p) => p.outer.length >= 3);
export function combineRooms(polygons: Polygon[][]) {
  const [first, ...rest] = polygons.map(toMulti);
  return first ? fromMulti(clipping.union(first, ...rest)) : [];
}
export function carveRoom(base: Polygon[], cut: Polygon[]) {
  return fromMulti(clipping.difference(toMulti(base), toMulti(cut)));
}
export function inside(point: Point, polygons: Polygon[]) {
  const ring = (r: Point[]) => {
    let yes = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i]!,
        b = r[j]!;
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        yes = !yes;
    }
    return yes;
  };
  return polygons.some((p) => ring(p.outer) && !p.holes.some(ring));
}
export function anchored(e: DrawingElementGeometry, rooms: RoomGeometry[]) {
  if (!e.anchor) {
    if (e.kind === 'door' && e.points.length === 1) {
      const p = e.points[0]!,
        a = (e.angle * Math.PI) / 180;
      return [
        { x: p.x - (Math.cos(a) * e.width) / 2, y: p.y - (Math.sin(a) * e.width) / 2 },
        { x: p.x + (Math.cos(a) * e.width) / 2, y: p.y + (Math.sin(a) * e.width) / 2 },
      ];
    }
    return e.points;
  }
  const a = e.anchor,
    r = rooms.find((r) => r.id === a.roomId),
    ring = r?.polygons[a.polygon]?.outer,
    p = ring?.[a.edge],
    q = ring?.[(a.edge + 1) % (ring?.length ?? 1)];
  if (!p || !q) return e.points;
  const x = p.x + (q.x - p.x) * a.t,
    y = p.y + (q.y - p.y) * a.t,
    dx = q.x - p.x,
    dy = q.y - p.y,
    l = Math.hypot(dx, dy) || 1;
  return [
    { x: x - ((dx / l) * e.width) / 2, y: y - ((dy / l) * e.width) / 2 },
    { x: x + ((dx / l) * e.width) / 2, y: y + ((dy / l) * e.width) / 2 },
  ];
}
/** Keep a door's physical location on a still-present wall segment; otherwise carry its fraction. */
export function deformedBoundaryPoints(
  e: DrawingElementGeometry,
  source: RoomGeometry,
  target: RoomGeometry,
) {
  const old = anchored(e, [source]),
    a = e.anchor,
    ring = a ? target.polygons[a.polygon]?.outer : undefined,
    p = a ? ring?.[a.edge] : undefined,
    q = a ? ring?.[(a.edge + 1) % (ring?.length ?? 1)] : undefined;
  if (!p || !q) return old;
  const center =
      old.length > 1 ? { x: (old[0]!.x + old[1]!.x) / 2, y: (old[0]!.y + old[1]!.y) / 2 } : old[0]!,
    dx = q.x - p.x,
    dy = q.y - p.y,
    length2 = dx * dx + dy * dy,
    t = ((center.x - p.x) * dx + (center.y - p.y) * dy) / length2;
  if (t >= 0 && t <= 1 && Math.hypot(center.x - p.x - dx * t, center.y - p.y - dy * t) < 1e-7)
    return old;
  return anchored(e, [target]);
}
export function nearestAnchor(p: Point, room: RoomGeometry) {
  let best: { roomId: string; polygon: number; edge: number; t: number; distance: number } | null =
    null;
  room.polygons.forEach((poly, polygon) =>
    poly.outer.forEach((a, edge) => {
      const b = poly.outer[(edge + 1) % poly.outer.length]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
        ),
        distance = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
      if (!best || distance < best.distance) best = { roomId: room.id, polygon, edge, t, distance };
    }),
  );
  return best as {
    roomId: string;
    polygon: number;
    edge: number;
    t: number;
    distance: number;
  } | null;
}
export function newElement(
  kind: DrawingElement['kind'],
  scopeId: string,
  floorId: string,
  roomId: string | null,
  points: Point[],
  id: string = crypto.randomUUID(),
): DrawingElement {
  return {
    id,
    revision: 1,
    scopeId,
    floorId,
    roomId,
    kind,
    points,
    name: '',
    notes: '',
    secret: false,
    color:
      kind === 'water'
        ? '#5398be'
        : kind === 'terrain'
          ? '#8a9e6b'
          : kind === 'light'
            ? '#ffdc93'
            : '#75604e',
    width: kind === 'wall' ? 0.2 : kind === 'door' ? 1.524 : 1,
    height: ['wall', 'door', 'stairs'].includes(kind) ? 3.048 : 1,
    angle: 0,
    variant: kind === 'object' ? 'chest' : '',
    blocksSight: kind === 'wall' || kind === 'door',
    blocksSound: kind === 'wall' || kind === 'door',
    passable: kind !== 'wall',
    state: 'closed',
    targetRoomId: null,
    targetFloorId: null,
    anchor: null,
    feature: 'trap',
    maxCharges: 1,
    resetSeconds: 0,
    resetMode: 'empty',
    triggerRadius: 1.524,
    triggerHeight: 3.048,
    assetId: null,
    archived: false,
  };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export { roomPath };
export function drawingSegments(rooms: RoomGeometry[], elements: DrawingElementGeometry[]) {
  const doors = elements.filter(
      (e) => e.kind === 'door' && !e.archived && (e.state === 'open' || !e.blocksSight),
    ),
    segments: { a: Point; b: Point }[] = [];
  const append = (a: Point, b: Point) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (length < 1e-8) return;
    const gaps: { from: number; to: number }[] = [];
    for (const door of doors) {
      const p = anchored(door, rooms),
        center = p.length > 1 ? { x: (p[0]!.x + p[1]!.x) / 2, y: (p[0]!.y + p[1]!.y) / 2 } : p[0]!;
      const t = ((center.x - a.x) * dx + (center.y - a.y) * dy) / (length * length),
        distance = Math.abs((center.x - a.x) * dy - (center.y - a.y) * dx) / length;
      if (t >= 0 && t <= 1 && distance < 0.05)
        gaps.push({
          from: Math.max(0, t - door.width / 2 / length),
          to: Math.min(1, t + door.width / 2 / length),
        });
    }
    gaps.sort((a, b) => a.from - b.from);
    let start = 0;
    for (const gap of [...gaps, { from: 1, to: 1 }]) {
      if (gap.from > start)
        segments.push({
          a: { x: a.x + dx * start, y: a.y + dy * start },
          b: { x: a.x + dx * gap.from, y: a.y + dy * gap.from },
        });
      start = Math.max(start, gap.to);
    }
  };
  for (const room of rooms)
    for (const ring of room.polygons.flatMap((p) => [p.outer, ...p.holes]))
      for (let i = 0; i < ring.length; i++) append(ring[i]!, ring[(i + 1) % ring.length]!);
  for (const e of elements.filter((e) => e.kind === 'wall' && e.blocksSight && !e.archived))
    for (let i = 1; i < e.points.length; i++) append(e.points[i - 1]!, e.points[i]!);
  return segments;
}
/** Canonical room surface for the detailed Atlas and its raster output. */
export function roomFacePaint(
  room: RoomGeometry,
  unitsPerPixel: number,
  style?: Pick<RoomStyle, 'fill' | 'wall'>,
  selected = false,
) {
  return atlasPaint('polygons', {
    polygons: room.polygons,
    style: {
      fill: style?.fill ?? (selected ? '#e8d8ac' : '#e2dac4'),
      stroke: style?.wall ?? '#3d4b45',
      lineWidth: Math.max(0.07, Math.min(0.18, unitsPerPixel)),
      fillRule: 'evenodd',
    },
  });
}
/** One geometry source for Canvas display and raster export; legacy hosts use an adapter. */
export function elementPaint(
  e: DrawingElementGeometry,
  rooms: RoomGeometry[],
  elements: DrawingElementGeometry[] = [],
) {
  const p = anchored(e, rooms),
    at = p[0] ?? { x: 0, y: 0 },
    pts = p,
    g = atlasPaint('group', { data: { drawingId: String(e.id) } });
  g.title = e.name || e.kind;
  if (['wall', 'path', 'door', 'stairs'].includes(e.kind)) {
    const line = atlasPaint('polyline', {
      points: pts,
      style: {
        fill: null,
        stroke: e.kind === 'door' && e.state === 'open' ? '#9da684' : e.color,
        lineWidth: e.kind === 'door' ? 0.22 : e.width,
        lineCap: 'round',
      },
    });
    if (e.kind === 'stairs') line.style.lineDash = [0.3, 0.25];
    g.append(line);
    if (e.kind === 'door') {
      const middle = p.length > 1 ? { x: (p[0]!.x + p[1]!.x) / 2, y: (p[0]!.y + p[1]!.y) / 2 } : at;
      g.append(
        atlasPaint('circle', {
          x: middle.x,
          y: middle.y,
          radius: 0.15,
          style: { fill: e.state === 'locked' ? '#c35848' : e.color },
        }),
      );
    }
  } else if (['terrain', 'water', 'roof'].includes(e.kind))
    g.append(
      atlasPaint('polygon', {
        points: pts,
        opacity: 0.55,
        style: { fill: e.color, stroke: e.color, lineWidth: 0.06 },
      }),
    );
  else if (e.kind === 'light') {
    const area = visibility(
      {
        id: e.id,
        floorId: e.floorId,
        kind: 'light',
        x: at.x,
        y: at.y,
        radius: e.width,
        intensity: 1,
        color: 0,
        shadows: true,
      },
      drawingSegments(rooms, elements),
    );
    g.append(
      atlasPaint('polygon', { points: area, opacity: 0.22, style: { fill: e.color } }),
      atlasPaint('circle', { x: at.x, y: at.y, radius: 0.18, style: { fill: e.color } }),
    );
  } else if (e.kind === 'text')
    g.append(
      atlasPaint(
        'text',
        {
          x: at.x,
          y: at.y,
          matrix: rotation((e.angle * Math.PI) / 180, at.x, at.y),
          style: { fontSize: e.height, fill: e.color },
        },
        e.name,
      ),
    );
  else if (e.kind === 'feature')
    g.append(
      atlasPaint('circle', {
        x: at.x,
        y: at.y,
        radius: e.triggerRadius,
        style: { fill: null, stroke: e.color, lineWidth: 0.06, lineDash: [0.2, 0.15] },
      }),
      atlasPaint('polygon', {
        points: [
          { x: at.x, y: at.y - 0.4 },
          { x: at.x + 0.4, y: at.y + 0.3 },
          { x: at.x - 0.4, y: at.y + 0.3 },
        ],
        style: { fill: e.color },
      }),
    );
  else if (['barrel', 'pillar', 'urn', 'firepit', 'rock'].includes(e.variant))
    g.append(
      atlasPaint('ellipse', {
        x: at.x,
        y: at.y,
        radiusX: e.width / 2,
        radiusY: e.height / 2,
        style: { fill: e.color, stroke: '#362f28', lineWidth: 0.06 },
      }),
    );
  else {
    const x = at.x - e.width / 2,
      y = at.y - e.height / 2,
      body = atlasPaint('group', { matrix: rotation((e.angle * Math.PI) / 180, at.x, at.y) });
    body.append(
      atlasPaint('rect', {
        x: x,
        y: y,
        width: e.width,
        height: e.height,
        radiusX: 0.08,
        style: { fill: e.color, stroke: '#362f28', lineWidth: 0.06 },
      }),
      atlasPaint('line', {
        x,
        y: at.y,
        x2: x + e.width,
        y2: at.y,
        style: { stroke: '#362f28', lineWidth: 0.05 },
      }),
    );
    if (e.variant === 'shelf' || e.variant === 'rack')
      for (let i = 1; i < 4; i++)
        body.append(
          atlasPaint('line', {
            x: x + (e.width * i) / 4,
            y: y + 0.08,
            x2: x + (e.width * i) / 4,
            y2: y + e.height - 0.08,
            style: { stroke: '#d9c6a4', lineWidth: 0.07 },
          }),
        );
    if (e.variant === 'crate' || e.variant === 'sarcophagus')
      body.append(
        atlasPaint('line', {
          x: x + 0.12,
          y: y + 0.12,
          x2: x + e.width - 0.12,
          y2: y + e.height - 0.12,
          style: { stroke: '#ded1b1', lineWidth: 0.08 },
        }),
        atlasPaint('line', {
          x: x + 0.12,
          y: y + e.height - 0.12,
          x2: x + e.width - 0.12,
          y2: y + 0.12,
          style: { stroke: '#ded1b1', lineWidth: 0.08 },
        }),
      );
    if (e.variant === 'stove')
      for (const dx of [-0.18, 0.18])
        body.append(
          atlasPaint('circle', {
            x: at.x + dx,
            y: at.y,
            radius: 0.12,
            style: { fill: '#443b32', stroke: '#c3b09b', lineWidth: 0.03 },
          }),
        );
    if (e.variant === 'altar')
      body.append(
        atlasPaint('circle', {
          x: at.x,
          y: at.y,
          radius: 0.18,
          style: { fill: '#dbcda5', stroke: '#645c53', lineWidth: 0.04 },
        }),
      );
    if (e.variant === 'chair' || e.variant === 'bench')
      body.append(
        atlasPaint('rect', {
          x: x + 0.04,
          y: y + 0.03,
          width: e.width - 0.08,
          height: 0.12,
          style: { fill: '#4d382b' },
        }),
      );
    if (e.variant === 'bed' || e.variant === 'bedroll')
      body.append(
        atlasPaint('rect', {
          x: x + 0.1,
          y: y + 0.1,
          width: Math.max(0.1, e.width - 0.2),
          height: Math.max(0.1, e.height * 0.2),
          style: { fill: '#ded1b1' },
        }),
      );
    g.append(body);
  }
  return g;
}
export function elementSvg(
  e: DrawingElementGeometry,
  rooms: RoomGeometry[],
  elements: DrawingElementGeometry[] = [],
) {
  return paintMarkup(elementPaint(e, rooms, elements));
}
export function dungeonSvg(
  rooms: RoomGeometry[],
  view: DrawingView,
  scopeId: string,
  floorId: string,
  publicOnly: boolean,
) {
  const styles = new Map(view.styles.map((s) => [s.id, s])),
    rs = rooms.filter(
      (r) =>
        r.scopeId === scopeId &&
        r.floorId === floorId &&
        (!publicOnly || !styles.get(r.id)?.secret),
    ),
    visibleRooms = new Set(rs.map((r) => r.id)),
    elements = view.elements.filter(
      (e) =>
        e.scopeId === scopeId &&
        e.floorId === floorId &&
        !e.archived &&
        (!e.roomId || visibleRooms.has(e.roomId)) &&
        (!e.anchor || visibleRooms.has(e.anchor.roomId)) &&
        (!publicOnly ||
          (!e.secret && e.kind !== 'feature' && (!e.roomId || rs.some((r) => r.id === e.roomId)))),
    ),
    points = [
      ...rs.flatMap((r) => r.polygons.flatMap((p) => p.outer)),
      ...elements.flatMap((e) => e.points),
    ];
  let minX = 0,
    minY = 0,
    maxX = 20,
    maxY = 15;
  if (points.length) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - 1} ${minY - 1} ${Math.max(2, maxX - minX + 2)} ${Math.max(2, maxY - minY + 2)}"><rect x="${minX - 1}" y="${minY - 1}" width="${Math.max(2, maxX - minX + 2)}" height="${Math.max(2, maxY - minY + 2)}" fill="#eee7d7"/>`;
  for (const r of rs) {
    const style = styles.get(r.id),
      point = r.polygons[0]?.outer[0];
    svg += `<path d="${roomPath(r.polygons)}" fill="${escape(style?.fill ?? '#d8cbb5')}" fill-rule="evenodd" stroke="${escape(style?.wall ?? '#574b3f')}" stroke-width="0.15"/>`;
    const label = publicOnly ? (style?.publicLabel ?? '') : r.number + '. ' + r.name;
    if (point && label)
      svg += `<text x="${point.x + 0.3}" y="${point.y + 0.7}" font-size="0.5" fill="#2c302f">${escape(label)}</text>`;
  }
  for (const e of elements) svg += elementSvg(e, rs, elements);
  return svg + '</svg>';
}

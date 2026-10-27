import { inside } from './drawing-model';
import type { SpatialGeometry } from './dungeon-contracts';
import { directions, resolvePathAnchor } from './path-anchor';
import type {
  BoundaryFace,
  DungeonPath,
  PathAnchor,
  PathPoint,
  PathPreview,
  PathSegment,
} from './path-contracts';
import { validateDungeonPath } from './path-contracts';
import { spatialObstacle } from './spatial-3d';
import type { DungeonVolume, VolumeColumn } from './volume-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
import { volumeOrigin } from './volume-model';
const key = (p: { x: number; y: number; z: number }) => p.x + ',' + p.y + ',' + p.z;
export function proposePathAnchor(
  g: SpatialGeometry,
  roomId: string,
  toward: PathPoint,
  form: PathSegment['form'],
): PathAnchor {
  const v = g.drawing.volumes?.find((v) => v.roomId === roomId);
  if (!v || !v.columns.length) throw new Error('Endräume zuerst als Volumen übernehmen.');
  const o = volumeOrigin(v),
    base = g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0;
  const index = new Map(v.columns.map((c) => [c.x + ',' + c.y, c]));
  const faces: BoundaryFace[] = ['north', 'east', 'south', 'west'];
  if (['shaft', 'ladder'].includes(form)) faces.push('up', 'down');
  let chosen: {
    p: { x: number; y: number; z: number };
    face: BoundaryFace;
    distance: number;
  } | null = null;
  for (const c of v.columns)
    for (const s of c.spans)
      for (const face of faces) {
        const d = directions[face],
          z = face === 'up' ? s.z + s.height - 1 : s.z;
        if (
          d.z === 0 &&
          index
            .get(c.x + d.x + ',' + (c.y + d.y))
            ?.spans.some((t) => z >= t.z && z < t.z + t.height)
        )
          continue;
        const p = { x: c.x, y: c.y, z },
          world = {
            x: (p.x + 0.5 + d.x * 0.5) * U,
            y: (p.y + 0.5 + d.y * 0.5) * U,
            z: base + (p.z + (d.z > 0 ? 1 : 0)) * U,
          };
        const distance = Math.hypot(world.x - toward.x, world.y - toward.y, world.z - toward.z);
        if (!chosen || distance < chosen.distance) chosen = { p, face, distance };
      }
  if (!chosen) throw new Error('Volumen hat keine verankerbare Grenzfläche.');
  return {
    roomId,
    volumeId: v.id,
    pinned: false,
    local: { x: chosen.p.x - o.x, y: chosen.p.y - o.y, z: chosen.p.z - o.z, face: chosen.face },
  };
}
class Heap {
  a: { key: string; score: number }[] = [];
  push(v: { key: string; score: number }) {
    let i = this.a.push(v) - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p]!.score <= v.score) break;
      this.a[i] = this.a[p]!;
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop();
    if (!this.a.length) return first;
    if (last) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1]!.score < this.a[c]!.score) c++;
        if (this.a[c]!.score >= last.score) break;
        this.a[i] = this.a[c]!;
        i = c;
      }
      this.a[i] = last;
    }
    return first;
  }
}
export function buildPath(g: SpatialGeometry, input: DungeonPath, basis: string): PathPreview {
  validateDungeonPath(input);
  const path = structuredClone(input);
  const av = g.drawing.volumes?.find((v) => v.roomId === path.from.roomId),
    bv = g.drawing.volumes?.find((v) => v.roomId === path.to.roomId);
  if (!av || !bv || av.scopeId !== bv.scopeId || av.scopeId !== path.scopeId)
    throw new Error('Endräume benötigen Volumen derselben Dungeonzeichnung.');
  const center = (v: DungeonVolume) => {
    const o = volumeOrigin(v),
      base = g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0;
    return {
      x: (o.x + v.columns.reduce((n, c) => n + c.x - o.x, 0) / v.columns.length + 0.5) * U,
      y: (o.y + v.columns.reduce((n, c) => n + c.y - o.y, 0) / v.columns.length + 0.5) * U,
      z: base + o.z * U,
    };
  };
  if (!path.from.pinned || !path.from.local) {
    const a = proposePathAnchor(
      g,
      av.roomId,
      path.waypoints[0] ?? center(bv),
      path.segments[0]!.form,
    );
    a.pinned = path.from.pinned;
    path.from = a;
  }
  if (!path.to.pinned || !path.to.local) {
    const a = proposePathAnchor(
      g,
      bv.roomId,
      path.waypoints.at(-1) ?? center(av),
      path.segments.at(-1)!.form,
    );
    a.pinned = path.to.pinned;
    path.to = a;
  }
  const from = resolvePathAnchor(g, path.from),
    to = resolvePathAnchor(g, path.to),
    base = from.base,
    roundZ = (n: number) => {
      const z = (n - base) / U;
      if (Math.abs(z - Math.round(z)) > 1e-5)
        throw new Error('Endhöhen und Wegpunkte müssen zum 5-Fuß-Raster passen.');
      return Math.round(z);
    },
    end = { ...to.outside, z: roundZ(to.base + to.outside.z * U) },
    points = [
      from.outside,
      ...path.waypoints.map((p) => ({
        x: Math.floor(p.x / U),
        y: Math.floor(p.y / U),
        z: roundZ(p.z),
      })),
      end,
    ];
  const occupied = new Map<string, { from: number; to: number; roomId: string }[]>();
  for (const v of g.drawing.volumes ?? []) {
    if (
      v.scopeId !== path.scopeId ||
      v.id === path.volumeId ||
      !g.rooms.some((r) => r.id === v.roomId)
    )
      continue;
    const elevation =
      g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0;
    for (const c of v.columns) {
      const k = c.x + ',' + c.y,
        list = occupied.get(k) ?? [];
      for (const s of c.spans)
        list.push({
          from: roundZ(elevation + s.z * U),
          to: roundZ(elevation + (s.z + s.height) * U),
          roomId: v.roomId,
        });
      occupied.set(k, list);
    }
  }
  const footprint = (p: typeof end, s: PathSegment, dx: number, dy: number) => {
    const out: { x: number; y: number; z: number }[] = [],
      begin = -Math.floor((s.widthSteps - 1) / 2);
    if (['shaft', 'ladder'].includes(s.form) || (!dx && !dy)) {
      for (let x = begin; x < begin + s.widthSteps; x++)
        for (let y = begin; y < begin + s.widthSteps; y++)
          out.push({ x: p.x + x, y: p.y + y, z: p.z });
    } else
      for (let i = begin; i < begin + s.widthSteps; i++)
        out.push({ x: p.x + (dy ? i : 0), y: p.y + (dx ? i : 0), z: p.z });
    return out;
  };
  const legacy = g.rooms.filter(
    (r) =>
      r.scopeId === path.scopeId &&
      r.id !== path.roomId &&
      !g.drawing.volumes?.some((v) => v.roomId === r.id),
  );
  const free = (p: typeof end, s: PathSegment, dx: number, dy: number) =>
    footprint(p, s, dx, dy).every(
      (c) =>
        !legacy.some((r) => {
          const floor =
              g.floors.find((f) => f.id === r.floorId && f.scopeId === r.scopeId)?.elevation ?? 0,
            height = g.drawing.styles.find((t) => t.id === r.id)?.ceilingMeters ?? 3.048;
          return (
            Math.max(base + c.z * U, floor) <
              Math.min(base + (c.z + s.heightSteps) * U, floor + height) &&
            inside({ x: (c.x + 0.5) * U, y: (c.y + 0.5) * U }, r.polygons)
          );
        }) &&
        !Array.from({ length: s.heightSteps }, (_, z) => base + (c.z + z + 0.5) * U).some((z) =>
          spatialObstacle(
            g,
            { x: (c.x + 0.5) * U, y: (c.y + 0.5) * U, z, scopeId: path.scopeId },
            'move',
          ),
        ) &&
        !(occupied.get(c.x + ',' + c.y) ?? []).some(
          (o) =>
            Math.max(c.z, o.from) < Math.min(c.z + s.heightSteps, o.to) &&
            !(
              ['shaft', 'ladder'].includes(s.form) &&
              (o.roomId === av.roomId || o.roomId === bv.roomId) &&
              ((c.x === from.outside.x && c.y === from.outside.y) ||
                (c.x === end.x && c.y === end.y))
            ),
        ),
    );
  const route: DungeonPath['route'] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const start = points[segment]!,
      target = points[segment + 1]!,
      spec = path.segments[segment]!;
    if (spec.form === 'corridor' && start.z !== target.z)
      throw new Error(
        'Korridorsegmente bleiben auf einer Höhe; Treppe, Rampe, Leiter oder Schacht wählen.',
      );
    if (
      !free(start, spec, target.x - start.x, target.y - start.y) ||
      !free(target, spec, target.x - start.x, target.y - start.y)
    )
      throw new Error('Querschnitt überlappt vorhandene Geometrie am Endpunkt.');
    const first = key(start),
      goal = key(target),
      heap = new Heap(),
      nodes = new Map([[first, start]]),
      cost = new Map([[first, 0]]),
      parent = new Map<string, string>(),
      closed = new Set<string>(),
      heuristic = (p: typeof start) =>
        Math.abs(p.x - target.x) + Math.abs(p.y - target.y) + Math.abs(p.z - target.z);
    heap.push({ key: first, score: heuristic(start) });
    let found = false;
    while (heap.a.length && closed.size < 20000) {
      const k = heap.pop()!.key;
      if (closed.has(k)) continue;
      const p = nodes.get(k)!;
      if (k === goal) {
        found = true;
        break;
      }
      closed.add(k);
      let neighbors: { x: number; y: number; z: number }[] = [];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (const dz of ['stairs', 'ramp'].includes(spec.form) ? [-1, 0, 1] : [0])
          neighbors.push({ x: p.x + dx!, y: p.y + dy!, z: p.z + dz });
      if (['shaft', 'ladder'].includes(spec.form))
        neighbors.push({ ...p, z: p.z + 1 }, { ...p, z: p.z - 1 });
      for (const n of neighbors) {
        const nk = key(n);
        if (
          closed.has(nk) ||
          !free(n, spec, n.x - p.x, n.y - p.y) ||
          Math.abs(n.x - start.x) + Math.abs(n.y - start.y) + Math.abs(n.z - start.z) >
            heuristic(start) + 64
        )
          continue;
        const next = cost.get(k)! + Math.hypot(n.x - p.x, n.y - p.y, n.z - p.z);
        if (next < (cost.get(nk) ?? Infinity)) {
          nodes.set(nk, n);
          cost.set(nk, next);
          parent.set(nk, k);
          heap.push({ key: nk, score: next + heuristic(n) });
        }
      }
    }
    if (!found)
      throw new Error(
        'Kein freier Pfad für diesen Querschnitt. Wegpunkte, Formen oder Breite ändern.',
      );
    const cells = [target];
    let k = goal;
    while (k !== first) {
      k = parent.get(k)!;
      cells.unshift(nodes.get(k)!);
    }
    for (const p of cells.slice(segment ? 1 : 0))
      route.push({ ...p, form: spec.form, factor: spec.factor, segmentIndex: segment });
  }
  if (route.length > 5000)
    throw new Error('Pfad durch nähere Endpunkte oder zusätzliche Verbindungen verkleinern.');
  const columns = new Map<string, VolumeColumn>();
  for (let i = 0; i < route.length; i++) {
    const p = route[i]!,
      next = route[i + 1] ?? route[i - 1] ?? p,
      spec = path.segments[p.segmentIndex]!;
    for (const c of footprint(p, spec, next.x - p.x, next.y - p.y)) {
      const k = c.x + ',' + c.y,
        column = columns.get(k) ?? { x: c.x, y: c.y, spans: [] };
      const old = column.spans[0];
      if (!old)
        column.spans.push({
          z: c.z,
          height: spec.heightSteps,
          floor: true,
          ceiling: true,
          medium: path.medium,
        });
      else {
        const min = Math.min(old.z, c.z),
          max = Math.max(old.z + old.height, c.z + spec.heightSteps);
        old.z = min;
        old.height = max - min;
      }
      columns.set(k, column);
    }
  }
  if (columns.size > 20000)
    throw new Error('Materialisiertes Volumen ist zu groß. Pfad verkleinern.');
  const volume: DungeonVolume = {
    id: path.volumeId ?? path.id,
    revision: 0,
    scopeId: path.scopeId,
    roomId: path.roomId ?? path.id,
    floorId: av.floorId,
    columns: [...columns.values()],
    faces: {},
  };
  path.route = route;
  path.basis = basis;
  let distanceMeters = 0;
  for (let i = 1; i < route.length; i++)
    distanceMeters +=
      Math.hypot(
        route[i]!.x - route[i - 1]!.x,
        route[i]!.y - route[i - 1]!.y,
        route[i]!.z - route[i - 1]!.z,
      ) * U;
  return {
    path,
    volume,
    basis,
    fromWorld: from.world,
    toWorld: to.world,
    distanceMeters,
    warnings: [],
  };
}

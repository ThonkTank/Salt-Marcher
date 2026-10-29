import { type TerrainView } from './terrain-view-contracts';
import { type TerrainGrid } from './terrain-grid-contracts';
import { atlasWorldTileBounds } from './atlas-world-tiles';
import { validateTerrainSurfaceLayout } from './terrain-surface-layout';
import { atlasTerrainRay } from './atlas-terrain-ray';
import { atlasCameraWorldEye, atlasCameraClipRange } from './atlas-camera';
import { terrainHorizon } from './terrain-coverage';
import { atlasCameraEye, atlasProject } from './atlas-camera';
import { TerrainSampler } from './terrain-height';
import type { LandscapeBox } from './landscape-bounds';
import type { LandscapeRecord } from './landscape-contracts';
import type { Point } from '../shared/contracts';
import { gridHeight } from './terrain-grid-geometry';
export { gridHeight } from './terrain-grid-geometry';
import { terrainGridLayout, terrainGridCoordinate } from './terrain-grid-layout';
export function validateTerrainView(v: TerrainView) {
  if (
    !v ||
    !v.box ||
    !v.frame ||
    ![v.box, v.frame].every(
      (b) =>
        [b.x, b.y, b.width, b.height].every(Number.isFinite) &&
        b.width > 0 &&
        b.height > 0 &&
        Math.max(Math.abs(b.x), Math.abs(b.y), Math.abs(b.x + b.width), Math.abs(b.y + b.height)) <=
          1e12,
    ) ||
    !Number.isInteger(v.columns) ||
    !Number.isInteger(v.rows) ||
    v.columns < 2 ||
    v.rows < 2 ||
    v.columns > 257 ||
    v.rows > 257 ||
    v.columns * v.rows > 66049 ||
    !Number.isFinite(v.focusM) ||
    Math.abs(v.focusM) > 1e6 ||
    !Number.isFinite(v.tilt) ||
    v.tilt < 0 ||
    v.tilt > 75 ||
    !Number.isFinite(v.rotation) ||
    Math.abs(v.rotation) > 360 ||
    !Number.isFinite(v.exaggeration) ||
    v.exaggeration < 0.25 ||
    v.exaggeration > 8 ||
    (v.projection !== undefined && v.projection !== 'perspective') ||
    Object.keys(v).some(
      (k) =>
        ![
          'box',
          'frame',
          'columns',
          'rows',
          'focusM',
          'tilt',
          'rotation',
          'exaggeration',
          'projection',
          'refinement',
          'surface',
        ].includes(k),
    )
  )
    throw Error('Räumlichen Geländeausschnitt prüfen.');
  if (v.surface !== undefined) validateTerrainSurfaceLayout(v, v.surface);
  const r = v.refinement,
    b = v.box;
  if (
    r !== undefined &&
    (!r ||
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x <= b.x ||
      r.y <= b.y ||
      r.x + r.width >= b.x + b.width ||
      r.y + r.height >= b.y + b.height ||
      v.columns < 9 ||
      v.rows < 9 ||
      Object.keys(r).some((k) => !['x', 'y', 'width', 'height'].includes(k)))
  )
    throw Error('Geländeverfeinerung prüfen.');
}
export function terrainGrid(records: LandscapeRecord[], view: TerrainView): TerrainGrid {
  validateTerrainView(view);
  const sampler = new TerrainSampler(records),
    heights = new Float32Array(view.columns * view.rows),
    l = terrainGridLayout(view);
  for (let y = 0; y < view.rows; y++)
    for (let x = 0; x < view.columns; x++) {
      const p = { x: l.x.values[x]!, y: l.y.values[y]! },
        h = sampler.sample(p).heightM;
      heights[y * view.columns + x] = Math.max(sampler.waterLevel(p, h) ?? sampler.seaLevelM, h);
    }
  return { view, heights, seaLevelM: sampler.seaLevelM };
}
export function projectTerrain(view: TerrainView, p: Point, heightM: number) {
  const { x, y } = atlasProject(view, p, heightM);
  return { x, y };
}
/** Exact line-of-sight against the displayed triangular grid, including occluders outside the brush.
 * Walk grid/diagonal crossings; heights along each interval are linear, so no narrow peak is skipped. */
export function terrainVisible(g: TerrainGrid, p: Point) {
  return g.view.surface !== undefined ? surfaceVisibility(g)(p) : visibleTerrain(g, p, Infinity);
}
/** Prepare once for an immutable brush snapshot. A ray above the highest
 * vertex cannot meet a later triangle, so distant empty cells need no walk. */
export function terrainVisibility(g: TerrainGrid, outsideSurface: 'reject' | 'clip' = 'reject') {
  if (g.view.surface !== undefined) return surfaceVisibility(g, outsideSurface);
  let ceiling = -Infinity;
  for (const height of g.heights) ceiling = Math.max(ceiling, height);
  return (p: Point) => visibleTerrain(g, p, ceiling);
}
function visibleTerrain(g: TerrainGrid, p: Point, ceiling: number) {
  const v = g.view,
    b = v.box;
  if (p.x < b.x || p.y < b.y || p.x > b.x + b.width || p.y > b.y + b.height) return false;
  const z = gridHeight(g, p),
    screen = atlasProject(v, p, z);
  if (
    (v.projection === 'perspective' &&
      (screen.depth <= 0 || screen.depth >= terrainHorizon(v).far)) ||
    !Number.isFinite(screen.x) ||
    !Number.isFinite(screen.y) ||
    screen.x < 0 ||
    screen.y < 0 ||
    screen.x > 1 ||
    screen.y > 1
  )
    return false;
  if (v.tilt === 0 && !v.projection) return true;
  const a = (v.rotation * Math.PI) / 180,
    l = terrainGridLayout(v);
  let dx = Math.sin(a),
    dy = Math.cos(a),
    rise = 1 / Math.tan((v.tilt * Math.PI) / 180) / v.exaggeration,
    limit = Infinity;
  if (v.projection === 'perspective') {
    const eye = atlasCameraEye(v),
      ex = eye.x - (p.x - v.frame.x - v.frame.width / 2),
      ey = eye.y - (p.y - v.frame.y - v.frame.height / 2);
    limit = Math.hypot(ex, ey);
    if (limit < 1e-12) return true;
    dx = ex / limit;
    dy = ey / limit;
    rise = (v.focusM + eye.z / v.exaggeration - z) / limit;
  }
  let t = 0;
  const epsilon = l.minimumStep * 1e-7;
  for (let n = 0; n < v.columns + v.rows + 4; n++) {
    if (z + rise * t >= ceiling + Math.max(0.0001, Math.abs(z) * 1e-7)) return true;
    const x = p.x + dx * (t + epsilon),
      y = p.y + dy * (t + epsilon);
    if (x < b.x || y < b.y || x >= b.x + b.width || y >= b.y + b.height) return true;
    const ix = Math.min(v.columns - 2, Math.floor(terrainGridCoordinate(l.x, x))),
      iy = Math.min(v.rows - 2, Math.floor(terrainGridCoordinate(l.y, y))),
      ox = l.x.values[ix]!,
      oy = l.y.values[iy]!,
      sx = l.x.values[ix + 1]! - ox,
      sy = l.y.values[iy + 1]! - oy;
    const tx = Math.abs(dx) < 1e-12 ? Infinity : (l.x.values[ix + (dx > 0 ? 1 : 0)]! - p.x) / dx;
    const ty = Math.abs(dy) < 1e-12 ? Infinity : (l.y.values[iy + (dy > 0 ? 1 : 0)]! - p.y) / dy;
    const end = Math.min(tx, ty, limit),
      denom = dx / sx + dy / sy;
    const diagonal =
      Math.abs(denom) < 1e-12 ? Infinity : (1 - (p.x - ox) / sx - (p.y - oy) / sy) / denom;
    for (const distance of [diagonal, end])
      if (distance > t + epsilon && distance <= end + epsilon) {
        const point = { x: p.x + dx * distance, y: p.y + dy * distance };
        if (gridHeight(g, point) > z + rise * distance + Math.max(0.0001, Math.abs(z) * 1e-7))
          return false;
      }
    if (!Number.isFinite(end) || end <= t || end >= limit) return true;
    t = end;
  }
  return false;
}
export function terrainViewBounds(v: TerrainView, other: LandscapeBox) {
  validateTerrainView(v);
  const x = Math.min(v.box.x, other.x),
    y = Math.min(v.box.y, other.y);
  return {
    x,
    y,
    width: Math.max(v.box.x + v.box.width, other.x + other.width) - x,
    height: Math.max(v.box.y + v.box.height, other.y + other.height) - y,
  };
}

export function terrainSourceBounds(v: TerrainView, pad = 0): LandscapeBox {
  validateTerrainView(v);
  if (!Number.isFinite(pad) || pad < 0) throw Error('Geländerand prüfen.');
  return {
    x: v.box.x - pad,
    y: v.box.y - pad,
    width: v.box.width + 2 * pad,
    height: v.box.height + 2 * pad,
  };
}

/** First hit against the same immutable partition used by picking. Author
 * points use its surface height even when author nodes are more detailed. */
function surfaceVisibility(g: TerrainGrid, outsideSurface: 'reject' | 'clip' = 'reject') {
  const v = g.view;
  validateTerrainView(v);
  if (!g.surface || g.surface.length !== v.surface!.tiles.length)
    throw Error('Geländeoberfläche noch nicht vollständig geladen.');
  // A screen footprint may extend beyond the displayed partition at a
  // viewport edge. Only a fully present declared mesh can certify that such
  // nodes have no displayed triangle; missing members must never become sky.
  if (outsideSurface === 'clip') {
    const boxes = new Set(
      g.surface.map(({ view: { box: b } }) => [b.x, b.y, b.width, b.height].join(':')),
    );
    for (const tile of v.surface!.tiles) {
      const b = atlasWorldTileBounds(tile);
      if (!boxes.has([b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY].join(':')))
        throw Error('Geländeoberfläche noch nicht vollständig geladen.');
    }
    for (const grid of g.surface)
      if (
        grid.heights.length !== grid.view.columns * grid.view.rows ||
        !grid.heights.every(Number.isFinite)
      )
        throw Error('Geländeoberfläche noch nicht vollständig geladen.');
  }
  const grids = g.surface.map((grid) => {
    const b = grid.view.box;
    let low = Infinity,
      high = -Infinity;
    for (const h of grid.heights) {
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    return { grid, b, low, high };
  });
  const eye = atlasCameraWorldEye(v),
    clip = atlasCameraClipRange(v);
  return (p: Point) => {
    let z = -Infinity;
    for (const { grid, b } of grids)
      if (p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height)
        z = Math.max(z, gridHeight(grid, p));
    if (z === -Infinity) {
      if (outsideSurface === 'clip') return false;
      throw Error('Geländeoberfläche am Pinsel noch nicht vollständig geladen.');
    }
    const screen = atlasProject(v, p, z);
    if (
      screen.depth < clip.near ||
      screen.depth > clip.far ||
      !Number.isFinite(screen.x) ||
      !Number.isFinite(screen.y) ||
      screen.x < 0 ||
      screen.x > 1 ||
      screen.y < 0 ||
      screen.y > 1
    )
      return false;
    const start = clip.near / screen.depth;
    const rayEye = {
      x: eye.x + (p.x - eye.x) * start,
      y: eye.y + (p.y - eye.y) * start,
      heightM: eye.heightM + (z - eye.heightM) * start,
    };
    const segment = [
      [rayEye.x, rayEye.y, rayEye.heightM],
      [p.x, p.y, z],
    ] as const;
    const minX = Math.min(rayEye.x, p.x),
      maxX = Math.max(rayEye.x, p.x),
      minY = Math.min(rayEye.y, p.y),
      maxY = Math.max(rayEye.y, p.y),
      minZ = Math.min(rayEye.heightM, z),
      maxZ = Math.max(rayEye.heightM, z);
    for (const { grid, b, low, high } of grids) {
      if (
        minZ > high ||
        maxZ < low ||
        minX > b.x + b.width ||
        maxX < b.x ||
        minY > b.y + b.height ||
        maxY < b.y
      )
        continue;
      let near = 0,
        far = 1;
      for (const [start, end, min, max] of [
        [rayEye.x, p.x, b.x, b.x + b.width],
        [rayEye.y, p.y, b.y, b.y + b.height],
        [rayEye.heightM, z, low, high],
      ]) {
        const delta = end! - start!;
        if (!delta) {
          if (start! < min! || start! > max!) {
            near = 1;
            far = 0;
            break;
          }
          continue;
        }
        const a = (min! - start!) / delta,
          c = (max! - start!) / delta;
        near = Math.max(near, Math.min(a, c));
        far = Math.min(far, Math.max(a, c));
      }
      if (near > far) continue;
      const hit = atlasTerrainRay(grid, segment);
      // Use the existing ray kernel's mesh-boundary precision (1e-8 m),
      // not a relief-height allowance. Adjacent triangles may share the endpoint.
      if (
        hit &&
        hit.segmentFraction < 1 &&
        Math.hypot(hit.point.x - p.x, hit.point.y - p.y, hit.point.heightM - z) > 1e-8
      )
        return false;
    }
    return true;
  };
}

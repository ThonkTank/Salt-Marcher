import { terrainHorizon } from './terrain-coverage';
import { atlasCameraEye, atlasProject, type AtlasCameraPose } from './atlas-camera';
import { TerrainSampler } from './terrain-height';
import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
import type { Point } from '../contracts';
import { terrainGridLayout, terrainGridCoordinate } from './terrain-grid-layout';

/** Frozen view used by both the visible mesh and canonical brush clipping. */
export interface TerrainView extends AtlasCameraPose {
  box: LandscapeBox;
  frame: LandscapeBox;
  columns: number;
  rows: number;
  refinement?: LandscapeBox;
  focusM: number;
  tilt: number;
  rotation: number;
  exaggeration: number;
}
export interface TerrainGrid {
  view: TerrainView;
  heights: Float32Array;
  seaLevelM: number;
  editing?: { ground: Float32Array; water: Float32Array };
}
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
        ].includes(k),
    )
  )
    throw Error('Räumlichen Geländeausschnitt prüfen.');
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
/** Triangular interpolation matches the exact GPU index order, not a bilinear surrogate. */
export function gridHeight(g: TerrainGrid, p: Point) {
  const { view: v, heights: h } = g,
    l = terrainGridLayout(v),
    x = terrainGridCoordinate(l.x, p.x),
    y = terrainGridCoordinate(l.y, p.y),
    ix = Math.min(v.columns - 2, Math.floor(x)),
    iy = Math.min(v.rows - 2, Math.floor(y)),
    u = x - ix,
    w = y - iy,
    i = iy * v.columns + ix;
  return u + w <= 1
    ? h[i]! * (1 - u - w) + h[i + 1]! * u + h[i + v.columns]! * w
    : h[i + v.columns + 1]! * (u + w - 1) + h[i + 1]! * (1 - w) + h[i + v.columns]! * (1 - u);
}
export function projectTerrain(view: TerrainView, p: Point, heightM: number) {
  const { x, y } = atlasProject(view, p, heightM);
  return { x, y };
}
/** Exact line-of-sight against the displayed triangular grid, including occluders outside the brush.
 * Walk grid/diagonal crossings; heights along each interval are linear, so no narrow peak is skipped. */
export function terrainVisible(g: TerrainGrid, p: Point) {
  return visibleTerrain(g, p, Infinity);
}
/** Prepare once for an immutable brush snapshot. A ray above the highest
 * vertex cannot meet a later triangle, so distant empty cells need no walk. */
export function terrainVisibility(g: TerrainGrid) {
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

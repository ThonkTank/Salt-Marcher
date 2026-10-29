import {
  terrainGridLayout,
  terrainGridCoordinate,
  type TerrainLayoutView,
} from './terrain-grid-layout';

export interface TerrainGridGeometry {
  view: TerrainLayoutView;
  heights: Float32Array;
}

/** Triangular interpolation matches the exact GPU index order, not a bilinear surrogate. */
export function gridHeight(g: TerrainGridGeometry, p: { x: number; y: number }) {
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

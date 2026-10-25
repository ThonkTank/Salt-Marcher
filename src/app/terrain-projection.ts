import { validateTerrainDetail } from './terrain-detail';
import { REGION_VECTOR_OBJECTS } from './atlas-region-contracts';
import { validateTerrainView, type TerrainView } from './terrain-spatial-model';
import { validateHeightStroke, type HeightStroke } from './terrain-brush';
import { validateColor } from './landscape-brush';
import {
  validateTerrainAnchor,
  terrainObjectPoints,
  type TerrainObjectSource,
} from './terrain-objects';
import type { TerrainGrid } from './terrain-spatial-model';
import type { LandscapeRecord } from './atlas-landscape';
export interface TerrainProjectionData {
  rasterRouteKey?: string;
  detail?: import('./terrain-detail').TerrainDetail;
  identity?: import('./terrain-frame').TerrainFrameIdentity;
  update?: {
    base: import('./terrain-frame').TerrainFrameIdentity;
    heights: import('./terrain-frame').TerrainRect[];
    pixels: import('./terrain-frame').TerrainRect[];
    forest?: import('./terrain-frame').TerrainRect[];
    detailForest?: import('./terrain-frame').TerrainRect[];
    detail?: import('./terrain-frame').TerrainRect[];
  };
  objects?: import('./terrain-objects').TerrainObject[];
  generation: number;
  source: string;
  grid: TerrainGrid;
  pixels: Uint8Array;
  forest?: Uint8Array;
  width: number;
  height: number;
  draft: boolean;
  routes?: LandscapeRecord[];
  vegetation?: LandscapeRecord[];
  protectedLimit?: number;
  heightM?: number;
  contourInk?: string;
  landColor?: string;
  /** Renderer composition only: confirmed local colour under retained fine tiles. */
  brushDetail?: import('./terrain-detail').TerrainDetail;
}

export interface TerrainProjectionRequest {
  product?: 'height';
  colorBase?: import('./terrain-frame').TerrainIdentity;
  detail?: import('./atlas-landscape').LandscapeBox;
  detailResolution?: number;
  view: TerrainView;
  width: number;
  height: number;
  contours: number;
  displayMpp: number;
  revision: number;
  fence?: string;
  objects?: TerrainObjectSource[];
  heightStroke?: HeightStroke;
  color?: LandscapeRecord;
}
export interface TerrainProjection extends TerrainProjectionData {
  /** Height-only tile: no colour payload is present. */ heightOnly?: true;
  revision: number;
  fence: string;
  colorChange?: import('./terrain-change-history').TerrainColorChange;
}
/** Display-only request: source heights never cross this boundary from the caller. */
export function validateTerrainProjection(q: TerrainProjectionRequest) {
  if (
    !q ||
    (q.product !== undefined && q.product !== 'height') ||
    (q.product === 'height' && (q.color || q.heightStroke || q.detail || q.colorBase))
  )
    throw Error('Geländeansicht prüfen.');
  if (
    q.colorBase &&
    (!Number.isSafeInteger(q.colorBase.revision) ||
      q.colorBase.revision < 0 ||
      typeof q.colorBase.fence !== 'string' ||
      Object.keys(q.colorBase).some((k) => !['revision', 'fence'].includes(k)))
  )
    throw Error('Geländefarbbasis prüfen.');
  validateTerrainView(q.view);
  validateTerrainDetail(q.detail, q.view.box);
  if (
    !Number.isSafeInteger(q.revision) ||
    q.revision < 0 ||
    (q.fence !== undefined && typeof q.fence !== 'string') ||
    ![q.width, q.height].every((n) => Number.isInteger(n) && n >= 16 && n <= 1024) ||
    (q.detailResolution !== undefined &&
      (!q.detail ||
        !Number.isInteger(q.detailResolution) ||
        q.detailResolution < 16 ||
        q.detailResolution > 1024)) ||
    !Number.isFinite(q.contours) ||
    (q.contours < 0 && q.contours !== -1) ||
    q.contours > 100000 ||
    !Number.isFinite(q.displayMpp) ||
    q.displayMpp <= 0 ||
    (q.heightStroke && q.color) ||
    Object.keys(q).some(
      (k) =>
        ![
          'product',
          'colorBase',
          'detail',
          'detailResolution',
          'view',
          'width',
          'height',
          'contours',
          'displayMpp',
          'revision',
          'fence',
          'objects',
          'heightStroke',
          'color',
        ].includes(k),
    )
  )
    throw Error('Geländeansicht prüfen.');
  if (q.heightStroke) validateHeightStroke(q.heightStroke);
  if (q.color) validateColor(q.color);
  if (q.objects !== undefined) {
    if (!Array.isArray(q.objects) || q.objects.length > REGION_VECTOR_OBJECTS)
      throw Error('Zu viele Baukörper für diese Ansicht.');
    let points = 0;
    for (const o of q.objects) {
      if (!o || !o.binding) throw Error('Baukörper prüfen.');
      validateTerrainAnchor(o.binding);
      if (
        o.footprint !== undefined &&
        (!Array.isArray(o.footprint) ||
          o.footprint.some(
            (p) =>
              !p ||
              !Array.isArray(p.outer) ||
              p.outer.length < 3 ||
              !Array.isArray(p.holes) ||
              p.holes.some((r) => !Array.isArray(r) || r.length < 3),
          ))
      )
        throw Error('Baukörpergrundriss prüfen.');
      if (
        (o.closed !== undefined && typeof o.closed !== 'boolean') ||
        (o.scopeId !== undefined && typeof o.scopeId !== 'string')
      )
        throw Error('Baukörperansicht prüfen.');
      if (
        !['building', 'entrance'].includes(o.kind) ||
        typeof o.id !== 'string' ||
        typeof o.name !== 'string' ||
        !Array.isArray(o.outline) ||
        !Array.isArray(o.floorElevations) ||
        ![o.wallM, o.roofM, ...o.floorElevations].every(
          (z) => Number.isFinite(z) && Math.abs(z) <= 100000,
        ) ||
        o.wallM < 0 ||
        o.roofM < 0 ||
        typeof o.color !== 'string' ||
        !terrainObjectPoints(o).every(
          (p) =>
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            Math.max(Math.abs(p.x), Math.abs(p.y)) <= 1e12,
        )
      )
        throw Error('Baukörper prüfen.');
      points += terrainObjectPoints(o).length + o.floorElevations.length;
      if (points > 100000) throw Error('Zu viele Baukörperpunkte.');
    }
  }
  if (JSON.stringify(q).length > 2 * 1024 * 1024) throw Error('Geländeauftrag zu groß.');
}

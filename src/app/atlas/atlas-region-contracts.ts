import {
  type AtlasRegionQuery,
  type AtlasHitPage,
  type AtlasRegionView,
  type AtlasObjectFocus,
  type AtlasCitySite,
} from './atlas-region-view-contracts';

import type { Point } from '../shared/contracts';

import type { DrawingMapView } from './drawing-view-contracts';

export interface AtlasRegionAPI {
  atlasGeometryTile(
    token: string,
    request: import('./atlas-geometry-tile').AtlasGeometryTileRequest,
  ): Promise<
    import('../shared/contracts').Result<import('./atlas-geometry-tile').AtlasGeometryTile>
  >;
  atlasCancelRead(
    token: string,
    control: import('./atlas-read-request').AtlasReadRequest,
  ): Promise<import('../shared/contracts').Result<void>>;
  atlasTerrainTile(
    token: string,
    request: import('./atlas-terrain-tile').AtlasTerrainTileRequest,
    control?: import('./atlas-read-request').AtlasReadRequest,
  ): Promise<import('../shared/contracts').Result<import('./atlas-terrain-tile').AtlasTerrainTile>>;
  atlasMaterialTile(
    token: string,
    request: import('./atlas-material-tile').AtlasMaterialTileRequest,
    control?: import('./atlas-read-request').AtlasReadRequest,
  ): Promise<
    import('../shared/contracts').Result<import('./atlas-material-tile').AtlasMaterialTile>
  >;
  /** Cheap terrain bootstrap; no object index or geometry response is implied. */
  atlasTerrainSource(
    token: string,
    base?: import('./terrain-source').TerrainIdentity,
  ): Promise<
    import('../shared/contracts').Result<{
      revision: number;
      fence: string;
      change?: import('./terrain-source').TerrainSourceChange;
    }>
  >;
  atlasRegion(
    token: string,
    query: AtlasRegionQuery,
    consumer?: 'view' | 'export',
  ): Promise<import('../shared/contracts').Result<AtlasRegionView>>;
  atlasObjectFocus(
    token: string,
    kind: 'room' | 'city' | 'building' | 'element' | 'scope',
    id: string,
  ): Promise<import('../shared/contracts').Result<AtlasObjectFocus>>;
  atlasRegionCandidates(
    token: string,
    query: AtlasRegionQuery,
    point: Point,
    fence: string,
    offset?: number,
    layer?: 'geometry' | 'landscape' | 'all',
    visualElementId?: string,
  ): Promise<import('../shared/contracts').Result<AtlasHitPage>>;
  atlasRegionHit(
    token: string,
    query: AtlasRegionQuery,
    point: Point,
    fence: string,
  ): Promise<import('../shared/contracts').Result<AtlasObjectFocus | null>>;
  cancelAtlasRegion(
    token: string,
    consumer?: 'view' | 'export',
  ): Promise<import('../shared/contracts').Result<void>>;
  atlasCitySite(
    token: string,
    cityId: string,
    id?: string,
  ): Promise<import('../shared/contracts').Result<AtlasCitySite>>;
}
export const emptyDrawing = (): DrawingMapView => ({
  elements: [],
  styles: [],
  hiddenRooms: [],
  hiddenFloors: [],
  features: [],
});
export function validateRegion(q: AtlasRegionQuery) {
  if (q?.entranceId !== undefined && (typeof q.entranceId !== 'string' || !q.entranceId))
    throw new Error('Karteneingang prüfen.');
  if (
    !q ||
    (q.terrainRaster !== undefined && typeof q.terrainRaster !== 'boolean') ||
    (q.contours !== undefined &&
      (!Number.isFinite(q.contours) ||
        (q.contours < 0 && q.contours !== -1) ||
        q.contours > 1e6)) ||
    !q.box ||
    ![q.box.x, q.box.y, q.box.width, q.box.height].every(Number.isFinite) ||
    q.box.width <= 0 ||
    q.box.height <= 0 ||
    !Number.isFinite(q.box.x + q.box.width) ||
    !Number.isFinite(q.box.y + q.box.height) ||
    !Number.isSafeInteger(q.width) ||
    !Number.isSafeInteger(q.height) ||
    q.width < 1 ||
    q.height < 1 ||
    q.width > 8192 ||
    q.height > 8192 ||
    (q.scopeId !== null && (typeof q.scopeId !== 'string' || !q.scopeId)) ||
    typeof q.floorId !== 'string' ||
    !q.floorId ||
    (q.slice !== null && !Number.isFinite(q.slice)) ||
    typeof q.roofs !== 'boolean' ||
    (q.perception !== undefined && typeof q.perception !== 'boolean') ||
    (q.references !== undefined && typeof q.references !== 'boolean') ||
    (q.revision !== undefined && (!Number.isSafeInteger(q.revision) || q.revision < 0)) ||
    (q.fence !== undefined && (typeof q.fence !== 'string' || !q.fence))
  )
    throw new Error('Kartenausschnitt prüfen.');
}

/** Structured-clone turns null-prototype records into ordinary objects. */
export const regionValue = <T>(values: Record<string, T> | undefined, id: string): T | undefined =>
  values && Object.hasOwn(values, id) ? values[id] : undefined;

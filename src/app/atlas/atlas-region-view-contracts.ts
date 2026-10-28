import type { Point } from '../shared/contracts';

import type { AtlasRenderView } from './campaign-atlas-view-contracts';

import type { CityHeader, CityUnit } from './city-data-contracts';
import type { LandscapeRecord } from './landscape-contracts';
import type { LandscapeBox } from './landscape-bounds';
import type { AtlasRegionGeometry } from './atlas-region-geometry-contracts';

export interface AtlasRegionQuery {
  box: LandscapeBox;
  width: number;
  height: number;
  scopeId: string | null;
  floorId: string;
  /** False when the consumer projects terrain itself; dense object overlays remain. */
  terrainRaster?: boolean;
  /** Keep a chosen travel entrance available when its geometry leaves the viewport. */
  entranceId?: string;
  slice: number | null;
  roofs: boolean;
  contours?: number;
  perception?: boolean;
  references?: boolean;
  revision?: number;
  fence?: string;
}

export interface AtlasHit extends Omit<AtlasObjectFocus, 'kind'> {
  kind: AtlasObjectFocus['kind'] | 'landscape';
  name: string;
  landscapeKind?: LandscapeRecord['kind'];
}

export interface AtlasHitPage {
  items: AtlasHit[];
  next: number | null;
  fence: string;
  total: number;
  unavailable?: ('geometry' | 'landscape')[];
}

export interface AtlasRegionView extends AtlasRenderView {
  region: Omit<
    AtlasRegionGeometry,
    'rooms' | 'floors' | 'drawing' | 'cities' | 'bindings' | 'scopes'
  >;
}

export interface AtlasObjectFocus {
  kind: 'room' | 'city' | 'building' | 'element' | 'scope' | 'city-unit';
  id: string;
  cityId?: string;
  scopeId?: string;
  floorId?: string;
  point: Point;
  box: LandscapeBox;
  revision: number;
  interiorScopeId?: string;
}

export interface AtlasRegionCursor {
  epoch: string;
  sequence: number;
  shadow?: { epoch: string; sequence: number };
}

export interface AtlasRegionSource {
  /** Durable geometry/landscape input identity, verified in the worker snapshot. */
  shapeVersion?: string;
  /** Geometry-only identity survives terrain-only journal resets. */
  geometryVersion?: string;
  filename: string;
  campaignId: string;
  token: string;
  fence: string;
  revision: number;
  epoch: string;
  sequence: number;
  shadow?: { filename: string; scopeId: string; epoch: string; sequence: number };
  reset: boolean;
  changes: { table: string; id: string; terrainBounds?: LandscapeBox }[];
}

export interface AtlasCitySite {
  header: CityHeader;
  unit: CityUnit | null;
  related: CityUnit[];
  factions: { id: string; name: string }[];
  canUndo: boolean;
  canRedo: boolean;
}

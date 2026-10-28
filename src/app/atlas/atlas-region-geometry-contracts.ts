import { type CityGeometry } from './city-geometry-contracts';
import type { RoomGeometry, WorkspaceGeometry } from '../shared/contracts';
import type { AtlasBinding } from './atlas-binding-contracts';

import type { DrawingMapView } from './drawing-view-contracts';

import type { LandscapeRecord } from './landscape-contracts';
import type { LandscapeBox } from './landscape-bounds';

export interface AtlasLandscapeLayer {
  labels?: import('./atlas-label-source').MapLabelCandidate[];
  seaLevelM?: number;
  terrainStyle?: import('./terrain-relief').TerrainStyle;
  state: 'ready' | 'error';
  records: LandscapeRecord[];
  tiles: import('./landscape-raster').LandscapeRaster[];
  coverage: { complete: boolean; mode: 'detail' | 'raster'; objects: number; references: number };
  error?: string;
}

export interface AtlasRegionGeometry {
  labels?: import('./atlas-label-source').MapLabelCandidate[];
  territoryRaster?: { box: LandscapeBox; width: number; height: number; data: string };
  territories?: import('./atlas-territories').TerritoryState;
  campaignId: string;
  token: string;
  revision: number;
  fence: string;
  box: LandscapeBox;
  slice: number | null;
  scopeId: string | null;
  floorId: string;
  rooms: RoomGeometry[];
  floors: WorkspaceGeometry['floors'];
  drawing: DrawingMapView;
  cities: CityGeometry[];
  bindings: AtlasBinding[];
  scopes: { id: string; name: string }[];
  frames: Record<string, { x: number; y: number; angle: number }>;
  scopeBounds: Record<string, LandscapeBox>;
  interiors: Record<string, string>;
  coverage: {
    complete: boolean;
    mode: 'detail' | 'raster';
    objects: number;
    unreadable: number;
    index: 'rtree' | 'scan';
  };
  landscape?: AtlasLandscapeLayer;
  raster?: { box: LandscapeBox; width: number; height: number; data: string };
}

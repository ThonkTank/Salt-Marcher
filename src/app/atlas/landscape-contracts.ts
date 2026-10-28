import type { AtlasCell } from '../runtime/world-cell-contracts';
import type { Point, Polygon } from '../shared/contracts';

export type LandscapeField =
  | 'terrain'
  | 'elevationM'
  | 'climate'
  | 'road'
  | 'river'
  | 'label'
  | 'faction'
  | 'interrupt'
  | 'access';

/** Source attribution only; canonical heights remain ordinary height records. */
export interface LakeBed {
  tileId: string;
  tile: import('./terrain-height-contracts').HeightTile;
}

export interface LandscapeRecord {
  /** Display importance; absent means automatic. Physical dimensions are unchanged. */
  prominence?: number;
  label?: import('./map-label-style').MapLabelStyle;
  id: string;
  revision: number;
  kind: 'patch' | 'river' | 'road' | 'reference' | 'place' | 'vegetation';
  name: string;
  points: Point[];
  polygons: Polygon[];
  resolution: number;
  width: number;
  values: Partial<Omit<AtlasCell, 'q' | 'r' | 'level'>>;
  order?: number;
  style?: 'path' | 'road' | 'stream' | 'river';
  route?: import('./terrain-route-contracts').TerrainRoute;
  line?: import('./landscape-line-contracts').LandscapeLine;
  paint?: import('./landscape-brush-contracts').LandscapeColor;
  mask?: import('./land-mask-contracts').LandMask;
  maskManaged?: boolean;
  height?: import('./terrain-height-contracts').HeightTile;
  terrainSettings?: import('./terrain-height-contracts').TerrainSettings;
  waterLevelM?: number;
  lakeBed?: LakeBed[];
  propertyOnly?: boolean;
  sourceCell?: { mapId: string; q: number; r: number; level: number };
  surface?: 'land' | 'sea' | 'freshwater';
  vegetation?: import('./vegetation-contracts').VegetationSpec;
  vegetationView?: import('./vegetation-projection-contracts').VegetationProjection;
  locationId?: string;
  assetId?: string;
  imageWidth?: number;
  imageHeight?: number;
  angle?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

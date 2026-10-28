import { type TerrainView } from './terrain-view-contracts';

import { type HeightStroke } from './terrain-brush-contracts';

import { type TerrainObjectSource } from './terrain-object-contracts';
import type { TerrainGrid } from './terrain-grid-contracts';
import type { LandscapeRecord } from './landscape-contracts';

export interface TerrainProjectionData {
  rasterRouteKey?: string;
  detail?: import('./terrain-detail').TerrainDetail;
  identity?: import('./terrain-frame-identity').TerrainFrameIdentity;
  update?: {
    base: import('./terrain-frame-identity').TerrainFrameIdentity;
    heights: import('./terrain-frame-identity').TerrainRect[];
    pixels: import('./terrain-frame-identity').TerrainRect[];
    forest?: import('./terrain-frame-identity').TerrainRect[];
    detailForest?: import('./terrain-frame-identity').TerrainRect[];
    detail?: import('./terrain-frame-identity').TerrainRect[];
  };
  objects?: import('./terrain-object-contracts').TerrainObject[];
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
  editingRadius?: number;
  /** Cursor for an exact, bounded author-source packet. Empty starts a read. */
  editingPage?: string;
  editingBox?: import('./landscape-bounds').LandscapeBox;
  product?: 'height';
  colorBase?: import('./terrain-frame-identity').TerrainIdentity;
  detail?: import('./landscape-bounds').LandscapeBox;
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

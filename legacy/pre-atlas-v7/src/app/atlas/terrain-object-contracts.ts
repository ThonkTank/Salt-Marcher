import type { Point, Polygon } from '../shared/contracts';

/** Values are metres. A ground anchor moves the complete object, never its footprint or floors. */
export interface TerrainAnchor {
  mode: 'ground' | 'fixed';
  offsetM: number;
}

export interface TerrainBuilding extends TerrainAnchor {
  wallM: number;
  roofM: number;
}

export interface TerrainObjectSource {
  kind: 'building' | 'entrance' | 'scope';
  id: string;
  name: string;
  cityId?: string;
  roomId?: string;
  scopeId?: string;
  closed?: boolean;
  footprint?: Polygon[];
  anchor: Point;
  outline: Point[];
  binding: TerrainAnchor;
  wallM: number;
  roofM: number;
  floorElevations: number[];
  color: string;
}

export interface TerrainObject extends TerrainObjectSource {
  baseM: number;
  topM: number;
  groundM: number[];
  floorsM: number[];
  footprintGroundM?: number[][][];
}

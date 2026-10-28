import { type TerrainStyle } from './terrain-relief';

/** Metres, independent of hexes and camera. NaN nodes inherit the coarser field. */
export interface HeightTile {
  version: 1 | 2;
  x: number;
  y: number;
  pixel: number;
  data: string;
}

export interface TerrainSettings {
  version: 1;
  seaLevelM: number;
  style?: TerrainStyle;
}

export interface HeightSample {
  heightM: number;
  resolutionM: number | null;
  revision: number;
}

import type { Point } from '../shared/contracts';

export type LandMode = 'land' | 'land-erase' | 'raise' | 'lower';

export interface MaskSample extends Point {
  t: number;
}

/** Lossless little-endian (run length, uint16 value) pairs. World-aligned, half-open tiles. */
export interface LandMask {
  version: 1;
  x: number;
  y: number;
  pixel: number;
  data: string;
}

export interface MaskStroke {
  mode: LandMode;
  radius: number;
  roughness: number;
  seed: number;
  samples: MaskSample[];
}

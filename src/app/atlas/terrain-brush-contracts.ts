import { type TerrainView } from './terrain-view-contracts';

import { type MaskSample } from './land-mask-contracts';

export type TerrainForm = 'hills' | 'mountains' | 'canyon';

/** Strength is metres per second, feather is the soft fraction of the radius. */
export interface HeightStroke {
  mode: 'raise' | 'lower' | 'roughen' | 'smooth' | 'level';
  form?: TerrainForm;
  /** Missing means protected. Frozen with radius and all other gesture parameters. */
  preserveDetails?: boolean;
  radius: number;
  strength: number;
  feather: number;
  targetM?: number;
  roughness?: number;
  seed?: number;
  samples: MaskSample[];
  visibility?: TerrainView;
}

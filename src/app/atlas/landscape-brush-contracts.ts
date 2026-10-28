import { type TerrainView } from './terrain-view-contracts';

import type { Point } from '../shared/contracts';

export type BrushMode =
  | 'terrain'
  | 'land'
  | 'land-erase'
  | 'raise'
  | 'lower'
  | 'freshwater'
  | 'freshwater-erase'
  | 'ground-color'
  | 'water-color'
  | 'color-erase';

export interface LandscapeColor {
  version: 1 | 2;
  operation?: 'paint' | 'erase';
  fillScope?: 'connected' | 'all';
  target: 'ground' | 'water';
  color: string;
  opacity: number;
  flow: number;
  tip: 'round' | 'soft' | 'textured';
  radius: number;
  seed: number;
  fill: boolean;
  strokes?: Point[][];
  visibility?: TerrainView;
}

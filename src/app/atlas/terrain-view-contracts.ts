import { type AtlasCameraPose } from './atlas-camera';

import type { LandscapeBox } from './landscape-bounds';

/** Frozen view used by both the visible mesh and canonical brush clipping. */
export interface TerrainView extends AtlasCameraPose {
  box: LandscapeBox;
  frame: LandscapeBox;
  columns: number;
  rows: number;
  refinement?: LandscapeBox;
  surface?: import('./terrain-surface-layout').TerrainSurfaceLayout;
  focusM: number;
  tilt: number;
  rotation: number;
  exaggeration: number;
}

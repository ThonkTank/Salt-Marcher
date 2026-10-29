import type { LandscapeBox } from './landscape-bounds';
import type { LandscapeRecord } from './landscape-contracts';
import type { TerrainView } from './terrain-view-contracts';

export interface TerrainGrid {
  view: TerrainView;
  heights: Float32Array;
  /** Canonically sampled grids for the exact displayed partition. */
  surface?: TerrainGrid[];
  seaLevelM: number;
  editing?: {
    ground: Float32Array;
    water: Float32Array;
    author?: TerrainEditingSource;
  };
}

/** Read-only author snapshot. Main remains the sole storage writer. */
export interface TerrainEditingSource {
  /** Only the last packet closes this exact spatial snapshot. */
  complete?: boolean;
  next?: string;
  /** Canonical bounded visibility samples, independent of exact brush records. */
  visibility?: TerrainGrid;
  revision: number;
  fence: string;
  pixel: number;
  radius: number;
  box: LandscapeBox;
  supports?: LandscapeBox[];
  records: LandscapeRecord[];
  /** Local draft tombstones, never a canonical author source. */
  removed?: string[];
}

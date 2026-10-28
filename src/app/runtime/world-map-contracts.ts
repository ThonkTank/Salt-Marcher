import type { Climate } from './world-cell-contracts';
import type { Hex } from './world-cell-contracts';
import type { AtlasCell } from './world-cell-contracts';
import type { MarkerPresentation } from './world-cell-contracts';

export interface AtlasMap {
  id: string;
  revision: number;
  name: string;
  hexMeters: number;
  climate: Climate;
  seed: string;
  metricVersion?: number;
  landscape?: import('../atlas/landscape-contracts').LandscapeRecord[];
  cells: AtlasCell[];
}

export interface AtlasPlace extends Hex {
  mapId: string;
  locationId: string;
  revision: number;
  name: string;
  trashed: boolean;
  presentation?: MarkerPresentation;
  presentationRevision?: number;
}

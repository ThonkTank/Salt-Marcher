import type { Point, Polygon } from '../shared/contracts';
import type { LandscapeField } from './landscape-contracts';
import type { LandscapeRecord } from './landscape-contracts';

export type LandscapeAction =
  | {
      kind: 'landscape-prominence';
      id: string;
      expectedRevision: number;
      prominence: number | null;
    }
  | {
      kind: 'landscape-route';
      record: LandscapeRecord;
      expectedRevision: number | null;
      sourceRevision: number;
    }
  | {
      kind: 'landscape-vegetation-edit';
      polygons: Polygon[];
      mode: 'clear' | 'thin' | 'dense' | 'erase';
    }
  | { kind: 'landscape-terrain-style'; style: import('./terrain-relief').TerrainStyle }
  | { kind: 'landscape-sea-level'; seaLevelM: number }
  | { kind: 'landscape-lake-stroke'; stroke: LakeStroke }
  | { kind: 'landscape-height-stroke'; stroke: import('./terrain-brush-contracts').HeightStroke }
  | { kind: 'landscape-land-stroke'; stroke: import('./land-mask-contracts').MaskStroke }
  | { kind: 'landscape-color-stroke'; record: LandscapeRecord }
  | {
      kind: 'landscape-brush';
      record: LandscapeRecord;
      mode: Exclude<import('./landscape-brush-contracts').BrushMode, 'terrain'>;
      radius: number;
      roughness: number;
      seed: number;
      fill: boolean;
      samples?: import('./land-mask-contracts').MaskSample[];
    }
  | {
      kind: 'landscape-batch';
      remove?: { id: string; expectedRevision: number }[];
      records: {
        record: LandscapeRecord;
        expectedRevision: number | null;
      }[];
    }
  | {
      kind: 'landscape-put';
      record: LandscapeRecord;
      expectedRevision: number | null;
    }
  | {
      kind: 'landscape-remove';
      id: string;
      expectedRevision: number;
    }
  | {
      kind: 'landscape-reset';
      propertyOnly?: boolean;
      polygons: Polygon[];
      field: LandscapeField;
      resolution: number;
    }
  | {
      kind: 'landscape-place';
      point?: Point;
      record: LandscapeRecord;
      document: import('../../features/location/location-schema').LocationDocument;
      expectedLocationRevision: number | null;
      expectedRevision: number | null;
    };

/** Parameters and level are frozen at pointerdown; samples are snapshotted at release. */
export interface LakeStroke {
  mode: 'dig' | 'erase';
  id: string;
  radius: number;
  strength: number;
  feather: number;
  waterLevelM: number;
  samples: import('./land-mask-contracts').MaskSample[];
  visibility?: import('./terrain-brush-contracts').HeightStroke['visibility'];
}

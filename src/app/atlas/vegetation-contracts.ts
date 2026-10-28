import type { Terrain } from '../runtime/world-cell-contracts';
import type { Point, Polygon } from '../shared/contracts';

export const plantAssets = ['oak', 'pine', 'shrub', 'grass', 'rock', 'reed', 'crop'] as const;

export type PlantAsset = (typeof plantAssets)[number];

export interface VegetationPreset {
  id: string;
  name: string;
  terrain: Terrain;
  ground: string;
  tree: 'oak' | 'pine' | 'shrub';
  undergrowthAsset: 'shrub' | 'grass' | 'reed' | 'crop';
  distribution: 'natural' | 'rows';
  groundPattern: 'natural' | 'furrows';
  /** Maximum water depth in metres. Zero requires dry ground. */
  waterDepth: { trees: number; undergrowth: number; rocks: number };
  density: number;
  size: number;
  undergrowth: number;
  rocks: number;
  grouping: number;
  edge: number;
  slope: number;
}

export interface VegetationEdit {
  polygons: Polygon[];
  mode: 'clear' | 'thin' | 'dense';
}

export interface VegetationInstance extends Point {
  id: string;
  asset: PlantAsset;
  size: number;
  angle: number;
  z: number;
  normal: Point & { z: number };
  protected?: boolean;
  conflict?: boolean;
  locationId?: string;
}

export interface VegetationOverride extends Point {
  id: string;
  asset: PlantAsset;
  size: number;
  angle: number;
  removed?: boolean;
  locationId?: string;
}

export interface VegetationSpec {
  version: 1;
  seed: number;
  preset: VegetationPreset;
  layout: 'natural' | 'row';
  spacing: number;
  edits: VegetationEdit[];
  overrides: VegetationOverride[];
}

export interface VegetationView {
  instances: VegetationInstance[];
  mode: 'individual' | 'canopy' | 'surface';
}

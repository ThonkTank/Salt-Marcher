import type { HexAccess } from './hex-access-contracts';

export type Terrain =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'water'
  | 'marsh'
  | 'desert'
  | 'snow';

export type Climate = 'temperate' | 'cold' | 'arid' | 'tropical';

export interface Hex {
  q: number;
  r: number;
}

export interface AtlasCell extends Hex {
  access?: HexAccess;
  level: number;
  terrain: Terrain;
  elevationM: number;
  climate: Climate | null;
  road: boolean;
  river: boolean;
  label: string;
  faction: string;
  interrupt: string;
}

export interface MarkerPresentation {
  title: string;
  symbol: string;
  size: number;
  labelPosition: 'above' | 'below' | 'right' | 'hidden';
  curve: number;
}

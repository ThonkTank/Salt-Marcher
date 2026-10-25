import type { AtlasWorkplane } from './atlas-workplane';
import type { Point } from '../contracts';

export type MapLabelKind = 'place' | 'city' | 'building' | 'room' | 'road' | 'river' | 'area';
export interface MapLabelCandidate {
  id: string;
  objectId?: string;
  workplane?: AtlasWorkplane;
  text: string;
  kind: MapLabelKind;
  point: Point;
  rank: number;
  angle?: number;
  available?: number;
  height?: number;
  /** Physical line readability can be stricter than name prominence. */
  maxMpp?: number;
  locationId?: string;
}

/** Readonly candidates for camera-dependent presentation; never canonical geometry. */
export interface MapLabelSource {
  candidates: MapLabelCandidate[];
  selected?: string;
}

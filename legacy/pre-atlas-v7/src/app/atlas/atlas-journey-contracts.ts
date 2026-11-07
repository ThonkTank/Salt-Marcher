import type { Point } from '../shared/contracts';

export interface AtlasEntrance {
  terrain?: import('./terrain-object-contracts').TerrainAnchor;
  id: string;
  scopeId: string;
  roomId: string;
  floorId: string;
  inside: Point;
  outside: Point;
  revision: number;
}

export interface AtlasLocalPreview {
  sceneId: string;
  basis: string;
  positionRevision: number;
  clockRevision: number;
  membershipRevision: number;
  actorIds: string[];
  route: Point[];
  distanceMeters: number;
  seconds: number;
  speedMetersPerMinute: number;
  destination: Point;
}

export interface AtlasLocalJourney extends AtlasLocalPreview {
  id: string;
  revision: number;
  nextIndex: number;
  status: 'active' | 'paused' | 'arrived' | 'ended';
  elapsedSeconds: number;
  travelledMeters: number;
  reason: string;
}

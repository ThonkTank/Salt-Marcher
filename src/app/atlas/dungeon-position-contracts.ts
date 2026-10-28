import type { DungeonMovement } from './volume-contracts';
import type { Point } from '../shared/contracts';

export interface DungeonPose extends Point {
  scopeId: string;
  floorId: string;
  roomId: string;
  z: number;
  movement?: DungeonMovement;
}

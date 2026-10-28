import type { Point } from '../shared/contracts';
import type { DungeonContent } from './dungeon-budget-contracts';

export type DrawingKind =
  | 'wall'
  | 'door'
  | 'stairs'
  | 'light'
  | 'object'
  | 'path'
  | 'terrain'
  | 'water'
  | 'roof'
  | 'text'
  | 'feature';

export interface DrawingElement {
  content?: DungeonContent;
  id: string;
  revision: number;
  scopeId: string;
  floorId: string;
  roomId: string | null;
  kind: DrawingKind;
  points: Point[];
  name: string;
  notes: string;
  secret: boolean;
  color: string;
  width: number;
  height: number;
  angle: number;
  variant: string;
  blocksSight: boolean;
  blocksSound: boolean;
  passable: boolean;
  state: 'open' | 'closed' | 'locked';
  targetRoomId: string | null;
  targetFloorId: string | null;
  anchor: { roomId: string; polygon: number; edge: number; t: number } | null;
  feature: 'trap' | 'puzzle' | 'curiosity' | 'encounter' | 'loot';
  maxCharges: number;
  resetSeconds: number;
  resetMode: 'empty' | 'used';
  triggerRadius: number;
  triggerHeight: number;
  assetId: string | null;
  zOffsetMeters?: number;
  verticalMeters?: number;
  sound?: { enabled: boolean; rangeMeters: number; dc: number; publicText: string };
  archived: boolean;
}

export interface RoomStyle {
  id: string;
  revision: number;
  scopeId: string;
  ceilingMeters: number;
  fill: string;
  wall: string;
  publicLabel: string;
  secret: boolean;
  trackSurface?: 'stone' | 'mud' | 'sand' | 'snow' | 'water' | 'vegetation';
}

export type DrawingElementGeometry = Omit<DrawingElement, 'notes' | 'content'>;

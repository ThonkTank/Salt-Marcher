import type { Room, Polygon } from './contracts';
export const VOXEL_METERS = 1.524;
export const MAX_VOLUME_COLUMNS = 100000,
  MAX_VOLUME_CELLS = MAX_VOLUME_COLUMNS * 40;
export type DungeonMovement = 'walk' | 'crawl' | 'fly' | 'swim' | 'climb';
export interface VolumeSpan {
  z: number;
  height: number;
  floor: boolean;
  ceiling: boolean;
  medium: 'air' | 'water';
}
export interface VolumeColumn {
  x: number;
  y: number;
  spans: VolumeSpan[];
}
export interface DungeonVolume {
  id: string;
  revision: number;
  scopeId: string;
  roomId: string;
  floorId: string;
  columns: VolumeColumn[];
  faces: Record<string, 'open' | 'solid'>;
}
export interface VolumeCell {
  x: number;
  y: number;
  z: number;
}
export type VolumeAction =
  | {
      kind: 'volume-initialize';
      roomId: string;
      expectedRoomRevision: number;
      expectedVolumeRevision: number | null;
      heightSteps: number;
      medium?: 'air' | 'water';
    }
  | {
      kind: 'volume-edit';
      roomId: string;
      expectedRoomRevision: number;
      expectedVolumeRevision: number | null;
      operation: 'fill' | 'erase' | 'floor' | 'ceiling' | 'wall';
      cells: VolumeCell[];
      enabled: boolean;
      medium: 'air' | 'water';
      side: 'north' | 'east' | 'south' | 'west';
    };
export interface VolumeProjection {
  room: Room;
  polygons: Polygon[];
  volume: DungeonVolume;
}

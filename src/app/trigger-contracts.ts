import type { DungeonPose } from './atlas/dungeon-contracts';
export interface TriggerFragment {
  id: string;
  volumeId: string;
  cells: { x: number; y: number; z: number }[];
  unbound?: boolean;
  orphanedWorld?: { floorId: string; cells: { x: number; y: number; z: number }[] };
}
export interface TriggerField {
  id: string;
  revision: number;
  scopeId: string;
  trapId: string;
  name: string;
  mode: 'interrupt' | 'notify';
  fragments: TriggerFragment[];
  archived: boolean;
}
export type TriggerAction = {
  kind: 'trigger-field';
  field: TriggerField;
  expectedRevision: number | null;
};
export interface TriggerEvent {
  id: string;
  revision: number;
  sceneId: string;
  journeyId: string;
  trapId: string;
  fieldIds: string[];
  fieldNames: string[];
  routeIndex: number;
  pose: DungeonPose;
  instantMs: string;
  mode: 'interrupt' | 'notify';
  status: 'open' | 'dismissed' | 'aborted';
  activated: boolean;
  activatedMs: string | null;
}

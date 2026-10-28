import type { DungeonPose } from '../atlas/dungeon-position-contracts';
import type { TreasureItem } from './treasure-contracts';
export interface ContentState {
  featureId: string;
  revision: number;
  groupId: string | null;
  combatId: string | null;
}
export interface ContentContext {
  id: string;
  revision: number;
  name: string;
  kind: string;
  publicText: string;
  gmNotes: string;
  secret: boolean;
  known: boolean;
  visible: boolean;
  pose: DungeonPose | null;
  groupId: string | null;
  groupRevision: number | null;
  combatId: string | null;
  referenceTitle: string;
  problem: string | null;
  items: TreasureItem[];
  treasureRevision: number | null;
  aliveActors: number;
  search: { method: string; dc: number | null; notes: string; revealedText: string };
  pending: boolean;
  reason: string;
}
export type ContentRuntimeAction =
  | {
      kind: 'content-discovery';
      sceneId: string;
      featureId: string;
      expectedRevision: number;
      known: boolean;
    }
  | { kind: 'content-dismiss'; sceneId: string; featureId: string }
  | { kind: 'content-bind'; sceneId: string; featureId: string; expectedRevision: number }
  | {
      kind: 'content-combat';
      sceneId: string;
      featureId: string;
      expectedRevision: number;
      expectedGroupRevision: number | null;
    }
  | {
      kind: 'content-allocate';
      sceneId: string;
      featureId: string;
      expectedRevision: number;
      treasureRevision: number;
      definitionRevision: number;
      itemId: string;
      quantity: number;
      characterId: string;
      membershipRevision: number;
    };

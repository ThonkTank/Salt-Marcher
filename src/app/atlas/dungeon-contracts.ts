import { type DungeonPose } from './dungeon-position-contracts';
import { type DungeonGeometry } from './dungeon-geometry-contracts';
import {
  type DungeonWaypoint,
  type DungeonRequest,
  type DungeonPreview,
  type DungeonTraceRules,
  type DungeonJourney,
  type DungeonTrace,
  type DungeonSenseView,
} from './dungeon-travel-contracts';
import type { Room, RoomGeometry, Result } from '../shared/contracts';

import type { DrawingElement, DrawingElementGeometry } from './drawing-element-contracts';
export interface DungeonSenseAction {
  mode:
    | 'passive'
    | 'active'
    | 'clear-active'
    | 'force-known'
    | 'force-unknown'
    | 'reevaluate'
    | 'search-tracks';
  subjectId: string | null;
  score: number | null;
  hearingMeters: number;
  trackDcOverride: number | null;
  reason: string;
}
export interface DungeonView<
  R extends RoomGeometry = Room,
  E extends DrawingElementGeometry = DrawingElement,
> extends DungeonGeometry<R, E> {
  activeDungeonName?: string | null;
  travelPace?: {
    settings: import('../runtime/dungeon-pace').DungeonPaceSettings;
    pace: import('../runtime/dungeon-pace').DungeonPace;
    membershipRevision: number;
  };
  keyDiscoveries?: string[];
  contents?: import('../runtime/content-runtime-contracts').ContentContext[];
  contentRecipients?: { id: string; name: string; membershipRevision: number }[];
  triggerEvents?: import('../runtime/trigger-contracts').TriggerEvent[];
  keyDescription?: import('../campaign/key-contracts').KeyRendered;
  keyHeading?: number | null;
  sceneId: string | null;
  sceneTitle: string;
  position: DungeonPose | null;
  positionRevision: number;
  clockRevision: number;
  instantMs: string;
  epochId: string;
  journey: DungeonJourney | null;
  npcs: {
    id: string;
    name: string;
    locationId: string | null;
    revision: number | null;
    pose: DungeonPose | null;
    traceRules: DungeonTraceRules;
    destination: DungeonPose | null;
    path: DungeonWaypoint[];
    paused: boolean;
    pending: string | null;
  }[];
  tracks: DungeonTrace[];
  senses: DungeonSenseView;
  traceRules: DungeonTraceRules;
}
export type DungeonAction =
  | {
      kind: 'round';
      sceneId: string;
      id: string;
      expectedRevision: number;
      expectedSettingsRevision: number;
    }
  | {
      kind: 'pace-settings';
      sceneId: string;
      settings: import('../runtime/dungeon-pace').DungeonPaceSettings;
      expectedMembershipRevision: number;
    }
  | import('../runtime/content-runtime-contracts').ContentRuntimeAction
  | {
      kind: 'trigger-event';
      sceneId: string;
      eventId: string;
      expectedRevision: number;
      operation: 'activate' | 'dismiss' | 'abort' | 'reopen';
    }
  | { kind: 'key-discovery'; sceneId: string; roomId: string; subjectId: string; known: boolean }
  | {
      kind: 'passage-traverse';
      sceneId: string;
      passageId: string;
      expectedRevision: number;
      side: 'outbound' | 'inbound';
      movement: import('./volume-contracts').DungeonMovement;
    }
  | { kind: 'trace-rules'; sceneId: string; actorId: string | null; rules: DungeonTraceRules }
  | {
      kind: 'trace-add';
      sceneId: string;
      from: DungeonPose;
      to: DungeonPose;
      actorId: string | null;
      sourceKnown: boolean;
      publicText: string;
      dc: number;
      strength: number;
    }
  | {
      kind: 'pursue';
      sceneId: string;
      traceId: string;
      score: number;
      direction: 'forward' | 'backward';
      skill: 'perception' | 'survival';
    }
  | {
      kind: 'pursuit-check';
      sceneId: string;
      id: string;
      expectedRevision: number;
      traceId: string | null;
      score: number;
    }
  | { kind: 'senses'; sceneId: string; action: DungeonSenseAction }
  | {
      kind: 'sound';
      sceneId: string;
      pose: DungeonPose;
      publicText: string;
      rangeMeters: number;
      dc: number;
    }
  | { kind: 'track-correct'; id: string; dc: number; hidden: boolean; publicText: string }
  | { kind: 'encounter'; sceneId: string; groupId: string; expectedGroupRevision: number }
  | { kind: 'place'; sceneId: string; expectedPositionRevision: number; pose: DungeonPose | null }
  | { kind: 'journey'; preview: DungeonPreview }
  | { kind: 'step'; sceneId: string; id: string; expectedRevision: number; maxSteps: number }
  | {
      kind: 'state';
      sceneId: string;
      id: string;
      expectedRevision: number;
      status: 'active' | 'paused' | 'ended';
      authorizeFeatureId?: string;
    }
  | { kind: 'npc-place'; actorId: string; expectedRevision: number | null; pose: DungeonPose }
  | { kind: 'reveal'; sceneId: string; roomId: string; known: boolean };
export interface DungeonCommand {
  commandId: string;
  token: string;
  campaignId: string;
  action: DungeonAction;
}
export type DungeonCommandState = { outcome: 'applied' | 'not-applied' | 'conflict' };
export interface DungeonAPI {
  dungeonCommandState(command: DungeonCommand): Promise<Result<DungeonCommandState>>;
  dungeonAuthoring(token: string): Promise<Result<DungeonGeometry>>;
  dungeon(token: string): Promise<Result<DungeonView>>;
  previewDungeon(token: string, request: DungeonRequest): Promise<Result<DungeonPreview>>;
  executeDungeon(command: DungeonCommand): Promise<Result<DungeonView>>;
}

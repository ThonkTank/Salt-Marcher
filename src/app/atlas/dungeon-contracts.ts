import type { DungeonMovement } from './volume-contracts';
import type { Point, Polygon, Room, RoomGeometry, Result } from '../shared/contracts';
import type { DrawingView, DrawingElement, DrawingElementGeometry } from './drawing-contracts';
export type SpatialGeometry = DungeonGeometry<RoomGeometry, DrawingElementGeometry>;
export interface DungeonPose extends Point {
  scopeId: string;
  floorId: string;
  roomId: string;
  z: number;
  movement?: DungeonMovement;
}
export interface DungeonGeometry<
  R extends RoomGeometry = Room,
  E extends DrawingElementGeometry = DrawingElement,
> {
  rooms: R[];
  floors: { id: string; scopeId: string; name: string; elevation: number }[];
  drawing: DrawingView<R, E>;
}
export interface DungeonWaypoint extends DungeonPose {
  portalId?: string;
  passageId?: string;
  additionalSeconds?: number;
  factor?: number;
}
export interface DungeonRequest {
  useGroupPace?: boolean;
  sceneId: string;
  destination: DungeonPose;
  speedMetersPerMinute: number;
  factor: number;
  finalSeconds: number | null;
  movement?: DungeonMovement;
  waypoints?: DungeonPose[];
}
export interface DungeonPreview {
  pace?: import('../runtime/dungeon-pace').DungeonPace;
  paceRevision?: number;
  request: DungeonRequest;
  basis: string;
  positionRevision: number;
  clockRevision: number;
  membershipRevision: number;
  actorIds: string[];
  route: DungeonWaypoint[];
  distanceMeters: number;
  durationSeconds: number;
  segmentSeconds: number[];
}
export interface DungeonPursuit {
  profile: 'dungeon-pursuit-v1';
  direction: 'forward' | 'backward';
  skill: 'perception' | 'survival';
  score: number;
  currentTraceId: string;
  followedTraceIds: string[];
  candidates: string[];
  state: 'following' | 'check' | 'ambiguous' | 'lost';
  reason: string;
  traceBasis: string;
}
export interface DungeonTraceRules {
  generate: boolean;
  movement: 'walk' | 'sneak' | 'run' | 'crawl' | 'swim' | 'fly';
  surface: 'auto' | 'stone' | 'mud' | 'sand' | 'snow' | 'water' | 'vegetation';
  environment: 'dry' | 'rain' | 'wind' | 'snow';
  strength: number;
  dcOverride: number | null;
  lifetimeSeconds: number | null;
  decayPerHour: number | null;
  skill: 'perception' | 'survival';
}
export interface DungeonJourney extends DungeonPreview {
  segmentElapsedSeconds?: number;
  id: string;
  revision: number;
  nextIndex: number;
  status: 'active' | 'paused' | 'decision' | 'arrived' | 'ended';
  triggerEventId?: string | null;
  reason: string;
  featureId: string | null;
  authorizedFeatures: string[];
  pursuit?: DungeonPursuit;
}
export interface DungeonTrace {
  id: string;
  actorId: string | null;
  sceneId: string | null;
  characterIds: string[];
  from: DungeonPose;
  to: DungeonPose;
  instantMs: string;
  epochId: string;
  jobId: string | null;
  dc: number;
  strength: number;
  surface: string;
  movement: string;
  publicText: string;
  profile: string;
  hidden?: boolean;
  path?: DungeonPose[];
  sourceKnown?: boolean;
  decayPerHour?: number;
  lifetimeSeconds?: number;
  environment?: string;
}
export interface DungeonSenseView {
  settings: { activeScore: number | null; hearingMeters: number; trackDcOverride: number | null };
  observations: {
    characterId: string;
    subjectKind: string;
    subjectId: string;
    known: boolean;
    visible: boolean;
    heard: boolean;
    override: string | null;
    publicText?: string;
  }[];
  logs: { id: string; text: string }[];
  groups: { id: string; revision: number; name: string; actorIds: string[]; available: boolean }[];
}
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
export interface DungeonDisplay {
  description?: string;
  position: Point;
  floorLabel: string;
  known: Polygon[];
  visible: Polygon[];
  labels: { point: Point; text: string }[];
  clues?: string[];
  tracks?: { from: Point; to: Point; label: string }[];
  markers: { point: Point; kind: 'door' | 'stairs' | 'npc'; open: boolean; label?: string }[];
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

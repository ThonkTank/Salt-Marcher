import type { DungeonMovement } from './volume-contracts';
import type { Point, Polygon } from '../shared/contracts';

import type { DungeonPose } from './dungeon-position-contracts';

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

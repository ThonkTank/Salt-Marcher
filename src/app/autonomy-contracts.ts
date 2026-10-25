import type { DungeonPose, DungeonWaypoint } from './atlas/dungeon-contracts';
import type { Result } from './contracts';
export type Need = 'hunger' | 'thirst' | 'rest' | 'safety' | 'social';
export interface AutonomyNeed {
  id: string;
  name: string;
  enabled: boolean;
  value: number;
  ratePerHour: number;
  weight: number;
}
export interface AutonomyDungeonTravel {
  jobId: string;
  jobRevision: number;
  snapshotId: string;
  origin: DungeonPose;
  destination: DungeonPose;
  route: DungeonWaypoint[];
  segmentSeconds: number[];
  nextIndex: number;
  segmentElapsedSeconds: number;
  totalSeconds: number;
  targetRevision: number | null;
}
export interface AutonomyActor {
  id: string;
  revision: number;
  enabled: boolean;
  paused: boolean;
  role: string;
  needs: AutonomyNeed[];
  jobPriorities: Record<string, number>;
  assignedJobId: string | null;
  allowConflict: boolean;
  defense: number;
  attackBonus: number;
  maxHpLossPercent: number;
  cursor: number;
  offsetSeconds: number;
  jobId: string | null;
  progressSeconds: number;
  pending: string | null;
  dungeonTravel?: AutonomyDungeonTravel | null;
  sightMeters?: number;
  darkvisionMeters?: number;
  hearingMeters?: number;
  passivePerception?: number;
  stealthDc?: number;
  positionBasis?: {
    locationId: string | null;
    revision: number | null;
    dungeon?: DungeonPose | null;
  };
}
export interface AutonomyJob {
  id: string;
  revision: number;
  name: string;
  kind:
    | 'wait'
    | 'guard'
    | 'rest'
    | 'eat'
    | 'drink'
    | 'work'
    | 'social'
    | 'move'
    | 'patrol'
    | 'conflict'
    | 'reset';
  locationId: string | null;
  routeId: string | null;
  targetActorId: string | null;
  featureId?: string | null;
  roomId?: string | null;
  patrolRoomId?: string | null;
  speedMetersPerMinute?: number;
  roles: string[];
  priority: number;
  durationSeconds: number;
  exclusive: boolean;
  enabled: boolean;
  needEffects: Record<string, number>;
  maxDamage: number;
}
export interface NpcRoute {
  id: string;
  revision: number;
  name: string;
  fromLocationId: string;
  toLocationId: string;
  durationSeconds: number;
  enabled: boolean;
}
export interface AutonomyView {
  actors: (AutonomyActor & {
    name: string;
    locationId: string | null;
    locationName: string;
    positionRevision: number | null;
    dungeonPosition: DungeonPose | null;
    remaining: number;
  })[];
  available: { id: string; name: string; locationId: string | null }[];
  groups: { id: string; revision: number; name: string; actorIds: string[] }[];
  locations: { id: string; name: string }[];
  routes: NpcRoute[];
  rooms: {
    id: string;
    name: string;
    scopeId: string;
    floorId: string;
    locationId: string | null;
  }[];
  features: { id: string; name: string }[];
  jobs: AutonomyJob[];
  logs: {
    id: string;
    text: string;
    actorId: string;
    intervalId: string;
    kind: string;
    facts: Record<string, unknown>;
  }[];
  confirmed: string;
  pendingActors: number;
}
export type AutonomyAction =
  | {
      kind: 'actor';
      actor: AutonomyActor;
      expectedRevision: number | null;
      initialLocationId: string | null;
    }
  | { kind: 'group-enable'; groupId: string; expectedRevision: number; enabled: boolean }
  | { kind: 'job'; job: AutonomyJob; expectedRevision: number | null }
  | { kind: 'route'; route: NpcRoute; expectedRevision: number | null }
  | { kind: 'pause'; actorId: string; paused: boolean; expectedRevision: number }
  | { kind: 'assign'; actorId: string; jobId: string | null; expectedRevision: number }
  | {
      kind: 'place';
      actorId: string;
      locationId: string;
      expectedPositionRevision: number | null;
      reason: string;
    }
  | { kind: 'catch-up'; actorIds: string[]; maxSteps: number }
  | {
      kind: 'accept-pending';
      actorId: string;
      expectedRevision: number;
      resolution: 'resume' | 'skip';
      reason: string;
    };
export interface AutonomyCommand {
  commandId: string;
  token: string;
  campaignId: string;
  action: AutonomyAction;
}
export interface AutonomyDecisionCandidate {
  jobId: string;
  revision: number;
  name: string;
  eligible: boolean;
  priority: number | null;
  reason: string;
  travelSeconds: number | null;
  remainingSeconds: number | null;
}
export interface AutonomyDecision {
  actorId: string;
  actorRevision: number;
  basis: 'confirmed' | 'current';
  instantMs: string;
  throughMs: string | null;
  needs: AutonomyNeed[];
  selectedJobId: string | null;
  runningJobId: string | null;
  blockers: string[];
  candidates: AutonomyDecisionCandidate[];
  tieBreak: string;
}
export interface AutonomyAPI {
  autonomyDecision(token: string, actorId: string): Promise<Result<AutonomyDecision>>;
  autonomy(token: string): Promise<Result<AutonomyView>>;
  executeAutonomy(
    command: AutonomyCommand,
  ): Promise<Result<{ view: AutonomyView; progressed: number; pending: number }>>;
}
export const standardNeeds = (): AutonomyNeed[] =>
  ['hunger', 'thirst', 'rest', 'safety', 'social'].map((id, i) => ({
    id,
    name: ['Hunger', 'Durst', 'Ruhe', 'Sicherheit', 'Nähe'][i]!,
    enabled: true,
    value: 0,
    ratePerHour: [4, 6, 3, 0, 1][i]!,
    weight: 1,
  }));

export function checkedAutonomyJob(job: AutonomyJob): AutonomyJob {
  const id = (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 1000;
  if (
    !job ||
    typeof job !== 'object' ||
    Array.isArray(job) ||
    !id(job.id) ||
    !Number.isSafeInteger(job.revision) ||
    job.revision < 1 ||
    typeof job.name !== 'string' ||
    !job.name.trim() ||
    ![
      'wait',
      'guard',
      'rest',
      'eat',
      'drink',
      'work',
      'social',
      'move',
      'patrol',
      'conflict',
      'reset',
    ].includes(job.kind) ||
    typeof job.enabled !== 'boolean' ||
    typeof job.exclusive !== 'boolean' ||
    !Array.isArray(job.roles) ||
    job.roles.some((role) => typeof role !== 'string' || role.length > 1000) ||
    !Number.isFinite(job.priority) ||
    !Number.isSafeInteger(job.durationSeconds) ||
    job.durationSeconds < 1 ||
    job.durationSeconds > 100000000 ||
    !Number.isFinite(job.maxDamage) ||
    job.maxDamage < 0 ||
    job.maxDamage > 100
  )
    throw new Error('Autonomie-Jobvorgaben prüfen.');
  if (
    !job.needEffects ||
    typeof job.needEffects !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(job.needEffects)) ||
    Object.values(job.needEffects).some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100,
    )
  )
    throw new Error('Autonomie-Jobbedürfnisse prüfen.');
  for (const value of [job.locationId, job.routeId, job.targetActorId])
    if (value !== null && !id(value)) throw new Error('Autonomie-Jobziel prüfen.');
  for (const value of [job.featureId, job.roomId, job.patrolRoomId])
    if (value !== undefined && value !== null && !id(value))
      throw new Error('Autonomie-Jobraum oder Feature prüfen.');
  if (
    job.speedMetersPerMinute !== undefined &&
    (!Number.isFinite(job.speedMetersPerMinute) ||
      job.speedMetersPerMinute < 0.1 ||
      job.speedMetersPerMinute > 1000)
  )
    throw new Error('Autonomie-Jobtempo prüfen.');
  return job;
}

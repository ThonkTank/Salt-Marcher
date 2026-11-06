import { type CombatReward } from './reward-contracts';
import { type CharacterHealth, type DeathSaveResult } from './character-progress-contracts';
import type { Creature } from '../../features/catalog/creature-catalog';
import type { EncounterAssessment, EncounterParty } from '../catalog/encounter-contracts';

export interface Combatant {
  role?: import('../campaign/npc-data-contracts').NpcRole;
  id: string;
  characterId: string | null;
  groupId: string;
  groupName?: string;
  name: string;
  initiative: number;
  initiativeBonus: number;
  armorClass: number | null;
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: string;
  concentrating: boolean;
  death?: CharacterHealth['death'];
  deathLast?: { result: DeathSaveResult; roll: number | null };
  concentrationChecks?: { damage: number; dc: number }[];
  concentrationLast?: {
    damage: number;
    dc: number;
    roll: number | null;
    modifier: number;
    total: number | null;
    success: boolean;
  };
  legendaryActions?: {
    remaining: number;
    maximum: number;
    lastResetRound: number;
    lastUsedRound?: number;
    lastUsedTurnId?: string;
    lastUsedActionId?: string;
    hitResolved?: boolean;
  };
  timedEffects?: { id: string; name: string; remaining: number; tick: 'start' | 'end' }[];
  hiddenFromPlayers?: boolean;
  /** Missing means a legacy known value; false denotes an uninitialized PC. */
  healthKnown?: boolean;
  xp?: number;
  countForMultiplier?: boolean;
  sourceId?: string;
  sourceOrdinal?: number;
  worldActorId?: string;
  worldActorRevision?: number;
  sourceEntryId?: string;
  partitionKind?: 'mob' | 'individual';
}

export interface CombatState {
  worldLosses?: { actorId: string; name: string; recordRevision: number }[];
  id: string;
  sceneId: string;
  revision: number;
  title: string;
  phase: 'preparing' | 'running' | 'finished' | 'retired';
  round: number;
  turnId: string | null;
  sharedNotice?: string;
  sceneGroups?: { id: string; revision: number; name: string }[];
  participants: Combatant[];
  notes: string;
  outcome: string;
  rewards?: CombatReward;
  sources?: Creature[];
  sourceSerials?: Record<string, number>;
  assessment?: EncounterAssessment;
  partyBasis?: EncounterParty[];
  generatorPreset?: { id: string; revision: number; hash: string; mobThreshold: number };
  planOrigin?: { id: string; revision: number; name: string };
}

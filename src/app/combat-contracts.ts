import type {CombatDraftAPI} from './combat-draft-contracts';
import type { Result } from './contracts';
import type { FinishRewards, CombatReward, CharacterHealth } from './progression';
import type { Creature } from '../features/catalog/creature-catalog';
import type { EncounterAssessment, EncounterParty } from './encounter-contracts';
export interface Combatant {
  id: string; characterId: string | null; groupId: string; name: string;
  initiative: number; initiativeBonus: number; armorClass: number;
  hp: number; maxHp: number; tempHp: number; conditions: string; concentrating: boolean;
  /** Missing means a legacy known value; false denotes an uninitialized PC. */
  healthKnown?: boolean;
  xp?: number; countForMultiplier?: boolean; sourceId?: string; sourceOrdinal?: number; worldActorId?:string;worldActorRevision?:number;sourceEntryId?:string; partitionKind?:'mob'|'individual';
}
export interface CombatState {
  id: string; sceneId: string; revision: number; title: string;
  phase: 'preparing' | 'running' | 'finished'; round: number; turnId: string | null;
  participants: Combatant[]; notes: string; outcome: string; rewards?: CombatReward; sources?: Creature[]; sourceSerials?: Record<string,number>; assessment?: EncounterAssessment; partyBasis?: EncounterParty[]; generatorPreset?: {id:string;revision:number;hash:string;mobThreshold:number}; planOrigin?: { id: string; revision: number; name: string };
}
export interface CombatView {
  combat: CombatState | null; canUndo: boolean; assessment?: EncounterAssessment;
  partyCandidates?: {characterId:string;name:string;membershipRevision:number;progressRevision:number;health:CharacterHealth|null}[];
  recent: { id: string; title: string; phase: CombatState['phase'] }[];
}
export type CombatAction =
  | { kind: 'create'; sceneId: string; title: string; includeParty: boolean; expectedMembershipRevision: number; planId?: string; expectedPlanRevision?: number;preparedGroupId?:string;expectedPreparedRevision?:number;worldActorIds?:string[] }
  | {kind:'add-party';characterId:string;expectedMembershipRevision:number;expectedProgressRevision:number;initiative?:number}
  | { kind: 'add-creature'; creatureId: string; count: number; grouped: boolean; groupId?: string }
  | { kind: 'add'; name: string; count: number; grouped: boolean; maxHp: number; armorClass: number; initiativeBonus: number }
  | { kind: 'edit'; participantId: string; changes: Partial<Pick<Combatant, 'name' | 'initiative' | 'initiativeBonus' | 'armorClass' | 'hp' | 'maxHp' | 'tempHp' | 'conditions' | 'concentrating' | 'xp' | 'countForMultiplier'>> }
  | { kind: 'damage' | 'heal'; participantId: string; amount: number }
  | { kind: 'remove'; participantId: string }
  | { kind: 'roll'; mode: 'normal' | 'advantage' | 'disadvantage' }
  | { kind: 'start' | 'next' | 'undo' }
  | { kind: 'notes'; title: string; notes: string }
  | { kind: 'finish'; outcome: string; rewards?: FinishRewards };
export interface CombatCommand { commandId: string; campaignId: string; token: string; combatId: string | null; expectedRevision: number | null; action: CombatAction;draftWriteId?:string }
export interface CombatAPI extends CombatDraftAPI {
  combat(token: string, sceneId: string, combatId?: string): Promise<Result<CombatView>>;
  executeCombat(command: CombatCommand): Promise<Result<CombatView>>;
}
export function combatOrder(combat: CombatState): Combatant[] {
  return combat.participants.map((p, index) => ({ p, index })).sort((a, b) => b.p.initiative - a.p.initiative || a.index - b.index).map(({ p }) => p);
}
export function checkedCombat(state: CombatState): CombatState {
  if (!state || !state.id || !state.sceneId || !['preparing', 'running', 'finished'].includes(state.phase) || !Number.isSafeInteger(state.revision) || state.revision < 1 || !Number.isSafeInteger(state.round) || state.round < 0) throw new Error('Ungültiger Kampfstand.');
  if (typeof state.title !== 'string' || state.title.length > 1000 || typeof state.notes !== 'string' || state.notes.length > 2000000 || typeof state.outcome !== 'string' || state.outcome.length > 10000 || !Array.isArray(state.participants) || state.participants.length > 1000) throw new Error('Ungültige Kampfinhalte.');
  const ids = new Set<string>(), characterIds=new Set<string>(),initiatives = new Map<string, number>();
  for (const p of state.participants) {
    checkedCombatant(p);if(ids.has(p.id))throw new Error('Doppelter Initiativeeintrag.');ids.add(p.id);
    if(p.characterId){if(characterIds.has(p.characterId))throw new Error('Figur steht mehrfach in derselben Initiative.');characterIds.add(p.characterId);}
    if (initiatives.has(p.groupId) && initiatives.get(p.groupId) !== p.initiative) throw new Error('Eine Initiativegruppe benötigt einen gemeinsamen Wert.');
    initiatives.set(p.groupId, p.initiative);
  }
  if (state.turnId !== null && !ids.has(state.turnId) || state.phase === 'running' && (!state.turnId || !state.round)) throw new Error('Aktueller Zug fehlt.');
  return state;
}

export function checkedCombatant(p:Combatant):Combatant {
    if (!p || typeof p.id!=='string' || !p.id || typeof p.groupId!=='string' || !p.groupId || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 1000 || typeof p.conditions !== 'string' || p.conditions.length > 4000 || typeof p.concentrating !== 'boolean') throw new Error('Ungültiger Initiativeeintrag.');
    if (p.healthKnown !== undefined && typeof p.healthKnown !== 'boolean' || p.healthKnown === false && !p.characterId) throw new Error('Unbekannter HP-Status ungültig.');
    for (const value of [p.initiative, p.initiativeBonus, p.armorClass, p.hp, p.maxHp, p.tempHp]) if (!Number.isSafeInteger(value) || Math.abs(value) > 1000000) throw new Error('Kampfwerte benötigen ganze Zahlen bis 1.000.000.');
    if (p.xp !== undefined && (!Number.isSafeInteger(p.xp) || p.xp < 0)) throw new Error('Kreatur-XP benötigen eine nichtnegative ganze Zahl.');
    if (p.maxHp < 1 || p.hp < 0 || p.hp > p.maxHp || p.tempHp < 0 || p.armorClass < 0) throw new Error('Trefferpunkte oder Rüstungsklasse ungültig.');
  return p;
}

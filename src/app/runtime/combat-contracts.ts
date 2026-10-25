import type { DamageScale, DamageType } from './damage-adjustment';
import type { CombatDraftAPI } from './combat-draft-contracts';
import type { Result } from '../shared/contracts';
import {
  checkedHealth,
  type FinishRewards,
  type CombatReward,
  type CharacterHealth,
  type DeathSaveResult,
} from './progression';
import type { Creature } from '../../features/catalog/creature-catalog';
import type { EncounterAssessment, EncounterParty } from '../catalog/encounter-contracts';
export const combatConditions = [
  ['Blind', 'Blinded'],
  ['Bezaubert', 'Charmed'],
  ['Taub', 'Deafened'],
  ['Verängstigt', 'Frightened'],
  ['Gepackt', 'Grappled'],
  ['Handlungsunfähig', 'Incapacitated'],
  ['Unsichtbar', 'Invisible'],
  ['Gelähmt', 'Paralyzed'],
  ['Versteinert', 'Petrified'],
  ['Vergiftet', 'Poisoned'],
  ['Liegend', 'Prone'],
  ['Festgesetzt', 'Restrained'],
  ['Betäubt', 'Stunned'],
  ['Bewusstlos', 'Unconscious'],
] as const;
const conditionParts = (text: string) =>
  text
    .split(/\s*[,;\n]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
export function hasCombatCondition(text: string, label: string, source: string) {
  const aliases = new Set([label.toLocaleLowerCase('de'), source.toLocaleLowerCase('en')]);
  return conditionParts(text).some((part) => aliases.has(part.toLocaleLowerCase()));
}
export function setCombatCondition(text: string, label: string, source: string, active: boolean) {
  const aliases = new Set([label.toLocaleLowerCase('de'), source.toLocaleLowerCase('en')]),
    parts = conditionParts(text).filter((part) => !aliases.has(part.toLocaleLowerCase()));
  if (active) parts.push(label);
  return parts.join(', ');
}
export interface Combatant {
  role?: import('../campaign/npc-contracts').NpcRole;
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
export interface CombatLossBasis {
  participantId: string;
  actorId: string;
  noteRevision: number;
  recordRevision: number;
  actorRevision: number;
}
export interface CombatLossCandidate {
  participantId: string;
  actorId: string;
  name: string;
  combatHp: number;
  status: 'available' | 'confirmed' | 'defeated' | 'unavailable';
  basis: CombatLossBasis | null;
}
export interface CombatResolution {
  combatId: string;
  sceneId: string;
  combatRevision: number;
  sceneRevision: number;
  outcome: string;
  rewards: CombatReward | null;
  npcLosses?: CombatLossCandidate[];
  treasures: {
    id: string;
    revision: number;
    title: string;
    source: 'combat' | 'scene' | 'location';
    quantity: number;
    available: number;
  }[];
  next: string | null;
}
export interface CombatView {
  combat: CombatState | null;
  canUndo: boolean;
  assessment?: EncounterAssessment;
  partyCandidates?: {
    characterId: string;
    name: string;
    membershipRevision: number;
    progressRevision: number;
    health: CharacterHealth | null;
  }[];
  recent: { id: string; title: string; phase: CombatState['phase']; sequence?: number }[];
}
export type CombatAction =
  | { kind: 'confirm-npc-losses'; losses: CombatLossBasis[] }
  | {
      kind: 'create';
      sceneId: string;
      title: string;
      includeParty: boolean;
      expectedMembershipRevision: number;
      catalogCreature?: { creatureId: string; count: number; grouped: boolean };
      sceneSelection?: import('./scene-encounter-selection').SceneEncounterBasis;
      generation?: {
        runId: string;
        index: number;
        expectedRegistryRevision: number;
        expectedFocusRevision: number | null;
        locationId: string | null;
      };
      planId?: string;
      expectedPlanRevision?: number;
      preparedGroupId?: string;
      expectedPreparedRevision?: number;
      worldActorIds?: string[];
    }
  | {
      kind: 'add-prepared-group';
      preparedGroupId: string;
      expectedPreparedRevision: number;
      expectedRosterBasis: string;
      worldActorIds: string[];
      initiative: number;
    }
  | {
      kind: 'add-world-actor';
      actorId: string;
      expectedActorRevision: number;
      expectedRecordRevision: number;
    }
  | {
      kind: 'add-party';
      characterId: string;
      expectedMembershipRevision: number;
      expectedProgressRevision: number;
      initiative?: number;
    }
  | {
      kind: 'add-creature';
      creatureId: string;
      count: number;
      grouped: boolean;
      groupId?: string;
      initiative?: number;
    }
  | {
      kind: 'add';
      name: string;
      count: number;
      grouped: boolean;
      maxHp: number;
      armorClass: number;
      initiativeBonus: number;
    }
  | { kind: 'initiative'; values: { participantId: string; initiative: number }[]; start?: boolean }
  | {
      kind: 'edit';
      participantId: string;
      changes: Partial<
        Pick<
          Combatant,
          | 'name'
          | 'groupName'
          | 'initiative'
          | 'initiativeBonus'
          | 'armorClass'
          | 'hp'
          | 'maxHp'
          | 'tempHp'
          | 'conditions'
          | 'concentrating'
          | 'xp'
          | 'countForMultiplier'
        >
      >;
    }
  | {
      kind: 'damage';
      participantId: string;
      amount: number;
      sourceCheckId?: string;
      sourceScale?: 'full' | 'half' | 'double';
    }
  | {
      kind: 'hit';
      participantId: string;
      critical: boolean;
      source: { participantId: string; actionId: string };
      components: {
        key: string;
        amount: number;
        scale: 'auto' | 'full' | 'half' | 'double' | 'none';
        sourceCheckId?: string;
      }[];
      attackCheckId?: string;
      legendary?: { participantId: string; actionId: string; cost: number };
      paidLegendary?: boolean;
    }
  | {
      kind: 'area-damage';
      amount: number;
      damageType?: DamageType;
      targets: { participantId: string; scale: 'full' | 'half' | 'none'; defense?: DamageScale }[];
      source?: { participantId: string; actionId: string };
      legendary?: { participantId: string; actionId: string; cost: number };
    }
  | { kind: 'heal'; participantId: string; amount: number }
  | { kind: 'revive'; participantId: string; hp: number }
  | { kind: 'death'; participantId: string; result: DeathSaveResult }
  | { kind: 'death-roll'; participantId: string }
  | { kind: 'concentration-roll'; participantId: string; modifier: number }
  | { kind: 'concentration'; participantId: string; success: boolean }
  | { kind: 'legendary-action'; participantId: string; actionId: string; cost: number }
  | {
      kind: 'effect-add';
      participantId: string;
      name: string;
      rounds: number;
      tick: 'start' | 'end';
    }
  | { kind: 'effect-remove'; participantId: string; effectId: string }
  | { kind: 'visibility'; participantId: string; hidden: boolean }
  | { kind: 'remove'; participantId: string }
  | { kind: 'start' | 'next' | 'undo' }
  | { kind: 'notes'; title: string; notes: string }
  | { kind: 'finish'; outcome: string; rewards?: FinishRewards; finishDraftWriteId?: string };
export interface CombatCommand {
  commandId: string;
  campaignId: string;
  token: string;
  combatId: string | null;
  expectedRevision: number | null;
  action: CombatAction;
  draftWriteId?: string;
}
export interface CombatAPI extends CombatDraftAPI {
  sceneEncounterSelection(
    token: string,
    sceneId: string,
  ): Promise<Result<import('./scene-encounter-selection').SceneEncounterSelectionView>>;
  combatResolution(
    token: string,
    sceneId: string,
    combatId: string,
    after: string | null,
  ): Promise<Result<CombatResolution>>;
  combat(token: string, sceneId: string, combatId?: string): Promise<Result<CombatView>>;
  executeCombat(command: CombatCommand): Promise<Result<CombatView>>;
}
export function combatStartIssue(combat: CombatState): string | null {
  if (!combat.participants.length) return 'Füge Teilnehmer hinzu, bevor du den Kampf beginnst.';
  if (
    !combat.participants.some(
      (p) =>
        !p.characterId &&
        p.role !== 'friendly' &&
        p.role !== 'neutral' &&
        p.hp > 0 &&
        !p.death?.dead,
    )
  )
    return 'Noch keine kampffähigen Gegner. Füge eine vorbereitete Monstergruppe oder Gegner hinzu, bevor du den Kampf beginnst.';
  return null;
}
export function combatOrder(combat: CombatState): Combatant[] {
  return combat.participants
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p.initiative - a.p.initiative || a.index - b.index)
    .map(({ p }) => p);
}
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2));
export function checkedCombat(state: CombatState): CombatState {
  if (
    !state ||
    !state.id ||
    !state.sceneId ||
    !['preparing', 'running', 'finished', 'retired'].includes(state.phase) ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 1 ||
    !Number.isSafeInteger(state.round) ||
    state.round < 0
  )
    throw new Error('Ungültiger Kampfstand.');
  if (
    typeof state.title !== 'string' ||
    state.title.length > 1000 ||
    typeof state.notes !== 'string' ||
    state.notes.length > 2000000 ||
    typeof state.outcome !== 'string' ||
    state.outcome.length > 10000 ||
    !Array.isArray(state.participants) ||
    state.participants.length > 1000
  )
    throw new Error('Ungültige Kampfinhalte.');
  if (state.phase === 'retired' && (!!state.outcome || state.rewards !== undefined))
    throw new Error('Archivierter Kampf darf kein abgeleitetes Ergebnis besitzen.');
  if (
    state.worldLosses !== undefined &&
    (!Array.isArray(state.worldLosses) ||
      state.worldLosses.length > 1000 ||
      state.worldLosses.length !== new Set(state.worldLosses.map((l) => l?.actorId)).size ||
      state.worldLosses.some(
        (l) =>
          !l ||
          typeof l.actorId !== 'string' ||
          !l.actorId ||
          typeof l.name !== 'string' ||
          !l.name.trim() ||
          !Number.isSafeInteger(l.recordRevision) ||
          l.recordRevision < 1 ||
          !state.participants.some((p) => p.worldActorId === l.actorId),
      ))
  )
    throw new Error('Bestätigte NPC-Verluste sind ungültig.');
  if (
    state.sceneGroups !== undefined &&
    (!Array.isArray(state.sceneGroups) ||
      !state.sceneGroups.length ||
      state.sceneGroups.length > 1000 ||
      new Set(state.sceneGroups.map((g) => g.id)).size !== state.sceneGroups.length ||
      state.sceneGroups.some(
        (g) =>
          !g ||
          typeof g.id !== 'string' ||
          !g.id ||
          !Number.isSafeInteger(g.revision) ||
          g.revision < 1 ||
          typeof g.name !== 'string' ||
          g.name.length > 1000,
      ))
  )
    throw new Error('Szenengruppenherkunft ungültig.');
  const ids = new Set<string>(),
    characterIds = new Set<string>(),
    initiatives = new Map<string, number>(),
    groupNames = new Map<string, string>();
  for (const p of state.participants) {
    checkedCombatant(p);
    if (ids.has(p.id)) throw new Error('Doppelter Initiativeeintrag.');
    ids.add(p.id);
    if (p.characterId) {
      if (characterIds.has(p.characterId))
        throw new Error('Figur steht mehrfach in derselben Initiative.');
      characterIds.add(p.characterId);
    }
    if (initiatives.has(p.groupId) && initiatives.get(p.groupId) !== p.initiative)
      throw new Error('Eine Initiativegruppe benötigt einen gemeinsamen Wert.');
    initiatives.set(p.groupId, p.initiative);
    if (groupNames.has(p.groupId) && groupNames.get(p.groupId) !== (p.groupName ?? ''))
      throw new Error('Eine Initiativegruppe benötigt einen gemeinsamen Truppnamen.');
    groupNames.set(p.groupId, p.groupName ?? '');
  }
  for (const p of state.participants)
    if (
      p.legendaryActions?.lastUsedRound !== undefined &&
      p.legendaryActions.lastUsedRound > state.round
    )
      throw new Error('Legendäre Aktionsrunde ist ungültig.');
  if (
    (state.turnId !== null && !ids.has(state.turnId)) ||
    (state.phase === 'running' && (!state.turnId || !state.round))
  )
    throw new Error('Aktueller Zug fehlt.');
  return state;
}

export function checkedCombatant(p: Combatant): Combatant {
  if (
    !p ||
    typeof p.id !== 'string' ||
    !p.id ||
    typeof p.groupId !== 'string' ||
    !p.groupId ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 1000 ||
    typeof p.conditions !== 'string' ||
    p.conditions.length > 4000 ||
    typeof p.concentrating !== 'boolean'
  )
    throw new Error('Ungültiger Initiativeeintrag.');
  if (
    p.groupName !== undefined &&
    (typeof p.groupName !== 'string' ||
      p.groupName.length > 120 ||
      p.groupName !== p.groupName.trim())
  )
    throw new Error('Truppname benötigt höchstens 120 Zeichen ohne äußere Leerzeichen.');
  if (p.role !== undefined && !['friendly', 'neutral', 'hostile'].includes(p.role))
    throw new Error('Ungültige Begegnungsrolle.');
  if (
    (p.healthKnown !== undefined && typeof p.healthKnown !== 'boolean') ||
    (p.healthKnown === false && !p.characterId)
  )
    throw new Error('Unbekannter HP-Status ungültig.');
  for (const value of [p.initiative, p.initiativeBonus, p.hp, p.maxHp, p.tempHp])
    if (!Number.isSafeInteger(value) || Math.abs(value) > 1000000)
      throw new Error('Kampfwerte benötigen ganze Zahlen bis 1.000.000.');
  if (
    p.armorClass !== null &&
    (!Number.isSafeInteger(p.armorClass) || p.armorClass < 0 || p.armorClass > 1000000)
  )
    throw new Error('Rüstungsklasse benötigt eine nichtnegative ganze Zahl oder bleibt offen.');
  if (p.xp !== undefined && (!Number.isSafeInteger(p.xp) || p.xp < 0))
    throw new Error('Kreatur-XP benötigen eine nichtnegative ganze Zahl.');
  if (p.maxHp < 1 || p.hp < 0 || p.hp > p.maxHp || p.tempHp < 0)
    throw new Error('Trefferpunkte oder Rüstungsklasse ungültig.');
  if (p.death !== undefined) {
    if (!p.characterId) throw new Error('Todesrettungswürfe gehören zu einer Party-Figur.');
    checkedHealth({
      hp: p.hp,
      maxHp: p.maxHp,
      tempHp: p.tempHp,
      conditions: p.conditions,
      concentrating: p.concentrating,
      death: p.death,
    });
  }
  if (
    p.deathLast !== undefined &&
    (!p.characterId ||
      !['success', 'failure', 'natural-20', 'natural-1', 'stabilize', 'reset', 'dead'].includes(
        p.deathLast.result,
      ) ||
      (p.deathLast.roll !== null &&
        (!Number.isSafeInteger(p.deathLast.roll) || p.deathLast.roll < 1 || p.deathLast.roll > 20)))
  )
    throw new Error('Letzter Todesrettungswurf ungültig.');
  if (
    p.concentrationChecks !== undefined &&
    (!Array.isArray(p.concentrationChecks) ||
      !p.concentrating ||
      p.concentrationChecks.length > 100 ||
      p.concentrationChecks.some(
        (check) =>
          !Number.isSafeInteger(check.damage) ||
          check.damage < 1 ||
          check.damage > 1000000 ||
          check.dc !== concentrationDc(check.damage),
      ))
  )
    throw new Error('Offene Konzentrationsprüfungen ungültig.');
  if (p.concentrationLast !== undefined) {
    const c = p.concentrationLast;
    if (
      !Number.isSafeInteger(c.damage) ||
      c.damage < 1 ||
      c.damage > 1000000 ||
      c.dc !== concentrationDc(c.damage) ||
      (c.roll !== null && (!Number.isSafeInteger(c.roll) || c.roll < 1 || c.roll > 20)) ||
      !Number.isSafeInteger(c.modifier) ||
      Math.abs(c.modifier) > 1000 ||
      (c.total !== null && !Number.isSafeInteger(c.total)) ||
      (c.roll === null && c.total !== null) ||
      (c.roll !== null && c.total !== c.roll + c.modifier) ||
      typeof c.success !== 'boolean' ||
      (c.total !== null && c.success !== c.total >= c.dc)
    )
      throw new Error('Letzte Konzentrationsprüfung ungültig.');
  }
  if (p.legendaryActions !== undefined) {
    const l = p.legendaryActions,
      used = (l.lastUsedRound === undefined) === (l.lastUsedTurnId === undefined);
    if (
      !Number.isSafeInteger(l.maximum) ||
      l.maximum < 1 ||
      l.maximum > 10 ||
      !Number.isSafeInteger(l.remaining) ||
      l.remaining < 0 ||
      l.remaining > l.maximum ||
      !Number.isSafeInteger(l.lastResetRound) ||
      l.lastResetRound < 0 ||
      !used ||
      (l.lastUsedRound !== undefined &&
        (!Number.isSafeInteger(l.lastUsedRound) || l.lastUsedRound < 1)) ||
      (l.lastUsedTurnId !== undefined &&
        (typeof l.lastUsedTurnId !== 'string' ||
          !l.lastUsedTurnId ||
          l.lastUsedTurnId.length > 1000))
    )
      throw new Error('Legendäre Aktionspunkte ungültig.');
  }
  if (
    (p.legendaryActions?.lastUsedActionId !== undefined &&
      (typeof p.legendaryActions.lastUsedActionId !== 'string' ||
        !p.legendaryActions.lastUsedActionId ||
        p.legendaryActions.lastUsedActionId.length > 1000)) ||
    (p.legendaryActions?.hitResolved !== undefined &&
      typeof p.legendaryActions.hitResolved !== 'boolean')
  )
    throw new Error('Legendärer Trefferstatus ungültig.');
  if (p.timedEffects !== undefined) {
    if (!Array.isArray(p.timedEffects) || p.timedEffects.length > 100)
      throw new Error('Rundeneffekte ungültig.');
    const ids = new Set<string>();
    for (const effect of p.timedEffects) {
      if (
        !effect ||
        typeof effect.id !== 'string' ||
        !effect.id ||
        ids.has(effect.id) ||
        typeof effect.name !== 'string' ||
        !effect.name.trim() ||
        effect.name.length > 500 ||
        !Number.isSafeInteger(effect.remaining) ||
        effect.remaining < 1 ||
        effect.remaining > 1000 ||
        !['start', 'end'].includes(effect.tick)
      )
        throw new Error('Rundeneffekt ungültig.');
      ids.add(effect.id);
    }
  }
  if (
    p.hiddenFromPlayers !== undefined &&
    (typeof p.hiddenFromPlayers !== 'boolean' || !!p.characterId)
  )
    throw new Error('Spielersichtbarkeit ungültig.');
  return p;
}

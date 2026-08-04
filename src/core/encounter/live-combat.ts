import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { HexMapStore } from '../hex/hex-map-store.js'
import { HexTravelStore } from '../hex/hex-travel.js'
import { z } from 'zod'
import {
  combatCommandResultSchema,
  combatSnapshotSchema,
  liveSessionSnapshotSchema,
  sceneGroupCommandResultSchema,
  type CombatCondition,
  type CombatCommandResult,
  type CombatSnapshot,
  type LiveSessionSnapshot,
  type PartyMember,
  type SceneGroupCommandResult
} from '../../shared/contracts/live-session.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import type { PartyCharacterDraft } from '../../shared/contracts/party.js'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../shared/contracts/encounter-tuning.js'
import type {
  EncounterSelectionEvaluation,
  GroupGenerationMode,
  SceneGroupDraftEntry,
  SceneGroupDraftEvaluation,
  SceneGroupDraftGeneration,
  SceneGroupDisposition,
  SceneGroup
} from '../../shared/contracts/scene.js'
import { creatureById } from '../creatures/catalog.js'
import { calculateAdventuringDay, PartyStore } from '../party/party-store.js'
import { SceneStore } from '../scene/scene-store.js'
import {
  evaluateSceneGroupDraft,
  evaluateSceneGroups,
  generateSceneGroupDraft
} from '../scene/group-generator.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { EncounterSourceService } from '../application/encounter-source-service.js'
import { CampaignUnitOfWork } from '../application/campaign-unit-of-work.js'

const sourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('party'),
      rowId: z.string(),
      partyId: z.uuid(),
      name: z.string(),
      initiative: z.number().int()
    })
    .strict(),
  z
    .object({
      kind: z.literal('monster'),
      rowId: z.string(),
      groupId: z.uuid().nullable(),
      creatureId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      memberIds: z.array(z.uuid()),
      initiative: z.number().int()
    })
    .strict()
])

const combatantSchema = z
  .object({
    id: z.string(),
    cardId: z.string(),
    sceneMemberId: z.uuid().nullable(),
    creatureId: z.string().nullable(),
    name: z.string(),
    playerCharacter: z.boolean(),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().nonnegative(),
    armorClass: z.number().int().nonnegative(),
    initiative: z.number().int(),
    xp: z.number().int().nonnegative(),
    detail: z.string(),
    conditions: z.array(z.string()),
    order: z.number().int().nonnegative()
  })
  .strict()

const resolutionStateSchema = z
  .object({
    selectedEnemyIds: z.array(z.string()),
    mode: z.enum(['defeated', 'manual']),
    xpFraction: z.number().min(0).max(1),
    xpAwarded: z.boolean()
  })
  .strict()

const combatMementoSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    phase: z.enum(['initiative', 'combat', 'resolution']),
    selectedGroupIds: z.array(z.uuid()),
    sources: z.array(sourceSchema),
    combatants: z.array(combatantSchema),
    turnOrder: z.array(z.string()),
    activeIndex: z.number().int().nonnegative(),
    round: z.number().int().positive(),
    resolution: resolutionStateSchema.nullable()
  })
  .strict()

type CombatMemento = z.infer<typeof combatMementoSchema>
type Combatant = z.infer<typeof combatantSchema>

const combatHistoryInverseSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('member-states'),
      states: z.array(
        z
          .object({
            id: z.uuid(),
            currentHp: z.number().int().nonnegative(),
            conditions: z.array(z.string())
          })
          .strict()
      )
    })
    .strict(),
  z
    .object({
      kind: z.literal('turn'),
      activeIndex: z.number().int().nonnegative(),
      round: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      kind: z.literal('initiative'),
      values: z.array(
        z.object({ id: z.string(), initiative: z.number().int() }).strict()
      ),
      turnOrder: z.array(z.string()),
      activeIndex: z.number().int().nonnegative()
    })
    .strict()
])

type CombatHistoryInverse = z.infer<typeof combatHistoryInverseSchema>

export function initializeCombatSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS encounter_combat_runtime (
      scene_id TEXT PRIMARY KEY NOT NULL,
      id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      phase TEXT NOT NULL,
      active_index INTEGER NOT NULL,
      round INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_selected_groups (
      scene_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, group_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_sources (
      scene_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      party_id TEXT,
      group_id TEXT,
      creature_id TEXT,
      initiative INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, row_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combatants (
      scene_id TEXT NOT NULL,
      id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      scene_member_id TEXT,
      party_id TEXT,
      initiative INTEGER NOT NULL,
      combat_order INTEGER NOT NULL,
      PRIMARY KEY(scene_id, id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_turn_order (
      scene_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      PRIMARY KEY(scene_id, position)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_resolution (
      scene_id TEXT PRIMARY KEY NOT NULL,
      threshold_mode TEXT NOT NULL DEFAULT 'defeated',
      xp_fraction REAL NOT NULL,
      xp_awarded INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_resolution_enemies (
      scene_id TEXT NOT NULL,
      enemy_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, enemy_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_history (
      scene_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      label TEXT NOT NULL,
      inverse_kind TEXT NOT NULL,
      inverse_payload TEXT NOT NULL,
      PRIMARY KEY(scene_id, revision)
    );
  `)
}

export class LivePlayService {
  constructor(private readonly campaignDatabase: () => Database.Database) {}

  readParty() {
    return this.withStores(({ party }) => party.read())
  }

  setMembership(id: string, active: boolean, expectedRevision: number) {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        const existing = party.read().members.find((member) => member.id === id)
        if (!existing) throw new CapabilityError('not_found', false)
        const snapshot = party.setMembership(id, active, expectedRevision)
        if (!active) scene.unassignPartyMember(id)
        else if (!existing.active)
          scene.assignPartyMember(
            scene.focusedSceneId(),
            id,
            true,
            scene.revision()
          )
        combat.reconcileParty(scene.assignedParty(snapshot.members))
        return snapshot
      })
    })
  }

  createPartyCharacter(
    character: PartyCharacterDraft,
    expectedRevision: number
  ) {
    return this.withStores(({ party }) =>
      party.create(character, expectedRevision)
    )
  }

  updatePartyCharacter(
    id: string,
    character: PartyCharacterDraft,
    expectedRevision: number
  ) {
    return this.withStores(({ party, scene, combat }) => {
      const snapshot = party.update(id, character, expectedRevision)
      combat.reconcileParty(scene.assignedParty(snapshot.members))
      return snapshot
    })
  }

  deletePartyCharacter(id: string, expectedRevision: number) {
    return this.withStores(({ party, scene, combat }) => {
      const snapshot = party.delete(id, expectedRevision)
      scene.unassignPartyMember(id)
      combat.reconcileParty(scene.assignedParty(snapshot.members))
      return snapshot
    })
  }

  adjustPartyXp(id: string, delta: number, expectedRevision: number) {
    return this.withStores(({ party }) =>
      party.adjustXp(id, delta, expectedRevision)
    )
  }

  restParty(type: 'short' | 'long', expectedRevision: number) {
    return this.withStores(({ party }) => party.rest(type, expectedRevision))
  }

  calculateAdventuringDay(
    rows: readonly { level: number; count: number }[],
    totalXp?: number
  ) {
    return calculateAdventuringDay(rows, totalXp)
  }

  readSession(): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) =>
      this.snapshotFrom(party, scene, combat)
    )
  }

  focusScene(sceneId: string, expectedRevision: number): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combatFor }) => {
      scene.focus(sceneId, expectedRevision)
      return this.snapshotFrom(party, scene, combatFor(sceneId))
    })
  }

  setSceneLocation(
    sceneId: string,
    locationId: string | null,
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat, locations }) => {
      if (
        locationId !== null &&
        !locations
          .read()
          .locations.some((location) => location.id === locationId)
      )
        throw new CapabilityError('not_found', false)
      scene.setLocation(sceneId, locationId, expectedRevision)
      return this.snapshotFrom(party, scene, combat)
    })
  }

  saveSceneGroup(
    sceneId: string,
    groupId: string | null,
    name: string,
    note: string,
    disposition: SceneGroupDisposition,
    entries: readonly {
      creatureId: string
      quantity: number
      deadQuantity?: number | undefined
    }[],
    expectedRevision: number,
    expectedGroupRevision: number | null
  ): SceneGroupCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        const savedId = scene.saveGroup(
          sceneId,
          groupId,
          name,
          note,
          disposition,
          entries,
          expectedRevision,
          expectedGroupRevision
        )
        if (groupId && combat.includesGroup(groupId)) {
          const updated = scene
            .groups(sceneId)
            .find((group) => group.id === groupId)
          if (updated) combat.reconcileGroup(updated)
        }
        return this.sceneGroupResult(party, scene, combat, sceneId, [savedId])
      })
    })
  }

  setSceneGroupArchived(
    sceneId: string,
    groupId: string,
    archived: boolean,
    expectedGroupRevision: number
  ): SceneGroupCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        scene.setGroupArchived(
          sceneId,
          groupId,
          archived,
          expectedGroupRevision
        )
        if (archived) combat.unlinkGroup(groupId)
        return this.sceneGroupResult(party, scene, combat, sceneId, [groupId])
      })
    })
  }

  joinCombatGroup(
    sceneId: string,
    groupId: string,
    expectedGroupRevision: number,
    expectedCombatRevision: number
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        combat.assertRevision(expectedCombatRevision)
        const group = scene
          .groups(sceneId)
          .find((candidate) => candidate.id === groupId && !candidate.archived)
        if (!group) throw new CapabilityError('not_found', false)
        if (group.revision !== expectedGroupRevision)
          throw new CapabilityError('stale', true)
        combat.joinGroup(group)
        return this.combatResult(party, scene, combat, false, false)
      })
    })
  }

  deleteSceneGroup(
    sceneId: string,
    groupId: string,
    expectedGroupRevision: number
  ): SceneGroupCommandResult {
    return this.withStores(({ party, scene, combat }) => {
      scene.deleteGroup(sceneId, groupId, expectedGroupRevision)
      return this.sceneGroupResult(party, scene, combat, sceneId, [groupId])
    })
  }

  assignScenePartyMember(
    sceneId: string,
    partyMemberId: string,
    assigned: boolean,
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      scene.assignPartyMember(
        sceneId,
        partyMemberId,
        assigned,
        expectedRevision
      )
      combat.reconcileParty(scene.assignedParty(party.read().members, sceneId))
      return this.snapshotFrom(party, scene, combat)
    })
  }

  generateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    mode: GroupGenerationMode,
    filters: CreatureCatalogQuery,
    tuning: EncounterTuning,
    seed: number,
    expectedRevision: number
  ): SceneGroupDraftGeneration {
    return this.withStores(({ party, scene }) => {
      if (scene.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new CapabilityError('not_found', false)
      const resolvedFilters = { ...filters, locationId: focused.locationId }
      return generateSceneGroupDraft(
        focused,
        scene.assignedParty(partySnapshot.members, sceneId),
        entries,
        mode,
        resolvedFilters,
        tuning,
        seed,
        expectedRevision,
        new EncounterSourceService(this.campaignDatabase).resolve(
          resolvedFilters
        )
      )
    })
  }

  evaluateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    expectedRevision: number
  ): SceneGroupDraftEvaluation {
    return this.withStores(({ party, scene }) => {
      if (scene.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new CapabilityError('not_found', false)
      return evaluateSceneGroupDraft(
        sceneId,
        scene.assignedParty(partySnapshot.members, sceneId),
        entries
      )
    })
  }

  evaluateEncounter(
    sceneId: string,
    groupIds: readonly string[],
    expectedRevision: number
  ): EncounterSelectionEvaluation {
    return this.withStores(({ party, scene }) => {
      if (scene.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new CapabilityError('not_found', false)
      return evaluateSceneGroups(
        focused,
        scene.assignedParty(partySnapshot.members, sceneId),
        groupIds
      )
    })
  }

  prepareCombat(
    sceneId: string,
    expectedSceneRevision: number,
    groupIds: readonly string[]
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat }) => {
      if (scene.revision() !== expectedSceneRevision)
        throw new CapabilityError('stale', true)
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new CapabilityError('not_found', false)
      const assigned = scene.assignedParty(partySnapshot.members, sceneId)
      const evaluation = evaluateSceneGroups(focused, assigned, groupIds)
      if (!evaluation.canStart)
        throw new CapabilityError('validation_failed', false)
      combat.prepare(assigned, focused.groups, groupIds)
      return this.combatResult(party, scene, combat, false, false)
    })
  }

  rollInitiative(expectedRevision: number): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) => combat.roll())
  }

  confirmInitiative(
    expectedRevision: number,
    values: readonly { id: string; initiative: number }[]
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.confirmInitiative(values)
    )
  }

  advanceTurn(expectedRevision: number): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) => combat.advance())
  }

  retreatTurn(expectedRevision: number): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) => combat.retreat())
  }

  adjustInitiative(
    expectedRevision: number,
    id: string,
    initiative: number
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.adjustInitiative(id, initiative)
    )
  }

  changeHp(
    expectedRevision: number,
    cardId: string,
    amount: number,
    healing: boolean
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.changeHp(cardId, amount, healing)
    )
  }

  toggleCombatCondition(
    expectedRevision: number,
    cardId: string,
    condition: CombatCondition,
    active: boolean
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.toggleCondition(cardId, condition, active)
    )
  }

  undoCombat(expectedRevision: number): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) => combat.undo())
  }

  endCombat(expectedRevision: number): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) => combat.end())
  }

  moveCombatToPhase(
    expectedRevision: number,
    target: 'selection' | 'initiative' | 'combat'
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) =>
      unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        if (target === 'selection') combat.clear()
        else combat.moveToPhase(target)
        return this.combatResult(party, scene, combat, false, false)
      })
    )
  }

  updateResolution(
    expectedRevision: number,
    selectedEnemyIds: readonly string[],
    mode: 'defeated' | 'manual',
    xpFraction: number
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.updateResolution(selectedEnemyIds, mode, xpFraction)
    )
  }

  awardXp(expectedRevision: number): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        const assigned = scene.assignedParty(party.read().members)
        const award = combat.xpAward(assigned)
        party.awardCombatXp(
          award.combatId,
          award.xpEach,
          assigned.map((member) => member.id)
        )
        combat.markXpAwarded()
        return this.combatResult(party, scene, combat, false, true)
      })
    })
  }

  completeCombat(expectedRevision: number): CombatCommandResult {
    return this.withStores(({ party, scene, combat }) => {
      combat.assertRevision(expectedRevision)
      combat.clear()
      return this.combatResult(party, scene, combat, false, false)
    })
  }

  private mutateCombat(
    expectedRevision: number,
    mutation: (combat: CombatStore) => void
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        mutation(combat)
        return this.combatResult(party, scene, combat, true, false)
      })
    })
  }

  private combatResult(
    party: PartyStore,
    scene: SceneStore,
    combat: CombatStore,
    includeScene: boolean,
    includeParty: boolean
  ): CombatCommandResult {
    const partySnapshot = party.read()
    const sceneId = scene.focusedSceneId()
    const changedGroupIds = includeScene ? combat.changedGroups() : []
    return combatCommandResultSchema.parse({
      combat: combat.snapshot(scene.assignedParty(partySnapshot.members)),
      scenePatch:
        changedGroupIds.length > 0
          ? {
              sceneId,
              sceneRevision: scene.revision(),
              upsertedGroups: scene
                .groups(sceneId)
                .filter((group) => changedGroupIds.includes(group.id)),
              removedGroupIds: []
            }
          : null,
      party: includeParty ? partySnapshot : null
    })
  }

  private sceneGroupResult(
    party: PartyStore,
    scene: SceneStore,
    combat: CombatStore,
    sceneId: string,
    groupIds: readonly string[]
  ): SceneGroupCommandResult {
    const groups = scene
      .groups(sceneId)
      .filter((group) => groupIds.includes(group.id))
    return sceneGroupCommandResultSchema.parse({
      scenePatch: {
        sceneId,
        sceneRevision: scene.revision(),
        upsertedGroups: groups,
        removedGroupIds: groupIds.filter(
          (id) => !groups.some((group) => group.id === id)
        )
      },
      combat: combat.snapshot(scene.assignedParty(party.read().members))
    })
  }

  private snapshotFrom(
    party: PartyStore,
    scene: SceneStore,
    combat: CombatStore,
    hexTravel?: HexTravelStore,
    db = this.campaignDatabase()
  ): LiveSessionSnapshot {
    const travel = (
      hexTravel ??
      new HexTravelStore(
        db,
        new HexMapStore(db, new WorldLocationStore(db)),
        party,
        scene
      )
    ).read(scene.focusedSceneId())
    const partySnapshot = party.read()
    const sceneSnapshot = scene.snapshot(partySnapshot.members)
    return liveSessionSnapshotSchema.parse({
      revision: sceneSnapshot.revision,
      party: partySnapshot,
      scene: sceneSnapshot,
      travel: travel?.mapId
        ? {
            kind: 'hex',
            status: travel.status,
            mapId: travel.mapId,
            mapName: travel.mapName,
            currentLabel: travel.currentLabel,
            locationName: travel.locationName,
            progress: travel.progress,
            remainingGameSeconds: travel.remainingGameSeconds,
            gameTimeSeconds: travel.gameTimeSeconds,
            effectiveSpeedFeet: travel.effectiveSpeedFeet,
            assumedSpeedMemberNames: travel.assumedSpeedMemberNames,
            multiplier: travel.multiplier,
            hint: travel.hint
          }
        : {
            kind: 'none',
            label: 'Kein aktiver Reisekontext',
            hint: 'Dungeon oder Hex stellen derzeit keinen Live-Kontext bereit.'
          },
      combat: combat.snapshot(scene.assignedParty(partySnapshot.members))
    })
  }

  private withStores<T>(
    work: (stores: {
      party: PartyStore
      scene: SceneStore
      combat: CombatStore
      combatFor: (sceneId: string) => CombatStore
      locations: WorldLocationStore
      unitOfWork: CampaignUnitOfWork
    }) => T
  ): T {
    const db = this.campaignDatabase()
    const locations = new WorldLocationStore(db)
    const unitOfWork = new CampaignUnitOfWork(db)
    const party = new PartyStore(db)
    const scene = new SceneStore(
      db,
      () => locations.read().locations,
      (id) =>
        party.read().members.some((member) => member.id === id && member.active)
    )
    const combatFor = (sceneId: string) =>
      new CombatStore(db, sceneId, scene, party)
    return work({
      party,
      scene,
      combat: combatFor(scene.focusedSceneId()),
      combatFor,
      locations,
      unitOfWork
    })
  }
}

class CombatStore {
  private readonly changedGroupIds = new Set<string>()

  constructor(
    private readonly db: Database.Database,
    private readonly sceneId: string,
    private readonly scene: SceneStore,
    private readonly party: PartyStore
  ) {}

  prepare(
    members: readonly PartyMember[],
    groups: readonly {
      id: string
      name: string
      entries: readonly {
        id: string
        creatureId: string
        quantity: number
        aliveQuantity: number
        available: boolean
        members: readonly {
          id: string
          currentHp: number
          conditions: readonly string[]
        }[]
      }[]
    }[],
    groupIds: readonly string[]
  ): void {
    const party = members.filter((member) => member.active)
    if (party.length === 0)
      throw new CapabilityError('validation_failed', false)
    const selected = Array.from(new Set(groupIds))
    const chosenGroups = selected.map((id) =>
      groups.find((group) => group.id === id)
    )
    if (chosenGroups.some((group) => group === undefined))
      throw new CapabilityError('not_found', false)
    const sources: CombatMemento['sources'] = party.map((member, index) => ({
      kind: 'party',
      rowId: `party:${member.id}`,
      partyId: member.id,
      name: member.name,
      initiative: 10 + index
    }))
    for (const group of chosenGroups) {
      for (const entry of group?.entries ?? []) {
        if (entry.aliveQuantity === 0) continue
        const creature = creatureById(entry.creatureId)
        if (!entry.available || !creature)
          throw new CapabilityError('not_found', false)
        sources.push({
          kind: 'monster',
          rowId: `monster:${entry.id}`,
          groupId: group?.id ?? null,
          creatureId: creature.id,
          name: creature.name,
          quantity: entry.aliveQuantity,
          memberIds: entry.members
            .filter((member) => member.currentHp > 0)
            .map((member) => member.id),
          initiative: 12 + Math.max(-3, Math.min(6, creature.initiative))
        })
      }
    }
    if (!sources.some((source) => source.kind === 'monster'))
      throw new CapabilityError('validation_failed', false)
    this.clearHistory()
    this.save({
      id: uuidv7(),
      revision: 0,
      phase: 'initiative',
      selectedGroupIds: selected,
      sources,
      combatants: [],
      turnOrder: [],
      activeIndex: 0,
      round: 1,
      resolution: null
    })
  }

  includesGroup(groupId: string): boolean {
    return this.load()?.selectedGroupIds.includes(groupId) ?? false
  }

  joinGroup(group: SceneGroup): void {
    const state = this.requireCombat()
    if (state.selectedGroupIds.includes(group.id)) {
      this.reconcileGroup(group)
      return
    }
    state.selectedGroupIds.push(group.id)
    this.reconcileGroupState(state, group)
    this.bump(state)
  }

  reconcileGroup(group: SceneGroup): void {
    const state = this.load()
    if (!state || !state.selectedGroupIds.includes(group.id)) return
    this.reconcileGroupState(state, group)
    this.bump(state)
  }

  unlinkGroup(groupId: string): void {
    const state = this.load()
    if (!state || !state.selectedGroupIds.includes(groupId)) return
    const memberIds = new Set(
      state.sources
        .filter(
          (
            source
          ): source is Extract<
            CombatMemento['sources'][number],
            { kind: 'monster' }
          > => source.kind === 'monster' && source.groupId === groupId
        )
        .flatMap((source) => source.memberIds)
    )
    const activeCard = state.turnOrder[state.activeIndex]
    state.selectedGroupIds = state.selectedGroupIds.filter(
      (id) => id !== groupId
    )
    state.sources = state.sources.filter(
      (source) => source.kind === 'party' || source.groupId !== groupId
    )
    state.combatants = state.combatants.filter(
      (combatant) =>
        !combatant.sceneMemberId || !memberIds.has(combatant.sceneMemberId)
    )
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.clearHistory()
    this.bump(state)
  }

  private reconcileGroupState(state: CombatMemento, group: SceneGroup): void {
    this.clearHistory()
    const activeCard = state.turnOrder[state.activeIndex]
    const previousMemberIds = new Set(
      state.sources
        .filter(
          (
            source
          ): source is Extract<
            CombatMemento['sources'][number],
            { kind: 'monster' }
          > => source.kind === 'monster' && source.groupId === group.id
        )
        .flatMap((source) => source.memberIds)
    )
    const existingParticipantIds = new Set(
      state.combatants.flatMap((combatant) =>
        combatant.sceneMemberId ? [combatant.sceneMemberId] : []
      )
    )
    const desiredEntries = group.entries.filter(
      (entry) =>
        entry.available &&
        entry.members.some(
          (member) =>
            member.currentHp > 0 || existingParticipantIds.has(member.id)
        )
    )
    const desiredMemberIds = new Set(
      desiredEntries.flatMap((entry) =>
        entry.members
          .filter(
            (member) =>
              member.currentHp > 0 || existingParticipantIds.has(member.id)
          )
          .map((member) => member.id)
      )
    )
    const partySources = state.sources.filter(
      (source) => source.kind === 'party'
    )
    const otherMonsterSources = state.sources.filter(
      (source) => source.kind === 'monster' && source.groupId !== group.id
    )
    const previousSources = state.sources.filter(
      (source) => source.kind === 'monster' && source.groupId === group.id
    )
    const groupSources = desiredEntries.map((entry) => {
      const creature = creatureById(entry.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      const existing = previousSources.find(
        (source) =>
          source.kind === 'monster' && source.creatureId === entry.creatureId
      )
      const memberIds = entry.members
        .filter(
          (member) =>
            member.currentHp > 0 || existingParticipantIds.has(member.id)
        )
        .map((member) => member.id)
      return {
        kind: 'monster' as const,
        rowId: `monster:${entry.id}`,
        groupId: group.id,
        creatureId: entry.creatureId,
        name: creature.name,
        quantity: memberIds.length,
        memberIds,
        initiative:
          existing?.initiative ??
          12 + Math.max(-3, Math.min(6, creature.initiative))
      }
    })
    state.sources = [...partySources, ...otherMonsterSources, ...groupSources]
    if (state.phase === 'initiative') return
    state.combatants = state.combatants.filter(
      (combatant) =>
        !combatant.sceneMemberId ||
        !previousMemberIds.has(combatant.sceneMemberId) ||
        desiredMemberIds.has(combatant.sceneMemberId)
    )
    for (const entry of desiredEntries) {
      const source = groupSources.find(
        (candidate) => candidate.creatureId === entry.creatureId
      )!
      const creature = creatureById(entry.creatureId)!
      for (const member of entry.members.filter(
        (candidate) => candidate.currentHp > 0
      )) {
        if (
          state.combatants.some(
            (combatant) => combatant.sceneMemberId === member.id
          )
        )
          continue
        const matchingCard = state.combatants.find(
          (combatant) =>
            combatant.creatureId === entry.creatureId &&
            combatant.sceneMemberId !== null &&
            state.combatants.filter(
              (candidate) => candidate.cardId === combatant.cardId
            ).length < 10
        )?.cardId
        state.combatants.push({
          id: member.id,
          cardId: matchingCard ?? `monster-card:${uuidv7()}`,
          sceneMemberId: member.id,
          creatureId: entry.creatureId,
          name: creature.name,
          playerCharacter: false,
          currentHp: member.currentHp,
          maxHp: creature.hp,
          armorClass: creature.ac,
          initiative: source.initiative,
          xp: creature.xp,
          detail: `CR ${creature.cr} · ${creature.type}`,
          conditions: [...member.conditions],
          order: state.combatants.length
        })
      }
    }
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
  }

  roll(): void {
    const state = this.require()
    if (state.phase !== 'initiative')
      throw new CapabilityError('validation_failed', false)
    state.sources = state.sources.map((source) => {
      if (source.kind === 'party') return source
      const creature = creatureById(source.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      return {
        ...source,
        initiative: 1 + Math.floor(Math.random() * 20) + creature.initiative
      }
    })
    this.bump(state)
  }

  confirmInitiative(
    values: readonly { id: string; initiative: number }[]
  ): void {
    const state = this.require()
    if (state.phase !== 'initiative')
      throw new CapabilityError('validation_failed', false)
    const input = new Map(values.map((value) => [value.id, value.initiative]))
    state.sources = state.sources.map((source) => ({
      ...source,
      initiative: input.get(source.rowId) ?? source.initiative
    }))
    const combatants: Combatant[] = []
    let order = 0
    for (const source of state.sources) {
      if (source.kind === 'party') {
        combatants.push({
          id: source.partyId,
          cardId: `party-card:${source.partyId}`,
          sceneMemberId: null,
          creatureId: null,
          name: source.name,
          playerCharacter: true,
          currentHp: 0,
          maxHp: 0,
          armorClass: 0,
          initiative: source.initiative,
          xp: 0,
          detail: 'Aktives Party-Mitglied',
          conditions: [],
          order: order++
        })
        continue
      }
      const creature = creatureById(source.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      let ordinal = 1
      const memberIds = source.memberIds.length
        ? source.memberIds
        : Array.from({ length: source.quantity }, () => null)
      let memberOffset = 0
      for (const size of mobSizes(memberIds.length)) {
        const cardId = `monster-card:${uuidv7()}`
        for (let member = 0; member < size; member += 1) {
          const sceneMemberId = memberIds[memberOffset++] ?? null
          const sceneState = sceneMemberId
            ? this.sceneMemberState(sceneMemberId)
            : null
          const name =
            memberIds.length === 1
              ? creature.name
              : `${creature.name} #${ordinal++}`
          combatants.push({
            id: sceneMemberId ?? `monster-member:${uuidv7()}`,
            cardId,
            sceneMemberId,
            creatureId: source.creatureId,
            name,
            playerCharacter: false,
            currentHp: sceneState?.currentHp ?? creature.hp,
            maxHp: creature.hp,
            armorClass: creature.ac,
            initiative: source.initiative,
            xp: creature.xp,
            detail: `CR ${creature.cr} · ${creature.type}`,
            conditions: sceneState?.conditions ?? [],
            order: order++
          })
        }
      }
    }
    state.combatants = combatants
    state.turnOrder = sortedCardIds(combatants)
    state.activeIndex = 0
    state.round = 1
    state.phase = 'combat'
    this.bump(state)
  }

  advance(): void {
    const state = this.requireCombat()
    if (state.turnOrder.length === 0) return
    this.recordHistory(
      'Zugfolge',
      { kind: 'turn', activeIndex: state.activeIndex, round: state.round },
      state.revision
    )
    for (let attempt = 0; attempt < state.turnOrder.length; attempt += 1) {
      const next = (state.activeIndex + 1) % state.turnOrder.length
      if (next === 0) state.round += 1
      state.activeIndex = next
      if (cardAlive(state.combatants, state.turnOrder[next] ?? '')) break
    }
    this.bump(state)
  }

  retreat(): void {
    const state = this.requireCombat()
    if (state.turnOrder.length === 0) return
    this.recordHistory(
      'Zugfolge',
      { kind: 'turn', activeIndex: state.activeIndex, round: state.round },
      state.revision
    )
    for (let attempt = 0; attempt < state.turnOrder.length; attempt += 1) {
      const previous =
        (state.activeIndex - 1 + state.turnOrder.length) %
        state.turnOrder.length
      if (state.activeIndex === 0 && state.round > 1) state.round -= 1
      state.activeIndex = previous
      if (cardAlive(state.combatants, state.turnOrder[previous] ?? '')) break
    }
    this.bump(state)
  }

  moveToPhase(target: 'initiative' | 'combat'): void {
    const state = this.require()
    if (target === state.phase) return
    if (target === 'combat') {
      if (state.phase !== 'resolution')
        throw new CapabilityError('validation_failed', false)
      state.phase = 'combat'
      state.resolution = null
      this.clearHistory()
      this.bump(state)
      return
    }
    state.phase = 'initiative'
    state.combatants = []
    state.turnOrder = []
    state.activeIndex = 0
    state.round = 1
    state.resolution = null
    this.clearHistory()
    this.bump(state)
  }

  adjustInitiative(id: string, initiative: number): void {
    const state = this.requireCombat()
    const activeCard = state.turnOrder[state.activeIndex]
    const previousValues = state.combatants
      .filter((combatant) => combatant.cardId === id)
      .map((combatant) => ({
        id: combatant.id,
        initiative: combatant.initiative
      }))
    let changed = false
    state.combatants = state.combatants.map((combatant) => {
      if (combatant.cardId !== id) return combatant
      changed = true
      return { ...combatant, initiative }
    })
    if (!changed) throw new CapabilityError('not_found', false)
    this.recordHistory(
      'Initiative',
      {
        kind: 'initiative',
        values: previousValues,
        turnOrder: [...state.turnOrder],
        activeIndex: state.activeIndex
      },
      state.revision
    )
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.bump(state)
  }

  changeHp(cardId: string, amount: number, healing: boolean): void {
    const state = this.requireCombat()
    const members = state.combatants
      .filter(
        (combatant) =>
          combatant.cardId === cardId &&
          !combatant.playerCharacter &&
          combatant.currentHp > 0
      )
      .sort((a, b) => a.currentHp - b.currentHp || a.name.localeCompare(b.name))
    if (members.length === 0) throw new CapabilityError('not_found', false)
    let remaining = amount
    const nextHp = new Map<string, number>()
    if (healing) {
      const target = members[0]
      if (target)
        nextHp.set(target.id, Math.min(target.maxHp, target.currentHp + amount))
    } else {
      for (const target of members) {
        if (remaining <= 0) break
        const applied = Math.min(remaining, target.currentHp)
        nextHp.set(target.id, target.currentHp - applied)
        remaining -= applied
      }
    }
    state.combatants = state.combatants.map((combatant) => ({
      ...combatant,
      currentHp: nextHp.get(combatant.id) ?? combatant.currentHp
    }))
    this.recordHistory(
      `${healing ? '+' : '−'}${amount} TP · ${members[0]?.name ?? cardId}`,
      {
        kind: 'member-states',
        states: members
          .filter((member) => nextHp.has(member.id))
          .map((member) => ({
            id: member.id,
            currentHp: member.currentHp,
            conditions: member.conditions
          }))
      },
      state.revision
    )
    this.bump(state)
  }

  toggleCondition(
    cardId: string,
    condition: CombatCondition,
    active: boolean
  ): void {
    const state = this.requireCombat()
    const target = state.combatants
      .filter(
        (combatant) =>
          combatant.cardId === cardId &&
          (combatant.playerCharacter || combatant.currentHp > 0)
      )
      .sort(
        (a, b) => a.currentHp - b.currentHp || a.name.localeCompare(b.name)
      )[0]
    if (!target) throw new CapabilityError('not_found', false)
    const conditions = new Set(target.conditions)
    if (active) conditions.add(condition)
    else conditions.delete(condition)
    state.combatants = state.combatants.map((combatant) =>
      combatant.id === target.id
        ? { ...combatant, conditions: Array.from(conditions) }
        : combatant
    )
    this.recordHistory(
      `${condition} · ${target.name}`,
      {
        kind: 'member-states',
        states: [
          {
            id: target.id,
            currentHp: target.currentHp,
            conditions: target.conditions
          }
        ]
      },
      state.revision
    )
    this.bump(state)
  }

  undo(): void {
    const current = this.require()
    const row = this.db
      .prepare(
        `
        SELECT revision, inverse_kind AS kind, inverse_payload AS payload
        FROM encounter_combat_history
        WHERE scene_id = ?
        ORDER BY revision DESC
        LIMIT 1
      `
      )
      .get(this.sceneId) as
      { revision: number; kind: string; payload: string } | undefined
    if (!row) throw new CapabilityError('validation_failed', false)
    const inverse = combatHistoryInverseSchema.parse({
      kind: row.kind,
      ...JSON.parse(row.payload)
    })
    if (inverse.kind === 'member-states') {
      const previous = new Map(inverse.states.map((state) => [state.id, state]))
      if (
        inverse.states.some(
          (state) => !current.combatants.some((entry) => entry.id === state.id)
        )
      )
        throw new CapabilityError('validation_failed', false)
      current.combatants = current.combatants.map((combatant) => {
        const state = previous.get(combatant.id)
        return state
          ? {
              ...combatant,
              currentHp: state.currentHp,
              conditions: [...state.conditions]
            }
          : combatant
      })
    } else if (inverse.kind === 'turn') {
      current.activeIndex = inverse.activeIndex
      current.round = inverse.round
    } else {
      const values = new Map(
        inverse.values.map((value) => [value.id, value.initiative])
      )
      current.combatants = current.combatants.map((combatant) => ({
        ...combatant,
        initiative: values.get(combatant.id) ?? combatant.initiative
      }))
      current.turnOrder = inverse.turnOrder
      current.activeIndex = inverse.activeIndex
    }
    current.revision += 1
    this.db
      .prepare(
        'DELETE FROM encounter_combat_history WHERE scene_id = ? AND revision = ?'
      )
      .run(this.sceneId, row.revision)
    this.save(current)
  }

  end(): void {
    const state = this.requireCombat()
    state.phase = 'resolution'
    state.resolution = {
      selectedEnemyIds: state.combatants
        .filter(
          (combatant) => !combatant.playerCharacter && combatant.currentHp === 0
        )
        .map((combatant) => combatant.id),
      mode: 'defeated',
      xpFraction: 1,
      xpAwarded: false
    }
    this.bump(state)
  }

  updateResolution(
    selectedEnemyIds: readonly string[],
    mode: 'defeated' | 'manual',
    xpFraction: number
  ): void {
    const state = this.require()
    if (state.phase !== 'resolution' || !state.resolution)
      throw new CapabilityError('validation_failed', false)
    const enemyIds = new Set(
      state.combatants
        .filter((combatant) => !combatant.playerCharacter)
        .map((combatant) => combatant.id)
    )
    if (selectedEnemyIds.some((id) => !enemyIds.has(id)))
      throw new CapabilityError('not_found', false)
    state.resolution = {
      ...state.resolution,
      selectedEnemyIds: Array.from(new Set(selectedEnemyIds)),
      mode,
      xpFraction
    }
    this.bump(state)
  }

  xpAward(members: readonly PartyMember[]): {
    combatId: string
    xpEach: number
  } {
    const state = this.require()
    if (
      state.phase !== 'resolution' ||
      !state.resolution ||
      state.resolution.xpAwarded
    )
      throw new CapabilityError('validation_failed', false)
    const partySize = members.filter((member) => member.active).length
    if (partySize === 0) throw new CapabilityError('validation_failed', false)
    const selected = new Set(state.resolution.selectedEnemyIds)
    const eligible = state.combatants
      .filter((combatant) => selected.has(combatant.id))
      .reduce((total, combatant) => total + combatant.xp, 0)
    return {
      combatId: state.id,
      xpEach: Math.floor((eligible * state.resolution.xpFraction) / partySize)
    }
  }

  markXpAwarded(): void {
    const state = this.require()
    if (!state.resolution) throw new CapabilityError('validation_failed', false)
    state.resolution = { ...state.resolution, xpAwarded: true }
    this.bump(state)
  }

  reconcileParty(members: readonly PartyMember[]): void {
    const state = this.load()
    if (!state || state.phase === 'resolution') return
    const active = members.filter((member) => member.active)
    if (state.phase === 'initiative') {
      const monsters = state.sources.filter(
        (source) => source.kind === 'monster'
      )
      const nextSources: CombatMemento['sources'] = [
        ...active.map((member, index) => ({
          kind: 'party' as const,
          rowId: `party:${member.id}`,
          partyId: member.id,
          name: member.name,
          initiative: 10 + index
        })),
        ...monsters
      ]
      if (JSON.stringify(nextSources) === JSON.stringify(state.sources)) return
      state.sources = nextSources
      this.bump(state)
      return
    }
    const activeIds = new Set(active.map((member) => member.id))
    const activeCard = state.turnOrder[state.activeIndex]
    const before = JSON.stringify(state.combatants)
    state.combatants = state.combatants.filter(
      (combatant) => !combatant.playerCharacter || activeIds.has(combatant.id)
    )
    active.forEach((member, index) => {
      if (state.combatants.some((combatant) => combatant.id === member.id))
        return
      state.combatants.push({
        id: member.id,
        cardId: `party-card:${member.id}`,
        sceneMemberId: null,
        creatureId: null,
        name: member.name,
        playerCharacter: true,
        currentHp: 0,
        maxHp: 0,
        armorClass: 0,
        initiative: 10 + index,
        xp: 0,
        detail: 'Aktives Party-Mitglied',
        conditions: [],
        order: state.combatants.length
      })
    })
    if (JSON.stringify(state.combatants) === before) return
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.bump(state)
  }

  snapshot(members: readonly PartyMember[]): CombatSnapshot | null {
    const state = this.load()
    if (!state) return null
    const cards = projectedCards(
      state.combatants,
      state.turnOrder,
      state.activeIndex
    )
    const activePartySize = Math.max(
      1,
      members.filter((member) => member.active).length
    )
    const selected = new Set(state.resolution?.selectedEnemyIds ?? [])
    const eligibleXp = state.combatants
      .filter((combatant) => selected.has(combatant.id))
      .reduce((total, combatant) => total + combatant.xp, 0)
    const awardedXp = Math.floor(
      eligibleXp * (state.resolution?.xpFraction ?? 1)
    )
    return combatSnapshotSchema.parse({
      id: state.id,
      revision: state.revision,
      phase: state.phase,
      selectedGroupIds: state.selectedGroupIds,
      initiativeRows: state.sources.map((source) => ({
        id: source.rowId,
        label:
          source.kind === 'monster' && source.quantity > 1
            ? `${source.name} × ${source.quantity}`
            : source.name,
        kind: source.kind,
        initiative: source.initiative
      })),
      cards,
      round: state.round,
      undoLabel: this.latestUndoLabel(),
      allEnemiesDefeated:
        state.combatants.some((combatant) => !combatant.playerCharacter) &&
        state.combatants
          .filter((combatant) => !combatant.playerCharacter)
          .every((combatant) => combatant.currentHp === 0),
      resolution: state.resolution
        ? {
            enemies: state.combatants
              .filter((combatant) => !combatant.playerCharacter)
              .map((combatant) => ({
                id: combatant.id,
                name: combatant.name,
                alive: combatant.currentHp > 0,
                xp: combatant.xp,
                selected: selected.has(combatant.id)
              })),
            mode: state.resolution.mode,
            xpFraction: state.resolution.xpFraction,
            eligibleXp,
            awardedXp,
            perPlayerXp: Math.floor(awardedXp / activePartySize),
            partySize: activePartySize,
            xpAwarded: state.resolution.xpAwarded,
            lootSummary:
              'Kein Loot · Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.'
          }
        : null
    })
  }

  assertRevision(expectedRevision: number): void {
    if (this.require().revision !== expectedRevision)
      throw new CapabilityError('stale', true)
  }

  clear(): void {
    clearCombatTables(this.db, this.sceneId)
    this.clearHistory()
  }

  changedGroups(): readonly string[] {
    return [...this.changedGroupIds]
  }

  private requireCombat(): CombatMemento {
    const state = this.require()
    if (state.phase !== 'combat')
      throw new CapabilityError('validation_failed', false)
    return state
  }

  private require(): CombatMemento {
    const state = this.load()
    if (!state) throw new CapabilityError('not_found', false)
    return state
  }

  private load(): CombatMemento | null {
    const root = this.db
      .prepare(
        `
        SELECT id, revision, phase, active_index AS activeIndex, round
        FROM encounter_combat_runtime WHERE scene_id = ?
      `
      )
      .get(this.sceneId) as
      | {
          id: string
          revision: number
          phase: CombatMemento['phase']
          activeIndex: number
          round: number
        }
      | undefined
    if (!root) return null
    const selectedGroupIds = (
      this.db
        .prepare(
          'SELECT group_id AS id FROM encounter_combat_selected_groups WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { id: string }[]
    ).map((row) => row.id)
    const sources = (
      this.db
        .prepare(
          `
          SELECT row_id AS rowId, source_kind AS kind, party_id AS partyId,
            group_id AS groupId, creature_id AS creatureId, initiative
          FROM encounter_combat_sources WHERE scene_id = ? ORDER BY position
        `
        )
        .all(this.sceneId) as {
        rowId: string
        kind: 'party' | 'monster'
        partyId: string | null
        groupId: string | null
        creatureId: string | null
        initiative: number
      }[]
    ).map((row) => {
      if (row.kind === 'party') {
        const member = this.party
          .read()
          .members.find((candidate) => candidate.id === row.partyId)
        if (!member) throw new CapabilityError('not_found', false)
        return {
          kind: 'party' as const,
          rowId: row.rowId,
          partyId: member.id,
          name: member.name,
          initiative: row.initiative
        }
      }
      const creature = row.creatureId ? creatureById(row.creatureId) : null
      const entry = this.scene
        .groups(this.sceneId)
        .flatMap((group) => group.entries)
        .find((candidate) => `monster:${candidate.id}` === row.rowId)
      if (!creature || !entry) throw new CapabilityError('not_found', false)
      return {
        kind: 'monster' as const,
        rowId: row.rowId,
        groupId: row.groupId,
        creatureId: creature.id,
        name: creature.name,
        quantity: entry.members.length,
        memberIds: entry.members.map((member) => member.id),
        initiative: row.initiative
      }
    })
    const combatants = this.db
      .prepare(
        `
        SELECT id, card_id AS cardId, scene_member_id AS sceneMemberId,
          party_id AS partyId, initiative,
          combat_order AS "order"
        FROM encounter_combatants WHERE scene_id = ? ORDER BY combat_order
      `
      )
      .all(this.sceneId)
      .flatMap((row): Combatant[] => {
        const raw = row as {
          id: string
          cardId: string
          sceneMemberId: string | null
          partyId: string | null
          initiative: number
          order: number
        }
        if (raw.sceneMemberId) {
          const member = this.scene.combatMember(raw.sceneMemberId)
          const creature = member ? creatureById(member.creatureId) : null
          if (!member || !creature) return []
          return [
            {
              id: member.id,
              cardId: raw.cardId,
              sceneMemberId: member.id,
              creatureId: creature.id,
              name: creature.name,
              playerCharacter: false,
              currentHp: member.currentHp,
              maxHp: creature.hp,
              armorClass: creature.ac,
              initiative: raw.initiative,
              xp: creature.xp,
              detail: `CR ${creature.cr} · ${creature.type}`,
              conditions: member.conditions,
              order: raw.order
            }
          ]
        }
        const member = this.party
          .read()
          .members.find((candidate) => candidate.id === raw.partyId)
        if (!member) throw new CapabilityError('not_found', false)
        return [
          {
            id: member.id,
            cardId: raw.cardId,
            sceneMemberId: null,
            creatureId: null,
            name: member.name,
            playerCharacter: true,
            currentHp: 0,
            maxHp: 0,
            armorClass: member.armorClass ?? 0,
            initiative: raw.initiative,
            xp: 0,
            detail: 'Aktives Party-Mitglied',
            conditions: [],
            order: raw.order
          }
        ]
      })
    const turnOrder = (
      this.db
        .prepare(
          'SELECT card_id AS cardId FROM encounter_combat_turn_order WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { cardId: string }[]
    ).map((row) => row.cardId)
    const resolutionRow = this.db
      .prepare(
        `
        SELECT threshold_mode AS mode,
          xp_fraction AS xpFraction, xp_awarded AS xpAwarded
        FROM encounter_combat_resolution WHERE scene_id = ?
      `
      )
      .get(this.sceneId) as
      | {
          mode: 'defeated' | 'manual'
          xpFraction: number
          xpAwarded: number
        }
      | undefined
    const selectedEnemyIds = (
      this.db
        .prepare(
          'SELECT enemy_id AS id FROM encounter_combat_resolution_enemies WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { id: string }[]
    ).map((row) => row.id)
    return combatMementoSchema.parse({
      ...root,
      selectedGroupIds,
      sources,
      combatants,
      turnOrder,
      resolution: resolutionRow
        ? {
            selectedEnemyIds,
            mode: resolutionRow.mode,
            xpFraction: resolutionRow.xpFraction,
            xpAwarded: resolutionRow.xpAwarded === 1
          }
        : null
    })
  }

  private bump(state: CombatMemento): void {
    state.revision += 1
    this.save(state)
  }

  private sceneMemberState(memberId: string): {
    currentHp: number
    conditions: string[]
  } | null {
    const row = this.scene.memberState(memberId)
    return row
      ? {
          currentHp: row.currentHp,
          conditions: z.array(z.string()).parse(row.conditions)
        }
      : null
  }

  private persistSceneMemberStates(state: CombatMemento): void {
    const changed = this.scene.updateMemberStates(
      state.combatants.flatMap((combatant) =>
        combatant.sceneMemberId
          ? [
              {
                id: combatant.sceneMemberId,
                currentHp: combatant.currentHp,
                conditions: combatant.conditions
              }
            ]
          : []
      )
    )
    for (const groupId of changed) this.changedGroupIds.add(groupId)
  }

  private save(state: CombatMemento): void {
    this.persistSceneMemberStates(state)
    persistCombat(this.db, this.sceneId, combatMementoSchema.parse(state))
  }

  private recordHistory(
    label: string,
    inverse: CombatHistoryInverse,
    revision: number
  ): void {
    const parsed = combatHistoryInverseSchema.parse(inverse)
    const { kind, ...payload } = parsed
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO encounter_combat_history (
          scene_id, revision, label, inverse_kind, inverse_payload
        ) VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(this.sceneId, revision, label, kind, JSON.stringify(payload))
    this.db
      .prepare(
        `
        DELETE FROM encounter_combat_history
        WHERE scene_id = ? AND revision NOT IN (
          SELECT revision FROM encounter_combat_history
          WHERE scene_id = ? ORDER BY revision DESC LIMIT 20
        )
      `
      )
      .run(this.sceneId, this.sceneId)
  }

  private latestUndoLabel(): string | null {
    const row = this.db
      .prepare(
        `
        SELECT label FROM encounter_combat_history
        WHERE scene_id = ? ORDER BY revision DESC LIMIT 1
      `
      )
      .get(this.sceneId) as { label: string } | undefined
    return row?.label ?? null
  }

  private clearHistory(): void {
    this.db
      .prepare('DELETE FROM encounter_combat_history WHERE scene_id = ?')
      .run(this.sceneId)
  }
}

function clearCombatTables(db: Database.Database, sceneId: string): void {
  const tables = [
    'encounter_combat_resolution_enemies',
    'encounter_combat_resolution',
    'encounter_combat_turn_order',
    'encounter_combatants',
    'encounter_combat_sources',
    'encounter_combat_selected_groups',
    'encounter_combat_runtime'
  ] as const
  for (const table of tables)
    db.prepare(`DELETE FROM ${table} WHERE scene_id = ?`).run(sceneId)
}

function persistCombat(
  db: Database.Database,
  sceneId: string,
  state: CombatMemento
): void {
  const persist = () => {
    clearCombatTables(db, sceneId)
    db.prepare(
      `
      INSERT INTO encounter_combat_runtime (
        scene_id, id, revision, phase, active_index, round
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      sceneId,
      state.id,
      state.revision,
      state.phase,
      state.activeIndex,
      state.round
    )
    const group = db.prepare(
      'INSERT INTO encounter_combat_selected_groups (scene_id, group_id, position) VALUES (?, ?, ?)'
    )
    state.selectedGroupIds.forEach((id, position) =>
      group.run(sceneId, id, position)
    )
    const source = db.prepare(`
      INSERT INTO encounter_combat_sources (
        scene_id, row_id, source_kind, party_id, group_id, creature_id,
        initiative, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    state.sources.forEach((entry, position) =>
      source.run(
        sceneId,
        entry.rowId,
        entry.kind,
        entry.kind === 'party' ? entry.partyId : null,
        entry.kind === 'monster' ? entry.groupId : null,
        entry.kind === 'monster' ? entry.creatureId : null,
        entry.initiative,
        position
      )
    )
    const combatant = db.prepare(`
      INSERT INTO encounter_combatants (
        scene_id, id, card_id, scene_member_id, party_id, initiative,
        combat_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    state.combatants.forEach((entry) =>
      combatant.run(
        sceneId,
        entry.id,
        entry.cardId,
        entry.sceneMemberId,
        entry.playerCharacter ? entry.id : null,
        entry.initiative,
        entry.order
      )
    )
    const turn = db.prepare(
      'INSERT INTO encounter_combat_turn_order (scene_id, position, card_id) VALUES (?, ?, ?)'
    )
    state.turnOrder.forEach((id, position) => turn.run(sceneId, position, id))
    if (state.resolution) {
      db.prepare(
        `
        INSERT INTO encounter_combat_resolution (
          scene_id, threshold_mode, xp_fraction, xp_awarded
        ) VALUES (?, ?, ?, ?)
      `
      ).run(
        sceneId,
        state.resolution.mode,
        state.resolution.xpFraction,
        state.resolution.xpAwarded ? 1 : 0
      )
      const selected = db.prepare(
        'INSERT INTO encounter_combat_resolution_enemies (scene_id, enemy_id, position) VALUES (?, ?, ?)'
      )
      state.resolution.selectedEnemyIds.forEach((id, position) =>
        selected.run(sceneId, id, position)
      )
    }
  }
  if (db.inTransaction) persist()
  else db.transaction(persist)()
}

function mobSizes(quantity: number): readonly number[] {
  if (quantity <= 3) return Array.from({ length: quantity }, () => 1)
  const groups = Math.ceil(quantity / 10)
  const base = Math.floor(quantity / groups)
  const remainder = quantity % groups
  return Array.from(
    { length: groups },
    (_, index) => base + (index < remainder ? 1 : 0)
  )
}

function sortedCardIds(combatants: readonly Combatant[]): string[] {
  const cards = new Map<string, Combatant>()
  for (const combatant of combatants)
    if (!cards.has(combatant.cardId)) cards.set(combatant.cardId, combatant)
  return Array.from(cards.values())
    .sort((a, b) => b.initiative - a.initiative || a.order - b.order)
    .map((combatant) => combatant.cardId)
}

function cardAlive(combatants: readonly Combatant[], cardId: string): boolean {
  return combatants.some(
    (combatant) =>
      combatant.cardId === cardId &&
      (combatant.playerCharacter || combatant.currentHp > 0)
  )
}

function projectedCards(
  combatants: readonly Combatant[],
  turnOrder: readonly string[],
  activeIndex: number
) {
  const order = new Map(turnOrder.map((cardId, index) => [cardId, index]))
  const activeCard = turnOrder[activeIndex]
  const grouped = new Map<string, Combatant[]>()
  for (const combatant of combatants) {
    const values = grouped.get(combatant.cardId) ?? []
    values.push(combatant)
    grouped.set(combatant.cardId, values)
  }
  return Array.from(grouped.entries())
    .map(([id, values]) => {
      const first = values[0]
      if (!first) throw new Error('invalid combat card')
      const alive = values.filter(
        (value) => value.playerCharacter || value.currentHp > 0
      )
      const front = alive.toSorted(
        (a, b) => a.currentHp - b.currentHp || a.name.localeCompare(b.name)
      )[0]
      return {
        id,
        creatureId: first.creatureId,
        memberIds: values.map((value) => value.id),
        name: values.length > 1 ? first.name.replace(/ #\d+$/, '') : first.name,
        playerCharacter: first.playerCharacter,
        active: id === activeCard,
        done: (order.get(id) ?? 0) < activeIndex,
        alive: alive.length > 0,
        currentHp: front?.currentHp ?? 0,
        maxHp: front?.maxHp ?? first.maxHp,
        armorClass: first.armorClass,
        initiative: first.initiative,
        count: values.length,
        aliveCount: alive.length,
        conditions: front?.conditions ?? [],
        detail: first.detail
      }
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

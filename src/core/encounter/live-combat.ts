import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  combatSnapshotSchema,
  liveSessionSnapshotSchema,
  type CombatSnapshot,
  type LiveSessionSnapshot,
  type PartyMember
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
  SceneGroupDraftGeneration
} from '../../shared/contracts/scene.js'
import { creatureById } from '../creatures/catalog.js'
import {
  calculateAdventuringDay,
  initializePartySchema,
  PartyStore
} from '../party/party-store.js'
import { initializeSceneSchema, SceneStore } from '../scene/scene-store.js'
import {
  evaluateSceneGroupDraft,
  evaluateSceneGroups,
  generateSceneGroupDraft
} from '../scene/group-generator.js'
import {
  initializeWorldLocationSchema,
  WorldLocationStore
} from '../worldplanner/location-store.js'
import {
  initializeEncounterSourceSchema,
  resolveEncounterSource
} from '../worldplanner/encounter-source-store.js'

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
      creatureId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      initiative: z.number().int()
    })
    .strict()
])

const combatantSchema = z
  .object({
    id: z.string(),
    cardId: z.string(),
    name: z.string(),
    playerCharacter: z.boolean(),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().nonnegative(),
    armorClass: z.number().int().nonnegative(),
    initiative: z.number().int(),
    xp: z.number().int().nonnegative(),
    detail: z.string(),
    order: z.number().int().nonnegative()
  })
  .strict()

const resolutionStateSchema = z
  .object({
    selectedEnemyIds: z.array(z.string()),
    thresholdFraction: z.number().min(0).max(1),
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

export function initializeCombatSchema(db: Database.Database): void {
  const runtimeColumns = db
    .prepare("PRAGMA table_info('encounter_combat_runtime')")
    .all() as { name: string }[]
  if (
    runtimeColumns.length > 0 &&
    !runtimeColumns.some((column) => column.name === 'scene_id')
  ) {
    db.exec(`
      DROP TABLE IF EXISTS encounter_combat_resolution_enemies;
      DROP TABLE IF EXISTS encounter_combat_resolution;
      DROP TABLE IF EXISTS encounter_combat_turn_order;
      DROP TABLE IF EXISTS encounter_combatants;
      DROP TABLE IF EXISTS encounter_combat_sources;
      DROP TABLE IF EXISTS encounter_combat_selected_groups;
      DROP TABLE IF EXISTS encounter_combat_runtime;
      DROP TABLE IF EXISTS live_combat_runtime;
    `)
  }
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
      creature_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER,
      initiative INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, row_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combatants (
      scene_id TEXT NOT NULL,
      id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      name TEXT NOT NULL,
      player_character INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      armor_class INTEGER NOT NULL,
      initiative INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      detail TEXT NOT NULL,
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
      threshold_fraction REAL NOT NULL,
      xp_fraction REAL NOT NULL,
      xp_awarded INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_resolution_enemies (
      scene_id TEXT NOT NULL,
      enemy_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, enemy_id)
    );
  `)
}

export class LivePlayService {
  constructor(private readonly campaignPath: () => string) {}

  readParty() {
    return this.withStores(({ party }) => party.read())
  }

  setMembership(id: string, active: boolean, expectedRevision: number) {
    return this.withStores(({ party, scene, combat }) => {
      const snapshot = party.setMembership(id, active, expectedRevision)
      if (!active) scene.unassignPartyMember(id)
      combat.reconcileParty(scene.assignedParty(snapshot.members))
      return snapshot
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
        throw new Error('not found')
      scene.setLocation(sceneId, locationId, expectedRevision)
      return this.snapshotFrom(party, scene, combat)
    })
  }

  saveSceneGroup(
    sceneId: string,
    groupId: string | null,
    name: string,
    entries: readonly { creatureId: string; quantity: number }[],
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      scene.saveGroup(sceneId, groupId, name, entries, expectedRevision)
      return this.snapshotFrom(party, scene, combat)
    })
  }

  deleteSceneGroup(
    sceneId: string,
    groupId: string,
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      scene.deleteGroup(sceneId, groupId, expectedRevision)
      return this.snapshotFrom(party, scene, combat)
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
      if (scene.revision() !== expectedRevision) throw new Error('stale')
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new Error('not found')
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
        resolveEncounterSource(scene.database(), resolvedFilters)
      )
    })
  }

  evaluateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    expectedRevision: number
  ): SceneGroupDraftEvaluation {
    return this.withStores(({ party, scene }) => {
      if (scene.revision() !== expectedRevision) throw new Error('stale')
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new Error('not found')
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
      if (scene.revision() !== expectedRevision) throw new Error('stale')
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new Error('not found')
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
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      if (scene.revision() !== expectedSceneRevision) throw new Error('stale')
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new Error('not found')
      const assigned = scene.assignedParty(partySnapshot.members, sceneId)
      const evaluation = evaluateSceneGroups(focused, assigned, groupIds)
      if (!evaluation.canStart) throw new Error('validation')
      combat.prepare(assigned, focused.groups, groupIds)
      return this.snapshotFrom(party, scene, combat)
    })
  }

  rollInitiative(expectedRevision: number): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) => combat.roll())
  }

  confirmInitiative(
    expectedRevision: number,
    values: readonly { id: string; initiative: number }[]
  ): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.confirmInitiative(values)
    )
  }

  advanceTurn(expectedRevision: number): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) => combat.advance())
  }

  adjustInitiative(
    expectedRevision: number,
    id: string,
    initiative: number
  ): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.adjustInitiative(id, initiative)
    )
  }

  changeHp(
    expectedRevision: number,
    cardId: string,
    amount: number,
    healing: boolean
  ): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.changeHp(cardId, amount, healing)
    )
  }

  endCombat(expectedRevision: number): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) => combat.end())
  }

  updateResolution(
    expectedRevision: number,
    selectedEnemyIds: readonly string[],
    thresholdFraction: number,
    xpFraction: number
  ): LiveSessionSnapshot {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.updateResolution(selectedEnemyIds, thresholdFraction, xpFraction)
    )
  }

  awardXp(expectedRevision: number): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      combat.assertRevision(expectedRevision)
      const assigned = scene.assignedParty(party.read().members)
      const award = combat.xpAward(assigned)
      party.awardCombatXp(
        award.combatId,
        award.xpEach,
        assigned.map((member) => member.id)
      )
      combat.markXpAwarded()
      return this.snapshotFrom(party, scene, combat)
    })
  }

  completeCombat(expectedRevision: number): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      combat.assertRevision(expectedRevision)
      combat.clear()
      return this.snapshotFrom(party, scene, combat)
    })
  }

  private mutateCombat(
    expectedRevision: number,
    mutation: (combat: CombatStore) => void
  ): LiveSessionSnapshot {
    return this.withStores(({ party, scene, combat }) => {
      combat.assertRevision(expectedRevision)
      mutation(combat)
      return this.snapshotFrom(party, scene, combat)
    })
  }

  private snapshotFrom(
    party: PartyStore,
    scene: SceneStore,
    combat: CombatStore
  ): LiveSessionSnapshot {
    const partySnapshot = party.read()
    const sceneSnapshot = scene.snapshot(partySnapshot.members)
    return liveSessionSnapshotSchema.parse({
      revision: sceneSnapshot.revision,
      party: partySnapshot,
      scene: sceneSnapshot,
      travel: {
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
    }) => T
  ): T {
    const db = new Database(this.campaignPath())
    db.pragma('foreign_keys = ON')
    try {
      initializePartySchema(db)
      initializeSceneSchema(db)
      initializeCombatSchema(db)
      initializeWorldLocationSchema(db)
      initializeEncounterSourceSchema(db)
      const locations = new WorldLocationStore(db)
      const scene = new SceneStore(db, () => locations.read().locations)
      const combatFor = (sceneId: string) => new CombatStore(db, sceneId)
      return work({
        party: new PartyStore(db),
        scene,
        combat: combatFor(scene.focusedSceneId()),
        combatFor,
        locations
      })
    } finally {
      db.close()
    }
  }
}

class CombatStore {
  constructor(
    private readonly db: Database.Database,
    private readonly sceneId: string
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
        available: boolean
      }[]
    }[],
    groupIds: readonly string[]
  ): void {
    const party = members.filter((member) => member.active)
    if (party.length === 0) throw new Error('validation')
    const selected = Array.from(new Set(groupIds))
    const chosenGroups = selected.map((id) =>
      groups.find((group) => group.id === id)
    )
    if (chosenGroups.some((group) => group === undefined))
      throw new Error('not found')
    const sources: CombatMemento['sources'] = party.map((member, index) => ({
      kind: 'party',
      rowId: `party:${member.id}`,
      partyId: member.id,
      name: member.name,
      initiative: 10 + index
    }))
    for (const group of chosenGroups) {
      for (const entry of group?.entries ?? []) {
        const creature = creatureById(entry.creatureId)
        if (!entry.available || !creature) throw new Error('not found')
        sources.push({
          kind: 'monster',
          rowId: `monster:${entry.id}`,
          creatureId: creature.id,
          name: creature.name,
          quantity: entry.quantity,
          initiative: 12 + Math.max(-3, Math.min(6, creature.initiative))
        })
      }
    }
    if (!sources.some((source) => source.kind === 'monster'))
      throw new Error('validation')
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

  prepareRoster(
    members: readonly PartyMember[],
    roster: readonly {
      creatureId: string
      name: string
      quantity: number
      available: boolean
    }[]
  ): void {
    const party = members.filter((member) => member.active)
    if (party.length === 0 || roster.length === 0) throw new Error('validation')
    const sources: CombatMemento['sources'] = party.map((member, index) => ({
      kind: 'party',
      rowId: `party:${member.id}`,
      partyId: member.id,
      name: member.name,
      initiative: 10 + index
    }))
    roster.forEach((entry) => {
      const creature = creatureById(entry.creatureId)
      if (!entry.available || !creature) throw new Error('not found')
      sources.push({
        kind: 'monster',
        rowId: `monster:builder:${entry.creatureId}`,
        creatureId: entry.creatureId,
        name: entry.name,
        quantity: entry.quantity,
        initiative: 12 + Math.max(-3, Math.min(6, creature.initiative))
      })
    })
    this.save({
      id: uuidv7(),
      revision: 0,
      phase: 'initiative',
      selectedGroupIds: [],
      sources,
      combatants: [],
      turnOrder: [],
      activeIndex: 0,
      round: 1,
      resolution: null
    })
  }

  addReinforcement(creatureId: string, quantity: number): void {
    const state = this.requireCombat()
    const creature = creatureById(creatureId)
    if (!creature) throw new Error('not found')
    const activeCard = state.turnOrder[state.activeIndex]
    const initiative = creature.initiative
    const sourceId = `monster:reinforcement:${uuidv7()}`
    state.sources.push({
      kind: 'monster',
      rowId: sourceId,
      creatureId,
      name: creature.name,
      quantity,
      initiative
    })
    let ordinal = 1
    for (const size of mobSizes(quantity)) {
      const cardId = `monster-card:${uuidv7()}`
      for (let member = 0; member < size; member += 1) {
        state.combatants.push({
          id: `monster-member:${uuidv7()}`,
          cardId,
          name:
            quantity === 1 ? creature.name : `${creature.name} #${ordinal++}`,
          playerCharacter: false,
          currentHp: creature.hp,
          maxHp: creature.hp,
          armorClass: creature.ac,
          initiative,
          xp: creature.xp,
          detail: `CR ${creature.challengeRating} · ${creature.type}`,
          order: state.combatants.length
        })
      }
    }
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.bump(state)
  }

  roll(): void {
    const state = this.require()
    if (state.phase !== 'initiative') throw new Error('validation')
    const values = [13, 15, 17, 19, 11]
    state.sources = state.sources.map((source, index) => ({
      ...source,
      initiative: values[index % values.length] ?? 13
    }))
    this.bump(state)
  }

  confirmInitiative(
    values: readonly { id: string; initiative: number }[]
  ): void {
    const state = this.require()
    if (state.phase !== 'initiative') throw new Error('validation')
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
          name: source.name,
          playerCharacter: true,
          currentHp: 0,
          maxHp: 0,
          armorClass: 0,
          initiative: source.initiative,
          xp: 0,
          detail: 'Aktives Party-Mitglied',
          order: order++
        })
        continue
      }
      const creature = creatureById(source.creatureId)
      if (!creature) throw new Error('not found')
      let ordinal = 1
      for (const size of mobSizes(source.quantity)) {
        const cardId = `monster-card:${uuidv7()}`
        for (let member = 0; member < size; member += 1) {
          const name =
            source.quantity === 1
              ? creature.name
              : `${creature.name} #${ordinal++}`
          combatants.push({
            id: `monster-member:${uuidv7()}`,
            cardId,
            name,
            playerCharacter: false,
            currentHp: creature.hp,
            maxHp: creature.hp,
            armorClass: creature.ac,
            initiative: source.initiative,
            xp: creature.xp,
            detail: `CR ${creature.cr} · ${creature.type}`,
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
    for (let attempt = 0; attempt < state.turnOrder.length; attempt += 1) {
      const next = (state.activeIndex + 1) % state.turnOrder.length
      if (next === 0) state.round += 1
      state.activeIndex = next
      if (cardAlive(state.combatants, state.turnOrder[next] ?? '')) break
    }
    this.bump(state)
  }

  adjustInitiative(id: string, initiative: number): void {
    const state = this.requireCombat()
    const activeCard = state.turnOrder[state.activeIndex]
    let changed = false
    state.combatants = state.combatants.map((combatant) => {
      if (combatant.cardId !== id) return combatant
      changed = true
      return { ...combatant, initiative }
    })
    if (!changed) throw new Error('not found')
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
    if (members.length === 0) throw new Error('not found')
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
    this.bump(state)
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
      thresholdFraction: 1,
      xpFraction: 1,
      xpAwarded: false
    }
    this.bump(state)
  }

  updateResolution(
    selectedEnemyIds: readonly string[],
    thresholdFraction: number,
    xpFraction: number
  ): void {
    const state = this.require()
    if (state.phase !== 'resolution' || !state.resolution)
      throw new Error('validation')
    const enemyIds = new Set(
      state.combatants
        .filter((combatant) => !combatant.playerCharacter)
        .map((combatant) => combatant.id)
    )
    if (selectedEnemyIds.some((id) => !enemyIds.has(id)))
      throw new Error('not found')
    state.resolution = {
      ...state.resolution,
      selectedEnemyIds: Array.from(new Set(selectedEnemyIds)),
      thresholdFraction,
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
      throw new Error('validation')
    const partySize = members.filter((member) => member.active).length
    if (partySize === 0) throw new Error('validation')
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
    if (!state.resolution) throw new Error('validation')
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
        name: member.name,
        playerCharacter: true,
        currentHp: 0,
        maxHp: 0,
        armorClass: 0,
        initiative: 10 + index,
        xp: 0,
        detail: 'Aktives Party-Mitglied',
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
    const activeCard = state.turnOrder[state.activeIndex]
    const cards = projectedCards(state.combatants, activeCard)
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
            thresholdFraction: state.resolution.thresholdFraction,
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
    if (this.require().revision !== expectedRevision) throw new Error('stale')
  }

  clear(): void {
    clearCombatTables(this.db, this.sceneId)
  }

  private requireCombat(): CombatMemento {
    const state = this.require()
    if (state.phase !== 'combat') throw new Error('validation')
    return state
  }

  private require(): CombatMemento {
    const state = this.load()
    if (!state) throw new Error('not found')
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
            creature_id AS creatureId, name, quantity, initiative
          FROM encounter_combat_sources WHERE scene_id = ? ORDER BY position
        `
        )
        .all(this.sceneId) as {
        rowId: string
        kind: 'party' | 'monster'
        partyId: string | null
        creatureId: string | null
        name: string
        quantity: number | null
        initiative: number
      }[]
    ).map((row) =>
      row.kind === 'party'
        ? {
            kind: 'party' as const,
            rowId: row.rowId,
            partyId: row.partyId,
            name: row.name,
            initiative: row.initiative
          }
        : {
            kind: 'monster' as const,
            rowId: row.rowId,
            creatureId: row.creatureId,
            name: row.name,
            quantity: row.quantity,
            initiative: row.initiative
          }
    )
    const combatants = this.db
      .prepare(
        `
        SELECT id, card_id AS cardId, name,
          player_character AS playerCharacter, current_hp AS currentHp,
          max_hp AS maxHp, armor_class AS armorClass, initiative, xp, detail,
          combat_order AS "order"
        FROM encounter_combatants WHERE scene_id = ? ORDER BY combat_order
      `
      )
      .all(this.sceneId)
      .map((row) => ({
        ...(row as Combatant),
        playerCharacter:
          Number((row as { playerCharacter: number }).playerCharacter) === 1
      }))
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
        SELECT threshold_fraction AS thresholdFraction,
          xp_fraction AS xpFraction, xp_awarded AS xpAwarded
        FROM encounter_combat_resolution WHERE scene_id = ?
      `
      )
      .get(this.sceneId) as
      | { thresholdFraction: number; xpFraction: number; xpAwarded: number }
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
            thresholdFraction: resolutionRow.thresholdFraction,
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

  private save(state: CombatMemento): void {
    persistCombat(this.db, this.sceneId, combatMementoSchema.parse(state))
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
  db.transaction(() => {
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
        scene_id, row_id, source_kind, party_id, creature_id, name, quantity,
        initiative, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    state.sources.forEach((entry, position) =>
      source.run(
        sceneId,
        entry.rowId,
        entry.kind,
        entry.kind === 'party' ? entry.partyId : null,
        entry.kind === 'monster' ? entry.creatureId : null,
        entry.name,
        entry.kind === 'monster' ? entry.quantity : null,
        entry.initiative,
        position
      )
    )
    const combatant = db.prepare(`
      INSERT INTO encounter_combatants (
        scene_id, id, card_id, name, player_character, current_hp, max_hp, armor_class,
        initiative, xp, detail, combat_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    state.combatants.forEach((entry) =>
      combatant.run(
        sceneId,
        entry.id,
        entry.cardId,
        entry.name,
        entry.playerCharacter ? 1 : 0,
        entry.currentHp,
        entry.maxHp,
        entry.armorClass,
        entry.initiative,
        entry.xp,
        entry.detail,
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
          scene_id, threshold_fraction, xp_fraction, xp_awarded
        ) VALUES (?, ?, ?, ?)
      `
      ).run(
        sceneId,
        state.resolution.thresholdFraction,
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
  })()
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
  activeCard: string | undefined
) {
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
      return {
        id,
        memberIds: values.map((value) => value.id),
        name: values.length > 1 ? first.name.replace(/ #\d+$/, '') : first.name,
        playerCharacter: first.playerCharacter,
        active: id === activeCard,
        alive: alive.length > 0,
        currentHp: values.reduce((total, value) => total + value.currentHp, 0),
        maxHp: values.reduce((total, value) => total + value.maxHp, 0),
        armorClass: first.armorClass,
        initiative: first.initiative,
        count: values.length,
        detail: first.detail
      }
    })
    .sort(
      (a, b) =>
        b.initiative - a.initiative ||
        Number(b.playerCharacter) - Number(a.playerCharacter) ||
        a.name.localeCompare(b.name)
    )
}

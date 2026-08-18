import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { HexMapStore } from '../hex/hex-map-store.js'
import { HexTravelStore } from '../hex/hex-travel.js'
import { biomeDefinition as defaultBiomeDefinition } from '../hex/biome-catalog.js'
import type {
  HexBiomeDefinition,
  HexBiomeId
} from '../../shared/contracts/hex.js'
import {
  combatCommandResultSchema,
  liveSessionSnapshotSchema,
  sceneGroupCommandResultSchema,
  type CombatCondition,
  type CombatCommandResult,
  type LiveSessionSnapshot,
  type SceneGroupCommandResult
} from '../../shared/contracts/live-session.js'
import type { PartyCharacterDraft } from '../../shared/contracts/party.js'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../shared/contracts/encounter-tuning.js'
import type {
  EncounterSelectionEvaluation,
  GroupGenerationMode,
  SceneGroupDraftEntry,
  SceneGroupDraftEvaluation,
  SceneGroupDraftGeneration,
  SceneGroupDisposition
} from '../../shared/contracts/scene.js'
import { calculateAdventuringDay, PartyStore } from '../party/party-store.js'
import { SceneStore } from '../scene/scene-store.js'
import {
  evaluateSceneGroupDraft,
  evaluateSceneGroups,
  generateSceneGroupDraft
} from '../scene/group-generator.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { EncounterSourceService } from '../application/encounter-source-service.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetConfigV3
} from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'
import { resolveEncounterTuning } from '../../shared/contracts/encounter-tuning.js'
import { CampaignUnitOfWork } from '../application/campaign-unit-of-work.js'
export { initializeCombatSchema } from './combat-repository.js'
import { CombatService } from './combat-service.js'
import { SqliteGroupTreasureReader } from '../loot/group-treasure-reader.js'
import { readCampaignRules } from '../application/campaign-rules-service.js'
import {
  sqliteDatabaseAccess,
  type SqliteDatabaseAccess
} from '../persistence/sqlite/database-access.js'

export class LivePlayService {
  constructor(
    private readonly campaignDatabase: SqliteDatabaseAccess,
    private readonly biomeDefinition: (
      id: HexBiomeId
    ) => HexBiomeDefinition = defaultBiomeDefinition,
    private readonly generatorConfig: () =>
      | GeneratorPresetConfigV3
      | {
          config: GeneratorPresetConfigV3
          id: string
          revision: number
        } = () => defaultGeneratorConfig
  ) {}

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
    return this.withStores(({ db, party, scene, combat }) =>
      this.snapshotFrom(db, party, scene, combat)
    )
  }

  focusScene(sceneId: string, expectedRevision: number): LiveSessionSnapshot {
    return this.withStores(({ db, party, scene, combatFor }) => {
      scene.focus(sceneId, expectedRevision)
      return this.snapshotFrom(db, party, scene, combatFor(sceneId))
    })
  }

  setSceneLocation(
    sceneId: string,
    locationId: string | null,
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ db, party, scene, combat, locations }) => {
      if (
        locationId !== null &&
        !locations
          .read()
          .locations.some((location) => location.id === locationId)
      )
        throw new CapabilityError('not_found', false)
      scene.setLocation(sceneId, locationId, expectedRevision)
      return this.snapshotFrom(db, party, scene, combat)
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
    expectedGroupRevision: number | null,
    prospectiveGroupId?: string
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
          expectedGroupRevision,
          prospectiveGroupId
        )
        if (groupId && combat.includesGroup(groupId)) {
          const updated = scene
            .groups(sceneId)
            .find((group) => group.id === groupId)
          if (updated) combat.reconcileGroup(updated)
        }
        return this.sceneGroupResultFromStores(party, scene, combat, sceneId, [
          savedId
        ])
      })
    })
  }

  sceneGroupResult(
    sceneId: string,
    groupIds: readonly string[]
  ): SceneGroupCommandResult {
    return this.withStores(({ party, scene, combatFor }) =>
      this.sceneGroupResultFromStores(
        party,
        scene,
        combatFor(sceneId),
        sceneId,
        groupIds
      )
    )
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
        return this.sceneGroupResultFromStores(party, scene, combat, sceneId, [
          groupId
        ])
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
      return this.sceneGroupResultFromStores(party, scene, combat, sceneId, [
        groupId
      ])
    })
  }

  assignScenePartyMember(
    sceneId: string,
    partyMemberId: string,
    assigned: boolean,
    expectedRevision: number
  ): LiveSessionSnapshot {
    return this.withStores(({ db, party, scene, combat }) => {
      scene.assignPartyMember(
        sceneId,
        partyMemberId,
        assigned,
        expectedRevision
      )
      combat.reconcileParty(scene.assignedParty(party.read().members, sceneId))
      return this.snapshotFrom(db, party, scene, combat)
    })
  }

  generateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    mode: GroupGenerationMode,
    filters: CreatureCatalogQuery,
    tuningOverride: EncounterTuningOverride,
    seed: number,
    expectedRevision: number
  ): SceneGroupDraftGeneration {
    return this.withStores(({ db, party, scene }) => {
      if (scene.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      const partySnapshot = party.read()
      const focused = scene.focused(partySnapshot.members)
      if (focused.id !== sceneId) throw new CapabilityError('not_found', false)
      const resolvedFilters = { ...filters }
      const preset = this.effectiveGeneratorPreset()
      const tuning = resolveEncounterTuning(
        tuningOverride,
        preset.config.generationDefaults
      )
      return generateSceneGroupDraft(
        focused,
        scene.assignedParty(partySnapshot.members, sceneId),
        entries,
        mode,
        resolvedFilters,
        { ...preset.config, generationDefaults: tuning },
        seed,
        expectedRevision,
        new EncounterSourceService(
          sqliteDatabaseAccess((visitor) => visitor(db))
        ).resolve(resolvedFilters),
        { id: preset.id, revision: preset.revision }
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

  setCombatConcentration(
    expectedRevision: number,
    cardId: string,
    concentrating: boolean
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.setConcentration(cardId, concentrating)
    )
  }

  setCombatExhaustion(
    expectedRevision: number,
    cardId: string,
    exhaustionLevel: number
  ): CombatCommandResult {
    return this.mutateCombat(expectedRevision, (combat) =>
      combat.setExhaustion(cardId, exhaustionLevel)
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

  awardXp(
    expectedRevision: number,
    expectedCampaignRulesRevision: number
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork, rules }) => {
      return unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        if (rules.revision !== expectedCampaignRulesRevision)
          throw new CapabilityError('stale', true)
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
    mutation: (combat: CombatService) => void
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
    combat: CombatService,
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

  private sceneGroupResultFromStores(
    party: PartyStore,
    scene: SceneStore,
    combat: CombatService,
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
    db: Database.Database,
    party: PartyStore,
    scene: SceneStore,
    combat: CombatService,
    hexTravel?: HexTravelStore
  ): LiveSessionSnapshot {
    const travel = (
      hexTravel ??
      new HexTravelStore(
        db,
        new HexMapStore(db, new WorldLocationStore(db)),
        party,
        scene,
        Date.now,
        this.biomeDefinition
      )
    ).read(scene.focusedSceneId())
    const partySnapshot = party.read()
    const sceneSnapshot = scene.snapshot(partySnapshot.members)
    const focusedScene = sceneSnapshot.scenes.find(
      (candidate) => candidate.id === sceneSnapshot.focusedSceneId
    )
    if (!focusedScene) throw new CapabilityError('not_found', false)
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
            hintCode: travel.hintCode
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
      db: Database.Database
      party: PartyStore
      scene: SceneStore
      combat: CombatService
      combatFor: (sceneId: string) => CombatService
      locations: WorldLocationStore
      unitOfWork: CampaignUnitOfWork
      rules: ReturnType<typeof readCampaignRules>
    }) => T
  ): T {
    return this.campaignDatabase.use((db) => {
      const locations = new WorldLocationStore(db)
      const unitOfWork = new CampaignUnitOfWork(db)
      const party = new PartyStore(db)
      const scene = new SceneStore(
        db,
        () => locations.read().locations,
        (id) =>
          party
            .read()
            .members.some((member) => member.id === id && member.active)
      )
      const effectivePreset = this.effectiveGeneratorPreset()
      const groupTreasures = new SqliteGroupTreasureReader(db)
      const rules = readCampaignRules(db)
      const combatFor = (sceneId: string) =>
        new CombatService(
          db,
          sceneId,
          scene,
          party,
          effectivePreset,
          groupTreasures,
          () => readCampaignRules(db)
        )
      return work({
        db,
        party,
        scene,
        combat: combatFor(scene.focusedSceneId()),
        combatFor,
        locations,
        unitOfWork,
        rules
      })
    })
  }

  private effectiveGeneratorPreset(): {
    config: GeneratorPresetConfigV3
    id: string
    revision: number
  } {
    const value = this.generatorConfig()
    return 'config' in value
      ? value
      : {
          config: value,
          id: systemGeneratorPresetId,
          revision: 0
        }
  }
}

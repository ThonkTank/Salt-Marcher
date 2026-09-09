import {
  combatCommandSchema,
  type CombatCommand
} from '../../shared/contracts/combat-command.js'
import { CombatCommandJournal } from './combat-command-journal.js'
import {
  sceneGroupLifecycleCommandSchema,
  type SceneGroupLifecycleCommand
} from '../../shared/contracts/scene-group-lifecycle.js'
import {
  scenePartyCommandSchema,
  type ScenePartyCommand
} from '../../shared/contracts/scene-party-command.js'
import { ScenePartyCommandJournal } from '../scene/scene-party-command-journal.js'
import { PartyCharacterCommandJournal } from '../party/party-character-command-journal.js'
import {
  partyCharacterCommandSchema,
  type PartyCharacterCommand
} from '../../shared/contracts/party.js'
import { SceneGroupCommandJournal } from '../scene/scene-group-command-journal.js'
import {
  saveSceneGroupInputSchema,
  type SaveSceneGroupInput
} from '../../shared/contracts/scene.js'
import { sceneHasActiveCombat } from './combat-repository.js'
import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { HexMapStore } from '../hex/hex-map-store.js'
import { HexTravelStore, sceneIsTravelling } from '../hex/hex-travel.js'
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
import type {
  PartyCharacterDraft,
  RestScenePartyInput
} from '../../shared/contracts/party.js'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../shared/contracts/encounter-tuning.js'
import type {
  SetSceneRosterInput,
  MoveSceneRosterInput,
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
    return this.withStores(({ db, party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const existing = party.read().members.find((member) => member.id === id)
        if (!existing) throw new CapabilityError('not_found', false)
        const sourceId = scene.sceneForPartyMember(id)
        if (!active && sourceId) combatFor(sourceId).removePartyCharacter(id)
        const snapshot = party.setMembership(id, active, expectedRevision)
        let changedScene: string | null = null
        if (!active && sourceId) {
          scene.unassignPartyMember(id)
          changedScene = sourceId
        } else if (active && !existing.active) {
          changedScene = scene.focusedSceneId()
          scene.assignPartyMember(changedScene, id, true, scene.revision())
        }
        if (changedScene) {
          combatFor(changedScene).reconcileParty(
            scene.assignedParty(snapshot.members, changedScene)
          )
          new HexTravelStore(
            db,
            new HexMapStore(db, new WorldLocationStore(db)),
            party,
            scene
          ).pauseForMembershipChange(changedScene)
        }
        return snapshot
      })
    )
  }

  setSceneRoster(input: SetSceneRosterInput): LiveSessionSnapshot {
    return this.withStores(({ db, party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const before = party.read()
        if (
          before.revision !== input.expectedPartyRevision ||
          scene.revision() !== input.expectedRevision
        )
          throw new CapabilityError('stale', true)
        const sceneState = scene.snapshot(before.members)
        const source = sceneState.scenes.find((s) => s.id === input.sceneId)
        if (!source) throw new CapabilityError('not_found', false)
        const desired = new Set(input.memberIds)
        if (
          desired.size !== input.memberIds.length ||
          input.memberIds.some(
            (id) =>
              !before.members.some(
                (m) =>
                  m.id === id &&
                  (!m.active ||
                    source.partyMemberIds.includes(id) ||
                    sceneState.unassignedPartyMemberIds.includes(id))
              )
          )
        )
          throw new CapabilityError('validation_failed', false)
        const removed = source.partyMemberIds.filter((id) => !desired.has(id))
        const added = before.members.filter(
          (m) => desired.has(m.id) && !source.partyMemberIds.includes(m.id)
        )
        for (const id of removed) {
          combatFor(input.sceneId).removePartyCharacter(id)
          scene.unassignPartyMember(id)
          party.setMembership(id, false, party.read().revision)
        }
        for (const member of added) {
          party.setMembership(member.id, true, party.read().revision)
          scene.assignPartyMember(
            input.sceneId,
            member.id,
            true,
            scene.revision()
          )
        }
        if (removed.length || added.length) {
          combatFor(input.sceneId).reconcileParty(
            scene.assignedParty(party.read().members, input.sceneId)
          )
          new HexTravelStore(
            db,
            new HexMapStore(db, new WorldLocationStore(db)),
            party,
            scene
          ).pauseForMembershipChange(input.sceneId)
        }
        return this.snapshotFrom(
          db,
          party,
          scene,
          combatFor(scene.focusedSceneId())
        )
      })
    )
  }

  moveSceneRoster(input: MoveSceneRosterInput): LiveSessionSnapshot {
    return this.withStores(({ db, party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const before = party.read()
        const scenes = scene.snapshot(before.members)
        if (
          before.revision !== input.expectedPartyRevision ||
          scenes.revision !== input.expectedRevision
        )
          throw new CapabilityError('stale', true)
        const source = scenes.scenes.find((s) => s.id === input.sceneId)
        const selected = new Set(input.memberIds)
        if (
          !source ||
          !selected.size ||
          selected.size !== input.memberIds.length ||
          input.memberIds.some(
            (id) =>
              !source.partyMemberIds.includes(id) ||
              !before.members.some((m) => m.id === id && m.active)
          )
        )
          throw new CapabilityError('validation_failed', false)
        const requestedTarget =
          input.target.kind === 'existing' ? input.target.sceneId : null
        if (
          input.target.kind === 'existing' &&
          (input.target.sceneId === source.id ||
            !scenes.scenes.some((s) => s.id === requestedTarget))
        )
          throw new CapabilityError('validation_failed', false)
        const targetId =
          input.target.kind === 'new'
            ? scene.createFromScene(source.id, input.target.title)
            : input.target.sceneId
        for (const id of source.partyMemberIds.filter((id) =>
          selected.has(id)
        )) {
          combatFor(source.id).removePartyCharacter(id)
          scene.assignPartyMember(targetId, id, true, scene.revision())
        }
        const travel = new HexTravelStore(
          db,
          new HexMapStore(db, new WorldLocationStore(db)),
          party,
          scene
        )
        for (const id of [source.id, targetId]) {
          combatFor(id).reconcileParty(scene.assignedParty(before.members, id))
          travel.pauseForMembershipChange(id)
        }
        return this.snapshotFrom(
          db,
          party,
          scene,
          combatFor(scene.focusedSceneId())
        )
      })
    )
  }

  executeScenePartyCommand(value: ScenePartyCommand) {
    const input = scenePartyCommandSchema.parse(value)
    return this.withStores(({ db, unitOfWork }) =>
      unitOfWork.run(() => {
        const journal = new ScenePartyCommandJournal(db)
        const existing = journal.read(input)
        if (existing) return existing
        const command = input.command
        const snapshot = (() => {
          switch (command.kind) {
            case 'set-roster':
              return this.setSceneRoster(command.input)
            case 'move-roster':
              return this.moveSceneRoster(command.input)
            case 'rest-selected':
              this.restSceneParty(command.input)
              return this.readSession()
          }
        })()
        const receipt = { snapshot }
        journal.record(input, receipt)
        return receipt
      })
    )
  }

  scenePartyCommandStatus(value: ScenePartyCommand) {
    const input = scenePartyCommandSchema.parse(value)
    return this.withStores(({ db }) => ({
      receipt: new ScenePartyCommandJournal(db).read(input),
      snapshot: this.readSession()
    }))
  }

  executePartyCharacterCommand(value: PartyCharacterCommand) {
    const input = partyCharacterCommandSchema.parse(value)
    return this.withStores(({ db, party, unitOfWork }) =>
      unitOfWork.run(() => {
        const journal = new PartyCharacterCommandJournal(db)
        const existing = journal.read(input)
        if (existing) return existing
        const before = party.read()
        const command = input.command
        const result = (() => {
          switch (command.kind) {
            case 'create':
              return this.createPartyCharacter(
                command.input.character,
                command.input.expectedRevision
              )
            case 'update':
              return this.updatePartyCharacter(
                command.input.id,
                command.input.character,
                command.input.expectedRevision
              )
            case 'delete':
              return this.deletePartyCharacter(
                command.input.id,
                command.input.expectedRevision
              )
            case 'adjust-xp':
              return this.adjustPartyXp(
                command.input.id,
                command.input.delta,
                command.input.expectedRevision
              )
            case 'set-xp':
              return this.setPartyXp(
                command.input.id,
                command.input.amount,
                command.input.expectedRevision
              )
          }
        })()
        const characterId =
          command.kind === 'create'
            ? result.members.find(
                (member) =>
                  !before.members.some((previous) => previous.id === member.id)
              )?.id
            : command.input.id
        if (!characterId) throw new CapabilityError('validation_failed', false)
        const receipt = { characterId, party: result }
        journal.record(input, receipt)
        return receipt
      })
    )
  }

  partyCharacterCommandStatus(value: PartyCharacterCommand) {
    const input = partyCharacterCommandSchema.parse(value)
    return this.withStores(({ db, party }) => ({
      receipt: new PartyCharacterCommandJournal(db).read(input),
      party: party.read()
    }))
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
    return this.withStores(({ party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const sceneId = scene.sceneForPartyMember(id)
        const snapshot = party.update(id, character, expectedRevision)
        if (sceneId)
          combatFor(sceneId).reconcileParty(
            scene.assignedParty(snapshot.members, sceneId)
          )
        return snapshot
      })
    )
  }

  deletePartyCharacter(id: string, expectedRevision: number) {
    return this.withStores(({ party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const before = party.read()
        for (const entry of scene.snapshot(before.members).scenes)
          combatFor(entry.id).removePartyCharacter(id)
        const snapshot = party.delete(id, expectedRevision)
        scene.unassignPartyMember(id)
        return snapshot
      })
    )
  }

  setPartyXp(id: string, amount: number, expectedRevision: number) {
    return this.withStores(({ party }) =>
      party.setXp(id, amount, expectedRevision)
    )
  }

  adjustPartyXp(id: string, delta: number, expectedRevision: number) {
    return this.withStores(({ party }) =>
      party.adjustXp(id, delta, expectedRevision)
    )
  }

  restSceneParty(input: RestScenePartyInput) {
    return this.withStores(({ party, scene, unitOfWork }) =>
      unitOfWork.run(() => {
        if (scene.revision() !== input.expectedSceneRevision)
          throw new CapabilityError('stale', true)
        const ids = scene.partyMemberIds(input.sceneId)
        if (
          !input.memberIds.length ||
          new Set(input.memberIds).size !== input.memberIds.length ||
          input.memberIds.some((id) => !ids.includes(id))
        )
          throw new CapabilityError('validation_failed', false)
        return party.rest(input.type, input.expectedRevision, input.memberIds)
      })
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

  saveSceneGroupCommand(raw: SaveSceneGroupInput): SceneGroupCommandResult {
    const input = saveSceneGroupInputSchema.parse(raw)
    return this.campaignDatabase.use((db) =>
      new CampaignUnitOfWork(db).run(() => {
        const journal = new SceneGroupCommandJournal(db)
        const previous = journal.read(input)
        if (previous) return previous
        const result = this.saveSceneGroup(
          input.sceneId,
          input.groupId,
          input.name,
          input.note,
          input.disposition,
          input.entries,
          input.expectedRevision,
          input.expectedGroupRevision
        )
        journal.record(input, result)
        return result
      })
    )
  }

  executeSceneGroupLifecycle(
    raw: SceneGroupLifecycleCommand
  ): SceneGroupCommandResult {
    const input = sceneGroupLifecycleCommandSchema.parse(raw)
    return this.campaignDatabase.use((db) =>
      new CampaignUnitOfWork(db).run(() => {
        const journal = new SceneGroupCommandJournal(db)
        const previous = journal.read(input)
        if (previous) return previous
        const command = input.command
        const result =
          command.kind === 'archive'
            ? this.setSceneGroupArchived(
                command.input.sceneId,
                command.input.groupId,
                command.input.archived,
                command.input.expectedGroupRevision
              )
            : this.deleteSceneGroup(
                command.input.sceneId,
                command.input.groupId,
                command.input.expectedGroupRevision
              )
        journal.record(input, result)
        return result
      })
    )
  }

  sceneGroupLifecycleStatus(raw: SceneGroupLifecycleCommand) {
    const input = sceneGroupLifecycleCommandSchema.parse(raw)
    return this.campaignDatabase.use((db) => ({
      receipt: new SceneGroupCommandJournal(db).read(input),
      snapshot: this.readSession()
    }))
  }

  sceneGroupSaveReceipt(
    raw: SaveSceneGroupInput
  ): SceneGroupCommandResult | null {
    const input = saveSceneGroupInputSchema.parse(raw)
    return this.campaignDatabase.use((db) =>
      new SceneGroupCommandJournal(db).read(input)
    )
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
    return this.withStores(({ party, scene, combatFor, unitOfWork }) => {
      return unitOfWork.run(() => {
        const combat = combatFor(sceneId)
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
    return this.withStores(({ party, scene, combatFor }) => {
      const combat = combatFor(sceneId)
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
    return this.withStores(({ db, party, scene, combatFor, unitOfWork }) =>
      unitOfWork.run(() => {
        const sourceId = scene.sceneForPartyMember(partyMemberId)
        const departed =
          sourceId &&
          ((assigned && sourceId !== sceneId) ||
            (!assigned && sourceId === sceneId))
            ? sourceId
            : null
        if (departed) combatFor(departed).removePartyCharacter(partyMemberId)
        scene.assignPartyMember(
          sceneId,
          partyMemberId,
          assigned,
          expectedRevision
        )
        const affected = new Set([
          ...(departed ? [departed] : []),
          ...(assigned && sourceId !== sceneId ? [sceneId] : [])
        ])
        const travel = new HexTravelStore(
          db,
          new HexMapStore(db, new WorldLocationStore(db)),
          party,
          scene
        )
        for (const id of affected) {
          combatFor(id).reconcileParty(
            scene.assignedParty(party.read().members, id)
          )
          travel.pauseForMembershipChange(id)
        }
        return this.snapshotFrom(
          db,
          party,
          scene,
          combatFor(scene.focusedSceneId())
        )
      })
    )
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

  executeCombatCommand(value: CombatCommand): CombatCommandResult {
    const input = combatCommandSchema.parse(value)
    return this.withStores(({ db, scene, unitOfWork }) =>
      unitOfWork.run(() => {
        const journal = new CombatCommandJournal(db)
        const prior = journal.read(input)
        if (prior) return prior
        if (scene.focusedSceneId() !== input.sceneId)
          throw new CapabilityError('stale', false)
        if (
          'sceneId' in input.command.input &&
          input.command.input.sceneId !== input.sceneId
        )
          throw new CapabilityError('validation_failed', false)
        const receipt = this.dispatchCombatCommand(input.command)
        journal.record(input, receipt)
        return receipt
      })
    )
  }
  combatCommandStatus(value: CombatCommand) {
    const input = combatCommandSchema.parse(value)
    return this.campaignDatabase.use((db) => ({
      receipt: new CombatCommandJournal(db).read(input),
      snapshot: this.readSession()
    }))
  }
  private dispatchCombatCommand(
    command: CombatCommand['command']
  ): CombatCommandResult {
    switch (command.kind) {
      case 'prepare':
        return this.prepareCombat(
          command.input.sceneId,
          command.input.expectedSceneRevision,
          command.input.groupIds
        )
      case 'joinGroup':
        return this.joinCombatGroup(
          command.input.sceneId,
          command.input.groupId,
          command.input.expectedGroupRevision,
          command.input.expectedCombatRevision
        )
      case 'rollInitiative':
        return this.rollInitiative(command.input.expectedRevision)
      case 'confirmInitiative':
        return this.confirmInitiative(
          command.input.expectedRevision,
          command.input.values
        )
      case 'advanceTurn':
        return this.advanceTurn(command.input.expectedRevision)
      case 'retreatTurn':
        return this.retreatTurn(command.input.expectedRevision)
      case 'adjustInitiative':
        return this.adjustInitiative(
          command.input.expectedRevision,
          command.input.id,
          command.input.initiative
        )
      case 'changeHp':
        return this.changeHp(
          command.input.expectedRevision,
          command.input.cardId,
          command.input.amount,
          command.input.healing
        )
      case 'toggleCondition':
        return this.toggleCombatCondition(
          command.input.expectedRevision,
          command.input.cardId,
          command.input.condition,
          command.input.active
        )
      case 'setConcentration':
        return this.setCombatConcentration(
          command.input.expectedRevision,
          command.input.cardId,
          command.input.concentrating
        )
      case 'setExhaustion':
        return this.setCombatExhaustion(
          command.input.expectedRevision,
          command.input.cardId,
          command.input.exhaustionLevel
        )
      case 'undo':
        return this.undoCombat(command.input.expectedRevision)
      case 'end':
        return this.endCombat(command.input.expectedRevision)
      case 'moveToPhase':
        return this.moveCombatToPhase(
          command.input.expectedRevision,
          command.input.target
        )
      case 'updateResolution':
        return this.updateResolution(
          command.input.expectedRevision,
          command.input.selectedEnemyIds,
          command.input.mode,
          command.input.xpFraction
        )
      case 'awardXp':
        return this.awardXp(
          command.input.expectedRevision,
          command.input.expectedCampaignRulesRevision
        )
      case 'complete':
        return this.completeCombat(command.input.expectedRevision)
    }
  }

  prepareCombat(
    sceneId: string,
    expectedSceneRevision: number,
    groupIds: readonly string[]
  ): CombatCommandResult {
    return this.withStores(({ party, scene, combat, unitOfWork }) =>
      unitOfWork.run(() => {
        if (scene.revision() !== expectedSceneRevision)
          throw new CapabilityError('stale', true)
        const partySnapshot = party.read()
        const focused = scene.focused(partySnapshot.members)
        if (focused.id !== sceneId)
          throw new CapabilityError('not_found', false)
        const assigned = scene.assignedParty(partySnapshot.members, sceneId)
        const evaluation = evaluateSceneGroups(focused, assigned, groupIds)
        if (!evaluation.canStart)
          throw new CapabilityError('validation_failed', false)
        combat.prepare(assigned, focused.groups, groupIds)
        return this.combatResult(party, scene, combat, false, false)
      })
    )
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
    return this.withStores(({ db, party, scene, combat, unitOfWork }) =>
      unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        if (target === 'selection') combat.clear()
        else {
          if (target === 'combat')
            assertSceneCanFight(db, scene.focusedSceneId())
          combat.moveToPhase(target)
        }
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
    return this.withStores(({ db, party, scene, combat, unitOfWork }) => {
      return unitOfWork.run(() => {
        combat.assertRevision(expectedRevision)
        mutation(combat)
        if (sceneHasActiveCombat(db, scene.focusedSceneId()))
          assertSceneCanFight(db, scene.focusedSceneId())
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

function assertSceneCanFight(db: Database.Database, sceneId: string): void {
  if (sceneIsTravelling(db, sceneId))
    throw new CapabilityError('scene_activity_conflict', false)
}

import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { GroupRewardCommandHandler } from '../../src/core/application/group-reward-command-handler.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { createLootCatalogIndex } from '../../src/core/loot/loot-catalog-index.js'
import { ItemDefinitionResolver } from '../../src/core/loot/item-definition-resolver.js'
import { TreasureStore } from '../../src/core/loot/loot-store.js'
import { LootProjectionStore } from '../../src/core/loot/loot-projection-store.js'
import { LootOperationJournal } from '../../src/core/loot/loot-operation-journal.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'
import { CharacterLootStore } from '../../src/core/loot/character-loot-store.js'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'
import {
  GroupEditorHandler,
  type GroupEditorContext
} from '../../src/core/application/group-editor-handler.js'
import { GroupLootBalanceHandler } from '../../src/core/application/group-loot-balance-handler.js'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import type {
  CommitGroupEditorInput,
  EvaluateGroupLootInput
} from '../../src/shared/contracts/loot.js'

export function groupEditorContext() {
  const root = mkdtempSync(join(tmpdir(), 'salt-group-editor-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Group editor')
  const db = activeCampaignDatabase(campaigns),
    access = fixedSqliteDatabaseAccess(db)
  seedExampleParty(db)
  const party = new PartyStore(db)
  const scenes = new SceneStore(
      db,
      () => [],
      (id) => party.read().members.some((m) => m.id === id)
    ),
    sceneId = scenes.focusedSceneId()
  const play = new LivePlayService(access)
  const catalog = new BundledEncounterCatalogProvider(
    join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
  )
  const index = createLootCatalogIndex(catalog.loadFull()),
    definitions = new ItemDefinitionResolver(db, () => index)
  const context = {
    containerExists: (id: string) => index.containers.has(id),
    party,
    scenes,
    definitions,
    generatedRuns: new GeneratedRunStore(db),
    treasures: new TreasureStore(db, definitions),
    projections: new LootProjectionStore(db, definitions),
    journal: new LootOperationJournal(db),
    now: () => new Date().toISOString(),
    groupCommands: {
      save: (i: Parameters<GroupEditorContext['groupCommands']['save']>[0]) =>
        play.saveSceneGroup(
          i.sceneId,
          i.groupId,
          i.name,
          i.note,
          i.disposition,
          i.entries,
          i.expectedSceneRevision,
          i.expectedGroupRevision,
          i.prospectiveGroupId
        ),
      result: (id: string, ids: readonly string[]) =>
        play.sceneGroupResult(id, ids)
    }
  }
  const transaction = <T>(work: () => T) => new CampaignUnitOfWork(db).run(work)
  const editor = new GroupEditorHandler(() => context, transaction)
  const rules = new CampaignRulesService(access)
  const balance = new GroupLootBalanceHandler(
    () => ({
      ...context,
      characterLoot: new CharacterLootStore(db, definitions),
      rules: rules.read(),
      lootRules: defaultGeneratorConfig.loot
    }),
    sha256EncounterEntropy
  )
  const generation = new SessionGenerationService(
    catalog,
    sha256EncounterEntropy,
    () => ({
      id: systemGeneratorPresetId,
      revision: 0,
      config: defaultGeneratorConfig
    }),
    access
  )
  const rewards = new GroupRewardCommandHandler(() => ({
    party,
    scenes,
    rules,
    characterLoot: new CharacterLootStore(db, definitions),
    generation
  }))
  const item = index.entries.find((e) => e.kind === 'item' && e.stackable)!
  if (item.kind === 'container') throw new Error('Expected catalog item')
  const request = (): CommitGroupEditorInput => ({
    commandId: randomUUID(),
    sceneId,
    groupId: null,
    prospectiveGroupId: randomUUID(),
    expectedRevision: scenes.revision(),
    expectedGroupRevision: null,
    name: '',
    note: 'Keep note',
    disposition: 'neutral',
    entries: [{ creatureId: 'wolf', quantity: 3, deadQuantity: 1 }],
    treasures: [
      {
        key: 'manual',
        treasureId: null,
        expectedRevision: null,
        label: 'Supplies',
        containers: [],
        items: [
          { itemReference: item.itemReference, quantity: 3, containerId: null }
        ]
      }
    ]
  })
  const evaluate = (input: CommitGroupEditorInput): EvaluateGroupLootInput => {
    return {
      sceneId: input.sceneId,
      groupId: input.groupId,
      prospectiveGroupId: input.prospectiveGroupId,
      expectedRevision: input.expectedRevision,
      expectedGroupRevision: input.expectedGroupRevision,
      entries: input.entries,
      treasures: input.treasures,
      budgetSeed: 1234
    }
  }

  const assign = () => {
    for (const member of party.read().members.slice(0, 2)) {
      party.setMembership(member.id, true, party.read().revision)
      party.update(
        member.id,
        {
          name: member.name,
          playerName: member.playerName,
          level: 3,
          passivePerception: member.passivePerception,
          armorClass: member.armorClass,
          movementSpeedFeet: member.movementSpeedFeet
        },
        party.read().revision
      )
      scenes.assignPartyMember(sceneId, member.id, true, scenes.revision())
    }
  }
  return {
    rewards,
    db,
    access,
    context,
    editor,
    balance,
    request,
    evaluate,
    assign,
    party,
    scenes,
    sceneId,
    catalog,
    item,
    rules,
    transaction,
    close: () => {
      campaigns.close()
      rmSync(root, { recursive: true, force: true })
    }
  }
}

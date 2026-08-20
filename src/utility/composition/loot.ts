import type Database from 'better-sqlite3'
import type { SqliteDatabaseAccess } from '../../core/persistence/sqlite/database-access.js'
import { lootOperationDefinitions } from '../../shared/contracts/operations/loot.js'
import {
  defineOperationHandlers,
  type OperationDefinition,
  type OperationHandlers,
  validatedOperationResult
} from '../../shared/contracts/operations/registry.js'
import type { CampaignRules } from '../../shared/contracts/campaign-rules.js'
import type { FullSessionGenerationCatalog } from '../../core/session-generation/loot-catalog.js'
import { CampaignUnitOfWork } from '../../core/application/campaign-unit-of-work.js'
import { GroupRewardCommandHandler } from '../../core/application/group-reward-command-handler.js'
import {
  GroupRewardCommitHandler,
  type GroupRewardCommitContext
} from '../../core/application/group-reward-commit-handler.js'
import { LootCatalogService } from '../../core/application/loot-catalog-service.js'
import { LootService } from '../../core/application/loot-service.js'
import { LootCatalogIndexCache } from '../../core/loot/loot-catalog-index.js'
import { LootOperationJournal } from '../../core/loot/loot-operation-journal.js'
import { LootProjectionStore } from '../../core/loot/loot-projection-store.js'
import { TreasureStore } from '../../core/loot/loot-store.js'
import { PartyStore } from '../../core/party/party-store.js'
import { SceneStore } from '../../core/scene/scene-store.js'
import { GeneratedRunStore } from '../../core/session-generation/generated-run-store.js'
import { CharacterLootStore } from '../../core/loot/character-loot-store.js'
import type { GroupRewardGenerationPort } from '../../core/application/group-reward-command-handler.js'
import { ItemDefinitionResolver } from '../../core/loot/item-definition-resolver.js'

export type LootChangeReason =
  'created' | 'updated' | 'moved' | 'accepted' | 'distributed'

export type LootComposition = Readonly<{
  createHandlers(
    publishChange: (reason: LootChangeReason) => void
  ): OperationHandlers<typeof lootOperationDefinitions>
  projectionRevision(): number
}>

export function createLootComposition(dependencies: {
  activeDatabase: SqliteDatabaseAccess
  rules: Readonly<{ read(): CampaignRules }>
  generation: GroupRewardGenerationPort
  loadCatalog(reference: {
    catalogVersion: string
    catalogContentHash: string
  }): FullSessionGenerationCatalog
  currentCatalogReference(): {
    catalogVersion: string
    catalogContentHash: string
  }
  groupCommands: GroupRewardCommitContext['groupCommands']
}): LootComposition {
  const activeDatabase = () =>
    dependencies.activeDatabase.use((database) => database)
  const catalogIndexes = new LootCatalogIndexCache((reference) =>
    dependencies.loadCatalog(reference)
  )
  const definitions = (db: Database.Database) =>
    new ItemDefinitionResolver(db, (reference) =>
      catalogIndexes.require(reference)
    )
  const loot = new LootService(
    dependencies.activeDatabase,
    undefined,
    definitions
  )
  const catalog = new LootCatalogService({
    readRun: (runId) => new GeneratedRunStore(activeDatabase()).read(runId),
    currentReference: () => dependencies.currentCatalogReference(),
    index: (reference) => catalogIndexes.require(reference)
  })
  const rewards = new GroupRewardCommandHandler(() => {
    const db = activeDatabase()
    const itemDefinitions = definitions(db)
    return {
      party: new PartyStore(db),
      scenes: new SceneStore(db),
      rules: dependencies.rules,
      characterLoot: new CharacterLootStore(db, itemDefinitions),
      generation: dependencies.generation
    }
  })
  const commits = new GroupRewardCommitHandler(
    () => {
      const db = activeDatabase()
      const itemDefinitions = definitions(db)
      return {
        party: new PartyStore(db),
        scenes: new SceneStore(db),
        rules: dependencies.rules,
        catalog: {
          index: (reference) => catalogIndexes.require(reference)
        },
        generatedRuns: new GeneratedRunStore(db),
        characterLoot: new CharacterLootStore(db, itemDefinitions),
        treasures: new TreasureStore(db, itemDefinitions),
        groupCommands: dependencies.groupCommands,
        journal: new LootOperationJournal(db),
        projections: new LootProjectionStore(db, itemDefinitions),
        now: () => new Date().toISOString()
      }
    },
    (work) => new CampaignUnitOfWork(activeDatabase()).run(work)
  )
  return {
    createHandlers: (publishChange) => {
      const publish = (
        definition: Pick<OperationDefinition, 'output'>,
        reason: LootChangeReason,
        work: () => unknown
      ): unknown =>
        validatedOperationResult(definition, work(), () =>
          publishChange(reason)
        )
      return defineOperationHandlers(
        'loot_handlers',
        lootOperationDefinitions,
        {
          'loot.read': (input) => loot.read(input.treasureId),
          'loot.catalog': (input) => catalog.search(input),
          'loot.generateForGroupDraft': (input) => rewards.generate(input),
          'loot.commitGroupReward': (input) =>
            publish(
              lootOperationDefinitions['loot.commitGroupReward'],
              'accepted',
              () => commits.commit(input)
            ),
          'loot.scene': (input) => loot.sceneProjection(input.sceneId),
          'loot.inbox': (input) => loot.inbox(input),
          'loot.create': (input) =>
            publish(lootOperationDefinitions['loot.create'], 'created', () =>
              loot.create(input)
            ),
          'loot.update': (input) =>
            publish(lootOperationDefinitions['loot.update'], 'updated', () =>
              loot.update(input)
            ),
          'loot.move': (input) =>
            publish(lootOperationDefinitions['loot.move'], 'moved', () =>
              loot.move(input)
            ),
          'loot.acceptGenerated': (input) =>
            publish(
              lootOperationDefinitions['loot.acceptGenerated'],
              'accepted',
              () => loot.acceptGenerated(input)
            ),
          'loot.distribute': (input) =>
            publish(
              lootOperationDefinitions['loot.distribute'],
              'distributed',
              () => loot.distribute(input)
            ),
          'loot.ledger': (input) => loot.ledger(input.characterId),
          'loot.correctLedger': (input) => loot.correctLedger(input)
        }
      )
    },
    projectionRevision: () =>
      new LootProjectionStore(activeDatabase()).revision()
  }
}

import type Database from 'better-sqlite3'
import type { SqliteDatabaseAccess } from '../../core/persistence/sqlite/database-access.js'
import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
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

type LootHandlerName =
  | 'loot.read'
  | 'loot.catalog'
  | 'loot.generateForGroupDraft'
  | 'loot.commitGroupReward'
  | 'loot.scene'
  | 'loot.inbox'
  | 'loot.create'
  | 'loot.update'
  | 'loot.move'
  | 'loot.acceptGenerated'
  | 'loot.distribute'
  | 'loot.ledger'
  | 'loot.correctLedger'

export type LootComposition = Readonly<{
  handlers: Pick<CoreHandlers, LootHandlerName>
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
  const handlers = {
    'loot.read': (input) => loot.read(input.treasureId),
    'loot.catalog': (input) => catalog.search(input),
    'loot.generateForGroupDraft': (input) => rewards.generate(input),
    'loot.commitGroupReward': (input) => commits.commit(input),
    'loot.scene': (input) => loot.sceneProjection(input.sceneId),
    'loot.inbox': (input) => loot.inbox(input),
    'loot.create': (input) => loot.create(input),
    'loot.update': (input) => loot.update(input),
    'loot.move': (input) => loot.move(input),
    'loot.acceptGenerated': (input) => loot.acceptGenerated(input),
    'loot.distribute': (input) => loot.distribute(input),
    'loot.ledger': (input) => loot.ledger(input.characterId),
    'loot.correctLedger': (input) => loot.correctLedger(input)
  } satisfies Pick<CoreHandlers, LootHandlerName>

  return {
    handlers,
    projectionRevision: () =>
      new LootProjectionStore(activeDatabase()).revision()
  }
}

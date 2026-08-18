import type Database from 'better-sqlite3'
import type {
  AcceptGeneratedTreasureInput,
  CharacterLootLedger,
  CompleteLootDistributionInput,
  CorrectCharacterLootInput,
  CreateTreasureInput,
  LootDistributionResult,
  LootInboxPage,
  LootSceneProjection,
  MoveTreasureInput,
  Treasure,
  TreasureAnchor,
  UpdateTreasureInput
} from '../../shared/contracts/loot.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { CharacterLootStore } from '../loot/character-loot-store.js'
import { LootOperationJournal } from '../loot/loot-operation-journal.js'
import { LootProjectionStore } from '../loot/loot-projection-store.js'
import { TreasureStore } from '../loot/loot-store.js'
import { ItemDefinitionResolver } from '../loot/item-definition-resolver.js'
import { PartyStore } from '../party/party-store.js'
import { SceneStore } from '../scene/scene-store.js'
import { GeneratedRunStore } from '../session-generation/generated-run-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { CampaignUnitOfWork } from './campaign-unit-of-work.js'
import { CharacterLootService } from './character-loot-service.js'
import { DistributeLootCommandHandler } from './distribute-loot-command-handler.js'
import { LootCommandHandler } from './loot-command-handler.js'
import { LootQueryService } from './loot-query-service.js'
import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'

/**
 * Compatibility facade for the Utility composition root. Domain work is
 * delegated to owner-focused handlers whose contexts expose only narrow ports.
 */
export class LootService {
  private readonly commands: LootCommandHandler
  private readonly distribution: DistributeLootCommandHandler
  private readonly characters: CharacterLootService
  private readonly queries: LootQueryService

  constructor(
    private readonly databaseAccess: SqliteDatabaseAccess,
    private readonly clock: () => Date = () => new Date(),
    private readonly definitionResolver: (
      db: Database.Database
    ) => ItemDefinitionResolver = (db) =>
      new ItemDefinitionResolver(db, () => {
        throw new Error('Catalog definition resolver is not configured')
      })
  ) {
    const transact = <T>(work: () => T): T =>
      new CampaignUnitOfWork(this.activeDatabase()).run(work)
    this.commands = new LootCommandHandler(() => {
      const db = this.activeDatabase()
      const definitions = this.definitionResolver(db)
      return {
        treasures: new TreasureStore(db, definitions),
        generatedRuns: new GeneratedRunStore(db),
        journal: new LootOperationJournal(db),
        projections: new LootProjectionStore(db, definitions),
        normalizeAnchor: (anchor: TreasureAnchor) =>
          normalizeAnchor(db, anchor),
        now: () => this.clock().toISOString()
      }
    }, transact)
    this.distribution = new DistributeLootCommandHandler(() => {
      const db = this.activeDatabase()
      const definitions = this.definitionResolver(db)
      return {
        treasures: new TreasureStore(db, definitions),
        characterLoot: new CharacterLootStore(db, definitions),
        party: new PartyStore(db),
        generatedRuns: new GeneratedRunStore(db),
        journal: new LootOperationJournal(db),
        projections: new LootProjectionStore(db, definitions),
        now: () => this.clock().toISOString()
      }
    }, transact)
    this.characters = new CharacterLootService(() => {
      const db = this.activeDatabase()
      const definitions = this.definitionResolver(db)
      return {
        party: new PartyStore(db),
        ledger: new CharacterLootStore(db, definitions),
        journal: new LootOperationJournal(db),
        now: () => this.clock().toISOString()
      }
    }, transact)
    this.queries = new LootQueryService(() => {
      const db = this.activeDatabase()
      const definitions = this.definitionResolver(db)
      return {
        party: new PartyStore(db),
        scenes: new SceneStore(db),
        locations: new WorldLocationStore(db),
        projections: new LootProjectionStore(db, definitions)
      }
    })
  }

  private activeDatabase(): Database.Database {
    return this.databaseAccess.use((database) => database)
  }

  read(treasureId: string): Treasure {
    return this.commands.read(treasureId)
  }

  sceneProjection(sceneId: string): LootSceneProjection {
    return this.queries.scene(sceneId)
  }

  inbox(input: unknown): LootInboxPage {
    return this.queries.inbox(input)
  }

  create(input: CreateTreasureInput): Treasure {
    return this.commands.create(input)
  }

  update(input: UpdateTreasureInput): Treasure {
    return this.commands.update(input)
  }

  move(input: MoveTreasureInput): Treasure {
    return this.commands.move(input)
  }

  acceptGenerated(input: AcceptGeneratedTreasureInput): Treasure {
    return this.commands.acceptGenerated(input)
  }

  distribute(input: CompleteLootDistributionInput): LootDistributionResult {
    return this.distribution.distribute(input)
  }

  ledger(characterId: string): CharacterLootLedger {
    return this.characters.read(characterId)
  }

  correctLedger(input: CorrectCharacterLootInput): CharacterLootLedger {
    return this.characters.correct(input)
  }
}

function normalizeAnchor(
  db: Database.Database,
  anchor: TreasureAnchor
): TreasureAnchor {
  if (anchor.kind === 'location') {
    const label = new WorldLocationStore(db).displayName(anchor.locationId)
    if (!label) throw new CapabilityError('not_found', false)
    return { ...anchor, lastKnownLabel: label }
  }
  if (anchor.kind === 'group') {
    const group = new SceneStore(db)
      .groups(anchor.sceneId)
      .find((candidate) => candidate.id === anchor.groupId)
    if (!group) throw new CapabilityError('not_found', false)
    return { ...anchor, lastKnownLabel: group.name }
  }
  return anchor
}

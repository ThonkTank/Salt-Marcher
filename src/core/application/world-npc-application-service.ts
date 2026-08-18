import type Database from 'better-sqlite3'
import {
  type WorldNpcDraft,
  type WorldNpcSearchInput
} from '../../shared/contracts/world-npc.js'
import {
  WorldNpcStore,
  type CreatureReferenceResolver,
  type WorldNpcFactionMembershipCoordinator
} from '../worldplanner/npc-store.js'
import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'

/** World Planner owns NPC persistence, reference validation and membership. */
export class WorldNpcApplicationService {
  constructor(
    private readonly campaignDatabase: SqliteDatabaseAccess,
    private readonly creatures: CreatureReferenceResolver,
    private readonly factions: (
      database: Database.Database
    ) => WorldNpcFactionMembershipCoordinator
  ) {}

  search(input: WorldNpcSearchInput) {
    return this.withStore((store) => store.search(input))
  }

  detail(id: string) {
    return this.withStore((store) => store.detailProjection(id))
  }

  readAllForReferences() {
    return this.withStore((store) => store.readAllForReferences())
  }

  referenceDependencies() {
    return this.withStore((store) => store.referenceDependencies())
  }

  referenceDependency(id: string) {
    return this.withStore((store) => store.referenceDependency(id))
  }

  commandReceipt(commandId: string) {
    return this.withStore((store) => store.commandReceipt(commandId))
  }

  create(
    commandId: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number | null
  ) {
    return this.campaignDatabase.use((database) =>
      new WorldNpcStore(database, this.creatures).create(
        commandId,
        draft,
        revision,
        factionRevision,
        this.factions(database)
      )
    )
  }

  update(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number | null
  ) {
    return this.campaignDatabase.use((database) =>
      new WorldNpcStore(database, this.creatures).update(
        commandId,
        id,
        draft,
        revision,
        factionRevision,
        this.factions(database)
      )
    )
  }

  delete(
    commandId: string,
    id: string,
    revision: number,
    factionRevision: number | null
  ) {
    return this.campaignDatabase.use((database) =>
      new WorldNpcStore(database, this.creatures).delete(
        commandId,
        id,
        revision,
        factionRevision,
        this.factions(database)
      )
    )
  }

  linkedToFaction(factionId: string): readonly string[] {
    return this.withStore((store) => store.linkedToFaction(factionId))
  }

  recordExternalReferenceChange(ids: readonly string[]): void {
    this.withStore((store) => store.recordExternalReferenceChange(ids))
  }

  private withStore<T>(visitor: (store: WorldNpcStore) => T): T {
    return this.campaignDatabase.use((database) =>
      visitor(new WorldNpcStore(database, this.creatures))
    )
  }
}

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

/** World Planner owns NPC persistence, reference validation and membership. */
export class WorldNpcApplicationService {
  constructor(
    private readonly campaignDatabase: () => Database.Database,
    private readonly creatures: CreatureReferenceResolver,
    private readonly factions: (
      database: Database.Database
    ) => WorldNpcFactionMembershipCoordinator
  ) {}

  search(input: WorldNpcSearchInput) {
    return this.store().search(input)
  }

  detail(id: string) {
    return this.store().detailProjection(id)
  }

  readAllForReferences() {
    return this.store().readAllForReferences()
  }

  referenceDependencies() {
    return this.store().referenceDependencies()
  }

  referenceDependency(id: string) {
    return this.store().referenceDependency(id)
  }

  commandReceipt(commandId: string) {
    return this.store().commandReceipt(commandId)
  }

  create(
    commandId: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number | null
  ) {
    const database = this.campaignDatabase()
    return new WorldNpcStore(database, this.creatures).create(
      commandId,
      draft,
      revision,
      factionRevision,
      this.factions(database)
    )
  }

  update(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number | null
  ) {
    const database = this.campaignDatabase()
    return new WorldNpcStore(database, this.creatures).update(
      commandId,
      id,
      draft,
      revision,
      factionRevision,
      this.factions(database)
    )
  }

  delete(
    commandId: string,
    id: string,
    revision: number,
    factionRevision: number | null
  ) {
    const database = this.campaignDatabase()
    return new WorldNpcStore(database, this.creatures).delete(
      commandId,
      id,
      revision,
      factionRevision,
      this.factions(database)
    )
  }

  linkedToFaction(factionId: string): readonly string[] {
    return this.store().linkedToFaction(factionId)
  }

  recordExternalReferenceChange(ids: readonly string[]): void {
    this.store().recordExternalReferenceChange(ids)
  }

  private store(): WorldNpcStore {
    return new WorldNpcStore(this.campaignDatabase(), this.creatures)
  }
}

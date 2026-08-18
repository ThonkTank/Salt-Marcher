import type Database from 'better-sqlite3'
import {
  type WorldNpc,
  type WorldNpcDraft,
  type WorldNpcPage,
  type WorldNpcSearchInput,
  type WorldNpcSnapshot
} from '../../shared/contracts/world-npc.js'
import type { NpcReferenceDependencies } from '../reference/reference-change-coordinator.js'
import type {
  CreatureReferenceResolver,
  WorldNpcFactionMembershipCoordinator
} from './world-npc-persistence.js'
import { WorldNpcReceiptRepository } from './world-npc-receipt-repository.js'
import { WorldNpcQueryRepository } from './world-npc-query-repository.js'
import { WorldNpcCommandRepository } from './world-npc-command-repository.js'

export {
  WORLD_NPC_RECEIPT_RETENTION_LIMIT,
  type CreatureReferenceResolver,
  type WorldNpcFactionMembershipCoordinator
} from './world-npc-persistence.js'

export {
  initializeWorldNpcSchema,
  migrateWorldNpcSchema32To33
} from './world-npc-schema.js'

export class WorldNpcStore {
  private readonly queries: WorldNpcQueryRepository
  private readonly commands: WorldNpcCommandRepository
  private readonly receipts: WorldNpcReceiptRepository

  constructor(db: Database.Database, creatures: CreatureReferenceResolver) {
    this.queries = new WorldNpcQueryRepository(db, creatures)
    this.receipts = new WorldNpcReceiptRepository(db)
    this.commands = new WorldNpcCommandRepository(
      db,
      creatures,
      this.queries,
      this.receipts
    )
  }

  readAllForReferences(): WorldNpcSnapshot {
    return this.queries.readAllForReferences()
  }

  referenceDependencies(): readonly NpcReferenceDependencies[] {
    return this.queries.referenceDependencies()
  }

  referenceDependency(id: string): NpcReferenceDependencies | null {
    return this.queries.referenceDependency(id)
  }

  search(input: WorldNpcSearchInput): WorldNpcPage {
    return this.queries.search(input)
  }

  detail(id: string): WorldNpc | null {
    return this.queries.detail(id)
  }

  detailProjection(id: string) {
    return this.queries.detailProjection(id)
  }

  linkedToFaction(factionId: string): readonly string[] {
    return this.queries.linkedToFaction(factionId)
  }

  recordExternalReferenceChange(ids: readonly string[]): void {
    return this.commands.recordExternalReferenceChange(ids)
  }

  currentRevision(): number {
    return this.queries.currentRevision()
  }

  commandReceipt(commandId: string) {
    return this.receipts.read(commandId)
  }

  create(
    commandId: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    return this.commands.create(
      commandId,
      draft,
      expectedRevision,
      expectedFactionRevision,
      factions
    )
  }

  update(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    return this.commands.update(
      commandId,
      id,
      draft,
      expectedRevision,
      expectedFactionRevision,
      factions
    )
  }

  delete(
    commandId: string,
    id: string,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    return this.commands.delete(
      commandId,
      id,
      expectedRevision,
      expectedFactionRevision,
      factions
    )
  }

  unlinkFaction(factionId: string): readonly string[] {
    return this.commands.unlinkFaction(factionId)
  }

  unlinkLocation(locationId: string): readonly string[] {
    return this.commands.unlinkLocation(locationId)
  }
}

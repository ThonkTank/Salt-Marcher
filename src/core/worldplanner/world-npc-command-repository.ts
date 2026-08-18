import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  worldNpcDeleteReceiptSchema,
  worldNpcDraftSchema,
  worldNpcMutationReceiptSchema,
  type WorldNpc,
  type WorldNpcDraft
} from '../../shared/contracts/world-npc.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import type {
  CreatureReferenceResolver,
  WorldNpcFactionMembershipCoordinator
} from './world-npc-persistence.js'
import type { WorldNpcQueryRepository } from './world-npc-query-repository.js'
import type { WorldNpcReceiptRepository } from './world-npc-receipt-repository.js'

export class WorldNpcCommandRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly creatures: CreatureReferenceResolver,
    private readonly queries: WorldNpcQueryRepository,
    private readonly receipts: WorldNpcReceiptRepository
  ) {}

  recordExternalReferenceChange(ids: readonly string[]): void {
    if (ids.length > 0) this.bumpRevision()
  }

  create(
    commandId: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = { draft: parsed, expectedRevision, expectedFactionRevision }
    const replay = this.receipts.replay(
      commandId,
      'create',
      request,
      worldNpcMutationReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      if (parsed.factionId !== null)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      this.assertReferences(parsed)
      const id = uuidv7()
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_npc'
          )
          .get() as { value: number }
      ).value
      this.insert(id, position, parsed)
      this.replaceFaction(id, parsed.factionId)
      this.bumpRevision()
      if (parsed.factionId !== null) factions.recordMembershipChange()
      const saved = requireNpc(this.queries.detail(id))
      this.receipts.write(commandId, 'create', request, {
        revision: this.queries.currentRevision(),
        factionRevision: factions.read().revision,
        saved
      })
    })
    return this.receipts.replay(
      commandId,
      'create',
      request,
      worldNpcMutationReceiptSchema
    )!
  }

  update(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = {
      id,
      draft: parsed,
      expectedRevision,
      expectedFactionRevision
    }
    const replay = this.receipts.replay(
      commandId,
      'update',
      request,
      worldNpcMutationReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      this.assertReferences(parsed)
      const previousFactionId = this.factionId(id)
      const membershipChanged = previousFactionId !== parsed.factionId
      if (membershipChanged)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      const changed = this.db
        .prepare(
          `
        UPDATE worldplanner_npc
        SET display_name = ?, creature_id = ?, lifecycle = ?, appearance = ?,
            behavior = ?, history = ?, notes = ?, disposition_modifier = ?, location_id = ?
        WHERE id = ?
      `
        )
        .run(
          parsed.displayName,
          parsed.creatureId,
          parsed.lifecycle,
          parsed.appearance,
          parsed.behavior,
          parsed.history,
          parsed.notes,
          parsed.dispositionModifier,
          parsed.locationId,
          id
        ).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceFaction(id, parsed.factionId)
      this.bumpRevision()
      if (membershipChanged) factions.recordMembershipChange()
      const saved = requireNpc(this.queries.detail(id))
      this.receipts.write(commandId, 'update', request, {
        revision: this.queries.currentRevision(),
        factionRevision: factions.read().revision,
        saved
      })
    })
    return this.receipts.replay(
      commandId,
      'update',
      request,
      worldNpcMutationReceiptSchema
    )!
  }

  delete(
    commandId: string,
    id: string,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const request = { id, expectedRevision, expectedFactionRevision }
    const replay = this.receipts.replay(
      commandId,
      'delete',
      request,
      worldNpcDeleteReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      const previousFactionId = this.factionId(id)
      if (previousFactionId !== null)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      if (
        this.db.prepare('DELETE FROM worldplanner_npc WHERE id = ?').run(id)
          .changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.bumpRevision()
      if (previousFactionId !== null) factions.recordMembershipChange()
      this.receipts.write(commandId, 'delete', request, {
        revision: this.queries.currentRevision(),
        factionRevision: factions.read().revision,
        deletedId: id
      })
    })
    return this.receipts.replay(
      commandId,
      'delete',
      request,
      worldNpcDeleteReceiptSchema
    )!
  }

  unlinkFaction(factionId: string): readonly string[] {
    const ids = (
      this.db
        .prepare(
          'SELECT npc_id AS id FROM worldplanner_faction_npc WHERE faction_id = ? ORDER BY npc_id'
        )
        .all(factionId) as { id: string }[]
    ).map((row) => row.id)
    if (ids.length === 0) return ids
    this.db
      .prepare('DELETE FROM worldplanner_faction_npc WHERE faction_id = ?')
      .run(factionId)
    this.bumpRevision()
    return ids
  }

  unlinkLocation(locationId: string): readonly string[] {
    const ids = (
      this.db
        .prepare(
          'SELECT id FROM worldplanner_npc WHERE location_id = ? ORDER BY id'
        )
        .all(locationId) as { id: string }[]
    ).map((row) => row.id)
    if (ids.length === 0) return ids
    this.db
      .prepare(
        'UPDATE worldplanner_npc SET location_id = NULL WHERE location_id = ?'
      )
      .run(locationId)
    this.bumpRevision()
    return ids
  }

  private insert(
    id: string,
    position: number,
    draft: z.output<typeof worldNpcDraftSchema>
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO worldplanner_npc
      (id, display_name, creature_id, lifecycle, appearance, behavior, history,
       notes, disposition_modifier, location_id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        draft.displayName,
        draft.creatureId,
        draft.lifecycle,
        draft.appearance,
        draft.behavior,
        draft.history,
        draft.notes,
        draft.dispositionModifier,
        draft.locationId,
        position
      )
  }

  private replaceFaction(id: string, factionId: string | null): void {
    this.db
      .prepare('DELETE FROM worldplanner_faction_npc WHERE npc_id = ?')
      .run(id)
    if (factionId !== null)
      this.db
        .prepare(
          'INSERT INTO worldplanner_faction_npc (npc_id, faction_id) VALUES (?, ?)'
        )
        .run(id, factionId)
  }

  private factionId(id: string): string | null {
    const row = this.db
      .prepare(
        'SELECT faction_id AS factionId FROM worldplanner_faction_npc WHERE npc_id = ?'
      )
      .get(id) as { factionId: string } | undefined
    return row?.factionId ?? null
  }

  private assertReferences(draft: z.output<typeof worldNpcDraftSchema>): void {
    if (!this.creatures.resolve(draft.creatureId))
      throw new CapabilityError('not_found', false)
    if (
      draft.factionId !== null &&
      this.db
        .prepare('SELECT 1 FROM worldplanner_faction WHERE id = ?')
        .get(draft.factionId) === undefined
    )
      throw new CapabilityError('not_found', false)
    if (
      draft.locationId !== null &&
      this.db
        .prepare('SELECT 1 FROM worldplanner_location WHERE id = ?')
        .get(draft.locationId) === undefined
    )
      throw new CapabilityError('not_found', false)
  }

  private assertRevision(expected: number): void {
    if (this.queries.currentRevision() !== expected)
      throw new CapabilityError('stale', true)
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE worldplanner_npc_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  private transact(work: () => void): void {
    if (this.db.inTransaction) work()
    else this.db.transaction(work)()
  }
}

function requireNpc(npc: WorldNpc | null): WorldNpc {
  if (!npc) throw new Error('Saved NPC is missing.')
  return npc
}

function requireFactionRevision(value: number | null): number {
  if (value === null) throw new CapabilityError('validation_failed', false)
  return value
}

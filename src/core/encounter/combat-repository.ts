import type Database from 'better-sqlite3'
import { z } from 'zod'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  combatConditionSchema,
  exhaustionLevelSchema
} from '../../shared/contracts/combat-status.js'
import { creatureById } from '../creatures/catalog.js'
import type { PartyStore } from '../party/party-store.js'
import type { SceneStore } from '../scene/scene-store.js'
import {
  combatMementoSchema,
  type CombatHistoryEffect,
  type CombatMemento,
  type Combatant
} from './combat-state-reducer.js'

export const combatHistoryInverseSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('member-states'),
      states: z.array(
        z
          .object({
            id: z.uuid(),
            currentHp: z.number().int().nonnegative(),
            conditions: z.array(combatConditionSchema),
            concentrating: z.boolean(),
            exhaustionLevel: exhaustionLevelSchema
          })
          .strict()
      )
    })
    .strict(),
  z
    .object({
      kind: z.literal('turn'),
      activeIndex: z.number().int().nonnegative(),
      round: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      kind: z.literal('initiative'),
      values: z.array(
        z.object({ id: z.string(), initiative: z.number().int() }).strict()
      ),
      turnOrder: z.array(z.string()),
      activeIndex: z.number().int().nonnegative()
    })
    .strict()
])

export type CombatHistoryInverse = CombatHistoryEffect['inverse']

export function initializeCombatSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS encounter_combat_runtime (
      scene_id TEXT PRIMARY KEY NOT NULL,
      id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      phase TEXT NOT NULL,
      active_index INTEGER NOT NULL,
      round INTEGER NOT NULL,
      generator_preset_id TEXT NOT NULL,
      generator_preset_revision INTEGER NOT NULL,
      generator_config_hash TEXT NOT NULL,
      mob_threshold INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_selected_groups (
      scene_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, group_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_sources (
      scene_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      party_id TEXT,
      group_id TEXT,
      creature_id TEXT,
      source_entry_id TEXT,
      partition_kind TEXT,
      display_ordinal INTEGER,
      quantity INTEGER,
      initiative INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, row_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_source_members (
      scene_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, row_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combatants (
      scene_id TEXT NOT NULL,
      id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      scene_member_id TEXT,
      party_id TEXT,
      initiative INTEGER NOT NULL,
      combat_order INTEGER NOT NULL,
      PRIMARY KEY(scene_id, id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_turn_order (
      scene_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      PRIMARY KEY(scene_id, position)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_resolution (
      scene_id TEXT PRIMARY KEY NOT NULL,
      threshold_mode TEXT NOT NULL DEFAULT 'defeated',
      xp_fraction REAL NOT NULL,
      xp_awarded INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_resolution_enemies (
      scene_id TEXT NOT NULL,
      enemy_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY(scene_id, enemy_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_combat_history (
      scene_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      label TEXT NOT NULL,
      inverse_kind TEXT NOT NULL,
      inverse_payload TEXT NOT NULL,
      PRIMARY KEY(scene_id, revision)
    );
  `)
}

export class CombatRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly sceneId: string,
    private readonly scene: SceneStore,
    private readonly party: PartyStore
  ) {}

  load(): CombatMemento | null {
    const root = this.db
      .prepare(
        `
        SELECT id, revision, phase, active_index AS activeIndex, round,
          generator_preset_id AS presetId,
          generator_preset_revision AS presetRevision,
          generator_config_hash AS configHash,
          mob_threshold AS mobThreshold
        FROM encounter_combat_runtime WHERE scene_id = ?
      `
      )
      .get(this.sceneId) as
      | {
          id: string
          revision: number
          phase: CombatMemento['phase']
          activeIndex: number
          round: number
          presetId: string
          presetRevision: number
          configHash: string
          mobThreshold: number
        }
      | undefined
    if (!root) return null
    const selectedGroupIds = (
      this.db
        .prepare(
          'SELECT group_id AS id FROM encounter_combat_selected_groups WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { id: string }[]
    ).map((row) => row.id)
    const sourceMembers = this.db
      .prepare(
        `SELECT row_id AS rowId, member_id AS memberId
         FROM encounter_combat_source_members
         WHERE scene_id = ? ORDER BY row_id, position`
      )
      .all(this.sceneId) as { rowId: string; memberId: string }[]
    const sources = (
      this.db
        .prepare(
          `
          SELECT row_id AS rowId, source_kind AS kind, party_id AS partyId,
            group_id AS groupId, creature_id AS creatureId,
            source_entry_id AS sourceEntryId,
            partition_kind AS partitionKind,
            display_ordinal AS displayOrdinal,
            quantity, initiative
          FROM encounter_combat_sources WHERE scene_id = ? ORDER BY position
        `
        )
        .all(this.sceneId) as {
        rowId: string
        kind: 'party' | 'monster'
        partyId: string | null
        groupId: string | null
        creatureId: string | null
        sourceEntryId: string | null
        partitionKind: 'individual' | 'mob' | null
        displayOrdinal: number | null
        quantity: number | null
        initiative: number
      }[]
    ).map((row) => {
      if (row.kind === 'party') {
        const member = this.party
          .read()
          .members.find((candidate) => candidate.id === row.partyId)
        if (!member) throw new CapabilityError('not_found', false)
        return {
          kind: 'party' as const,
          rowId: row.rowId,
          partyId: member.id,
          name: member.name,
          initiative: row.initiative
        }
      }
      const creature = row.creatureId ? creatureById(row.creatureId) : null
      if (
        !creature ||
        row.quantity === null ||
        !row.sourceEntryId ||
        !row.partitionKind
      )
        throw new CapabilityError('not_found', false)
      const memberIds = sourceMembers
        .filter((member) => member.rowId === row.rowId)
        .map((member) => member.memberId)
      return {
        kind: 'monster' as const,
        rowId: row.rowId,
        sourceEntryId: row.sourceEntryId,
        partitionKind: row.partitionKind,
        displayOrdinal: row.displayOrdinal,
        groupId: row.groupId,
        creatureId: creature.id,
        name:
          row.partitionKind === 'individual' && row.displayOrdinal !== null
            ? `${creature.name} #${row.displayOrdinal}`
            : creature.name,
        quantity: row.quantity,
        memberIds,
        initiative: row.initiative
      }
    })
    const combatants = this.db
      .prepare(
        `
        SELECT id, card_id AS cardId, scene_member_id AS sceneMemberId,
          party_id AS partyId, initiative,
          combat_order AS "order"
        FROM encounter_combatants WHERE scene_id = ? ORDER BY combat_order
      `
      )
      .all(this.sceneId)
      .flatMap((row): Combatant[] => {
        const raw = row as {
          id: string
          cardId: string
          sceneMemberId: string | null
          partyId: string | null
          initiative: number
          order: number
        }
        if (raw.sceneMemberId) {
          const member = this.scene.combatMember(raw.sceneMemberId)
          const creature = member ? creatureById(member.creatureId) : null
          if (!member || !creature) return []
          return [
            {
              id: member.id,
              cardId: raw.cardId,
              sceneMemberId: member.id,
              creatureId: creature.id,
              name: creature.name,
              playerCharacter: false,
              currentHp: member.currentHp,
              maxHp: creature.hp,
              armorClass: creature.ac,
              initiative: raw.initiative,
              xp: creature.xp,
              detail: `CR ${creature.cr} · ${creature.type}`,
              conditions: member.conditions,
              concentrating: member.concentrating,
              exhaustionLevel: member.exhaustionLevel,
              order: raw.order
            }
          ]
        }
        const member = this.party
          .read()
          .members.find((candidate) => candidate.id === raw.partyId)
        if (!member) throw new CapabilityError('not_found', false)
        return [
          {
            id: member.id,
            cardId: raw.cardId,
            sceneMemberId: null,
            creatureId: null,
            name: member.name,
            playerCharacter: true,
            currentHp: 0,
            maxHp: 0,
            armorClass: member.armorClass ?? 0,
            initiative: raw.initiative,
            xp: 0,
            detail: 'Aktives Party-Mitglied',
            conditions: [],
            concentrating: false,
            exhaustionLevel: 0,
            order: raw.order
          }
        ]
      })
    const turnOrder = (
      this.db
        .prepare(
          'SELECT card_id AS cardId FROM encounter_combat_turn_order WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { cardId: string }[]
    ).map((row) => row.cardId)
    const resolutionRow = this.db
      .prepare(
        `
        SELECT threshold_mode AS mode,
          xp_fraction AS xpFraction, xp_awarded AS xpAwarded
        FROM encounter_combat_resolution WHERE scene_id = ?
      `
      )
      .get(this.sceneId) as
      | {
          mode: 'defeated' | 'manual'
          xpFraction: number
          xpAwarded: number
        }
      | undefined
    const selectedEnemyIds = (
      this.db
        .prepare(
          'SELECT enemy_id AS id FROM encounter_combat_resolution_enemies WHERE scene_id = ? ORDER BY position'
        )
        .all(this.sceneId) as { id: string }[]
    ).map((row) => row.id)
    return combatMementoSchema.parse({
      id: root.id,
      revision: root.revision,
      phase: root.phase,
      activeIndex: root.activeIndex,
      round: root.round,
      preparedWith: {
        presetId: root.presetId,
        presetRevision: root.presetRevision,
        configHash: root.configHash,
        mobThreshold: root.mobThreshold
      },
      selectedGroupIds,
      sources,
      combatants,
      turnOrder,
      resolution: resolutionRow
        ? {
            selectedEnemyIds,
            mode: resolutionRow.mode,
            xpFraction: resolutionRow.xpFraction,
            xpAwarded: resolutionRow.xpAwarded === 1
          }
        : null
    })
  }

  save(state: CombatMemento): void {
    persistCombat(this.db, this.sceneId, combatMementoSchema.parse(state))
  }

  clear(): void {
    clearCombatTables(this.db, this.sceneId)
    this.clearHistory()
  }

  recordHistory(
    label: string,
    inverse: CombatHistoryInverse,
    revision: number
  ): void {
    const parsed = combatHistoryInverseSchema.parse(inverse)
    const { kind, ...payload } = parsed
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO encounter_combat_history (
          scene_id, revision, label, inverse_kind, inverse_payload
        ) VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(this.sceneId, revision, label, kind, JSON.stringify(payload))
    this.db
      .prepare(
        `
        DELETE FROM encounter_combat_history
        WHERE scene_id = ? AND revision NOT IN (
          SELECT revision FROM encounter_combat_history
          WHERE scene_id = ? ORDER BY revision DESC LIMIT 20
        )
      `
      )
      .run(this.sceneId, this.sceneId)
  }

  latestHistory(): Readonly<{
    revision: number
    inverse: CombatHistoryInverse
  }> | null {
    const row = this.db
      .prepare(
        `
        SELECT revision, inverse_kind AS kind, inverse_payload AS payload
        FROM encounter_combat_history
        WHERE scene_id = ?
        ORDER BY revision DESC
        LIMIT 1
      `
      )
      .get(this.sceneId) as
      { revision: number; kind: string; payload: string } | undefined
    if (!row) return null
    const inverse = combatHistoryInverseSchema.parse({
      kind: row.kind,
      ...(JSON.parse(row.payload) as Record<string, unknown>)
    })
    return { revision: row.revision, inverse }
  }

  deleteHistory(revision: number): void {
    this.db
      .prepare(
        'DELETE FROM encounter_combat_history WHERE scene_id = ? AND revision = ?'
      )
      .run(this.sceneId, revision)
  }

  latestUndoLabel(): string | null {
    const row = this.db
      .prepare(
        `
        SELECT label FROM encounter_combat_history
        WHERE scene_id = ? ORDER BY revision DESC LIMIT 1
      `
      )
      .get(this.sceneId) as { label: string } | undefined
    return row?.label ?? null
  }

  clearHistory(): void {
    this.db
      .prepare('DELETE FROM encounter_combat_history WHERE scene_id = ?')
      .run(this.sceneId)
  }
}

function clearCombatTables(db: Database.Database, sceneId: string): void {
  const tables = [
    'encounter_combat_resolution_enemies',
    'encounter_combat_resolution',
    'encounter_combat_turn_order',
    'encounter_combatants',
    'encounter_combat_source_members',
    'encounter_combat_sources',
    'encounter_combat_selected_groups',
    'encounter_combat_runtime'
  ] as const
  for (const table of tables)
    db.prepare(`DELETE FROM ${table} WHERE scene_id = ?`).run(sceneId)
}

function persistCombat(
  db: Database.Database,
  sceneId: string,
  state: CombatMemento
): void {
  const persist = () => {
    clearCombatTables(db, sceneId)
    db.prepare(
      `
      INSERT INTO encounter_combat_runtime (
        scene_id, id, revision, phase, active_index, round,
        generator_preset_id, generator_preset_revision,
        generator_config_hash, mob_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      sceneId,
      state.id,
      state.revision,
      state.phase,
      state.activeIndex,
      state.round,
      state.preparedWith.presetId,
      state.preparedWith.presetRevision,
      state.preparedWith.configHash,
      state.preparedWith.mobThreshold
    )
    const group = db.prepare(
      'INSERT INTO encounter_combat_selected_groups (scene_id, group_id, position) VALUES (?, ?, ?)'
    )
    state.selectedGroupIds.forEach((id, position) =>
      group.run(sceneId, id, position)
    )
    const source = db.prepare(`
      INSERT INTO encounter_combat_sources (
        scene_id, row_id, source_kind, party_id, group_id, creature_id,
        source_entry_id, partition_kind, display_ordinal,
        quantity, initiative, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    state.sources.forEach((entry, position) =>
      source.run(
        sceneId,
        entry.rowId,
        entry.kind,
        entry.kind === 'party' ? entry.partyId : null,
        entry.kind === 'monster' ? entry.groupId : null,
        entry.kind === 'monster' ? entry.creatureId : null,
        entry.kind === 'monster' ? entry.sourceEntryId : null,
        entry.kind === 'monster' ? entry.partitionKind : null,
        entry.kind === 'monster' ? entry.displayOrdinal : null,
        entry.kind === 'monster' ? entry.quantity : null,
        entry.initiative,
        position
      )
    )
    const sourceMember = db.prepare(`
      INSERT INTO encounter_combat_source_members (
        scene_id, row_id, member_id, position
      ) VALUES (?, ?, ?, ?)
    `)
    state.sources.forEach((entry) => {
      if (entry.kind !== 'monster') return
      entry.memberIds.forEach((memberId, position) =>
        sourceMember.run(sceneId, entry.rowId, memberId, position)
      )
    })
    const combatant = db.prepare(`
      INSERT INTO encounter_combatants (
        scene_id, id, card_id, scene_member_id, party_id, initiative,
        combat_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    state.combatants.forEach((entry) =>
      combatant.run(
        sceneId,
        entry.id,
        entry.cardId,
        entry.sceneMemberId,
        entry.playerCharacter ? entry.id : null,
        entry.initiative,
        entry.order
      )
    )
    const turn = db.prepare(
      'INSERT INTO encounter_combat_turn_order (scene_id, position, card_id) VALUES (?, ?, ?)'
    )
    state.turnOrder.forEach((id, position) => turn.run(sceneId, position, id))
    if (state.resolution) {
      db.prepare(
        `
        INSERT INTO encounter_combat_resolution (
          scene_id, threshold_mode, xp_fraction, xp_awarded
        ) VALUES (?, ?, ?, ?)
      `
      ).run(
        sceneId,
        state.resolution.mode,
        state.resolution.xpFraction,
        state.resolution.xpAwarded ? 1 : 0
      )
      const selected = db.prepare(
        'INSERT INTO encounter_combat_resolution_enemies (scene_id, enemy_id, position) VALUES (?, ?, ?)'
      )
      state.resolution.selectedEnemyIds.forEach((id, position) =>
        selected.run(sceneId, id, position)
      )
    }
  }
  if (db.inTransaction) persist()
  else db.transaction(persist)()
}

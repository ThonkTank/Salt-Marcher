import type Database from 'better-sqlite3'
import { itemDefinitionSchema } from '../../shared/contracts/loot.js'
import type { GeneratedRun } from '../../shared/contracts/session-generation.js'

/** Owner-internal repository for generated definitions and treasure children. */
export class GeneratedRunChildrenStore {
  constructor(private readonly db: Database.Database) {}

  insert(run: GeneratedRun): void {
    const definition = this.db.prepare(
      `INSERT INTO session_generation_item_definition (
         run_id, definition_id, reference_json, definition_json
       ) VALUES (?, ?, ?, ?)`
    )
    for (const candidate of run.itemDefinitions) {
      if (candidate.reference.kind !== 'generated')
        throw new Error('Generated run contains a non-generated definition')
      definition.run(
        run.id,
        candidate.reference.definitionId,
        JSON.stringify(candidate.reference),
        JSON.stringify(candidate)
      )
    }
    const treasure = this.db.prepare(
      `INSERT INTO session_generation_treasure (
         run_id, run_kind, id, position, stock_class, reward_channel,
         anchor_encounter_number, theme_id, theme, target_value_cp,
         actual_value_cp
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const container = this.db.prepare(
      `INSERT INTO session_generation_container (
         run_id, treasure_id, id, position, catalog_container_id, name,
         capacity
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const item = this.db.prepare(
      `INSERT INTO session_generation_item (
         run_id, treasure_id, id, position, item_reference_json, role,
         quantity, container_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    run.treasures.forEach((entry, position) => {
      treasure.run(
        run.id,
        run.runKind,
        entry.id,
        position,
        entry.stockClass,
        entry.rewardChannel,
        entry.anchorEncounterNumber,
        entry.themeId,
        entry.theme,
        entry.targetValueCp,
        entry.actualValueCp
      )
      entry.containers.forEach((candidate) =>
        container.run(
          run.id,
          entry.id,
          candidate.id,
          candidate.position,
          candidate.catalogContainerId,
          candidate.name,
          candidate.capacity
        )
      )
      entry.items.forEach((candidate) =>
        item.run(
          run.id,
          entry.id,
          candidate.id,
          candidate.position,
          JSON.stringify(candidate.itemReference),
          candidate.role,
          candidate.quantity,
          candidate.containerId
        )
      )
    })
  }

  readTreasures(runId: string): GeneratedRun['treasures'] {
    const treasureRows = this.db
      .prepare(
        `SELECT id, stock_class AS stockClass,
                reward_channel AS rewardChannel,
                anchor_encounter_number AS anchorEncounterNumber,
                theme_id AS themeId, theme, target_value_cp AS targetValueCp,
                actual_value_cp AS actualValueCp
           FROM session_generation_treasure
          WHERE run_id = ? ORDER BY position`
      )
      .all(runId) as Array<Record<string, unknown> & { id: string }>
    const containers = this.db
      .prepare(
        `SELECT treasure_id AS treasureId, id,
                catalog_container_id AS catalogContainerId, name, capacity,
                position
           FROM session_generation_container
          WHERE run_id = ? ORDER BY treasure_id, position`
      )
      .all(runId) as Array<Record<string, unknown> & { treasureId: string }>
    const items = (
      this.db
        .prepare(
          `SELECT treasure_id AS treasureId, id,
                  item_reference_json AS itemReferenceJson, role, quantity,
                  container_id AS containerId, position
             FROM session_generation_item
            WHERE run_id = ? ORDER BY treasure_id, position`
        )
        .all(runId) as Array<
        Record<string, unknown> & {
          treasureId: string
          itemReferenceJson: string
        }
      >
    ).map(({ itemReferenceJson, ...entry }) => ({
      ...entry,
      itemReference: JSON.parse(itemReferenceJson) as unknown
    }))
    return treasureRows.map((entry) => ({
      ...entry,
      containers: containers
        .filter((candidate) => candidate.treasureId === entry.id)
        .map(({ treasureId, ...candidate }) => {
          void treasureId
          return candidate
        }),
      items: items.filter((candidate) => candidate.treasureId === entry.id)
    })) as GeneratedRun['treasures']
  }

  readDefinitions(runId: string): GeneratedRun['itemDefinitions'] {
    return this.db
      .prepare(
        `SELECT definition_json AS definitionJson
           FROM session_generation_item_definition
          WHERE run_id = ? ORDER BY definition_id`
      )
      .all(runId)
      .map((row) =>
        itemDefinitionSchema.parse(
          JSON.parse((row as { definitionJson: string }).definitionJson)
        )
      )
  }
}

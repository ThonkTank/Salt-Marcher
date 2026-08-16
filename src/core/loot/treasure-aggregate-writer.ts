import type Database from 'better-sqlite3'
import type { TreasureAnchor } from '../../shared/contracts/loot.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import type { MaterializedTreasure } from './materialized-treasure.js'

export class TreasureAggregateWriter {
  constructor(private readonly db: Database.Database) {}

  insertGenerated(input: {
    runId: string
    generatedTreasureId: string
    draft: MaterializedTreasure
    anchor: TreasureAnchor
    now: string
  }): string {
    const id = uuidv7()
    const anchor = anchorColumns(input.anchor)
    this.db
      .prepare(
        `INSERT INTO loot_treasure (
           id, revision, label, anchor_kind, location_id, scene_id, group_id,
           last_known_label, source_kind, source_run_id, source_treasure_id,
           created_at, updated_at
         ) VALUES (?, 0, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, ?, ?)`
      )
      .run(
        id,
        input.draft.label,
        anchor.kind,
        anchor.locationId,
        anchor.sceneId,
        anchor.groupId,
        anchor.lastKnownLabel,
        input.runId,
        input.generatedTreasureId,
        input.now,
        input.now
      )

    const insertContainer = this.db.prepare(
      `INSERT INTO loot_container (
         id, treasure_id, source_container_id, catalog_container_id,
         name, capacity, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const containerIds = new Map<string, string>()
    input.draft.containers.forEach((container, position) => {
      const containerId = uuidv7()
      containerIds.set(container.draftId, containerId)
      insertContainer.run(
        containerId,
        id,
        container.sourceContainerId,
        container.catalogContainerId,
        container.name,
        container.capacity,
        position
      )
    })

    const insertItem = this.db.prepare(
      `INSERT INTO loot_item (
         id, treasure_id, source_line_id, item_reference_json, quantity,
         container_id, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    input.draft.items.forEach((item, position) => {
      const containerId = item.containerDraftId
        ? containerIds.get(item.containerDraftId)
        : null
      if (item.containerDraftId && !containerId)
        throw new CapabilityError('validation_failed', false, [
          {
            code: 'container_assignment_unknown',
            path: ['items', item.draftId, 'containerId'],
            parameters: { containerId: item.containerDraftId }
          }
        ])
      insertItem.run(
        uuidv7(),
        id,
        item.sourceLineId,
        JSON.stringify(item.itemReference),
        item.quantity,
        containerId,
        position
      )
    })
    return id
  }
}

function anchorColumns(anchor: TreasureAnchor) {
  if (anchor.kind === 'location')
    return {
      kind: anchor.kind,
      locationId: anchor.locationId,
      sceneId: null,
      groupId: null,
      lastKnownLabel: anchor.lastKnownLabel
    }
  if (anchor.kind === 'group')
    return {
      kind: anchor.kind,
      locationId: null,
      sceneId: anchor.sceneId,
      groupId: anchor.groupId,
      lastKnownLabel: anchor.lastKnownLabel
    }
  return {
    kind: anchor.kind,
    locationId: null,
    sceneId: null,
    groupId: null,
    lastKnownLabel: null
  }
}

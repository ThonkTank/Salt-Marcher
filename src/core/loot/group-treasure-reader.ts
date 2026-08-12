import type Database from 'better-sqlite3'

export interface GroupTreasureReader {
  treasureIdsForGroups(
    sceneId: string,
    groupIds: readonly string[]
  ): readonly string[]
}

export class SqliteGroupTreasureReader implements GroupTreasureReader {
  constructor(private readonly db: Database.Database) {}

  treasureIdsForGroups(
    sceneId: string,
    groupIds: readonly string[]
  ): readonly string[] {
    if (groupIds.length === 0) return []
    return (
      this.db
        .prepare(
          `SELECT id FROM loot_treasure
           WHERE anchor_kind = 'group' AND scene_id = ?
             AND group_id IN (SELECT value FROM json_each(?))
           ORDER BY updated_at, id`
        )
        .all(sceneId, JSON.stringify(groupIds)) as Array<{ id: string }>
    ).map(({ id }) => id)
  }
}

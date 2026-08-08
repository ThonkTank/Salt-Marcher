import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export type BiomeMapChange = Readonly<{
  campaignId: string
  mapId: string
  key: Readonly<{ q: number; r: number }>
  affectedTileCount: number
}>

export class BiomeHexUsageStore {
  constructor(
    private readonly db: Database.Database,
    private readonly campaignId: string
  ) {}

  usage(biomeId: string): readonly {
    mapId: string
    mapName: string
    tileCount: number
  }[] {
    return this.db
      .prepare(
        `SELECT map.id AS mapId, map.display_name AS mapName,
                COUNT(*) AS tileCount
         FROM hex_tile tile
         JOIN hex_map map ON map.id = tile.map_id
         WHERE tile.biome_id = ?
         GROUP BY map.id, map.display_name
         ORDER BY map.display_name, map.id`
      )
      .all(biomeId) as {
      mapId: string
      mapName: string
      tileCount: number
    }[]
  }

  replace(
    source: string,
    replacement: string,
    onlyMapId?: string
  ): readonly BiomeMapChange[] {
    const rows = this.db
      .prepare(
        `SELECT map_id AS mapId, chunk_q AS chunkQ, chunk_r AS chunkR,
                COUNT(*) AS affectedTileCount
         FROM hex_tile
         WHERE biome_id = ? AND (? IS NULL OR map_id = ?)
         GROUP BY map_id, chunk_q, chunk_r
         ORDER BY map_id, chunk_q, chunk_r`
      )
      .all(source, onlyMapId ?? null, onlyMapId ?? null) as {
      mapId: string
      chunkQ: number
      chunkR: number
      affectedTileCount: number
    }[]
    if (rows.length === 0) return []
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE hex_tile SET biome_id = ?
           WHERE biome_id = ? AND (? IS NULL OR map_id = ?)`
        )
        .run(replacement, source, onlyMapId ?? null, onlyMapId ?? null)

      rewriteJsonRows(
        this.db,
        'hex_edit_history',
        ['before_json', 'after_json'],
        source,
        replacement,
        onlyMapId
      )
      rewriteJsonRows(
        this.db,
        'hex_command_receipt',
        ['result_json'],
        source,
        replacement,
        onlyMapId
      )

      const maps = [...new Set(rows.map((row) => row.mapId))]
      const bumpChunk = this.db.prepare(
        `INSERT INTO hex_chunk_revision (map_id, chunk_q, chunk_r, revision)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(map_id, chunk_q, chunk_r)
         DO UPDATE SET revision = revision + 1`
      )
      for (const row of rows) bumpChunk.run(row.mapId, row.chunkQ, row.chunkR)
      const bumpMap = this.db.prepare(
        'UPDATE hex_map SET content_revision = content_revision + 1 WHERE id = ?'
      )
      for (const mapId of maps) bumpMap.run(mapId)
    })()
    return rows.map((row) => ({
      campaignId: this.campaignId,
      mapId: row.mapId,
      key: { q: row.chunkQ, r: row.chunkR },
      affectedTileCount: row.affectedTileCount
    }))
  }

  replaceOnMap(
    source: string,
    replacement: string,
    mapId: string,
    expectedContentRevision: number
  ): readonly BiomeMapChange[] {
    const revision = this.db
      .prepare(
        'SELECT content_revision AS contentRevision FROM hex_map WHERE id = ?'
      )
      .get(mapId) as { contentRevision: number } | undefined
    if (!revision) throw new CapabilityError('not_found', false)
    if (revision.contentRevision !== expectedContentRevision)
      throw new CapabilityError('stale', true)
    return this.replace(source, replacement, mapId)
  }
}

function rewriteJsonRows(
  db: Database.Database,
  table: 'hex_edit_history' | 'hex_command_receipt',
  columns: readonly string[],
  source: string,
  replacement: string,
  onlyMapId?: string
): void {
  const rows = db
    .prepare(
      `SELECT rowid, ${columns.join(', ')} FROM ${table}
       WHERE (? IS NULL OR map_id = ?)
         AND (${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`
    )
    .all(
      onlyMapId ?? null,
      onlyMapId ?? null,
      ...columns.map(() => `%${source}%`)
    ) as Record<string, unknown>[]
  for (const row of rows) {
    const values = columns.map((column) =>
      JSON.stringify(
        replaceJsonValue(JSON.parse(String(row[column])), source, replacement)
      )
    )
    db.prepare(
      `UPDATE ${table} SET ${columns
        .map((column) => `${column} = ?`)
        .join(', ')} WHERE rowid = ?`
    ).run(...values, row['rowid'])
  }
}

function replaceJsonValue(
  value: unknown,
  source: string,
  replacement: string
): unknown {
  if (Array.isArray(value))
    return value.map((entry) => replaceJsonValue(entry, source, replacement))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        key === 'biomeId' && entry === source
          ? replacement
          : replaceJsonValue(entry, source, replacement)
      ])
    )
  return value
}

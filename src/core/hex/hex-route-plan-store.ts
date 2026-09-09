import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  hexRoutePlanSnapshotSchema,
  type HexRoutePlan,
  type HexRoutePlanSnapshot
} from '../../shared/contracts/hex-travel-command.js'

export function initializeHexRoutePlanSchema(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS hex_route_plan (
    scene_id TEXT PRIMARY KEY NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 1),
    plan_json TEXT
  )`)
}

/** Clearing keeps the revision so an older editor cannot resurrect a deleted plan. */
export class HexRoutePlanStore {
  constructor(private readonly db: Database.Database) {}

  read(sceneId: string): HexRoutePlanSnapshot {
    const row = this.db
      .prepare(
        'SELECT revision, plan_json AS plan FROM hex_route_plan WHERE scene_id = ?'
      )
      .get(sceneId) as { revision: number; plan: string | null } | undefined
    return hexRoutePlanSnapshotSchema.parse({
      sceneId,
      revision: row?.revision ?? 0,
      plan: row?.plan ? (JSON.parse(row.plan) as unknown) : null
    })
  }

  save(
    sceneId: string,
    expectedRevision: number,
    plan: HexRoutePlan | null
  ): void {
    const current = this.read(sceneId)
    if (current.revision !== expectedRevision)
      throw new CapabilityError('stale', true)
    const next = hexRoutePlanSnapshotSchema.parse({
      sceneId,
      revision: current.revision + 1,
      plan
    })
    this.db
      .prepare(
        `INSERT INTO hex_route_plan (scene_id, revision, plan_json)
      VALUES (?, ?, ?) ON CONFLICT(scene_id) DO UPDATE SET
      revision = excluded.revision, plan_json = excluded.plan_json`
      )
      .run(
        sceneId,
        next.revision,
        next.plan === null ? null : JSON.stringify(next.plan)
      )
  }
}

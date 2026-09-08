import type Database from 'better-sqlite3'
import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  saveSceneDesktopInputSchema,
  readStoredDesktopState,
  sceneDesktopScopeSchema,
  sceneDesktopSnapshotSchema,
  type SaveSceneDesktopInput,
  type SceneDesktopScope,
  type SceneDesktopSnapshot
} from '../../shared/contracts/scene-desktop.js'

export function initializeSceneDesktopSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_desktop (
      campaign_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 1),
      state_json TEXT NOT NULL,
      PRIMARY KEY(campaign_id, scene_id)
    );
  `)
}

/** Installation-owned presentation data; never mutates Campaign or Scene truth. */
export class SceneDesktopStore {
  constructor(private readonly persistence: SqliteDatabaseAccess) {}

  read(input: SceneDesktopScope): SceneDesktopSnapshot {
    const scope = sceneDesktopScopeSchema.parse(input)
    return this.persistence.use((db) => this.readFrom(db, scope))
  }

  save(input: SaveSceneDesktopInput): SceneDesktopSnapshot {
    const value = saveSceneDesktopInputSchema.parse(input)
    return this.persistence.use((db) =>
      db.transaction(() => {
        const current = this.readFrom(db, value)
        if (current.revision !== value.expectedRevision)
          throw new CapabilityError('stale', true)
        db.prepare(
          `INSERT INTO scene_desktop (campaign_id, scene_id, revision, state_json)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(campaign_id, scene_id) DO UPDATE SET
             revision = revision + 1, state_json = excluded.state_json`
        ).run(value.campaignId, value.sceneId, JSON.stringify(value.state))
        return this.readFrom(db, value)
      })()
    )
  }

  private readFrom(
    db: Database.Database,
    scope: SceneDesktopScope
  ): SceneDesktopSnapshot {
    const row = db
      .prepare(
        `SELECT revision, state_json AS stateJson FROM scene_desktop
         WHERE campaign_id = ? AND scene_id = ?`
      )
      .get(scope.campaignId, scope.sceneId) as
      { revision: number; stateJson: string } | undefined
    return sceneDesktopSnapshotSchema.parse({
      campaignId: scope.campaignId,
      sceneId: scope.sceneId,
      revision: row?.revision ?? 0,
      state: row
        ? readStoredDesktopState(JSON.parse(row.stateJson) as unknown)
        : null
    })
  }
}

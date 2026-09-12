import type Database from 'better-sqlite3'
import { z } from 'zod'
const sceneRow = z
  .object({
    id: z.string(),
    title: z.string(),
    location_id: z.string().nullable(),
    location_name: z.string(),
    game_time_seconds: z.number(),
    position: z.number()
  })
  .strict()
const assignment = z
  .object({
    scene_id: z.string(),
    party_member_id: z.string(),
    position: z.number()
  })
  .strict()
export const scenePartyHistorySchema = z
  .object({
    assignments: z.array(
      z
        .object({ before: assignment.nullable(), after: assignment.nullable() })
        .strict()
    ),
    created: z.array(sceneRow)
  })
  .strict()
export type ScenePartyHistory = z.infer<typeof scenePartyHistorySchema>
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)
export class ScenePartyHistoryOwner {
  constructor(private readonly db: Database.Database) {}
  capture() {
    return {
      scenes: z
        .array(sceneRow)
        .parse(
          this.db.prepare('SELECT * FROM scene_running_scene ORDER BY id').all()
        ),
      assignments: z
        .array(assignment)
        .parse(
          this.db
            .prepare(
              'SELECT * FROM scene_party_member ORDER BY party_member_id'
            )
            .all()
        )
    }
  }
  changes(
    before: ReturnType<ScenePartyHistoryOwner['capture']>
  ): ScenePartyHistory {
    const after = this.capture()
    const ids = new Set(
      [...before.assignments, ...after.assignments].map(
        (row) => row.party_member_id
      )
    )
    return {
      assignments: [...ids].flatMap((id) => {
        const a =
          before.assignments.find((row) => row.party_member_id === id) ?? null
        const b =
          after.assignments.find((row) => row.party_member_id === id) ?? null
        return equal(a, b) ? [] : [{ before: a, after: b }]
      }),
      created: after.scenes.filter(
        (scene) => !before.scenes.some((previous) => previous.id === scene.id)
      )
    }
  }
  conflict(value: ScenePartyHistory, undo: boolean): string | null {
    const current = this.capture()
    for (const change of value.assignments) {
      const id = (change.before ?? change.after)!.party_member_id
      const expected = undo ? change.after : change.before
      const next = undo ? change.before : change.after
      if (
        next &&
        !current.scenes.some((scene) => scene.id === next.scene_id) &&
        (undo || !value.created.some((scene) => scene.id === next.scene_id))
      )
        return 'Die betroffene Szene wurde inzwischen gelöscht.'
      if (
        !equal(
          current.assignments.find((row) => row.party_member_id === id) ?? null,
          expected
        )
      )
        return 'Die Besetzung wurde später geändert.'
    }
    for (const scene of value.created) {
      const currentScene = current.scenes.find((row) => row.id === scene.id)
      if (undo) {
        if (!equal(currentScene, scene))
          return 'Die neue Szene wurde später geändert.'
        if (
          this.db
            .prepare('SELECT 1 FROM scene_group WHERE scene_id = ?')
            .get(scene.id)
        )
          return 'Die neue Szene enthält inzwischen Gruppen.'
        if (
          this.db
            .prepare(
              'SELECT 1 FROM scene_workspace WHERE focused_scene_id = ? OR default_scene_id = ?'
            )
            .get(scene.id, scene.id)
        )
          return 'Die neue Szene ist aktuell geöffnet. Vor der Rücknahme zur Ausgangsszene wechseln.'
        if (
          current.assignments.some(
            (row) =>
              row.scene_id === scene.id &&
              !value.assignments.some((change) => equal(change.after, row))
          )
        )
          return 'Die neue Szene hat weitere Mitglieder.'
      } else if (currentScene) return 'Die Zielszene existiert bereits.'
    }
    return null
  }
  restore(value: ScenePartyHistory, undo: boolean): void {
    if (!undo)
      for (const scene of value.created)
        this.db
          .prepare(
            'INSERT INTO scene_running_scene (id, title, location_id, location_name, game_time_seconds, position) VALUES (@id, @title, @location_id, @location_name, @game_time_seconds, @position)'
          )
          .run(scene)
    for (const change of value.assignments)
      this.db
        .prepare('DELETE FROM scene_party_member WHERE party_member_id = ?')
        .run((change.before ?? change.after)!.party_member_id)
    for (const change of value.assignments) {
      const next = undo ? change.before : change.after
      if (next)
        this.db
          .prepare(
            'INSERT INTO scene_party_member (scene_id, party_member_id, position) VALUES (@scene_id, @party_member_id, @position)'
          )
          .run(next)
    }
    if (undo)
      for (const scene of value.created)
        this.db
          .prepare('DELETE FROM scene_running_scene WHERE id = ?')
          .run(scene.id)
    if (value.assignments.length || value.created.length)
      this.db
        .prepare(
          'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
        )
        .run()
  }
}

import type Database from 'better-sqlite3'
import { z } from 'zod'
const journeySchema = z
  .object({
    scene_id: z.string(),
    revision: z.number(),
    map_id: z.string(),
    status: z.string(),
    current_index: z.number(),
    party_member_ids_json: z.string(),
    multiplier: z.number(),
    segment_started_at: z.number().nullable(),
    abort_reason: z.string().nullable(),
    hint_code: z.string().nullable(),
    path: z.array(
      z
        .object({
          position: z.number(),
          map_id: z.string(),
          q: z.number(),
          r: z.number()
        })
        .strict()
    ),
    route: z
      .object({ revision: z.number(), plan_json: z.string().nullable() })
      .strict()
      .nullable()
  })
  .strict()
export const partyTravelChangeSchema = z
  .object({ before: journeySchema, after: journeySchema })
  .strict()
export type PartyTravelChange = z.infer<typeof partyTravelChangeSchema>
export class PartyTravelHistoryOwner {
  constructor(private readonly db: Database.Database) {}
  hasState(sceneId: string): boolean {
    return (
      !!this.db
        .prepare('SELECT 1 FROM hex_journey WHERE scene_id = ?')
        .get(sceneId) ||
      !!this.db
        .prepare('SELECT 1 FROM hex_route_plan WHERE scene_id = ?')
        .get(sceneId)
    )
  }
  capture() {
    return z.array(journeySchema).parse(
      this.db
        .prepare('SELECT * FROM hex_journey ORDER BY scene_id')
        .all()
        .map((value) => {
          const row = value as { scene_id: string }
          return {
            ...row,
            path: this.db
              .prepare(
                'SELECT position, map_id, q, r FROM hex_journey_path WHERE scene_id = ? ORDER BY position'
              )
              .all(row.scene_id),
            route:
              this.db
                .prepare(
                  'SELECT revision, plan_json FROM hex_route_plan WHERE scene_id = ?'
                )
                .get(row.scene_id) ?? null
          }
        })
    )
  }
  changes(
    before: ReturnType<PartyTravelHistoryOwner['capture']>
  ): PartyTravelChange[] {
    return this.capture().flatMap((after) => {
      const previous = before.find((row) => row.scene_id === after.scene_id)
      return previous && JSON.stringify(previous) !== JSON.stringify(after)
        ? [{ before: previous, after }]
        : []
    })
  }
  conflict(
    changes: readonly PartyTravelChange[],
    undo: boolean
  ): string | null {
    const current = this.capture()
    for (const change of changes) {
      const expected = undo ? change.after : change.before
      const actual = current.find((row) => row.scene_id === expected.scene_id)
      if (
        !actual ||
        JSON.stringify({ ...actual, revision: 0, segment_started_at: null }) !==
          JSON.stringify({ ...expected, revision: 0, segment_started_at: null })
      )
        return 'Die betroffene Reise wurde später geändert.'
    }
    return null
  }
  restore(changes: readonly PartyTravelChange[], undo: boolean): void {
    for (const change of changes) {
      const next = undo ? change.before : change.after
      this.db
        .prepare(
          'UPDATE hex_journey SET status = ?, hint_code = ?, segment_started_at = ?, revision = revision + 1 WHERE scene_id = ?'
        )
        .run(
          next.status,
          next.hint_code,
          next.status === 'travelling' ? Date.now() : null,
          next.scene_id
        )
    }
  }
}

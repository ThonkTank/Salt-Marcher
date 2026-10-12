import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { matchesReferenceSearch } from '../../shared/reference/reference-search.js'

export type PlannedSceneReference = Readonly<{
  id: string
  sessionId: string
  sessionName: string
  title: string
  notes: string
  locationId: string | null
  manualLootNotes: readonly string[]
}>
type SceneRow = Readonly<{
  id: string
  sessionId: string
  sessionName: string
  title: string | null
  titleKind:
    | 'authored'
    | 'generated_encounter'
    | 'generated_quest_rewards'
    | 'generated_environment_rewards'
  position: number
  notes: string
  locationId: string | null
}>
const sceneQuery = `SELECT scene.id, scene.session_id AS sessionId,
  session.display_name AS sessionName, scene.title, scene.title_kind AS titleKind,
  scene.position, scene.notes, scene.location_id AS locationId
  FROM session_planner_scenes AS scene
  JOIN session_planner_sessions AS session ON session.id = scene.session_id`

/** Reads authored preparation without opening or changing its selected Session. */
export class PlannedSceneReferences {
  constructor(private readonly database: SqliteDatabaseAccess) {}

  search(
    words: readonly string[]
  ): readonly { id: string; title: string; sessionName: string }[] {
    return this.database.use((db) => {
      const notes = db.prepare(
        'SELECT note_text AS text FROM session_planner_manual_loot_notes WHERE scene_id = ? ORDER BY position'
      )
      const matches: { id: string; title: string; sessionName: string }[] = []
      for (const value of db.prepare(sceneQuery).iterate()) {
        const row = value as SceneRow
        const title = sceneTitle(row)
        const manual = (notes.all(row.id) as { text: string }[])
          .map(({ text }) => text)
          .join('\n')
        if (
          matchesReferenceSearch(
            words,
            `${title}\n${row.sessionName}\n${row.notes}\n${manual}`
          )
        )
          matches.push({
            id: row.id,
            title,
            sessionName: row.sessionName
          })
      }
      return matches
    })
  }

  detail(id: string): PlannedSceneReference {
    return this.database.use((db) => {
      const row = db.prepare(`${sceneQuery} WHERE scene.id = ?`).get(id) as
        SceneRow | undefined
      if (!row) throw new CapabilityError('not_found', false)
      const manualLootNotes = (
        db
          .prepare(
            'SELECT note_text AS text FROM session_planner_manual_loot_notes WHERE scene_id = ? ORDER BY position'
          )
          .all(id) as { text: string }[]
      ).map(({ text }) => text)
      return { ...row, title: sceneTitle(row), manualLootNotes }
    })
  }

  sceneIds(sessionId: string): readonly string[] {
    return this.database.use((db) =>
      (
        db
          .prepare(
            'SELECT id FROM session_planner_scenes WHERE session_id = ? ORDER BY position'
          )
          .all(sessionId) as { id: string }[]
      ).map(({ id }) => id)
    )
  }
}

function sceneTitle(row: SceneRow): string {
  if (row.titleKind === 'authored') return row.title!
  if (row.titleKind === 'generated_encounter')
    return `Encounter ${row.position + 1}`
  return row.titleKind === 'generated_quest_rewards'
    ? 'Questbelohnungen'
    : 'Umgebungsfunde'
}

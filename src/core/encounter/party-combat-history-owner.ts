import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CombatRepository,
  combatHistoryInverseSchema
} from './combat-repository.js'
import { combatMementoSchema } from './combat-state-reducer.js'
import { PartyStore } from '../party/party-store.js'
import { SceneStore } from '../scene/scene-store.js'
const historySchema = z.array(
  z
    .object({
      revision: z.number(),
      label: z.string(),
      inverse: combatHistoryInverseSchema
    })
    .strict()
)
const stateSchema = z
  .object({ state: combatMementoSchema.nullable(), history: historySchema })
  .strict()
export const partyCombatChangeSchema = z
  .object({ sceneId: z.string(), before: stateSchema, after: stateSchema })
  .strict()
export type PartyCombatChange = z.infer<typeof partyCombatChangeSchema>
function withoutRevision(value: z.infer<typeof stateSchema>) {
  return {
    ...value,
    state: value.state ? { ...value.state, revision: 0 } : null
  }
}
export class PartyCombatHistoryOwner {
  constructor(private readonly db: Database.Database) {}
  private repository(id: string) {
    return new CombatRepository(
      this.db,
      id,
      new SceneStore(this.db),
      new PartyStore(this.db)
    )
  }
  hasState(sceneId: string): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM encounter_combat_runtime WHERE scene_id = ?')
      .get(sceneId)
  }
  capture() {
    return (
      this.db
        .prepare(
          'SELECT scene_id FROM encounter_combat_runtime ORDER BY scene_id'
        )
        .all() as { scene_id: string }[]
    ).map(({ scene_id }) => ({ sceneId: scene_id, ...this.read(scene_id) }))
  }
  private read(id: string) {
    const history = (
      this.db
        .prepare(
          'SELECT revision, label, inverse_kind, inverse_payload FROM encounter_combat_history WHERE scene_id = ? ORDER BY revision'
        )
        .all(id) as {
        revision: number
        label: string
        inverse_kind: string
        inverse_payload: string
      }[]
    ).map((row) => ({
      revision: row.revision,
      label: row.label,
      inverse: combatHistoryInverseSchema.parse({
        kind: row.inverse_kind,
        ...JSON.parse(row.inverse_payload)
      })
    }))
    return { state: this.repository(id).load(), history }
  }
  changes(
    before: ReturnType<PartyCombatHistoryOwner['capture']>
  ): PartyCombatChange[] {
    const after = this.capture()
    return [
      ...new Set([...before, ...after].map((state) => state.sceneId))
    ].flatMap((sceneId) => {
      const previous = before.find((state) => state.sceneId === sceneId)
      const next = after.find((state) => state.sceneId === sceneId)
      const a = {
        state: previous?.state ?? null,
        history: previous?.history ?? []
      }
      const b = { state: next?.state ?? null, history: next?.history ?? [] }
      return JSON.stringify(a) === JSON.stringify(b)
        ? []
        : [{ sceneId, before: a, after: b }]
    })
  }
  conflict(
    changes: readonly PartyCombatChange[],
    undo: boolean
  ): string | null {
    for (const change of changes)
      if (
        JSON.stringify(withoutRevision(this.read(change.sceneId))) !==
        JSON.stringify(withoutRevision(undo ? change.after : change.before))
      )
        return 'Der betroffene Kampf wurde später geändert.'
    return null
  }
  restore(changes: readonly PartyCombatChange[], undo: boolean): void {
    for (const change of changes) {
      const next = undo ? change.before : change.after
      const repository = this.repository(change.sceneId)
      const revision =
        Math.max(
          repository.load()?.revision ?? 0,
          change.before.state?.revision ?? 0,
          change.after.state?.revision ?? 0
        ) + 1
      if (next.state) repository.save({ ...next.state, revision })
      else repository.clear()
      repository.clearHistory()
      for (const entry of next.history)
        repository.recordHistory(entry.label, entry.inverse, entry.revision)
    }
  }
}

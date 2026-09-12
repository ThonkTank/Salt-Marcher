import type Database from 'better-sqlite3'
import { z } from 'zod'
import { partyCharacterSchema } from '../../shared/contracts/party.js'
import { PartyStore } from './party-store.js'

export const partyHistoryChangeSchema = z
  .object({ before: partyCharacterSchema, after: partyCharacterSchema })
  .strict()
export type PartyHistoryChange = z.infer<typeof partyHistoryChangeSchema>
const fields = {
  name: 'name',
  playerName: 'player_name',
  species: 'species',
  characterClass: 'character_class',
  level: 'level',
  passivePerception: 'passive_perception',
  passiveInsight: 'passive_insight',
  passiveInvestigation: 'passive_investigation',
  armorClass: 'armor_class',
  movementSpeedFeet: 'movement_speed_feet',
  active: 'active',
  xp: 'xp',
  xpSinceShortRest: 'xp_since_short_rest',
  xpSinceLongRest: 'xp_since_long_rest'
} as const
const burdenFields = {
  shortTrusted: 'short_rest_trusted',
  longTrusted: 'long_rest_trusted',
  completedShortRestSections: 'rest_sections_closed',
  sectionStartXp: 'rest_section_start_xp',
  sectionsTrusted: 'rest_sections_trusted'
} as const
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)
export class PartyHistoryOwner {
  constructor(private readonly db: Database.Database) {}
  capture() {
    return new PartyStore(this.db).read().members
  }
  changes(
    before: ReturnType<PartyHistoryOwner['capture']>
  ): PartyHistoryChange[] {
    return this.capture().flatMap((after) => {
      const previous = before.find((member) => member.id === after.id)
      return previous && !equal(previous, after)
        ? [{ before: previous, after }]
        : []
    })
  }
  conflict(
    changes: readonly PartyHistoryChange[],
    undo: boolean
  ): string | null {
    const members = this.capture()
    for (const change of changes) {
      const expected = undo ? change.after : change.before
      const current = members.find((member) => member.id === expected.id)
      if (!current) return `${expected.name} wurde gelöscht.`
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
        if (
          !equal(change.before[key], change.after[key]) &&
          !equal(current[key], expected[key])
        )
          return `${expected.name}: Charakterwerte (${key}) wurden später geändert.`
      }
      for (const key of Object.keys(
        burdenFields
      ) as (keyof typeof burdenFields)[]) {
        if (
          !equal(change.before.burden?.[key], change.after.burden?.[key]) &&
          !equal(current.burden?.[key], expected.burden?.[key])
        )
          return `${expected.name}: Raststand wurde später geändert.`
      }
      if (
        !equal(change.before.languages, change.after.languages) &&
        !equal(current.languages, expected.languages)
      )
        return `${expected.name}: Sprachen wurden später geändert.`
    }
    return null
  }
  restore(changes: readonly PartyHistoryChange[], undo: boolean): void {
    for (const change of changes) {
      const next = undo ? change.before : change.after
      for (const [key, column] of Object.entries(fields) as [
        keyof typeof fields,
        string
      ][]) {
        if (equal(change.before[key], change.after[key])) continue
        const value = next[key]
        this.db
          .prepare(`UPDATE player_characters SET ${column} = ? WHERE id = ?`)
          .run(typeof value === 'boolean' ? Number(value) : value, next.id)
      }
      for (const [key, column] of Object.entries(burdenFields) as [
        keyof typeof burdenFields,
        string
      ][]) {
        if (equal(change.before.burden?.[key], change.after.burden?.[key]))
          continue
        const value = next.burden?.[key] ?? 0
        this.db
          .prepare(`UPDATE player_characters SET ${column} = ? WHERE id = ?`)
          .run(Number(value), next.id)
      }
      if (!equal(change.before.languages, change.after.languages)) {
        this.db
          .prepare(
            'DELETE FROM player_character_language WHERE character_id = ?'
          )
          .run(next.id)
        const insert = this.db.prepare(
          'INSERT INTO player_character_language (character_id, language, position) VALUES (?, ?, ?)'
        )
        next.languages.forEach((language, position) =>
          insert.run(next.id, language, position)
        )
      }
    }
    if (changes.length)
      this.db
        .prepare(
          'UPDATE party_roster_metadata SET revision = revision + 1 WHERE singleton = 1'
        )
        .run()
  }
}

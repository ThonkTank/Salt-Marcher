import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  partyCharacterDraftSchema,
  partySnapshotSchema,
  type PartyCharacterDraft,
  type PartySnapshot
} from '../../shared/contracts/party.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import {
  adventuringDay,
  applyRest,
  applyXpAdjustment,
  clearPartyHexPosition,
  initialXpForLevel,
  positionPartyAtHex,
  xpAfterLevelSelection
} from './party-roster-domain.js'
import { mapPartyCharacterRow } from './party-row-mapper.js'

export {
  adventuringDay,
  calculateAdventuringDay,
  dailyXp,
  levelXp
} from './party-roster-domain.js'

export function initializePartySchema(db: Database.Database): void {
  createPartyTables(db)

  const metadata = db
    .prepare('SELECT 1 FROM party_roster_metadata WHERE singleton = 1')
    .get()
  if (metadata !== undefined) return
  db.prepare(
    'INSERT INTO party_roster_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export function migratePartySchema28To29(db: Database.Database): void {
  const hasParty =
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'player_characters'"
      )
      .get() !== undefined
  if (!hasParty) return
  const columns = new Set(
    (db.pragma('table_info(player_characters)') as Array<{ name: string }>).map(
      (column) => column.name
    )
  )
  if (!columns.has('species'))
    db.exec('ALTER TABLE player_characters ADD COLUMN species TEXT')
  if (!columns.has('character_class'))
    db.exec('ALTER TABLE player_characters ADD COLUMN character_class TEXT')
  if (!columns.has('passive_investigation'))
    db.exec(
      'ALTER TABLE player_characters ADD COLUMN passive_investigation INTEGER CHECK(passive_investigation BETWEEN 0 AND 99)'
    )
  if (!columns.has('passive_insight'))
    db.exec(
      'ALTER TABLE player_characters ADD COLUMN passive_insight INTEGER CHECK(passive_insight BETWEEN 0 AND 99)'
    )
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_character_language (
      character_id TEXT NOT NULL REFERENCES player_characters(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (character_id, language COLLATE NOCASE),
      UNIQUE (character_id, position)
    );
  `)
}

function createPartyTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS party_roster_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS player_characters (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      player_name TEXT,
      species TEXT,
      character_class TEXT,
      level INTEGER CHECK(level BETWEEN 1 AND 20),
      passive_perception INTEGER CHECK(passive_perception BETWEEN 0 AND 99),
      passive_investigation INTEGER CHECK(passive_investigation BETWEEN 0 AND 99),
      passive_insight INTEGER CHECK(passive_insight BETWEEN 0 AND 99),
      armor_class INTEGER CHECK(armor_class BETWEEN 0 AND 99),
      active INTEGER NOT NULL CHECK(active IN (0, 1)),
      xp INTEGER NOT NULL CHECK(xp >= 0),
      xp_since_short_rest INTEGER NOT NULL CHECK(xp_since_short_rest >= 0),
      xp_since_long_rest INTEGER NOT NULL CHECK(xp_since_long_rest >= 0),
      movement_speed_feet INTEGER CHECK(movement_speed_feet BETWEEN 0 AND 999),
      travel_map_id TEXT,
      travel_q INTEGER,
      travel_r INTEGER,
      travel_state TEXT NOT NULL DEFAULT 'detached'
        CHECK(travel_state IN ('detached', 'attached-unpositioned', 'hex-positioned')),
      position INTEGER NOT NULL CHECK(position >= 0),
      CHECK(
        (travel_state = 'hex-positioned' AND travel_map_id IS NOT NULL AND travel_q IS NOT NULL AND travel_r IS NOT NULL)
        OR
        (travel_state IN ('detached', 'attached-unpositioned') AND travel_map_id IS NULL AND travel_q IS NULL AND travel_r IS NULL)
      )
    );
    CREATE TABLE IF NOT EXISTS party_xp_awards (
      combat_id TEXT PRIMARY KEY NOT NULL,
      xp_each INTEGER NOT NULL CHECK(xp_each >= 0)
    );
    CREATE TABLE IF NOT EXISTS player_character_language (
      character_id TEXT NOT NULL REFERENCES player_characters(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (character_id, language COLLATE NOCASE),
      UNIQUE (character_id, position)
    );
  `)
}

export class PartyStore {
  constructor(private readonly db: Database.Database) {}

  read(): PartySnapshot {
    const metadata = this.db
      .prepare('SELECT revision FROM party_roster_metadata WHERE singleton = 1')
      .get() as { revision: number }
    const rows = this.db
      .prepare(
        `
        SELECT id, name, player_name, species, character_class, level,
               passive_perception, passive_investigation, passive_insight, armor_class,
               active, xp, xp_since_short_rest, xp_since_long_rest,
               movement_speed_feet, travel_map_id, travel_q, travel_r,
               travel_state
        FROM player_characters ORDER BY position, id
      `
      )
      .all() as Array<Record<string, unknown> & { id: string }>
    const languages = this.languageMap()
    const members = rows.map((row) =>
      mapPartyCharacterRow(row, languages.get(row.id) ?? [])
    )
    return partySnapshotSchema.parse({
      revision: metadata.revision,
      members,
      adventuringDay: adventuringDay(members)
    })
  }

  create(draft: PartyCharacterDraft, expectedRevision: number): PartySnapshot {
    const parsed = partyCharacterDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM player_characters'
          )
          .get() as { value: number }
      ).value
      const xp = initialXpForLevel(parsed.level)
      const id = uuidv7()
      this.db
        .prepare(
          `
          INSERT INTO player_characters (
            id, name, player_name, species, character_class, level,
            passive_perception, passive_investigation, passive_insight, armor_class,
            active, xp, xp_since_short_rest, xp_since_long_rest,
            movement_speed_feet, position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?, ?)
        `
        )
        .run(
          id,
          parsed.name,
          nullable(parsed.playerName),
          nullable(parsed.species),
          nullable(parsed.characterClass),
          parsed.level,
          parsed.passivePerception,
          parsed.passiveInvestigation,
          parsed.passiveInsight,
          parsed.armorClass,
          xp,
          parsed.movementSpeedFeet,
          position
        )
      this.replaceLanguages(id, parsed.languages)
    })
    return this.read()
  }

  update(
    id: string,
    draft: PartyCharacterDraft,
    expectedRevision: number
  ): PartySnapshot {
    const parsed = partyCharacterDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      const current = this.db
        .prepare('SELECT xp FROM player_characters WHERE id = ?')
        .get(id) as { xp: number } | undefined
      if (!current) throw new CapabilityError('not_found', false)
      const xp = xpAfterLevelSelection(current.xp, parsed.level)
      this.db
        .prepare(
          `
          UPDATE player_characters
          SET name = ?, player_name = ?, species = ?, character_class = ?, level = ?,
              passive_perception = ?, passive_investigation = ?, passive_insight = ?,
              armor_class = ?, movement_speed_feet = ?, xp = ?
          WHERE id = ?
        `
        )
        .run(
          parsed.name,
          nullable(parsed.playerName),
          nullable(parsed.species),
          nullable(parsed.characterClass),
          parsed.level,
          parsed.passivePerception,
          parsed.passiveInvestigation,
          parsed.passiveInsight,
          parsed.armorClass,
          parsed.movementSpeedFeet,
          xp,
          id
        )
      this.replaceLanguages(id, parsed.languages)
    })
    return this.read()
  }

  setTravelPosition(
    ids: readonly string[],
    mapId: string,
    coordinate: Readonly<{ q: number; r: number }>
  ): void {
    const position = positionPartyAtHex(mapId, coordinate)
    const update = this.db.prepare(
      `UPDATE player_characters
       SET travel_map_id = ?, travel_q = ?, travel_r = ?,
           travel_state = 'hex-positioned'
       WHERE id = ?`
    )
    for (const id of ids) {
      if (update.run(position.mapId, position.q, position.r, id).changes !== 1)
        throw new CapabilityError('not_found', false)
    }
    this.db
      .prepare(
        'UPDATE party_roster_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  hexTravelImpacts(
    mapId: string,
    tileIds: ReadonlySet<string>
  ): Array<{
    memberId: string
    displayName: string
    q: number
    r: number
  }> {
    const targets = [...tileIds].map((id) => {
      const separator = id.indexOf(':')
      return {
        q: Number(id.slice(0, separator)),
        r: Number(id.slice(separator + 1))
      }
    })
    return this.db
      .prepare(
        `WITH targets(q, r) AS (
           SELECT CAST(json_extract(value, '$.q') AS INTEGER),
                  CAST(json_extract(value, '$.r') AS INTEGER)
           FROM json_each(?)
         )
         SELECT character.id AS memberId, character.name AS displayName,
                character.travel_q AS q, character.travel_r AS r
         FROM targets
         JOIN player_characters character
           ON character.travel_map_id = ?
          AND character.travel_q = targets.q
          AND character.travel_r = targets.r
         WHERE character.travel_state = 'hex-positioned'
         ORDER BY character.position, character.id`
      )
      .all(JSON.stringify(targets), mapId) as Array<{
      memberId: string
      displayName: string
      q: number
      r: number
    }>
  }

  clearHexTravelPositions(mapId: string, tileIds: ReadonlySet<string>): void {
    const impacts = this.hexTravelImpacts(mapId, tileIds)
    if (impacts.length === 0) return
    const next = clearPartyHexPosition()
    const clear = this.db.prepare(
      `UPDATE player_characters
       SET travel_map_id = ?, travel_q = ?, travel_r = ?, travel_state = ?
       WHERE id = ?`
    )
    for (const impact of impacts)
      clear.run(next.mapId, next.q, next.r, next.state, impact.memberId)
    this.db
      .prepare(
        'UPDATE party_roster_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  delete(id: string, expectedRevision: number): PartySnapshot {
    this.mutate(expectedRevision, () => {
      if (
        this.db.prepare('DELETE FROM player_characters WHERE id = ?').run(id)
          .changes === 0
      )
        throw new CapabilityError('not_found', false)
    })
    return this.read()
  }

  setMembership(
    id: string,
    active: boolean,
    expectedRevision: number
  ): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const changed = this.db
        .prepare('UPDATE player_characters SET active = ? WHERE id = ?')
        .run(active ? 1 : 0, id).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
    })
    return this.read()
  }

  adjustXp(id: string, delta: number, expectedRevision: number): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const member = this.db
        .prepare(
          `
          SELECT level, xp, xp_since_short_rest AS shortXp,
                 xp_since_long_rest AS longXp
          FROM player_characters WHERE id = ?
        `
        )
        .get(id) as
        | { level: number | null; xp: number; shortXp: number; longXp: number }
        | undefined
      if (!member) throw new CapabilityError('not_found', false)
      const next = applyXpAdjustment(member, delta)
      this.db
        .prepare(
          `
          UPDATE player_characters
          SET xp = ?,
              xp_since_short_rest = ?,
              xp_since_long_rest = ?
          WHERE id = ?
        `
        )
        .run(next.xp, next.shortXp, next.longXp, id)
    })
    return this.read()
  }

  rest(type: 'short' | 'long', expectedRevision: number): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const members = this.db
        .prepare(
          `SELECT id, xp_since_short_rest AS shortXp,
                  xp_since_long_rest AS longXp
           FROM player_characters WHERE active = 1`
        )
        .all() as Array<{ id: string; shortXp: number; longXp: number }>
      const update = this.db.prepare(
        `UPDATE player_characters
         SET xp_since_short_rest = ?, xp_since_long_rest = ?
         WHERE id = ?`
      )
      for (const member of members) {
        const next = applyRest(member, type)
        update.run(next.shortXp, next.longXp, member.id)
      }
    })
    return this.read()
  }

  awardCombatXp(
    combatId: string,
    xpEach: number,
    memberIds?: readonly string[]
  ): PartySnapshot {
    this.db.transaction(() => {
      const inserted = this.db
        .prepare(
          'INSERT OR IGNORE INTO party_xp_awards (combat_id, xp_each) VALUES (?, ?)'
        )
        .run(combatId, xpEach).changes
      if (inserted === 0) return
      const selected = memberIds ? Array.from(new Set(memberIds)) : null
      if (selected && selected.length === 0)
        throw new CapabilityError('validation_failed', false)
      const selection = selected
        ? ` AND id IN (${selected.map(() => '?').join(', ')})`
        : ''
      this.db
        .prepare(
          `
          UPDATE player_characters
          SET xp = xp + ?, xp_since_short_rest = xp_since_short_rest + ?,
              xp_since_long_rest = xp_since_long_rest + ?
          WHERE active = 1${selection}
        `
        )
        .run(xpEach, xpEach, xpEach, ...(selected ?? []))
      this.bumpRevision()
    })()
    return this.read()
  }

  private mutate(expectedRevision: number, mutation: () => void): void {
    this.db.transaction(() => {
      const current = (
        this.db
          .prepare(
            'SELECT revision FROM party_roster_metadata WHERE singleton = 1'
          )
          .get() as { revision: number }
      ).revision
      if (current !== expectedRevision) throw new CapabilityError('stale', true)
      mutation()
      this.bumpRevision()
    })()
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE party_roster_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  private languageMap(): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, string[]>()
    const rows = this.db
      .prepare(
        'SELECT character_id AS characterId, language FROM player_character_language ORDER BY character_id, position'
      )
      .all() as Array<{ characterId: string; language: string }>
    for (const row of rows) {
      const values = result.get(row.characterId) ?? []
      values.push(row.language)
      result.set(row.characterId, values)
    }
    return result
  }

  private replaceLanguages(id: string, languages: readonly string[]): void {
    this.db
      .prepare('DELETE FROM player_character_language WHERE character_id = ?')
      .run(id)
    const insert = this.db.prepare(
      'INSERT INTO player_character_language (character_id, language, position) VALUES (?, ?, ?)'
    )
    languages.forEach((language, position) =>
      insert.run(id, language.trim(), position)
    )
  }
}

function nullable(value: string | null): string | null {
  const normalized = value?.trim() ?? ''
  return normalized === '' ? null : normalized
}

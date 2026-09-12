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
  levelForXp,
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

export function migratePartyBurden34To35(db: Database.Database): void {
  if (
    !db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'player_characters'"
      )
      .get()
  )
    return
  const columns = new Set(
    (db.pragma('table_info(player_characters)') as Array<{ name: string }>).map(
      (column) => column.name
    )
  )
  for (const name of ['short_rest_trusted', 'long_rest_trusted'])
    if (!columns.has(name))
      db.exec(
        `ALTER TABLE player_characters ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK(${name} IN (0, 1))`
      )
}

export function migratePartySections41To42(db: Database.Database): void {
  const columns = new Set(
    (db.pragma('table_info(player_characters)') as Array<{ name: string }>).map(
      (column) => column.name
    )
  )
  if (!columns.size) return
  for (const [name, constraint] of [
    ['rest_sections_closed', 'BETWEEN 0 AND 2'],
    ['rest_section_start_xp', '>= 0'],
    ['rest_sections_trusted', 'IN (0, 1)']
  ]) {
    if (!columns.has(name!))
      db.exec(
        `ALTER TABLE player_characters ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK(${name} ${constraint})`
      )
  }
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
      short_rest_trusted INTEGER NOT NULL DEFAULT 0 CHECK(short_rest_trusted IN (0, 1)),
      long_rest_trusted INTEGER NOT NULL DEFAULT 0 CHECK(long_rest_trusted IN (0, 1)),
      rest_sections_closed INTEGER NOT NULL DEFAULT 0 CHECK(rest_sections_closed BETWEEN 0 AND 2),
      rest_section_start_xp INTEGER NOT NULL DEFAULT 0 CHECK(rest_section_start_xp >= 0),
      rest_sections_trusted INTEGER NOT NULL DEFAULT 0 CHECK(rest_sections_trusted IN (0, 1)),
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
               active, xp, xp_since_short_rest, xp_since_long_rest, short_rest_trusted, long_rest_trusted,
               rest_sections_closed, rest_section_start_xp, rest_sections_trusted,
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
      this.db
        .prepare(
          'UPDATE player_characters SET short_rest_trusted = 1, long_rest_trusted = 1, rest_sections_trusted = 1 WHERE id = ?'
        )
        .run(id)
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

  setXp(id: string, amount: number, expectedRevision: number): PartySnapshot {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000)
      throw new CapabilityError('validation_failed', false)
    const member = this.read().members.find((member) => member.id === id)
    if (!member) throw new CapabilityError('not_found', false)
    return this.adjustXp(id, amount - member.xp, expectedRevision, true)
  }

  adjustXp(
    id: string,
    delta: number,
    expectedRevision: number,
    absolute = false
  ): PartySnapshot {
    if (
      !Number.isSafeInteger(delta) ||
      (!absolute && Math.abs(delta) > 1_000_000)
    )
      throw new CapabilityError('validation_failed', false)
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
      if (!Number.isSafeInteger(next.xp))
        throw new CapabilityError('validation_failed', false)
      this.db
        .prepare(
          `
          UPDATE player_characters
          SET xp = ?, level = ?,
              xp_since_short_rest = ?,
              xp_since_long_rest = ?
          WHERE id = ?
        `
        )
        .run(next.xp, next.level, next.shortXp, next.longXp, id)
    })
    return this.read()
  }

  rest(
    type: 'short' | 'long',
    expectedRevision: number,
    memberIds?: readonly string[]
  ): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const members = this.db
        .prepare(
          `SELECT id, xp_since_short_rest AS shortXp,
                  xp_since_long_rest AS longXp
           FROM player_characters WHERE active = 1`
        )
        .all() as Array<{ id: string; shortXp: number; longXp: number }>
      const selected = memberIds
        ? members.filter((member) => memberIds.includes(member.id))
        : members
      if (
        memberIds &&
        (!memberIds.length ||
          new Set(memberIds).size !== memberIds.length ||
          selected.length !== memberIds.length)
      )
        throw new CapabilityError('validation_failed', false)
      const update = this.db.prepare(
        `UPDATE player_characters
         SET xp_since_short_rest = ?, xp_since_long_rest = ?, short_rest_trusted = 1,
             long_rest_trusted = CASE WHEN ? = 'long' THEN 1 ELSE long_rest_trusted END,
             rest_section_start_xp = CASE WHEN @restType = 'long' THEN 0 WHEN rest_sections_trusted = 1 AND rest_sections_closed < 2 THEN xp_since_long_rest ELSE rest_section_start_xp END,
             rest_sections_closed = CASE WHEN @restType = 'long' THEN 0 WHEN rest_sections_trusted = 1 THEN MIN(2, rest_sections_closed + 1) ELSE rest_sections_closed END,
             rest_sections_trusted = CASE WHEN @restType = 'long' THEN 1 ELSE rest_sections_trusted END
         WHERE id = ?`
      )
      for (const member of selected) {
        const next = applyRest(member, type)
        update.run(
          { restType: type },
          next.shortXp,
          next.longXp,
          type,
          member.id
        )
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
      const recipients = this.read().members.filter(
        (member) => member.active && (!selected || selected.includes(member.id))
      )
      if (
        (selected && recipients.length !== selected.length) ||
        !Number.isSafeInteger(xpEach) ||
        xpEach < 0 ||
        recipients.some(
          (member) =>
            ![member.xp, member.xpSinceShortRest, member.xpSinceLongRest].every(
              (value) => Number.isSafeInteger(value + xpEach)
            )
        )
      )
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
      const updateLevel = this.db.prepare(
        'UPDATE player_characters SET level = ? WHERE id = ?'
      )
      for (const recipient of recipients)
        updateLevel.run(levelForXp(recipient.xp + xpEach), recipient.id)
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

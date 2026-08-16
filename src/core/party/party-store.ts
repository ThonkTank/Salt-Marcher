import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  partyCharacterDraftSchema,
  partySnapshotSchema,
  type AdventuringDaySummary,
  type AdventuringDayCalculation,
  type PartyCharacter,
  type PartyCharacterDraft,
  type PartySnapshot
} from '../../shared/contracts/party.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'

const seededCharacters = ['Alrik', 'Brynn', 'Cora', 'Dain'] as const

export const levelXp = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
] as const

export const dailyXp = [
  300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500,
  15000, 18000, 20000, 25000, 27000, 30000, 40000
] as const

export function initializePartySchema(db: Database.Database): void {
  createPartyTables(db)

  const metadata = db
    .prepare('SELECT 1 FROM party_roster_metadata WHERE singleton = 1')
    .get()
  if (metadata !== undefined) return
  db.transaction(() => {
    db.prepare(
      'INSERT INTO party_roster_metadata (singleton, revision) VALUES (1, 0)'
    ).run()
    const insert = db.prepare(`
      INSERT INTO player_characters (
        id, name, player_name, species, character_class, level,
        passive_perception, passive_investigation, passive_insight, armor_class,
        active, xp, xp_since_short_rest, xp_since_long_rest, position
      ) VALUES (?, ?, NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL, 0, 900, 0, 0, ?)
    `)
    seededCharacters.forEach((name, position) =>
      insert.run(uuidv7(), name, position)
    )
  })()
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
    const members = this.db
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
      .all()
      .map((row) =>
        rowPartyMember(row, this.languages(String((row as { id: string }).id)))
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
      const xp = parsed.level === null ? 0 : levelXp[parsed.level - 1]!
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
      const xp =
        parsed.level === null
          ? current.xp
          : Math.max(current.xp, levelXp[parsed.level - 1]!)
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
    const update = this.db.prepare(
      `UPDATE player_characters
       SET travel_map_id = ?, travel_q = ?, travel_r = ?,
           travel_state = 'hex-positioned'
       WHERE id = ?`
    )
    for (const id of ids) {
      if (update.run(mapId, coordinate.q, coordinate.r, id).changes !== 1)
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
    const clear = this.db.prepare(
      `UPDATE player_characters
       SET travel_map_id = NULL, travel_q = NULL, travel_r = NULL,
           travel_state = 'attached-unpositioned'
       WHERE id = ?`
    )
    for (const impact of impacts) clear.run(impact.memberId)
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
      const floor = member.level === null ? 0 : levelXp[member.level - 1]!
      const nextXp = Math.max(floor, member.xp + delta)
      const applied = nextXp - member.xp
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
        .run(
          nextXp,
          Math.max(0, member.shortXp + applied),
          Math.max(0, member.longXp + applied),
          id
        )
    })
    return this.read()
  }

  rest(type: 'short' | 'long', expectedRevision: number): PartySnapshot {
    this.mutate(expectedRevision, () => {
      if (type === 'short')
        this.db
          .prepare(
            'UPDATE player_characters SET xp_since_short_rest = 0 WHERE active = 1'
          )
          .run()
      else
        this.db
          .prepare(
            `
            UPDATE player_characters
            SET xp_since_short_rest = 0, xp_since_long_rest = 0
            WHERE active = 1
          `
          )
          .run()
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

  private languages(id: string): string[] {
    return (
      this.db
        .prepare(
          'SELECT language FROM player_character_language WHERE character_id = ? ORDER BY position'
        )
        .all(id) as { language: string }[]
    ).map((row) => row.language)
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

function rowPartyMember(
  row: unknown,
  languages: readonly string[]
): PartyCharacter {
  const value = row as Record<string, unknown>
  const level = value['level'] === null ? null : Number(value['level'])
  return {
    id: String(value['id']),
    name: String(value['name']),
    playerName:
      typeof value['player_name'] === 'string' ? value['player_name'] : null,
    species: typeof value['species'] === 'string' ? value['species'] : null,
    characterClass:
      typeof value['character_class'] === 'string'
        ? value['character_class']
        : null,
    languages: [...languages],
    level,
    passivePerception:
      value['passive_perception'] === null
        ? null
        : Number(value['passive_perception']),
    passiveInvestigation:
      value['passive_investigation'] === null
        ? null
        : Number(value['passive_investigation']),
    passiveInsight:
      value['passive_insight'] === null
        ? null
        : Number(value['passive_insight']),
    armorClass:
      value['armor_class'] === null ? null : Number(value['armor_class']),
    movementSpeedFeet:
      value['movement_speed_feet'] === null
        ? null
        : Number(value['movement_speed_feet']),
    travelPosition:
      value['travel_state'] === 'hex-positioned' &&
      typeof value['travel_map_id'] === 'string' &&
      typeof value['travel_q'] === 'number' &&
      typeof value['travel_r'] === 'number'
        ? {
            kind: 'hex',
            mapId: value['travel_map_id'],
            q: value['travel_q'],
            r: value['travel_r']
          }
        : null,
    attachedToPartyToken: value['travel_state'] !== 'detached',
    active: Number(value['active']) === 1,
    xp: Number(value['xp']),
    currentLevelFloor: level === null ? 0 : levelXp[level - 1]!,
    nextLevelXp: level === null || level === 20 ? null : levelXp[level]!,
    xpSinceShortRest: Number(value['xp_since_short_rest']),
    xpSinceLongRest: Number(value['xp_since_long_rest'])
  }
}

export function adventuringDay(
  members: readonly PartyCharacter[]
): AdventuringDaySummary {
  const active = members.filter((member) => member.active)
  const withLevel = active.filter(
    (member): member is PartyCharacter & { level: number } =>
      member.level !== null
  )
  const available = active.length > 0 && withLevel.length === active.length
  return {
    available,
    partySize: active.length,
    dailyBudget: available
      ? withLevel.reduce((sum, member) => sum + dailyXp[member.level - 1]!, 0)
      : 0,
    shortRestXp: active.reduce(
      (sum, member) => sum + member.xpSinceShortRest,
      0
    ),
    longRestXp: active.reduce((sum, member) => sum + member.xpSinceLongRest, 0)
  }
}

export function calculateAdventuringDay(
  rows: readonly { level: number; count: number }[],
  totalXp = 0
): AdventuringDayCalculation {
  const budget = rows.reduce(
    (sum, row) => sum + dailyXp[row.level - 1]! * row.count,
    0
  )
  if (budget === 0)
    return {
      dailyBudget: 0,
      totalXp,
      completedDays: 0,
      dayProgress: 0,
      shortRests: 0,
      longRests: 0,
      timeline: []
    }
  const completedDays = Math.floor(totalXp / budget)
  const remainder = totalXp % budget
  const partialRests = Math.min(2, Math.floor(remainder / (budget / 3)))
  const timeline = Array.from(
    { length: completedDays },
    (_, index) => `Tag ${index + 1}: ${budget.toLocaleString()} XP · Long Rest`
  )
  if (remainder > 0)
    timeline.push(
      `Tag ${completedDays + 1}: ${remainder.toLocaleString()} / ${budget.toLocaleString()} XP`
    )
  return {
    dailyBudget: budget,
    totalXp,
    completedDays,
    dayProgress: remainder / budget,
    shortRests: completedDays * 2 + partialRests,
    longRests: completedDays,
    timeline
  }
}

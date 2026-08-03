import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
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
        id, name, player_name, level, passive_perception, armor_class,
        active, xp, xp_since_short_rest, xp_since_long_rest, position
      ) VALUES (?, ?, NULL, 3, NULL, NULL, 0, 900, 0, 0, ?)
    `)
    seededCharacters.forEach((name, position) =>
      insert.run(uuidv7(), name, position)
    )
  })()
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
      level INTEGER CHECK(level BETWEEN 1 AND 20),
      passive_perception INTEGER CHECK(passive_perception BETWEEN 0 AND 99),
      armor_class INTEGER CHECK(armor_class BETWEEN 0 AND 99),
      active INTEGER NOT NULL CHECK(active IN (0, 1)),
      xp INTEGER NOT NULL CHECK(xp >= 0),
      xp_since_short_rest INTEGER NOT NULL CHECK(xp_since_short_rest >= 0),
      xp_since_long_rest INTEGER NOT NULL CHECK(xp_since_long_rest >= 0),
      movement_speed_feet INTEGER CHECK(movement_speed_feet BETWEEN 0 AND 999),
      travel_map_id TEXT,
      travel_tile_id TEXT,
      attached_to_party_token INTEGER NOT NULL DEFAULT 0 CHECK(attached_to_party_token IN (0, 1)),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS party_xp_awards (
      combat_id TEXT PRIMARY KEY NOT NULL,
      xp_each INTEGER NOT NULL CHECK(xp_each >= 0)
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
        SELECT id, name, player_name, level, passive_perception, armor_class,
               active, xp, xp_since_short_rest, xp_since_long_rest,
               movement_speed_feet, travel_map_id, travel_tile_id,
               attached_to_party_token
        FROM player_characters ORDER BY position, id
      `
      )
      .all()
      .map(rowPartyMember)
    return partySnapshotSchema.parse({
      revision: metadata.revision,
      members,
      adventuringDay: adventuringDay(members)
    })
  }

  create(draft: PartyCharacterDraft, expectedRevision: number): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM player_characters'
          )
          .get() as { value: number }
      ).value
      const xp = draft.level === null ? 0 : levelXp[draft.level - 1]!
      this.db
        .prepare(
          `
          INSERT INTO player_characters (
            id, name, player_name, level, passive_perception, armor_class,
            active, xp, xp_since_short_rest, xp_since_long_rest,
            movement_speed_feet, position
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?, ?)
        `
        )
        .run(
          uuidv7(),
          draft.name.trim(),
          nullable(draft.playerName),
          draft.level,
          draft.passivePerception,
          draft.armorClass,
          xp,
          draft.movementSpeedFeet ?? null,
          position
        )
    })
    return this.read()
  }

  update(
    id: string,
    draft: PartyCharacterDraft,
    expectedRevision: number
  ): PartySnapshot {
    this.mutate(expectedRevision, () => {
      const current = this.db
        .prepare('SELECT xp FROM player_characters WHERE id = ?')
        .get(id) as { xp: number } | undefined
      if (!current) throw new CapabilityError('not_found', false)
      const xp =
        draft.level === null
          ? current.xp
          : Math.max(current.xp, levelXp[draft.level - 1]!)
      this.db
        .prepare(
          `
          UPDATE player_characters
          SET name = ?, player_name = ?, level = ?, passive_perception = ?,
              armor_class = ?, movement_speed_feet = ?, xp = ?
          WHERE id = ?
        `
        )
        .run(
          draft.name.trim(),
          nullable(draft.playerName),
          draft.level,
          draft.passivePerception,
          draft.armorClass,
          draft.movementSpeedFeet ?? null,
          xp,
          id
        )
    })
    return this.read()
  }

  setTravelPosition(ids: readonly string[], mapId: string, tile: string): void {
    const update = this.db.prepare(
      `UPDATE player_characters
       SET travel_map_id = ?, travel_tile_id = ?, attached_to_party_token = 1
       WHERE id = ?`
    )
    for (const id of ids) {
      if (update.run(mapId, tile, id).changes !== 1)
        throw new CapabilityError('not_found', false)
    }
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
}

function nullable(value: string | null): string | null {
  const normalized = value?.trim() ?? ''
  return normalized === '' ? null : normalized
}

function rowPartyMember(row: unknown): PartyCharacter {
  const value = row as Record<string, unknown>
  const level = value['level'] === null ? null : Number(value['level'])
  return {
    id: String(value['id']),
    name: String(value['name']),
    playerName:
      typeof value['player_name'] === 'string' ? value['player_name'] : null,
    level,
    passivePerception:
      value['passive_perception'] === null
        ? null
        : Number(value['passive_perception']),
    armorClass:
      value['armor_class'] === null ? null : Number(value['armor_class']),
    movementSpeedFeet:
      value['movement_speed_feet'] === null
        ? null
        : Number(value['movement_speed_feet']),
    travelPosition:
      typeof value['travel_map_id'] === 'string' &&
      typeof value['travel_tile_id'] === 'string'
        ? {
            kind: 'hex',
            mapId: value['travel_map_id'],
            tileId: value['travel_tile_id']
          }
        : null,
    attachedToPartyToken: Number(value['attached_to_party_token']) === 1,
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

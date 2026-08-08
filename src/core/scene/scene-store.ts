import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  sceneSnapshotSchema,
  type RunningScene,
  type SceneGroup,
  type SceneGroupDisposition,
  type SceneSnapshot
} from '../../shared/contracts/scene.js'
import type { PartyMember } from '../../shared/contracts/live-session.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'
import type { WorldLocation } from '../../shared/contracts/world-location.js'
import {
  combatConditionSchema,
  type CombatCondition
} from '../../shared/contracts/combat-status.js'

export function initializeSceneSchema(
  db: Database.Database,
  activePartyMemberIds: readonly string[]
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_workspace (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0),
      default_scene_id TEXT NOT NULL,
      focused_scene_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scene_running_scene (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      location_id TEXT,
      location_name TEXT NOT NULL DEFAULT '',
      game_time_seconds INTEGER NOT NULL DEFAULT 28800 CHECK(game_time_seconds >= 0),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS scene_party_member (
      scene_id TEXT NOT NULL REFERENCES scene_running_scene(id) ON DELETE CASCADE,
      party_member_id TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY(scene_id, party_member_id)
    );
    CREATE TABLE IF NOT EXISTS scene_group (
      id TEXT PRIMARY KEY NOT NULL,
      scene_id TEXT NOT NULL REFERENCES scene_running_scene(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      disposition TEXT NOT NULL CHECK(disposition IN ('hostile', 'neutral', 'allied')),
      archived INTEGER NOT NULL CHECK(archived IN (0, 1)),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS scene_group_entry (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL REFERENCES scene_group(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(group_id, creature_id)
    );
    CREATE TABLE IF NOT EXISTS scene_group_member (
      id TEXT PRIMARY KEY NOT NULL,
      entry_id TEXT NOT NULL REFERENCES scene_group_entry(id) ON DELETE CASCADE,
      current_hp INTEGER NOT NULL CHECK(current_hp >= 0),
      conditions TEXT NOT NULL DEFAULT '[]',
      concentrating INTEGER NOT NULL DEFAULT 0 CHECK(concentrating IN (0, 1)),
      exhaustion_level INTEGER NOT NULL DEFAULT 0 CHECK(exhaustion_level BETWEEN 0 AND 6),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
  `)
  const exists = db
    .prepare('SELECT 1 FROM scene_workspace WHERE singleton = 1')
    .get()
  if (exists !== undefined) return
  const sceneId = uuidv7()
  db.transaction(() => {
    db.prepare(
      'INSERT INTO scene_workspace (singleton, revision, default_scene_id, focused_scene_id) VALUES (1, 0, ?, ?)'
    ).run(sceneId, sceneId)
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Standardszene', NULL, '', 0)"
    ).run(sceneId)
    const insert = db.prepare(
      'INSERT INTO scene_party_member (scene_id, party_member_id, position) VALUES (?, ?, ?)'
    )
    activePartyMemberIds.forEach((memberId, position) =>
      insert.run(sceneId, memberId, position)
    )
  })()
}

export class SceneStore {
  constructor(
    private readonly db: Database.Database,
    private readonly locationProvider: () => readonly WorldLocation[] = () => [],
    private readonly activePartyMember: (id: string) => boolean = () => false
  ) {}

  revision(): number {
    return this.root().revision
  }

  focusedSceneId(): string {
    return this.root().focusedSceneId
  }

  snapshot(party: readonly PartyMember[]): SceneSnapshot {
    const root = this.root()
    const locations = this.locationProvider()
    const rows = this.db
      .prepare(
        'SELECT id, title, location_id AS locationId, game_time_seconds AS gameTimeSeconds, position FROM scene_running_scene ORDER BY position, id'
      )
      .all() as Array<{
      id: string
      title: string
      locationId: string | null
      gameTimeSeconds: number
      position: number
    }>
    const scenes = rows.map((row) => this.resolveScene(row, root, locations))
    const assigned = new Set(scenes.flatMap((scene) => scene.partyMemberIds))
    return sceneSnapshotSchema.parse({
      revision: root.revision,
      defaultSceneId: root.defaultSceneId,
      focusedSceneId: root.focusedSceneId,
      scenes,
      locationChoices: locations
        .map((location) => ({
          id: location.id,
          displayName: location.displayName
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      unassignedPartyMemberIds: party
        .filter((member) => member.active && !assigned.has(member.id))
        .map((member) => member.id)
    })
  }

  partyMemberIds(sceneId: string): readonly string[] {
    return (
      this.db
        .prepare(
          'SELECT party_member_id AS id FROM scene_party_member WHERE scene_id = ? ORDER BY position, party_member_id'
        )
        .all(sceneId) as Array<{ id: string }>
    ).map((row) => row.id)
  }

  advanceTravel(
    sceneId: string,
    gameSeconds: number,
    locationId: string | null,
    locationName: string
  ): void {
    if (
      this.db
        .prepare(
          `UPDATE scene_running_scene
           SET game_time_seconds = game_time_seconds + ?, location_id = ?, location_name = ?
           WHERE id = ?`
        )
        .run(gameSeconds, locationId, locationName, sceneId).changes !== 1
    )
      throw new CapabilityError('not_found', false)
    this.bump()
  }

  focused(party: readonly PartyMember[]): RunningScene {
    const snapshot = this.snapshot(party)
    const scene = snapshot.scenes.find(
      (candidate) => candidate.id === snapshot.focusedSceneId
    )
    if (!scene) throw new CapabilityError('not_found', false)
    return scene
  }

  focus(sceneId: string, expectedRevision: number): void {
    this.mutate(expectedRevision, () => {
      this.requireScene(sceneId)
      this.db
        .prepare(
          'UPDATE scene_workspace SET focused_scene_id = ? WHERE singleton = 1'
        )
        .run(sceneId)
    })
  }

  setLocation(
    sceneId: string,
    locationId: string | null,
    expectedRevision: number
  ): void {
    this.mutate(expectedRevision, () => {
      this.requireScene(sceneId)
      this.db
        .prepare(
          "UPDATE scene_running_scene SET location_id = ?, location_name = '' WHERE id = ?"
        )
        .run(locationId, sceneId)
    })
  }

  assignedParty(
    party: readonly PartyMember[],
    sceneId = this.focusedSceneId()
  ): PartyMember[] {
    const ids = new Set(
      (
        this.db
          .prepare(
            'SELECT party_member_id AS id FROM scene_party_member WHERE scene_id = ? ORDER BY position'
          )
          .all(sceneId) as { id: string }[]
      ).map((row) => row.id)
    )
    return party.filter((member) => member.active && ids.has(member.id))
  }

  assignPartyMember(
    sceneId: string,
    partyMemberId: string,
    assigned: boolean,
    expectedRevision: number
  ): void {
    this.mutate(expectedRevision, () => {
      this.requireScene(sceneId)
      if (assigned) {
        if (!this.activePartyMember(partyMemberId))
          throw new CapabilityError('not_found', false)
        this.db
          .prepare('DELETE FROM scene_party_member WHERE party_member_id = ?')
          .run(partyMemberId)
        this.db
          .prepare(
            'INSERT INTO scene_party_member (scene_id, party_member_id, position) VALUES (?, ?, COALESCE((SELECT MAX(position) + 1 FROM scene_party_member WHERE scene_id = ?), 0))'
          )
          .run(sceneId, partyMemberId, sceneId)
      } else {
        this.db
          .prepare(
            'DELETE FROM scene_party_member WHERE scene_id = ? AND party_member_id = ?'
          )
          .run(sceneId, partyMemberId)
      }
    })
  }

  unassignPartyMember(partyMemberId: string): void {
    const changed = this.db
      .prepare('DELETE FROM scene_party_member WHERE party_member_id = ?')
      .run(partyMemberId).changes
    if (changed > 0) this.bump()
  }

  saveGroup(
    sceneId: string,
    groupId: string | null,
    name: string,
    note: string,
    disposition: SceneGroupDisposition,
    entries: readonly {
      creatureId: string
      quantity: number
      deadQuantity?: number | undefined
    }[],
    expectedRevision: number,
    expectedGroupRevision: number | null = null
  ): string {
    let savedId = groupId ?? ''
    const save = () => {
      this.requireScene(sceneId)
      const normalized = normalizeEntries(entries)
      for (const creatureId of normalized.keys())
        if (!creatureById(creatureId))
          throw new CapabilityError('not_found', false)
      const id = groupId ?? uuidv7()
      savedId = id
      if (groupId) {
        const group = this.db
          .prepare(
            'SELECT scene_id AS sceneId, revision FROM scene_group WHERE id = ?'
          )
          .get(groupId) as { sceneId: string; revision: number } | undefined
        if (!group || group.sceneId !== sceneId)
          throw new CapabilityError('not_found', false)
        if (group.revision !== expectedGroupRevision)
          throw new CapabilityError('stale', true)
        this.db
          .prepare(
            'UPDATE scene_group SET name = ?, note = ?, disposition = ?, revision = revision + 1 WHERE id = ?'
          )
          .run(name, note, disposition, id)
      } else {
        this.db
          .prepare(
            'INSERT INTO scene_group (id, scene_id, revision, name, note, disposition, archived, position) VALUES (?, ?, 0, ?, ?, ?, 0, COALESCE((SELECT MAX(position) + 1 FROM scene_group WHERE scene_id = ?), 0))'
          )
          .run(id, sceneId, name, note, disposition, sceneId)
      }
      const existing = this.db
        .prepare(
          'SELECT id, creature_id AS creatureId FROM scene_group_entry WHERE group_id = ?'
        )
        .all(id) as Array<{ id: string; creatureId: string }>
      const desired = new Set(normalized.keys())
      for (const row of existing)
        if (!desired.has(row.creatureId))
          this.db
            .prepare('DELETE FROM scene_group_entry WHERE id = ?')
            .run(row.id)
      Array.from(normalized).forEach(([creatureId, counts], position) => {
        const current = existing.find((row) => row.creatureId === creatureId)
        const entryId = current?.id ?? uuidv7()
        if (current)
          this.db
            .prepare('UPDATE scene_group_entry SET position = ? WHERE id = ?')
            .run(position, entryId)
        else
          this.db
            .prepare(
              'INSERT INTO scene_group_entry (id, group_id, creature_id, position) VALUES (?, ?, ?, ?)'
            )
            .run(entryId, id, creatureId, position)
        this.reconcileMembers(entryId, creatureId, counts.alive, counts.dead)
      })
    }
    if (groupId)
      this.transactional(() => {
        save()
        this.bump()
      })
    else this.mutate(expectedRevision, save)
    return savedId
  }

  memberState(memberId: string): {
    currentHp: number
    conditions: CombatCondition[]
    concentrating: boolean
    exhaustionLevel: number
  } | null {
    const row = this.db
      .prepare(
        `SELECT current_hp AS currentHp, conditions, concentrating,
                exhaustion_level AS exhaustionLevel
         FROM scene_group_member WHERE id = ?`
      )
      .get(memberId) as
      | {
          currentHp: number
          conditions: string
          concentrating: number
          exhaustionLevel: number
        }
      | undefined
    return row
      ? {
          currentHp: row.currentHp,
          conditions: zodConditions(row.conditions),
          concentrating: row.concentrating === 1,
          exhaustionLevel: row.exhaustionLevel
        }
      : null
  }

  combatMember(memberId: string): {
    id: string
    groupId: string
    entryId: string
    creatureId: string
    currentHp: number
    conditions: CombatCondition[]
    concentrating: boolean
    exhaustionLevel: number
  } | null {
    const row = this.db
      .prepare(
        `SELECT m.id, e.group_id AS groupId, e.id AS entryId,
          e.creature_id AS creatureId, m.current_hp AS currentHp, m.conditions,
          m.concentrating, m.exhaustion_level AS exhaustionLevel
         FROM scene_group_member m
         JOIN scene_group_entry e ON e.id = m.entry_id
         WHERE m.id = ?`
      )
      .get(memberId) as
      | {
          id: string
          groupId: string
          entryId: string
          creatureId: string
          currentHp: number
          conditions: string
          concentrating: number
          exhaustionLevel: number
        }
      | undefined
    return row
      ? {
          ...row,
          conditions: zodConditions(row.conditions),
          concentrating: row.concentrating === 1,
          exhaustionLevel: row.exhaustionLevel
        }
      : null
  }

  updateMemberStates(
    states: readonly {
      id: string
      currentHp: number
      conditions: readonly string[]
      concentrating: boolean
      exhaustionLevel: number
    }[]
  ): readonly string[] {
    const changedGroups = new Set<string>()
    const current = this.db.prepare(
      `SELECT m.current_hp AS currentHp, m.conditions, m.concentrating,
              m.exhaustion_level AS exhaustionLevel, e.group_id AS groupId
       FROM scene_group_member m
       JOIN scene_group_entry e ON e.id = m.entry_id
       WHERE m.id = ?`
    )
    const update = this.db.prepare(
      `UPDATE scene_group_member
       SET current_hp = ?, conditions = ?, concentrating = ?, exhaustion_level = ?
       WHERE id = ?`
    )
    for (const state of states) {
      const row = current.get(state.id) as
        | {
            currentHp: number
            conditions: string
            concentrating: number
            exhaustionLevel: number
            groupId: string
          }
        | undefined
      if (!row) throw new CapabilityError('not_found', false)
      const conditions = JSON.stringify(state.conditions)
      if (
        row.currentHp === state.currentHp &&
        row.conditions === conditions &&
        row.concentrating === Number(state.concentrating) &&
        row.exhaustionLevel === state.exhaustionLevel
      )
        continue
      update.run(
        state.currentHp,
        conditions,
        Number(state.concentrating),
        state.exhaustionLevel,
        state.id
      )
      changedGroups.add(row.groupId)
    }
    const bumpGroup = this.db.prepare(
      'UPDATE scene_group SET revision = revision + 1 WHERE id = ?'
    )
    for (const groupId of changedGroups) bumpGroup.run(groupId)
    if (changedGroups.size > 0) this.bump()
    return [...changedGroups]
  }

  deleteGroup(
    sceneId: string,
    groupId: string,
    expectedGroupRevision: number
  ): void {
    this.transactional(() => {
      const result = this.db
        .prepare(
          'DELETE FROM scene_group WHERE id = ? AND scene_id = ? AND archived = 1 AND revision = ?'
        )
        .run(groupId, sceneId, expectedGroupRevision)
      if (result.changes === 0) throw new CapabilityError('stale', true)
      this.bump()
    })
  }

  setGroupArchived(
    sceneId: string,
    groupId: string,
    archived: boolean,
    expectedGroupRevision: number
  ): void {
    this.transactional(() => {
      const result = this.db
        .prepare(
          'UPDATE scene_group SET archived = ?, revision = revision + 1 WHERE id = ? AND scene_id = ? AND revision = ?'
        )
        .run(archived ? 1 : 0, groupId, sceneId, expectedGroupRevision)
      if (result.changes === 0) throw new CapabilityError('stale', true)
      this.bump()
    })
  }

  groups(sceneId: string): readonly SceneGroup[] {
    this.requireScene(sceneId)
    const rows = this.db
      .prepare(
        'SELECT id, revision, name, note, disposition, archived, position FROM scene_group WHERE scene_id = ? ORDER BY position, id'
      )
      .all(sceneId) as Array<{
      id: string
      revision: number
      name: string
      note: string
      disposition: SceneGroupDisposition
      archived: number
      position: number
    }>
    return rows.map((row) => {
      const entries = this.groupEntries(row.id)
      return {
        ...row,
        archived: row.archived === 1,
        baseXp: entries.reduce(
          (total, entry) =>
            total +
            (creatureById(entry.creatureId)?.xp ?? 0) * entry.aliveQuantity,
          0
        ),
        entries
      }
    })
  }

  private resolveScene(
    row: {
      id: string
      title: string
      locationId: string | null
      gameTimeSeconds: number
      position: number
    },
    root: SceneRoot,
    locations: readonly WorldLocation[]
  ): RunningScene {
    const partyMemberIds = (
      this.db
        .prepare(
          'SELECT party_member_id AS id FROM scene_party_member WHERE scene_id = ? ORDER BY position, party_member_id'
        )
        .all(row.id) as { id: string }[]
    ).map((member) => member.id)
    const location = locations.find(
      (candidate) => candidate.id === row.locationId
    )
    return {
      id: row.id,
      title: row.title,
      defaultScene: row.id === root.defaultSceneId,
      focused: row.id === root.focusedSceneId,
      locationId: row.locationId,
      locationName: row.locationId
        ? (location?.displayName ?? 'Nicht verfügbarer Ort')
        : '',
      gameTimeSeconds: row.gameTimeSeconds,
      partyMemberIds,
      groups: [...this.groups(row.id)]
    }
  }

  private groupEntries(groupId: string): SceneGroup['entries'] {
    return (
      this.db
        .prepare(
          'SELECT id, creature_id AS creatureId, position FROM scene_group_entry WHERE group_id = ? ORDER BY position, id'
        )
        .all(groupId) as Array<{
        id: string
        creatureId: string
        position: number
      }>
    ).map((entry) => {
      const creature = creatureById(entry.creatureId)
      const members = (
        this.db
          .prepare(
            `SELECT id, current_hp AS currentHp, conditions, concentrating,
                    exhaustion_level AS exhaustionLevel, position
             FROM scene_group_member WHERE entry_id = ? ORDER BY position, id`
          )
          .all(entry.id) as Array<{
          id: string
          currentHp: number
          conditions: string
          concentrating: number
          exhaustionLevel: number
          position: number
        }>
      ).map((member) => ({
        ...member,
        conditions: zodConditions(member.conditions),
        concentrating: member.concentrating === 1,
        exhaustionLevel: member.exhaustionLevel
      }))
      const aliveQuantity = members.filter(
        (member) => member.currentHp > 0
      ).length
      return {
        ...entry,
        quantity: members.length,
        aliveQuantity,
        deadQuantity: members.length - aliveQuantity,
        members,
        displayName: creature?.name ?? 'Nicht verfügbare Kreatur',
        available: creature !== undefined
      }
    })
  }

  private reconcileMembers(
    entryId: string,
    creatureId: string,
    aliveTarget: number,
    deadTarget: number
  ): void {
    const creature = creatureById(creatureId)
    if (!creature) throw new CapabilityError('not_found', false)
    const rows = this.db
      .prepare(
        'SELECT id, current_hp AS currentHp, position FROM scene_group_member WHERE entry_id = ? ORDER BY position, id'
      )
      .all(entryId) as Array<{
      id: string
      currentHp: number
      position: number
    }>
    let alive = rows.filter((row) => row.currentHp > 0)
    let dead = rows.filter((row) => row.currentHp === 0)
    const killCount = Math.min(
      Math.max(0, alive.length - aliveTarget),
      Math.max(0, deadTarget - dead.length)
    )
    for (const member of alive
      .toSorted((a, b) => a.currentHp - b.currentHp || a.position - b.position)
      .slice(0, killCount))
      this.db
        .prepare('UPDATE scene_group_member SET current_hp = 0 WHERE id = ?')
        .run(member.id)
    const reviveCount = Math.min(
      Math.max(0, dead.length - deadTarget),
      Math.max(0, aliveTarget - alive.length)
    )
    for (const member of dead.slice(0, reviveCount))
      this.db
        .prepare(
          `UPDATE scene_group_member
           SET current_hp = ?, conditions = '[]', concentrating = 0, exhaustion_level = 0
           WHERE id = ?`
        )
        .run(creature.hp, member.id)
    const refreshed = this.db
      .prepare(
        'SELECT id, current_hp AS currentHp, position FROM scene_group_member WHERE entry_id = ? ORDER BY position, id'
      )
      .all(entryId) as Array<{
      id: string
      currentHp: number
      position: number
    }>
    alive = refreshed.filter((row) => row.currentHp > 0)
    dead = refreshed.filter((row) => row.currentHp === 0)
    for (const member of alive.slice(aliveTarget))
      this.db
        .prepare('DELETE FROM scene_group_member WHERE id = ?')
        .run(member.id)
    for (const member of dead.slice(deadTarget))
      this.db
        .prepare('DELETE FROM scene_group_member WHERE id = ?')
        .run(member.id)
    const aliveMissing = Math.max(0, aliveTarget - alive.length)
    const deadMissing = Math.max(0, deadTarget - dead.length)
    const nextPosition =
      ((
        this.db
          .prepare(
            'SELECT MAX(position) AS position FROM scene_group_member WHERE entry_id = ?'
          )
          .get(entryId) as { position: number | null }
      ).position ?? -1) + 1
    const insert = this.db.prepare(
      `INSERT INTO scene_group_member
       (id, entry_id, current_hp, conditions, concentrating, exhaustion_level, position)
       VALUES (?, ?, ?, ?, 0, 0, ?)`
    )
    for (let index = 0; index < aliveMissing; index += 1)
      insert.run(uuidv7(), entryId, creature.hp, '[]', nextPosition + index)
    for (let index = 0; index < deadMissing; index += 1)
      insert.run(
        uuidv7(),
        entryId,
        0,
        '[]',
        nextPosition + aliveMissing + index
      )
  }

  private requireScene(id: string): void {
    if (
      this.db
        .prepare('SELECT 1 FROM scene_running_scene WHERE id = ?')
        .get(id) === undefined
    )
      throw new CapabilityError('not_found', false)
  }

  private root(): SceneRoot {
    return this.db
      .prepare(
        'SELECT revision, default_scene_id AS defaultSceneId, focused_scene_id AS focusedSceneId FROM scene_workspace WHERE singleton = 1'
      )
      .get() as SceneRoot
  }

  private mutate(expectedRevision: number, operation: () => void): void {
    const mutation = () => {
      if (this.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      operation()
      this.bump()
    }
    if (this.db.inTransaction) mutation()
    else this.db.transaction(mutation)()
  }

  private transactional(operation: () => void): void {
    if (this.db.inTransaction) operation()
    else this.db.transaction(operation)()
  }

  private bump(): void {
    this.db
      .prepare(
        'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}

function zodConditions(value: string): CombatCondition[] {
  return combatConditionSchema.array().parse(JSON.parse(value))
}

interface SceneRoot {
  revision: number
  defaultSceneId: string
  focusedSceneId: string
}

function normalizeEntries(
  entries: readonly {
    creatureId: string
    quantity: number
    deadQuantity?: number | undefined
  }[]
): Map<string, { alive: number; dead: number }> {
  const normalized = new Map<string, { alive: number; dead: number }>()
  for (const entry of entries) {
    const alive = Math.max(0, entry.quantity)
    const dead = Math.max(0, entry.deadQuantity ?? 0)
    if (alive + dead <= 0) continue
    const previous = normalized.get(entry.creatureId) ?? { alive: 0, dead: 0 }
    normalized.set(entry.creatureId, {
      alive: previous.alive + alive,
      dead: previous.dead + dead
    })
  }
  return normalized
}

import Database from 'better-sqlite3'
import {
  sceneSnapshotSchema,
  type RunningScene,
  type SceneGroup,
  type SceneSnapshot
} from '../../shared/contracts/scene.js'
import type { PartyMember } from '../../shared/contracts/live-session.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'
import type { WorldLocation } from '../../shared/contracts/world-location.js'

export function initializeSceneSchema(db: Database.Database): void {
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
      name TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS scene_group_entry (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL REFERENCES scene_group(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(group_id, creature_id)
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
    const active = db
      .prepare(
        'SELECT id FROM player_characters WHERE active = 1 ORDER BY position, id'
      )
      .all() as { id: string }[]
    const insert = db.prepare(
      'INSERT INTO scene_party_member (scene_id, party_member_id, position) VALUES (?, ?, ?)'
    )
    active.forEach((member, position) =>
      insert.run(sceneId, member.id, position)
    )
  })()
}

export class SceneStore {
  constructor(
    private readonly db: Database.Database,
    private readonly locationProvider: () => readonly WorldLocation[] = () => []
  ) {}

  database(): Database.Database {
    return this.db
  }

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
        'SELECT id, title, location_id AS locationId, position FROM scene_running_scene ORDER BY position, id'
      )
      .all() as Array<{
      id: string
      title: string
      locationId: string | null
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

  focused(party: readonly PartyMember[]): RunningScene {
    const snapshot = this.snapshot(party)
    const scene = snapshot.scenes.find(
      (candidate) => candidate.id === snapshot.focusedSceneId
    )
    if (!scene) throw new Error('not found')
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
        const member = this.db
          .prepare('SELECT active FROM player_characters WHERE id = ?')
          .get(partyMemberId) as { active: number } | undefined
        if (!member || member.active !== 1) throw new Error('not found')
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
    entries: readonly { creatureId: string; quantity: number }[],
    expectedRevision: number
  ): void {
    this.mutate(expectedRevision, () => {
      this.requireScene(sceneId)
      const normalized = normalizeEntries(entries)
      if (normalized.size === 0) throw new Error('validation')
      for (const creatureId of normalized.keys())
        if (!creatureById(creatureId)) throw new Error('not found')
      const id = groupId ?? uuidv7()
      if (groupId) {
        const group = this.db
          .prepare('SELECT scene_id AS sceneId FROM scene_group WHERE id = ?')
          .get(groupId) as { sceneId: string } | undefined
        if (!group || group.sceneId !== sceneId) throw new Error('not found')
        this.db
          .prepare('UPDATE scene_group SET name = ? WHERE id = ?')
          .run(name, id)
        this.db
          .prepare('DELETE FROM scene_group_entry WHERE group_id = ?')
          .run(id)
      } else {
        this.db
          .prepare(
            'INSERT INTO scene_group (id, scene_id, name, position) VALUES (?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM scene_group WHERE scene_id = ?), 0))'
          )
          .run(id, sceneId, name, sceneId)
      }
      const insert = this.db.prepare(
        'INSERT INTO scene_group_entry (id, group_id, creature_id, quantity, position) VALUES (?, ?, ?, ?, ?)'
      )
      Array.from(normalized).forEach(([creatureId, quantity], position) =>
        insert.run(uuidv7(), id, creatureId, quantity, position)
      )
    })
  }

  deleteGroup(
    sceneId: string,
    groupId: string,
    expectedRevision: number
  ): void {
    this.mutate(expectedRevision, () => {
      const result = this.db
        .prepare('DELETE FROM scene_group WHERE id = ? AND scene_id = ?')
        .run(groupId, sceneId)
      if (result.changes === 0) throw new Error('not found')
    })
  }

  groups(sceneId: string): readonly SceneGroup[] {
    this.requireScene(sceneId)
    const rows = this.db
      .prepare(
        'SELECT id, name, position FROM scene_group WHERE scene_id = ? ORDER BY position, id'
      )
      .all(sceneId) as Array<{ id: string; name: string; position: number }>
    return rows.map((row) => ({ ...row, entries: this.groupEntries(row.id) }))
  }

  private resolveScene(
    row: {
      id: string
      title: string
      locationId: string | null
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
      partyMemberIds,
      groups: [...this.groups(row.id)]
    }
  }

  private groupEntries(groupId: string): SceneGroup['entries'] {
    return (
      this.db
        .prepare(
          'SELECT id, creature_id AS creatureId, quantity, position FROM scene_group_entry WHERE group_id = ? ORDER BY position, id'
        )
        .all(groupId) as Array<{
        id: string
        creatureId: string
        quantity: number
        position: number
      }>
    ).map((entry) => {
      const creature = creatureById(entry.creatureId)
      return {
        ...entry,
        displayName: creature?.name ?? 'Nicht verfügbare Kreatur',
        available: creature !== undefined
      }
    })
  }

  private requireScene(id: string): void {
    if (
      this.db
        .prepare('SELECT 1 FROM scene_running_scene WHERE id = ?')
        .get(id) === undefined
    )
      throw new Error('not found')
  }

  private root(): SceneRoot {
    return this.db
      .prepare(
        'SELECT revision, default_scene_id AS defaultSceneId, focused_scene_id AS focusedSceneId FROM scene_workspace WHERE singleton = 1'
      )
      .get() as SceneRoot
  }

  private mutate(expectedRevision: number, operation: () => void): void {
    this.db.transaction(() => {
      if (this.revision() !== expectedRevision) throw new Error('stale')
      operation()
      this.bump()
    })()
  }

  private bump(): void {
    this.db
      .prepare(
        'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}

interface SceneRoot {
  revision: number
  defaultSceneId: string
  focusedSceneId: string
}

function normalizeEntries(
  entries: readonly { creatureId: string; quantity: number }[]
): Map<string, number> {
  const normalized = new Map<string, number>()
  for (const entry of entries) {
    if (entry.quantity <= 0) continue
    normalized.set(
      entry.creatureId,
      (normalized.get(entry.creatureId) ?? 0) + entry.quantity
    )
  }
  return normalized
}

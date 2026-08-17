import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, describe, expect, it } from 'vitest'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { WorldFactionStore } from '../../src/core/worldplanner/faction-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import {
  WORLD_NPC_RECEIPT_RETENTION_LIMIT,
  WorldNpcStore
} from '../../src/core/worldplanner/npc-store.js'
import type { WorldNpcDraft } from '../../src/shared/contracts/world-npc.js'
import { WorldNpcApplicationService } from '../../src/core/application/world-npc-application-service.js'
import { creatureById } from '../../src/core/creatures/catalog.js'
import type Database from 'better-sqlite3'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-npcs-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('NPCs')
  const database = () => campaigns.activeCampaignDatabase()
  const sources = new EncounterSourceService(database)
  const npcs = new WorldNpcApplicationService(
    database,
    creatureResolver,
    (db) => factionStore(db)
  )
  return { campaigns, database, sources, npcs }
}

const creatureResolver = {
  resolve(id: string) {
    const creature = creatureById(id)
    return creature ? { id: creature.id, displayName: creature.name } : null
  }
}

function factionStore(database: Database.Database) {
  const tables = new EncounterTableStore(database)
  return new WorldFactionStore(database, {
    containsTable: (id) => tables.contains(id),
    containsCreature: (tableId, creatureId) =>
      tables.containsCreature(tableId, creatureId)
  })
}

const npcDraft = (changes: Partial<WorldNpcDraft> = {}): WorldNpcDraft => ({
  displayName: 'Erika',
  creatureId: 'sprite',
  lifecycle: 'active',
  appearance: 'Kleine Fee.',
  behavior: 'Neugierig.',
  history: 'Tochter von Rosenschein.',
  notes: 'Aus der Flussuferhöhle gerettet.',
  dispositionModifier: 0,
  factionId: null,
  locationId: null,
  ...changes
})

function createFaction(
  sources: EncounterSourceService,
  name: string,
  revision = sources.readFactions().revision
) {
  return sources.createFaction(
    randomUUID(),
    {
      displayName: name,
      notes: '',
      disposition: 15,
      primaryEncounterTableId: null,
      inventory: []
    },
    revision
  ).saved
}

function locationStore(
  database: ReturnType<typeof harness>['database']
): WorldLocationStore {
  const tables = new EncounterTableStore(database())
  const factions = new WorldFactionStore(database(), {
    containsTable: (id) => tables.contains(id),
    containsCreature: (tableId, creatureId) =>
      tables.containsCreature(tableId, creatureId)
  })
  return new WorldLocationStore(database(), {
    containsFaction: (id) => factions.contains(id),
    containsEncounterTable: (id) => tables.contains(id)
  })
}

describe('world NPC catalog', () => {
  it('persists CRUD, command replay and dual NPC/faction revisions', () => {
    const { campaigns, sources, npcs } = harness()
    const faction = createFaction(sources, 'Rosenhof')
    const commandId = randomUUID()
    const created = npcs.create(
      commandId,
      npcDraft({ factionId: faction.id }),
      0,
      1
    )

    expect(created.revision).toBe(1)
    expect(created.factionRevision).toBe(2)
    expect(Object.keys(created).sort()).toEqual([
      'factionRevision',
      'revision',
      'saved'
    ])
    expect(created.saved).toMatchObject({
      displayName: 'Erika',
      creatureId: 'sprite',
      factionId: faction.id,
      lifecycle: 'active'
    })
    expect(
      npcs.create(commandId, npcDraft({ factionId: faction.id }), 0, 1)
    ).toEqual(created)
    expect(npcs.commandReceipt(commandId)).toEqual(created)

    const updated = npcs.update(
      randomUUID(),
      created.saved.id,
      npcDraft({
        factionId: faction.id,
        lifecycle: 'defeated',
        behavior: 'Vorsichtig.'
      }),
      created.revision,
      0
    )
    expect(updated.saved.lifecycle).toBe('defeated')
    expect(updated.factionRevision).toBe(2)

    const deleteCommandId = randomUUID()
    const deleted = npcs.delete(
      deleteCommandId,
      updated.saved.id,
      updated.revision,
      updated.factionRevision
    )
    expect(npcs.search({ limit: 50 }).rows).toEqual([])
    expect(deleted.factionRevision).toBe(3)
    expect(
      npcs.delete(
        deleteCommandId,
        updated.saved.id,
        updated.revision,
        updated.factionRevision
      )
    ).toEqual(deleted)
    campaigns.close()
  })

  it('rejects stale aggregate revisions and invalid creature/faction/location references', () => {
    const { campaigns, sources, npcs } = harness()
    const faction = createFaction(sources, 'Rosenhof')
    const created = npcs.create(
      randomUUID(),
      npcDraft(),
      0,
      sources.readFactions().revision
    )
    expect(() =>
      npcs.create(
        randomUUID(),
        npcDraft({ displayName: 'Zu spät' }),
        0,
        created.factionRevision
      )
    ).toThrow('stale')
    expect(() =>
      npcs.update(
        randomUUID(),
        created.saved.id,
        npcDraft({ factionId: faction.id }),
        created.revision,
        0
      )
    ).toThrow('stale')
    expect(() =>
      npcs.create(
        randomUUID(),
        npcDraft({ creatureId: 'not-in-the-srd' }),
        created.revision,
        created.factionRevision
      )
    ).toThrow('not_found')
    expect(() =>
      npcs.create(
        randomUUID(),
        npcDraft({ factionId: randomUUID() }),
        created.revision,
        created.factionRevision
      )
    ).toThrow('not_found')
    expect(() =>
      npcs.create(
        randomUUID(),
        npcDraft({ locationId: randomUUID() }),
        created.revision,
        created.factionRevision
      )
    ).toThrow('not_found')
    campaigns.close()
  })

  it('keeps one faction membership and atomically cleans deletion references', () => {
    const { campaigns, database, sources, npcs } = harness()
    const firstFaction = createFaction(sources, 'Rosenhof')
    const secondFaction = createFaction(sources, 'Drachenhort')
    const locations = locationStore(database)
    const location = locations.create(
      {
        displayName: 'Flussuferhöhle',
        tags: ['Höhle'],
        readAloud: '',
        notes: '',
        factionIds: [firstFaction.id],
        encounterTableIds: []
      },
      0
    ).saved
    const created = npcs.create(
      randomUUID(),
      npcDraft({ factionId: firstFaction.id, locationId: location.id }),
      0,
      sources.readFactions().revision
    )
    const moved = npcs.update(
      randomUUID(),
      created.saved.id,
      npcDraft({ factionId: secondFaction.id, locationId: location.id }),
      created.revision,
      created.factionRevision
    )
    const memberships = database()
      .prepare(
        'SELECT faction_id AS factionId FROM worldplanner_faction_npc WHERE npc_id = ?'
      )
      .all(created.saved.id)
    expect(memberships).toEqual([{ factionId: secondFaction.id }])

    sources.deleteFaction(randomUUID(), secondFaction.id, moved.factionRevision)
    const unlinked = npcs.search({ limit: 50 })
    expect(unlinked.rows[0]).toMatchObject({
      factionId: null,
      locationId: location.id
    })

    const npcStore = new WorldNpcStore(database(), creatureResolver)
    database().transaction(() => {
      npcStore.unlinkLocation(location.id)
      locations.delete(location.id, locations.read().revision)
    })()
    expect(npcs.search({ limit: 50 }).rows[0]?.locationId).toBeNull()
    campaigns.close()
  })

  it('pages and filters compact summaries while resolving detail labels', () => {
    const { campaigns, sources, npcs } = harness()
    const faction = createFaction(sources, 'Rosenhof')
    const first = npcs.create(
      randomUUID(),
      npcDraft({ factionId: faction.id }),
      0,
      sources.readFactions().revision
    )
    npcs.create(
      randomUUID(),
      npcDraft({ displayName: 'Bandit', creatureId: 'bandit' }),
      first.revision,
      null
    )

    const page = npcs.search({
      query: 'Flussuferhöhle',
      lifecycle: 'active',
      creatureId: null,
      factionId: faction.id,
      offset: 0,
      limit: 1
    })
    expect(page).toMatchObject({ total: 1, offset: 0, limit: 1 })
    expect(page.rows[0]).toMatchObject({
      displayName: 'Erika',
      creatureDisplayName: 'Sprite',
      factionDisplayName: 'Rosenhof'
    })
    expect(page.rows[0]).not.toHaveProperty('appearance')
    expect(page.rows[0]).not.toHaveProperty('notes')
    expect(npcs.detail(first.saved.id)).toMatchObject({
      npc: { appearance: 'Kleine Fee.' },
      creatureDisplayName: 'Sprite',
      factionDisplayName: 'Rosenhof'
    })
    expect(() => npcs.search({ limit: 101 })).toThrow()
    campaigns.close()
  })

  it('enforces relational references and bounds the idempotency window', () => {
    const { campaigns, database, npcs } = harness()
    const db = database()
    const npcForeignKeys = db.pragma(
      'foreign_key_list(worldplanner_npc)'
    ) as Array<{ table: string; on_delete: string }>
    const membershipForeignKeys = db.pragma(
      'foreign_key_list(worldplanner_faction_npc)'
    ) as Array<{ table: string; on_delete: string }>
    expect(npcForeignKeys).toContainEqual(
      expect.objectContaining({
        table: 'worldplanner_location',
        on_delete: 'SET NULL'
      })
    )
    expect(membershipForeignKeys).toContainEqual(
      expect.objectContaining({
        table: 'worldplanner_faction',
        on_delete: 'CASCADE'
      })
    )

    const insertReceipt = db.prepare(
      `INSERT INTO worldplanner_npc_command_receipt
       (command_id, operation, request_json, result_json)
       VALUES (?, 'create', '{}', '{}')`
    )
    const oldest = randomUUID()
    db.transaction(() => {
      insertReceipt.run(oldest)
      for (
        let index = 1;
        index <= WORLD_NPC_RECEIPT_RETENTION_LIMIT;
        index += 1
      )
        insertReceipt.run(randomUUID())
    })()
    const commandId = randomUUID()
    npcs.create(commandId, npcDraft(), 0, null)
    expect(
      db
        .prepare('SELECT COUNT(*) FROM worldplanner_npc_command_receipt')
        .pluck()
        .get()
    ).toBe(WORLD_NPC_RECEIPT_RETENTION_LIMIT)
    expect(
      db
        .prepare(
          'SELECT 1 FROM worldplanner_npc_command_receipt WHERE command_id = ?'
        )
        .get(oldest)
    ).toBeUndefined()
    expect(npcs.commandReceipt(commandId)).not.toBeNull()
    campaigns.close()
  })

  it('keeps server-side search bounded at the documented 5,000 NPC threshold', () => {
    const { campaigns, database, npcs } = harness()
    const insert = database().prepare(
      `INSERT INTO worldplanner_npc
       (id, display_name, creature_id, lifecycle, appearance, behavior, history,
        notes, disposition_modifier, location_id, position)
       VALUES (?, ?, 'bandit', 'active', '', '', '', '', 0, NULL, ?)`
    )
    database().transaction(() => {
      for (let index = 0; index < 5_000; index += 1)
        insert.run(randomUUID(), `NPC ${String(index).padStart(4, '0')}`, index)
    })()
    const durations = Array.from({ length: 20 }, () => {
      const started = performance.now()
      expect(
        npcs.search({ query: 'NPC 4999', offset: 0, limit: 50 }).total
      ).toBe(1)
      return performance.now() - started
    }).toSorted((left, right) => left - right)
    expect(durations[18]).toBeLessThan(250)
    campaigns.close()
  })

  it('round-trips ordered profile fields and rejects canonically duplicate languages', () => {
    const { campaigns, database } = harness()
    const party = new PartyStore(database())
    let snapshot = party.read()
    for (const member of [...snapshot.members])
      snapshot = party.delete(member.id, snapshot.revision)
    snapshot = party.create(
      {
        name: 'Grikania',
        playerName: 'Jan',
        species: 'Githjanki',
        characterClass: 'Rogue',
        languages: ['Common', 'Gith'],
        level: 2,
        passivePerception: 16,
        passiveInvestigation: 16,
        passiveInsight: 12,
        armorClass: null,
        movementSpeedFeet: null
      },
      snapshot.revision
    )
    expect(snapshot.members[0]).toMatchObject({
      species: 'Githjanki',
      characterClass: 'Rogue',
      languages: ['Common', 'Gith'],
      passiveInvestigation: 16,
      passiveInsight: 12,
      active: false
    })
    expect(() =>
      party.create(
        {
          name: 'Doppelt',
          playerName: null,
          species: null,
          characterClass: null,
          languages: ['Common', ' common '],
          level: null,
          passivePerception: null,
          passiveInvestigation: null,
          passiveInsight: null,
          armorClass: null,
          movementSpeedFeet: null
        },
        snapshot.revision
      )
    ).toThrow('Languages must be unique')
    campaigns.close()
  })
})

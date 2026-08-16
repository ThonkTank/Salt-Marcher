import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { WorldFactionStore } from '../../src/core/worldplanner/faction-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { WorldNpcStore } from '../../src/core/worldplanner/npc-store.js'
import type { WorldNpcDraft } from '../../src/shared/contracts/world-npc.js'

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
  return { campaigns, database, sources }
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
    const { campaigns, sources } = harness()
    const faction = createFaction(sources, 'Rosenhof')
    const commandId = randomUUID()
    const created = sources.createNpc(
      commandId,
      npcDraft({ factionId: faction.id }),
      0,
      1
    )

    expect(created.snapshot.revision).toBe(1)
    expect(created.factionSnapshot.revision).toBe(2)
    expect(created.saved).toMatchObject({
      displayName: 'Erika',
      creatureId: 'sprite',
      factionId: faction.id,
      lifecycle: 'active'
    })
    expect(
      sources.createNpc(commandId, npcDraft({ factionId: faction.id }), 0, 1)
    ).toEqual(created)
    expect(sources.npcReceipt(commandId)).toEqual(created)

    const updated = sources.updateNpc(
      randomUUID(),
      created.saved.id,
      npcDraft({
        factionId: faction.id,
        lifecycle: 'defeated',
        behavior: 'Vorsichtig.'
      }),
      created.snapshot.revision,
      created.factionSnapshot.revision
    )
    expect(updated.saved.lifecycle).toBe('defeated')
    expect(updated.factionSnapshot.revision).toBe(2)

    const deleteCommandId = randomUUID()
    const deleted = sources.deleteNpc(
      deleteCommandId,
      updated.saved.id,
      updated.snapshot.revision,
      updated.factionSnapshot.revision
    )
    expect(deleted.snapshot.npcs).toEqual([])
    expect(deleted.factionSnapshot.revision).toBe(3)
    expect(
      sources.deleteNpc(
        deleteCommandId,
        updated.saved.id,
        updated.snapshot.revision,
        updated.factionSnapshot.revision
      )
    ).toEqual(deleted)
    campaigns.close()
  })

  it('rejects stale aggregate revisions and invalid creature/faction/location references', () => {
    const { campaigns, sources } = harness()
    const faction = createFaction(sources, 'Rosenhof')
    const created = sources.createNpc(
      randomUUID(),
      npcDraft(),
      0,
      sources.readFactions().revision
    )
    expect(() =>
      sources.createNpc(
        randomUUID(),
        npcDraft({ displayName: 'Zu spät' }),
        0,
        created.factionSnapshot.revision
      )
    ).toThrow('stale')
    expect(() =>
      sources.updateNpc(
        randomUUID(),
        created.saved.id,
        npcDraft({ factionId: faction.id }),
        created.snapshot.revision,
        0
      )
    ).toThrow('stale')
    expect(() =>
      sources.createNpc(
        randomUUID(),
        npcDraft({ creatureId: 'not-in-the-srd' }),
        created.snapshot.revision,
        created.factionSnapshot.revision
      )
    ).toThrow('not_found')
    expect(() =>
      sources.createNpc(
        randomUUID(),
        npcDraft({ factionId: randomUUID() }),
        created.snapshot.revision,
        created.factionSnapshot.revision
      )
    ).toThrow('not_found')
    expect(() =>
      sources.createNpc(
        randomUUID(),
        npcDraft({ locationId: randomUUID() }),
        created.snapshot.revision,
        created.factionSnapshot.revision
      )
    ).toThrow('not_found')
    campaigns.close()
  })

  it('keeps one faction membership and atomically cleans deletion references', () => {
    const { campaigns, database, sources } = harness()
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
    const created = sources.createNpc(
      randomUUID(),
      npcDraft({ factionId: firstFaction.id, locationId: location.id }),
      0,
      sources.readFactions().revision
    )
    const moved = sources.updateNpc(
      randomUUID(),
      created.saved.id,
      npcDraft({ factionId: secondFaction.id, locationId: location.id }),
      created.snapshot.revision,
      created.factionSnapshot.revision
    )
    const memberships = database()
      .prepare(
        'SELECT faction_id AS factionId FROM worldplanner_faction_npc WHERE npc_id = ?'
      )
      .all(created.saved.id)
    expect(memberships).toEqual([{ factionId: secondFaction.id }])

    sources.deleteFaction(
      randomUUID(),
      secondFaction.id,
      moved.factionSnapshot.revision
    )
    const unlinked = sources.readNpcs()
    expect(unlinked.npcs[0]).toMatchObject({
      factionId: null,
      locationId: location.id
    })

    const npcStore = new WorldNpcStore(database())
    database().transaction(() => {
      npcStore.unlinkLocation(location.id)
      locations.delete(location.id, locations.read().revision)
    })()
    expect(sources.readNpcs().npcs[0]?.locationId).toBeNull()
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

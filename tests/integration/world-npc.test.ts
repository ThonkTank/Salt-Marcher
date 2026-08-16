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
  return { campaigns, database, sources: new EncounterSourceService(database) }
}

describe('world NPC catalog', () => {
  it('persists statblock, prose and semantic faction/location links', () => {
    const { campaigns, database, sources } = harness()
    const faction = sources.createFaction(
      randomUUID(),
      {
        displayName: 'Rosenhof',
        notes: '',
        disposition: 15,
        primaryEncounterTableId: null,
        inventory: []
      },
      0
    ).saved
    const tableStore = new EncounterTableStore(database())
    const factionStore = new WorldFactionStore(database(), {
      containsTable: (id) => tableStore.contains(id),
      containsCreature: (tableId, creatureId) =>
        tableStore.containsCreature(tableId, creatureId)
    })
    const locations = new WorldLocationStore(database(), {
      containsFaction: (id) => factionStore.contains(id),
      containsEncounterTable: (id) => tableStore.contains(id)
    })
    const location = locations.create(
      {
        displayName: 'Rosenhof',
        tags: ['Feenland'],
        readAloud: '',
        notes: '',
        factionIds: [faction.id],
        encounterTableIds: []
      },
      0
    ).saved
    const commandId = randomUUID()
    const receipt = sources.createNpc(
      commandId,
      {
        displayName: 'Erika',
        creatureId: 'sprite',
        lifecycle: 'active',
        appearance: 'Kleine Fee.',
        behavior: '',
        history: 'Tochter von Rosenschein.',
        notes: 'Aus der Flussuferhöhle gerettet.',
        dispositionModifier: 0,
        factionId: faction.id,
        locationId: location.id
      },
      0
    )

    expect(sources.npcReceipt(commandId)).toEqual(receipt)
    expect(receipt.saved).toMatchObject({
      displayName: 'Erika',
      creatureId: 'sprite',
      factionId: faction.id,
      locationId: location.id,
      lifecycle: 'active'
    })
    expect(() =>
      sources.createNpc(
        randomUUID(),
        {
          displayName: 'Unbekannt',
          creatureId: 'not-in-the-srd',
          lifecycle: 'active',
          appearance: '',
          behavior: '',
          history: '',
          notes: '',
          dispositionModifier: 0,
          factionId: null,
          locationId: null
        },
        receipt.snapshot.revision
      )
    ).toThrow('not_found')

    sources.deleteFaction(
      randomUUID(),
      faction.id,
      sources.readFactions().revision
    )
    expect(sources.readNpcs().npcs[0]?.factionId).toBeNull()
    campaigns.close()
  })

  it('round-trips structured character identity, languages and passive scores', () => {
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
    campaigns.close()
  })
})

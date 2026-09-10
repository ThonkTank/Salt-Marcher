import {
  historicalDatabaseAccess,
  withHistoricalActiveCampaign
} from './database-scope.js'
import { databaseSchemaVersions } from '@historical/schema-owner'
import {
  generatedLootFixtureSchema,
  seedGeneratedLoot,
  readGeneratedLoot
} from './generated-loot-profile.js'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { CampaignStore } from '@historical/legacy-campaign-store'
import { PartyStore } from '@historical/party-store'
import { LootService } from '@historical/loot-service'
import { preflightPersistence } from '@historical/preflight'
import {
  migrateHistoricalProfileData,
  type HistoricalMigrationObserver
} from './migrate-profile.js'

const fixtureSchema = z
  .object({
    campaignId: z.uuid(),
    characterId: z.uuid(),
    treasureId: z.uuid(),
    itemId: z.uuid(),
    generated: generatedLootFixtureSchema
  })
  .strict()
const treasureIdentity = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  items: z.array(z.object({ id: z.uuid() })).min(1)
})
function open(profile: string) {
  const data = join(profile, 'campaign-data')
  if (preflightPersistence(data).kind !== 'ready')
    throw new Error('Loot profile requires explicit migration')
  return new CampaignStore(data)
}

export function seedHistoricalProfile(profile: string) {
  if (databaseSchemaVersions.campaign !== 30)
    throw new Error(
      'Legacy Loot creation requires the original schema-30 runtime'
    )
  if (existsSync(profile))
    throw new Error('Refusing to replace an existing Loot profile')
  mkdirSync(profile, { recursive: true })
  const campaigns = new CampaignStore(join(profile, 'campaign-data'))
  try {
    const campaignId = campaigns.create('Historische Beute').activeCampaignId
    if (!campaignId) throw new Error('No active Loot campaign')
    withHistoricalActiveCampaign(campaigns, (database) => {
      const party = new PartyStore(database)
      const created = party.create(
        {
          name: 'Mara',
          playerName: 'Abnahme',
          species: 'Mensch',
          characterClass: 'Waldläufer',
          languages: ['Gemeinsprache'],
          level: 3,
          passivePerception: 14,
          passiveInvestigation: 12,
          passiveInsight: 13,
          armorClass: 16,
          movementSpeedFeet: 30
        },
        party.read().revision
      )
      const character = created.members.find(({ name }) => name === 'Mara')
      if (!character) throw new Error('Missing fixture character')
      party.setMembership(character.id, true, created.revision)
      const loot = new LootService(historicalDatabaseAccess(database))
      const treasure = treasureIdentity.parse(
        loot.create({
          commandId: randomUUID(),
          label: 'Karten der Salzfurt',
          anchor: { kind: 'unplaced' },
          items: [
            {
              name: 'Handkarte',
              quantity: 3,
              unitValueCp: 250,
              stackable: true
            }
          ]
        })
      )
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.read().revision,
        items: [
          {
            itemId: treasure.items[0]!.id,
            shares: [{ characterId: character.id, quantity: 1 }]
          }
        ]
      })
      const generated = seedGeneratedLoot(database, character.id)
      campaigns.updateSettings(
        { theme: 'dark' },
        campaigns.readSettings().revision
      )
      writeFileSync(
        join(profile, 'loot-fixture.json'),
        JSON.stringify(
          fixtureSchema.parse({
            campaignId,
            characterId: character.id,
            treasureId: treasure.id,
            itemId: treasure.items[0]!.id,
            generated
          })
        ),
        { flag: 'wx' }
      )
    })
  } finally {
    campaigns.close()
  }
  return readHistoricalProfile(profile)
}

export function readHistoricalProfile(profile: string) {
  const fixture = fixtureSchema.parse(
    JSON.parse(readFileSync(join(profile, 'loot-fixture.json'), 'utf8'))
  )
  const campaigns = open(profile)
  try {
    return withHistoricalActiveCampaign(campaigns, (database) => {
      const loot = new LootService(historicalDatabaseAccess(database))
      return {
        coverage: 'historical-loot-generated-partial-v2',
        fixture,
        settings: campaigns.readSettings(),
        registry: campaigns.list(),
        party: new PartyStore(database).read(),
        treasure: loot.read(fixture.treasureId),
        ledger: loot.ledger(fixture.characterId),
        generated: readGeneratedLoot(database, fixture.generated)
      }
    })
  } finally {
    campaigns.close()
  }
}

export function migrateHistoricalProfile(
  profile: string,
  afterMigration?: HistoricalMigrationObserver
) {
  return migrateHistoricalProfileData(
    profile,
    readHistoricalProfile,
    afterMigration
  )
}

export function advanceHistoricalProfile(profile: string) {
  const fixture = fixtureSchema.parse(
    JSON.parse(readFileSync(join(profile, 'loot-fixture.json'), 'utf8'))
  )
  const campaigns = open(profile)
  try {
    withHistoricalActiveCampaign(campaigns, (database) => {
      const loot = new LootService(historicalDatabaseAccess(database))
      const treasure = treasureIdentity.parse(loot.read(fixture.treasureId))
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: new PartyStore(database).read().revision,
        items: [
          {
            itemId: fixture.itemId,
            shares: [{ characterId: fixture.characterId, quantity: 1 }]
          }
        ]
      })
    })
  } finally {
    campaigns.close()
  }
  return readHistoricalProfile(profile)
}

export function finishCombatAndTravelHistoricalProfile(): never {
  throw new Error('Loot cohort does not implement the combat/travel fixture')
}

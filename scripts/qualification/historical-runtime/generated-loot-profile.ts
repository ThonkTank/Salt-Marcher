import { historicalDatabaseAccess } from './database-scope.js'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { SessionGenerationService } from '@historical/legacy-generation'
import { BundledEncounterCatalogProvider } from '@historical/legacy-catalog'
import { sha256EncounterEntropy } from '@historical/legacy-entropy'
import { GeneratedRunStore } from '@historical/legacy-generated-runs'
import { LootService } from '@historical/loot-service'
import { PartyStore } from '@historical/party-store'

export const generatedLootFixtureSchema = z
  .object({
    runId: z.uuid(),
    sourceTreasureId: z.string().min(1),
    treasureId: z.uuid(),
    itemId: z.uuid()
  })
  .strict()

export function seedGeneratedLoot(
  database: Database.Database,
  characterId: string
) {
  const generator = new SessionGenerationService(
    new BundledEncounterCatalogProvider(
      join(process.resourcesPath, 'sessiongeneration/catalog-2026-07-16')
    ),
    sha256EncounterEntropy,
    undefined,
    historicalDatabaseAccess(database),
    () => new Date('2026-08-09T10:00:00.000Z')
  )
  const generated = z
    .object({
      status: z.literal('success'),
      run: z.object({
        id: z.uuid(),
        treasures: z.array(
          z.object({ id: z.string(), items: z.array(z.unknown()) })
        )
      })
    })
    .parse(
      generator.generate({
        party: [{ level: 3, count: 2 }],
        adventureDayFraction: '0.6',
        encounterCount: 2,
        seed: 1000
      })
    )
  const source = generated.run.treasures.find(
    (treasure) => treasure.items.length > 0
  )
  if (!source)
    throw new Error('Original generator produced no item-bearing treasure')
  const loot = new LootService(historicalDatabaseAccess(database))
  const treasure = z
    .object({
      id: z.uuid(),
      revision: z.number().int(),
      items: z.array(z.object({ id: z.uuid() })).min(1)
    })
    .parse(
      loot.acceptGenerated({
        commandId: randomUUID(),
        runId: generated.run.id,
        generatedTreasureId: source.id,
        label: 'Generierte Beute der Salzfurt',
        anchor: { kind: 'unplaced' }
      })
    )
  const item = treasure.items[0]!
  loot.distribute({
    commandId: randomUUID(),
    treasureId: treasure.id,
    expectedTreasureRevision: treasure.revision,
    expectedPartyRevision: new PartyStore(database).read().revision,
    items: [{ itemId: item.id, shares: [{ characterId, quantity: 1 }] }]
  })
  return generatedLootFixtureSchema.parse({
    runId: generated.run.id,
    sourceTreasureId: source.id,
    treasureId: treasure.id,
    itemId: item.id
  })
}

export function readGeneratedLoot(
  database: Database.Database,
  fixture: z.infer<typeof generatedLootFixtureSchema>
) {
  const run = new GeneratedRunStore(database).read(fixture.runId)
  if (!run) throw new Error('Missing original generated run')
  return {
    run,
    treasure: new LootService(historicalDatabaseAccess(database)).read(
      fixture.treasureId
    )
  }
}

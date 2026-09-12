import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import {
  copyHistoricalWorkingProfile,
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    target: { type: 'string' },
    'source-home': { type: 'string' },
    'target-home': { type: 'string' }
  }
})
const source = z.string().min(1).parse(values.source)
const target = z.string().min(1).parse(values.target)
const sourceHome = resolve(z.string().min(1).parse(values['source-home']))
const targetHome = resolve(z.string().min(1).parse(values['target-home']))
assert.deepStrictEqual(
  readHistoricalArtifact(source).receipt.source.schemaVersions,
  { installation: 30, campaign: 30 }
)
assert.deepStrictEqual(
  readHistoricalArtifact(target).receipt.source.schemaVersions,
  { installation: 31, campaign: 31 }
)
const before = await runHistoricalArtifact(source, sourceHome, 'read')
assert(before.result.response.ok)
const profile = z
  .object({
    coverage: z.literal('historical-loot-manual-partial-v1'),
    treasure: z
      .object({
        items: z
          .array(
            z
              .object({
                id: z.uuid(),
                name: z.literal('Handkarte'),
                quantity: z.literal(3),
                allocatedQuantity: z.literal(1),
                unitValueCp: z.literal(250),
                stackable: z.literal(true),
                magic: z.literal(false),
                rarity: z.null(),
                curseName: z.null()
              })
              .passthrough()
          )
          .length(1)
      })
      .passthrough(),
    ledger: z
      .object({
        entries: z
          .array(
            z
              .object({
                itemName: z.literal('Handkarte'),
                unitValueCp: z.literal(250),
                quantity: z.literal(1)
              })
              .passthrough()
          )
          .length(1)
      })
      .passthrough()
  })
  .passthrough()
  .parse(before.result.response.result)
const item = profile.treasure.items[0]!
const itemReference = { kind: 'legacy', definitionId: `treasure:${item.id}` }
const definition = {
  reference: itemReference,
  name: item.name,
  unitValueCp: item.unitValueCp,
  unitCapacity: 1,
  stackable: item.stackable,
  magic: item.magic,
  rarity: null,
  curse: null,
  components: {
    baseItemId: null,
    modifierId: null,
    componentId: null,
    magicItemId: null,
    magicVariantId: null,
    spellId: null,
    enspelledRuleId: null,
    curseId: null,
    coinDenominations: []
  }
}
const expected = {
  ...profile,
  treasure: {
    ...profile.treasure,
    items: profile.treasure.items.map((original) => {
      const retained: Record<string, unknown> = { ...original }
      for (const key of [
        'name',
        'unitValueCp',
        'stackable',
        'magic',
        'rarity',
        'curseName'
      ])
        delete retained[key]
      return { ...retained, itemReference, definition }
    })
  },
  ledger: {
    ...profile.ledger,
    entries: profile.ledger.entries.map((original) => {
      const retained: Record<string, unknown> = { ...original }
      delete retained['itemName']
      delete retained['unitValueCp']
      return { ...retained, itemReference, definition }
    })
  }
}
copyHistoricalWorkingProfile(sourceHome, targetHome)
const incompatible = await runHistoricalArtifact(target, targetHome, 'read')
assert(!incompatible.result.response.ok)
const migration = await runHistoricalArtifact(target, targetHome, 'migrate')
assert(migration.result.response.ok, JSON.stringify(migration.result.response))
const migrated = z
  .object({
    profile: z.unknown(),
    transitions: z.array(
      z.object({
        fromVersion: z.literal(30),
        toVersion: z.literal(31),
        migrations: z.array(z.string()).min(1)
      })
    )
  })
  .parse(migration.result.response.result)
assert.equal(migrated.transitions.length, 2)
assert.deepStrictEqual(migrated.profile, expected)
const reopened = await runHistoricalArtifact(target, targetHome, 'read')
assert(reopened.result.response.ok)
assert.deepStrictEqual(reopened.result.response.result, expected)
const advanced = await runHistoricalArtifact(target, targetHome, 'advance')
assert(advanced.result.response.ok, JSON.stringify(advanced.result.response))
const continued = z
  .object({
    treasure: z.object({
      allocatedValueCp: z.literal(500),
      items: z
        .array(
          z.object({
            allocatedQuantity: z.literal(2),
            itemReference: z.unknown(),
            definition: z.unknown()
          })
        )
        .length(1)
    }),
    ledger: z.object({
      entries: z
        .array(
          z.object({
            itemReference: z.unknown(),
            definition: z.unknown(),
            quantity: z.literal(1)
          })
        )
        .length(2)
    })
  })
  .parse(advanced.result.response.result)
for (const entry of [
  ...continued.treasure.items,
  ...continued.ledger.entries
]) {
  assert.deepStrictEqual(entry.itemReference, itemReference)
  assert.deepStrictEqual(entry.definition, definition)
}
const persisted = await runHistoricalArtifact(target, targetHome, 'read')
assert(persisted.result.response.ok)
assert.deepStrictEqual(
  persisted.result.response.result,
  advanced.result.response.result
)
const sourceAfter = await runHistoricalArtifact(source, sourceHome, 'read')
assert(sourceAfter.result.response.ok)
assert.deepStrictEqual(
  sourceAfter.result.response.result,
  before.result.response.result
)
const evidence = {
  coverage: 'historical-manual-loot-partial-not-generated-or-activation',
  before,
  incompatible,
  migration,
  reopened,
  advanced,
  persisted,
  sourceAfter
}
writeFileSync(
  join(targetHome, 'historical-loot-evidence.json'),
  JSON.stringify(evidence, null, 2),
  { flag: 'wx' }
)
console.info(
  JSON.stringify({
    event: 'historical-manual-loot-passed',
    evidence: join(targetHome, 'historical-loot-evidence.json')
  })
)

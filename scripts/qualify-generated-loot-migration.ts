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
import { expectedCurrentHistoricalLoot } from './qualification/historical-current-loot-expectations.js'

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
  { installation: 42, campaign: 42 }
)
const before = await runHistoricalArtifact(source, sourceHome, 'read')
assert(before.result.response.ok)
const expected = expectedCurrentHistoricalLoot(before.result.response.result)
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
        role: z.enum(['campaign', 'installation']),
        fromVersion: z.literal(30),
        toVersion: z.number().int(),
        migrations: z.array(z.string()).min(1)
      })
    )
  })
  .parse(migration.result.response.result)
assert.deepStrictEqual(migrated.profile, expected)
assert.equal(migrated.transitions.length, 2)
assert.deepStrictEqual(
  migrated.transitions
    .map(({ role, toVersion }) => ({ role, toVersion }))
    .sort((a, b) => a.role.localeCompare(b.role)),
  [
    { role: 'campaign', toVersion: 42 },
    { role: 'installation', toVersion: 42 }
  ]
)
const reopened = await runHistoricalArtifact(target, targetHome, 'read')
assert(reopened.result.response.ok)
assert.deepStrictEqual(reopened.result.response.result, expected)
const advanced = await runHistoricalArtifact(target, targetHome, 'advance')
assert(advanced.result.response.ok, JSON.stringify(advanced.result.response))
const record = z.record(z.string(), z.unknown())
const view = z
  .object({
    treasure: z
      .object({
        id: z.uuid(),
        revision: z.number().int(),
        updatedAt: z.iso.datetime(),
        allocatedValueCp: z.number().int(),
        items: z
          .array(
            z.object({ allocatedQuantity: z.number().int() }).passthrough()
          )
          .length(1)
      })
      .passthrough(),
    ledger: z
      .object({ revision: z.number().int(), entries: z.array(record) })
      .passthrough()
  })
  .passthrough()
const {
  treasure: oldTreasure,
  ledger: oldLedger,
  ...oldRest
} = view.parse(expected)
const {
  treasure: newTreasure,
  ledger: newLedger,
  ...newRest
} = view.parse(advanced.result.response.result)
assert.deepStrictEqual(newRest, oldRest)
function omit(value: Record<string, unknown>, keys: string[]) {
  const result = { ...value }
  for (const key of keys) delete result[key]
  return result
}
assert.deepStrictEqual(
  omit(newTreasure, ['revision', 'updatedAt', 'allocatedValueCp', 'items']),
  omit(oldTreasure, ['revision', 'updatedAt', 'allocatedValueCp', 'items'])
)
assert.equal(newTreasure.revision, oldTreasure.revision + 1)
assert(Date.parse(newTreasure.updatedAt) >= Date.parse(oldTreasure.updatedAt))
assert.equal(newTreasure.allocatedValueCp, oldTreasure.allocatedValueCp + 250)
assert.deepStrictEqual(newTreasure.items[0], {
  ...oldTreasure.items[0],
  allocatedQuantity: oldTreasure.items[0]!.allocatedQuantity + 1
})
assert.deepStrictEqual(
  omit(newLedger, ['revision', 'entries']),
  omit(oldLedger, ['revision', 'entries'])
)
assert.equal(newLedger.revision, oldLedger.revision + 1)
assert.equal(newLedger.entries.length, oldLedger.entries.length + 1)
for (const entry of oldLedger.entries)
  assert.deepStrictEqual(
    newLedger.entries.find((candidate) => candidate['id'] === entry['id']),
    entry
  )
const added = newLedger.entries.filter(
  (entry) => !oldLedger.entries.some((old) => old['id'] === entry['id'])
)
assert.equal(added.length, 1)
z.uuid().parse(added[0]!['id'])
z.iso.datetime().parse(added[0]!['receivedAt'])
const originalAward = oldLedger.entries.find(
  (entry) => entry['treasureId'] === oldTreasure.id
)
assert(originalAward)
assert.deepStrictEqual(
  omit(added[0]!, ['id', 'receivedAt']),
  omit(originalAward, ['id', 'receivedAt'])
)
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
const path = join(targetHome, 'generated-loot-migration-evidence.json')
writeFileSync(
  path,
  JSON.stringify(
    {
      formatVersion: 1,
      coverage: 'historical-generated-loot-not-production-activation',
      before,
      incompatible,
      migration,
      reopened,
      advanced,
      persisted,
      sourceAfter
    },
    null,
    2
  ),
  { flag: 'wx' }
)
console.info(
  JSON.stringify({ event: 'generated-loot-migration-passed', evidence: path })
)

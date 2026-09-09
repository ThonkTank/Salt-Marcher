import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import {
  copyHistoricalWorkingProfile,
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'
import { expectedHistoricalMigrationProfile } from './qualification/historical-profile-expectations.js'

assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    target: { type: 'string' },
    'source-home': { type: 'string' },
    'target-home': { type: 'string' }
  }
})
const sourceDirectory = resolve(z.string().min(1).parse(values.source))
const targetDirectory = resolve(z.string().min(1).parse(values.target))
const sourceHome = resolve(z.string().min(1).parse(values['source-home']))
const targetHome = resolve(z.string().min(1).parse(values['target-home']))
const sourceArtifact = readHistoricalArtifact(sourceDirectory)
const targetArtifact = readHistoricalArtifact(targetDirectory)
assert.notDeepEqual(
  sourceArtifact.receipt.source.schemaVersions,
  targetArtifact.receipt.source.schemaVersions
)
const seeded = await runHistoricalArtifact(sourceDirectory, sourceHome, 'seed')
assert(seeded.result.response.ok)
const before = seeded.result.response.result
copyHistoricalWorkingProfile(sourceHome, targetHome)
const interrupted = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'migrate-kill'
)
assert(!interrupted.result.response.ok)
assert(interrupted.interruption)
assert.equal(interrupted.interruption.boundary.inTransaction, true)
// This case interrupts the first required migration. The old runtime must still
// read the whole profile; a schema number alone is insufficient evidence.
const recovered = await runHistoricalArtifact(
  sourceDirectory,
  targetHome,
  'read'
)
assert(recovered.result.response.ok)
assert.deepEqual(recovered.result.response.result, before)
const resumed = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'migrate'
)
assert(resumed.result.response.ok)
const expected = expectedHistoricalMigrationProfile(
  before,
  sourceArtifact.receipt.source.schemaVersions,
  targetArtifact.receipt.source.schemaVersions
)
assert.deepEqual(
  z.object({ profile: z.unknown() }).parse(resumed.result.response.result)
    .profile,
  expected
)
const after = await runHistoricalArtifact(targetDirectory, targetHome, 'read')
assert(after.result.response.ok)
assert.deepEqual(after.result.response.result, expected)
const sourceAfter = await runHistoricalArtifact(
  sourceDirectory,
  sourceHome,
  'read'
)
assert(sourceAfter.result.response.ok)
assert.deepEqual(sourceAfter.result.response.result, before)
assert.equal(
  readHistoricalArtifact(sourceDirectory).receiptSha256,
  sourceArtifact.receiptSha256
)
assert.equal(
  readHistoricalArtifact(targetDirectory).receiptSha256,
  targetArtifact.receiptSha256
)
writeFileSync(
  join(targetHome, 'migration-interruption-evidence.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      seeded,
      interrupted,
      recovered,
      resumed,
      after,
      sourceAfter
    },
    null,
    2
  ),
  { flag: 'wx' }
)
console.info('MIGRATION_INTERRUPTION_PROFILE_PASS')

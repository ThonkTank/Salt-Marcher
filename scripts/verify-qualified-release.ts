import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { inspectReleaseFile, verifyReleaseBundle } from './release/bundle.js'
import { releaseQualificationSchema } from './release/qualification.js'
import { releaseRequestSchema } from './release/request.js'
import { resolveQualificationOrigin } from './release/qualification-origin.js'
import { resolveComparisonSource } from './release/comparison-source.js'
import { verifyReleaseEnvironment } from './release/environment-policy.js'
import { createLiveAcceptanceReceipt } from './release/live-acceptance.js'
import { releaseGithubApi } from './release/github-api.js'
import { assertReleaseVersionAvailable } from './release/release-version.js'
import { verifyQualifiedReference } from './release/qualified-reference.js'
import { releaseRepository } from '../src/shared/contracts/release.js'

const { values } = parseArgs({
  options: {
    directory: { type: 'string' },
    phase: { type: 'string' },
    acceptance: { type: 'string' },
    receipt: { type: 'string' },
    reference: { type: 'string' }
  }
})
const directory = resolve(z.string().min(1).parse(values.directory))
const phase = z.enum(['draft', 'publish']).parse(values.phase)
const read = (name: string) =>
  inspectReleaseFile(join(directory, name), 4 * 1024 * 1024, true).content
const rawQualification = read('update-qualification.json')
const reported = releaseQualificationSchema.parse(
  JSON.parse(rawQualification.toString('utf8'))
)
const origin = resolveQualificationOrigin(reported.workflow, phase)
assert.equal(
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  origin.workflow.commit,
  'Verify release from its exact qualified source checkout'
)
if (phase === 'draft') {
  assert.equal(origin.workflow.runId, Number(process.env['GITHUB_RUN_ID']))
  assert.equal(
    origin.workflow.attempt,
    Number(process.env['GITHUB_RUN_ATTEMPT'])
  )
  assert.equal(origin.workflow.commit, process.env['GITHUB_SHA'])
}
const qualified = verifyReleaseBundle(directory, origin.workflow)
if (phase === 'draft') assertReleaseVersionAvailable(qualified.target.version)
else assert.equal(qualified.target.version, process.env['RELEASE_VERSION'])
const requestBytes = read('release-request.json'),
  manifestBytes = read('release-manifest.json')
const request = releaseRequestSchema.parse(
  JSON.parse(requestBytes.toString('utf8'))
)
for (const comparison of request.comparisons)
  for (const artifact of [
    comparison.baseline,
    ...comparison.intermediate,
    ...(comparison.profileFixture ? [comparison.profileFixture] : [])
  ])
    resolveComparisonSource(artifact)
const environment = verifyReleaseEnvironment()
if (phase === 'publish') {
  verifyQualifiedReference(
    directory,
    resolve(z.string().min(1).parse(values.reference)),
    origin.workflow
  )
  assert.equal(process.env['GITHUB_REPOSITORY'], releaseRepository)
  assert.equal(process.env['GITHUB_REF'], 'refs/heads/main')
  const publishRunId = z
    .number()
    .int()
    .positive()
    .parse(Number(process.env['GITHUB_RUN_ID']))
  const response = releaseGithubApi(
    'GET',
    `repos/${releaseRepository}/actions/runs/${publishRunId}/approvals`
  )
  assert.equal(
    response.status,
    200,
    'Cannot authenticate human release approval'
  )
  const input = inspectReleaseFile(
    resolve(z.string().min(1).parse(values.acceptance)),
    64 * 1024,
    true
  ).content
  const receipt = createLiveAcceptanceReceipt(
    input,
    requestBytes,
    manifestBytes,
    rawQualification,
    {
      publishRunId,
      publishRunAttempt: Number(process.env['GITHUB_RUN_ATTEMPT']),
      environmentId: environment.environmentId,
      reviewHistory: response.body,
      observedAt: new Date().toISOString()
    }
  )
  writeFileSync(
    resolve(z.string().min(1).parse(values.receipt)),
    JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx' }
  )
}
console.info(
  JSON.stringify({
    version: qualified.target.version,
    commit: qualified.target.commit,
    artifact: qualified.target.artifact,
    origin,
    phase
  })
)

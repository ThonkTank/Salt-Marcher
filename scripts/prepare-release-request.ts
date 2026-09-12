import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { releaseRepository } from '../src/shared/contracts/release.js'
import {
  readSuccessfulWorkflowEvidence,
  readSuccessfulPostPromotionEvidence
} from './candidate-delivery.js'
import { verifyReleaseEnvironment } from './release/environment-policy.js'
import { releaseGithubApi } from './release/github-api.js'
import { releaseRequestSchema } from './release/request.js'
import { releaseQualificationSchema } from './release/qualification.js'

const requestText = z
  .string()
  .min(1)
  .max(4 * 1024 * 1024)
  .parse(process.env['RELEASE_REQUEST'])
const request = releaseRequestSchema.parse(JSON.parse(requestText))
const output = resolve(z.string().min(1).parse(process.argv[2]))
assert(!existsSync(output), 'Release request output must be new')
const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim()
assert.equal(process.env['GITHUB_REPOSITORY'], releaseRepository)
assert.equal(process.env['GITHUB_REF'], 'refs/heads/main')
assert.equal(process.env['GITHUB_EVENT_NAME'], 'workflow_dispatch')
assert.equal(request.target.commit, process.env['GITHUB_SHA'])
assert.equal(git('rev-parse', 'HEAD'), request.target.commit)
assert.equal(git('rev-parse', 'origin/main'), request.target.commit)
assert.equal(
  git('status', '--porcelain'),
  '',
  'Release requires a clean source checkout'
)
const version = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync('package.json', 'utf8'))).version
assert.equal(
  request.target.version,
  version,
  'Request version differs from package'
)
assert(
  readSuccessfulWorkflowEvidence(request.target.commit),
  'Missing complete exact-SHA Check evidence'
)
assert(
  readSuccessfulPostPromotionEvidence(request.target.commit),
  'Missing successful main promotion attestation'
)
const environment = verifyReleaseEnvironment()
for (const endpoint of [
  `releases/tags/v${version}`,
  `git/ref/tags/v${version}`
]) {
  const response = releaseGithubApi(
    'GET',
    `repos/${releaseRepository}/${endpoint}`
  )
  assert.equal(
    response.status,
    404,
    `Version is already reserved or could not be checked: ${endpoint}`
  )
}
assert(
  readFileSync(join('docs/releases', `${version}.md`), 'utf8').trim().length >
    40,
  'Release notes must explain changes and migrations'
)
const workflow = releaseQualificationSchema.shape.workflow.parse({
  runId: Number(process.env['GITHUB_RUN_ID']),
  attempt: Number(process.env['GITHUB_RUN_ATTEMPT']),
  commit: request.target.commit
})
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'release-request.json'), requestText, { flag: 'wx' })
writeFileSync(join(output, 'workflow.json'), JSON.stringify(workflow) + '\n', {
  flag: 'wx'
})
writeFileSync(
  join(output, 'admission.json'),
  JSON.stringify(
    { formatVersion: 1, workflow, environment, version },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
)
assert.equal(
  git('status', '--porcelain'),
  '',
  'Release controls must be outside tracked source'
)
console.info(
  `Admitted immutable release ${version} at ${request.target.commit}; controls: ${output}`
)

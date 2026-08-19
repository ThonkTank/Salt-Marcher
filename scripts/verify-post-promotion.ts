import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import {
  readWorkspaceIdentity,
  readWorkspaceInputFingerprints
} from './build-identity.js'
import { readSuccessfulWorkflowEvidence } from './candidate-delivery.js'
import { shaSchema } from './delivery-contract.js'

const expectedSha = shaSchema.parse(process.env['GITHUB_SHA'])
const checkedOutSha = git(['rev-parse', 'HEAD'])
if (checkedOutSha !== expectedSha)
  throw new Error('Post-promotion checkout differs from GITHUB_SHA.')
const mainSha = git(['rev-parse', 'origin/main'])
if (mainSha !== expectedSha)
  throw new Error('Post-promotion origin/main differs from GITHUB_SHA.')
const candidate = readSuccessfulWorkflowEvidence(expectedSha)
if (!candidate)
  throw new Error(
    'No successful exact-SHA candidate run contains every required job.'
  )
const identity = readWorkspaceIdentity(process.cwd())
const inputFingerprints = readWorkspaceInputFingerprints(process.cwd())
if (identity.commit !== expectedSha || identity.dirty)
  throw new Error(
    'Post-promotion workspace identity is not the clean main SHA.'
  )

console.info(
  JSON.stringify({
    component: 'post-promotion',
    event: 'candidate-attestation-verified',
    applicationSha: expectedSha,
    inputFingerprints,
    candidate
  })
)

function git(arguments_: readonly string[]): string {
  return z
    .string()
    .min(1)
    .parse(
      execFileSync('git', arguments_, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim()
    )
}

import { execFileSync } from 'node:child_process'
import { z } from 'zod'

import { verifyExactShaAggregate } from './exact-sha-aggregate-contract.js'

const checkedOutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
}).trim()
const checkedSha = z
  .string()
  .min(1)
  .parse(process.env['SALT_MARCHER_CHECKED_SHA'])
const pullRequestHeadSha = z
  .string()
  .min(1)
  .parse(process.env['SALT_MARCHER_PR_HEAD_SHA'])
const needs = JSON.parse(
  z.string().min(1).parse(process.env['SALT_MARCHER_NEEDS_JSON'])
) as unknown

verifyExactShaAggregate({
  checkedOutSha,
  checkedSha,
  pullRequestHeadSha,
  needs
})

console.info(
  JSON.stringify({
    component: 'exact-sha-aggregate',
    event: 'candidate-dependencies-verified',
    checkedSha
  })
)

import { execFileSync } from 'node:child_process'
import { z } from 'zod'

import { verifyExactShaAggregate } from './exact-sha-aggregate-contract.js'
import { readSelectionDirectory } from './ci-selection-artifact.js'

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
const selection = readSelectionDirectory(
  z.string().min(1).parse(process.env['SALT_MARCHER_SELECTION_DIRECTORY'])
)
const main = execFileSync(
  'git',
  ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'],
  { encoding: 'utf8' }
).trim()
const mainSha = z
  .string()
  .regex(/^[a-f0-9]{40}$/)
  .parse(/^([a-f0-9]{40})\trefs\/heads\/main$/.exec(main)?.[1])
execFileSync('git', ['fetch', '--no-tags', 'origin', mainSha], {
  stdio: ['ignore', 'pipe', 'pipe']
})
const event = z
  .enum(['pull_request', 'workflow_dispatch'])
  .parse(process.env['GITHUB_EVENT_NAME'])

verifyExactShaAggregate({
  checkedOutSha,
  checkedSha,
  pullRequestHeadSha,
  needs,
  selection,
  selectionContext: {
    workspaceRoot: process.cwd(),
    baseSha: selection.baseSha,
    mainSha,
    forceFull: event === 'workflow_dispatch'
  }
})

console.info(
  JSON.stringify({
    component: 'exact-sha-aggregate',
    event: 'candidate-dependencies-verified',
    checkedSha
  })
)

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertEvidenceCommitState,
  evidenceCommitAllowlist,
  readEvidenceCommitState
} from './evidence-commit.js'

const head = git(['rev-parse', 'HEAD'])
const parent = git(['rev-parse', 'HEAD^'])
const paths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
  .split('\n')
  .filter(Boolean)
const allowed = new Set<string>(evidenceCommitAllowlist)
const looksLikeEvidenceCommit =
  paths.length > 0 &&
  paths.every((path) => allowed.has(path)) &&
  existsSync(
    resolve(process.cwd(), 'docs/project/quality-reset/final-evidence.json')
  )

if (looksLikeEvidenceCommit) {
  const state = readEvidenceCommitState(parent, head)
  assertEvidenceCommitState(state)
  console.info(
    JSON.stringify({
      component: 'main-push',
      event: 'evidence-commit-verified',
      ...state
    })
  )
} else {
  const result = spawnSync(
    'corepack',
    ['pnpm', 'delivery:verify-post-promotion'],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Post-promotion verification exited with ${result.status}`)
}

function git(arguments_: readonly string[]): string {
  return execFileSync('git', arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8'
  }).trim()
}

import { execFileSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { z } from 'zod'
import { ciRiskGroups, readCiRiskSelection } from './ci-risk-selection.js'

const sha = z.string().regex(/^[a-f0-9]{40}$/)
const headSha = sha.parse(process.env['SALT_MARCHER_CHECKED_SHA'])
const output = z
  .string()
  .min(1)
  .parse(process.env['SALT_MARCHER_SELECTION_PATH'])
if (!isAbsolute(output)) throw new Error('Selection output must be absolute.')
const git = (...args: string[]) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
if (git('rev-parse', 'HEAD') !== headSha)
  throw new Error(
    'Preflight checkout differs from the requested candidate SHA.'
  )
if (git('status', '--porcelain=v1', '--untracked-files=all'))
  throw new Error('Preflight requires a clean immutable checkout.')
const remote = git('ls-remote', '--exit-code', 'origin', 'refs/heads/main')
const match = /^([a-f0-9]{40})\trefs\/heads\/main$/.exec(remote)
const baseSha = sha.parse(match?.[1])
git('fetch', '--no-tags', 'origin', baseSha)
const selection = readCiRiskSelection({
  workspaceRoot: process.cwd(),
  baseSha,
  headSha,
  forceFull: process.env['GITHUB_EVENT_NAME'] === 'workflow_dispatch'
})
writeFileSync(output, `${JSON.stringify(selection, null, 2)}\n`, { flag: 'wx' })
const githubOutput = process.env['GITHUB_OUTPUT']
if (githubOutput) {
  const attempt = z.coerce
    .number()
    .int()
    .positive()
    .parse(process.env['GITHUB_RUN_ATTEMPT'])
  const lines = ciRiskGroups.map(
    (group) =>
      `${group.replaceAll('-', '_')}=${selection.requiredGroups.includes(group)}`
  )
  lines.push(
    `selection_artifact=ci-risk-selection-${headSha}-attempt-${attempt}`
  )
  appendFileSync(githubOutput, `${lines.join('\n')}\n`)
}
console.info(
  JSON.stringify({
    component: 'candidate-preflight',
    baseSha,
    headSha,
    requiredGroups: selection.requiredGroups,
    enforcement: 'independently-verified-selection'
  })
)

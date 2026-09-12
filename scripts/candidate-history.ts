import { execFileSync, spawnSync } from 'node:child_process'
import { z } from 'zod'

const commitSchema = z.string().regex(/^[a-f0-9]{40}$/)

export type CandidateHistory = Readonly<{
  mainIsAncestor: boolean
  mergeCommits: readonly string[]
}>

/** Inspect only the candidate range; existing Main history is not rewritten. */
export function readCandidateHistory(
  mainSha: string,
  headSha: string,
  workspaceRoot = process.cwd()
): CandidateHistory {
  const main = commitSchema.parse(mainSha)
  const head = commitSchema.parse(headSha)
  const ancestor = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', main, head],
    {
      cwd: workspaceRoot,
      encoding: 'utf8'
    }
  )
  if (ancestor.error) throw ancestor.error
  if (ancestor.status !== 0 && ancestor.status !== 1)
    throw new Error(`Could not inspect candidate ancestry: ${ancestor.stderr}`)
  const output = execFileSync(
    'git',
    ['rev-list', '--min-parents=2', `${main}..${head}`],
    { cwd: workspaceRoot, encoding: 'utf8' }
  ).trim()
  return Object.freeze({
    mainIsAncestor: ancestor.status === 0,
    mergeCommits: Object.freeze(
      output ? output.split(/\r?\n/).map((sha) => commitSchema.parse(sha)) : []
    )
  })
}

export function assertCandidateHistory(history: CandidateHistory): void {
  if (!history.mainIsAncestor)
    throw new Error('Candidate is not based on the current remote main SHA.')
  if (history.mergeCommits.length > 0)
    throw new Error(
      `Main requires linear history. Candidate contains merge commits: ${history.mergeCommits.join(', ')}. Create a new linear candidate from current main before qualification.`
    )
}

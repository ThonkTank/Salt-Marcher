import { execFileSync } from 'node:child_process'
import {
  constants,
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  ciRiskSelectionSchema,
  type CiRiskSelection
} from './ci-risk-selection.js'
import { readCandidateHistory } from './candidate-history.js'
import { readSelectionArchive } from './ci-selection-archive.js'

const artifactSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    expired: z.boolean(),
    size_in_bytes: z.number().int().nonnegative(),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/)
  })
  .passthrough()
const pagesSchema = z.array(
  z.object({ artifacts: z.array(artifactSchema) }).passthrough()
)

export function selectRiskSelectionArtifact(
  input: unknown,
  headSha: string,
  runAttempt: number
): z.infer<typeof artifactSchema> {
  const prefix = `ci-risk-selection-${headSha}-attempt-`
  const matches = pagesSchema
    .parse(input)
    .flatMap((page) => page.artifacts)
    .flatMap((artifact) => {
      if (!artifact.name.startsWith(prefix) || artifact.expired) return []
      const suffix = artifact.name.slice(prefix.length)
      if (!/^[1-9][0-9]*$/.test(suffix)) return []
      const attempt = Number(suffix)
      return Number.isSafeInteger(attempt) && attempt <= runAttempt
        ? [{ artifact, attempt }]
        : []
    })
    .sort((left, right) => right.attempt - left.attempt)
  const first = matches[0]
  if (
    !first ||
    matches.filter((match) => match.attempt === first.attempt).length !== 1
  )
    throw new Error(
      'No unique unexpired CI selection artifact proves this workflow attempt.'
    )
  if (
    first.artifact.size_in_bytes === 0 ||
    first.artifact.size_in_bytes > 2 * 1024 * 1024
  )
    throw new Error('CI selection artifact exceeds its download bounds.')
  return first.artifact
}

export function readSelectionDirectory(directory: string): CiRiskSelection {
  const files = readdirSync(directory)
  if (files.length !== 1 || files[0] !== 'ci-risk-selection.json')
    throw new Error(
      'CI selection artifact must contain exactly its original JSON receipt.'
    )
  const descriptor = openSync(
    join(directory, files[0]),
    constants.O_RDONLY | constants.O_NOFOLLOW
  )
  try {
    const stat = fstatSync(descriptor)
    if (!stat.isFile() || stat.size === 0 || stat.size > 1024 * 1024)
      throw new Error('CI selection receipt exceeds its file bounds.')
    return ciRiskSelectionSchema.parse(
      JSON.parse(readFileSync(descriptor, 'utf8'))
    )
  } finally {
    closeSync(descriptor)
  }
}

export function assertSelectionMainBase(
  selection: CiRiskSelection,
  mainSha: string,
  workspaceRoot: string
): void {
  if (
    !readCandidateHistory(selection.baseSha, mainSha, workspaceRoot)
      .mainIsAncestor
  )
    throw new Error(
      'CI selection base is not on the authenticated Main history.'
    )
}

/** GitHub run-scoped download; the caller must still recompute every field. */
export function readWorkflowSelection(input: {
  repository: string
  runId: number
  runAttempt: number
  headSha: string
}): CiRiskSelection {
  const gh = (args: string[]) =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024
    })
  const artifact = selectRiskSelectionArtifact(
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${input.repository}/actions/runs/${input.runId}/artifacts?per_page=100`
      ])
    ),
    input.headSha,
    input.runAttempt
  )
  const archive = execFileSync(
    'gh',
    ['api', `repos/${input.repository}/actions/artifacts/${artifact.id}/zip`],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024
    }
  )
  return readSelectionArchive(archive, artifact)
}

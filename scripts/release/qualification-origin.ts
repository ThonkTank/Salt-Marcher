import assert from 'node:assert/strict'
import { z } from 'zod'
import { releaseRepository } from '../../src/shared/contracts/release.js'
import { releaseQualificationSchema } from './qualification.js'
import { releaseGithubApi, type ReleaseGithubApi } from './github-api.js'

export const qualificationJobName = 'Build and qualify immutable release'
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
/** Authenticate the workflow and artifact independently of documents downloaded from it. */
export function resolveQualificationOrigin(
  raw: z.infer<typeof releaseQualificationSchema.shape.workflow>,
  phase: 'draft' | 'publish',
  api: ReleaseGithubApi = releaseGithubApi
) {
  const expected = releaseQualificationSchema.shape.workflow.parse(raw)
  const get = (endpoint: string) => {
    const response = api('GET', `repos/${releaseRepository}/${endpoint}`)
    assert.equal(
      response.status,
      200,
      `Qualification origin unavailable: ${endpoint}`
    )
    return response.body
  }
  const run = z
    .object({
      id,
      run_attempt: id,
      head_sha: z.literal(expected.commit),
      head_branch: z.literal('main'),
      path: z.literal('.github/workflows/release.yml'),
      event: z.literal('workflow_dispatch'),
      status: z.enum(['in_progress', 'completed']),
      conclusion: z.string().nullable(),
      repository: z.object({ full_name: z.literal(releaseRepository) }),
      head_repository: z.object({ full_name: z.literal(releaseRepository) })
    })
    .parse(get(`actions/runs/${expected.runId}`))
  assert.equal(run.id, expected.runId)
  assert.equal(
    run.run_attempt,
    expected.attempt,
    'Qualification workflow was rerun'
  )
  if (phase === 'publish' || run.status === 'completed') {
    assert.equal(run.status, 'completed')
    assert.equal(
      run.conclusion,
      'success',
      'Qualification workflow did not succeed'
    )
  } else assert.equal(run.conclusion, null)
  const jobs = []
  for (let page = 1; ; page++) {
    assert(page <= 100, 'Qualification job listing exceeds limit')
    const listing = z
      .object({
        jobs: z.array(
          z.object({
            id,
            name: z.string(),
            status: z.string(),
            conclusion: z.string().nullable()
          })
        )
      })
      .parse(
        get(
          `actions/runs/${expected.runId}/attempts/${expected.attempt}/jobs?per_page=100&page=${page}`
        )
      )
    jobs.push(...listing.jobs)
    if (listing.jobs.length < 100) break
  }
  const matching = jobs.filter((job) => job.name === qualificationJobName)
  assert.equal(matching.length, 1, 'Missing or ambiguous qualification job')
  assert.equal(matching[0]!.status, 'completed')
  assert.equal(matching[0]!.conclusion, 'success')
  const artifacts = []
  for (let page = 1; ; page++) {
    assert(page <= 100, 'Qualification artifact listing exceeds limit')
    const listing = z
      .object({
        artifacts: z.array(
          z.object({
            id,
            name: z.string(),
            expired: z.boolean(),
            size_in_bytes: z.number().int().positive(),
            digest: z.string().nullable(),
            workflow_run: z.object({ id, head_sha: z.string() })
          })
        )
      })
      .parse(
        get(
          `actions/runs/${expected.runId}/artifacts?per_page=100&page=${page}`
        )
      )
    artifacts.push(...listing.artifacts)
    if (listing.artifacts.length < 100) break
  }
  const wanted = artifacts.filter(
    (artifact) => artifact.name === `release-${expected.commit}`
  )
  assert.equal(wanted.length, 1, 'Missing or ambiguous qualified artifact')
  const artifact = wanted[0]!
  assert.equal(artifact.expired, false)
  assert.equal(artifact.workflow_run.id, expected.runId)
  assert.equal(artifact.workflow_run.head_sha, expected.commit)
  assert(
    /^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ''),
    'Missing GitHub artifact digest'
  )
  return { workflow: expected, jobId: matching[0]!.id, artifact }
}

import { z } from 'zod'
import { releaseRepository } from '../../src/shared/contracts/release.js'
import { comparisonArtifactSchema, type ComparisonArtifact } from './request.js'
import { releaseGithubApi, type ReleaseGithubApi } from './github-api.js'

const repository = `repos/${releaseRepository}`
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const assetSchema = z.object({
  id,
  name: z.string(),
  size: z.number().int().positive(),
  state: z.literal('uploaded')
})
const runSchema = z.object({
  id,
  run_attempt: id,
  head_sha: z.string(),
  head_branch: z.literal('main'),
  path: z.literal('.github/workflows/release-fixtures.yml'),
  event: z.literal('workflow_dispatch'),
  status: z.literal('completed'),
  conclusion: z.literal('success'),
  repository: z.object({ full_name: z.literal(releaseRepository) }),
  head_repository: z.object({ full_name: z.literal(releaseRepository) })
})
const artifactSchema = z.object({
  id,
  name: z.string(),
  expired: z.literal(false),
  size_in_bytes: z.number().int().positive(),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  workflow_run: z.object({ id, head_sha: z.string() })
})

/** No release alias or user-supplied URL is resolved here. */
export function resolveComparisonSource(
  raw: ComparisonArtifact,
  api: ReleaseGithubApi = releaseGithubApi
) {
  const artifact = comparisonArtifactSchema.parse(raw)
  const get = (endpoint: string): unknown => {
    const response = api('GET', `${repository}/${endpoint}`)
    if (response.status !== 200)
      throw new Error(
        `Comparison source unavailable (${response.status}): ${endpoint}`
      )
    return response.body
  }
  if (artifact.source.kind === 'published-release') {
    const tag = artifact.source.tag
    const release = z
      .object({
        id,
        tag_name: z.literal(tag),
        draft: z.literal(false),
        prerelease: z.literal(false),
        assets: z.array(assetSchema)
      })
      .parse(get(`releases/tags/${encodeURIComponent(tag)}`))
    const assets = [
      'release-manifest.json',
      artifact.manifest.artifact.name
    ].map((name) => {
      const matches = release.assets.filter((asset) => asset.name === name)
      if (matches.length !== 1)
        throw new Error(`Comparison release needs exactly one ${name}.`)
      return matches[0]!
    })
    if (
      assets[0]!.size > 4 * 1024 * 1024 ||
      assets[1]!.size !== artifact.manifest.artifact.bytes
    )
      throw new Error(
        'Comparison release asset sizes do not match the request.'
      )
    const objectSchema = z.object({
      type: z.enum(['tag', 'commit']),
      sha: z.string().regex(/^[a-f0-9]{40}$/)
    })
    let object = z
      .object({ object: objectSchema })
      .parse(get(`git/ref/tags/${encodeURIComponent(tag)}`)).object
    for (let depth = 0; object.type === 'tag' && depth < 8; depth++)
      object = z
        .object({ object: objectSchema })
        .parse(get(`git/tags/${object.sha}`)).object
    if (object.type !== 'commit' || object.sha !== artifact.manifest.commit)
      throw new Error(
        'Comparison release tag does not resolve to the requested source commit.'
      )
    return {
      kind: 'published-release' as const,
      releaseId: release.id,
      tag,
      commit: object.sha,
      assets
    }
  }
  const source = artifact.source
  const run = runSchema.parse(get(`actions/runs/${source.workflowRunId}`))
  if (
    run.id !== source.workflowRunId ||
    run.run_attempt !== source.workflowRunAttempt ||
    run.head_sha !== source.workflowCommit
  )
    throw new Error(
      'Comparison fixture workflow identity differs from the request.'
    )
  const metadata = artifactSchema.parse(
    get(`actions/artifacts/${source.artifactId}`)
  )
  if (
    metadata.id !== source.artifactId ||
    metadata.name !== source.artifactName ||
    metadata.workflow_run.id !== run.id ||
    metadata.workflow_run.head_sha !== run.head_sha
  )
    throw new Error('Comparison fixture artifact belongs to another build.')
  // gh downloads by run+name: prove that pair names exactly the requested immutable ID.
  let matches = 0
  for (let page = 1; ; page++) {
    if (page > 100)
      throw new Error('Comparison workflow artifact listing exceeds its bound.')
    const listing = z
      .object({ artifacts: z.array(z.object({ id, name: z.string() })) })
      .parse(get(`actions/runs/${run.id}/artifacts?per_page=100&page=${page}`))
    for (const entry of listing.artifacts)
      if (entry.name === metadata.name) {
        matches++
        if (entry.id !== metadata.id)
          throw new Error('Comparison fixture artifact name is ambiguous.')
      }
    if (listing.artifacts.length < 100) break
  }
  if (matches !== 1)
    throw new Error('Comparison fixture artifact is absent or ambiguous.')
  return {
    kind: 'qualification-fixture' as const,
    workflow: {
      runId: run.id,
      attempt: run.run_attempt,
      commit: run.head_sha
    },
    artifact: metadata
  }
}
export type ResolvedComparisonSource = ReturnType<
  typeof resolveComparisonSource
>

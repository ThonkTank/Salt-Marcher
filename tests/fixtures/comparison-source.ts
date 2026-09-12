import { artifact } from './release-request.js'
import type { ReleaseGithubApi } from '../../scripts/release/github-api.js'
import {
  comparisonArtifactSchema,
  type ComparisonArtifact
} from '../../scripts/release/request.js'

export function comparisonSource(
  kind: 'qualification-fixture' | 'published-release' = 'qualification-fixture'
) {
  const expected: ComparisonArtifact = comparisonArtifactSchema.parse(
    artifact('0.0.170', 'a', 43, 43)
  )
  if (kind === 'published-release') expected.source = { kind, tag: 'v0.0.170' }
  const run = {
    id: 10,
    run_attempt: 1,
    head_sha: 'e'.repeat(40),
    head_branch: 'main',
    path: '.github/workflows/release-fixtures.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: 'ThonkTank/Salt-Marcher' },
    head_repository: { full_name: 'ThonkTank/Salt-Marcher' }
  }
  const metadata = {
    id: 20,
    name: 'baseline-0.0.170',
    expired: false,
    size_in_bytes: 2048,
    digest: `sha256:${'b'.repeat(64)}`,
    workflow_run: { id: 10, head_sha: 'e'.repeat(40) }
  }
  const listing = { artifacts: [{ id: 20, name: 'baseline-0.0.170' }] }
  const release = {
    id: 30,
    tag_name: 'v0.0.170',
    draft: false,
    prerelease: false,
    assets: [
      { id: 40, name: 'release-manifest.json', size: 500, state: 'uploaded' },
      {
        id: 41,
        name: expected.manifest.artifact.name,
        size: expected.manifest.artifact.bytes,
        state: 'uploaded'
      }
    ]
  }
  const ref = { object: { type: 'commit', sha: expected.manifest.commit } }
  const calls: string[] = []
  const api: ReleaseGithubApi = (method, endpoint) => {
    if (method !== 'GET')
      throw new Error('Read-only source resolution required')
    calls.push(endpoint)
    const prefix = 'repos/ThonkTank/Salt-Marcher/'
    if (!endpoint.startsWith(prefix)) throw new Error('Unexpected repository')
    const path = endpoint.slice(prefix.length)
    const result: Record<string, unknown> = {
      'actions/runs/10': run,
      'actions/artifacts/20': metadata,
      'actions/runs/10/artifacts?per_page=100&page=1': listing,
      'releases/tags/v0.0.170': release,
      'git/ref/tags/v0.0.170': ref,
      [`git/tags/${'f'.repeat(40)}`]: {
        object: { type: 'commit', sha: expected.manifest.commit }
      }
    }
    return {
      status: path in result ? 200 : 404,
      body: structuredClone(result[path] ?? { message: 'Not found' })
    }
  }
  return { expected, run, metadata, listing, release, ref, calls, api }
}

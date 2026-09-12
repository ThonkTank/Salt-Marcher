import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { releaseRepository } from '../../src/shared/contracts/release.js'
import { comparisonArtifactSchema, type ComparisonArtifact } from './request.js'
import {
  resolveComparisonSource,
  type ResolvedComparisonSource
} from './comparison-source.js'
import { verifyComparisonFiles } from './comparison-fixture.js'
import { releaseGithubApi, type ReleaseGithubApi } from './github-api.js'

export function downloadComparison(
  source: ResolvedComparisonSource,
  artifact: ComparisonArtifact,
  directory: string
): void {
  const args =
    source.kind === 'published-release'
      ? [
          'release',
          'download',
          source.tag,
          '--repo',
          releaseRepository,
          '--pattern',
          'release-manifest.json',
          '--pattern',
          artifact.manifest.artifact.name,
          '--dir',
          directory
        ]
      : [
          'run',
          'download',
          String(source.workflow.runId),
          '--repo',
          releaseRepository,
          '--name',
          source.artifact.name,
          '--dir',
          directory
        ]
  execFileSync('gh', args, {
    stdio: 'pipe',
    timeout: 180_000,
    maxBuffer: 1024 * 1024
  })
}

export function acquireComparison(
  raw: ComparisonArtifact,
  destination: string,
  options: {
    api?: ReleaseGithubApi
    download?: typeof downloadComparison
  } = {}
) {
  const artifact = comparisonArtifactSchema.parse(raw)
  const api = options.api ?? releaseGithubApi
  const source = resolveComparisonSource(artifact, api)
  if (existsSync(destination)) {
    verifyComparisonFiles(destination, artifact)
    return { directory: destination, source }
  }
  mkdirSync(dirname(destination), { recursive: true })
  const staging = mkdtempSync(join(dirname(destination), '.comparison-'))
  try {
    ;(options.download ?? downloadComparison)(source, artifact, staging)
    verifyComparisonFiles(staging, artifact)
    if (!isDeepStrictEqual(resolveComparisonSource(artifact, api), source))
      throw new Error('Comparison source changed during download.')
    chmodSync(join(staging, artifact.manifest.artifact.name), 0o755)
    // The destination is new. Never overwrite a previously acquired comparison.
    if (existsSync(destination))
      throw new Error('Comparison destination appeared during download.')
    renameSync(staging, destination)
    return { directory: destination, source }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

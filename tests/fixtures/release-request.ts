import { releaseRepository } from '../../src/shared/contracts/release.js'

export function artifact(
  version: string,
  commit: string,
  installation: number,
  campaign: number
) {
  return {
    manifest: {
      formatVersion: 1 as const,
      repository: releaseRepository,
      version,
      commit: commit.repeat(40),
      platform: 'linux' as const,
      arch: 'x64' as const,
      schemaVersions: { installation, campaign },
      artifact: {
        name: `SaltMarcher-${version}-x64.AppImage`,
        bytes: 1024,
        sha256: commit.repeat(64)
      }
    },
    manifestSha256: 'f'.repeat(64),
    source: {
      kind: 'qualification-fixture' as const,
      workflowRunId: 10,
      workflowRunAttempt: 1,
      workflowCommit: 'e'.repeat(40),
      artifactId: 20,
      artifactName: `baseline-${version}`
    }
  }
}

export function request() {
  return {
    formatVersion: 1,
    repository: releaseRepository,
    target: {
      version: '0.3.0',
      commit: 'd'.repeat(40),
      schemaVersions: { installation: 43, campaign: 43 }
    },
    comparisons: [
      {
        id: 'same',
        scenario: 'same-schema',
        baseline: artifact('0.0.170', 'a', 43, 43),
        intermediate: []
      },
      {
        id: 'migration',
        scenario: 'schema-migration',
        baseline: artifact('0.0.167', 'b', 42, 42),
        intermediate: []
      },
      {
        id: 'skip',
        scenario: 'skipped-releases',
        baseline: artifact('0.0.160', 'c', 42, 41),
        intermediate: [artifact('0.0.167', 'b', 42, 42)]
      }
    ]
  }
}

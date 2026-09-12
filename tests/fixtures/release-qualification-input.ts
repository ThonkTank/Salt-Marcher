import { uiFixture, recoveryUiFixture } from './release-ui.js'
import { releaseRequestSchema } from '../../scripts/release/request.js'
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
export function qualificationInputFixture() {
  const same = uiFixture({ version: '0.0.170', commit: 'b' })
  const migration = recoveryUiFixture({
    version: '0.0.167',
    commit: 'c',
    installation: 42,
    campaign: 42
  })
  const skip = uiFixture({
    version: '0.0.160',
    commit: 'd',
    installation: 42,
    campaign: 41
  })
  const target = same.target
  const request = releaseRequestSchema.parse({
    formatVersion: 1,
    repository: target.manifest.repository,
    target: {
      version: target.manifest.version,
      commit: target.manifest.commit,
      schemaVersions: target.manifest.schemaVersions
    },
    comparisons: [
      { ...same.comparison, id: 'same' },
      { ...migration.comparison, id: 'migration' },
      {
        ...skip.comparison,
        id: 'skip',
        scenario: 'skipped-releases',
        intermediate: [migration.comparison.baseline]
      }
    ]
  })
  return {
    request: bytes(request),
    manifest: bytes(target.manifest),
    target,
    workflow: { runId: 123, attempt: 1, commit: target.manifest.commit },
    completedAt: '2026-09-12T12:00:00Z',
    firstInstallation: bytes(same.installation),
    recoveryComparisonId: 'migration',
    cases: [
      {
        id: 'same',
        baseline: same.baseline,
        intermediate: [],
        report: bytes(same.report)
      },
      {
        id: 'migration',
        baseline: migration.baseline,
        intermediate: [],
        report: bytes(migration.report)
      },
      {
        id: 'skip',
        baseline: skip.baseline,
        intermediate: [migration.baseline],
        report: bytes(skip.report)
      }
    ]
  }
}

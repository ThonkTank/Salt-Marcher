import assert from 'node:assert/strict'
import { join } from 'node:path'
import { digestReleaseDocument } from './qualification.js'
import { partyHistoryScenario } from '../qualification/historical-party-history-scenario.js'
import type { ComparisonArtifact, ReleaseRequest } from './request.js'

export const comparisonDirectory = (
  root: string,
  artifact: ComparisonArtifact
) => join(root, digestReleaseDocument(Buffer.from(JSON.stringify(artifact))))
export function qualificationCasePlan(
  request: ReleaseRequest,
  recoveryId: string
) {
  assert(
    request.comparisons.some(
      (c) => c.id === recoveryId && c.scenario === 'schema-migration'
    ),
    'Recovery must select a migration case'
  )
  return request.comparisons.map((comparison) => {
    assert.equal(
      comparison.baseline.source.kind,
      'qualification-fixture',
      'Published baseline requires a qualified profile fixture input; it cannot be silently repackaged'
    )
    const names = [
      'same-schema',
      'from-candidate-42',
      'from-main-42',
      'from-41'
    ] as const
    const scenario = names.find((name) => {
      const value = partyHistoryScenario(name)
      return (
        value.baseline.installation ===
          comparison.baseline.manifest.schemaVersions.installation &&
        value.baseline.campaign ===
          comparison.baseline.manifest.schemaVersions.campaign &&
        value.target.installation ===
          request.target.schemaVersions.installation &&
        value.target.campaign === request.target.schemaVersions.campaign
      )
    })
    assert(
      scenario,
      'No qualified fixture expectation for requested schema transition'
    )
    return { comparison, scenario, recovery: comparison.id === recoveryId }
  })
}

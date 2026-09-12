import { artifact, request } from './release-request.js'
import {
  digestReleaseDocument,
  verifyQualificationDocuments
} from '../../scripts/release/qualification.js'

export const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
export const digest = (character: string) => character.repeat(64)
export function fixture() {
  const requested = request()
  const manifest = artifact('0.3.0', 'd', 43, 43).manifest
  const file = (name: string) => ({
    name: `${name}.json`,
    bytes: 1024,
    sha256: digest('a')
  })
  const comparisons = requested.comparisons.map((comparison) => ({
    id: comparison.id,
    baseline: comparison.baseline,
    runtime: requested.target,
    evidence: file(comparison.id),
    profile: {
      sourceUnchanged: true,
      campaigns: { active: 1, inactive: 1, recoverableDeleted: 1 },
      before: digest('a'),
      migratedExpected: digest('b'),
      migratedActual: digest('b'),
      continuedExpected: digest('c'),
      continuedActual: digest('c'),
      restored: digest('b'),
      protection: digest('c'),
      protectedRestore: digest('c'),
      secondProtection: digest('b')
    }
  }))
  return {
    requested,
    manifest,
    qualification: {
      formatVersion: 2,
      requestSha256: digestReleaseDocument(bytes(requested)),
      target: manifest,
      targetManifestSha256: digestReleaseDocument(bytes(manifest)),
      workflow: { runId: 100, attempt: 1, commit: manifest.commit },
      completedAt: '2026-09-12T14:00:00Z',
      comparisons,
      firstInstallation: file('first-installation'),
      recovery: {
        comparisonId: comparisons[0]!.id,
        evidence: file('recovery'),
        previousProgram: comparisons[0]!.baseline.manifest.artifact.sha256,
        recoveredProgram: comparisons[0]!.baseline.manifest.artifact.sha256,
        previousProfile: digest('a'),
        recoveredProfile: digest('a'),
        acceptedWorkAfterCrash: digest('c')
      }
    }
  }
}
export const verify = (value: ReturnType<typeof fixture>) =>
  verifyQualificationDocuments(
    bytes(value.requested),
    bytes(value.manifest),
    bytes(value.qualification)
  )

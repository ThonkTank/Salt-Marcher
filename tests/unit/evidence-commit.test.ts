import { describe, expect, it } from 'vitest'
import {
  assertEvidenceCommitState,
  evidenceCommitAllowlist,
  type EvidenceCommitState
} from '../../scripts/evidence-commit.js'

const valid: EvidenceCommitState = {
  applicationSha: 'a'.repeat(40),
  evidenceSha: 'b'.repeat(40),
  evidenceParent: 'a'.repeat(40),
  changedPaths: [
    'docs/project/quality-reset/final-evidence.json',
    'docs/project/quality-reset/final-report.md',
    'docs/project/quality-reset/live-status.md'
  ],
  applicationAppInputFingerprint: 'c'.repeat(64),
  evidenceAppInputFingerprint: 'c'.repeat(64),
  evidenceApplicationSha: 'a'.repeat(40)
}

describe('evidence commit contract', () => {
  it('accepts one direct allowlisted child with identical app inputs', () => {
    expect(() => assertEvidenceCommitState(valid)).not.toThrow()
    expect(evidenceCommitAllowlist).not.toContain('src/')
  })

  it.each([
    ['second child', { evidenceParent: 'b'.repeat(40) }],
    ['application change', { changedPaths: ['src/main/index.ts'] }],
    ['fingerprint drift', { evidenceAppInputFingerprint: 'd'.repeat(64) }],
    ['foreign evidence', { evidenceApplicationSha: 'e'.repeat(40) }]
  ] as const)('rejects %s', (_name, patch) => {
    expect(() => assertEvidenceCommitState({ ...valid, ...patch })).toThrow()
  })
})

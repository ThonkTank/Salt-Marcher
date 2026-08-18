import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeAppBuildInputFingerprintAtRef } from './build-identity.js'
import { finalEvidenceSchema } from './delivery-contract.js'

export const evidenceCommitAllowlist = Object.freeze([
  'docs/project/quality-reset/final-evidence.json',
  'docs/project/quality-reset/final-report.md',
  'docs/project/quality-reset/live-status.md',
  'docs/project/quality-reset/final-evidence.sha256'
] as const)

export interface EvidenceCommitState {
  readonly applicationSha: string
  readonly evidenceSha: string
  readonly evidenceParent: string
  readonly changedPaths: readonly string[]
  readonly applicationAppInputFingerprint: string
  readonly evidenceAppInputFingerprint: string
  readonly evidenceApplicationSha: string
}

export function assertEvidenceCommitState(state: EvidenceCommitState): void {
  if (state.evidenceParent !== state.applicationSha)
    throw new Error('Evidence commit must be the direct Application-SHA child')
  if (state.evidenceSha === state.applicationSha)
    throw new Error('Evidence commit must differ from the Application-SHA')
  if (state.changedPaths.length === 0)
    throw new Error('Evidence commit does not contain evidence files')
  const allowed = new Set<string>(evidenceCommitAllowlist)
  const forbidden = state.changedPaths.filter((path) => !allowed.has(path))
  if (forbidden.length > 0)
    throw new Error(
      `Evidence commit changes forbidden paths: ${forbidden.join(', ')}`
    )
  if (
    state.applicationAppInputFingerprint !== state.evidenceAppInputFingerprint
  )
    throw new Error('Evidence commit changes the app input fingerprint')
  if (state.evidenceApplicationSha !== state.applicationSha)
    throw new Error('Final evidence references another Application-SHA')
}

export function readEvidenceCommitState(
  applicationSha: string,
  evidenceSha = 'HEAD',
  workspaceRoot = process.cwd()
): EvidenceCommitState {
  const evidence = finalEvidenceSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          workspaceRoot,
          'docs/project/quality-reset/final-evidence.json'
        ),
        'utf8'
      )
    )
  )
  return {
    applicationSha,
    evidenceSha: git(workspaceRoot, ['rev-parse', evidenceSha]),
    evidenceParent: git(workspaceRoot, ['rev-parse', `${evidenceSha}^`]),
    changedPaths: git(workspaceRoot, [
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      evidenceSha
    ])
      .split('\n')
      .filter(Boolean),
    applicationAppInputFingerprint: computeAppBuildInputFingerprintAtRef(
      workspaceRoot,
      applicationSha
    ),
    evidenceAppInputFingerprint: computeAppBuildInputFingerprintAtRef(
      workspaceRoot,
      evidenceSha
    ),
    evidenceApplicationSha: evidence.application.sha
  }
}

function git(workspaceRoot: string, arguments_: readonly string[]): string {
  return execFileSync('git', arguments_, {
    cwd: workspaceRoot,
    encoding: 'utf8'
  }).trim()
}

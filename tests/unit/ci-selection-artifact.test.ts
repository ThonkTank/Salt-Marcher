import {
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { ciRiskGroups } from '../../scripts/ci-risk-selection.js'
import {
  readSelectionDirectory,
  selectRiskSelectionArtifact
} from '../../scripts/ci-selection-artifact.js'

const head = 'a'.repeat(40)
const artifact = {
  id: 10,
  name: `ci-risk-selection-${head}-attempt-1`,
  expired: false,
  size_in_bytes: 500,
  digest: `sha256:${'0'.repeat(64)}`
}
const pages = (artifacts: unknown[]) => [{ artifacts }]
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

it('selects a unique original receipt from the latest eligible attempt, including failed-job reruns', () => {
  expect(selectRiskSelectionArtifact(pages([artifact]), head, 2)).toEqual(
    artifact
  )
  const next = {
    ...artifact,
    id: 11,
    name: `ci-risk-selection-${head}-attempt-2`
  }
  expect(selectRiskSelectionArtifact(pages([artifact, next]), head, 2)).toEqual(
    next
  )
})

it.each(
  [
    [],
    [{ ...artifact, expired: true }],
    [artifact, artifact],
    [{ ...artifact, name: `ci-risk-selection-${'b'.repeat(40)}-attempt-1` }],
    [{ ...artifact, name: `ci-risk-selection-${head}-attempt-3` }],
    [{ ...artifact, name: `ci-risk-selection-${head}-attempt-01` }],
    [{ ...artifact, size_in_bytes: 0 }],
    [{ ...artifact, size_in_bytes: 2 * 1024 * 1024 + 1 }]
  ].map((artifacts) => ({ artifacts }))
)(
  'rejects ambiguous, missing, foreign, future or oversized receipts %#',
  ({ artifacts }) => {
    expect(() =>
      selectRiskSelectionArtifact(pages(artifacts), head, 2)
    ).toThrow()
  }
)

it('reads exactly one bounded regular receipt and rejects extra files, symlinks and oversized data', () => {
  const root = mkdtempSync(join(tmpdir(), 'salt-ci-receipt-'))
  roots.push(root)
  const path = join(root, 'ci-risk-selection.json')
  const receipt = {
    schemaVersion: 1,
    baseSha: 'b'.repeat(40),
    headSha: head,
    policySha256: null,
    diffSha256: 'c'.repeat(64),
    baseAppFingerprint: 'd'.repeat(64),
    headAppFingerprint: 'e'.repeat(64),
    mode: 'full',
    reasons: ['missing-or-changed-base-policy'],
    requiredGroups: ciRiskGroups,
    requiresLocalArtifact: true
  }
  writeFileSync(path, JSON.stringify(receipt))
  expect(readSelectionDirectory(root)).toEqual(receipt)
  const extra = join(root, 'extra.json')
  writeFileSync(extra, '{}')
  expect(() => readSelectionDirectory(root)).toThrow(/exactly/)
  rmSync(extra)
  truncateSync(path, 1024 * 1024 + 1)
  expect(() => readSelectionDirectory(root)).toThrow(/bounds/)
  rmSync(path)
  symlinkSync(join(root, 'nonexistent'), path)
  expect(() => readSelectionDirectory(root)).toThrow()
})

import { afterEach, expect, it } from 'vitest'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { verifyRuntimeEvidence } from '../../scripts/release/runtime-evidence.js'
import {
  runtimeFixture as fixture,
  cleanupRuntimeFixtures
} from '../fixtures/release-runtime.js'
afterEach(cleanupRuntimeFixtures)

it.each(['release', 'historical-fixture'] as const)(
  'binds successful %s runtime evidence to verified files',
  (kind) => {
    const v = fixture(kind)
    expect(verifyRuntimeEvidence(v.envelope, v.target, 'identity')).toEqual(
      v.envelope.result.response.result
    )
  }
)
it.each([
  'artifactSha256',
  'sourceCommit',
  'resultSha256',
  'requestId',
  'operation',
  'exitCode'
] as const)(
  'rejects altered %s independently of matching embedded content',
  (field) => {
    for (const kind of ['release', 'historical-fixture'] as const) {
      const v = fixture(kind)
      const broken = {
        ...v.envelope,
        [field]:
          field === 'exitCode'
            ? 1
            : field === 'operation'
              ? 'read'
              : field === 'requestId'
                ? '22222222-2222-4222-8222-222222222222'
                : 'f'.repeat(field === 'sourceCommit' ? 40 : 64)
      }
      expect(() =>
        verifyRuntimeEvidence(broken, v.target, 'identity')
      ).toThrow()
    }
  }
)
it('rejects changed report content even when its embedded invocation still matches', () => {
  const v = fixture('release')
  v.envelope.result.response.result.nodeVersion = 'changed'
  expect(() => verifyRuntimeEvidence(v.envelope, v.target, 'identity')).toThrow(
    /original document hash/
  )
})
it('rejects wrong provenance documents and cross-kind envelopes', () => {
  for (const kind of ['release', 'historical-fixture'] as const) {
    const v = fixture(kind)
    const field = kind === 'release' ? 'manifestSha256' : 'receiptSha256'
    expect(() =>
      verifyRuntimeEvidence(
        { ...v.envelope, [field]: 'f'.repeat(64) },
        v.target,
        'identity'
      )
    ).toThrow()
    const other = fixture(kind === 'release' ? 'historical-fixture' : 'release')
    expect(() =>
      verifyRuntimeEvidence(other.envelope, v.target, 'identity')
    ).toThrow()
  }
})
it('rejects a self-consistent but wrong actual Electron identity', () => {
  const v = fixture('release')
  v.envelope.result.response.result.electronVersion = '42.0.0'
  v.envelope.resultSha256 = digestReleaseDocument(
    Buffer.from(JSON.stringify(v.envelope.result))
  )
  expect(() => verifyRuntimeEvidence(v.envelope, v.target, 'identity')).toThrow(
    /Electron differs/
  )
})

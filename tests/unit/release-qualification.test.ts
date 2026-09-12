import { expect, it } from 'vitest'
import { artifact } from '../fixtures/release-request.js'
import {
  bytes,
  digest,
  fixture,
  verify
} from '../fixtures/release-qualification.js'
import { verifyQualificationDocuments } from '../../scripts/release/qualification.js'

it('binds all requested cases, runtime identities and complete-profile proofs', () => {
  const value = fixture()
  expect(verify(value).comparisons).toHaveLength(3)
})

it('rejects changed control-document bytes, source commits and substituted targets', () => {
  const value = fixture()
  expect(() =>
    verifyQualificationDocuments(
      Buffer.from(JSON.stringify(value.requested, null, 2)),
      bytes(value.manifest),
      bytes(value.qualification)
    )
  ).toThrow(/exact release documents/)
  value.qualification.workflow.commit = 'f'.repeat(40)
  expect(() => verify(value)).toThrow(/source commit/)
  const substituted = fixture()
  substituted.qualification.target = {
    ...substituted.manifest,
    artifact: { ...substituted.manifest.artifact, sha256: digest('e') }
  }
  expect(() => verify(substituted)).toThrow()
})

it('rejects omitted, duplicated or substituted comparisons and wrong runtime formats', () => {
  const omitted = fixture()
  omitted.qualification.comparisons.pop()
  expect(() => verify(omitted)).toThrow()
  const duplicate = fixture()
  duplicate.qualification.comparisons[1] =
    duplicate.qualification.comparisons[0]!
  expect(() => verify(duplicate)).toThrow()
  const substituted = fixture()
  substituted.qualification.comparisons[0]!.baseline = artifact(
    '0.0.170',
    'f',
    43,
    43
  )
  expect(() => verify(substituted)).toThrow()
  const runtime = fixture()
  runtime.qualification.comparisons[0]!.runtime = {
    ...runtime.requested.target,
    schemaVersions: { installation: 43, campaign: 42 }
  }
  expect(() => verify(runtime)).toThrow()
})

it.each([
  'migratedActual',
  'continuedActual',
  'restored',
  'protection',
  'protectedRestore',
  'secondProtection'
] as const)('rejects a failed complete-profile comparison: %s', (field) => {
  const value = fixture()
  value.qualification.comparisons[0]!.profile[field] = digest('f')
  expect(() => verify(value)).toThrow()
})

it('rejects no-op continued work, modified sources and missing deleted campaigns', () => {
  const noop = fixture()
  noop.qualification.comparisons[0]!.profile.continuedActual = digest('b')
  noop.qualification.comparisons[0]!.profile.continuedExpected = digest('b')
  expect(() => verify(noop)).toThrow()
  const changed = fixture()
  changed.qualification.comparisons[0]!.profile.sourceUnchanged = false
  expect(() => verify(changed)).toThrow()
  const incomplete = fixture()
  incomplete.qualification.comparisons[0]!.profile.campaigns.recoverableDeleted = 0
  expect(() => verify(incomplete)).toThrow()
})

it('rejects recovery to a different program or profile and loss of accepted later work', () => {
  for (const field of [
    'recoveredProgram',
    'recoveredProfile',
    'acceptedWorkAfterCrash'
  ] as const) {
    const value = fixture()
    value.qualification.recovery[field] = digest('f')
    expect(() => verify(value)).toThrow(/Recovery evidence/)
  }
})

it('rejects reused evidence filenames and obsolete weak reports', () => {
  const value = fixture()
  value.qualification.firstInstallation =
    value.qualification.comparisons[0]!.evidence
  expect(() => verify(value)).toThrow(/own evidence file/)
  expect(() =>
    verifyQualificationDocuments(
      bytes(value.requested),
      bytes(value.manifest),
      bytes({
        formatVersion: 1,
        baselineVersion: '0.1.99',
        targetVersion: '0.3.0'
      })
    )
  ).toThrow()
})

it('keeps evidence files separate from control documents', () => {
  const value = fixture()
  value.qualification.firstInstallation.name = 'release-manifest.json'
  expect(() => verify(value)).toThrow(/control document/)
})

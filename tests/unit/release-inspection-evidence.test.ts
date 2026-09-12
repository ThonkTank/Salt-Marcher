import { expect, it } from 'vitest'
import { artifact } from '../fixtures/release-request.js'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import { releaseInspectionRequestSchema } from '../../src/shared/contracts/release-qualification.js'
import { verifyReleaseInspectionReport } from '../../scripts/qualification/release-inspection-evidence.js'

function fixture() {
  const manifest = releaseManifestSchema.parse(
    artifact('0.3.0', 'a', 43, 43).manifest
  )
  const request = releaseInspectionRequestSchema.parse({
    operation: 'identity',
    requestId: '11111111-1111-4111-8111-111111111111',
    profile: '/tmp/profile'
  })
  const report = {
    formatVersion: 1,
    artifactVersion: '0.3.0',
    operation: 'identity',
    build: {
      channel: 'release',
      commit: manifest.commit,
      dirty: false,
      workspaceFingerprint: 'b'.repeat(64),
      appBuildInputFingerprint: 'c'.repeat(64),
      builtAt: '2026-09-12T10:00:00Z',
      schemaVersions: { installation: 43, campaign: 43 },
      migrationRegistryVersion: 24,
      toolchain: {
        node: '22.23.2',
        pnpm: '10.15.1',
        electron: '43.2.0',
        electronVite: '5.0.0',
        electronBuilder: '26.15.3',
        platform: 'linux',
        arch: 'x64'
      }
    },
    response: {
      ok: true,
      requestId: request.requestId,
      result: {
        schemaVersions: { installation: 43, campaign: 43 },
        nodeVersion: '24.0.0',
        electronVersion: '43.2.0'
      }
    }
  }
  return { manifest, request, report }
}
it('verifies runtime version, actual Utility schemas, embedded clean commit and invocation', () => {
  const value = fixture()
  expect(
    verifyReleaseInspectionReport(
      value.report,
      value.manifest,
      value.request,
      0
    )
  ).toEqual(value.report)
})
it.each(['dirty', 'commit', 'channel', 'schema'] as const)(
  'rejects an incorrect embedded build %s',
  (field) => {
    const value = fixture()
    if (field === 'dirty') value.report.build.dirty = true
    if (field === 'commit') value.report.build.commit = 'f'.repeat(40)
    if (field === 'channel') value.report.build.channel = 'local'
    if (field === 'schema') value.report.build.schemaVersions.campaign = 42
    expect(() =>
      verifyReleaseInspectionReport(
        value.report,
        value.manifest,
        value.request,
        0
      )
    ).toThrow(/does not prove/)
  }
)
it('rejects an actual Utility schema that contradicts matching metadata', () => {
  const value = fixture()
  value.report.response.result.schemaVersions.campaign = 42
  expect(() =>
    verifyReleaseInspectionReport(
      value.report,
      value.manifest,
      value.request,
      0
    )
  ).toThrow(/Utility schema identity/)
})
it('rejects another request ID, operation, version or failed process', () => {
  const value = fixture()
  expect(() =>
    verifyReleaseInspectionReport(
      value.report,
      value.manifest,
      value.request,
      1
    )
  ).toThrow()
  expect(() =>
    verifyReleaseInspectionReport(
      { ...value.report, operation: 'read' },
      value.manifest,
      value.request,
      0
    )
  ).toThrow()
  expect(() =>
    verifyReleaseInspectionReport(
      { ...value.report, artifactVersion: '0.2.0' },
      value.manifest,
      value.request,
      0
    )
  ).toThrow()
  value.report.response.requestId = '22222222-2222-4222-8222-222222222222'
  expect(() =>
    verifyReleaseInspectionReport(
      value.report,
      value.manifest,
      value.request,
      0
    )
  ).toThrow()
})

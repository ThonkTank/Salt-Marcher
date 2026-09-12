import { describe, expect, it } from 'vitest'
import {
  assertRequestedTarget,
  comparisonArtifactSchema,
  releaseRequestSchema
} from '../../scripts/release/request.js'
import { artifact, request } from '../fixtures/release-request.js'

describe('immutable release request', () => {
  it('identifies real comparison stands without selecting latest or relabelling them as public', () => {
    const parsed = releaseRequestSchema.parse(request())
    expect(parsed.comparisons[0]!.baseline.source.kind).toBe(
      'qualification-fixture'
    )
    expect(
      parsed.comparisons[2]!.intermediate[0]!.manifest.schemaVersions.campaign
    ).toBe(42)
    expect(
      comparisonArtifactSchema.parse({
        ...artifact('0.2.0', 'a', 43, 43),
        source: { kind: 'published-release', tag: 'v0.2.0' }
      }).source.kind
    ).toBe('published-release')
  })

  it('rejects missing scenarios, ambiguous IDs, absent intermediates and pretend migrations', () => {
    const missing = request()
    missing.comparisons.pop()
    expect(() => releaseRequestSchema.parse(missing)).toThrow()
    const duplicate = request()
    duplicate.comparisons[1]!.id = 'same'
    expect(() => releaseRequestSchema.parse(duplicate)).toThrow()
    const skipped = request()
    skipped.comparisons[2]!.intermediate = []
    expect(() => releaseRequestSchema.parse(skipped)).toThrow()
    const fake = request()
    fake.comparisons[1]!.baseline.manifest.schemaVersions = {
      installation: 43,
      campaign: 43
    }
    expect(() => releaseRequestSchema.parse(fake)).toThrow()
    const repackaged = request()
    repackaged.comparisons[0]!.baseline.manifest.commit =
      repackaged.target.commit
    expect(() => releaseRequestSchema.parse(repackaged)).toThrow()
  })

  it('rejects downgrade paths and non-increasing or out-of-order versions', () => {
    const downgrade = request()
    downgrade.comparisons[1]!.baseline.manifest.schemaVersions.campaign = 44
    expect(() => releaseRequestSchema.parse(downgrade)).toThrow()
    const order = request()
    order.comparisons[2]!.intermediate = [artifact('0.0.150', 'b', 42, 42)]
    expect(() => releaseRequestSchema.parse(order)).toThrow()
    const backwards = request()
    backwards.target.version = '0.0.100'
    expect(() => releaseRequestSchema.parse(backwards)).toThrow()
  })

  it('rejects wrong repositories, file paths, tags and credential-bearing extra fields', () => {
    const baseline = artifact('0.2.0', 'a', 43, 43)
    expect(() =>
      comparisonArtifactSchema.parse({
        ...baseline,
        source: { kind: 'published-release', tag: 'latest' }
      })
    ).toThrow()
    expect(() =>
      comparisonArtifactSchema.parse({
        ...baseline,
        source: { ...baseline.source, token: 'not-allowed' }
      })
    ).toThrow()
    expect(() =>
      comparisonArtifactSchema.parse({
        ...baseline,
        manifest: { ...baseline.manifest, repository: 'other/repo' }
      })
    ).toThrow()
    expect(() =>
      comparisonArtifactSchema.parse({
        ...baseline,
        manifest: {
          ...baseline.manifest,
          artifact: {
            ...baseline.manifest.artifact,
            name: '../payload.AppImage'
          }
        }
      })
    ).toThrow()
    expect(() =>
      comparisonArtifactSchema.parse({
        ...baseline,
        manifest: {
          ...baseline.manifest,
          artifact: {
            ...baseline.manifest.artifact,
            name: 'SaltMarcher-0.1.0-x64.AppImage'
          }
        }
      })
    ).toThrow()
  })

  it('binds the built manifest to the requested commit, version and data formats', () => {
    const parsed = releaseRequestSchema.parse(request())
    const manifest = artifact('0.3.0', 'd', 43, 43).manifest
    expect(assertRequestedTarget(parsed, manifest)).toEqual(manifest)
    expect(() =>
      assertRequestedTarget(parsed, { ...manifest, commit: 'e'.repeat(40) })
    ).toThrow()
    expect(() =>
      assertRequestedTarget(parsed, { ...manifest, version: '0.3.1' })
    ).toThrow()
    expect(() =>
      assertRequestedTarget(parsed, {
        ...manifest,
        schemaVersions: { installation: 43, campaign: 44 }
      })
    ).toThrow()
  })
  it('rejects using the target bytes as a differently labelled baseline', () => {
    const parsed = releaseRequestSchema.parse(request())
    const manifest = artifact('0.3.0', 'd', 43, 43).manifest
    manifest.artifact.sha256 =
      parsed.comparisons[0]!.baseline.manifest.artifact.sha256
    expect(() => assertRequestedTarget(parsed, manifest)).toThrow(
      /target bytes/
    )
  })
})

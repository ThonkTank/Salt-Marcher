import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { comparisonSource } from '../fixtures/comparison-source.js'
import { bytes } from '../fixtures/release-qualification.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { acquireComparison } from '../../scripts/release/acquire-comparison.js'
import { verifyComparisonFiles } from '../../scripts/release/comparison-fixture.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function setup(
  kind: 'qualification-fixture' | 'published-release' = 'qualification-fixture'
) {
  const value = comparisonSource(kind)
  const root = mkdtempSync(join(tmpdir(), 'comparison-download-'))
  roots.push(root)
  const destination = join(root, 'verified')
  const image = Buffer.from('inert comparison fixture bytes')
  value.expected.manifest.artifact.bytes = image.length
  value.expected.manifest.artifact.sha256 = digestReleaseDocument(image)
  value.expected.manifestSha256 = digestReleaseDocument(
    bytes(value.expected.manifest)
  )
  value.release.assets[1]!.size = image.length
  const historical = {
    formatVersion: 1,
    evidence: 'historical-test-artifact-not-public-release',
    version: value.expected.manifest.version,
    source: {
      commit: value.expected.manifest.commit,
      schemaVersions: value.expected.manifest.schemaVersions
    },
    artifact: value.expected.manifest.artifact
  }
  const receipt = {
    formatVersion: 1,
    kind: 'historical-qualification-fixture',
    manifest: value.expected.manifest,
    manifestSha256: value.expected.manifestSha256,
    historicalReceiptSha256: digestReleaseDocument(bytes(historical)),
    workflow: { runId: 10, attempt: 1, commit: 'e'.repeat(40) }
  }
  const download = (
    _source: unknown,
    _artifact: unknown,
    directory: string
  ) => {
    writeFileSync(
      join(directory, 'release-manifest.json'),
      bytes(value.expected.manifest)
    )
    writeFileSync(join(directory, value.expected.manifest.artifact.name), image)
    if (kind === 'qualification-fixture') {
      writeFileSync(join(directory, 'comparison-fixture.json'), bytes(receipt))
      writeFileSync(
        join(directory, 'historical-artifact.json'),
        bytes(historical)
      )
    }
  }
  return { ...value, root, destination, image, historical, receipt, download }
}
it.each(['qualification-fixture', 'published-release'] as const)(
  'acquires verified %s files and reuses only a verified cache',
  (kind) => {
    const value = setup(kind)
    acquireComparison(value.expected, value.destination, value)
    expect(verifyComparisonFiles(value.destination, value.expected)).toEqual(
      value.expected.manifest
    )
    acquireComparison(value.expected, value.destination, {
      api: value.api,
      download: () => {
        throw new Error('Unexpected redownload')
      }
    })
  }
)
it('does not activate or leave a partial staging directory after a failed download', () => {
  const value = setup()
  expect(() =>
    acquireComparison(value.expected, value.destination, {
      api: value.api,
      download: () => {
        throw new Error('Network interrupted')
      }
    })
  ).toThrow(/interrupted/)
  expect(readdirSync(value.root)).toEqual([])
})
it('does not accept corrupted image bytes or overwrite an existing invalid cache', () => {
  const value = setup()
  acquireComparison(value.expected, value.destination, value)
  writeFileSync(
    join(value.destination, value.expected.manifest.artifact.name),
    'bad'
  )
  expect(() =>
    acquireComparison(value.expected, value.destination, value)
  ).toThrow(/AppImage differs/)
  expect(existsSync(value.destination)).toBe(true)
})
it('rejects source changes observed after download', () => {
  const value = setup()
  expect(() =>
    acquireComparison(value.expected, value.destination, {
      api: value.api,
      download: (source, artifact, directory) => {
        value.download(source, artifact, directory)
        value.metadata.digest = `sha256:${'c'.repeat(64)}`
      }
    })
  ).toThrow(/source changed/)
  expect(readdirSync(value.root)).toEqual([])
})
it('rejects a receipt from another workflow attempt', () => {
  const value = setup()
  value.receipt.workflow.attempt = 2
  expect(() =>
    acquireComparison(value.expected, value.destination, value)
  ).toThrow(/Historical fixture receipt/)
})
it('rejects a substituted historical source even with a matching receipt hash', () => {
  const value = setup()
  value.historical.source.commit = 'f'.repeat(40)
  value.receipt.historicalReceiptSha256 = digestReleaseDocument(
    bytes(value.historical)
  )
  expect(() =>
    acquireComparison(value.expected, value.destination, value)
  ).toThrow(/Historical fixture receipt/)
})
it('rejects a changed manifest before activating files', () => {
  const value = setup()
  value.expected.manifestSha256 = 'f'.repeat(64)
  expect(() =>
    acquireComparison(value.expected, value.destination, value)
  ).toThrow(/Comparison manifest/)
  expect(readdirSync(value.root)).toEqual([])
})

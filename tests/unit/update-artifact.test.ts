import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { artifact } from '../fixtures/release-request.js'
import { readUpdateArtifact } from '../../scripts/qualification/update-artifact.js'
import { prepareReleaseTestHome } from '../../scripts/qualification/release-test-home.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'update-artifact-'))
  roots.push(directory)
  const manifest = artifact('0.3.0', 'a', 43, 43).manifest
  const image = Buffer.from('inert artifact bytes')
  manifest.artifact.bytes = image.length
  manifest.artifact.sha256 = digestReleaseDocument(image)
  writeFileSync(join(directory, manifest.artifact.name), image)
  writeFileSync(
    join(directory, 'release-manifest.json'),
    JSON.stringify(manifest)
  )
  return { directory, manifest }
}
it('keeps real release manifests distinct from historical source receipts', () => {
  const value = fixture()
  const result = readUpdateArtifact(value.directory)
  expect(result.kind).toBe('release')
  expect(result.manifest).toEqual(value.manifest)
  expect(result.provenance).not.toHaveProperty('receipt')
})
it('rejects corrupted bytes and does not fall back from a corrupt historical receipt', () => {
  const value = fixture()
  writeFileSync(join(value.directory, value.manifest.artifact.name), 'wrong')
  expect(() => readUpdateArtifact(value.directory)).toThrow(/bytes differ/)
  writeFileSync(join(value.directory, 'historical-artifact.json'), '{}')
  expect(() => readUpdateArtifact(value.directory)).toThrow()
})
it('keeps a historical fixture explicitly historical even if its release manifest also exists', () => {
  const value = fixture()
  writeFileSync(
    join(value.directory, 'historical-artifact.json'),
    JSON.stringify({
      formatVersion: 1,
      evidence: 'historical-test-artifact-not-public-release',
      version: value.manifest.version,
      artifact: value.manifest.artifact,
      source: {
        formatVersion: 1,
        evidence: 'source-inspection-only',
        id: 'test-fixture',
        commit: value.manifest.commit,
        schemaVersions: value.manifest.schemaVersions,
        tree: 'b'.repeat(40),
        packageVersion: '0.2.0',
        packageManager: 'pnpm@10.15.1',
        files: []
      }
    })
  )
  const result = readUpdateArtifact(value.directory)
  expect(result.kind).toBe('historical-fixture')
  expect(result.provenance).toHaveProperty('receipt')
})
it('reuses an existing run marker byte-for-byte and rejects mismatched or aliased roots', () => {
  const value = fixture()
  const first = prepareReleaseTestHome(value.directory)
  const path = join(value.directory, '.salt-marcher-qualification.json')
  const before = readFileSync(path)
  expect(prepareReleaseTestHome(value.directory)).toEqual(first)
  expect(readFileSync(path)).toEqual(before)
  const alias = join(value.directory, 'alias')
  symlinkSync(value.directory, alias)
  expect(() => prepareReleaseTestHome(alias)).toThrow(/alias/)
  writeFileSync(
    path,
    JSON.stringify({
      formatVersion: 1,
      runId: first.runId,
      root: '/another/root'
    })
  )
  expect(() => prepareReleaseTestHome(value.directory)).toThrow(/another root/)
})

import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { readHistoricalArtifact } from '../../scripts/qualification/historical-artifact-runner.js'
import { historicalReleaseSources } from '../../scripts/qualification/historical-release-sources.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'salt-artifact-bytes-'))
  roots.push(directory)
  const content = Buffer.from('test bytes, not an executable')
  const manifest = {
    formatVersion: 1,
    evidence: 'historical-test-artifact-not-public-release',
    source: {
      ...historicalReleaseSources[0],
      formatVersion: 1,
      evidence: 'source-inspection-only',
      tree: '1'.repeat(40),
      packageVersion: '0.1.0',
      packageManager: 'pnpm@10.15.1',
      files: []
    },
    version: '0.0.137',
    artifact: {
      name: 'SaltMarcher-0.0.137-x64.AppImage',
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
  }
  const save = () =>
    writeFileSync(
      join(directory, 'historical-artifact.json'),
      JSON.stringify(manifest)
    )
  save()
  writeFileSync(join(directory, manifest.artifact.name), content)
  return { directory, manifest, content, save }
}

it('binds the artifact to its exact file bytes and manifest bytes', () => {
  const { directory, manifest } = fixture()
  const result = readHistoricalArtifact(directory)
  expect(result.receipt.artifact.sha256).toBe(manifest.artifact.sha256)
  expect(result.receiptSha256).toMatch(/^[a-f0-9]{64}$/)
})

it('rejects same-sized corruption before execution', () => {
  const { directory, manifest, content } = fixture()
  content[0] = 0
  writeFileSync(join(directory, manifest.artifact.name), content)
  expect(() => readHistoricalArtifact(directory)).toThrow('bytes do not match')
})

it.each(['version', 'path', 'size', 'format'] as const)(
  'rejects incompatible %s metadata',
  (field) => {
    const { directory, manifest, save } = fixture()
    if (field === 'version') manifest.version = '0.0.138'
    if (field === 'path')
      manifest.artifact.name = '../SaltMarcher-0.0.137-x64.AppImage'
    if (field === 'size') manifest.artifact.bytes += 1
    if (field === 'format') manifest.formatVersion = 2
    save()
    expect(() => readHistoricalArtifact(directory)).toThrow()
  }
)

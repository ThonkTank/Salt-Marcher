import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createBuildReceipt,
  verifyBuildReceipt
} from '../../scripts/build-receipt.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('build receipt', () => {
  it('binds the build identity to every output byte', () => {
    const root = buildOutput('local')
    const receipt = createBuildReceipt(root)
    writeFileSync(
      join(root, 'build-receipt.json'),
      `${JSON.stringify(receipt, null, 2)}\n`
    )

    expect(verifyBuildReceipt(root)).toEqual(receipt)
    expect(receipt.files.map((entry) => entry.path)).toEqual([
      'build-info.json',
      'main/index.js',
      'renderer/index.html'
    ])

    writeFileSync(join(root, 'main', 'index.js'), 'tampered')
    expect(() => verifyBuildReceipt(root)).toThrow(/does not match/)
  })

  it('rejects a stale receipt after a channel switch', () => {
    const root = buildOutput('development')
    const receipt = createBuildReceipt(root)
    writeFileSync(join(root, 'build-receipt.json'), JSON.stringify(receipt))
    writeBuildInfo(root, 'local')

    expect(() => verifyBuildReceipt(root)).toThrow(/does not match/)
  })
})

function buildOutput(channel: 'development' | 'local'): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-receipt-'))
  roots.push(root)
  mkdirSync(join(root, 'main'))
  mkdirSync(join(root, 'renderer'))
  writeBuildInfo(root, channel)
  writeFileSync(join(root, 'main', 'index.js'), 'main')
  writeFileSync(join(root, 'renderer', 'index.html'), 'renderer')
  return root
}

function writeBuildInfo(root: string, channel: 'development' | 'local'): void {
  writeFileSync(
    join(root, 'build-info.json'),
    JSON.stringify({
      channel,
      commit: 'a'.repeat(40),
      dirty: true,
      workspaceFingerprint: 'b'.repeat(64),
      appBuildInputFingerprint: 'c'.repeat(64),
      builtAt: '2026-08-15T12:00:00.000Z',
      schemaVersions: { installation: 28, campaign: 28 },
      migrationRegistryVersion: 1,
      toolchain: {
        node: 'v22.19.0',
        pnpm: '10.15.1',
        electron: '43.2.0',
        electronVite: '5.0.0',
        electronBuilder: '26.15.3',
        platform: 'linux',
        arch: 'x64'
      }
    })
  )
}

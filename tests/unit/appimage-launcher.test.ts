import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAppImageLauncher } from '../../src/shared/maintenance/appimage-launcher.js'
import { sha256 } from '../../src/shared/maintenance/files.js'
const mocks = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }))
let root: string
let artifact: string
beforeEach(() => {
  vi.resetAllMocks()
  root = mkdtempSync(join(tmpdir(), 'salt-helper-read-'))
  mkdirSync(join(root, 'artifacts'))
  artifact = join(root, 'artifacts', 'target.AppImage')
  writeFileSync(artifact, 'verified synthetic artifact')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
const record =
  'SALT_MARCHER_LAUNCHER_V2:' + Buffer.from('helper bytes').toString('base64')
describe('verified AppImage helper extraction', () => {
  it('does not execute bytes with a different artifact hash', () => {
    expect(() => readAppImageLauncher(artifact, 'f'.repeat(64))).toThrow(
      'verändert'
    )
    expect(mocks.spawnSync).not.toHaveBeenCalled()
  })
  it('reads exactly one framed helper while tolerating AppImage extraction logging', () => {
    mocks.spawnSync.mockReturnValue({
      status: 0,
      stdout: `extraction progress\n${record}\n`,
      stderr: ''
    })
    expect(readAppImageLauncher(artifact, sha256(artifact))).toEqual(
      Buffer.from('helper bytes')
    )
    const options = mocks.spawnSync.mock.calls[0]![2] as {
      env: Record<string, string>
    }
    expect(options.env['ELECTRON_RUN_AS_NODE']).toBe('1')
  })
  it.each(['', record + '\n' + record, 'SALT_MARCHER_LAUNCHER_V2:invalid!'])(
    'rejects missing or ambiguous output %j',
    (output) => {
      mocks.spawnSync.mockReturnValue({ status: 0, stdout: output, stderr: '' })
      expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
        'gültigen Starthelfer'
      )
    }
  )
  it('rejects an executable modified while extraction runs', () => {
    mocks.spawnSync.mockImplementation(() => {
      writeFileSync(artifact, 'changed artifact')
      return { status: 0, stdout: record, stderr: '' }
    })
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'während der Prüfung'
    )
  })
  it('rejects process failure even when output contains a framed helper', () => {
    mocks.spawnSync.mockReturnValue({
      status: 1,
      stdout: record,
      stderr: 'failed'
    })
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'nicht aus dem Ziel-AppImage'
    )
  })
})

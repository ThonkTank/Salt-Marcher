import {
  existsSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readAppImageLauncher,
  readAppImageProfileProtocol
} from '../../src/shared/maintenance/appimage-launcher.js'
import { sha256 } from '../../src/shared/maintenance/files.js'
const mocks = vi.hoisted(() => ({
  spawnSync:
    vi.fn<
      (
        file: string,
        args: string[],
        options: { cwd: string; env: NodeJS.ProcessEnv }
      ) => {
        status: number | null
        stdout?: string
        stderr?: string
        error?: Error
        signal?: string
      }
    >()
}))
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }))
let root: string
let artifact: string
beforeEach(() => {
  vi.resetAllMocks()
  root = mkdtempSync(join(tmpdir(), 'salt-helper-test-'))
  artifact = join(root, 'target.AppImage')
  writeFileSync(artifact, 'verified synthetic artifact')
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
  for (const call of mocks.spawnSync.mock.calls)
    expect(existsSync(call[2].cwd)).toBe(false)
})
function extract(bytes: string | Buffer = 'helper bytes') {
  mocks.spawnSync.mockImplementation(
    (_file: string, args: string[], options: { cwd: string }) => {
      const file = join(options.cwd, 'squashfs-root', args[1]!)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, bytes)
      return { status: 0, stdout: 'arbitrary extraction logging', stderr: '' }
    }
  )
}
describe('verified AppImage resource extraction without AppRun', () => {
  it('reads a resource directly without inheriting Electron launch modes', () => {
    vi.stubEnv('ELECTRON_RUN_AS_NODE', '1')
    vi.stubEnv('APPIMAGE_EXTRACT_AND_RUN', '1')
    extract()
    expect(readAppImageLauncher(artifact, sha256(artifact))).toEqual(
      Buffer.from('helper bytes')
    )
    const [file, args, options] = mocks.spawnSync.mock.calls[0]!
    expect(file).toBe(artifact)
    expect(args).toEqual([
      '--appimage-extract',
      'resources/maintenance/start.cjs'
    ])
    expect(options.env['ELECTRON_RUN_AS_NODE']).toBeUndefined()
    expect(options.env['APPIMAGE_EXTRACT_AND_RUN']).toBeUndefined()
    expect(options.env['TMPDIR']).toBe(options.cwd)
  })
  it('validates the packaged profile protocol', () => {
    const protocol = readFileSync(
      'resources/maintenance/profile-access.json',
      'utf8'
    )
    extract(protocol)
    expect(
      readAppImageProfileProtocol(artifact, sha256(artifact))
    ).toMatchObject({
      locking: 'canonical-profile-v1',
      scope: 'complete-profile'
    })
    expect(mocks.spawnSync.mock.calls[0]![1]).toEqual([
      '--appimage-extract',
      'resources/maintenance/profile-access.json'
    ])
    extract(protocol.replace('"formatVersion": 1', '"formatVersion": 2'))
    expect(() =>
      readAppImageProfileProtocol(artifact, sha256(artifact))
    ).toThrow()
  })
  it('never executes an artifact with a mismatching hash', () => {
    expect(() => readAppImageLauncher(artifact, 'f'.repeat(64))).toThrow(
      'verändert'
    )
    expect(mocks.spawnSync).not.toHaveBeenCalled()
  })
  it('rejects replacement of the artifact during extraction', () => {
    mocks.spawnSync.mockImplementation(() => {
      writeFileSync(artifact, 'replacement')
      return { status: 0 }
    })
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'während der Prüfung'
    )
  })
  it.each([
    { status: 1 },
    { status: null, signal: 'SIGTERM', error: new Error('deadline exceeded') }
  ])('rejects failed or timed out extraction %j', (result) => {
    mocks.spawnSync.mockReturnValue(result)
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'nicht aus dem Ziel-AppImage'
    )
  })
  it('rejects missing resource even with forged success output', () => {
    mocks.spawnSync.mockReturnValue({
      status: 0,
      stdout: 'SALT_MARCHER_LAUNCHER_V2:aGVscGVy'
    })
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'gültigen Starthelfer'
    )
  })
  it.each([Buffer.alloc(0), Buffer.alloc(2 * 1024 * 1024 + 1)])(
    'rejects invalid resource size %#',
    (bytes) => {
      extract(bytes)
      expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
        'gültigen Starthelfer'
      )
    }
  )
  it.each([
    'squashfs-root',
    'squashfs-root/resources',
    'squashfs-root/resources/maintenance',
    'squashfs-root/resources/maintenance/start.cjs'
  ])('rejects symlink component %s', (component) => {
    mocks.spawnSync.mockImplementation(
      (_file: string, _args: string[], options: { cwd: string }) => {
        const link = join(options.cwd, component)
        mkdirSync(dirname(link), { recursive: true })
        symlinkSync(component.endsWith('.cjs') ? artifact : root, link)
        return { status: 0 }
      }
    )
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'gültigen Starthelfer'
    )
  })
  it('rejects a directory in place of the resource', () => {
    mocks.spawnSync.mockImplementation(
      (_file: string, _args: string[], options: { cwd: string }) => {
        mkdirSync(
          join(options.cwd, 'squashfs-root/resources/maintenance/start.cjs'),
          { recursive: true }
        )
        return { status: 0 }
      }
    )
    expect(() => readAppImageLauncher(artifact, sha256(artifact))).toThrow(
      'gültigen Starthelfer'
    )
  })
})

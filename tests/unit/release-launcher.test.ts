import { readAppImageLauncher } from '../../src/shared/maintenance/appimage-launcher.js'
import { installMaintenanceLauncher } from '../../src/shared/maintenance/launcher.js'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseDeployment } from '../support/release-maintenance.js'
import {
  currentProgram,
  deploymentProgram,
  installLauncher,
  setCurrent
} from '../../src/main/release/deployment.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { durableJson, sha256 } from '../../src/shared/maintenance/files.js'
vi.mock('../../src/shared/maintenance/appimage-launcher.js', () => ({
  readAppImageLauncher: vi.fn(() =>
    Buffer.from('process.stdout.write("shared-helper")')
  )
}))
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
function extractionRuntime(): string {
  return `#!/bin/sh
[ "$1" = --appimage-extract ] || exit 9
[ -z "$ELECTRON_RUN_AS_NODE" ] && [ -z "$APPIMAGE_EXTRACT_AND_RUN" ] || exit 8
mkdir squashfs-root
cat > squashfs-root/salt-marcher <<'SALT_TEST_RUNTIME'
#!/bin/sh
exec ${shellQuote(process.execPath)} "$@"
SALT_TEST_RUNTIME
chmod 700 squashfs-root/salt-marcher
`
}
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
describe('stable release launcher', () => {
  it('installs the target helper using the retained runtime', () => {
    const workspace = mkdtempSync(join(tmpdir(), "salt launcher '"))
    roots.push(workspace)
    const root = join(workspace, 'salt-marcher')
    const executable = (version: string, content: string) => {
      const id = releaseDeployment(root, version)
      const path = join(root, 'deployments', id, 'SaltMarcher.AppImage')
      writeFileSync(path, content)
      chmodSync(path, 0o700)
      const manifestPath = join(root, 'deployments', id, 'manifest.json')
      const manifest = releaseManifestSchema.parse(
        JSON.parse(readFileSync(manifestPath, 'utf8'))
      )
      manifest.artifact.sha256 = sha256(path)
      manifest.artifact.bytes = statSync(path).size
      durableJson(manifestPath, manifest)
      return id
    }
    const previous = executable('0.1.99', extractionRuntime())
    const next = executable('0.2.0', '#!/bin/sh\nexit 47\n')
    setCurrent(root, previous)
    const id = randomUUID()
    mkdirSync(join(root, `staged-${id}`))
    const coordinator = new MaintenanceCoordinator(root)
    coordinator.begin({
      id,
      operation: 'update',
      backup: null,
      previous: currentProgram(root),
      next: deploymentProgram(root, next)
    })
    installLauncher(root, deploymentProgram(root, next))
    coordinator.activate()
    expect(execFileSync(join(root, 'start'), { encoding: 'utf8' })).toBe(
      'shared-helper'
    )
    expect(readAppImageLauncher).toHaveBeenCalledWith(
      join(root, 'deployments', next, 'SaltMarcher.AppImage'),
      deploymentProgram(root, next).sha256
    )
    expect(readFileSync(join(root, 'start'), 'utf8')).not.toContain(
      '--release-recover'
    )
  })
})

describe('shared maintenance launcher publication', () => {
  it('interrupts extraction without leaving its process or temporary directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-extraction-signal-'))
    roots.push(root)
    const marker = join(root, 'extractor.pid')
    const runtime = join(root, 'runtime')
    writeFileSync(
      runtime,
      `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)\n`,
      { mode: 0o700 }
    )
    installMaintenanceLauncher(
      root,
      { path: runtime, sha256: sha256(runtime) },
      Buffer.from('unused')
    )
    const child = spawn(join(root, 'start'), [], {
      env: { ...process.env, TMPDIR: root },
      stdio: 'ignore'
    })
    const exited = new Promise<void>((resolveExit) =>
      child.once('exit', () => resolveExit())
    )
    let extractor: number | undefined
    try {
      await vi.waitFor(() => expect(existsSync(marker)).toBe(true), {
        timeout: 3000
      })
      extractor = Number(readFileSync(marker, 'utf8'))
      child.kill('SIGTERM')
      await vi.waitFor(() => expect(child.exitCode).toBe(143), {
        timeout: 3000
      })
      expect(() => process.kill(extractor!, 0)).toThrow()
      expect(
        readdirSync(root).filter((name) => name.startsWith('salt-launcher.'))
      ).toEqual([])
    } finally {
      if (extractor) {
        try {
          process.kill(extractor, 'SIGKILL')
        } catch {
          /* Already exited. */
        }
      }
      if (child.exitCode === null) child.kill('SIGKILL')
      await exited
    }
  })
  it.each([
    { runtime: '#!/bin/sh\nexit 47\n', helper: '', expected: 1 },
    { runtime: extractionRuntime(), helper: 'process.exit(23)', expected: 23 },
    { runtime: '#!/bin/sh\nmkdir squashfs-root\n', helper: '', expected: 1 }
  ])(
    'preserves failure and cleans temporary runtime %#',
    ({ runtime: script, helper, expected }) => {
      const root = mkdtempSync(join(tmpdir(), 'salt launcher failure-'))
      roots.push(root)
      const runtime = join(root, 'runtime')
      writeFileSync(runtime, script, { mode: 0o700 })
      installMaintenanceLauncher(
        root,
        { path: runtime, sha256: sha256(runtime) },
        Buffer.from(helper)
      )
      const result = spawnSync(join(root, 'start'), {
        env: { ...process.env, TMPDIR: root },
        encoding: 'utf8'
      })
      expect(result.status).toBe(expected)
      expect(
        readdirSync(root).filter((name) => name.startsWith('salt-launcher.'))
      ).toEqual([])
    }
  )
  it('quotes installation paths and refuses changed helper bytes', () => {
    const root = mkdtempSync(join(tmpdir(), "salt shared launcher '"))
    roots.push(root)
    const runtime = join(root, 'interpreter')
    // Models extraction; execution of the actual packaged runtime is qualified in KVM.
    writeFileSync(runtime, extractionRuntime(), { mode: 0o700 })
    const bundle = Buffer.from(
      'if(process.env.APPIMAGE_EXTRACT_AND_RUN !== "1") process.exit(72); process.stdout.write(JSON.stringify(process.argv.slice(2)))'
    )
    installMaintenanceLauncher(
      root,
      { path: runtime, sha256: sha256(runtime) },
      bundle
    )
    const result = spawnSync(join(root, 'start'), ['argument with spaces'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        TMPDIR: root,
        ELECTRON_RUN_AS_NODE: '1',
        APPIMAGE_EXTRACT_AND_RUN: '1'
      }
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([root, 'argument with spaces'])
    expect(
      readdirSync(root).filter((name) => name.startsWith('salt-launcher.'))
    ).toEqual([])
    const helper = join(
      root,
      'launchers',
      readdirSync(join(root, 'launchers'))[0]!
    )
    writeFileSync(helper, 'throw new Error("should never execute")')
    const failed = spawnSync(join(root, 'start'), { encoding: 'utf8' })
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('Starthelfer wurde verändert')
  })
  it('refuses changed interpreter bytes without replacing the existing launcher', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt launcher identity-'))
    roots.push(root)
    const runtime = join(root, 'interpreter')
    writeFileSync(runtime, '#!/bin/sh\nexit 0\n', { mode: 0o700 })
    const identity = { path: runtime, sha256: sha256(runtime) }
    installMaintenanceLauncher(root, identity, Buffer.from('first helper'))
    const before = readFileSync(join(root, 'start'))
    writeFileSync(runtime, '#!/bin/sh\nexit 33\n')
    expect(() =>
      installMaintenanceLauncher(root, identity, Buffer.from('second helper'))
    ).toThrow('Laufzeit wurde verändert')
    expect(readFileSync(join(root, 'start'))).toEqual(before)
    expect(spawnSync(join(root, 'start')).status).toBe(1)
  })
})

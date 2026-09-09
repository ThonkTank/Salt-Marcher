import { readAppImageLauncher } from '../../src/shared/maintenance/appimage-launcher.js'
import { installMaintenanceLauncher } from '../../src/shared/maintenance/launcher.js'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
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
    const previous = executable(
      '0.1.99',
      `#!/bin/sh\nexec '${process.execPath}' "$@"\n`
    )
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
  it('quotes installation paths and refuses changed helper bytes', () => {
    const root = mkdtempSync(join(tmpdir(), "salt shared launcher '"))
    roots.push(root)
    const runtime = join(root, 'interpreter')
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
    // Test interpreter only. Real AppImage Node-mode execution is qualified separately.
    writeFileSync(
      runtime,
      `#!/bin/sh\nexec ${quote(process.execPath)} "$@"\n`,
      { mode: 0o700 }
    )
    const bundle = Buffer.from(
      'process.stdout.write(JSON.stringify(process.argv.slice(2)))'
    )
    installMaintenanceLauncher(
      root,
      { path: runtime, sha256: sha256(runtime) },
      bundle
    )
    const result = spawnSync(join(root, 'start'), ['argument with spaces'], {
      encoding: 'utf8'
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([root, 'argument with spaces'])
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

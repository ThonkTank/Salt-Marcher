import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { releaseDeployment } from '../support/release-maintenance.js'
import {
  currentProgram,
  deploymentProgram,
  installLauncher,
  setCurrent
} from '../../src/main/release/deployment.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { durableJson, sha256 } from '../../src/shared/maintenance/files.js'
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
describe('stable release launcher', () => {
  it('uses the authoritative journal fallback only until the transaction is committed', () => {
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
    const previous = executable('0.1.99', '#!/bin/sh\nprintf "%s" "$*"\n')
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
    installLauncher(root)
    coordinator.activate()
    expect(execFileSync(join(root, 'start'), { encoding: 'utf8' })).toBe(
      '--release-recover'
    )
    coordinator.commit(id)
    const result = spawnSync(join(root, 'start'), { encoding: 'utf8' })
    expect(result.status).toBe(47)
    expect(result.stdout).toBe('')
  })
})

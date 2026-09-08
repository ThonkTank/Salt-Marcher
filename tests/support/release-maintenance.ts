import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { durableJson, sha256 } from '../../src/shared/maintenance/files.js'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import {
  currentProgram,
  deploymentProgram,
  setCurrent
} from '../../src/main/release/deployment.js'

/** Identity fixture only; packaged execution is a separate qualification. */
export function releaseDeployment(root: string, version: string): string {
  const id = randomUUID()
  const directory = join(root, 'deployments', id)
  mkdirSync(directory, { recursive: true })
  const path = join(directory, 'SaltMarcher.AppImage')
  writeFileSync(path, version)
  durableJson(
    join(directory, 'manifest.json'),
    releaseManifestSchema.parse({
      formatVersion: 1,
      repository: 'ThonkTank/Salt-Marcher',
      version,
      commit: 'a'.repeat(40),
      platform: 'linux',
      arch: 'x64',
      schemaVersions: { installation: 39, campaign: 34 },
      artifact: {
        name: `SaltMarcher-${version}-x64.AppImage`,
        bytes: Buffer.byteLength(version),
        sha256: sha256(path)
      }
    })
  )
  return id
}

export async function preparedMaintenance(
  maintenance: ProfileMaintenance,
  source?: string,
  boundary?: (name: string) => void
): Promise<MaintenanceCoordinator> {
  const root = maintenance.root
  if (!currentProgram(root)) setCurrent(root, releaseDeployment(root, '0.1.99'))
  const next = releaseDeployment(root, maintenance.version)
  const prepared = await maintenance.prepare(randomUUID(), source)
  const coordinator = new MaintenanceCoordinator(root, boundary)
  coordinator.begin({
    ...prepared,
    operation: source ? 'restore' : 'update',
    previous: currentProgram(root),
    next: deploymentProgram(root, next)
  })
  return coordinator
}

export function acceptMaintenance(
  maintenance: ProfileMaintenance,
  coordinator: MaintenanceCoordinator
): void {
  coordinator.activate()
  maintenance.validate()
  coordinator.commit(coordinator.read()!.id)
}

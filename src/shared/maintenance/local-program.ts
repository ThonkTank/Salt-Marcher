import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { localArtifactManifestSchema } from '../contracts/build-info.js'
import {
  maintenanceProgramSchema,
  type MaintenanceProgram
} from '../contracts/maintenance.js'

export function localProgram(
  root: string,
  deployment: string
): MaintenanceProgram {
  if (!/^[a-f0-9]{64}$/.test(deployment))
    throw new Error('Ungültige Local-Programmkennung.')
  const manifest = localArtifactManifestSchema.parse(
    JSON.parse(
      readFileSync(
        join(root, 'deployments', deployment, 'artifact-manifest.json'),
        'utf8'
      )
    )
  )
  if (manifest.receipt.build.workspaceFingerprint !== deployment)
    throw new Error(
      'Local-Programmordner und Herkunftsnachweis stimmen nicht überein.'
    )
  return maintenanceProgramSchema.parse({
    deployment,
    version: manifest.receipt.build.commit,
    sha256: manifest.artifactSha256
  })
}

export function currentLocalProgram(root: string): MaintenanceProgram | null {
  const current = join(root, 'current')
  const stat = lstatSync(current, { throwIfNoEntry: false })
  if (!stat) return null
  if (!stat.isSymbolicLink()) throw new Error('Ungültiger Local-Startpunkt.')
  const target = readlinkSync(current)
  const deployment = basename(target)
  if (resolve(root, target) !== resolve(root, 'deployments', deployment))
    throw new Error('Der Local-Startpunkt liegt außerhalb der Installation.')
  return localProgram(root, deployment)
}

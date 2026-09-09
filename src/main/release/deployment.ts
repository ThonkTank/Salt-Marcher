import { readAppImageLauncher } from '../../shared/maintenance/appimage-launcher.js'
import { installMaintenanceLauncher } from '../../shared/maintenance/launcher.js'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  maintenanceProgramSchema,
  type MaintenanceProgram
} from '../../shared/contracts/maintenance.js'
import {
  durableJson,
  sha256,
  syncPath
} from '../../shared/maintenance/files.js'
import {
  releaseManifestSchema,
  type ReleaseManifest
} from '../../shared/contracts/release.js'
export function deploymentProgram(
  root: string,
  deployment: string
): MaintenanceProgram {
  const manifest = releaseManifestSchema.parse(
    JSON.parse(
      readFileSync(
        join(root, 'deployments', deployment, 'manifest.json'),
        'utf8'
      )
    )
  )
  return maintenanceProgramSchema.parse({
    deployment,
    version: manifest.version,
    sha256: manifest.artifact.sha256
  })
}
export function currentProgram(root: string): MaintenanceProgram | null {
  const current = join(root, 'current')
  const stat = lstatSync(current, { throwIfNoEntry: false })
  if (!stat) return null
  if (!stat.isSymbolicLink()) throw new Error('Ungültiger Programmstartpunkt.')
  const deployment = basename(readlinkSync(current))
  if (
    resolve(root, readlinkSync(current)) !==
    resolve(root, 'deployments', deployment)
  )
    throw new Error('Der Programmstartpunkt liegt außerhalb der Installation.')
  return deploymentProgram(root, deployment)
}
export function setCurrent(root: string, deployment: string): void {
  const target = join(root, 'deployments', deployment)
  if (
    !/^[0-9a-f-]{36}$/.test(deployment) ||
    !existsSync(join(target, 'SaltMarcher.AppImage'))
  )
    throw new Error('Installierte Programmversion fehlt.')
  const temporary = join(root, `.current-${randomUUID()}`)
  symlinkSync(join('deployments', deployment), temporary)
  renameSync(temporary, join(root, 'current'))
  syncPath(root)
}
export function stageDeployment(
  root: string,
  source: string,
  manifest: ReleaseManifest
): string {
  releaseManifestSchema.parse(manifest)
  if (sha256(source) !== manifest.artifact.sha256)
    throw new Error('AppImage-Prüfsumme stimmt nicht überein.')
  const id = randomUUID()
  const directory = join(root, 'deployments', id)
  mkdirSync(directory, { recursive: true })
  copyFileSync(source, join(directory, 'SaltMarcher.AppImage'))
  chmodSync(join(directory, 'SaltMarcher.AppImage'), 0o700)
  if (
    sha256(join(directory, 'SaltMarcher.AppImage')) !== manifest.artifact.sha256
  )
    throw new Error('Kopierte Programmversion ist beschädigt.')
  durableJson(join(directory, 'manifest.json'), manifest)
  syncPath(join(directory, 'SaltMarcher.AppImage'))
  syncPath(directory)
  syncPath(dirname(directory))
  return id
}
export function installLauncher(
  root: string,
  target: MaintenanceProgram
): void {
  const executable = join(
    root,
    'deployments',
    target.deployment,
    'SaltMarcher.AppImage'
  )
  const bundle = readAppImageLauncher(executable, target.sha256)
  const runtime = currentProgram(root) ?? target
  installMaintenanceLauncher(
    root,
    {
      path: join(
        root,
        'deployments',
        runtime.deployment,
        'SaltMarcher.AppImage'
      ),
      sha256: runtime.sha256
    },
    bundle
  )
  const launcher = join(root, 'start')
  const applications = join(dirname(root), 'applications')
  mkdirSync(applications, { recursive: true })
  const desktopPath = join(applications, 'org.saltmarcher.app.desktop')
  const escaped = launcher
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('`', '\\`')
    .replaceAll('$', '\\$')
    .replaceAll('%', '%%')
  writeFileSync(
    desktopPath,
    `[Desktop Entry]\nType=Application\nName=SaltMarcher\nExec="${escaped}"\nTerminal=false\nCategories=Game;\n`
  )
  syncPath(desktopPath)
  syncPath(applications)
}

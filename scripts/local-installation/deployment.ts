import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  localArtifactManifestSchema,
  shortBuildFingerprint,
  type BuildInfo,
  type LocalArtifactManifest
} from '../../src/shared/contracts/build-info.js'
import { sha256File } from '../file-hash.js'
import type { LocalInstallJournal } from '../local-install-journal.js'
import {
  LocalInstallationError,
  type InstallationReplacement,
  type InstallLocalAppOptions,
  type LocalInstallationPaths
} from './contract.js'

export function stageDeployment(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  options: InstallLocalAppOptions
): string {
  mkdirSync(paths.deployments, { recursive: true })
  const target = join(
    paths.deployments,
    manifest.receipt.build.workspaceFingerprint
  )
  if (existsSync(target)) {
    validateDeployment(target, manifest, options.iconSourcePath)
    return target
  }
  const staging = join(paths.deployments, `.staging-${randomUUID()}`)
  try {
    mkdirSync(staging)
    const appImage = join(staging, 'SaltMarcher.AppImage')
    const icon = join(staging, 'icon.png')
    const artifactManifest = join(staging, 'artifact-manifest.json')
    copyFileSync(options.artifactPath, appImage)
    chmodSync(appImage, 0o755)
    copyFileSync(options.iconSourcePath, icon)
    chmodSync(icon, 0o644)
    writeFileSync(
      artifactManifest,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )
    chmodSync(artifactManifest, 0o644)
    syncPath(appImage)
    syncPath(icon)
    syncPath(artifactManifest)
    syncPath(staging)
    renameSync(staging, target)
    syncPath(paths.deployments)
    return target
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw new LocalInstallationError(
      'atomic-replace-failed',
      'The versioned application deployment could not be staged',
      { cause: error }
    )
  }
}

export function deploymentManifestSha256(deployment: string): string {
  return sha256File(join(deployment, 'artifact-manifest.json'))
}

export function validateDeploymentCheckpoint(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  options: InstallLocalAppOptions,
  journal: LocalInstallJournal
): void {
  if (journal.deploymentPath === null)
    throw new Error('Installation journal has no staged deployment')
  validateDeployment(journal.deploymentPath, manifest, options.iconSourcePath)
  const manifestHash = deploymentManifestSha256(journal.deploymentPath)
  if (journal.deploymentManifestSha256 !== manifestHash)
    throw new Error('Staged deployment manifest hash changed')
  const relativeDeployment = relative(paths.deployments, journal.deploymentPath)
  if (
    relativeDeployment === '' ||
    relativeDeployment.startsWith(`..${sep}`) ||
    relativeDeployment === '..' ||
    isAbsolute(relativeDeployment)
  )
    throw new Error('Staged deployment escaped the deployment root')
}

export function validateCompletedInstallation(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  iconSourcePath: string
): void {
  const deployment = join(
    paths.deployments,
    manifest.receipt.build.workspaceFingerprint
  )
  validateDeployment(deployment, manifest, iconSourcePath)
  if (!currentSelectsDeployment(paths.current, deployment))
    throw new Error(
      'Current installation does not select the staged deployment'
    )
  if (sha256File(paths.appImage) !== manifest.artifactSha256)
    throw new Error('Activated AppImage hash differs from its artifact')
  if (sha256File(paths.icon) !== sha256File(iconSourcePath))
    throw new Error('Activated desktop icon differs from its source')
  if (
    readFileSync(paths.desktopEntry, 'utf8') !==
    renderDesktopEntry(paths, manifest.receipt.build)
  )
    throw new Error('Activated desktop entry differs from its build')
}

export function activationReplacements(
  paths: LocalInstallationPaths,
  deployment: string,
  iconSourcePath: string,
  build: BuildInfo
): readonly InstallationReplacement[] {
  return [
    {
      target: paths.icon,
      source: iconSourcePath,
      mode: 0o644
    },
    {
      target: paths.desktopEntry,
      content: renderDesktopEntry(paths, build),
      mode: 0o644
    },
    {
      target: paths.current,
      symlinkTarget: relative(paths.root, deployment)
    }
  ]
}

export function currentSelectsDeployment(
  current: string,
  deployment: string
): boolean {
  try {
    return (
      resolve(dirname(current), readlinkSync(current)) === resolve(deployment)
    )
  } catch {
    return false
  }
}

function validateDeployment(
  deployment: string,
  manifest: LocalArtifactManifest,
  iconSourcePath: string
): void {
  const storedManifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(join(deployment, 'artifact-manifest.json'), 'utf8'))
  )
  if (
    JSON.stringify(storedManifest) !== JSON.stringify(manifest) ||
    sha256File(join(deployment, 'SaltMarcher.AppImage')) !==
      manifest.artifactSha256 ||
    sha256File(join(deployment, 'icon.png')) !== sha256File(iconSourcePath)
  )
    throw new Error('Existing versioned deployment does not match its build')
}

function renderDesktopEntry(
  paths: LocalInstallationPaths,
  build: BuildInfo
): string {
  const fingerprint = shortBuildFingerprint(build)
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=SaltMarcher Local (${fingerprint})`,
    `Comment=Lokaler SaltMarcher-Testbuild ${fingerprint}`,
    `Exec=${desktopQuote(paths.appImage)} --user-data-dir=${desktopQuote(paths.profile)}`,
    `Icon=${paths.icon}`,
    'Terminal=false',
    'Categories=Game;Utility;',
    'StartupNotify=true',
    ''
  ].join('\n')
}

function desktopQuote(value: string): string {
  return '"' + value.replaceAll(/([\\"`$])/g, '\\$1') + '"'
}

function syncPath(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

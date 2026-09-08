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
export function installLauncher(root: string): void {
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`
  const launcher = join(root, 'start')
  const script = `#!/bin/sh
${quote(join(root, 'current', 'SaltMarcher.AppImage'))} "$@"
salt_status=$?
if [ "$salt_status" -ne 0 ]; then
  salt_journal=$(cat ${quote(join(root, 'maintenance-journal.json'))} 2>/dev/null)
  case "$salt_journal" in
    *'"formatVersion":2'*)
      case "$salt_journal" in
        *'"phase":"committed"'*|*'"phase":"rolled-back"'*) ;;
        *)
          salt_previous=$(printf '%s' "$salt_journal" | sed -n 's/.*"previous":{"deployment":"\\([^" ]*\\)".*/\\1/p')
          case "$salt_previous" in
            ''|*[!a-zA-Z0-9._-]*|.*) ;;
            *) exec ${quote(join(root, 'deployments'))}/"$salt_previous"/SaltMarcher.AppImage --release-recover ;;
          esac ;;
      esac ;;
  esac
fi
exit "$salt_status"
`
  const temporary = `${launcher}.${randomUUID()}.tmp`
  writeFileSync(temporary, script, { mode: 0o700, flag: 'wx' })
  syncPath(temporary)
  renameSync(temporary, launcher)
  syncPath(root)
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

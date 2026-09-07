import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  durableJson,
  sha256,
  syncPath
} from '../../shared/maintenance/files.js'
import {
  releaseManifestSchema,
  type ReleaseManifest
} from '../../shared/contracts/release.js'
export const activationSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    previous: z.uuid().nullable(),
    next: z.uuid(),
    phase: z.enum(['pending', 'committed', 'rolled-back'])
  })
  .strict()
export function readActivation(root: string) {
  const path = join(root, 'activation.json')
  return existsSync(path)
    ? activationSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : null
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
export function beginActivation(root: string, next: string) {
  const previous = existsSync(join(root, 'current'))
    ? readlinkSync(join(root, 'current')).split('/').at(-1)!
    : null
  const state = activationSchema.parse({
    formatVersion: 1,
    id: randomUUID(),
    previous,
    next,
    phase: 'pending'
  })
  durableJson(join(root, 'activation.json'), state)
  return state
}
export function installLauncher(root: string): void {
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`
  const launcher = join(root, 'start')
  const state = readActivation(root)
  const fallback = state?.previous
    ? join(root, 'deployments', state.previous, 'SaltMarcher.AppImage')
    : null
  const script = `#!/bin/sh
${quote(join(root, 'current', 'SaltMarcher.AppImage'))} "$@"
salt_status=$?
if [ "$salt_status" -ne 0 ]; then
  case "$(cat ${quote(join(root, 'activation.json'))} 2>/dev/null)" in
    *'"phase":"pending"'*)
      case "$(cat ${quote(join(root, 'maintenance-journal.json'))} 2>/dev/null)" in
        *'"phase":"committed"'*) ;;
        *) ${fallback ? `exec ${quote(fallback)} --release-recover` : ':'} ;;
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

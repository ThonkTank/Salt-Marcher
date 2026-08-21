import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { localInstallationPaths } from './local-app-installation.js'
import { pruneLocalBackup } from './local-storage/backup-prune.js'

const rawArguments = process.argv.slice(2)
const parsed = parseArguments(
  rawArguments[0] === '--' ? rawArguments.slice(1) : rawArguments
)
const workspaceRoot = process.cwd()
const result = pruneLocalBackup({
  paths: localInstallationPaths(
    process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
  ),
  iconSourcePath: resolve(
    workspaceRoot,
    'resources',
    'icons',
    'salt-marcher.png'
  ),
  backup: parsed.backup,
  ...(parsed.confirmManifestSha === undefined
    ? {}
    : { confirmManifestSha: parsed.confirmManifestSha })
})
console.info(JSON.stringify(result, null, 2))
if (result.refusal !== null) process.exitCode = 1

function parseArguments(arguments_: readonly string[]): {
  readonly backup: string
  readonly confirmManifestSha?: string
} {
  let backup: string | undefined
  let confirmManifestSha: string | undefined
  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index]
    const value = arguments_[index + 1]
    if (value === undefined)
      throw new Error(
        'Usage: local-storage:prune -- --backup <name> [--confirm-manifest-sha <sha>]'
      )
    if (option === '--backup' && backup === undefined) backup = value
    else if (
      option === '--confirm-manifest-sha' &&
      confirmManifestSha === undefined
    )
      confirmManifestSha = value
    else throw new Error(`Unsupported or repeated option: ${option}`)
  }
  if (backup === undefined)
    throw new Error(
      'Usage: local-storage:prune -- --backup <name> [--confirm-manifest-sha <sha>]'
    )
  return {
    backup,
    ...(confirmManifestSha === undefined ? {} : { confirmManifestSha })
  }
}

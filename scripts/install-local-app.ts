import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  advanceLocalAppInstallation,
  localInstallationTargets,
  type LocalInstallationTarget
} from './local-app-installation.js'
import { shortBuildFingerprint } from '../src/shared/contracts/build-info.js'

const workspaceRoot = process.cwd()
const packageJson = JSON.parse(
  readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')
) as { version?: unknown }
if (typeof packageJson.version !== 'string')
  throw new Error('package.json does not contain a version')
const artifactPath = resolve(
  workspaceRoot,
  'release',
  'local',
  `SaltMarcher-Local-${packageJson.version}.AppImage`
)
const target = parseTarget(process.argv.slice(2))
const result = advanceLocalAppInstallation(
  {
    workspaceRoot,
    xdgDataHome:
      process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share'),
    artifactPath,
    artifactManifestPath: `${artifactPath}.manifest.json`,
    iconSourcePath: resolve(
      workspaceRoot,
      'resources',
      'icons',
      'salt-marcher.png'
    )
  },
  target
)
console.info(
  JSON.stringify({
    component: 'local-installer',
    event: target,
    appImage: result.paths.appImage,
    profile: result.paths.profile,
    fingerprint: shortBuildFingerprint(result.build),
    backup: result.backupPath ?? null,
    backupManifestSha256: result.backupManifestSha256 ?? null,
    deployment: result.deploymentPath ?? null,
    deploymentManifestSha256: result.deploymentManifestSha256 ?? null,
    installedSha256: result.installedSha256 ?? null
  })
)

function parseTarget(arguments_: readonly string[]): LocalInstallationTarget {
  if (arguments_.length === 0) return 'activated'
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--through' ||
    !localInstallationTargets.includes(arguments_[1] as LocalInstallationTarget)
  )
    throw new Error(
      `Usage: install-local-app.ts [--through ${localInstallationTargets.join('|')}]`
    )
  return arguments_[1] as LocalInstallationTarget
}

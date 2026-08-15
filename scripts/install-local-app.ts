import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { installLocalApp } from './local-app-installation.js'
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
const result = installLocalApp({
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
})
console.info(
  JSON.stringify({
    component: 'local-installer',
    event: 'installed',
    appImage: result.paths.appImage,
    profile: result.paths.profile,
    fingerprint: shortBuildFingerprint(result.build),
    backup: result.backupPath ?? null
  })
)

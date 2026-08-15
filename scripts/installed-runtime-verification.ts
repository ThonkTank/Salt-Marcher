import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { localArtifactManifestSchema } from '../src/shared/contracts/build-info.js'
import {
  isInstalledLocalAppRunning,
  localInstallationPaths
} from './local-app-installation.js'
import { readFileSync } from 'node:fs'

const paths = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
const manifest = localArtifactManifestSchema.parse(
  JSON.parse(readFileSync(paths.installedManifest, 'utf8'))
)
const result = spawnSync(
  paths.appImage,
  [
    '--smoke-test',
    '--session-generation-smoke',
    '--installed-runtime-verification',
    '--no-sandbox',
    `--user-data-dir=${paths.profile}`
  ],
  {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }
  }
)
if (result.error) throw result.error
if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.stdout.write(result.stdout)
  throw new Error(`Installed AppImage exited with ${result.status}`)
}

const records = `${result.stdout}\n${result.stderr}`
  .split(/\r?\n/)
  .flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, unknown>]
    } catch {
      return []
    }
  })
const verification = records.filter(
  (record) => record['component'] === 'installed-runtime-verification'
)
if (verification.length !== 1)
  throw new Error(
    `Expected one runtime verification record, found ${verification.length}`
  )
const evidence = verification[0]!
const expectedFingerprint = manifest.receipt.build.workspaceFingerprint.slice(
  0,
  12
)
if (evidence['windowTitle'] !== `SaltMarcher Local · ${expectedFingerprint}`)
  throw new Error(
    'Installed window title does not contain the current fingerprint'
  )
const runtime = evidence['runtime'] as
  | {
      generation?: unknown
      status?: unknown
      utility?: { bootstrap?: { totalMs?: unknown; phases?: unknown } }
    }
  | undefined
if (runtime?.generation !== 1 || runtime.status !== 'ready')
  throw new Error('Installed utility did not reach ready in generation one')
const bootstrap = runtime.utility?.bootstrap
if (typeof bootstrap?.totalMs !== 'number' || bootstrap.totalMs > 5_000)
  throw new Error('Installed utility exceeded the 5000ms bootstrap budget')
const phaseBudgets: Readonly<Record<string, number>> = {
  configuration: 250,
  'campaign-store': 2_000,
  'generator-presets': 500,
  'session-generation-catalog': 2_000,
  recovery: 1_000
}
for (const [phase, duration] of Object.entries(
  (bootstrap.phases ?? {}) as Record<string, unknown>
)) {
  const budget = phaseBudgets[phase]
  if (
    budget !== undefined &&
    (typeof duration !== 'number' || duration > budget)
  )
    throw new Error(`Installed utility exceeded the ${phase} bootstrap budget`)
}
if (isInstalledLocalAppRunning(paths.appImage))
  throw new Error(
    'Installed SaltMarcher process remained active after verification'
  )

console.info(
  JSON.stringify({
    component: 'installed-runtime-verification',
    event: 'passed',
    artifactSha256: manifest.artifactSha256,
    fingerprint: manifest.receipt.build.workspaceFingerprint,
    bootstrap
  })
)

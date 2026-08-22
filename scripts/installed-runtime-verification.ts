import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import Database from 'better-sqlite3'
import {
  localArtifactManifestSchema,
  shortBuildFingerprint
} from '../src/shared/contracts/build-info.js'
import { preflightPersistence } from '../src/core/persistence/sqlite/persistence-preflight.js'
import { installedRuntimeEvidenceSchema } from './delivery-contract.js'
import { sha256File } from './file-hash.js'
import {
  isInstalledLocalAppRunning,
  localInstallationPaths
} from './local-app-installation.js'
import { atomicWrite } from './safe-file-write.js'

const paths = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
const evidencePath = parseEvidencePath(process.argv.slice(2))
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
const expectedFingerprint = shortBuildFingerprint(manifest.receipt.build)
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

const preflight = preflightPersistence(paths.campaignData)
if (preflight.kind !== 'ready' || preflight.databases.length === 0)
  throw new Error('Installed profile does not contain ready campaign data')
const installationPath = join(paths.campaignData, 'installation.sqlite')
if (!existsSync(installationPath))
  throw new Error('Installed profile has no installation database')
const database = new Database(installationPath, {
  readonly: true,
  fileMustExist: true
})
let readyCampaignCount: number
let activeCampaignId: string | null
let activeCampaignExists: boolean
try {
  readyCampaignCount = (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM campaigns WHERE status = 'ready' AND trashed_at IS NULL"
      )
      .get() as { count: number }
  ).count
  activeCampaignId =
    (
      database
        .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
        .get() as { value: string } | undefined
    )?.value ?? null
  activeCampaignExists =
    activeCampaignId !== null &&
    database
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .get(activeCampaignId) !== undefined
} finally {
  database.close()
}
const domainReadbacks = [
  {
    name: 'installation.readyCampaignCount',
    expected: 'at least 1',
    actual: readyCampaignCount,
    passed: readyCampaignCount >= 1
  },
  {
    name: 'installation.activeCampaign',
    expected: 'existing ready campaign',
    actual: activeCampaignId,
    passed: activeCampaignExists
  },
  ...preflight.databases.map((entry) => ({
    name: `schema.${entry.role}.${relative(paths.campaignData, entry.path)}`,
    expected: entry.expectedVersion,
    actual: entry.schemaVersion,
    passed: entry.schemaVersion === entry.expectedVersion
  }))
]
if (domainReadbacks.some(({ passed }) => !passed))
  throw new Error('Installed campaign domain readback failed')

const persisted = installedRuntimeEvidenceSchema.parse({
  artifactSha256: manifest.artifactSha256,
  manifestSha256: sha256File(paths.installedManifest),
  utilityReady: true,
  generation: runtime.generation,
  bootstrap,
  quickChecks: preflight.databases.map((entry) => ({
    path: relative(paths.campaignData, entry.path),
    role: entry.role,
    result: 'ok'
  })),
  domainReadbacks
})
atomicWrite(evidencePath, `${JSON.stringify(persisted, null, 2)}\n`)

function parseEvidencePath(arguments_: readonly string[]): string {
  if (arguments_.length === 0)
    return join(
      process.cwd(),
      '.tmp',
      'handoff-local-app',
      'installed-runtime-evidence.json'
    )
  if (
    arguments_.length === 2 &&
    arguments_[0] === '--evidence-path' &&
    arguments_[1] !== undefined
  )
    return resolve(arguments_[1])
  throw new Error(
    'Usage: installed-runtime-verification.ts [--evidence-path <path>]'
  )
}

console.info(
  JSON.stringify({
    component: 'installed-runtime-verification',
    event: 'passed',
    artifactSha256: manifest.artifactSha256,
    fingerprint: manifest.receipt.build.workspaceFingerprint,
    bootstrap,
    quickChecks: persisted.quickChecks.length,
    domainReadbacks: persisted.domainReadbacks.length
  })
)

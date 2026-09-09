import { createServer } from 'node:http'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { stageDeployment, setCurrent } from '../src/main/release/deployment.js'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { ProfileMaintenance } from '../src/core/maintenance/profile-maintenance.js'
import { durableJson } from '../src/shared/maintenance/files.js'
const baselineDirectory = resolve(process.argv[2] ?? 'release/baseline')
const targetDirectory = resolve(process.argv[3] ?? 'release/release')
const baseline = releaseManifestSchema.parse(
  JSON.parse(
    readFileSync(join(baselineDirectory, 'release-manifest.json'), 'utf8')
  )
)
const target = releaseManifestSchema.parse(
  JSON.parse(
    readFileSync(join(targetDirectory, 'release-manifest.json'), 'utf8')
  )
)
if (baseline.version === target.version)
  throw new Error('Qualification needs two differently versioned AppImages')
const workspace = mkdtempSync(join(tmpdir(), 'salt-release-qualification-'))
const root = join(workspace, 'salt-marcher')
mkdirSync(root)
const baselineId = stageDeployment(
  root,
  join(baselineDirectory, baseline.artifact.name),
  baseline
)
setCurrent(root, baselineId)
const data = join(root, 'profile', 'campaign-data')
const server = createServer((request, response) => {
  if (request.url?.endsWith('/releases/latest')) {
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        tag_name: `v${target.version}`,
        draft: false,
        prerelease: false,
        body: 'Qualification update',
        assets: ['release-manifest.json', target.artifact.name].map((name) => ({
          name,
          browser_download_url: `https://github.com/${releaseRepository}/releases/download/v${target.version}/${name}`
        }))
      })
    )
  } else if (request.url?.endsWith('/release-manifest.json'))
    response.end(JSON.stringify(target))
  else if (request.url?.endsWith(`/${target.artifact.name}`))
    createReadStream(join(targetDirectory, target.artifact.name)).pipe(response)
  else {
    response.statusCode = 404
    response.end()
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
if (!address || typeof address === 'string')
  throw new Error('No qualification feed')
const env = {
  ...process.env,
  XDG_DATA_HOME: workspace,
  SALT_MARCHER_E2E: 'true',
  SALT_MARCHER_RELEASE_QUALIFICATION: 'true',
  SALT_MARCHER_RELEASE_TEST_FEED: `http://127.0.0.1:${address.port}`,
  APPIMAGE_EXTRACT_AND_RUN: '1'
}
async function run(arguments_: string[], expectedVersion = target.version) {
  console.info(`Packaged qualification: ${arguments_.join(' ')}`)
  rmSync(join(root, 'qualification-result.json'), { force: true })
  const child = spawn(
    join(root, 'current', 'SaltMarcher.AppImage'),
    ['--release-qualification', ...arguments_],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let log = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    log = (log + chunk.toString()).slice(-16_000)
  })
  let launchError: Error | undefined
  child.once('error', (error) => {
    launchError = error
  })
  const deadline = Date.now() + 180_000
  while (!existsSync(join(root, 'qualification-result.json'))) {
    if (launchError) throw launchError
    if (Date.now() > deadline) {
      child.kill()
      throw new Error(`Packaged update timed out: ${log}`)
    }
    await delay(250)
  }
  const result = JSON.parse(
    readFileSync(join(root, 'qualification-result.json'), 'utf8')
  ) as { ok: boolean; version?: string; message?: string }
  if (!result.ok || result.version !== expectedVersion)
    throw new Error(`Packaged update failed: ${result.message ?? log}`)
  // Completion is recorded before normal Electron teardown releases the profile.
  while (existsSync(join(root, 'runtime.lock'))) {
    if (Date.now() > deadline) throw new Error('Updated app did not close')
    await delay(100)
  }
}
try {
  await run(['seed'], baseline.version)
  writeFileSync(join(data, 'acceptance.txt'), 'vor dem Update')
  await run(['update'])
  if (readFileSync(join(data, 'acceptance.txt'), 'utf8') !== 'vor dem Update')
    throw new Error('Update changed campaign content')
  const reader = new CampaignStore(data)
  if (reader.list().campaigns[0]?.name !== 'Update-Abnahme')
    throw new Error('Campaign failed readback')
  reader.close()
  const backups = new ProfileMaintenance(root, target.version).backups()
  if (!backups[0]?.valid) throw new Error('No verified pre-update backup')
  writeFileSync(join(data, 'acceptance.txt'), 'nach dem Update')
  await run(['restore', backups[0].id])
  if (readFileSync(join(data, 'acceptance.txt'), 'utf8') !== 'vor dem Update')
    throw new Error('Restoration failed')
  durableJson(join(targetDirectory, 'update-qualification.json'), {
    formatVersion: 1,
    baselineVersion: baseline.version,
    targetVersion: target.version,
    appimageSha256: target.artifact.sha256,
    completedAt: new Date().toISOString(),
    scenarios: [
      'check',
      'download',
      'install',
      'restart',
      'campaign-readback',
      'backup-restore'
    ]
  })
} finally {
  server.close()
  rmSync(workspace, { recursive: true, force: true })
}

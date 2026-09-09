import { readVerifiedBackup } from '../src/core/maintenance/verified-backup.js'
import { cpSync } from 'node:fs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  createReadStream,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import {
  readHistoricalArtifact,
  runHistoricalArtifact,
  copyHistoricalWorkingProfile
} from './qualification/historical-artifact-runner.js'
import {
  HistoricalUiDriver,
  isolatedProcesses,
  waitFor
} from './qualification/historical-ui-driver.js'
import {
  stageDeployment,
  setCurrent,
  currentProgram
} from '../src/main/release/deployment.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    target: { type: 'string' },
    home: { type: 'string' }
  }
})
const baselineDirectory = resolve(z.string().parse(values.baseline))
const targetDirectory = resolve(z.string().parse(values.target))
const home = resolve(z.string().parse(values.home))
const sourceHome = `${home}-source`
const baseline = readHistoricalArtifact(baselineDirectory)
const target = readHistoricalArtifact(targetDirectory)
assert.deepEqual(baseline.receipt.source.schemaVersions, {
  installation: 42,
  campaign: 41
})
assert.deepEqual(target.receipt.source.schemaVersions, {
  installation: 42,
  campaign: 42
})
assert.notEqual(baseline.receipt.version, target.receipt.version)
const manifest = (artifact: typeof baseline) =>
  releaseManifestSchema.parse({
    formatVersion: 1,
    repository: releaseRepository,
    version: artifact.receipt.version,
    commit: artifact.receipt.source.commit,
    platform: 'linux',
    arch: 'x64',
    schemaVersions: artifact.receipt.source.schemaVersions,
    artifact: artifact.receipt.artifact
  })
const seeded = await runHistoricalArtifact(
  baselineDirectory,
  sourceHome,
  'seed'
)
assert(seeded.result.response.ok)
copyHistoricalWorkingProfile(sourceHome, home)
const root = join(home, 'salt-marcher')
const originalDeployment = stageDeployment(
  root,
  baseline.executable,
  manifest(baseline)
)
setCurrent(root, originalDeployment)
const requests: string[] = []
const server = createServer((request, response) => {
  requests.push(request.url ?? '')
  if (request.url === `/repos/${releaseRepository}/releases/latest`) {
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        tag_name: `v${target.receipt.version}`,
        draft: false,
        prerelease: false,
        body: 'Geprüfter UI-Test mit Schemawechsel 41→42',
        assets: ['release-manifest.json', target.receipt.artifact.name].map(
          (name) => ({
            name,
            browser_download_url: `https://github.com/${releaseRepository}/releases/download/v${target.receipt.version}/${name}`
          })
        )
      })
    )
  } else if (
    request.url ===
    `/${releaseRepository}/releases/download/v${target.receipt.version}/release-manifest.json`
  )
    response.end(JSON.stringify(manifest(target)))
  else if (
    request.url ===
    `/${releaseRepository}/releases/download/v${target.receipt.version}/${target.receipt.artifact.name}`
  )
    createReadStream(target.executable).pipe(response)
  else {
    response.statusCode = 404
    response.end()
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address !== 'string')
let ui: HistoricalUiDriver | undefined
const exits: Array<Promise<number | null>> = []
async function launch(): Promise<HistoricalUiDriver> {
  const temporary = join(home, `ui-launch-${exits.length}`)
  mkdirSync(temporary)
  const log = openSync(join(home, `ui-launch-${exits.length}.log`), 'wx')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_DATA_HOME: home,
    TMPDIR: temporary,
    APPIMAGE_EXTRACT_AND_RUN: '1',
    SALT_MARCHER_HISTORICAL_UI: 'true',
    SALT_MARCHER_HISTORICAL_UI_FEED: `http://127.0.0.1:${address && typeof address !== 'string' ? address.port : 0}`
  }
  delete env['ELECTRON_RUN_AS_NODE']
  const child = spawn(
    join(root, 'current/SaltMarcher.AppImage'),
    ['--no-sandbox'],
    { env, stdio: ['ignore', log, log] }
  )
  closeSync(log)
  exits.push(
    new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
  )
  return HistoricalUiDriver.connect(home)
}
try {
  ui = await launch()
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${baseline.receipt.version}`)
  assert(
    !requests.some((path) => path.endsWith('.AppImage')),
    'Startup must not download'
  )
  await ui.click('Jetzt prüfen')
  await ui.expectText(`Version ${target.receipt.version}`)
  assert(
    !requests.some((path) => path.endsWith('.AppImage')),
    'Checking must not download'
  )
  await ui.click('Herunterladen')
  await ui.expectText('Installieren und neu starten')
  assert.equal(
    currentProgram(root)?.deployment,
    originalDeployment,
    'Download must not activate'
  )
  assert.equal(new MaintenanceCoordinator(root).read(), null)
  await ui.click('Installieren und neu starten')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  const updated = await waitFor(
    () => new MaintenanceCoordinator(root).read(),
    (state) => state?.phase === 'committed',
    'target restart commits update'
  )
  assert(updated)
  assert.equal(updated.next.version, target.receipt.version)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${target.receipt.version}`)
  await ui.closeApplication(home)
  ui = undefined
  const after = await runHistoricalArtifact(targetDirectory, home, 'read')
  assert(after.result.response.ok)
  assert.deepEqual(after.result.response.result, seeded.result.response.result)
  ui = await launch()
  const continuedAtStart = Date.now()
  await ui.click('Fortsetzen')
  await ui.click('Charaktere', '.desktop-toolbar')
  await ui.click('XP', '[data-window-id="characters"] tbody')
  await ui.fill('.desktop-xp-popup input', '25')
  await ui.click('+', '.desktop-xp-popup')
  await ui.expectText('XP 1000 /')
  await ui.closeApplication(home)
  ui = undefined
  const continued = await runHistoricalArtifact(targetDirectory, home, 'read')
  assert(continued.result.response.ok)
  const member = z
    .object({
      name: z.string(),
      xp: z.number(),
      xpSinceShortRest: z.number(),
      xpSinceLongRest: z.number()
    })
    .passthrough()
  const party = z
    .object({ revision: z.number(), members: z.array(member) })
    .passthrough()
  const expected = z
    .object({
      registry: z
        .object({
          activeCampaignId: z.string(),
          campaigns: z.array(
            z
              .object({
                id: z.string(),
                lastOpenedAt: z.iso.datetime().nullable()
              })
              .passthrough()
          )
        })
        .passthrough(),
      campaigns: z.array(
        z
          .object({
            id: z.string(),
            party,
            game: z
              .object({ session: z.object({ party }).passthrough() })
              .passthrough()
          })
          .passthrough()
      )
    })
    .passthrough()
    .parse(structuredClone(after.result.response.result))
  const observedRegistry = z
    .object({
      registry: z.object({
        campaigns: z.array(
          z.object({
            id: z.string(),
            lastOpenedAt: z.iso.datetime().nullable()
          })
        )
      })
    })
    .parse(continued.result.response.result).registry
  const observedOpenedAt = observedRegistry.campaigns.find(
    (campaign) => campaign.id === expected.registry.activeCampaignId
  )?.lastOpenedAt
  assert(observedOpenedAt)
  assert(
    Date.parse(observedOpenedAt) >= continuedAtStart &&
      Date.parse(observedOpenedAt) <= Date.now()
  )
  const expectedEntry = expected.registry.campaigns.find(
    (campaign) => campaign.id === expected.registry.activeCampaignId
  )
  assert(expectedEntry)
  expectedEntry.lastOpenedAt = observedOpenedAt
  const active = expected.campaigns.find(
    (campaign) => campaign.id === expected.registry.activeCampaignId
  )
  assert(active)
  for (const roster of [active.party, active.game.session.party]) {
    roster.revision += 1
    assert.equal(roster.members.length, 1)
    const character = roster.members[0]!
    assert.equal(character.name, 'Mara 1')
    assert.equal(character.xp, 975)
    character.xp += 25
  }
  assert.deepEqual(continued.result.response.result, expected)
  ui = await launch()
  await ui.click('Einstellungen', 'body', true)
  await ui.click('Wiederherstellen')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  const restoredTransaction = await waitFor(
    () => new MaintenanceCoordinator(root).read(),
    (state) =>
      state?.id !== updated.id &&
      state?.operation === 'restore' &&
      state.phase === 'committed',
    'restore commits after restart'
  )
  assert(restoredTransaction?.backup)
  assert.equal(restoredTransaction.next.sha256, target.receipt.artifact.sha256)
  assert.equal(
    restoredTransaction.previous?.deployment,
    updated.next.deployment
  )
  assert.equal(restoredTransaction.next.deployment, updated.next.deployment)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${target.receipt.version}`)
  await ui.closeApplication(home)
  ui = undefined
  const restored = await runHistoricalArtifact(targetDirectory, home, 'read')
  assert(restored.result.response.ok)
  assert.deepEqual(
    restored.result.response.result,
    seeded.result.response.result
  )
  const backupDirectory = join(root, 'backups', restoredTransaction.backup)
  const protectedBackup = readVerifiedBackup(backupDirectory)
  assert.equal(protectedBackup.manifest.formatVersion, 2)
  const savedHome = `${home}-protected-work`
  mkdirSync(join(savedHome, 'salt-marcher'), { recursive: true })
  cpSync(protectedBackup.data, join(savedHome, 'salt-marcher/profile'), {
    recursive: true,
    errorOnExist: true,
    force: false
  })
  const protectedRead = await runHistoricalArtifact(
    targetDirectory,
    savedHome,
    'read'
  )
  assert(protectedRead.result.response.ok)
  assert.deepEqual(
    protectedRead.result.response.result,
    continued.result.response.result
  )
  assert.equal(
    readVerifiedBackup(backupDirectory).manifestSha256,
    protectedBackup.manifestSha256
  )
  const unchanged = await runHistoricalArtifact(
    baselineDirectory,
    sourceHome,
    'read'
  )
  assert(unchanged.result.response.ok)
  assert.deepEqual(
    unchanged.result.response.result,
    seeded.result.response.result
  )
  assert((await Promise.all(exits)).every((code) => code === 0))
  readHistoricalArtifact(baselineDirectory)
  readHistoricalArtifact(targetDirectory)
  writeFileSync(
    join(home, 'ui-update-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        coverage:
          'ui-check-download-install-restart-continue-restore-protected-work',
        baseline: baseline.receipt,
        target: target.receipt,
        requests,
        transaction: updated,
        seeded,
        after,
        continued,
        restoredTransaction,
        restored,
        protectedBackup,
        protectedRead,
        unchanged
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
  console.info(`UI update and complete profile readback passed: ${home}`)
} finally {
  ui?.disconnect()
  const processes = isolatedProcesses(home)
  for (const pid of processes) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* Already exited. */
    }
  }
  await waitFor(
    () => isolatedProcesses(home),
    (pids) => pids.length === 0,
    'isolated cleanup completed'
  )
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}

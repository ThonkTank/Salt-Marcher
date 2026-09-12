import {
  readUpdateArtifact,
  type UpdateArtifact
} from './qualification/update-artifact.js'
import { runUpdateArtifact } from './qualification/update-artifact-runner.js'
import { prepareReleaseTestHome } from './qualification/release-test-home.js'
import {
  readPartyHistoryEvidence,
  assertPartyHistoryMigration,
  assertPartyHistoryXp
} from './qualification/historical-party-history-evidence.js'
import {
  partyHistoryScenario,
  withPartyHistoryDefaults
} from './qualification/historical-party-history-scenario.js'
import { createNewerFormatBackup } from './qualification/historical-newer-backup.js'
import {
  inventory,
  directoryInventory
} from '../src/shared/maintenance/files.js'
import { withPartyQuickFieldDefault } from './qualification/historical-settings-expectation.js'
import { rejectHistoricalParallelStart } from './qualification/historical-parallel-start.js'
import { acquireProfileAccess } from '../src/main/local-profile/profile-access.js'
import {
  moveHistoricalInstallationToVolume,
  constrainHistoricalSpace
} from './qualification/historical-space-fixture.js'
import { prepareHistoricalWal } from './qualification/historical-wal-fixture.js'
import { createHash, randomUUID } from 'node:crypto'
import { Transform } from 'node:stream'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import { existsSync, readFileSync, rmSync, readdirSync } from 'node:fs'
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
import { copyHistoricalWorkingProfile } from './qualification/historical-artifact-runner.js'
import {
  HistoricalUiDriver,
  trackIsolatedProcess,
  isolatedProcesses,
  waitFor
} from './qualification/historical-ui-driver.js'
import {
  stageDeployment,
  deploymentProgram,
  setCurrent,
  currentProgram
} from '../src/main/release/deployment.js'
import { maintenanceJournalSchema } from '../src/shared/contracts/maintenance.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import { readAppImageLauncher } from '../src/shared/maintenance/appimage-launcher.js'
import {
  installMaintenanceLauncher,
  validateMaintenanceLauncher
} from '../src/shared/maintenance/launcher.js'
import { releaseRepository } from '../src/shared/contracts/release.js'

assertHistoricalTestIsolation()

const { values } = parseArgs({
  options: {
    'space-volume': { type: 'string' },
    'space-exhausted': { type: 'boolean', default: false },
    'space-actionable': { type: 'boolean', default: false },
    wal: { type: 'boolean', default: false },
    'newer-backup': { type: 'boolean', default: false },
    'restore-protected-history': { type: 'boolean', default: false },
    'party-history-scenario': { type: 'string' },
    'same-schema': { type: 'boolean', default: false },
    'target-party-quick-fields-default': { type: 'boolean', default: false },
    'parallel-starts': { type: 'boolean', default: false },
    'feed-failures': { type: 'boolean', default: false },
    'feed-actionable': { type: 'boolean', default: false },
    'transport-failures': { type: 'boolean', default: false },
    'accepted-crash': { type: 'boolean', default: false },
    'commit-crash': { type: 'boolean', default: false },
    'launcher-recovery-observer': { type: 'string' },
    'installed-launcher': { type: 'boolean', default: false },
    'maintenance-crash': { type: 'boolean', default: false },
    'activation-crash': { type: 'string' },
    'recovery-crash': { type: 'string' },
    baseline: { type: 'string' },
    'profile-fixture': { type: 'string' },
    target: { type: 'string' },
    home: { type: 'string' }
  }
})
if (values['same-schema'] && values['maintenance-crash'])
  throw new Error(
    'A migration interruption requires an actual schema transition'
  )
if (values['feed-actionable'] && !values['feed-failures'])
  throw new Error('Actionable feed checks require --feed-failures')
if (values['recovery-crash'] && !values['activation-crash'])
  throw new Error(
    'Recovery interruption requires a preceding activation interruption'
  )
if (
  values['installed-launcher'] &&
  values['recovery-crash'] &&
  !values['launcher-recovery-observer']
)
  throw new Error(
    'The Main crash observer cannot interrupt the standalone launcher'
  )
if (
  values['launcher-recovery-observer'] &&
  (!values['installed-launcher'] || !values['recovery-crash'])
)
  throw new Error(
    'Launcher observer requires installed-launcher recovery interruption'
  )
const launcherObserver = values['launcher-recovery-observer']
  ? {
      path: resolve(values['launcher-recovery-observer']),
      sha256: createHash('sha256')
        .update(readFileSync(resolve(values['launcher-recovery-observer'])))
        .digest('hex')
    }
  : null
const baselineDirectory = resolve(z.string().parse(values.baseline))
const targetDirectory = resolve(z.string().parse(values.target))
const home = resolve(z.string().parse(values.home))
const sourceHome = `${home}-source`
const baseline = readUpdateArtifact(baselineDirectory)
const target = readUpdateArtifact(targetDirectory)
const profileFixtureDirectory = values['profile-fixture']
  ? resolve(values['profile-fixture'])
  : undefined
if (baseline.kind === 'release') {
  assert(
    profileFixtureDirectory,
    'Release baseline requires an explicit historical profile fixture'
  )
  assert.equal(target.kind, 'release')
  assert(
    !values['activation-crash'] && !values['recovery-crash'],
    'Early interruption hooks require a historical baseline'
  )
} else
  assert(
    !profileFixtureDirectory,
    'Historical baseline already owns its fixture'
  )
const seedDirectory = profileFixtureDirectory ?? baselineDirectory
const profileFixture = readUpdateArtifact(seedDirectory)
assert.equal(profileFixture.kind, 'historical-fixture')
assert.deepEqual(
  profileFixture.manifest.schemaVersions,
  baseline.manifest.schemaVersions,
  'Fixture must match baseline data formats'
)
if (
  target.kind === 'release' &&
  (values['maintenance-crash'] || values['commit-crash'])
)
  throw new Error(
    'These interruption hooks exist only in historical fixtures; no release target evidence may claim them.'
  )
const historyScenario = values['party-history-scenario']
  ? partyHistoryScenario(values['party-history-scenario'])
  : undefined
assert(!historyScenario || !values['same-schema'], 'Choose one schema scenario')
assert(
  !values['restore-protected-history'] || historyScenario,
  'Protected history restore requires a Party history scenario'
)
assert(
  !values['maintenance-crash'] ||
    values['party-history-scenario'] !== 'same-schema',
  'Migration interruption requires a schema transition'
)
assert.deepEqual(
  baseline.manifest.schemaVersions,
  historyScenario?.baseline ?? {
    installation: 42,
    campaign: values['same-schema'] ? 42 : 41
  }
)
assert.deepEqual(
  target.manifest.schemaVersions,
  historyScenario?.target ?? {
    installation: 42,
    campaign: 42
  }
)
assert.notEqual(baseline.manifest.version, target.manifest.version)
const manifest = (artifact: UpdateArtifact) => artifact.manifest
assert(
  !values['space-exhausted'] || values['space-volume'],
  'space-exhausted requires an isolated volume'
)
const fixtureSeeded = await runUpdateArtifact(seedDirectory, sourceHome, 'seed')
assert(fixtureSeeded.result.response.ok)
const fixtureHistory = historyScenario
  ? readPartyHistoryEvidence(join(sourceHome, 'salt-marcher/profile'))
  : null
const baselineIdentity =
  baseline.kind === 'release'
    ? await runUpdateArtifact(baselineDirectory, sourceHome, 'identity')
    : undefined
const seeded =
  baseline.kind === 'release'
    ? await runUpdateArtifact(baselineDirectory, sourceHome, 'read')
    : fixtureSeeded
assert(seeded.result.response.ok)
assert.deepEqual(
  seeded.result.response.result,
  fixtureSeeded.result.response.result,
  'Release baseline must read the complete unchanged fixture'
)
const sourceHistory = historyScenario
  ? readPartyHistoryEvidence(join(sourceHome, 'salt-marcher/profile'))
  : null
assert.deepEqual(sourceHistory, fixtureHistory)
const expectedTargetSeed = historyScenario
  ? withPartyHistoryDefaults(seeded.result.response.result)
  : values['target-party-quick-fields-default']
    ? withPartyQuickFieldDefault(seeded.result.response.result)
    : seeded.result.response.result
copyHistoricalWorkingProfile(sourceHome, home)
const releaseTestHome =
  target.kind === 'release' ? prepareReleaseTestHome(home) : null
const targetIdentity =
  target.kind === 'release'
    ? await runUpdateArtifact(targetDirectory, home, 'identity')
    : null
if (targetIdentity) assert(targetIdentity.result.response.ok)
const root = join(home, 'salt-marcher')
if (values['space-volume'])
  moveHistoricalInstallationToVolume(root, values['space-volume'])
const originalDeployment = stageDeployment(
  root,
  baseline.executable,
  manifest(baseline)
)
if (!values['installed-launcher']) setCurrent(root, originalDeployment)
if (values['installed-launcher']) {
  installMaintenanceLauncher(
    root,
    { path: baseline.executable, sha256: baseline.manifest.artifact.sha256 },
    readAppImageLauncher(baseline.executable, baseline.manifest.artifact.sha256)
  )
  validateMaintenanceLauncher(root)
}
const requests: string[] = []
const feedFailures = [
  {
    mode: 'manifest-origin',
    expected: 'Update-Datei stammt nicht aus dem freigegebenen Repository.'
  },
  {
    mode: 'artifact-origin',
    expected: 'Update-Datei stammt nicht aus dem freigegebenen Repository.'
  },
  { mode: 'repository', expected: 'repository' },
  { mode: 'architecture', expected: 'arch' },
  { mode: 'manifest-format', expected: 'formatVersion' },
  { mode: 'version', expected: 'Release-Version stimmt nicht überein.' }
] as const
let transportMode:
  | 'healthy'
  | 'offline'
  | 'corrupt'
  | 'truncated'
  | (typeof feedFailures)[number]['mode'] = values['transport-failures']
  ? 'offline'
  : 'healthy'
const feedRejections: unknown[] = []

const transportFailures: Array<{ mode: string; readback: unknown }> = []
const server = createServer((request, response) => {
  requests.push(request.url ?? '')
  if (transportMode === 'offline') {
    response.statusCode = 503
    response.end('temporarily unavailable')
    return
  }
  if (request.url === `/repos/${releaseRepository}/releases/latest`) {
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        tag_name: `v${target.manifest.version}`,
        draft: false,
        prerelease: false,
        body: `UI-Test mit Kampagnenschema ${baseline.manifest.schemaVersions.campaign}→${target.manifest.schemaVersions.campaign}`,
        assets: ['release-manifest.json', target.manifest.artifact.name].map(
          (name) => ({
            name,
            browser_download_url: `https://github.com/${(transportMode === 'manifest-origin' && name === 'release-manifest.json') || (transportMode === 'artifact-origin' && name === target.manifest.artifact.name) ? 'untrusted/other-project' : releaseRepository}/releases/download/v${target.manifest.version}/${name}`
          })
        )
      })
    )
  } else if (
    request.url ===
    `/${releaseRepository}/releases/download/v${target.manifest.version}/release-manifest.json`
  ) {
    const metadata = manifest(target)
    response.end(
      JSON.stringify({
        ...metadata,
        ...(transportMode === 'repository'
          ? { repository: 'untrusted/other-project' }
          : {}),
        ...(transportMode === 'architecture' ? { arch: 'arm64' } : {}),
        ...(transportMode === 'manifest-format' ? { formatVersion: 2 } : {}),
        ...(transportMode === 'version'
          ? { version: baseline.manifest.version }
          : {})
      })
    )
  } else if (
    request.url ===
    `/${releaseRepository}/releases/download/v${target.manifest.version}/${target.manifest.artifact.name}`
  ) {
    if (transportMode === 'truncated')
      createReadStream(target.executable, {
        start: 0,
        end: target.manifest.artifact.bytes - 2
      }).pipe(response)
    else if (transportMode === 'corrupt') {
      let first = true
      createReadStream(target.executable)
        .pipe(
          new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              const bytes = Buffer.from(chunk)
              if (first) {
                bytes[0] = bytes[0]! ^ 1
                first = false
              }
              callback(null, bytes)
            }
          })
        )
        .pipe(response)
    } else createReadStream(target.executable).pipe(response)
  } else {
    response.statusCode = 404
    response.end()
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address !== 'string')
let ui: HistoricalUiDriver | undefined
const exits: Array<
  Promise<{ pid: number; code: number | null; signal: NodeJS.Signals | null }>
> = []
const expectedKills = new Set<number>()
let newerBackup: unknown = null
let maintenanceCrash: unknown = null
let activationCrash: unknown = null
let commitCrash: unknown = null
let acceptedCrash: { killedPids: number[]; readback: unknown } | null = null
function spawnApplication(
  installationId?: string,
  observeRecovery = false
): void {
  const temporary = join(home, `ui-launch-${exits.length}`)
  mkdirSync(temporary)
  const log = openSync(join(home, `ui-launch-${exits.length}.log`), 'wx')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_DATA_HOME: home,
    TMPDIR: temporary,
    APPIMAGE_EXTRACT_AND_RUN: '1',
    ...(releaseTestHome
      ? {
          ...releaseTestHome.environment,
          SALT_MARCHER_RELEASE_UI_QUALIFICATION: 'true',
          SALT_MARCHER_RELEASE_TEST_FEED: `http://127.0.0.1:${address && typeof address !== 'string' ? address.port : 0}`
        }
      : {}),
    SALT_MARCHER_HISTORICAL_UI: 'true',
    SALT_MARCHER_HISTORICAL_UI_FEED: `http://127.0.0.1:${address && typeof address !== 'string' ? address.port : 0}`
  }
  delete env['ELECTRON_RUN_AS_NODE']
  if (observeRecovery && launcherObserver) {
    assert.equal(
      createHash('sha256')
        .update(readFileSync(launcherObserver.path))
        .digest('hex'),
      launcherObserver.sha256
    )
    env['NODE_OPTIONS'] = '--require ' + JSON.stringify(launcherObserver.path)
    env['SALT_MARCHER_HISTORICAL_LAUNCHER_ONLY'] = 'true'
  }
  if (values['installed-launcher']) validateMaintenanceLauncher(root)
  const child = spawn(
    join(
      root,
      values['installed-launcher'] && !installationId
        ? 'start'
        : 'current/SaltMarcher.AppImage'
    ),
    [
      '--no-sandbox',
      ...(installationId ? ['--release-complete', installationId] : [])
    ],
    { env, stdio: ['ignore', log, log] }
  )
  if (child.pid) trackIsolatedProcess(home, child.pid)
  closeSync(log)
  exits.push(
    new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) =>
        resolve({ pid: child.pid!, code, signal })
      )
    })
  )
}
async function launch(): Promise<HistoricalUiDriver> {
  spawnApplication()
  return HistoricalUiDriver.connect(home)
}
try {
  if (values['installed-launcher']) {
    const id = randomUUID()
    cpSync(join(root, 'profile'), join(root, `staged-${id}`), {
      recursive: true
    })
    const coordinator = new MaintenanceCoordinator(root)
    coordinator.begin({
      id,
      operation: 'install',
      journalVersion: 3,
      backup: null,
      previous: null,
      next: deploymentProgram(root, originalDeployment)
    })
    coordinator.activate()
    spawnApplication(id)
    ui = await HistoricalUiDriver.connect(home)
    await waitFor(
      () => coordinator.read(),
      (state) => state?.id === id && state.phase === 'committed',
      'baseline installation accepted by its actual runtime'
    )
    await ui.closeApplication(home)
    ui.disconnect()
    ui = undefined
  }
  const parallelStarts: unknown[] = []
  if (values['parallel-starts']) {
    assert(
      values['installed-launcher'],
      'Parallel starter qualification requires installed-launcher'
    )
    const lock = acquireProfileAccess(join(root, 'profile'), 'installer', root)
    const journal = new MaintenanceCoordinator(root).read()
    try {
      parallelStarts.push(
        await rejectHistoricalParallelStart(home, 'starter', 'maintenance')
      )
      assert.deepEqual(new MaintenanceCoordinator(root).read(), journal)
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
    } finally {
      lock.release()
    }
  }
  const initialJournal = new MaintenanceCoordinator(root).read()
  if (values['transport-failures']) {
    for (const mode of ['offline', 'corrupt', 'truncated'] as const) {
      transportMode = mode
      ui = await launch()
      await ui.click('Einstellungen', 'body', true)
      await ui.click('Jetzt prüfen')
      if (mode === 'offline')
        await ui.expectText(
          'Updates konnten nicht geprüft werden. Bitte später erneut versuchen.'
        )
      else {
        await ui.expectText(`Version ${target.manifest.version}`)
        await ui.click('Herunterladen')
        await ui.expectText(
          'Die heruntergeladene Datei ist unvollständig oder beschädigt.'
        )
      }
      assert(!(await ui.text()).includes('Installieren und neu starten'))
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
      assert.deepEqual(new MaintenanceCoordinator(root).read(), initialJournal)
      assert(!existsSync(join(root, 'cache', target.manifest.artifact.name)))
      assert(
        !existsSync(
          join(root, 'cache', `${target.manifest.artifact.name}.partial`)
        )
      )
      await ui.closeApplication(home)
      ui = undefined
      const readback = await runUpdateArtifact(baselineDirectory, home, 'read')
      assert(readback.result.response.ok)
      assert.deepEqual(
        readback.result.response.result,
        seeded.result.response.result
      )
      transportFailures.push({ mode, readback })
    }
    transportMode = 'healthy'
  }
  if (values['feed-failures']) {
    for (const { mode, expected } of feedFailures) {
      transportMode = mode
      const requestStart = requests.length
      ui = await launch()
      await ui.click('Einstellungen', 'body', true)
      await ui.click('Jetzt prüfen')
      const readNotice = async () =>
        z
          .string()
          .parse(
            await ui!.inspect(
              "document.querySelector('.release-settings [role=status]')?.textContent ?? ''"
            )
          )
      const notice = await waitFor(
        readNotice,
        (text) =>
          text.includes(
            values['feed-actionable'] &&
              ['repository', 'architecture', 'manifest-format'].includes(mode)
              ? 'Die Updateinformationen sind ungültig oder passen nicht zu dieser Linux-App.'
              : expected
          ),
        `Feed rejection ${mode}`
      )
      if (values['feed-actionable']) {
        assert(notice.includes('Bitte später erneut prüfen.'))
        assert(!/invalid_value|formatVersion|"path"|"code"/.test(notice))
      }
      assert(!(await ui.text()).includes('Installieren und neu starten'))
      assert.equal(
        await ui.inspect(
          "[...document.querySelectorAll('.release-settings button')].filter(b=>b.textContent==='Herunterladen').length"
        ),
        0
      )
      const requested = requests.slice(requestStart)
      assert(!requested.some((path) => path.endsWith('.AppImage')))
      assert(!existsSync(join(root, 'cache', target.manifest.artifact.name)))
      assert(
        !existsSync(
          join(root, 'cache', `${target.manifest.artifact.name}.partial`)
        )
      )
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
      assert.deepEqual(new MaintenanceCoordinator(root).read(), initialJournal)
      await ui.closeApplication(home)
      ui = undefined
      const readback = await runUpdateArtifact(baselineDirectory, home, 'read')
      assert(readback.result.response.ok)
      assert.deepEqual(
        readback.result.response.result,
        seeded.result.response.result
      )
      feedRejections.push({ mode, notice, requested, readback })
    }
    transportMode = 'healthy'
  }
  if (values['maintenance-crash']) {
    const id = randomUUID()
    const arm = join(root, 'qualification-maintenance-crash.json')
    const boundaryPath = join(root, 'qualification-maintenance-boundary.json')
    writeFileSync(
      arm,
      JSON.stringify(historyScenario ? { id, fromVersion: 42 } : { id }),
      { flag: 'wx' }
    )
    ui = await launch()
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.click('Jetzt prüfen')
    await ui.expectText(`Version ${target.manifest.version}`)
    await ui.click('Herunterladen')
    await ui.expectText('Installieren und neu starten')
    await ui.click('Installieren und neu starten')
    await ui.click('Bestätigen', '[role="alertdialog"]')
    const boundary = await waitFor(
      () =>
        existsSync(boundaryPath)
          ? z
              .object({
                id: z.literal(id),
                processRole: z.enum(['launcher', 'main']).optional(),
                pid: z.number().int().positive(),
                database: z
                  .string()
                  .regex(/^staged-[a-f0-9-]{36}\/campaign-data\/campaigns\//),
                inTransaction: z.literal(true),
                fromVersion: z.literal(historyScenario ? 42 : 41),
                point: z.literal('after-original-loot-receipt-ddl')
              })
              .strict()
              .parse(JSON.parse(readFileSync(boundaryPath, 'utf8')))
          : null,
      (value) => value !== null,
      'original maintenance migration barrier'
    )
    assert(boundary)
    assert(
      isolatedProcesses(home).includes(boundary.pid),
      'Barrier PID must belong to this application'
    )
    process.kill(boundary.pid, 'SIGKILL')
    await ui.expectText(
      'Wartung wurde unterbrochen. Der bisherige Datenstand bleibt erhalten.'
    )
    assert.equal(currentProgram(root)?.deployment, originalDeployment)
    assert.deepEqual(new MaintenanceCoordinator(root).read(), initialJournal)
    rmSync(arm)
    await ui.closeApplication(home)
    ui.disconnect()
    ui = undefined
    const readback = await runUpdateArtifact(baselineDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      seeded.result.response.result
    )
    const backups = readdirSync(join(root, 'backups'))
      .filter((name) => !name.startsWith('.'))
      .map((name) => readVerifiedBackup(join(root, 'backups', name)))
    assert(
      backups.length > 0,
      'Failed preparation must preserve its validated backup'
    )
    const backupReadbacks = []
    for (const [index, backup] of backups.entries()) {
      const backupHome = `${home}-interrupted-backup-${index}`
      assert.equal(backup.manifest.formatVersion, 2)
      mkdirSync(join(backupHome, 'salt-marcher'), { recursive: true })
      cpSync(backup.data, join(backupHome, 'salt-marcher/profile'), {
        recursive: true,
        errorOnExist: true,
        force: false
      })
      const saved = await runUpdateArtifact(
        baselineDirectory,
        backupHome,
        'read'
      )
      assert(saved.result.response.ok)
      assert.deepEqual(
        saved.result.response.result,
        seeded.result.response.result
      )
      backupReadbacks.push(saved)
    }
    maintenanceCrash = {
      boundary,
      backupReadbacks,
      readback,
      backups: backups.map((backup) => ({
        manifest: backup.manifest,
        manifestSha256: backup.manifestSha256
      }))
    }
  }
  if (maintenanceCrash)
    writeFileSync(
      join(home, 'maintenance-crash-evidence.json'),
      JSON.stringify(maintenanceCrash, null, 2),
      { flag: 'wx' }
    )
  if (values['activation-crash']) {
    const id = randomUUID()
    const arm = join(root, 'qualification-publication-crash.json')
    const barrier = join(root, 'qualification-publication-boundary.json')
    writeFileSync(
      arm,
      JSON.stringify({ id, point: values['activation-crash'] }),
      { flag: 'wx' }
    )
    ui = await launch()
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.click('Jetzt prüfen')
    await ui.expectText(`Version ${target.manifest.version}`)
    await ui.click('Herunterladen')
    await ui.expectText('Installieren und neu starten')
    await ui.click('Installieren und neu starten')
    await ui.click('Bestätigen', '[role="alertdialog"]')
    const boundary = await waitFor(
      () =>
        existsSync(barrier)
          ? z
              .object({
                id: z.literal(id),
                point: z.literal(values['activation-crash']!),
                processRole: z.enum(['launcher', 'main']).optional(),
                pid: z.number().int().positive(),
                journal: maintenanceJournalSchema
              })
              .strict()
              .parse(JSON.parse(readFileSync(barrier, 'utf8')))
          : null,
      (value) => value !== null,
      'durable activation boundary'
    )
    assert(boundary)
    const killedPids = isolatedProcesses(home)
    assert(killedPids.includes(boundary.pid))
    for (const pid of killedPids) {
      expectedKills.add(pid)
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    await waitFor(
      () => isolatedProcesses(home),
      (pids) => pids.length === 0,
      'activation crash processes exit'
    )
    ui.disconnect()
    rmSync(arm)
    let recoveryCrash: unknown = null
    if (values['recovery-crash']) {
      const recoveryId = randomUUID()
      rmSync(barrier)
      writeFileSync(
        arm,
        JSON.stringify({ id: recoveryId, point: values['recovery-crash'] }),
        { flag: 'wx' }
      )
      // Recovery can stop before a renderer exists: do not start a CDP connection.
      spawnApplication(undefined, true)
      const recoveryBoundary = await waitFor(
        () =>
          existsSync(barrier)
            ? z
                .object({
                  id: z.literal(recoveryId),
                  point: z.literal(values['recovery-crash']!),
                  processRole: z.enum(['launcher', 'main']).optional(),
                  pid: z.number().int().positive(),
                  journal: maintenanceJournalSchema
                })
                .strict()
                .parse(JSON.parse(readFileSync(barrier, 'utf8')))
            : null,
        (value) => value !== null,
        'durable recovery boundary'
      )
      assert(recoveryBoundary)
      if (launcherObserver)
        assert.equal(recoveryBoundary.processRole, 'launcher')
      assert.equal(recoveryBoundary.journal.id, boundary.journal.id)
      const recoveryPids = isolatedProcesses(home)
      assert(recoveryPids.includes(recoveryBoundary.pid))
      for (const pid of recoveryPids) {
        expectedKills.add(pid)
        try {
          process.kill(pid, 'SIGKILL')
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
        }
      }
      await waitFor(
        () => isolatedProcesses(home),
        (pids) => pids.length === 0,
        'recovery crash processes exit'
      )
      rmSync(arm)
      recoveryCrash = { boundary: recoveryBoundary, killedPids: recoveryPids }
    }
    ui = await launch()
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${baseline.manifest.version}`)
    const recovered = new MaintenanceCoordinator(root).read()
    assert.equal(recovered?.phase, 'rolled-back')
    assert.equal(currentProgram(root)?.deployment, originalDeployment)
    await ui.closeApplication(home)
    ui.disconnect()
    ui = undefined
    const readback = await runUpdateArtifact(baselineDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      seeded.result.response.result
    )
    let failedReadback: unknown = null
    if (values['recovery-crash']) {
      const failedHome = `${home}-failed-candidate`
      mkdirSync(join(failedHome, 'salt-marcher'), { recursive: true })
      cpSync(
        join(root, `failed-${boundary.journal.id}`),
        join(failedHome, 'salt-marcher/profile'),
        { recursive: true, errorOnExist: true, force: false }
      )
      const failed = await runUpdateArtifact(
        targetDirectory,
        failedHome,
        'read'
      )
      assert(failed.result.response.ok)
      assert.deepEqual(failed.result.response.result, expectedTargetSeed)
      failedReadback = failed
    }
    activationCrash = {
      boundary,
      killedPids,
      recoveryCrash,
      recovered,
      readback,
      failedReadback
    }
    writeFileSync(
      join(home, 'activation-crash-evidence.json'),
      JSON.stringify(activationCrash, null, 2),
      { flag: 'wx' }
    )
  }
  let spaceFailure: unknown = null
  if (values['space-volume']) {
    const journal = new MaintenanceCoordinator(root).read()
    const backupNames = () =>
      existsSync(join(root, 'backups'))
        ? readdirSync(join(root, 'backups')).sort()
        : []
    const backups = backupNames()
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    await ui.click('Jetzt prüfen')
    await ui.expectText(`Version ${target.manifest.version}`)
    await ui.click('Herunterladen')
    await ui.expectText('Installieren und neu starten')
    const reservation = constrainHistoricalSpace(
      values['space-volume'],
      home,
      target.manifest.artifact.bytes,
      values['space-exhausted']
    )
    try {
      await ui.click('Installieren und neu starten')
      await ui.click('Bestätigen', '[role="alertdialog"]')
      await ui.expectText(
        values['space-exhausted']
          ? values['space-actionable']
            ? 'Nicht genug freier Speicherplatz.'
            : 'ENOSPC'
          : 'Nicht genug freier Speicherplatz für Sicherung und Migration.'
      )
      if (values['space-actionable']) {
        await ui.expectText(
          'Gib Speicherplatz frei und versuche den Vorgang erneut.'
        )
        assert(!(await ui.text()).includes('ENOSPC'))
      }
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
      assert.deepEqual(new MaintenanceCoordinator(root).read(), journal)
      assert.deepEqual(backupNames(), backups)
      spaceFailure = {
        actionable: values['space-actionable'],
        exhausted: values['space-exhausted'],
        before: reservation.before,
        after: reservation.after,
        artifactBytes: reservation.artifactBytes,
        notice: await ui.text(),
        journal
      }
    } finally {
      reservation.release()
    }
    await ui.closeApplication(home)
    ui = undefined
    const readback = await runUpdateArtifact(baselineDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      seeded.result.response.result
    )
    spaceFailure = { reservation: spaceFailure, readback }
  }
  const startingJournal = new MaintenanceCoordinator(root).read()
  const commitCrashId = values['commit-crash'] ? randomUUID() : null
  const publicationArm = join(root, 'qualification-publication-crash.json')
  const publicationBarrier = join(
    root,
    'qualification-publication-boundary.json'
  )
  if (commitCrashId) {
    rmSync(publicationBarrier, { force: true })
    writeFileSync(
      publicationArm,
      JSON.stringify({ id: commitCrashId, point: 'journal:committed' }),
      { flag: 'wx' }
    )
  }
  const wal = values.wal ? await prepareHistoricalWal(root) : null
  const healthyRequestStart = requests.length
  ui = await launch()
  if (values['parallel-starts']) {
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    for (const mode of ['starter', 'alias', 'appimage'] as const) {
      parallelStarts.push(
        await rejectHistoricalParallelStart(home, mode, 'active')
      )
      assert.deepEqual(new MaintenanceCoordinator(root).read(), startingJournal)
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
      await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    }
  }
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${baseline.manifest.version}`)
  assert(
    !requests
      .slice(healthyRequestStart)
      .some((path) => path.endsWith('.AppImage')),
    'Startup must not download'
  )
  await ui.click('Jetzt prüfen')
  await ui.expectText(`Version ${target.manifest.version}`)
  assert(
    !requests
      .slice(healthyRequestStart)
      .some((path) => path.endsWith('.AppImage')),
    'Checking must not download'
  )
  await ui.click('Herunterladen')
  await ui.expectText('Installieren und neu starten')
  assert.equal(
    currentProgram(root)?.deployment,
    originalDeployment,
    'Download must not activate'
  )
  assert.deepEqual(new MaintenanceCoordinator(root).read(), startingJournal)
  await ui.click('Installieren und neu starten')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  if (commitCrashId) {
    const boundary = await waitFor(
      () =>
        existsSync(publicationBarrier)
          ? z
              .object({
                id: z.literal(commitCrashId),
                point: z.literal('journal:committed'),
                processRole: z.enum(['launcher', 'main']).optional(),
                pid: z.number().int().positive(),
                journal: maintenanceJournalSchema
              })
              .strict()
              .parse(JSON.parse(readFileSync(publicationBarrier, 'utf8')))
          : null,
      (value) => value !== null,
      'durable update acceptance before normal use'
    )
    assert(boundary)
    assert.equal(boundary.journal.phase, 'committed')
    assert.notEqual(boundary.journal.id, startingJournal?.id)
    const killedPids = isolatedProcesses(home)
    assert(killedPids.includes(boundary.pid))
    for (const pid of killedPids) {
      expectedKills.add(pid)
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    await waitFor(
      () => isolatedProcesses(home),
      (pids) => pids.length === 0,
      'committed target crash processes exit'
    )
    ui.disconnect()
    rmSync(publicationArm)
    ui = await launch()
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    const recovered = new MaintenanceCoordinator(root).read()
    assert.deepEqual(recovered, boundary.journal)
    assert.equal(
      currentProgram(root)?.deployment,
      boundary.journal.next.deployment
    )
    commitCrash = { boundary, killedPids, recovered }
  }
  const updated = await waitFor(
    () => new MaintenanceCoordinator(root).read(),
    (state) =>
      state?.id !== startingJournal?.id &&
      (state?.phase === 'committed' || state?.phase === 'rolled-back'),
    'target restart commits update'
  )
  assert(updated)
  if (updated.phase === 'rolled-back')
    throw new Error(`Update ${updated.id} rolled back: ${await ui.text()}`)
  assert.equal(updated.next.version, target.manifest.version)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${target.manifest.version}`)
  await ui.closeApplication(home)
  ui = undefined
  const after = await runUpdateArtifact(targetDirectory, home, 'read')
  assert(after.result.response.ok)
  assert.deepEqual(after.result.response.result, expectedTargetSeed)
  const afterHistory = historyScenario
    ? readPartyHistoryEvidence(join(root, 'profile'))
    : null
  if (sourceHistory && afterHistory)
    assertPartyHistoryMigration(sourceHistory, afterHistory)
  ui = await launch()
  const continuedAtStart = Date.now()
  await ui.click('Fortsetzen')
  await ui.click(historyScenario ? 'Party' : 'Charaktere', '.desktop-toolbar')
  await ui.click(
    'XP',
    historyScenario
      ? '[data-window-id="party"] .desktop-party-entry'
      : '[data-window-id="characters"] tbody'
  )
  await ui.fill('.desktop-xp-popup input', '25')
  await ui.click('+', '.desktop-xp-popup')
  if (historyScenario) {
    await waitFor(
      () =>
        ui!.inspect(
          `document.querySelector('[data-window-id="party"] .party-xp-meter')?.getAttribute("aria-label")`
        ),
      (value) =>
        typeof value === 'string' && value.startsWith('Mara 1: 1.000 XP'),
      'Party XP change persisted in rendered meter'
    )
  } else await ui.expectText('XP 1000 /')
  await ui.closeApplication(home)
  ui = undefined
  const continued = await runUpdateArtifact(targetDirectory, home, 'read')
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
  const continuedHistory = historyScenario
    ? readPartyHistoryEvidence(join(root, 'profile'))
    : null
  if (afterHistory && continuedHistory)
    assertPartyHistoryXp(
      afterHistory,
      continuedHistory,
      after.result.response.result,
      continued.result.response.result
    )
  if (values['accepted-crash']) {
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${target.manifest.version}`)
    assert.equal(new MaintenanceCoordinator(root).read()?.phase, 'committed')
    const killedPids = isolatedProcesses(home)
    assert(killedPids.length > 0)
    for (const pid of killedPids) {
      expectedKills.add(pid)
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    await waitFor(
      () => isolatedProcesses(home),
      (pids) => pids.length === 0,
      'hard-killed application exited'
    )
    ui.disconnect()
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${target.manifest.version}`)
    assert.equal(new MaintenanceCoordinator(root).read()?.id, updated.id)
    assert.equal(new MaintenanceCoordinator(root).read()?.phase, 'committed')
    await ui.closeApplication(home)
    ui = undefined
    const readback = await runUpdateArtifact(targetDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      continued.result.response.result
    )
    acceptedCrash = { killedPids, readback }
  }
  if (values['newer-backup']) {
    assert(updated.backup)
    const fixture = createNewerFormatBackup(
      join(root, 'backups', updated.backup),
      target.manifest.schemaVersions.installation
    )
    const backupNames = () =>
      readdirSync(join(root, 'backups'))
        .filter((id) => z.uuid().safeParse(id).success)
        .sort()
    const before = backupNames().map((id) => ({
      id,
      files: inventory(join(root, 'backups', id)),
      directories: directoryInventory(join(root, 'backups', id))
    }))
    const program = currentProgram(root)
    const journal = new MaintenanceCoordinator(root).read()
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    const scope = await visibleBackupScope(ui, fixture.manifest)
    await ui.click('Wiederherstellen', scope)
    await ui.click('Bestätigen', '[role="alertdialog"]')
    await ui.expectText('Aktualisiere SaltMarcher')
    const notice = await ui.text()
    assert(notice.includes('neueres Datenformat'))
    assert(!notice.includes('Incompatible persisted data'))
    assert(!notice.includes(fixture.directory))
    await ui.expectText(`Installierte Version: ${target.manifest.version}`)
    assert.deepEqual(currentProgram(root), program)
    assert.deepEqual(new MaintenanceCoordinator(root).read(), journal)
    await ui.closeApplication(home)
    ui = undefined
    const readback = await runUpdateArtifact(targetDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      continued.result.response.result
    )
    for (const saved of before) {
      assert.deepEqual(inventory(join(root, 'backups', saved.id)), saved.files)
      assert.deepEqual(
        directoryInventory(join(root, 'backups', saved.id)),
        saved.directories
      )
    }
    const added = backupNames().filter(
      (id) => !before.some((saved) => saved.id === id)
    )
    assert.equal(added.length, 1)
    const protection = readVerifiedBackup(join(root, 'backups', added[0]!))
    assert.equal(protection.manifest.formatVersion, 2)
    const protectedHome = `${home}-newer-backup-protected`
    mkdirSync(join(protectedHome, 'salt-marcher'), { recursive: true })
    cpSync(protection.data, join(protectedHome, 'salt-marcher/profile'), {
      recursive: true,
      errorOnExist: true,
      force: false
    })
    const protectedReadback = await runUpdateArtifact(
      targetDirectory,
      protectedHome,
      'read'
    )
    assert(protectedReadback.result.response.ok)
    assert.deepEqual(
      protectedReadback.result.response.result,
      continued.result.response.result
    )
    assert.equal(
      readVerifiedBackup(join(root, 'backups', added[0]!)).manifestSha256,
      protection.manifestSha256
    )
    newerBackup = {
      fixture,
      before,
      program,
      journal,
      notice,
      readback,
      protection,
      protectedReadback
    }
  }
  ui = await launch()
  await ui.click('Einstellungen', 'body', true)
  assert(updated.backup)
  const requestedBackup = readVerifiedBackup(
    join(root, 'backups', updated.backup)
  )
  const backupScope = await visibleBackupScope(ui, requestedBackup.manifest)
  await ui.click('Wiederherstellen', z.string().parse(backupScope))
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
  assert.equal(restoredTransaction.next.sha256, target.manifest.artifact.sha256)
  assert.equal(
    restoredTransaction.previous?.deployment,
    updated.next.deployment
  )
  assert.equal(restoredTransaction.next.deployment, updated.next.deployment)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${target.manifest.version}`)
  await ui.closeApplication(home)
  ui = undefined
  const restored = await runUpdateArtifact(targetDirectory, home, 'read')
  assert(restored.result.response.ok)
  assert.deepEqual(restored.result.response.result, expectedTargetSeed)
  const restoredHistory = historyScenario
    ? readPartyHistoryEvidence(join(root, 'profile'))
    : null
  if (sourceHistory && restoredHistory)
    assertPartyHistoryMigration(sourceHistory, restoredHistory)
  const backupDirectory = join(root, 'backups', restoredTransaction.backup)
  const protectedBackup = readVerifiedBackup(backupDirectory)
  assert.equal(protectedBackup.manifest.formatVersion, 2)
  const protectedHistory = historyScenario
    ? readPartyHistoryEvidence(protectedBackup.data)
    : null
  assert.deepEqual(protectedHistory, continuedHistory)
  const savedHome = `${home}-protected-work`
  mkdirSync(join(savedHome, 'salt-marcher'), { recursive: true })
  cpSync(protectedBackup.data, join(savedHome, 'salt-marcher/profile'), {
    recursive: true,
    errorOnExist: true,
    force: false
  })
  const protectedRead = await runUpdateArtifact(
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
  let restoredProtection: unknown = null
  if (values['restore-protected-history']) {
    assert(continuedHistory && restoredHistory)
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    const scope = await visibleBackupScope(ui, protectedBackup.manifest)
    await ui.click('Wiederherstellen', z.string().parse(scope))
    await ui.click('Bestätigen', '[role="alertdialog"]')
    const journal = await waitFor(
      () => new MaintenanceCoordinator(root).read(),
      (state) =>
        state?.id !== restoredTransaction.id &&
        state?.operation === 'restore' &&
        state.phase === 'committed',
      'restore protective backup with Party history'
    )
    assert(journal?.backup)
    assert.equal(journal.next.deployment, updated.next.deployment)
    ui.disconnect()
    ui = await HistoricalUiDriver.connect(home)
    await ui.closeApplication(home)
    ui = undefined
    const readback = await runUpdateArtifact(targetDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      continued.result.response.result
    )
    const history = readPartyHistoryEvidence(join(root, 'profile'))
    assert.deepEqual(history, continuedHistory)
    const safety = readVerifiedBackup(join(root, 'backups', journal.backup))
    assert.equal(safety.manifest.formatVersion, 2)
    const safetyHistory = readPartyHistoryEvidence(safety.data)
    assert.deepEqual(safetyHistory, restoredHistory)
    const safetyHome = `${home}-second-restore-protection`
    mkdirSync(join(safetyHome, 'salt-marcher'), { recursive: true })
    cpSync(safety.data, join(safetyHome, 'salt-marcher/profile'), {
      recursive: true,
      errorOnExist: true,
      force: false
    })
    const safetyReadback = await runUpdateArtifact(
      targetDirectory,
      safetyHome,
      'read'
    )
    assert(safetyReadback.result.response.ok)
    assert.deepEqual(
      safetyReadback.result.response.result,
      restored.result.response.result
    )
    restoredProtection = {
      journal,
      readback,
      history,
      safety,
      safetyHistory,
      safetyReadback
    }
  }
  const unchanged = await runUpdateArtifact(
    baselineDirectory,
    sourceHome,
    'read'
  )
  assert(unchanged.result.response.ok)
  const unchangedHistory = sourceHistory
    ? readPartyHistoryEvidence(join(sourceHome, 'salt-marcher/profile'))
    : null
  if (sourceHistory) assert.deepEqual(unchangedHistory, sourceHistory)
  assert.deepEqual(
    unchanged.result.response.result,
    seeded.result.response.result
  )
  const fixtureUnchanged = profileFixtureDirectory
    ? await runUpdateArtifact(seedDirectory, sourceHome, 'read')
    : undefined
  if (fixtureUnchanged) {
    assert(fixtureUnchanged.result.response.ok)
    assert.deepEqual(
      fixtureUnchanged.result.response.result,
      fixtureSeeded.result.response.result
    )
  }
  const fixtureUnchangedHistory =
    profileFixtureDirectory && historyScenario
      ? readPartyHistoryEvidence(join(sourceHome, 'salt-marcher/profile'))
      : null
  if (profileFixtureDirectory) {
    assert.deepEqual(fixtureUnchangedHistory, fixtureHistory)
    assert.deepEqual(readUpdateArtifact(seedDirectory), profileFixture)
  }
  const processExits = await Promise.all(exits)
  assert(
    processExits.every(
      (exit) =>
        exit.code === 0 ||
        (expectedKills.has(exit.pid) && exit.signal === 'SIGKILL')
    )
  )
  if (values['accepted-crash'])
    assert(
      processExits.some(
        (exit) => expectedKills.has(exit.pid) && exit.signal === 'SIGKILL'
      )
    )
  readUpdateArtifact(baselineDirectory)
  readUpdateArtifact(targetDirectory)
  if (values['installed-launcher']) validateMaintenanceLauncher(root)
  writeFileSync(
    join(home, 'ui-update-evidence.json'),
    JSON.stringify(
      {
        formatVersion: target.kind === 'release' ? 2 : 1,
        coverage:
          'ui-check-download-install-restart-continue-restore-protected-work',
        schemaScenario: historyScenario
          ? `party-history-${values['party-history-scenario']}`
          : values['same-schema']
            ? '42/42-to-42/42'
            : '42/41-to-42/42',
        targetPartyQuickFieldsDefault:
          values['target-party-quick-fields-default'],
        expectedTargetSeed,
        partyHistoryEvidence: historyScenario
          ? {
              source: sourceHistory,
              unchanged: unchangedHistory,
              after: afterHistory,
              continued: continuedHistory,
              restored: restoredHistory,
              protected: protectedHistory
            }
          : null,
        startPath: values['installed-launcher']
          ? 'installed-launcher'
          : 'appimage',
        baseline:
          baseline.provenance.kind === 'historical-fixture'
            ? baseline.provenance.receipt
            : baseline.manifest,
        baselineProvenance: baseline.provenance,
        ...(profileFixtureDirectory
          ? {
              profilePreparation: {
                fixtureProvenance: profileFixture.provenance,
                seeded: fixtureSeeded,
                unchanged: fixtureUnchanged,
                history: fixtureHistory,
                unchangedHistory: fixtureUnchangedHistory,
                baselineIdentity
              }
            }
          : {}),
        target:
          target.provenance.kind === 'historical-fixture'
            ? target.provenance.receipt
            : target.manifest,
        targetProvenance: target.provenance,
        targetIdentity,
        requests,
        launcherObserver,
        newerBackup,
        transportFailures,
        feedRejections,
        parallelStarts,
        spaceFailure,
        wal,
        acceptedCrash,
        commitCrash,
        maintenanceCrash,
        activationCrash,
        processExits,
        transaction: updated,
        seeded,
        after,
        continued,
        restoredTransaction,
        restored,
        protectedBackup,
        protectedRead,
        restoredProtection,
        unchanged
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
  console.info(`UI update and complete profile readback passed: ${home}`)
} catch (error) {
  try {
    const page = ui
      ? await ui.inspect(`({
          text: document.body?.innerText ?? null,
          html: document.body?.outerHTML ?? null,
          visibility: document.visibilityState
        })`)
      : null
    writeFileSync(
      join(home, 'ui-failure-evidence.json'),
      JSON.stringify(
        { error: error instanceof Error ? error.stack : String(error), page },
        null,
        2
      ),
      { flag: 'wx' }
    )
  } catch (diagnosticError) {
    console.error('Could not capture UI failure evidence:', diagnosticError)
  }
  throw error
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

async function visibleBackupScope(
  driver: HistoricalUiDriver,
  manifest: { createdAt: string; version: string }
): Promise<string> {
  const scope = await waitFor(
    () =>
      driver.inspect(`(() => {
      const rows = [...document.querySelectorAll('.release-settings > ul > li')];
      const date = new Date(${JSON.stringify(manifest.createdAt)}).toLocaleString('de-DE');
      const version = ${JSON.stringify('Version ' + manifest.version)};
      const matches = rows.flatMap((row, index) => row.textContent.includes(date) && row.textContent.includes(version) ? [index] : []);
      return matches.length === 1 ? '.release-settings > ul > li:nth-child(' + (matches[0] + 1) + ')' : null;
    })()`),
    (scope) => typeof scope === 'string',
    'unique visible pre-update backup row'
  )
  return z.string().parse(scope)
}

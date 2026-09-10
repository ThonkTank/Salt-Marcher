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
import {
  readHistoricalArtifact,
  runHistoricalArtifact,
  copyHistoricalWorkingProfile
} from './qualification/historical-artifact-runner.js'
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
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'

assertHistoricalTestIsolation()

const { values } = parseArgs({
  options: {
    'space-volume': { type: 'string' },
    'space-exhausted': { type: 'boolean', default: false },
    'space-actionable': { type: 'boolean', default: false },
    wal: { type: 'boolean', default: false },
    'parallel-starts': { type: 'boolean', default: false },
    'transport-failures': { type: 'boolean', default: false },
    'accepted-crash': { type: 'boolean', default: false },
    'commit-crash': { type: 'boolean', default: false },
    'launcher-recovery-observer': { type: 'string' },
    'installed-launcher': { type: 'boolean', default: false },
    'maintenance-crash': { type: 'boolean', default: false },
    'activation-crash': { type: 'string' },
    'recovery-crash': { type: 'string' },
    baseline: { type: 'string' },
    target: { type: 'string' },
    home: { type: 'string' }
  }
})
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
assert(
  !values['space-exhausted'] || values['space-volume'],
  'space-exhausted requires an isolated volume'
)
const seeded = await runHistoricalArtifact(
  baselineDirectory,
  sourceHome,
  'seed'
)
assert(seeded.result.response.ok)
copyHistoricalWorkingProfile(sourceHome, home)
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
    { path: baseline.executable, sha256: baseline.receipt.artifact.sha256 },
    readAppImageLauncher(baseline.executable, baseline.receipt.artifact.sha256)
  )
  validateMaintenanceLauncher(root)
}
const requests: string[] = []
let transportMode: 'healthy' | 'offline' | 'corrupt' | 'truncated' = values[
  'transport-failures'
]
  ? 'offline'
  : 'healthy'
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
  ) {
    if (transportMode === 'truncated')
      createReadStream(target.executable, {
        start: 0,
        end: target.receipt.artifact.bytes - 2
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
        await ui.expectText(`Version ${target.receipt.version}`)
        await ui.click('Herunterladen')
        await ui.expectText(
          'Die heruntergeladene Datei ist unvollständig oder beschädigt.'
        )
      }
      assert(!(await ui.text()).includes('Installieren und neu starten'))
      assert.equal(currentProgram(root)?.deployment, originalDeployment)
      assert.deepEqual(new MaintenanceCoordinator(root).read(), initialJournal)
      assert(!existsSync(join(root, 'cache', target.receipt.artifact.name)))
      assert(
        !existsSync(
          join(root, 'cache', `${target.receipt.artifact.name}.partial`)
        )
      )
      await ui.closeApplication(home)
      ui = undefined
      const readback = await runHistoricalArtifact(
        baselineDirectory,
        home,
        'read'
      )
      assert(readback.result.response.ok)
      assert.deepEqual(
        readback.result.response.result,
        seeded.result.response.result
      )
      transportFailures.push({ mode, readback })
    }
    transportMode = 'healthy'
  }
  if (values['maintenance-crash']) {
    const id = randomUUID()
    const arm = join(root, 'qualification-maintenance-crash.json')
    const boundaryPath = join(root, 'qualification-maintenance-boundary.json')
    writeFileSync(arm, JSON.stringify({ id }), { flag: 'wx' })
    ui = await launch()
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.click('Jetzt prüfen')
    await ui.expectText(`Version ${target.receipt.version}`)
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
                fromVersion: z.literal(41),
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
    const readback = await runHistoricalArtifact(
      baselineDirectory,
      home,
      'read'
    )
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
      const saved = await runHistoricalArtifact(
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
    await ui.expectText(`Version ${target.receipt.version}`)
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
    await ui.expectText(`Installierte Version: ${baseline.receipt.version}`)
    const recovered = new MaintenanceCoordinator(root).read()
    assert.equal(recovered?.phase, 'rolled-back')
    assert.equal(currentProgram(root)?.deployment, originalDeployment)
    await ui.closeApplication(home)
    ui.disconnect()
    ui = undefined
    const readback = await runHistoricalArtifact(
      baselineDirectory,
      home,
      'read'
    )
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
      const failed = await runHistoricalArtifact(
        targetDirectory,
        failedHome,
        'read'
      )
      assert(failed.result.response.ok)
      assert.deepEqual(
        failed.result.response.result,
        seeded.result.response.result
      )
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
    await ui.expectText(`Version ${target.receipt.version}`)
    await ui.click('Herunterladen')
    await ui.expectText('Installieren und neu starten')
    const reservation = constrainHistoricalSpace(
      values['space-volume'],
      home,
      target.receipt.artifact.bytes,
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
    const readback = await runHistoricalArtifact(
      baselineDirectory,
      home,
      'read'
    )
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
  await ui.expectText(`Installierte Version: ${baseline.receipt.version}`)
  assert(
    !requests
      .slice(healthyRequestStart)
      .some((path) => path.endsWith('.AppImage')),
    'Startup must not download'
  )
  await ui.click('Jetzt prüfen')
  await ui.expectText(`Version ${target.receipt.version}`)
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
  if (values['accepted-crash']) {
    ui = await launch()
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${target.receipt.version}`)
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
    await ui.expectText(`Installierte Version: ${target.receipt.version}`)
    assert.equal(new MaintenanceCoordinator(root).read()?.id, updated.id)
    assert.equal(new MaintenanceCoordinator(root).read()?.phase, 'committed')
    await ui.closeApplication(home)
    ui = undefined
    const readback = await runHistoricalArtifact(targetDirectory, home, 'read')
    assert(readback.result.response.ok)
    assert.deepEqual(
      readback.result.response.result,
      continued.result.response.result
    )
    acceptedCrash = { killedPids, readback }
  }
  ui = await launch()
  await ui.click('Einstellungen', 'body', true)
  assert(updated.backup)
  const requestedBackup = readVerifiedBackup(
    join(root, 'backups', updated.backup)
  )
  const backupScope = await waitFor(
    () =>
      ui!.inspect(`(() => {
      const rows = [...document.querySelectorAll('.release-settings > ul > li')];
      const date = new Date(${JSON.stringify(requestedBackup.manifest.createdAt)}).toLocaleString('de-DE');
      const version = ${JSON.stringify('Version ' + requestedBackup.manifest.version)};
      const matches = rows.flatMap((row, index) => row.textContent.includes(date) && row.textContent.includes(version) ? [index] : []);
      return matches.length === 1 ? '.release-settings > ul > li:nth-child(' + (matches[0] + 1) + ')' : null;
    })()`),
    (scope) => typeof scope === 'string',
    'unique visible pre-update backup row'
  )
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
  readHistoricalArtifact(baselineDirectory)
  readHistoricalArtifact(targetDirectory)
  if (values['installed-launcher']) validateMaintenanceLauncher(root)
  writeFileSync(
    join(home, 'ui-update-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        coverage:
          'ui-check-download-install-restart-continue-restore-protected-work',
        startPath: values['installed-launcher']
          ? 'installed-launcher'
          : 'appimage',
        baseline: baseline.receipt,
        target: target.receipt,
        requests,
        launcherObserver,
        transportFailures,
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

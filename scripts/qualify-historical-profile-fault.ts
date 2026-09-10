import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  chmodSync,
  closeSync,
  cpSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { acquireProfileAccess } from '../src/main/local-profile/profile-access.js'
import {
  stageDeployment,
  setCurrent,
  currentProgram
} from '../src/main/release/deployment.js'
import { readVerifiedBackup } from '../src/core/maintenance/verified-backup.js'
import { profileBackupSchema } from '../src/shared/contracts/profile-backup.js'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import {
  directoryInventory,
  inventory
} from '../src/shared/maintenance/files.js'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import {
  copyHistoricalWorkingProfile,
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'
import {
  HistoricalUiDriver,
  isolatedProcesses,
  trackIsolatedProcess,
  waitFor
} from './qualification/historical-ui-driver.js'

assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    home: { type: 'string' },
    case: { type: 'string' }
  }
})
const fault = z
  .enum(['newer-format', 'missing-path', 'corrupt', 'access-denied'])
  .parse(values.case)
const targetDirectory = resolve(z.string().parse(values.target))
const home = resolve(z.string().parse(values.home))
const sourceHome = `${home}-source`
const target = readHistoricalArtifact(targetDirectory)
assert.deepEqual(target.receipt.source.schemaVersions, {
  installation: 42,
  campaign: 42
})
const seeded = await runHistoricalArtifact(targetDirectory, sourceHome, 'seed')
assert(seeded.result.response.ok)
copyHistoricalWorkingProfile(sourceHome, home)
const root = join(home, 'salt-marcher')
const profile = join(root, 'profile')
const databasePath = join(profile, 'campaign-data', 'installation.sqlite')
const deployment = stageDeployment(
  root,
  target.executable,
  releaseManifestSchema.parse({
    formatVersion: 1,
    repository: releaseRepository,
    version: target.receipt.version,
    commit: target.receipt.source.commit,
    platform: 'linux',
    arch: 'x64',
    schemaVersions: target.receipt.source.schemaVersions,
    artifact: target.receipt.artifact
  })
)
setCurrent(root, deployment)
const coordinator = new MaintenanceCoordinator(root)
const server = createServer((_request, response) => {
  response.statusCode = 503
  response.end('Offline profile-fault qualification')
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address !== 'string')
const feed = `http://127.0.0.1:${address.port}`
const exits: Array<
  Promise<{ pid: number; code: number | null; signal: NodeJS.Signals | null }>
> = []
let ui: HistoricalUiDriver | undefined
let permissionChanged = false
function snapshot(path = profile) {
  return { files: inventory(path), directories: directoryInventory(path) }
}
async function launch() {
  const temporary = join(home, `ui-launch-${exits.length}`)
  mkdirSync(temporary)
  const log = openSync(`${temporary}.log`, 'wx')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_DATA_HOME: home,
    TMPDIR: temporary,
    APPIMAGE_EXTRACT_AND_RUN: '1',
    SALT_MARCHER_HISTORICAL_UI: 'true',
    SALT_MARCHER_HISTORICAL_UI_FEED: feed
  }
  delete env['ELECTRON_RUN_AS_NODE']
  const child = spawn(
    join(root, 'current', 'SaltMarcher.AppImage'),
    ['--no-sandbox'],
    { env, stdio: ['ignore', log, log] }
  )
  closeSync(log)
  if (child.pid) trackIsolatedProcess(home, child.pid)
  exits.push(
    new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) =>
        resolve({ pid: child.pid!, code, signal })
      )
    })
  )
  return HistoricalUiDriver.connect(home)
}
function terminateOwnedProcesses() {
  for (const pid of isolatedProcesses(home)) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
}
async function close() {
  if (ui) {
    await ui.closeApplication(home)
    ui = undefined
  }
}
try {
  ui = await launch()
  await ui.click('Einstellungen', 'body', true)
  await ui.click('Mit leerem Profil anfangen', '.release-settings')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  const setup = await waitFor(
    () => coordinator.read(),
    (state) => state?.phase === 'committed' && !!state.backup,
    'empty-profile setup commits with a real backup'
  )
  assert(setup?.backup)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.expectText('Noch keine Kampagne vorhanden.')
  assert.equal(
    await ui.inspect(
      "document.querySelectorAll('.campaign-screen-list > li').length"
    ),
    0
  )
  await close()
  const saved = readVerifiedBackup(join(root, 'backups', setup.backup))
  assert.equal(saved.manifest.formatVersion, 2)
  const access = acquireProfileAccess(profile, 'installer', root)
  try {
    const sourceRoot = join(sourceHome, 'salt-marcher')
    const sourceAccess = acquireProfileAccess(
      join(sourceRoot, 'profile'),
      'installer',
      sourceRoot
    )
    try {
      const original = snapshot(sourceAccess.profile)
      rmSync(profile, { recursive: true })
      cpSync(sourceAccess.profile, profile, {
        recursive: true,
        errorOnExist: true,
        force: false
      })
      assert.deepEqual(snapshot(), original)
      assert.deepEqual(snapshot(sourceAccess.profile), original)
    } finally {
      sourceAccess.release()
    }
    if (fault === 'newer-format' || fault === 'missing-path') {
      // Rejection fixtures only: this is not evidence of a historical migration.
      const database = new DatabaseSync(databasePath)
      try {
        database.exec(
          `PRAGMA user_version = ${fault === 'newer-format' ? 43 : 0}`
        )
        database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      } finally {
        database.close()
      }
    } else if (fault === 'corrupt')
      writeFileSync(
        databasePath,
        'Intentionally damaged isolated installation database'
      )
  } finally {
    access.release()
  }
  const before = snapshot()
  if (fault === 'access-denied') {
    chmodSync(databasePath, 0)
    permissionChanged = true
  }
  ui = await launch()
  await ui.expectText('Das Profil ist nicht verfügbar')
  await ui.expectText(
    fault === 'access-denied'
      ? 'Prüfe die Zugriffsrechte'
      : fault === 'corrupt'
        ? 'Profildaten konnten nicht geprüft werden'
        : 'Dieses Datenformat kann mit dieser App-Version nicht geöffnet werden'
  )
  const recoveryNotice = await ui.text()
  await ui.click('Sicherungen und Wiederherstellung öffnen')
  await ui.expectText('Installierte Version: ' + target.receipt.version)
  await ui.expectText('Vollständiges Profil')
  if (fault !== 'access-denied') assert.deepEqual(snapshot(), before)
  assert.deepEqual(coordinator.read(), setup)
  assert.equal(currentProgram(root)?.deployment, deployment)
  // Setup created exactly one backup through the original app/Utility flow.
  await ui.click('Wiederherstellen', '.release-settings > ul')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  let restored: unknown = null
  let protectedManifest: unknown = null
  let restoreTransaction: unknown = null
  let readback: unknown = null
  if (fault === 'access-denied') {
    await ui.expectText('EACCES')
    assert.deepEqual(coordinator.read(), setup)
    assert.equal(currentProgram(root)?.deployment, deployment)
    await close()
    assert.equal(statSync(databasePath).mode & 0o777, 0)
    chmodSync(databasePath, 0o600)
    permissionChanged = false
    assert.deepEqual(snapshot(), before)
    const result = await runHistoricalArtifact(targetDirectory, home, 'read')
    assert(result.result.response.ok)
    assert.deepEqual(
      result.result.response.result,
      seeded.result.response.result
    )
    readback = result
  } else {
    const transaction = await waitFor(
      () => coordinator.read(),
      (state) =>
        state?.id !== setup.id &&
        state?.operation === 'restore' &&
        state.phase === 'committed',
      'recovery restore commits'
    )
    assert(transaction?.backup)
    assert.equal(transaction.next.deployment, deployment)
    assert.equal(transaction.next.sha256, target.receipt.artifact.sha256)
    ui.disconnect()
    ui = await HistoricalUiDriver.connect(home)
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await close()
    const protectedRoot = join(root, 'backups', transaction.backup)
    const protectedState = profileBackupSchema.parse(
      JSON.parse(readFileSync(join(protectedRoot, 'manifest.json'), 'utf8'))
    )
    assert.equal(protectedState.formatVersion, 2)
    assert.equal(protectedState.restorable, false)
    assert.deepEqual(snapshot(join(protectedRoot, 'data')), before)
    assert.deepEqual(protectedState.files, before.files)
    const result = await runHistoricalArtifact(targetDirectory, home, 'read')
    assert(result.result.response.ok)
    assert.deepEqual(
      result.result.response.result,
      seeded.result.response.result
    )
    restored = result
    protectedManifest = protectedState
    restoreTransaction = transaction
  }
  const unchanged = await runHistoricalArtifact(
    targetDirectory,
    sourceHome,
    'read'
  )
  assert(unchanged.result.response.ok)
  assert.deepEqual(
    unchanged.result.response.result,
    seeded.result.response.result
  )
  assert.equal(
    readHistoricalArtifact(targetDirectory).receiptSha256,
    target.receiptSha256
  )
  writeFileSync(
    join(home, 'profile-fault-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        case: fault,
        coverage: 'packaged-profile-rejection-and-confirmed-recovery',
        target: target.receipt,
        seeded,
        setup,
        backup: saved.manifest,
        before,
        recoveryNotice,
        restored,
        protectedManifest,
        restoreTransaction,
        readback,
        unchanged,
        processExits: await Promise.all(exits)
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
  console.info(`Profile fault and recovery passed: ${fault}: ${home}`)
} catch (error) {
  let page: unknown
  try {
    page = ui
      ? await ui.inspect(
          '({text:document.body?.innerText,html:document.body?.outerHTML,visibility:document.visibilityState})'
        )
      : null
  } catch (inspectionError) {
    page = { inspectionError: String(inspectionError) }
  }
  writeFileSync(
    join(home, 'profile-fault-failure.json'),
    JSON.stringify(
      { error: error instanceof Error ? error.stack : String(error), page },
      null,
      2
    ),
    { flag: 'wx' }
  )
  throw error
} finally {
  ui?.disconnect()
  terminateOwnedProcesses()
  await waitFor(
    () => isolatedProcesses(home),
    (pids) => pids.length === 0,
    'profile fault application cleanup'
  )
  if (permissionChanged) chmodSync(databasePath, 0o600)
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}

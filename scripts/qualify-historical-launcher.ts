import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import {
  closeSync,
  cpSync,
  mkdirSync,
  openSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import {
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'
import {
  HistoricalUiDriver,
  trackIsolatedProcess,
  isolatedProcesses,
  waitFor
} from './qualification/historical-ui-driver.js'
import {
  stageDeployment,
  deploymentProgram
} from '../src/main/release/deployment.js'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { readAppImageLauncher } from '../src/shared/maintenance/appimage-launcher.js'
import {
  installMaintenanceLauncher,
  validateMaintenanceLauncher
} from '../src/shared/maintenance/launcher.js'

assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    home: { type: 'string' },
    'signal-abort': { type: 'boolean', default: false }
  }
})
const directory = resolve(z.string().parse(values.target))
const home = resolve(z.string().parse(values.home))
const artifact = readHistoricalArtifact(directory)
const seeded = await runHistoricalArtifact(directory, home, 'seed')
assert(seeded.result.response.ok)
const root = join(home, 'salt-marcher')
const manifest = releaseManifestSchema.parse({
  formatVersion: 1,
  repository: releaseRepository,
  version: artifact.receipt.version,
  commit: artifact.receipt.source.commit,
  platform: 'linux',
  arch: 'x64',
  schemaVersions: artifact.receipt.source.schemaVersions,
  artifact: artifact.receipt.artifact
})
const deployment = stageDeployment(root, artifact.executable, manifest)
const transactionId = randomUUID()
// The seed runtime has exited; only this isolated fixture owns the complete profile.
cpSync(join(root, 'profile'), join(root, `staged-${transactionId}`), {
  recursive: true
})
const coordinator = new MaintenanceCoordinator(root)
coordinator.begin({
  id: transactionId,
  operation: 'install',
  journalVersion: 3,
  backup: null,
  previous: null,
  next: deploymentProgram(root, deployment)
})
installMaintenanceLauncher(
  root,
  { path: artifact.executable, sha256: artifact.receipt.artifact.sha256 },
  readAppImageLauncher(artifact.executable, artifact.receipt.artifact.sha256)
)
validateMaintenanceLauncher(root)
coordinator.activate()
const temporary = join(home, 'launcher-temp')
mkdirSync(temporary)
const env = {
  ...process.env,
  XDG_DATA_HOME: home,
  TMPDIR: temporary,
  APPIMAGE_EXTRACT_AND_RUN: '1',
  SALT_MARCHER_HISTORICAL_UI: 'true',
  SALT_MARCHER_HISTORICAL_UI_FEED: 'http://127.0.0.1:9'
}
function launch(executable: string, args: string[], label: string) {
  const log = openSync(join(home, `${label}.log`), 'wx')
  const child = spawn(executable, args, { env, stdio: ['ignore', log, log] })
  if (child.pid) trackIsolatedProcess(home, child.pid)
  closeSync(log)
  const completion = new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
  }>((resolveExit, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolveExit({ code, signal }))
  })
  return Object.assign(completion, { pid: child.pid })
}
let ui: HistoricalUiDriver | undefined
let stage = 'installation-completion'
try {
  const initialization = launch(
    join(root, 'current/SaltMarcher.AppImage'),
    ['--no-sandbox', '--release-complete', transactionId],
    'installation-completion'
  )
  ui = await HistoricalUiDriver.connect(home)
  await waitFor(
    () => coordinator.read(),
    (state) => state?.phase === 'committed',
    'actual installation completion'
  )
  await ui.closeApplication(home)
  assert.deepEqual(await initialization, { code: 0, signal: null })
  ui.disconnect()
  stage = 'installed-launcher'
  const exit = launch(join(root, 'start'), [], 'installed-launcher')
  ui = await HistoricalUiDriver.connect(home)
  await waitFor(
    () => ui!.inspect('document.visibilityState'),
    (visibility) => visibility === 'visible',
    'visible installed application window'
  )
  await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
  await ui.click('Einstellungen', 'body', true)
  await ui.expectText(`Installierte Version: ${artifact.receipt.version}`)
  await waitFor(
    () => coordinator.read(),
    (state) => state?.phase === 'committed',
    'installed launcher start acceptance'
  )
  await ui.closeApplication(home)
  assert.deepEqual(await exit, { code: 0, signal: null })
  assert.equal(
    readdirSync(temporary).filter((name) => name.startsWith('salt-launcher.'))
      .length,
    0
  )
  let signalAbort: {
    code: number | null
    signal: NodeJS.Signals | null
  } | null = null
  if (values['signal-abort']) {
    ui.disconnect()
    stage = 'signal-abort'
    const interrupted = launch(join(root, 'start'), [], 'signal-abort')
    ui = await HistoricalUiDriver.connect(home)
    await waitFor(
      () => ui!.inspect('document.visibilityState'),
      (visibility) => visibility === 'visible',
      'visible installed application window'
    )
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${artifact.receipt.version}`)
    assert(interrupted.pid)
    let completed = false
    void interrupted.then(() => {
      completed = true
    })
    process.kill(interrupted.pid, 'SIGTERM')
    const deadline = Date.now() + 10_000
    while (
      (!completed || isolatedProcesses(home).length > 0) &&
      Date.now() < deadline
    )
      await delay(100)
    assert(
      completed && isolatedProcesses(home).length === 0,
      `Signal left live processes: ${isolatedProcesses(home).join(',')}`
    )
    signalAbort = await interrupted
    assert.deepEqual(signalAbort, { code: 143, signal: null })
    assert.equal(coordinator.read()?.phase, 'committed')
    assert.equal(
      readdirSync(temporary).filter((name) => name.startsWith('salt-launcher.'))
        .length,
      0
    )
    ui.disconnect()
    stage = 'after-signal'
    const restarted = launch(join(root, 'start'), [], 'after-signal')
    ui = await HistoricalUiDriver.connect(home)
    await waitFor(
      () => ui!.inspect('document.visibilityState'),
      (visibility) => visibility === 'visible',
      'visible installed application window'
    )
    await ui.expectText('Wähle deine Kampagne oder beginne eine neue.')
    await ui.click('Einstellungen', 'body', true)
    await ui.expectText(`Installierte Version: ${artifact.receipt.version}`)
    await ui.closeApplication(home)
    assert.deepEqual(await restarted, { code: 0, signal: null })
  }
  stage = 'profile-readback'
  const after = await runHistoricalArtifact(directory, home, 'read')
  assert(after.result.response.ok)
  assert.deepEqual(after.result.response.result, seeded.result.response.result)
  validateMaintenanceLauncher(root)
  readHistoricalArtifact(directory)
  writeFileSync(
    join(home, 'installed-launcher-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        artifact: artifact.receipt,
        seeded,
        after,
        installation: coordinator.read(),
        initialization: await initialization,
        signalAbort,
        exit: await exit
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
  console.info('INSTALLED_LAUNCHER_PROFILE_PASS')
} catch (error) {
  try {
    const capture = async (read: () => unknown) => {
      try {
        return { value: await read() }
      } catch (failure) {
        return { error: String(failure) }
      }
    }
    writeFileSync(
      join(home, 'launcher-failure.json'),
      JSON.stringify(
        {
          stage,
          error: error instanceof Error ? error.stack : String(error),
          text: await capture(() => ui?.text()),
          screenshot: await capture(() =>
            ui?.command('Page.captureScreenshot', { format: 'png' })
          ),
          journal: await capture(() => coordinator.read()),
          processes: await capture(() => isolatedProcesses(home))
        },
        null,
        2
      ),
      { flag: 'wx' }
    )
  } catch (failure) {
    console.error('Launcher diagnostic failed', failure)
  }
  throw error
} finally {
  ui?.disconnect()
  for (const pid of isolatedProcesses(home)) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* Exited during cleanup. */
    }
  }
  await waitFor(
    () => isolatedProcesses(home),
    (pids) => pids.length === 0,
    'launcher cleanup'
  )
}

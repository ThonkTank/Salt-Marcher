import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { currentProgram } from '../src/main/release/deployment.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import { sha256 } from '../src/shared/maintenance/files.js'
import { validateMaintenanceLauncher } from '../src/shared/maintenance/launcher.js'
import { readUpdateArtifact } from './qualification/update-artifact.js'
import { runUpdateArtifact } from './qualification/update-artifact-runner.js'
import { prepareReleaseTestHome } from './qualification/release-test-home.js'
import { inspectReleaseFile } from './release/bundle.js'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import {
  HistoricalUiDriver,
  isolatedProcesses,
  trackIsolatedProcess,
  waitFor
} from './qualification/historical-ui-driver.js'

assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: { target: { type: 'string' }, home: { type: 'string' } }
})
const directory = resolve(z.string().parse(values.target))
const home = resolve(z.string().parse(values.home))
assert(!existsSync(home), 'First installation requires a new isolated home')
const target = readUpdateArtifact(directory)
const download = join(home, 'download')
mkdirSync(download, { recursive: true })
const executable = join(download, target.manifest.artifact.name)
copyFileSync(target.executable, executable)
writeFileSync(
  join(download, 'release-manifest.json'),
  JSON.stringify(target.manifest),
  { flag: 'wx' }
)
const root = join(home, 'salt-marcher')
assert(!existsSync(root))
const releaseTestHome =
  target.kind === 'release' ? prepareReleaseTestHome(home) : null
const coordinator = new MaintenanceCoordinator(root)
const server = createServer((_request, response) => {
  response.statusCode = 503
  response.end('Offline first-install qualification')
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address !== 'string')
const feed = `http://127.0.0.1:${address.port}`
const exits: Promise<{ code: number | null; signal: NodeJS.Signals | null }>[] =
  []
let ui: HistoricalUiDriver | undefined
async function launch(path: string) {
  const temporary = join(home, `launch-${exits.length}`)
  mkdirSync(temporary)
  const log = openSync(`${temporary}.log`, 'wx')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...releaseTestHome?.environment,
    ...(releaseTestHome
      ? {
          SALT_MARCHER_RELEASE_UI_QUALIFICATION: 'true',
          SALT_MARCHER_RELEASE_TEST_FEED: feed
        }
      : {}),
    XDG_DATA_HOME: home,
    TMPDIR: temporary,
    APPIMAGE_EXTRACT_AND_RUN: '1',
    SALT_MARCHER_HISTORICAL_UI: 'true',
    SALT_MARCHER_HISTORICAL_UI_FEED: feed
  }
  delete env['ELECTRON_RUN_AS_NODE']
  const child = spawn(path, ['--no-sandbox'], {
    env,
    stdio: ['ignore', log, log]
  })
  closeSync(log)
  if (child.pid) trackIsolatedProcess(home, child.pid)
  exits.push(
    new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve({ code, signal }))
    })
  )
  return HistoricalUiDriver.connect(home)
}
try {
  ui = await launch(executable)
  await ui.click('Auf diesem Rechner installieren', '.release-settings')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  const transaction = await waitFor(
    () => coordinator.read(),
    (value) => value?.phase === 'committed',
    'first installation accepted'
  )
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.expectText('Noch keine Kampagne vorhanden.')
  validateMaintenanceLauncher(root)
  const installed = currentProgram(root)
  assert(installed)
  assert.equal(installed.sha256, target.manifest.artifact.sha256)
  assert.equal(sha256(executable), target.manifest.artifact.sha256)
  const desktopPath = join(home, 'applications', 'org.saltmarcher.app.desktop')
  const desktop = readFileSync(desktopPath, 'utf8')
  assert(desktop.includes(join(root, 'start')))
  await ui.closeApplication(home)
  ui = undefined
  ui = await launch(join(root, 'start'))
  await ui.expectText('Noch keine Kampagne vorhanden.')
  assert.deepEqual(coordinator.read(), transaction)
  assert.deepEqual(currentProgram(root), installed)
  await ui.closeApplication(home)
  ui = undefined
  const processExits = await Promise.all(exits)
  assert(
    processExits.every(({ code, signal }) => code === 0 && signal === null)
  )
  const installedArtifact = inspectReleaseFile(
    join(root, 'deployments', installed.deployment, 'SaltMarcher.AppImage'),
    target.manifest.artifact.bytes,
    false
  )
  assert.equal(installedArtifact.bytes, target.manifest.artifact.bytes)
  assert.equal(installedArtifact.sha256, target.manifest.artifact.sha256)
  const targetIdentity =
    target.kind === 'release'
      ? await runUpdateArtifact(directory, home, 'identity')
      : null
  assert.deepEqual(readUpdateArtifact(directory), target)
  assert.deepEqual(coordinator.read(), transaction)
  assert.deepEqual(currentProgram(root), installed)
  writeFileSync(
    join(home, 'first-install-evidence.json'),
    JSON.stringify(
      {
        formatVersion: target.kind === 'release' ? 2 : 1,
        coverage:
          'empty-profile-first-install-and-installed-starter-restart-not-profile-import',
        target:
          target.kind === 'historical-fixture'
            ? target.provenance.receipt
            : target.manifest,
        targetProvenance: target.provenance,
        targetIdentity,
        transaction,
        installed,
        installedArtifact,
        desktop,
        processExits
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
} catch (error) {
  writeFileSync(
    join(home, 'first-install-failure.json'),
    JSON.stringify(
      { error: error instanceof Error ? error.stack : String(error) },
      null,
      2
    ),
    { flag: 'wx' }
  )
  throw error
} finally {
  ui?.disconnect()
  for (const pid of isolatedProcesses(home)) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
        console.error('First-install cleanup signal failed:', error)
    }
  }
  await waitFor(
    () => isolatedProcesses(home),
    (pids) => pids.length === 0,
    'first-install cleanup'
  )
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}

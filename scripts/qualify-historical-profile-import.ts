import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  copyFileSync,
  cpSync,
  readdirSync,
  lstatSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import Database from 'better-sqlite3'
import { acquireProfileAccess } from '../src/main/local-profile/profile-access.js'
import { readVerifiedBackup } from '../src/core/maintenance/verified-backup.js'
import { currentProgram } from '../src/main/release/deployment.js'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import { sha256 } from '../src/shared/maintenance/files.js'
import { validateMaintenanceLauncher } from '../src/shared/maintenance/launcher.js'
import {
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'
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
const sourceRoot = join(home, 'salt-marcher-local')
const sourceProfile = join(sourceRoot, 'profile')
const sourceProof = JSON.parse(
  readFileSync(join(home, 'local-schema-update-evidence.json'), 'utf8')
) as {
  seed: { result: { response: { ok: boolean; result: unknown } } }
  second: { transaction: unknown }
}
assert(sourceProof.seed.result.response.ok)
assert.deepEqual(
  new MaintenanceCoordinator(sourceRoot).read(),
  sourceProof.second.transaction
)
const sourceBefore = inventory(sourceProfile, false)
const target = readHistoricalArtifact(directory)
const download = join(home, 'download')
mkdirSync(download, { recursive: true })
const executable = join(download, target.receipt.artifact.name)
copyFileSync(target.executable, executable)
writeFileSync(
  join(download, 'release-manifest.json'),
  JSON.stringify(
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
  ),
  { flag: 'wx' }
)
const root = join(home, 'salt-marcher')
assert(!existsSync(root))
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
function inventory(path: string, logical: boolean): unknown {
  return readdirSync(path)
    .sort()
    .filter((name) => !logical || !/-(wal|shm)$/.test(name))
    .map((name) => {
      const file = join(path, name)
      const stat = lstatSync(file)
      assert(
        !stat.isSymbolicLink(),
        'Qualification fixture must not contain links'
      )
      if (stat.isDirectory())
        return { name, children: inventory(file, logical) }
      assert(stat.isFile())
      if (logical && name.endsWith('.sqlite')) {
        const db = new Database(file, { readonly: true, fileMustExist: true })
        try {
          assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
          const tables = db
            .prepare(
              "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            .all() as { name: string; sql: string }[]
          return {
            name,
            version: db.pragma('user_version', { simple: true }),
            tables: tables.map((table) => ({
              ...table,
              rows: db
                .prepare(
                  'SELECT * FROM "' + table.name.replaceAll('"', '""') + '"'
                )
                .all()
                .map((row) => JSON.stringify(row))
                .sort()
            }))
          }
        } finally {
          db.close()
        }
      }
      return { name, sha256: sha256(file) }
    })
}
function snapshot(root: string, logical: boolean): unknown {
  const lease = acquireProfileAccess(join(root, 'profile'), 'installer', root)
  try {
    return inventory(lease.profile, logical)
  } finally {
    lease.release()
  }
}
const nativeActions: { title: string; window: string; action: string }[] = []
function visibleNativeWindows() {
  const found = spawnSync(
    'xdotool',
    ['search', '--onlyvisible', '--name', '.*'],
    { encoding: 'utf8', timeout: 5000 }
  )
  return found.stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((window) => {
      const name = spawnSync('xdotool', ['getwindowname', window], {
        encoding: 'utf8',
        timeout: 2000
      })
      return { window, title: name.stdout.trim(), status: name.status }
    })
}
async function nativeWindow(title: string): Promise<string> {
  return waitFor(
    () => {
      const found = spawnSync(
        'xdotool',
        ['search', '--onlyvisible', '--name', `^${title}$`],
        { encoding: 'utf8', timeout: 2000 }
      )
      if (found.status !== 0) return ''
      const ids = found.stdout.trim().split(/\s+/)
      assert.equal(ids.length, 1, 'Native dialog must be unambiguous')
      return ids[0]!
    },
    Boolean,
    `native dialog ${title}`
  )
}
function keys(window: string, args: string[]) {
  const focused = spawnSync('xdotool', ['windowfocus', '--sync', window], {
    encoding: 'utf8',
    timeout: 5000
  })
  assert.equal(focused.status, 0, focused.stderr)
  const result = spawnSync('xdotool', args, { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
}
async function chooseSource() {
  const title = 'Profilordner einer installierten SaltMarcher-App auswählen'
  const window = await nativeWindow(title)
  keys(window, ['key', '--clearmodifiers', 'ctrl+l'])
  keys(window, ['type', '--clearmodifiers', '--', sourceProfile])
  keys(window, ['key', '--clearmodifiers', 'Return'])
  let previousWindows = ''
  const windows = await waitFor(
    visibleNativeWindows,
    (value) => {
      const current = JSON.stringify(value)
      const stable =
        current === previousWindows &&
        value.some((entry) => entry.window === window)
      previousWindows = current
      return stable
    },
    'stable native folder chooser windows'
  )
  if (windows.some((entry) => entry.title === 'salt-marcher')) {
    keys(window, ['key', '--clearmodifiers', 'Escape'])
    await waitFor(
      visibleNativeWindows,
      (value) =>
        value.some((entry) => entry.window === window) &&
        !value.some((entry) => entry.title === 'salt-marcher'),
      'path completion dismissed without closing chooser'
    )
  }
  // Select the profile itself in its parent, rather than a child inside it.
  keys(window, ['key', '--clearmodifiers', 'alt+Up'])
  // Position verified in the retained screenshot of this fixed GTK guest.
  const geometry = spawnSync(
    'xdotool',
    ['getwindowgeometry', '--shell', window],
    { encoding: 'utf8', timeout: 5000 }
  )
  assert.equal(geometry.status, 0, geometry.stderr)
  const width = Number(/^WIDTH=(\d+)$/m.exec(geometry.stdout)?.[1])
  const height = Number(/^HEIGHT=(\d+)$/m.exec(geometry.stdout)?.[1])
  assert(width >= 600 && height >= 400 && width <= 1920 && height <= 1080)
  writeFileSync(
    join(home, 'native-before-open.json'),
    spawnSync(
      'python3',
      [
        join(
          dirname(fileURLToPath(import.meta.url)),
          'native-dialog-snapshot.py'
        )
      ],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }
    ).stdout,
    { flag: 'wx' }
  )
  keys(window, [
    'mousemove',
    '--window',
    window,
    String(width - 50),
    String(height - 24),
    'click',
    '1'
  ])
  nativeActions.push({
    title,
    window,
    action: 'choose actual source profile directory'
  })
  const confirmationTitle = 'Vollständiges Profil übernehmen'
  const confirmation = await nativeWindow(confirmationTitle)
  keys(confirmation, ['key', '--clearmodifiers', 'Tab', 'Return'])
  nativeActions.push({
    title: confirmationTitle,
    window: confirmation,
    action: 'confirm full profile replacement'
  })
}
async function readTarget(name: string) {
  const readHome = join(home, name)
  const lease = acquireProfileAccess(join(root, 'profile'), 'installer', root)
  try {
    cpSync(lease.profile, join(readHome, 'salt-marcher/profile'), {
      recursive: true,
      errorOnExist: true,
      force: false
    })
  } finally {
    lease.release()
  }
  const result = await runHistoricalArtifact(directory, readHome, 'read')
  assert(result.result.response.ok)
  assert.deepEqual(
    result.result.response.result,
    sourceProof.seed.result.response.result
  )
  return result
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
  assert.equal(installed.sha256, target.receipt.artifact.sha256)
  assert.equal(sha256(executable), target.receipt.artifact.sha256)
  const desktopPath = join(home, 'applications', 'org.saltmarcher.app.desktop')
  const desktop = readFileSync(desktopPath, 'utf8')
  assert(desktop.includes(join(root, 'start')))
  await ui.closeApplication(home)
  ui = undefined
  const empty = snapshot(root, true)
  ui = await launch(join(root, 'start'))
  await ui.expectText('Noch keine Kampagne vorhanden.')
  await ui.click('Einstellungen', 'body', true)
  await ui.click('Profil von SaltMarcher Local übernehmen', '.release-settings')
  await ui.click('Bestätigen', '[role="alertdialog"]')
  await chooseSource()
  const imported = await waitFor(
    () => coordinator.read(),
    (value) => value?.phase === 'committed' && value.id !== transaction?.id,
    'profile import accepted'
  )
  assert(imported?.backup)
  ui.disconnect()
  ui = await HistoricalUiDriver.connect(home)
  await ui.closeApplication(home)
  ui = undefined
  const after = await readTarget('import-after-read')
  assert.deepEqual(snapshot(sourceRoot, false), sourceBefore)
  assert.deepEqual(
    new MaintenanceCoordinator(sourceRoot).read(),
    sourceProof.second.transaction
  )
  const backup = readVerifiedBackup(join(root, 'backups', imported.backup))
  assert.equal(backup.manifest.formatVersion, 2)
  assert.deepEqual(inventory(backup.data, true), empty)
  ui = await launch(join(root, 'start'))
  await ui.closeApplication(home)
  ui = undefined
  const restarted = await readTarget('import-restart-read')
  assert.deepEqual(snapshot(sourceRoot, false), sourceBefore)
  const processExits = await Promise.all(exits)
  assert(
    processExits.every(({ code, signal }) => code === 0 && signal === null)
  )
  readHistoricalArtifact(directory)
  writeFileSync(
    join(home, 'profile-import-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        coverage:
          'installed-local-profile-import-through-native-dialogs-source-unchanged-backup-and-restart',
        target: target.receipt,
        transaction,
        installed,
        desktop,
        sourceBefore,
        empty,
        imported,
        after,
        restarted,
        backupManifest: backup.manifest,
        backupManifestSha256: backup.manifestSha256,
        nativeActions,
        processExits
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
} catch (error) {
  writeFileSync(
    join(home, 'profile-import-failure.json'),
    JSON.stringify(
      {
        error: error instanceof Error ? error.stack : String(error),
        nativeActions,
        nativeWindows: visibleNativeWindows(),
        nativeScreenshot: spawnSync(
          'python3',
          [
            join(
              dirname(fileURLToPath(import.meta.url)),
              'native-dialog-snapshot.py'
            )
          ],
          { encoding: 'utf8', timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }
        ).stdout
      },
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

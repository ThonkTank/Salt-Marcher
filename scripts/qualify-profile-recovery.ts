import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { ProfileMaintenance } from '../src/core/maintenance/profile-maintenance.js'
import { stageDeployment, setCurrent } from '../src/main/release/deployment.js'
import { browserRuntimePath } from '../src/main/local-profile/application-profile.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import { durableJson, sha256 } from '../src/shared/maintenance/files.js'
import { releaseManifestSchema } from '../src/shared/contracts/release.js'
import { buildReceiptSchema } from '../src/shared/contracts/build-info.js'

const artifact = resolve(
  process.argv[2] ?? 'release/release/SaltMarcher-0.2.0-x64.AppImage'
)
const receipt = buildReceiptSchema.parse(
  JSON.parse(readFileSync('out/build-receipt.json', 'utf8'))
)
assert.equal(receipt.build.channel, 'release')
const version = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync('package.json', 'utf8'))).version
const workspace = mkdtempSync(join(tmpdir(), 'salt-ui-recovery-'))
const root = join(workspace, 'salt-marcher')
mkdirSync(root)
const artifactHash = sha256(artifact)
const deployment = stageDeployment(
  root,
  artifact,
  releaseManifestSchema.parse({
    formatVersion: 1,
    repository: 'ThonkTank/Salt-Marcher',
    version,
    commit: receipt.build.commit,
    platform: 'linux',
    arch: 'x64',
    schemaVersions: receipt.build.schemaVersions,
    artifact: {
      name: `SaltMarcher-${version}-x64.AppImage`,
      bytes: statSync(artifact).size,
      sha256: artifactHash
    }
  })
)
setCurrent(root, deployment)
const maintenance = new ProfileMaintenance(root, version, 'profile')
const store = new CampaignStore(maintenance.data)
store.create('UI Recovery Campaign')
store.close()
const note = join(root, 'profile', 'own-note.txt')
writeFileSync(note, 'saved original content')
const backup = await maintenance.backup()
assert.ok(backup)
writeFileSync(note, 'later valuable content')
writeFileSync(
  join(maintenance.data, 'installation.sqlite'),
  'damaged live installation'
)
const executable = join(root, 'deployments', deployment, 'SaltMarcher.AppImage')
let socket: WebSocket | undefined
const log = join(workspace, 'application.log')
const child = spawn(executable, ['--no-sandbox', '--remote-debugging-port=0'], {
  env: {
    ...process.env,
    XDG_DATA_HOME: workspace,
    APPIMAGE_EXTRACT_AND_RUN: '1',
    TMPDIR: workspace
  },
  stdio: ['ignore', 'pipe', 'pipe']
})
let output = ''
child.stdout.on('data', (chunk: Buffer) => {
  output += chunk.toString()
  writeFileSync(log, output)
})
child.stderr.on('data', (chunk: Buffer) => {
  output += chunk.toString()
  writeFileSync(log, output)
})
child.on('error', (error) => {
  output += String(error)
  writeFileSync(log, output)
})

async function until<T>(
  read: () => T | Promise<T>,
  accepted: (value: T) => boolean,
  label: string
): Promise<T> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const value = await read()
    if (accepted(value)) return value
    await delay(200)
  }
  throw new Error(`Timed out: ${label}; evidence: ${workspace}`)
}
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()
let serial = 0
async function command(
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  assert.ok(socket)
  const id = ++serial
  const result = new Promise<unknown>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket!.send(JSON.stringify({ id, method, params }))
  })
  return result
}
async function click(label: string): Promise<void> {
  const box = await until(
    async () => {
      const raw = await command('Runtime.evaluate', {
        expression: `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) return null; const r = button.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
        returnByValue: true
      })
      return z
        .object({
          result: z.object({
            value: z.object({ x: z.number(), y: z.number() }).nullable()
          })
        })
        .parse(raw).result.value
    },
    (value) => value !== null,
    `visible button ${label}`
  )
  assert.ok(box)
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...box,
    button: 'left',
    clickCount: 1
  })
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...box,
    button: 'left',
    clickCount: 1
  })
}
try {
  const portFile = join(
    browserRuntimePath(join(root, 'profile')),
    'DevToolsActivePort'
  )
  await until(() => existsSync(portFile), Boolean, 'debugging port')
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0])
  const pages = await until(
    async () =>
      z
        .array(
          z.object({
            type: z.string(),
            webSocketDebuggerUrl: z.string().optional()
          })
        )
        .parse(
          await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        ),
    (value) => value.some((page) => page.type === 'page'),
    'renderer page'
  )
  const url = pages.find((page) => page.type === 'page')?.webSocketDebuggerUrl
  assert.ok(url)
  socket = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    socket!.addEventListener('open', () => resolve(), { once: true })
    socket!.addEventListener(
      'error',
      () => reject(new Error('CDP connection failed')),
      { once: true }
    )
  })
  socket.addEventListener('message', (event) => {
    const packet = z
      .object({
        id: z.number().optional(),
        result: z.unknown().optional(),
        error: z.object({ message: z.string() }).optional()
      })
      .parse(JSON.parse(String(event.data)))
    if (packet.id === undefined) return
    const handler = pending.get(packet.id)
    if (!handler) return
    pending.delete(packet.id)
    if (packet.error) handler.reject(new Error(packet.error.message))
    else handler.resolve(packet.result)
  })
  socket.addEventListener('close', () => {
    for (const handler of pending.values())
      handler.reject(new Error('CDP closed'))
    pending.clear()
  })
  await click('Sicherungen und Wiederherstellung öffnen')
  await click('Wiederherstellen')
  assert.equal(new MaintenanceCoordinator(root).read(), null)
  try {
    await click('Bestätigen')
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'CDP closed') throw error
  }
  const journal = await until(
    () => new MaintenanceCoordinator(root).read(),
    (state) => state?.phase === 'committed',
    'restarted application commits restore'
  )
  assert.ok(journal?.backup)
  assert.equal(journal.operation, 'restore')
  assert.equal(journal.previous?.deployment, deployment)
  assert.equal(journal.next.deployment, deployment)
  assert.equal(readFileSync(note, 'utf8'), 'saved original content')
  const saved = join(root, 'backups', journal.backup, 'data')
  assert.equal(
    readFileSync(join(saved, 'own-note.txt'), 'utf8'),
    'later valuable content'
  )
  assert.equal(
    readFileSync(join(saved, 'campaign-data', 'installation.sqlite'), 'utf8'),
    'damaged live installation'
  )
  assert.equal(sha256(executable), artifactHash)
  durableJson(join(workspace, 'result.json'), {
    ok: true,
    artifactHash,
    commit: receipt.build.commit,
    backup,
    transaction: journal.id,
    workspace
  })
  console.info(`Profile recovery UI passed: ${workspace}/result.json`)
} finally {
  socket?.close()
  // Only processes carrying this unique isolated XDG root belong to this run.
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const environment = readFileSync(`/proc/${entry}/environ`, 'utf8').split(
        '\0'
      )
      if (environment.includes(`XDG_DATA_HOME=${workspace}`))
        process.kill(Number(entry), 'SIGTERM')
    } catch {
      /* A process may already have exited. */
    }
  }
  console.info(`Recovery evidence retained: ${workspace}`)
}

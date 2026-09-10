import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import Database from 'better-sqlite3'
import { z } from 'zod'
import { localArtifactManifestSchema } from '../src/shared/contracts/build-info.js'
import { acquireProfileAccess } from '../src/main/local-profile/profile-access.js'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import { sha256 } from '../src/shared/maintenance/files.js'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import { runHistoricalArtifact } from './qualification/historical-artifact-runner.js'
import type { advanceLocalAppInstallation } from './local-app-installation.js'
import type { verifyLocalRuntimeStartup } from './local-installation/runtime-start.js'

assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: Object.fromEntries(
    [
      'baseline',
      'target',
      'baseline-adapter',
      'target-adapter',
      'fixture-baseline',
      'fixture-target',
      'home'
    ].map((name) => [name, { type: 'string' as const }])
  )
})
const directory = (name: string) => resolve(z.string().parse(values[name]))
const home = directory('home')
assert(!existsSync(home), 'Local qualification requires a new home')
mkdirSync(home)
const source = `${home}-source`
const root = join(home, 'salt-marcher-local')
const profile = join(root, 'profile')
const identitySchema = z
  .object({
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    dirty: z.literal(false),
    workspaceFingerprint: z.string().length(64),
    appBuildInputFingerprint: z.string().length(64)
  })
  .strict()
type Adapter = {
  advanceLocalAppInstallation: typeof advanceLocalAppInstallation
  verifyLocalRuntimeStartup: typeof verifyLocalRuntimeStartup
}
async function load(kind: 'baseline' | 'target') {
  const artifactDirectory = directory(kind)
  const artifact = join(artifactDirectory, 'SaltMarcher-Local-0.2.0.AppImage')
  const manifestPath = `${artifact}.manifest.json`
  const manifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, 'utf8'))
  )
  const adapterDirectory = directory(`${kind}-adapter`)
  const receipt = z
    .object({
      sourceIdentity: identitySchema,
      artifactSha256: z.string(),
      artifactManifestSha256: z.string(),
      adapterSha256: z.string(),
      adapterPath: z.literal('local-installation/adapter.mjs'),
      packageSha256: z.string(),
      workers: z
        .array(
          z.object({
            path: z.enum([
              'profile-backup-worker.ts',
              'sqlite-online-backup-worker.ts'
            ]),
            sha256: z.string()
          })
        )
        .length(2),
      iconSha256: z.string()
    })
    .parse(
      JSON.parse(
        readFileSync(join(adapterDirectory, 'adapter-manifest.json'), 'utf8')
      )
    )
  assert.equal(sha256(artifact), manifest.artifactSha256)
  assert.equal(receipt.artifactSha256, manifest.artifactSha256)
  assert.equal(sha256(manifestPath), receipt.artifactManifestSha256)
  assert.equal(
    sha256(join(adapterDirectory, receipt.adapterPath)),
    receipt.adapterSha256
  )
  assert.equal(sha256(join(adapterDirectory, 'icon.png')), receipt.iconSha256)
  assert.equal(
    sha256(join(adapterDirectory, 'package.json')),
    receipt.packageSha256
  )
  assert.equal(new Set(receipt.workers.map((worker) => worker.path)).size, 2)
  for (const worker of receipt.workers)
    assert.equal(sha256(join(adapterDirectory, worker.path)), worker.sha256)
  const build = manifest.receipt.build
  assert.deepEqual(receipt.sourceIdentity, {
    commit: build.commit,
    dirty: build.dirty,
    workspaceFingerprint: build.workspaceFingerprint,
    appBuildInputFingerprint: build.appBuildInputFingerprint
  })
  assert.deepEqual(build.schemaVersions, {
    installation: 42,
    campaign: kind === 'baseline' ? 41 : 42
  })
  const adapter = (await import(
    pathToFileURL(join(adapterDirectory, receipt.adapterPath)).href
  )) as Adapter
  return {
    adapter,
    receipt,
    manifest,
    options: {
      workspaceRoot: adapterDirectory,
      xdgDataHome: home,
      artifactPath: artifact,
      artifactManifestPath: manifestPath,
      iconSourcePath: join(adapterDirectory, 'icon.png'),
      readWorkspaceIdentity: () => receipt.sourceIdentity
    }
  }
}
function copyLocked(from: string, to: string, installationRoot: string) {
  const lease = acquireProfileAccess(from, 'installer', installationRoot)
  try {
    cpSync(lease.profile, to, {
      recursive: true,
      errorOnExist: true,
      force: false
    })
  } finally {
    lease.release()
  }
}
async function readLocal(fixture: string, name: string) {
  const readHome = join(home, name)
  copyLocked(profile, join(readHome, 'salt-marcher/profile'), root)
  const result = await runHistoricalArtifact(fixture, readHome, 'read')
  assert(result.result.response.ok)
  return result
}
function installAndStart(
  value: Awaited<ReturnType<typeof load>>,
  name: string
) {
  process.chdir(value.options.workspaceRoot)
  const installed = value.adapter.advanceLocalAppInstallation(
    value.options,
    'activated'
  )
  const temporary = join(home, `runtime-${name}`)
  mkdirSync(temporary)
  const result = value.adapter.verifyLocalRuntimeStartup(
    root,
    value.manifest.artifactSha256,
    (completion) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        XDG_DATA_HOME: home,
        TMPDIR: temporary,
        APPIMAGE_EXTRACT_AND_RUN: '1'
      }
      delete env['ELECTRON_RUN_AS_NODE']
      const child = spawnSync(
        installed.paths.appImage,
        [
          '--smoke-test',
          '--session-generation-smoke',
          '--installed-runtime-verification',
          '--no-sandbox',
          `--user-data-dir=${profile}`,
          ...completion
        ],
        { env, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }
      )
      writeFileSync(
        join(home, `${name}-runtime.log`),
        `${child.stdout}\n${child.stderr}`,
        { flag: 'wx' }
      )
      if (child.error) throw child.error
      assert.equal(child.status, 0)
      assert.equal(child.signal, null)
      const records: unknown[] = child.stdout.split(/\r?\n/).flatMap((line) => {
        try {
          const record: unknown = JSON.parse(line)
          return [record]
        } catch {
          return []
        }
      })
      const schema = z.object({
        component: z.literal('installed-runtime-verification'),
        event: z.literal('ready'),
        build: z.object({ commit: z.string(), channel: z.literal('local') }),
        runtime: z.object({ status: z.literal('ready') })
      })
      const ready = records.flatMap((record) => {
        const parsed = schema.safeParse(record)
        return parsed.success ? [parsed.data] : []
      })
      assert.equal(ready.length, 1)
      assert.equal(ready[0]!.build.commit, value.manifest.receipt.build.commit)
      return { exitCode: child.status, ready: ready[0] }
    }
  )
  const transaction = new MaintenanceCoordinator(root).read()
  assert.equal(transaction?.phase, 'committed')
  return { installed, transaction, result }
}
try {
  const native = new Database(':memory:')
  assert.equal(native.pragma('integrity_check', { simple: true }), 'ok')
  native.close()
  const baseline = await load('baseline')
  const target = await load('target')
  const seed = await runHistoricalArtifact(
    directory('fixture-baseline'),
    source,
    'seed'
  )
  assert(seed.result.response.ok)
  mkdirSync(root)
  copyLocked(
    join(source, 'salt-marcher/profile'),
    profile,
    join(source, 'salt-marcher')
  )
  const first = installAndStart(baseline, 'baseline')
  const before = await readLocal(directory('fixture-baseline'), 'before-read')
  assert(before.result.response.ok)
  assert.deepEqual(before.result.response.result, seed.result.response.result)
  const second = installAndStart(target, 'target')
  const after = await readLocal(directory('fixture-target'), 'after-read')
  assert(after.result.response.ok)
  assert.deepEqual(after.result.response.result, seed.result.response.result)
  const unchanged = await runHistoricalArtifact(
    directory('fixture-baseline'),
    source,
    'read'
  )
  assert(unchanged.result.response.ok)
  assert.deepEqual(
    unchanged.result.response.result,
    seed.result.response.result
  )
  writeFileSync(
    join(home, 'local-schema-update-evidence.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        coverage:
          'original-local-installers-schema-update-real-runtime-acceptance-not-interruption-or-handoff',
        baseline: baseline.receipt,
        target: target.receipt,
        first,
        second,
        seed,
        before,
        after,
        unchanged
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
} catch (error) {
  writeFileSync(
    join(home, 'local-schema-update-failure.json'),
    JSON.stringify(
      { error: error instanceof Error ? error.stack : String(error) },
      null,
      2
    ),
    { flag: 'wx' }
  )
  throw error
}

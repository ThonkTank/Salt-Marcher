import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { z } from 'zod'
import { archiveVmEvidence } from './qualification/vm-evidence.js'
import {
  acquireEnvironmentFile,
  qualificationEnvironment,
  verifyEnvironmentFile
} from './release/qualification-environment.js'
import { inspectReleaseFile } from './release/bundle.js'

const { values } = parseArgs({
  options: {
    output: { type: 'string' },
    cache: { type: 'string' },
    engine: { type: 'string', default: 'podman' },
    'tool-image': { type: 'string' }
  }
})
const engine = z.enum(['podman', 'docker']).parse(values.engine)
const root = resolve(z.string().min(1).parse(values.output)),
  cache = resolve(z.string().min(1).parse(values.cache))
assert(!existsSync(root), 'VM preparation output must be new')
assert(
  !root.includes(':') && !cache.includes(':'),
  'Container mount paths cannot contain colons'
)
let storage = dirname(root)
while (!existsSync(storage)) storage = dirname(storage)
const space = statfsSync(storage, { bigint: true })
assert(
  space.bavail * space.bsize >= 43n * 1024n ** 3n,
  'VM preparation requires 43 GiB free space'
)
assert(existsSync('/dev/kvm'), 'A KVM-capable host is required')
mkdirSync(root, { recursive: true })
mkdirSync(cache, { recursive: true })
const source = dirname(fileURLToPath(import.meta.url))
const exec = promisify(execFile)
const command = async (file: string, args: string[], timeout = 300_000) =>
  (
    await exec(file, args, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, SALT_MARCHER_VM_ENGINE: engine }
    })
  ).stdout.trim()
const base = join(cache, qualificationEnvironment.base.name),
  node = join(cache, qualificationEnvironment.node.name)
await acquireEnvironmentFile(base, qualificationEnvironment.base)
await acquireEnvironmentFile(node, qualificationEnvironment.node)
let tool = values['tool-image']
if (!tool) {
  tool = `salt-marcher-qualification-vm:${randomUUID()}`
  await command(
    engine,
    [
      'build',
      '--memory=1g',
      '--memory-swap=1g',
      '--cpu-period=100000',
      '--cpu-quota=100000',
      '--tag',
      tool,
      '--file',
      join(source, 'qualification/Containerfile'),
      join(source, 'qualification')
    ],
    600_000
  )
}
const toolImageId = await command(engine, [
  'image',
  'inspect',
  '--format',
  '{{.Id}}',
  tool
])
assert(/^(sha256:)?[a-f0-9]{64}$/.test(toolImageId))
const container = (args: string[], mounts: string[] = [], timeout = 300_000) =>
  command(
    engine,
    [
      'run',
      '--rm',
      '--memory=1g',
      '--memory-swap=1g',
      '--pids-limit=64',
      '--cpus=1',
      '--security-opt',
      'label=disable',
      '-v',
      `${root}:/work:rw`,
      ...mounts,
      toolImageId,
      ...args
    ],
    timeout
  )
const seed = join(root, 'bootstrap-seed')
mkdirSync(seed)
copyFileSync(
  join(source, 'qualification/bootstrap-cloud-init.yaml'),
  join(seed, 'user-data')
)
writeFileSync(
  join(seed, 'meta-data'),
  `instance-id: ${randomUUID()}\nlocal-hostname: salt-marcher-qualification\n`,
  { flag: 'wx' }
)
await container([
  'genisoimage',
  '-quiet',
  '-output',
  '/work/bootstrap-seed.img',
  '-volid',
  'cidata',
  '-joliet',
  '-rock',
  '-graft-points',
  'user-data=/work/bootstrap-seed/user-data',
  'meta-data=/work/bootstrap-seed/meta-data'
])
const run = join(root, 'bootstrap-run')
await command(
  'bash',
  [
    join(source, 'qualification/run-historical-vm.sh'),
    toolImageId,
    base,
    join(root, 'bootstrap-seed.img'),
    run,
    '1800',
    'bootstrap-network'
  ],
  1850_000
)
const archived = await archiveVmEvidence(run, join(root, 'bootstrap-evidence'))
assert.equal(archived.vmExitCode, 0)
assert.deepEqual(archived.testExitCodes, [0])
const evidence = z
  .object({
    formatVersion: z.literal(1),
    coverage: z.literal('guest-bootstrap-only-no-application-test'),
    hostBootId: z.uuid(),
    guestBootId: z.uuid(),
    kernel: z.string().min(1),
    packages: z.string().min(1)
  })
  .strict()
  .parse(
    JSON.parse(
      readFileSync(
        join(
          root,
          'bootstrap-evidence/export-0/reports/bootstrap-evidence.json'
        ),
        'utf8'
      )
    )
  )
assert.equal(
  evidence.hostBootId,
  readFileSync(join(run, 'host-boot-id'), 'utf8').trim()
)
assert.notEqual(evidence.hostBootId, evidence.guestBootId)
for (const name of ['libgtk-3-0t64', 'libnss3', 'xvfb', 'xdotool', 'dbus-x11'])
  assert(
    evidence.packages
      .split('\n')
      .some(
        (line) => line.startsWith(`${name}\t`) || line.startsWith(`${name}:`)
      ),
    `Missing guest package ${name}`
  )
await container(
  [
    'qemu-img',
    'convert',
    '-O',
    'qcow2',
    '/work/bootstrap-run/guest.qcow2',
    '/work/prepared-guest.qcow2'
  ],
  ['-v', `${base}:/base.qcow2:ro`]
)
await container(['qemu-img', 'check', '/work/prepared-guest.qcow2'])
const info = z
  .object({
    format: z.literal('qcow2'),
    'virtual-size': z.literal(25769803776),
    'dirty-flag': z.literal(false)
  })
  .passthrough()
  .parse(
    JSON.parse(
      await container([
        'qemu-img',
        'info',
        '--output=json',
        '/work/prepared-guest.qcow2'
      ])
    )
  )
assert(
  !('backing-filename' in info) && !('full-backing-filename' in info),
  'Prepared guest still depends on a mutable backing file'
)
verifyEnvironmentFile(base, qualificationEnvironment.base)
verifyEnvironmentFile(node, qualificationEnvironment.node)
const prepared = inspectReleaseFile(
  join(root, 'prepared-guest.qcow2'),
  32 * 1024 ** 3,
  false
)
const bootstrap = inspectReleaseFile(
  join(seed, 'user-data'),
  1024 * 1024,
  false
)
writeFileSync(
  join(root, 'prepared-environment.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      environment: qualificationEnvironment,
      engine,
      toolImageId,
      bootstrapSha256: bootstrap.sha256,
      prepared: {
        name: 'prepared-guest.qcow2',
        bytes: prepared.bytes,
        sha256: prepared.sha256
      },
      evidence,
      archive: archived
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
)
// Only the successful, archived bootstrap overlay; the independent prepared image remains.
rmSync(join(run, 'guest.qcow2'))
console.info(
  `Prepared and verified isolated qualification environment: ${root}`
)

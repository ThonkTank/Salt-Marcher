import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statfsSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { z } from 'zod'
import { canonicalProfilePath } from '../src/shared/maintenance/profile-path.js'
import { archiveVmEvidence } from './qualification/vm-evidence.js'
import { readUpdateArtifact } from './qualification/update-artifact.js'
import { inspectReleaseFile, verifyReleaseBundle } from './release/bundle.js'
import { verifyComparisonFiles } from './release/comparison-fixture.js'
import { verifyPreparedEnvironment } from './release/prepared-environment.js'
import {
  qualificationEnvironment,
  verifyEnvironmentFile
} from './release/qualification-environment.js'
import {
  comparisonDirectory,
  qualificationCasePlan
} from './release/qualification-case-plan.js'
import { verifyQualificationRunners } from './release/qualification-runners.js'
import { releaseQualificationSchema } from './release/qualification.js'
import { receiveQualification } from './release/receive-qualification.js'
import {
  assertRequestedTarget,
  releaseRequestSchema
} from './release/request.js'

const { values } = parseArgs({
  options: Object.fromEntries(
    [
      'request',
      'target',
      'comparisons',
      'runners',
      'environment',
      'node',
      'work',
      'output',
      'workflow',
      'recovery-case',
      'engine'
    ].map((name) => [name, { type: 'string' as const }])
  )
})
const required = (name: string) => z.string().min(1).parse(values[name])
const path = (name: string) => resolve(required(name))
const read = (file: string) =>
  inspectReleaseFile(file, 4 * 1024 * 1024, true).content
const source = dirname(fileURLToPath(import.meta.url))
const engine = z.enum(['podman', 'docker']).parse(required('engine'))
const work = path('work'),
  output = path('output')
for (const directory of [work, output]) {
  assert.equal(canonicalProfilePath(directory), directory)
  assert(!existsSync(directory), 'Qualification work/output must be new')
  assert(
    !directory.includes(':'),
    'Container mount paths cannot contain colons'
  )
}
assert(relative(work, output).startsWith('../'), 'Output must be outside work')
assert(relative(output, work).startsWith('../'), 'Work must be outside output')
let storage = dirname(work)
while (!existsSync(storage)) storage = dirname(storage)
const space = statfsSync(storage, { bigint: true })
assert(
  space.bavail * space.bsize >= 43n * 1024n ** 3n,
  'Qualification requires 43 GiB free space'
)
assert(existsSync('/dev/kvm'), 'A KVM-capable host is required')
const requestBytes = read(path('request'))
const request = releaseRequestSchema.parse(
  JSON.parse(requestBytes.toString('utf8'))
)
const manifestBytes = read(join(path('target'), 'release-manifest.json'))
const manifest = assertRequestedTarget(
  request,
  JSON.parse(manifestBytes.toString('utf8'))
)
const target = readUpdateArtifact(path('target'))
assert.equal(target.kind, 'release')
assert.deepEqual(target.manifest, manifest)
const workflowBytes = read(path('workflow'))
// The authenticated publishing workflow supplies this identity. It is never obtained from guest output.
const workflow = releaseQualificationSchema.shape.workflow.parse(
  JSON.parse(workflowBytes.toString('utf8'))
)
assert.equal(workflow.commit, request.target.commit)
const runners = verifyQualificationRunners(path('runners'), workflow.commit)
const environment = verifyPreparedEnvironment(
  path('environment'),
  join(source, 'qualification/bootstrap-cloud-init.yaml')
)
assert.equal(environment.engine, engine)
verifyEnvironmentFile(path('node'), qualificationEnvironment.node)
const recoveryComparisonId = required('recovery-case')
const plan = qualificationCasePlan(request, recoveryComparisonId)
const comparisons = new Map<
  string,
  (typeof request.comparisons)[number]['baseline']
>()
for (const item of plan)
  for (const artifact of [
    item.comparison.baseline,
    ...item.comparison.intermediate
  ]) {
    const directory = comparisonDirectory(path('comparisons'), artifact)
    verifyComparisonFiles(directory, artifact)
    comparisons.set(directory, artifact)
  }
const expected = {
  request: requestBytes,
  manifest: manifestBytes,
  target,
  workflow,
  recoveryComparisonId,
  cases: plan.map((item) => ({
    id: item.comparison.id,
    baseline: readUpdateArtifact(
      comparisonDirectory(path('comparisons'), item.comparison.baseline)
    ),
    intermediate: item.comparison.intermediate.map((artifact) =>
      readUpdateArtifact(comparisonDirectory(path('comparisons'), artifact))
    )
  }))
}
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
const toolImageId = await command(engine, [
  'image',
  'inspect',
  '--format',
  '{{.Id}}',
  environment.toolImageId
])
assert.equal(
  toolImageId.replace(/^sha256:/, ''),
  environment.toolImageId.replace(/^sha256:/, '')
)
mkdirSync(work, { recursive: true })
const seed = join(work, 'seed'),
  payload = join(seed, 'payload')
mkdirSync(payload, { recursive: true })
const copied: {
  source: string
  destination: string
  bytes: number
  sha256: string
}[] = []
const copy = (from: string, to: string, limit: number) => {
  const before = inspectReleaseFile(from, limit, false)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to, constants.COPYFILE_EXCL)
  verifyEnvironmentFile(to, before)
  copied.push({
    source: from,
    destination: to,
    bytes: before.bytes,
    sha256: before.sha256
  })
}
copy(
  path('node'),
  join(payload, 'node.tar.xz'),
  qualificationEnvironment.node.bytes
)
copy(path('request'), join(payload, 'release-request.json'), 4 * 1024 * 1024)
copy(path('workflow'), join(payload, 'workflow.json'), 4 * 1024 * 1024)
for (const name of ['release-manifest.json', manifest.artifact.name])
  copy(
    join(path('target'), name),
    join(payload, 'target', name),
    name.endsWith('.AppImage') ? manifest.artifact.bytes : 4 * 1024 * 1024
  )
for (const item of runners.files)
  copy(
    join(path('runners'), item.name),
    join(payload, 'runners', item.name),
    item.bytes
  )
copy(
  join(path('runners'), 'qualification-runners.json'),
  join(payload, 'runners/qualification-runners.json'),
  1024 * 1024
)
for (const [directory, artifact] of comparisons) {
  const destination = comparisonDirectory(
    join(payload, 'comparisons'),
    artifact
  )
  const names = ['release-manifest.json', artifact.manifest.artifact.name]
  if (artifact.source.kind === 'qualification-fixture')
    names.push('historical-artifact.json', 'comparison-fixture.json')
  for (const name of names)
    copy(
      join(directory, name),
      join(destination, name),
      name.endsWith('.AppImage')
        ? artifact.manifest.artifact.bytes
        : 4 * 1024 * 1024
    )
  verifyComparisonFiles(destination, artifact)
}
assert(read(join(payload, 'release-request.json')).equals(requestBytes))
assert(read(join(payload, 'workflow.json')).equals(workflowBytes))
assert(
  read(join(payload, 'target/release-manifest.json')).equals(manifestBytes)
)
assert.deepEqual(
  readUpdateArtifact(join(payload, 'target')).manifest,
  target.manifest
)
verifyQualificationRunners(join(payload, 'runners'), workflow.commit)
verifyEnvironmentFile(
  join(payload, 'node.tar.xz'),
  qualificationEnvironment.node
)
const job = join(payload, 'job.json')
writeFileSync(job, JSON.stringify({ recoveryComparisonId }) + '\n', {
  flag: 'wx'
})
const sums = [
  ...copied.map((item) => ({ path: item.destination, sha256: item.sha256 })),
  { path: job, sha256: inspectReleaseFile(job, 4096, false).sha256 }
]
writeFileSync(
  join(payload, 'SHA256SUMS'),
  sums
    .map((item) => `${item.sha256}  ${relative(payload, item.path)}`)
    .join('\n') + '\n',
  { flag: 'wx' }
)
copyFileSync(
  join(source, 'qualification/release-cloud-init.yaml'),
  join(seed, 'user-data'),
  constants.COPYFILE_EXCL
)
writeFileSync(
  join(seed, 'meta-data'),
  `instance-id: ${randomUUID()}\nlocal-hostname: salt-marcher-qualification\n`,
  { flag: 'wx' }
)
await command(engine, [
  'run',
  '--rm',
  '--memory=1g',
  '--memory-swap=1g',
  '--pids-limit=64',
  '--cpus=1',
  '--network=none',
  '--security-opt',
  'label=disable',
  '-v',
  `${work}:/work:rw`,
  toolImageId,
  'genisoimage',
  '-quiet',
  '-output',
  '/work/seed.img',
  '-volid',
  'cidata',
  '-joliet',
  '-rock',
  '-graft-points',
  'user-data=/work/seed/user-data',
  'meta-data=/work/seed/meta-data',
  'payload=/work/seed/payload'
])
const run = join(work, 'vm-run')
try {
  await command(
    'bash',
    [
      join(source, 'qualification/run-historical-vm.sh'),
      toolImageId,
      join(path('environment'), environment.prepared.name),
      join(work, 'seed.img'),
      run,
      '3300'
    ],
    3350_000
  )
  const archive = await archiveVmEvidence(run, join(work, 'vm-evidence'))
  assert.equal(archive.vmExitCode, 0)
  assert.deepEqual(archive.testExitCodes, [0])
  const received = receiveQualification(
    join(work, 'vm-evidence/export-0/reports/release-output'),
    expected
  )
  for (const item of copied) {
    verifyEnvironmentFile(item.source, item)
    verifyEnvironmentFile(item.destination, item)
  }
  verifyPreparedEnvironment(
    path('environment'),
    join(source, 'qualification/bootstrap-cloud-init.yaml')
  )
  verifyQualificationRunners(path('runners'), workflow.commit)
  // Only after successful semantic verification does a new release bundle appear.
  mkdirSync(output, { recursive: true })
  for (const [name, bytes] of received.files)
    writeFileSync(join(output, name), bytes, { flag: 'wx' })
  copy(
    join(path('target'), manifest.artifact.name),
    join(output, manifest.artifact.name),
    manifest.artifact.bytes
  )
  verifyReleaseBundle(output, workflow)
  writeFileSync(
    join(work, 'qualification-transport.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        workflow,
        target: manifest.artifact,
        toolImageId,
        prepared: environment.prepared,
        archive
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  )
  // Only this successful, archived disposable overlay; original artifacts and profiles stay intact.
  rmSync(join(run, 'guest.qcow2'))
  console.info(`Verified release qualification bundle: ${output}`)
} catch (error) {
  writeFileSync(
    join(work, 'qualification-transport-failure.json'),
    JSON.stringify({
      formatVersion: 1,
      error: error instanceof Error ? error.message : String(error),
      retainedVm: run
    }) + '\n',
    { flag: 'wx' }
  )
  throw error
}

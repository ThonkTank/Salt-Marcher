import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { z } from 'zod'
import {
  buildReceiptSchema,
  localArtifactManifestSchema
} from '../src/shared/contracts/build-info.js'
import { readBuildToolchain, readWorkspaceIdentity } from './build-identity.js'
import { verifyBuildReceipt } from './build-receipt.js'
import { sha256File } from './file-hash.js'
import { localInstallationPaths } from './local-app-installation.js'

if (process.platform !== 'linux')
  throw new Error('SaltMarcher Local handoff currently targets Linux AppImage')

const steps = [
  'check',
  'package',
  'packaged-smoke',
  'backup-and-install',
  'installed-runtime-verification'
] as const
type Step = (typeof steps)[number]

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/)
const stepEvidenceSchema = z
  .object({
    workspaceFingerprint: fingerprint,
    appBuildInputFingerprint: fingerprint,
    toolchainHash: fingerprint,
    outputHash: fingerprint.nullable(),
    artifactSha256: fingerprint.nullable(),
    installedSha256: fingerprint.nullable()
  })
  .strict()
const handoffStepSchema = z
  .object({
    step: z.enum(steps),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    startedAt: z.iso.datetime().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    evidence: stepEvidenceSchema.nullable(),
    error: z.string().nullable()
  })
  .strict()
const handoffReceiptSchema = z
  .object({
    formatVersion: z.literal(2),
    status: z.enum(['running', 'complete', 'failed']),
    mode: z.enum(['fresh', 'resume']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    identity: z
      .object({
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        dirty: z.boolean(),
        workspaceFingerprint: fingerprint,
        appBuildInputFingerprint: fingerprint,
        toolchainHash: fingerprint
      })
      .strict(),
    steps: z.array(handoffStepSchema).length(steps.length)
  })
  .strict()
type HandoffReceipt = z.infer<typeof handoffReceiptSchema>
type StepEvidence = z.infer<typeof stepEvidenceSchema>

const workspaceRoot = process.cwd()
const workspace = readWorkspaceIdentity(workspaceRoot)
const toolchain = readBuildToolchain(workspaceRoot)
const toolchainHash = hashJson(toolchain)
const identity = {
  ...workspace,
  toolchainHash
}
const packageJson = JSON.parse(
  readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')
) as { version?: unknown }
if (typeof packageJson.version !== 'string')
  throw new Error('package.json does not contain a version')
const artifactPath = resolve(
  workspaceRoot,
  'release',
  'local',
  `SaltMarcher-Local-${packageJson.version}.AppImage`
)
const artifactManifestPath = `${artifactPath}.manifest.json`
const installation = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
const receiptDirectory = resolve(workspaceRoot, '.tmp', 'handoff-local-app')
const receiptPath = resolve(receiptDirectory, 'handoff-receipt.json')
const checkSnapshotPath = resolve(
  receiptDirectory,
  'checked-build-receipt.json'
)
const resume = process.argv.includes('--resume')
if (
  process.argv.some(
    (argument) => argument.startsWith('--') && argument !== '--resume'
  )
)
  throw new Error('The only supported handoff option is --resume')

let receipt = resume ? readResumableReceipt() : freshReceipt()
writeReceipt()

for (const step of steps) {
  if (resume && completedStepIsReusable(step)) {
    console.info(
      JSON.stringify({
        component: 'local-handoff',
        event: 'step-resumed',
        step
      })
    )
    continue
  }
  resetFrom(step)
  executeStep(step)
}
receipt = {
  ...receipt,
  status: 'complete',
  updatedAt: new Date().toISOString()
}
writeReceipt()
console.info(
  JSON.stringify({
    component: 'local-handoff',
    event: 'completed',
    receipt: receiptPath,
    artifactSha256: sha256File(artifactPath),
    installedSha256: sha256File(installation.appImage)
  })
)

function executeStep(step: Step): void {
  const startedAt = new Date()
  updateStep(step, {
    status: 'running',
    startedAt: startedAt.toISOString(),
    durationMs: null,
    evidence: null,
    error: null
  })
  try {
    run(step, commandFor(step))
    const evidence = collectEvidence(step)
    updateStep(step, {
      status: 'completed',
      startedAt: startedAt.toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt.getTime()),
      evidence,
      error: null
    })
  } catch (error) {
    updateStep(step, {
      status: 'failed',
      startedAt: startedAt.toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt.getTime()),
      evidence: null,
      error: error instanceof Error ? error.message : String(error)
    })
    receipt = {
      ...receipt,
      status: 'failed',
      updatedAt: new Date().toISOString()
    }
    writeReceipt()
    throw error
  }
}

function commandFor(step: Step): readonly string[] {
  switch (step) {
    case 'check':
      return ['pnpm', 'check']
    case 'package':
      return ['pnpm', 'package:local']
    case 'packaged-smoke':
      return ['pnpm', 'test:packaged-local-smoke:built']
    case 'backup-and-install':
      return ['pnpm', 'install:local:built']
    case 'installed-runtime-verification':
      return [
        'pnpm',
        'exec',
        'tsx',
        'scripts/installed-runtime-verification.ts'
      ]
  }
}

function collectEvidence(step: Step): StepEvidence {
  let outputHash: string | null = null
  let artifactSha256: string | null = null
  let installedSha256: string | null = null
  if (step === 'check') {
    const build = verifyBuildReceipt(resolve(workspaceRoot, 'out'))
    if (
      build.build.channel !== 'development' ||
      !buildMatchesWorkspace(build.build)
    )
      throw new Error(
        'Canonical check did not leave matching development output'
      )
    atomicWrite(checkSnapshotPath, `${JSON.stringify(build, null, 2)}\n`)
    outputHash = build.outputHash
  }
  if (step !== 'check') {
    const manifest = validPackagedArtifact()
    outputHash = manifest.receipt.outputHash
    artifactSha256 = manifest.artifactSha256
  }
  if (
    step === 'backup-and-install' ||
    step === 'installed-runtime-verification'
  ) {
    const installed = localArtifactManifestSchema.parse(
      JSON.parse(readFileSync(installation.installedManifest, 'utf8'))
    )
    const packaged = validPackagedArtifact()
    if (JSON.stringify(installed) !== JSON.stringify(packaged))
      throw new Error('Installed manifest does not equal the packaged manifest')
    installedSha256 = sha256File(installation.appImage)
    if (installedSha256 !== packaged.artifactSha256)
      throw new Error(
        'Installed AppImage hash differs from the packaged artifact'
      )
  }
  return stepEvidenceSchema.parse({
    workspaceFingerprint: workspace.workspaceFingerprint,
    appBuildInputFingerprint: workspace.appBuildInputFingerprint,
    toolchainHash,
    outputHash,
    artifactSha256,
    installedSha256
  })
}

function completedStepIsReusable(step: Step): boolean {
  const record = receipt.steps.find((candidate) => candidate.step === step)
  if (record?.status !== 'completed' || record.evidence === null) return false
  try {
    const current = collectReusableEvidence(step)
    return JSON.stringify(current) === JSON.stringify(record.evidence)
  } catch {
    return false
  }
}

function collectReusableEvidence(step: Step): StepEvidence {
  if (step === 'check') {
    const snapshot = buildReceiptSchema.parse(
      JSON.parse(readFileSync(checkSnapshotPath, 'utf8'))
    )
    if (!buildMatchesWorkspace(snapshot.build))
      throw new Error('Checked receipt snapshot is stale')
    return stepEvidenceSchema.parse({
      workspaceFingerprint: workspace.workspaceFingerprint,
      appBuildInputFingerprint: workspace.appBuildInputFingerprint,
      toolchainHash,
      outputHash: snapshot.outputHash,
      artifactSha256: null,
      installedSha256: null
    })
  }
  return collectEvidence(step)
}

function validPackagedArtifact() {
  const output = verifyBuildReceipt(resolve(workspaceRoot, 'out'))
  const manifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
  )
  if (
    output.build.channel !== 'local' ||
    !buildMatchesWorkspace(output.build) ||
    JSON.stringify(manifest.receipt) !== JSON.stringify(output) ||
    manifest.receiptSha256 !== hashJson(output) ||
    manifest.artifactSha256 !== sha256File(artifactPath)
  )
    throw new Error('Packaged Local artifact evidence is stale or inconsistent')
  return manifest
}

function buildMatchesWorkspace(build: {
  commit: string
  dirty: boolean
  workspaceFingerprint: string
  appBuildInputFingerprint: string
  toolchain: unknown
}): boolean {
  return (
    build.commit === workspace.commit &&
    build.dirty === workspace.dirty &&
    build.workspaceFingerprint === workspace.workspaceFingerprint &&
    build.appBuildInputFingerprint === workspace.appBuildInputFingerprint &&
    hashJson(build.toolchain) === toolchainHash
  )
}

function freshReceipt(): HandoffReceipt {
  const timestamp = new Date().toISOString()
  return handoffReceiptSchema.parse({
    formatVersion: 2,
    status: 'running',
    mode: 'fresh',
    createdAt: timestamp,
    updatedAt: timestamp,
    identity,
    steps: steps.map((step) => ({
      step,
      status: 'pending',
      startedAt: null,
      durationMs: null,
      evidence: null,
      error: null
    }))
  })
}

function readResumableReceipt(): HandoffReceipt {
  if (!existsSync(receiptPath))
    throw new Error('No handoff receipt exists to resume')
  const existing = handoffReceiptSchema.parse(
    JSON.parse(readFileSync(receiptPath, 'utf8'))
  )
  if (JSON.stringify(existing.identity) !== JSON.stringify(identity))
    throw new Error('Handoff receipt identity differs; start a fresh handoff')
  return {
    ...existing,
    status: 'running',
    mode: 'resume',
    updatedAt: new Date().toISOString()
  }
}

function resetFrom(step: Step): void {
  const index = steps.indexOf(step)
  receipt = {
    ...receipt,
    status: 'running',
    updatedAt: new Date().toISOString(),
    steps: receipt.steps.map((record) =>
      steps.indexOf(record.step) < index
        ? record
        : {
            step: record.step,
            status: 'pending' as const,
            startedAt: null,
            durationMs: null,
            evidence: null,
            error: null
          }
    )
  }
  writeReceipt()
}

function updateStep(
  step: Step,
  update: Omit<HandoffReceipt['steps'][number], 'step'>
): void {
  receipt = {
    ...receipt,
    updatedAt: new Date().toISOString(),
    steps: receipt.steps.map((record) =>
      record.step === step ? { step, ...update } : record
    )
  }
  writeReceipt()
}

function writeReceipt(): void {
  receipt = handoffReceiptSchema.parse(receipt)
  atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.next`
  const descriptor = openSync(temporary, 'w', 0o600)
  try {
    writeFileSync(descriptor, content)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporary, path)
  const directory = openSync(dirname(path), 'r')
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
}

function run(step: Step, arguments_: readonly string[]): void {
  console.info(
    JSON.stringify({ component: 'local-handoff', event: 'step-started', step })
  )
  const result = spawnSync('corepack', arguments_, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Local handoff step ${step} failed with ${result.status}`)
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

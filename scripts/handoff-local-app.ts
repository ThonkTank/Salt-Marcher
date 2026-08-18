import { createHash, randomUUID } from 'node:crypto'
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
import {
  buildReceiptSchema,
  localArtifactManifestSchema
} from '../src/shared/contracts/build-info.js'
import { readBuildToolchain, readWorkspaceIdentity } from './build-identity.js'
import { verifyBuildReceipt } from './build-receipt.js'
import { sha256File } from './file-hash.js'
import { localInstallationPaths } from './local-app-installation.js'
import { assertCandidateReady } from './candidate-delivery.js'
import {
  appendHandoffInvocation,
  handoffInvocationHistorySchema,
  handoffReceiptSchema,
  handoffStepEvidenceSchema,
  handoffSteps,
  type HandoffInvocationHistory,
  type HandoffReceipt,
  type HandoffStepEvidence,
  type HandoffStepName
} from './delivery-contract.js'

if (process.platform !== 'linux')
  throw new Error('SaltMarcher Local handoff currently targets Linux AppImage')

const candidateState = assertCandidateReady()

const workspaceRoot = process.cwd()
const workspace = readWorkspaceIdentity(workspaceRoot)
const toolchain = readBuildToolchain(workspaceRoot)
const toolchainHash = hashJson(toolchain)
const identity = {
  ...workspace,
  toolchainHash,
  candidate: candidateState.candidate!
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
const invocationHistoryPath = resolve(receiptDirectory, 'invocations.json')
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

for (const definition of stepDefinitions()) {
  const step = definition.name
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
  executeStep(definition)
}
const completedAt = new Date().toISOString()
receipt = {
  ...receipt,
  status: 'complete',
  updatedAt: completedAt,
  completedAt
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

interface HandoffStepDefinition {
  readonly name: HandoffStepName
  readonly command: readonly string[]
  readonly collect: () => HandoffStepEvidence
  readonly collectReusable: () => HandoffStepEvidence
}

function executeStep(definition: HandoffStepDefinition): void {
  const step = definition.name
  const startedAt = new Date()
  updateStep(step, {
    status: 'running',
    startedAt: startedAt.toISOString(),
    durationMs: null,
    evidence: null,
    error: null
  })
  try {
    run(step, definition.command)
    const evidence = definition.collect()
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

function stepDefinitions(): readonly HandoffStepDefinition[] {
  return [
    {
      name: 'check',
      command: ['pnpm', 'check'],
      collect: collectCheckEvidence,
      collectReusable: collectReusableCheckEvidence
    },
    {
      name: 'package',
      command: ['pnpm', 'package:local'],
      collect: collectPackagedEvidence,
      collectReusable: collectPackagedEvidence
    },
    {
      name: 'packaged-smoke',
      command: ['pnpm', 'test:packaged-local-smoke:built'],
      collect: collectPackagedEvidence,
      collectReusable: collectPackagedEvidence
    },
    {
      name: 'backup-and-install',
      command: ['pnpm', 'install:local:built'],
      collect: collectInstalledEvidence,
      collectReusable: collectInstalledEvidence
    },
    {
      name: 'installed-runtime-verification',
      command: [
        'pnpm',
        'exec',
        'tsx',
        'scripts/installed-runtime-verification.ts'
      ],
      collect: collectInstalledEvidence,
      collectReusable: collectInstalledEvidence
    }
  ]
}

function collectCheckEvidence(): HandoffStepEvidence {
  const build = verifyBuildReceipt(resolve(workspaceRoot, 'out'))
  if (
    build.build.channel !== 'development' ||
    !buildMatchesWorkspace(build.build)
  )
    throw new Error('Canonical check did not leave matching development output')
  atomicWrite(checkSnapshotPath, `${JSON.stringify(build, null, 2)}\n`)
  return evidence({ outputHash: build.outputHash })
}

function collectReusableCheckEvidence(): HandoffStepEvidence {
  const snapshot = buildReceiptSchema.parse(
    JSON.parse(readFileSync(checkSnapshotPath, 'utf8'))
  )
  if (!buildMatchesWorkspace(snapshot.build))
    throw new Error('Checked receipt snapshot is stale')
  return evidence({ outputHash: snapshot.outputHash })
}

function collectPackagedEvidence(): HandoffStepEvidence {
  const manifest = validPackagedArtifact()
  return evidence({
    outputHash: manifest.receipt.outputHash,
    artifactSha256: manifest.artifactSha256
  })
}

function collectInstalledEvidence(): HandoffStepEvidence {
  const installed = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(installation.installedManifest, 'utf8'))
  )
  const packaged = validPackagedArtifact()
  if (JSON.stringify(installed) !== JSON.stringify(packaged))
    throw new Error('Installed manifest does not equal the packaged manifest')
  const installedSha256 = sha256File(installation.appImage)
  if (installedSha256 !== packaged.artifactSha256)
    throw new Error('Installed AppImage hash differs from packaged artifact')
  return evidence({
    outputHash: packaged.receipt.outputHash,
    artifactSha256: packaged.artifactSha256,
    installedSha256
  })
}

function evidence(input: {
  outputHash: string
  artifactSha256?: string
  installedSha256?: string
}): HandoffStepEvidence {
  return handoffStepEvidenceSchema.parse({
    workspaceFingerprint: workspace.workspaceFingerprint,
    appBuildInputFingerprint: workspace.appBuildInputFingerprint,
    toolchainHash,
    outputHash: input.outputHash,
    artifactSha256: input.artifactSha256 ?? null,
    installedSha256: input.installedSha256 ?? null
  })
}

function completedStepIsReusable(step: HandoffStepName): boolean {
  const record = receipt.steps.find((candidate) => candidate.step === step)
  if (record?.status !== 'completed' || record.evidence === null) return false
  try {
    const current = definitionFor(step).collectReusable()
    return JSON.stringify(current) === JSON.stringify(record.evidence)
  } catch {
    return false
  }
}

function definitionFor(step: HandoffStepName): HandoffStepDefinition {
  const definition = stepDefinitions().find(({ name }) => name === step)
  if (!definition) throw new Error(`Unknown handoff step: ${step}`)
  return definition
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
  const invocationId = randomUUID()
  const fresh = handoffReceiptSchema.parse({
    formatVersion: 3,
    invocationId,
    status: 'running',
    mode: 'fresh',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    identity,
    steps: handoffSteps.map((step) => ({
      step,
      status: 'pending',
      startedAt: null,
      durationMs: null,
      evidence: null,
      error: null
    }))
  })
  appendInvocation({
    invocationId,
    applicationSha: workspace.commit,
    createdAt: timestamp,
    receiptPath: invocationReceiptPath(invocationId)
  })
  return fresh
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
    updatedAt: new Date().toISOString(),
    completedAt: null
  }
}

function resetFrom(step: HandoffStepName): void {
  const index = handoffSteps.indexOf(step)
  receipt = {
    ...receipt,
    status: 'running',
    updatedAt: new Date().toISOString(),
    steps: receipt.steps.map((record) =>
      handoffSteps.indexOf(record.step) < index
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
  step: HandoffStepName,
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
  const content = `${JSON.stringify(receipt, null, 2)}\n`
  atomicWrite(invocationReceiptPath(receipt.invocationId), content)
  atomicWrite(receiptPath, content)
}

function appendInvocation(
  invocation: HandoffInvocationHistory['invocations'][number]
): void {
  const history = existsSync(invocationHistoryPath)
    ? handoffInvocationHistorySchema.parse(
        JSON.parse(readFileSync(invocationHistoryPath, 'utf8'))
      )
    : { formatVersion: 1 as const, invocations: [] }
  const next = appendHandoffInvocation(history, invocation)
  atomicWrite(invocationHistoryPath, `${JSON.stringify(next, null, 2)}\n`)
}

function invocationReceiptPath(invocationId: string): string {
  return resolve(receiptDirectory, 'invocations', `${invocationId}.json`)
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

function run(step: HandoffStepName, arguments_: readonly string[]): void {
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

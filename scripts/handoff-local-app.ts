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
  readWorkspaceIdentity,
  readWorkspaceInputFingerprints
} from './build-identity.js'
import {
  acquireCandidateArtifact,
  candidateArtifactName,
  verifyCandidateArtifactDirectory,
  type CandidateArtifactExpectation
} from './candidate-artifact.js'
import { assertCandidateReady } from './candidate-delivery.js'
import {
  appendHandoffInvocation,
  createHandoffReceipt,
  handoffReceiptSchema,
  installedRuntimeEvidenceSchema,
  parseHandoffInvocationHistory,
  readRequiredJobManifest,
  sameHandoffApplicationIdentity,
  type HandoffIdentity,
  type HandoffInvocationHistory,
  type HandoffPhaseEvidence,
  type HandoffReceipt
} from './delivery-contract.js'
import { sha256File } from './file-hash.js'
import {
  attachHandoffAttempt,
  runHandoffStateMachine,
  type HandoffPhaseDefinition
} from './handoff-state-machine.js'
import {
  assertHandoffResourcePreflight,
  readHandoffResourceSnapshot
} from './handoff-preflight.js'
import {
  inspectLocalAppInstallation,
  isInstalledLocalAppRunning,
  localInstallationPaths,
  type InstallLocalAppOptions,
  type LocalInstallationTarget
} from './local-app-installation.js'
import { removeSupersededLocalInstallation } from './local-installation-legacy.js'

if (process.platform !== 'linux')
  throw new Error('SaltMarcher Local handoff currently targets Linux AppImage')

const resume = parseArguments(process.argv.slice(2))
const workspaceRoot = process.cwd()
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
const artifactRoot = dirname(artifactPath)
const installation = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
// Auth, network, candidate, workspace, installation availability and disk
// capacity are all checked before an attempt or state file is created.
const candidateState = assertCandidateReady()
const workspace = readWorkspaceIdentity(workspaceRoot)
const inputFingerprints = readWorkspaceInputFingerprints(workspaceRoot)
if (isInstalledLocalAppRunning(installation.appImage))
  throw new Error('SaltMarcher Local is running; close it before handoff')
assertHandoffResourcePreflight(
  readHandoffResourceSnapshot(
    workspaceRoot,
    installation.root,
    installation.campaignData
  )
)
const artifactExpectation: CandidateArtifactExpectation = {
  repository: githubRepository(),
  workflowName: readRequiredJobManifest().workflowName,
  workflowRunId: candidateState.candidate!.runId,
  workflowRunAttempt: candidateState.candidate!.attempt,
  applicationSha: workspace.commit,
  workspaceFingerprint: workspace.workspaceFingerprint,
  appBuildInputFingerprint: workspace.appBuildInputFingerprint
}
const candidateArtifact = acquireCandidateArtifact({
  destinationRoot: artifactRoot,
  expected: artifactExpectation,
  download: downloadCandidateArtifact
})
if (
  candidateArtifact.artifactPath !== artifactPath ||
  candidateArtifact.artifactManifestPath !== artifactManifestPath
)
  throw new Error('Candidate artifact uses an unexpected Local package name')
const identity: HandoffIdentity = {
  ...workspace,
  ...inputFingerprints,
  toolchainHash: candidateArtifact.receipt.toolchainHash,
  candidate: candidateState.candidate!
}
const installOptions: InstallLocalAppOptions = {
  workspaceRoot,
  xdgDataHome:
    process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share'),
  artifactPath,
  artifactManifestPath,
  iconSourcePath: resolve(
    workspaceRoot,
    'resources',
    'icons',
    'salt-marcher.png'
  )
}

const receiptDirectory = resolve(workspaceRoot, '.tmp', 'handoff-local-app')
const statePath = resolve(
  receiptDirectory,
  'states',
  `${workspace.commit}.json`
)
const receiptPath = resolve(receiptDirectory, 'handoff-receipt.json')
const invocationHistoryPath = resolve(receiptDirectory, 'invocations.json')
const runtimeEvidencePath = resolve(
  receiptDirectory,
  'installed-runtime-evidence.json'
)

const attemptId = randomUUID()
const timestamp = new Date().toISOString()
const auditPath = resolve(receiptDirectory, 'attempts', `${attemptId}.json`)
let receipt: HandoffReceipt
if (existsSync(statePath)) {
  const existing = handoffReceiptSchema.parse(
    JSON.parse(readFileSync(statePath, 'utf8'))
  )
  if (!sameHandoffApplicationIdentity(existing.identity, identity))
    throw new Error(
      'Handoff SHA state identity differs from the live candidate'
    )
  receipt = attachHandoffAttempt(existing, attemptId, timestamp)
} else {
  if (resume) throw new Error('No SHA handoff state exists to resume')
  receipt = createHandoffReceipt(identity, randomUUID(), attemptId, timestamp)
}

const history = existsSync(invocationHistoryPath)
  ? parseHandoffInvocationHistory(
      JSON.parse(readFileSync(invocationHistoryPath, 'utf8'))
    )
  : ({ formatVersion: 2, invocations: [] } satisfies HandoffInvocationHistory)
atomicWrite(
  invocationHistoryPath,
  `${JSON.stringify(
    appendHandoffInvocation(history, {
      attemptId,
      applicationSha: workspace.commit,
      intent: resume ? 'resume' : 'advance',
      createdAt: timestamp,
      statePath,
      auditPath
    }),
    null,
    2
  )}\n`
)

const persist = (next: HandoffReceipt): void => {
  receipt = handoffReceiptSchema.parse(next)
  const content = `${JSON.stringify(receipt, null, 2)}\n`
  atomicWrite(auditPath, content)
  atomicWrite(statePath, content)
  atomicWrite(receiptPath, content)
}
persist(receipt)

receipt = runHandoffStateMachine({
  receipt,
  definitions: phaseDefinitions(),
  persist
})

console.info(
  JSON.stringify({
    component: 'local-handoff',
    event: 'completed',
    stateId: receipt.stateId,
    originAttemptId: receipt.originAttemptId,
    activeAttemptId: receipt.activeAttemptId,
    receipt: receiptPath,
    artifactSha256: sha256File(artifactPath),
    installedSha256: sha256File(installation.appImage)
  })
)

function phaseDefinitions(): readonly HandoffPhaseDefinition[] {
  return [
    {
      phase: 'candidate-qualified',
      execute: () => undefined,
      collect: collectCandidateEvidence
    },
    {
      phase: 'checked',
      execute: () => undefined,
      collect: collectCheckedEvidence
    },
    {
      phase: 'packaged',
      execute: () => undefined,
      collect: collectPackagedEvidence
    },
    {
      phase: 'packaged-smoke-passed',
      execute: () =>
        run('packaged-smoke-passed', [
          'pnpm',
          'test:packaged-local-smoke:built'
        ]),
      collect: collectPackagedEvidence
    },
    installationDefinition('backup-created'),
    installationDefinition('deployment-staged'),
    installationDefinition('activated'),
    {
      phase: 'installed-runtime-verified',
      execute: () => {
        run('installed-runtime-verified', [
          'pnpm',
          'exec',
          'tsx',
          'scripts/installed-runtime-verification.ts'
        ])
        removeSupersededLocalInstallation({
          installationRoot: installation.root,
          currentAppImage: installation.appImage,
          currentManifest: installation.installedManifest,
          runtimeEvidencePath
        })
      },
      collect: collectRuntimeEvidence
    }
  ]
}

function installationDefinition(
  target: LocalInstallationTarget
): HandoffPhaseDefinition {
  return {
    phase: target,
    execute: () =>
      run(target, [
        'pnpm',
        'exec',
        'tsx',
        'scripts/install-local-app.ts',
        '--through',
        target
      ]),
    collect: () => collectInstallationEvidence(target)
  }
}

function collectCandidateEvidence(): HandoffPhaseEvidence {
  validCandidateArtifact()
  return evidence()
}

function collectCheckedEvidence(): HandoffPhaseEvidence {
  const artifact = validCandidateArtifact()
  return evidence({ buildOutputHash: artifact.receipt.outputHash })
}

function collectPackagedEvidence(): HandoffPhaseEvidence {
  const manifest = validPackagedArtifact()
  return evidence({
    buildOutputHash: manifest.receipt.outputHash,
    artifactSha256: manifest.artifactSha256
  })
}

function collectInstallationEvidence(
  target: LocalInstallationTarget
): HandoffPhaseEvidence {
  const installed = inspectLocalAppInstallation(installOptions, target)
  if (installed === null)
    throw new Error(`Local installation checkpoint is not reusable: ${target}`)
  const packaged = validPackagedArtifact()
  return evidence({
    buildOutputHash: packaged.receipt.outputHash,
    artifactSha256: packaged.artifactSha256,
    sourceDataHash: installed.sourceDataHash,
    ...(installed.backupManifestSha256 === undefined
      ? {}
      : { backupManifestSha256: installed.backupManifestSha256 }),
    ...(installed.deploymentManifestSha256 === undefined
      ? {}
      : { deploymentManifestSha256: installed.deploymentManifestSha256 }),
    ...(installed.installedSha256 === undefined
      ? {}
      : { installedSha256: installed.installedSha256 })
  })
}

function collectRuntimeEvidence(): HandoffPhaseEvidence {
  const installed = collectInstallationEvidence('activated')
  const runtime = installedRuntimeEvidenceSchema.parse(
    JSON.parse(readFileSync(runtimeEvidencePath, 'utf8'))
  )
  if (
    runtime.artifactSha256 !== installed.artifactSha256 ||
    runtime.manifestSha256 !== sha256File(installation.installedManifest)
  )
    throw new Error('Installed runtime evidence proves another artifact')
  return {
    ...installed,
    runtimeEvidenceSha256: sha256File(runtimeEvidencePath)
  }
}

function evidence(
  input: {
    readonly buildOutputHash?: string
    readonly artifactSha256?: string
    readonly sourceDataHash?: string
    readonly backupManifestSha256?: string
    readonly deploymentManifestSha256?: string
    readonly runtimeEvidenceSha256?: string
    readonly installedSha256?: string
  } = {}
): HandoffPhaseEvidence {
  assertWorkspaceUnchanged()
  return {
    workspaceFingerprint: identity.workspaceFingerprint,
    appBuildInputFingerprint: identity.appBuildInputFingerprint,
    qualificationInputFingerprint: identity.qualificationInputFingerprint,
    deliveryInputFingerprint: identity.deliveryInputFingerprint,
    toolchainHash: identity.toolchainHash,
    candidateArtifactReceiptSha256: sha256File(candidateArtifact.receiptPath),
    artifactManifestSha256: sha256File(artifactManifestPath),
    buildOutputHash: input.buildOutputHash ?? null,
    artifactSha256: input.artifactSha256 ?? null,
    sourceDataHash: input.sourceDataHash ?? null,
    backupManifestSha256: input.backupManifestSha256 ?? null,
    deploymentManifestSha256: input.deploymentManifestSha256 ?? null,
    runtimeEvidenceSha256: input.runtimeEvidenceSha256 ?? null,
    installedSha256: input.installedSha256 ?? null
  }
}

function validPackagedArtifact() {
  const artifact = validCandidateArtifact()
  if (!buildMatches(artifact.receipt.build))
    throw new Error('Packaged Local artifact evidence is stale or inconsistent')
  return artifact
}

function validCandidateArtifact() {
  assertWorkspaceUnchanged()
  return verifyCandidateArtifactDirectory(artifactRoot, artifactExpectation)
    .manifest
}

function buildMatches(build: {
  commit: string
  dirty: boolean
  workspaceFingerprint: string
  appBuildInputFingerprint: string
  toolchain: unknown
}): boolean {
  return (
    build.commit === identity.commit &&
    build.dirty === identity.dirty &&
    build.workspaceFingerprint === identity.workspaceFingerprint &&
    build.appBuildInputFingerprint === identity.appBuildInputFingerprint &&
    hashJson(build.toolchain) === identity.toolchainHash
  )
}

function assertWorkspaceUnchanged(): void {
  const current = readWorkspaceIdentity(workspaceRoot)
  const inputs = readWorkspaceInputFingerprints(workspaceRoot)
  if (
    JSON.stringify({ ...current, ...inputs }) !==
    JSON.stringify({
      commit: identity.commit,
      dirty: identity.dirty,
      workspaceFingerprint: identity.workspaceFingerprint,
      appBuildInputFingerprint: identity.appBuildInputFingerprint,
      qualificationInputFingerprint: identity.qualificationInputFingerprint,
      deliveryInputFingerprint: identity.deliveryInputFingerprint
    })
  )
    throw new Error('Workspace identity changed during handoff')
}

function parseArguments(arguments_: readonly string[]): boolean {
  if (arguments_.length === 0) return false
  if (arguments_.length === 1 && arguments_[0] === '--resume') return true
  throw new Error('The only supported handoff option is --resume')
}

function run(phase: string, arguments_: readonly string[]): void {
  const result = spawnSync('corepack', arguments_, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Local handoff phase ${phase} failed with ${result.status}`)
}

function downloadCandidateArtifact(destination: string): void {
  const result = spawnSync(
    'gh',
    [
      'run',
      'download',
      String(candidateState.candidate!.runId),
      '--name',
      candidateArtifactName(
        workspace.commit,
        candidateState.candidate!.attempt
      ),
      '--dir',
      destination
    ],
    {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit'
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Candidate artifact download failed with ${result.status}`)
}

function githubRepository(): string {
  const result = spawnSync(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    {
      cwd: workspaceRoot,
      env: process.env,
      encoding: 'utf8'
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      result.stderr.trim() ||
        'Could not resolve the authenticated GitHub repository'
    )
  const repository = result.stdout.trim()
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository))
    throw new Error('GitHub returned an invalid repository identity')
  return repository
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.next`
  const descriptor = openSync(temporary, 'wx', 0o600)
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

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

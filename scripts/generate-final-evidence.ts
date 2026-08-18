import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { z } from 'zod'
import {
  buildInfoSchema,
  localArtifactManifestSchema
} from '../src/shared/contracts/build-info.js'
import { readBuildToolchain, readWorkspaceIdentity } from './build-identity.js'
import {
  parseRemoteHead,
  readSuccessfulPostPromotionEvidence,
  readSuccessfulWorkflowEvidence
} from './candidate-delivery.js'
import {
  finalEvidenceSchema,
  fingerprintSchema,
  freshInvocationCount,
  handoffInvocationHistorySchema,
  handoffReceiptSchema,
  installedRuntimeEvidenceSchema
} from './delivery-contract.js'
import { sha256File } from './file-hash.js'
import { localInstallationPaths } from './local-app-installation.js'
import { atomicWrite } from './safe-file-write.js'
import {
  renderFinalReport,
  renderLiveStatus
} from './quality-reset-documents.js'
import {
  followupLedgerPath,
  ledgerSha256,
  readFollowupLedger,
  summarizeLedger
} from './quality-reset-ledger.js'
import { readVersionTruth } from './version-truth.js'

const backupManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    createdAt: z.iso.datetime(),
    nextBuild: buildInfoSchema,
    databases: z
      .array(
        z
          .object({
            path: z.string().min(1),
            role: z.string().min(1),
            schemaVersion: z.number().int().nonnegative(),
            expectedVersion: z.number().int().nonnegative()
          })
          .strict()
      )
      .min(1),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            bytes: z.number().int().nonnegative(),
            sha256: fingerprintSchema
          })
          .strict()
      )
      .min(1)
  })
  .passthrough()

const root = process.cwd()
const identity = readWorkspaceIdentity(root)
if (identity.dirty)
  throw new Error(
    'Final evidence must be generated from a clean Application-SHA.'
  )
const remoteMain = parseRemoteHead(
  command('git', [
    'ls-remote',
    '--exit-code',
    '--heads',
    'origin',
    'refs/heads/main'
  ])
)
if (remoteMain !== identity.commit)
  throw new Error('origin/main does not equal the Application-SHA.')

const candidate = readSuccessfulWorkflowEvidence(identity.commit)
if (!candidate)
  throw new Error('The Application-SHA has no complete candidate attestation.')
const main = readSuccessfulPostPromotionEvidence(identity.commit)
if (!main)
  throw new Error('The Application-SHA has no successful post-promotion run.')

const handoffRoot = resolve(root, '.tmp', 'handoff-local-app')
const receipt = handoffReceiptSchema.parse(
  JSON.parse(readFileSync(join(handoffRoot, 'handoff-receipt.json'), 'utf8'))
)
const history = handoffInvocationHistorySchema.parse(
  JSON.parse(readFileSync(join(handoffRoot, 'invocations.json'), 'utf8'))
)
const freshCount = freshInvocationCount(history, identity.commit)
if (
  receipt.status !== 'complete' ||
  receipt.mode !== 'fresh' ||
  receipt.identity.commit !== identity.commit ||
  receipt.identity.dirty ||
  receipt.completedAt === null ||
  receipt.steps.some(
    ({ status, startedAt, durationMs, evidence }) =>
      status !== 'completed' ||
      startedAt === null ||
      durationMs === null ||
      evidence?.outputHash === null ||
      evidence === null
  ) ||
  freshCount !== 1 ||
  JSON.stringify(receipt.identity.candidate) !== JSON.stringify(candidate)
)
  throw new Error('The handoff does not prove one complete fresh invocation.')

const installation = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
const runtime = installedRuntimeEvidenceSchema.parse(
  JSON.parse(
    readFileSync(join(handoffRoot, 'installed-runtime-evidence.json'), 'utf8')
  )
)
const installedManifest = localArtifactManifestSchema.parse(
  JSON.parse(readFileSync(installation.installedManifest, 'utf8'))
)
const artifactPath = resolve(
  root,
  'release',
  'local',
  installedManifest.artifactFile
)
const artifactManifestPath = `${artifactPath}.manifest.json`
const artifactManifest = localArtifactManifestSchema.parse(
  JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
)
if (
  JSON.stringify(artifactManifest) !== JSON.stringify(installedManifest) ||
  artifactManifest.receipt.build.commit !== identity.commit ||
  artifactManifest.artifactSha256 !== sha256File(artifactPath) ||
  artifactManifest.artifactSha256 !== sha256File(installation.appImage) ||
  runtime.artifactSha256 !== artifactManifest.artifactSha256 ||
  runtime.manifestSha256 !== sha256File(installation.installedManifest)
)
  throw new Error(
    'Artifact, installed application, and runtime evidence differ.'
  )

const backup = readBackup(installation.backups, identity.commit)
const ledger = readFollowupLedger(root)
const counts = summarizeLedger(ledger.requirements)
if (counts.open + counts.inProgress + counts.blocked !== 0)
  throw new Error('The follow-up requirements ledger is not closed.')
const truth = readVersionTruth()
const installationVersion = truth.schemas.find(
  ({ role }) => role === 'installation'
)?.current
const campaignVersion = truth.schemas.find(
  ({ role }) => role === 'campaign'
)?.current
if (installationVersion === undefined || campaignVersion === undefined)
  throw new Error('Version truth does not define both persistence roles.')

const evidence = finalEvidenceSchema.parse({
  schemaVersion: 1,
  status: 'complete',
  application: {
    sha: identity.commit,
    workspaceFingerprint: identity.workspaceFingerprint,
    appBuildInputFingerprint: identity.appBuildInputFingerprint,
    dirty: false,
    toolchain: readBuildToolchain(root),
    versions: {
      installationSchema: installationVersion,
      campaignSchema: campaignVersion,
      migrationRegistry: truth.migrationRegistryVersion,
      encounterEngine: truth.encounterEngineVersion,
      rewardEngine: truth.rewardEngineVersion,
      config: truth.generatorConfigVersion,
      catalogVersion: truth.catalogVersion,
      catalogHash: truth.catalogContentHash
    }
  },
  candidate,
  handoff: {
    invocationId: receipt.invocationId,
    mode: 'fresh',
    freshInvocationCountForApplicationSha: 1,
    exactlyOnce: true,
    startedAt: receipt.createdAt,
    completedAt: receipt.completedAt,
    steps: receipt.steps.map((step) => ({
      name: step.step,
      status: 'completed',
      startedAt: step.startedAt,
      durationMs: step.durationMs,
      outputHash: step.evidence?.outputHash
    }))
  },
  artifact: {
    path: artifactPath,
    sha256: artifactManifest.artifactSha256,
    manifestSha256: sha256File(artifactManifestPath),
    outputHash: artifactManifest.receipt.outputHash
  },
  installation: {
    ...runtime,
    backup: {
      path: backup.path,
      manifestSha256: sha256File(backup.manifestPath),
      fileCount: backup.manifest.files.length,
      databaseCount: backup.manifest.databases.length
    }
  },
  main,
  ledger: {
    path: followupLedgerPath,
    sha256: ledgerSha256(root),
    ...counts
  },
  reproduction: {
    commands: [
      'git show --no-patch --format=%H HEAD^',
      'corepack pnpm check:campaign-lifecycle',
      'corepack pnpm check:campaign-import',
      'corepack pnpm check:runtime-contracts',
      'corepack pnpm check:persistence-modules',
      'corepack pnpm check:session-ui',
      'corepack pnpm check:delivery',
      `gh run view ${candidate.runId}`,
      `corepack pnpm delivery:verify-evidence ${identity.commit}`
    ]
  }
})

const evidencePath = resolve(
  root,
  'docs/project/quality-reset/final-evidence.json'
)
const evidenceContent = `${JSON.stringify(evidence, null, 2)}\n`
atomicWrite(evidencePath, evidenceContent)
atomicWrite(
  resolve(root, 'docs/project/quality-reset/final-evidence.sha256'),
  `${createHash('sha256').update(evidenceContent).digest('hex')}  ${basename(evidencePath)}\n`
)
atomicWrite(
  resolve(root, 'docs/project/quality-reset/live-status.md'),
  renderLiveStatus(evidence, ledger)
)
atomicWrite(
  resolve(root, 'docs/project/quality-reset/final-report.md'),
  renderFinalReport(evidence, ledger)
)

console.info(
  JSON.stringify({
    component: 'quality-reset-final-evidence',
    event: 'generated',
    applicationSha: identity.commit,
    candidateRunId: candidate.runId,
    mainRunId: main.runId,
    handoffInvocationId: receipt.invocationId,
    ledger: counts
  })
)

function readBackup(rootPath: string, applicationSha: string) {
  if (!existsSync(rootPath)) throw new Error('Campaign backup root is missing.')
  const candidates = readdirSync(rootPath)
    .map((name) => join(rootPath, name))
    .filter((path) => statSync(path).isDirectory())
    .flatMap((path) => {
      const manifestPath = join(path, 'backup-manifest.json')
      if (!existsSync(manifestPath)) return []
      const parsed = backupManifestSchema.safeParse(
        JSON.parse(readFileSync(manifestPath, 'utf8'))
      )
      if (!parsed.success || parsed.data.nextBuild.commit !== applicationSha)
        return []
      return [{ path, manifestPath, manifest: parsed.data }]
    })
    .sort((left, right) =>
      right.manifest.createdAt.localeCompare(left.manifest.createdAt)
    )
  const selected = candidates[0]
  if (!selected)
    throw new Error(
      'No verified campaign backup belongs to the Application-SHA.'
    )
  return selected
}

function command(executable: string, arguments_: readonly string[]): string {
  return execFileSync(executable, arguments_, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

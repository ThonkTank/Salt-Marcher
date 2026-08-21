import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import {
  buildToolchainSchema,
  localArtifactManifestSchema,
  type LocalArtifactManifest
} from '../src/shared/contracts/build-info.js'
import { localPersistenceFormatVersions } from '../src/shared/contracts/local-persistence-format-versions.js'
import { fingerprintSchema, shaSchema } from './delivery-contract.js'
import { sha256File } from './file-hash.js'

export const candidateArtifactReceiptFile = 'candidate-artifact-receipt.json'

const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) => basename(value) === value && value !== '.' && value !== '..',
    {
      message: 'Candidate artifact entries must be plain file names'
    }
  )

export const candidateArtifactReceiptSchema = z
  .object({
    formatVersion: z.literal(
      localPersistenceFormatVersions.candidateArtifactReceipt
    ),
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    workflowName: z.string().min(1),
    workflowRunId: z.number().int().positive(),
    workflowRunAttempt: z.number().int().positive(),
    artifactName: z.string().min(1).max(255),
    applicationSha: shaSchema,
    workspaceFingerprint: fingerprintSchema,
    appBuildInputFingerprint: fingerprintSchema,
    toolchain: buildToolchainSchema,
    toolchainHash: fingerprintSchema,
    buildReceiptSha256: fingerprintSchema,
    artifactManifestFile: fileNameSchema,
    artifactManifestSha256: fingerprintSchema,
    artifactFile: fileNameSchema,
    artifactSha256: fingerprintSchema
  })
  .strict()
  .readonly()

export type CandidateArtifactReceipt = z.infer<
  typeof candidateArtifactReceiptSchema
>

export type CandidateArtifactExpectation = Readonly<{
  repository: string
  workflowName: string
  workflowRunId: number
  workflowRunAttempt: number
  applicationSha: string
  workspaceFingerprint: string
  appBuildInputFingerprint: string
}>

export type VerifiedCandidateArtifact = Readonly<{
  root: string
  artifactPath: string
  artifactManifestPath: string
  receiptPath: string
  receipt: CandidateArtifactReceipt
  manifest: LocalArtifactManifest
}>

export function candidateArtifactName(
  applicationSha: string,
  workflowRunAttempt: number
): string {
  return `salt-marcher-local-${shaSchema.parse(applicationSha)}-attempt-${z.number().int().positive().parse(workflowRunAttempt)}`
}

export function createCandidateArtifactReceipt(input: {
  root: string
  repository: string
  workflowName: string
  workflowRunId: number
  workflowRunAttempt: number
  applicationSha: string
}): CandidateArtifactReceipt {
  const manifests = readdirSync(input.root).filter((entry) =>
    entry.endsWith('.AppImage.manifest.json')
  )
  if (manifests.length !== 1)
    throw new Error(
      `Expected exactly one Local artifact manifest, found ${manifests.length}`
    )
  const artifactManifestFile = manifests[0]!
  const artifactManifestPath = join(input.root, artifactManifestFile)
  assertRegularFile(artifactManifestPath)
  const manifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
  )
  const artifactPath = join(input.root, manifest.artifactFile)
  assertRegularFile(artifactPath)
  const build = manifest.receipt.build
  if (
    build.channel !== 'local' ||
    build.dirty ||
    build.commit !== input.applicationSha
  )
    throw new Error(
      'Candidate artifact is not a clean Local build of the checked SHA'
    )
  const receipt = candidateArtifactReceiptSchema.parse({
    formatVersion: localPersistenceFormatVersions.candidateArtifactReceipt,
    repository: input.repository,
    workflowName: input.workflowName,
    workflowRunId: input.workflowRunId,
    workflowRunAttempt: input.workflowRunAttempt,
    artifactName: candidateArtifactName(
      input.applicationSha,
      input.workflowRunAttempt
    ),
    applicationSha: input.applicationSha,
    workspaceFingerprint: build.workspaceFingerprint,
    appBuildInputFingerprint: build.appBuildInputFingerprint,
    toolchain: build.toolchain,
    toolchainHash: hashJson(build.toolchain),
    buildReceiptSha256: hashJson(manifest.receipt),
    artifactManifestFile,
    artifactManifestSha256: sha256File(artifactManifestPath),
    artifactFile: manifest.artifactFile,
    artifactSha256: sha256File(artifactPath)
  })
  verifyManifestLinks(receipt, manifest, artifactManifestPath, artifactPath)
  return receipt
}

export function verifyCandidateArtifactDirectory(
  root: string,
  expected: CandidateArtifactExpectation
): VerifiedCandidateArtifact {
  const receiptPath = join(root, candidateArtifactReceiptFile)
  assertRegularFile(receiptPath)
  const receipt = candidateArtifactReceiptSchema.parse(
    JSON.parse(readFileSync(receiptPath, 'utf8'))
  )
  const expectedIdentity = {
    repository: expected.repository,
    workflowName: expected.workflowName,
    workflowRunId: expected.workflowRunId,
    workflowRunAttempt: expected.workflowRunAttempt,
    artifactName: candidateArtifactName(
      expected.applicationSha,
      expected.workflowRunAttempt
    ),
    applicationSha: expected.applicationSha,
    workspaceFingerprint: expected.workspaceFingerprint,
    appBuildInputFingerprint: expected.appBuildInputFingerprint
  }
  const actualIdentity = {
    repository: receipt.repository,
    workflowName: receipt.workflowName,
    workflowRunId: receipt.workflowRunId,
    workflowRunAttempt: receipt.workflowRunAttempt,
    artifactName: receipt.artifactName,
    applicationSha: receipt.applicationSha,
    workspaceFingerprint: receipt.workspaceFingerprint,
    appBuildInputFingerprint: receipt.appBuildInputFingerprint
  }
  if (JSON.stringify(actualIdentity) !== JSON.stringify(expectedIdentity))
    throw new Error(
      'Candidate artifact receipt proves another run or workspace'
    )

  const entries = readdirSync(root).sort((left, right) =>
    left.localeCompare(right, 'en')
  )
  const expectedEntries = [
    candidateArtifactReceiptFile,
    receipt.artifactFile,
    receipt.artifactManifestFile
  ].sort((left, right) => left.localeCompare(right, 'en'))
  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries))
    throw new Error(
      'Candidate artifact must contain exactly its three proved files'
    )
  for (const entry of entries) assertRegularFile(join(root, entry))

  const artifactManifestPath = join(root, receipt.artifactManifestFile)
  const artifactPath = join(root, receipt.artifactFile)
  const manifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
  )
  verifyManifestLinks(receipt, manifest, artifactManifestPath, artifactPath)
  const build = manifest.receipt.build
  if (
    build.channel !== 'local' ||
    build.dirty ||
    build.commit !== expected.applicationSha ||
    build.workspaceFingerprint !== expected.workspaceFingerprint ||
    build.appBuildInputFingerprint !== expected.appBuildInputFingerprint ||
    JSON.stringify(build.toolchain) !== JSON.stringify(receipt.toolchain)
  )
    throw new Error('Embedded Build Receipt differs from candidate provenance')

  return {
    root,
    artifactPath,
    artifactManifestPath,
    receiptPath,
    receipt,
    manifest
  }
}

export function acquireCandidateArtifact(options: {
  destinationRoot: string
  expected: CandidateArtifactExpectation
  download: (destination: string) => void
}): VerifiedCandidateArtifact {
  try {
    return makeAppImageExecutable(
      verifyCandidateArtifactDirectory(
        options.destinationRoot,
        options.expected
      )
    )
  } catch {
    // A stale or partial generated cache is replaceable. It is never accepted
    // as evidence and is left untouched unless a complete replacement verifies.
  }
  const parent = dirname(options.destinationRoot)
  mkdirSync(parent, { recursive: true })
  const temporary = mkdtempSync(join(parent, '.candidate-artifact-'))
  try {
    options.download(temporary)
    verifyCandidateArtifactDirectory(temporary, options.expected)
    rmSync(options.destinationRoot, { recursive: true, force: true })
    renameSync(temporary, options.destinationRoot)
  } finally {
    if (existsSync(temporary))
      rmSync(temporary, { recursive: true, force: true })
  }
  return makeAppImageExecutable(
    verifyCandidateArtifactDirectory(options.destinationRoot, options.expected)
  )
}

function makeAppImageExecutable(
  artifact: VerifiedCandidateArtifact
): VerifiedCandidateArtifact {
  // actions/upload-artifact intentionally does not preserve Unix file modes.
  // Mode normalization happens only after the downloaded bytes and receipts
  // have verified; chmod does not alter the proved content hash.
  chmodSync(artifact.artifactPath, 0o755)
  return artifact
}

function verifyManifestLinks(
  receipt: CandidateArtifactReceipt,
  manifest: LocalArtifactManifest,
  artifactManifestPath: string,
  artifactPath: string
): void {
  if (
    receipt.artifactManifestSha256 !== sha256File(artifactManifestPath) ||
    receipt.artifactFile !== manifest.artifactFile ||
    receipt.artifactSha256 !== manifest.artifactSha256 ||
    receipt.artifactSha256 !== sha256File(artifactPath) ||
    receipt.buildReceiptSha256 !== hashJson(manifest.receipt) ||
    receipt.buildReceiptSha256 !== manifest.receiptSha256 ||
    receipt.toolchainHash !== hashJson(receipt.toolchain)
  )
    throw new Error('Candidate artifact hash chain is invalid')
}

function assertRegularFile(path: string): void {
  const stats = lstatSync(path)
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`Candidate artifact entry is not a regular file: ${path}`)
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

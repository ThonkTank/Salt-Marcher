import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

export const shaSchema = z.string().regex(/^[0-9a-f]{40}$/)
export const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/)

export const handoffPhases = [
  'candidate-qualified',
  'checked',
  'packaged',
  'packaged-smoke-passed',
  'backup-created',
  'deployment-staged',
  'activated',
  'installed-runtime-verified',
  'storage-retention-applied'
] as const
export const handoffPhaseNameSchema = z.enum(handoffPhases)
export type HandoffPhaseName = z.infer<typeof handoffPhaseNameSchema>

export const requiredJobManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    workflowName: z.string().min(1),
    jobs: z
      .array(
        z
          .object({
            name: z.string().min(1),
            platformRole: z.string().min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict()
  .superRefine((manifest, context) => {
    const names = new Set<string>()
    for (const job of manifest.jobs) {
      if (names.has(job.name))
        context.addIssue({
          code: 'custom',
          message: `Duplicate required job name: ${job.name}`,
          path: ['jobs']
        })
      names.add(job.name)
    }
  })

export type RequiredJobManifest = z.infer<typeof requiredJobManifestSchema>

export const githubWorkflowJobSchema = z
  .object({
    name: z.string().min(1),
    status: z.string().min(1),
    conclusion: z.string().nullable(),
    url: z.url().optional()
  })
  .passthrough()

export const githubWorkflowRunSchema = z
  .object({
    databaseId: z.number().int().positive(),
    headSha: shaSchema,
    status: z.string().min(1),
    conclusion: z.string().nullable(),
    url: z.url(),
    attempt: z.number().int().positive(),
    jobs: z.array(githubWorkflowJobSchema)
  })
  .passthrough()

export type GithubWorkflowRun = z.infer<typeof githubWorkflowRunSchema>

export const workflowEvidenceSchema = z
  .object({
    runId: z.number().int().positive(),
    url: z.url(),
    attempt: z.number().int().positive(),
    headSha: shaSchema,
    requiredJobManifestVersion: z.number().int().positive(),
    jobs: z
      .array(
        z
          .object({
            name: z.string().min(1),
            platformRole: z.string().min(1),
            conclusion: z.literal('success')
          })
          .strict()
      )
      .min(1)
  })
  .strict()

export type WorkflowEvidence = z.infer<typeof workflowEvidenceSchema>

export function sameWorkflowQualification(
  existing: WorkflowEvidence,
  current: WorkflowEvidence
): boolean {
  return (
    existing.headSha === current.headSha &&
    existing.requiredJobManifestVersion ===
      current.requiredJobManifestVersion &&
    JSON.stringify(existing.jobs) === JSON.stringify(current.jobs)
  )
}

export const installedRuntimeEvidenceSchema = z
  .object({
    artifactSha256: fingerprintSchema,
    manifestSha256: fingerprintSchema,
    utilityReady: z.literal(true),
    generation: z.number().int().positive(),
    bootstrap: z
      .object({
        totalMs: z.number().nonnegative(),
        phases: z.record(z.string().min(1), z.number().nonnegative())
      })
      .strict(),
    quickChecks: z
      .array(
        z
          .object({
            path: z.string().min(1),
            role: z.string().min(1),
            result: z.literal('ok')
          })
          .strict()
      )
      .min(1),
    domainReadbacks: z
      .array(
        z
          .object({
            name: z.string().min(1),
            expected: z.unknown(),
            actual: z.unknown(),
            passed: z.literal(true)
          })
          .strict()
      )
      .min(1)
  })
  .strict()

export type InstalledRuntimeEvidence = z.infer<
  typeof installedRuntimeEvidenceSchema
>

export const storageRetentionEvidenceSchema = z
  .object({
    receiptSha256: fingerprintSchema,
    activeDeploymentFingerprint: fingerprintSchema,
    retainedDeploymentFingerprints: z.array(fingerprintSchema),
    deletedDeploymentFingerprints: z.array(fingerprintSchema),
    releasedBytes: z.number().int().nonnegative(),
    retainedInvocations: z.number().int().nonnegative(),
    removedInvocations: z.number().int().nonnegative(),
    removedAttemptFiles: z.array(z.string())
  })
  .strict()

export const handoffPhaseEvidenceSchema = z
  .object({
    workspaceFingerprint: fingerprintSchema,
    appBuildInputFingerprint: fingerprintSchema,
    qualificationInputFingerprint: fingerprintSchema,
    deliveryInputFingerprint: fingerprintSchema,
    toolchainHash: fingerprintSchema,
    candidateArtifactReceiptSha256: fingerprintSchema,
    artifactManifestSha256: fingerprintSchema,
    buildOutputHash: fingerprintSchema.nullable(),
    artifactSha256: fingerprintSchema.nullable(),
    sourceDataHash: fingerprintSchema.nullable(),
    backupManifestSha256: fingerprintSchema.nullable(),
    deploymentManifestSha256: fingerprintSchema.nullable(),
    runtimeEvidenceSha256: fingerprintSchema.nullable(),
    installedSha256: fingerprintSchema.nullable(),
    storageRetention: storageRetentionEvidenceSchema.nullable()
  })
  .strict()

export const handoffPhaseSchema = z
  .object({
    phase: handoffPhaseNameSchema,
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    startedAt: z.iso.datetime().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    inputHash: fingerprintSchema.nullable(),
    outputHash: fingerprintSchema.nullable(),
    evidence: handoffPhaseEvidenceSchema.nullable(),
    error: z.string().nullable()
  })
  .strict()

export const handoffReceiptSchema = z
  .object({
    formatVersion: z.literal(6),
    stateId: z.uuid(),
    originAttemptId: z.uuid(),
    activeAttemptId: z.uuid(),
    status: z.enum(['running', 'complete', 'failed']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    identity: z
      .object({
        commit: shaSchema,
        dirty: z.boolean(),
        workspaceFingerprint: fingerprintSchema,
        appBuildInputFingerprint: fingerprintSchema,
        qualificationInputFingerprint: fingerprintSchema,
        deliveryInputFingerprint: fingerprintSchema,
        toolchainHash: fingerprintSchema,
        candidate: workflowEvidenceSchema
      })
      .strict(),
    phases: z.array(handoffPhaseSchema).length(handoffPhases.length)
  })
  .strict()
  .superRefine((receipt, context) => {
    const actual = receipt.phases.map(({ phase }) => phase)
    if (JSON.stringify(actual) !== JSON.stringify(handoffPhases))
      context.addIssue({
        code: 'custom',
        message: 'Handoff phases must be complete, unique, and ordered',
        path: ['phases']
      })
    if (
      receipt.status === 'complete' &&
      (receipt.completedAt === null ||
        receipt.phases.some(({ status }) => status !== 'completed'))
    )
      context.addIssue({
        code: 'custom',
        message: 'Complete handoff state requires every phase and completedAt',
        path: ['status']
      })
    if (receipt.status !== 'complete' && receipt.completedAt !== null)
      context.addIssue({
        code: 'custom',
        message: 'Incomplete handoff state cannot have completedAt',
        path: ['completedAt']
      })
    let predecessor = hashHandoffValue(receipt.identity)
    let incompleteSeen = false
    for (const [index, phase] of receipt.phases.entries()) {
      if (
        phase.phase === 'storage-retention-applied' &&
        phase.status === 'completed' &&
        phase.evidence?.storageRetention == null
      )
        context.addIssue({
          code: 'custom',
          message: 'Completed storage retention requires retention evidence',
          path: ['phases', index, 'evidence', 'storageRetention']
        })
      if (
        phase.phase !== 'storage-retention-applied' &&
        phase.evidence?.storageRetention != null
      )
        context.addIssue({
          code: 'custom',
          message: 'Storage-retention evidence belongs only to its checkpoint',
          path: ['phases', index, 'evidence', 'storageRetention']
        })
      if (phase.status !== 'completed') {
        incompleteSeen = true
        continue
      }
      if (incompleteSeen)
        context.addIssue({
          code: 'custom',
          message: `Completed handoff phase follows an incomplete predecessor: ${phase.phase}`,
          path: ['phases', index]
        })
      if (
        phase.inputHash !== predecessor ||
        phase.evidence === null ||
        phase.outputHash !==
          hashHandoffValue({
            phase: phase.phase,
            inputHash: phase.inputHash,
            evidence: phase.evidence
          })
      )
        context.addIssue({
          code: 'custom',
          message: `Completed handoff phase has an invalid hash chain: ${phase.phase}`,
          path: ['phases', index]
        })
      predecessor = phase.outputHash ?? predecessor
    }
  })

export type HandoffReceipt = z.infer<typeof handoffReceiptSchema>
export type HandoffIdentity = HandoffReceipt['identity']
export type HandoffPhaseEvidence = z.infer<typeof handoffPhaseEvidenceSchema>

export function sameHandoffApplicationIdentity(
  existing: HandoffIdentity,
  current: HandoffIdentity
): boolean {
  const { candidate: existingCandidate, ...existingInputs } = existing
  const { candidate: currentCandidate, ...currentInputs } = current
  return (
    JSON.stringify(existingInputs) === JSON.stringify(currentInputs) &&
    sameWorkflowQualification(existingCandidate, currentCandidate)
  )
}

export function createHandoffReceipt(
  identity: HandoffIdentity,
  stateId: string,
  attemptId: string,
  timestamp: string
): HandoffReceipt {
  return handoffReceiptSchema.parse({
    formatVersion: 6,
    stateId,
    originAttemptId: attemptId,
    activeAttemptId: attemptId,
    status: 'running',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    identity,
    phases: handoffPhases.map((phase) => ({
      phase,
      status: 'pending',
      startedAt: null,
      durationMs: null,
      inputHash: null,
      outputHash: null,
      evidence: null,
      error: null
    }))
  })
}

export function continueHandoffReceipt(
  receipt: HandoffReceipt,
  attemptId: string,
  updatedAt: string
): HandoffReceipt {
  return handoffReceiptSchema.parse({
    ...receipt,
    activeAttemptId: attemptId,
    status: 'running',
    updatedAt,
    completedAt: null
  })
}

export const handoffInvocationHistorySchema = z
  .object({
    formatVersion: z.literal(2),
    invocations: z.array(
      z
        .object({
          attemptId: z.uuid(),
          applicationSha: shaSchema,
          intent: z.enum(['advance', 'resume']),
          createdAt: z.iso.datetime(),
          statePath: z.string().min(1),
          auditPath: z.string().min(1)
        })
        .strict()
    )
  })
  .strict()
  .superRefine((history, context) => {
    const ids = new Set<string>()
    for (const invocation of history.invocations) {
      if (ids.has(invocation.attemptId))
        context.addIssue({
          code: 'custom',
          message: `Duplicate handoff attempt: ${invocation.attemptId}`,
          path: ['invocations']
        })
      ids.add(invocation.attemptId)
    }
  })

export type HandoffInvocationHistory = z.infer<
  typeof handoffInvocationHistorySchema
>

const legacyHandoffInvocationHistorySchema = z
  .object({
    formatVersion: z.literal(1),
    invocations: z.array(
      z
        .object({
          invocationId: z.uuid(),
          applicationSha: shaSchema,
          createdAt: z.iso.datetime(),
          receiptPath: z.string().min(1)
        })
        .strict()
    )
  })
  .strict()

export function parseHandoffInvocationHistory(
  value: unknown
): HandoffInvocationHistory {
  const current = handoffInvocationHistorySchema.safeParse(value)
  if (current.success) return current.data
  const legacy = legacyHandoffInvocationHistorySchema.parse(value)
  return handoffInvocationHistorySchema.parse({
    formatVersion: 2,
    invocations: legacy.invocations.map((invocation) => ({
      attemptId: invocation.invocationId,
      applicationSha: invocation.applicationSha,
      intent: 'advance',
      createdAt: invocation.createdAt,
      statePath: invocation.receiptPath,
      auditPath: invocation.receiptPath
    }))
  })
}

export function appendHandoffInvocation(
  history: HandoffInvocationHistory,
  invocation: HandoffInvocationHistory['invocations'][number]
): HandoffInvocationHistory {
  return handoffInvocationHistorySchema.parse({
    ...history,
    invocations: [...history.invocations, invocation]
  })
}

export function hashHandoffValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function readRequiredJobManifest(
  workspaceRoot = process.cwd()
): RequiredJobManifest {
  return requiredJobManifestSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(workspaceRoot, 'scripts', 'delivery', 'required-jobs.v4.json'),
        'utf8'
      )
    )
  )
}

export function verifyRequiredJobs(
  manifest: RequiredJobManifest,
  input: GithubWorkflowRun,
  expectedSha: string
): WorkflowEvidence {
  const run = githubWorkflowRunSchema.parse(input)
  if (run.headSha !== expectedSha)
    throw new Error('Candidate workflow head SHA differs from the candidate')
  if (run.status !== 'completed' || run.conclusion !== 'success')
    throw new Error('Candidate workflow is not successfully completed')

  const grouped = new Map<string, typeof run.jobs>()
  for (const job of run.jobs)
    grouped.set(job.name, [...(grouped.get(job.name) ?? []), job])

  const jobs = manifest.jobs.map((required) => {
    const matches = grouped.get(required.name) ?? []
    if (matches.length === 0)
      throw new Error(`Required candidate job is missing: ${required.name}`)
    if (matches.length > 1)
      throw new Error(`Required candidate job is duplicated: ${required.name}`)
    const job = matches[0]!
    if (job.status !== 'completed' || job.conclusion !== 'success')
      throw new Error(
        `Required candidate job is not successful: ${required.name}`
      )
    return {
      name: required.name,
      platformRole: required.platformRole,
      conclusion: 'success' as const
    }
  })

  return workflowEvidenceSchema.parse({
    runId: run.databaseId,
    url: run.url,
    attempt: run.attempt,
    headSha: run.headSha,
    requiredJobManifestVersion: manifest.schemaVersion,
    jobs
  })
}

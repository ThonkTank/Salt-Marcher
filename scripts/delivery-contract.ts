import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { buildToolchainSchema } from '../src/shared/contracts/build-info.js'

export const shaSchema = z.string().regex(/^[0-9a-f]{40}$/)
export const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/)

export const handoffSteps = [
  'check',
  'package',
  'packaged-smoke',
  'backup-and-install',
  'installed-runtime-verification'
] as const
export const handoffStepNameSchema = z.enum(handoffSteps)
export type HandoffStepName = z.infer<typeof handoffStepNameSchema>

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

export const handoffStepEvidenceSchema = z
  .object({
    workspaceFingerprint: fingerprintSchema,
    appBuildInputFingerprint: fingerprintSchema,
    toolchainHash: fingerprintSchema,
    outputHash: fingerprintSchema.nullable(),
    artifactSha256: fingerprintSchema.nullable(),
    installedSha256: fingerprintSchema.nullable()
  })
  .strict()

export const handoffStepSchema = z
  .object({
    step: handoffStepNameSchema,
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    startedAt: z.iso.datetime().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    evidence: handoffStepEvidenceSchema.nullable(),
    error: z.string().nullable()
  })
  .strict()

export const handoffReceiptSchema = z
  .object({
    formatVersion: z.literal(3),
    invocationId: z.uuid(),
    status: z.enum(['running', 'complete', 'failed']),
    mode: z.enum(['fresh', 'resume']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    identity: z
      .object({
        commit: shaSchema,
        dirty: z.boolean(),
        workspaceFingerprint: fingerprintSchema,
        appBuildInputFingerprint: fingerprintSchema,
        toolchainHash: fingerprintSchema,
        candidate: workflowEvidenceSchema
      })
      .strict(),
    steps: z.array(handoffStepSchema).length(handoffSteps.length)
  })
  .strict()
  .superRefine((receipt, context) => {
    const actual = receipt.steps.map(({ step }) => step)
    if (JSON.stringify(actual) !== JSON.stringify(handoffSteps))
      context.addIssue({
        code: 'custom',
        message: 'Handoff steps must be complete, unique, and ordered',
        path: ['steps']
      })
  })

export type HandoffReceipt = z.infer<typeof handoffReceiptSchema>
export type HandoffStepEvidence = z.infer<typeof handoffStepEvidenceSchema>

export const handoffInvocationHistorySchema = z
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
  .superRefine((history, context) => {
    const ids = new Set<string>()
    for (const invocation of history.invocations) {
      if (ids.has(invocation.invocationId))
        context.addIssue({
          code: 'custom',
          message: `Duplicate handoff invocation: ${invocation.invocationId}`,
          path: ['invocations']
        })
      ids.add(invocation.invocationId)
    }
  })

export type HandoffInvocationHistory = z.infer<
  typeof handoffInvocationHistorySchema
>

export function appendHandoffInvocation(
  history: HandoffInvocationHistory,
  invocation: HandoffInvocationHistory['invocations'][number]
): HandoffInvocationHistory {
  return handoffInvocationHistorySchema.parse({
    ...history,
    invocations: [...history.invocations, invocation]
  })
}

export function freshInvocationCount(
  history: HandoffInvocationHistory,
  applicationSha: string
): number {
  return history.invocations.filter(
    (invocation) => invocation.applicationSha === applicationSha
  ).length
}

export function readRequiredJobManifest(
  workspaceRoot = process.cwd()
): RequiredJobManifest {
  return requiredJobManifestSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(workspaceRoot, 'scripts', 'delivery', 'required-jobs.v1.json'),
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

export const finalEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.literal('complete'),
    application: z
      .object({
        sha: shaSchema,
        workspaceFingerprint: fingerprintSchema,
        appBuildInputFingerprint: fingerprintSchema,
        dirty: z.literal(false),
        toolchain: buildToolchainSchema,
        versions: z
          .object({
            installationSchema: z.number().int().nonnegative(),
            campaignSchema: z.number().int().nonnegative(),
            migrationRegistry: z.number().int().nonnegative(),
            encounterEngine: z.union([z.string(), z.number()]),
            rewardEngine: z.union([z.string(), z.number()]),
            config: z.union([z.string(), z.number()]),
            catalogVersion: z.union([z.string(), z.number()]),
            catalogHash: fingerprintSchema
          })
          .strict()
      })
      .strict(),
    candidate: workflowEvidenceSchema,
    handoff: z
      .object({
        invocationId: z.uuid(),
        mode: z.literal('fresh'),
        freshInvocationCountForApplicationSha: z.literal(1),
        exactlyOnce: z.literal(true),
        startedAt: z.iso.datetime(),
        completedAt: z.iso.datetime(),
        steps: z
          .array(
            z
              .object({
                name: handoffStepNameSchema,
                status: z.literal('completed'),
                startedAt: z.iso.datetime(),
                durationMs: z.number().int().nonnegative(),
                outputHash: fingerprintSchema
              })
              .strict()
          )
          .length(handoffSteps.length)
      })
      .strict(),
    artifact: z
      .object({
        path: z.string().min(1),
        sha256: fingerprintSchema,
        manifestSha256: fingerprintSchema,
        outputHash: fingerprintSchema
      })
      .strict(),
    installation: z
      .object({
        artifactSha256: fingerprintSchema,
        manifestSha256: fingerprintSchema,
        utilityReady: z.literal(true),
        generation: z.number().int().positive(),
        backup: z
          .object({
            path: z.string().min(1),
            manifestSha256: fingerprintSchema,
            fileCount: z.number().int().positive(),
            databaseCount: z.number().int().positive()
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
      .strict(),
    main: workflowEvidenceSchema,
    ledger: z
      .object({
        path: z.string().min(1),
        sha256: fingerprintSchema,
        total: z.number().int().positive(),
        verified: z.number().int().nonnegative(),
        notApplicable: z.number().int().nonnegative(),
        open: z.literal(0),
        inProgress: z.literal(0),
        blocked: z.literal(0)
      })
      .strict(),
    reproduction: z
      .object({ commands: z.array(z.string().min(1)).min(1) })
      .strict()
  })
  .strict()

export type FinalEvidence = z.infer<typeof finalEvidenceSchema>

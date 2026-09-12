import { z } from 'zod'
import { releaseVersionSchema } from '../../src/shared/contracts/release.js'
import { releaseEnvironmentPolicy } from './environment-policy.js'
import { releaseDigestSchema } from './request.js'
import {
  digestReleaseDocument,
  verifyQualificationDocuments
} from './qualification.js'

export const liveAcceptanceInputSchema = z
  .object({
    formatVersion: z.literal(1),
    version: releaseVersionSchema,
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    appimageSha256: releaseDigestSchema,
    requestSha256: releaseDigestSchema,
    qualificationSha256: releaseDigestSchema,
    testedAt: z.iso.datetime(),
    checks: z
      .object({
        campaignOpened: z.literal(true),
        changeSaved: z.literal(true),
        updatePerformed: z.literal(true),
        continuedWork: z.literal(true),
        backupRestored: z.literal(true)
      })
      .strict(),
    notes: z.string().trim().min(40).max(8000)
  })
  .strict()

const reviewHistorySchema = z.array(
  z
    .object({
      state: z.string(),
      environments: z.array(
        z
          .object({ id: z.number().int().positive(), name: z.string() })
          .passthrough()
      ),
      user: z
        .object({
          id: z.number().int().positive(),
          login: z.string().min(1),
          type: z.string()
        })
        .passthrough()
    })
    .passthrough()
)

export interface LiveApprovalContext {
  readonly publishRunId: number
  readonly publishRunAttempt: number
  readonly environmentId: number
  readonly reviewHistory: unknown
  readonly observedAt: string
}

/** Context must come from the publishing run's live GitHub API, not dispatch input. */
export function createLiveAcceptanceReceipt(
  inputBytes: Uint8Array,
  requestBytes: Uint8Array,
  manifestBytes: Uint8Array,
  qualificationBytes: Uint8Array,
  context: LiveApprovalContext
) {
  if (inputBytes.byteLength > 64 * 1024)
    throw new Error('Live acceptance input is too large.')
  const input = liveAcceptanceInputSchema.parse(
    JSON.parse(Buffer.from(inputBytes).toString('utf8'))
  )
  const qualification = verifyQualificationDocuments(
    requestBytes,
    manifestBytes,
    qualificationBytes
  )
  if (
    input.version !== qualification.target.version ||
    input.commit !== qualification.target.commit ||
    input.appimageSha256 !== qualification.target.artifact.sha256 ||
    input.requestSha256 !== qualification.requestSha256 ||
    input.qualificationSha256 !== digestReleaseDocument(qualificationBytes)
  )
    throw new Error(
      'Live acceptance refers to different release bytes or qualification evidence.'
    )
  const identity = z
    .object({
      publishRunId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      publishRunAttempt: z.number().int().positive(),
      environmentId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      observedAt: z.iso.datetime()
    })
    .parse(context)
  const history = reviewHistorySchema.parse(context.reviewHistory)
  const applicable = history.filter((review) =>
    review.environments.some(
      (environment) =>
        environment.id === identity.environmentId &&
        environment.name === releaseEnvironmentPolicy.environment
    )
  )
  if (applicable.some((review) => review.state === 'rejected'))
    throw new Error(
      'This publish run contains a rejected release review; use a new publish run for a new approval.'
    )
  const approval = applicable.find(
    (review) =>
      review.state === 'approved' &&
      review.user.type === 'User' &&
      review.user.id === releaseEnvironmentPolicy.reviewer.id
  )
  if (!approval)
    throw new Error(
      'Missing approval by the configured human release reviewer for this publish run.'
    )
  return {
    formatVersion: 1 as const,
    acceptance: input,
    inputSha256: digestReleaseDocument(inputBytes),
    approval: {
      state: 'approved' as const,
      reviewer: { id: approval.user.id, login: approval.user.login },
      environment: {
        id: identity.environmentId,
        name: releaseEnvironmentPolicy.environment
      },
      publishRunId: identity.publishRunId,
      publishRunAttempt: identity.publishRunAttempt,
      observedAt: identity.observedAt
    },
    qualificationWorkflow: qualification.workflow
  }
}

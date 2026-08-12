import { describe, expect, it } from 'vitest'
import {
  sessionPreparationFailureSchema,
  sessionPreparationReceiptSchema,
  sessionPreparationStatusSchema,
  startSessionPreparationResultSchema
} from '../../src/shared/contracts/session-planner.js'

const operationId = '01900000-0000-7000-8000-000000000001'
const sessionId = '01900000-0000-7000-8000-000000000002'
const statuses = [
  'queued',
  'generating',
  'resolving_encounters',
  'saving',
  'succeeded',
  'invalid',
  'stale',
  'failed',
  'canceled'
] as const

describe('Session preparation boundary contract', () => {
  it('exposes exactly the documented durable receipt states', () => {
    expect(sessionPreparationStatusSchema.options).toEqual(statuses)
    for (const status of statuses)
      expect(
        sessionPreparationReceiptSchema.parse({
          operationId,
          sessionId,
          status,
          seed: 42,
          runId: null,
          encounterBatchFingerprint: null,
          cancelRequested: false,
          committedPlannerRevision: status === 'succeeded' ? 3 : null,
          failure: null,
          updatedAt: '2026-08-10T10:00:00.000Z'
        }).status
      ).toBe(status)
  })

  it('keeps failures structured and rejects display prose fields', () => {
    const failure = sessionPreparationFailureSchema.parse({
      stage: 'encounter_import',
      code: 'encounter_batch_invalid',
      retryable: false,
      parameters: { ordinal: 2, reason: 'missing_roster' }
    })
    expect(failure).toEqual({
      stage: 'encounter_import',
      code: 'encounter_batch_invalid',
      retryable: false,
      parameters: { ordinal: 2, reason: 'missing_roster' }
    })
    expect(() =>
      sessionPreparationFailureSchema.parse({
        ...failure,
        message: 'Ein Begegnungsplan ist ungültig.'
      })
    ).toThrow()
  })

  it('returns either immediate acceptance or structured replacement confirmation', () => {
    expect(
      startSessionPreparationResultSchema.parse({
        status: 'confirmation_required',
        operationId,
        code: 'planner_replace_existing',
        parameters: { sceneCount: 4 }
      })
    ).toMatchObject({ status: 'confirmation_required' })
    expect(
      startSessionPreparationResultSchema.parse({
        status: 'accepted',
        receipt: {
          operationId,
          sessionId,
          status: 'queued',
          seed: 42,
          runId: null,
          encounterBatchFingerprint: null,
          cancelRequested: false,
          committedPlannerRevision: null,
          failure: null,
          updatedAt: '2026-08-10T10:00:00.000Z'
        }
      })
    ).toMatchObject({ status: 'accepted', receipt: { status: 'queued' } })
  })
})

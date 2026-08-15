import { describe, expect, it } from 'vitest'
import {
  capabilityFailureSchema,
  freezeCampaignSnapshot
} from '../../src/shared/contracts/campaign.js'
import { coreResultSchema } from '../../src/shared/contracts/core-protocol.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { rendererIncidentSchema } from '../../src/shared/contracts/runtime.js'

describe('capability contract', () => {
  it('allows only documented typed failures', () => {
    expect(
      capabilityFailureSchema.parse({ code: 'not_found', retryable: false })
    ).toEqual({ code: 'not_found', retryable: false })
    expect(
      capabilityFailureSchema.parse({ code: 'stale', retryable: false })
    ).toEqual({ code: 'stale', retryable: false })
    expect(
      capabilityFailureSchema.safeParse({ error: 'database unavailable' })
        .success
    ).toBe(false)
  })

  it('rejects unknown fields instead of silently dropping them', () => {
    expect(
      coreResultSchema.safeParse({
        kind: 'core.result',
        requestId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a031',
        ok: false,
        error: { code: 'internal', retryable: false },
        technicalDetail: 'sqlite error'
      }).success
    ).toBe(false)
    expect(
      capabilityFailureSchema.safeParse({
        code: 'internal',
        retryable: false,
        message: 'sqlite error'
      }).success
    ).toBe(false)
  })

  it('carries code and retryability without a technical message', () => {
    const error = new CapabilityError('timeout', true)

    expect(error.code).toBe('timeout')
    expect(error.retryable).toBe(true)
    expect(error.message).toBe('timeout')
  })

  it('carries bounded structured validation issues without technical prose', () => {
    const issue = {
      code: 'generator_item_unknown' as const,
      path: ['items', '0184d1f4-bba7-7c9c-9d89-5f1c0f36a031', 'origin'],
      parameters: { sourceLineId: 'line-4' }
    }
    expect(
      capabilityFailureSchema.parse({
        code: 'validation_failed',
        retryable: false,
        issues: [issue]
      }).issues
    ).toEqual([issue])
    expect(
      capabilityFailureSchema.safeParse({
        code: 'internal',
        retryable: false,
        issues: [issue]
      }).success
    ).toBe(false)
    expect(
      new CapabilityError('validation_failed', false, [issue]).issues
    ).toEqual([issue])
  })

  it('bounds structured renderer incidents and rejects attached user data', () => {
    expect(
      rendererIncidentSchema.parse({
        workspace: 'hex',
        phase: 'module-load',
        code: 'workspace.module-load',
        errorName: 'ChunkLoadError',
        message: 'Failed to fetch a renderer module',
        scope: 'canvas',
        recoveryClass: 'remount-surface'
      })
    ).toMatchObject({ workspace: 'hex', recoveryClass: 'remount-surface' })
    expect(
      rendererIncidentSchema.safeParse({
        workspace: 'hex',
        phase: 'render',
        code: 'workspace.render',
        errorName: 'Error',
        message: 'failed',
        scope: 'canvas',
        recoveryClass: 'remount-surface',
        campaignName: 'private campaign'
      }).success
    ).toBe(false)
  })

  it('freezes success snapshots at the capability boundary', () => {
    const snapshot = freezeCampaignSnapshot({
      activeCampaignId: null,
      campaigns: [
        {
          id: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a031',
          name: 'Campaign A',
          createdAt: '2026-07-30T10:00:00.000Z'
        }
      ],
      trashedCampaigns: []
    })

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns[0])).toBe(true)
    expect(
      coreResultSchema.parse({
        kind: 'core.result',
        requestId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a031',
        ok: true,
        payload: snapshot
      })
    ).toMatchObject({ ok: true })
  })
})

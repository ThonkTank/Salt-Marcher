import { describe, expect, it } from 'vitest'
import {
  campaignCapabilityResponseSchema,
  capabilityFailureSchema,
  freezeCampaignSnapshot
} from '../../src/shared/contracts/campaign.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

describe('capability contract', () => {
  it('allows only documented typed failures', () => {
    expect(
      capabilityFailureSchema.parse({ code: 'not_found', retryable: false })
    ).toEqual({ code: 'not_found', retryable: false })
    expect(
      capabilityFailureSchema.safeParse({ error: 'database unavailable' })
        .success
    ).toBe(false)
  })

  it('carries code and retryability without a technical message', () => {
    const error = new CapabilityError('timeout', true)

    expect(error.code).toBe('timeout')
    expect(error.retryable).toBe(true)
    expect(error.message).toBe('timeout')
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
      ]
    })

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns[0])).toBe(true)
    expect(
      campaignCapabilityResponseSchema.parse({ ok: true, snapshot })
    ).toMatchObject({ ok: true })
  })
})

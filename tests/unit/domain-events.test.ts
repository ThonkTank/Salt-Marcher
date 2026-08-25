import { describe, expect, it } from 'vitest'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import {
  CoreEventSink,
  publishSessionProjectionInvalidation
} from '../../src/utility/domain-events.js'

describe('CoreEventSink', () => {
  it('validates events and accounts for each published message', () => {
    const messages: unknown[] = []
    const counters = {
      messagesReceived: 0,
      requestsCompleted: 0,
      eventsPublished: 0,
      scheduledWakeups: 0
    }
    const sink = new CoreEventSink(
      { postMessage: (message) => messages.push(message) },
      counters
    )
    sink.post({
      kind: 'session.changed',
      notice: {
        campaignId: '018f1f9c-4f5e-8a12-9234-123456789abc',
        sceneId: '018f1f9c-4f5e-8a12-9234-123456789abd',
        revision: 3,
        reason: 'travel-command'
      }
    })
    expect(messages).toHaveLength(1)
    expect(counters.eventsPublished).toBe(1)
    expect(() => sink.post({ kind: 'unknown' })).toThrow()
    expect(counters.eventsPublished).toBe(1)
  })

  it('publishes an identity-bound Session invalidation from current Live truth', () => {
    const messages: unknown[] = []
    const counters = {
      messagesReceived: 0,
      requestsCompleted: 0,
      eventsPublished: 0,
      scheduledWakeups: 0
    }
    const sink = new CoreEventSink(
      { postMessage: (message) => messages.push(message) },
      counters
    )
    const campaignId = '018f1f9c-4f5e-8a12-9234-123456789abc'
    const sceneId = '018f1f9c-4f5e-8a12-9234-123456789abd'

    publishSessionProjectionInvalidation({
      sink,
      campaigns: { activeCampaignId: () => campaignId },
      play: {
        readSession: () =>
          ({
            revision: 7,
            scene: { focusedSceneId: sceneId }
          }) as LiveSessionSnapshot
      }
    })

    expect(messages).toEqual([
      {
        kind: 'session.changed',
        notice: {
          campaignId,
          sceneId,
          revision: 7,
          reason: 'projection-invalidated'
        }
      }
    ])
    expect(counters.eventsPublished).toBe(1)
  })
})

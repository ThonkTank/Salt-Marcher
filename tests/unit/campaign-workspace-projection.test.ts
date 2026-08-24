import { describe, expect, it, vi } from 'vitest'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import { createSessionHandlers } from '../../src/utility/composition/live-play.js'
import type { LivePlayService } from '../../src/core/encounter/live-combat.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const campaignA = '00000000-0000-4000-8000-00000000000a'
const campaignB = '00000000-0000-4000-8000-00000000000b'
const now = '2026-08-24T16:00:00.000Z'

describe('Campaign Workspace projection', () => {
  it('keeps crossed A/B reads in their identity cache and shows only B', async () => {
    const sessionA = deferred<LiveSessionSnapshot>()
    const sessionB = deferred<LiveSessionSnapshot>()
    const list = vi
      .fn<SaltMarcherApi['campaigns']['list']>()
      .mockResolvedValueOnce(catalog(campaignA))
      .mockResolvedValueOnce(catalog(campaignB))
    const read = vi.fn<SaltMarcherApi['session']['read']>(({ campaignId }) =>
      campaignId === campaignA ? sessionA.promise : sessionB.promise
    )
    const projection = new CampaignWorkspaceProjection(api(list, read))

    const first = projection.load()
    await vi.waitFor(() =>
      expect(read).toHaveBeenCalledWith({ campaignId: campaignA })
    )
    const second = projection.load()
    await vi.waitFor(() =>
      expect(read).toHaveBeenCalledWith({ campaignId: campaignB })
    )

    const acceptedB = session(2)
    sessionB.resolve(acceptedB)
    await expect(second).resolves.toMatchObject({ status: 'ready' })
    expect(projection.snapshot()).toMatchObject({
      status: 'ready',
      sessionCampaignId: campaignB,
      session: acceptedB
    })

    sessionA.resolve(session(1))
    await expect(first).resolves.toMatchObject({ status: 'ready' })
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignB,
      session: acceptedB
    })
  })

  it('reuses only the matching cached Session across A/B/A publication', () => {
    const projection = new CampaignWorkspaceProjection(
      api(
        vi.fn<SaltMarcherApi['campaigns']['list']>(),
        vi.fn<SaltMarcherApi['session']['read']>()
      )
    )
    const acceptedA = session(5)
    const acceptedB = session(3)

    projection.publishCampaigns(catalog(campaignA))
    expect(projection.publishSession(campaignA, acceptedA)).toBe(true)
    projection.publishCampaigns(catalog(campaignB))
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignB,
      session: null
    })
    expect(projection.publishSession(campaignB, acceptedB)).toBe(true)
    projection.publishCampaigns(catalog(campaignA))

    expect(projection.snapshot()).toMatchObject({
      status: 'ready',
      sessionCampaignId: campaignA,
      session: acceptedA
    })
    expect(projection.publishSession(campaignA, session(4))).toBe(false)
    expect(projection.snapshot().session).toBe(acceptedA)
  })

  it('refreshes the catalog when an explicit active-Session identity is stale', async () => {
    const list = vi
      .fn<SaltMarcherApi['campaigns']['list']>()
      .mockResolvedValueOnce(catalog(campaignA))
      .mockResolvedValueOnce(catalog(campaignB))
    const acceptedB = session(7)
    const read = vi.fn<SaltMarcherApi['session']['read']>(({ campaignId }) =>
      campaignId === campaignA
        ? Promise.reject(new CapabilityError('stale', true))
        : Promise.resolve(acceptedB)
    )
    const projection = new CampaignWorkspaceProjection(api(list, read))

    await expect(projection.load()).resolves.toMatchObject({ status: 'ready' })
    expect(read.mock.calls.map(([input]) => input.campaignId)).toEqual([
      campaignA,
      campaignB
    ])
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignB,
      session: acceptedB
    })
  })

  it('keeps a provider-owned pending read alive without a consumer', async () => {
    const pending = deferred<LiveSessionSnapshot>()
    const read = vi.fn<SaltMarcherApi['session']['read']>(() => pending.promise)
    const projection = new CampaignWorkspaceProjection(
      api(
        vi.fn(() => Promise.resolve(catalog(campaignA))),
        read
      )
    )
    const listener = vi.fn()
    const unsubscribe = projection.subscribe(listener)
    const loading = projection.load()
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    unsubscribe()

    const accepted = session(1)
    pending.resolve(accepted)
    await expect(loading).resolves.toMatchObject({ status: 'ready' })
    expect(read).toHaveBeenCalledOnce()
    expect(projection.snapshot().session).toBe(accepted)

    const remounted = vi.fn()
    projection.subscribe(remounted)
    expect(projection.snapshot().session).toBe(accepted)
    expect(read).toHaveBeenCalledOnce()
  })

  it('rejects a Session read whose Campaign is not the Utility active identity', () => {
    const readSession = vi.fn(() => session(1))
    const handlers = createSessionHandlers(
      { readSession } as unknown as LivePlayService,
      () => campaignB
    )

    expect(() => handlers['session.read']({ campaignId: campaignA })).toThrow(
      expect.objectContaining({ code: 'stale', retryable: true })
    )
    expect(readSession).not.toHaveBeenCalled()
    expect(handlers['session.read']({ campaignId: campaignB })).toBe(
      readSession.mock.results[0]?.value
    )
  })
})

function api(
  list: SaltMarcherApi['campaigns']['list'],
  read: SaltMarcherApi['session']['read']
): SaltMarcherApi {
  return {
    campaigns: { list },
    session: { read }
  } as unknown as SaltMarcherApi
}

function catalog(
  activeCampaignId: string | null
): Awaited<ReturnType<SaltMarcherApi['campaigns']['list']>> {
  return {
    activeCampaignId,
    campaigns: [campaignA, campaignB].map((id) => ({
      id,
      name: `Campaign ${id.at(-1)}`,
      createdAt: now
    })),
    trashedCampaigns: []
  }
}

function session(revision: number): LiveSessionSnapshot {
  return Object.freeze({ revision }) as LiveSessionSnapshot
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

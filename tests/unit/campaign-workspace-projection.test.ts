import { describe, expect, it, vi } from 'vitest'
import {
  CampaignReconciliationPendingError,
  CampaignWorkspaceProjection
} from '../../src/renderer/capabilities/campaign-workspace-projection.js'
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

  it('queues same-authority commands and selects the accepted revision at transport time', async () => {
    const created =
      deferred<Awaited<ReturnType<SaltMarcherApi['campaigns']['create']>>>()
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(
      () => created.promise
    )
    const rename = vi.fn<SaltMarcherApi['campaigns']['rename']>((input) =>
      Promise.resolve({
        kind: 'renamed',
        commandId: input.commandId,
        campaignId: input.id,
        snapshot: catalog(campaignA, 6, { [campaignA]: 'Renamed' })
      })
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, rename })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    const creating = projection.createCampaign('New')
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce())
    const renaming = projection.renameCampaign(campaignA, 'Renamed')
    await Promise.resolve()
    expect(rename).not.toHaveBeenCalled()

    created.resolve({
      kind: 'created',
      commandId: create.mock.calls[0]![0].commandId,
      campaignId: campaignA,
      snapshot: catalog(campaignA, 5, { [campaignA]: 'New' })
    })
    await expect(creating).resolves.toMatchObject({ revision: 5 })
    await expect(renaming).resolves.toMatchObject({ revision: 6 })
    const createInput = create.mock.calls[0]![0]
    expectCommandId(createInput.commandId)
    expect(createInput).toEqual({
      commandId: createInput.commandId,
      expectedRegistryRevision: 4,
      name: 'New'
    })
    const renameInput = rename.mock.calls[0]![0]
    expectCommandId(renameInput.commandId)
    expect(renameInput).toEqual({
      commandId: renameInput.commandId,
      expectedRegistryRevision: 5,
      id: campaignA,
      name: 'Renamed'
    })
  })

  it('keeps queued A/B/A activation aligned with the matching Session cache', async () => {
    const activatedB =
      deferred<Awaited<ReturnType<SaltMarcherApi['campaigns']['activate']>>>()
    const activatedA =
      deferred<Awaited<ReturnType<SaltMarcherApi['campaigns']['activate']>>>()
    const activate = vi
      .fn<SaltMarcherApi['campaigns']['activate']>()
      .mockImplementationOnce(() => activatedB.promise)
      .mockImplementationOnce(() => activatedA.promise)
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ activate })
    )
    const sessionA = session(7)
    const sessionB = session(8)
    projection.publishCampaigns(catalog(campaignA, 10))
    projection.publishSession(campaignA, sessionA)
    projection.publishSession(campaignB, sessionB)

    const switchToB = projection.activateCampaign(campaignB)
    const switchBackToA = projection.activateCampaign(campaignA)
    await vi.waitFor(() => expect(activate).toHaveBeenCalledOnce())
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignA,
      session: sessionA
    })

    activatedB.resolve({
      kind: 'activated',
      commandId: activate.mock.calls[0]![0].commandId,
      campaignId: campaignB,
      snapshot: catalog(campaignB, 11)
    })
    await expect(switchToB).resolves.toMatchObject({ revision: 11 })
    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(2))
    const activationInput = activate.mock.calls[1]![0]
    expectCommandId(activationInput.commandId)
    expect(activationInput).toEqual({
      commandId: activationInput.commandId,
      expectedRegistryRevision: 11,
      id: campaignA
    })
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignB,
      session: sessionB
    })

    activatedA.resolve({
      kind: 'activated',
      commandId: activate.mock.calls[1]![0].commandId,
      campaignId: campaignA,
      snapshot: catalog(campaignA, 12)
    })
    await expect(switchBackToA).resolves.toMatchObject({ revision: 12 })
    expect(projection.snapshot()).toMatchObject({
      sessionCampaignId: campaignA,
      session: sessionA
    })
  })

  it('accepts an unknown Campaign write only through its exact durable receipt', async () => {
    const unknown = new CapabilityError('outcome_unknown', true)
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(unknown)
    )
    const commandReceipt = vi.fn<SaltMarcherApi['campaigns']['commandReceipt']>(
      ({ commandId }) =>
        Promise.resolve({
          kind: 'created',
          commandId,
          campaignId: campaignB,
          snapshot: catalog(campaignB, 5, { [campaignB]: 'Recovered' })
        })
    )
    const list = vi.fn<SaltMarcherApi['campaigns']['list']>(() =>
      Promise.resolve(catalog(campaignA, 99))
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, commandReceipt, list })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    await expect(projection.createCampaign('Recovered')).resolves.toMatchObject(
      {
        revision: 5,
        activeCampaignId: campaignB
      }
    )

    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).toHaveBeenCalledWith({
      commandId: create.mock.calls[0]![0].commandId
    })
    expect(list).not.toHaveBeenCalled()
    expect(projection.snapshot()).toMatchObject({
      campaigns: { revision: 5, activeCampaignId: campaignB },
      reconciliationCommandId: null
    })
  })

  it('blocks the Campaign authority while receipt lookup is interrupted and retries only that lookup', async () => {
    const unknown = new CapabilityError('outcome_unknown', true)
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(unknown)
    )
    const rename = vi.fn<SaltMarcherApi['campaigns']['rename']>()
    let receiptReads = 0
    const commandReceipt = vi.fn<SaltMarcherApi['campaigns']['commandReceipt']>(
      ({ commandId }) => {
        receiptReads += 1
        return receiptReads === 1
          ? Promise.reject(new CapabilityError('core_unavailable', true))
          : Promise.resolve({
              kind: 'created',
              commandId,
              campaignId: campaignB,
              snapshot: catalog(campaignB, 5, { [campaignB]: 'Recovered' })
            })
      }
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, rename, commandReceipt })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    await expect(projection.createCampaign('Recovered')).rejects.toMatchObject({
      name: 'CampaignReconciliationPendingError'
    })
    const commandId = create.mock.calls[0]![0].commandId
    expect(projection.snapshot().reconciliationCommandId).toBe(commandId)

    await expect(
      projection.renameCampaign(campaignA, 'Blocked')
    ).rejects.toEqual(new CampaignReconciliationPendingError(commandId))
    expect(rename).not.toHaveBeenCalled()

    await expect(projection.reconcilePendingCommand()).resolves.toMatchObject({
      kind: 'created',
      commandId,
      snapshot: { revision: 5 }
    })
    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).toHaveBeenCalledTimes(2)
    expect(commandReceipt.mock.calls.map(([input]) => input.commandId)).toEqual(
      [commandId, commandId]
    )
    expect(projection.snapshot().reconciliationCommandId).toBeNull()
  })

  it('uses targeted Campaign and Session readback when an exact receipt is absent and never replays the write', async () => {
    const unknown = new CapabilityError('outcome_unknown', true)
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(unknown)
    )
    const commandReceipt = vi.fn<SaltMarcherApi['campaigns']['commandReceipt']>(
      () => Promise.resolve(null)
    )
    const list = vi.fn<SaltMarcherApi['campaigns']['list']>(() =>
      Promise.resolve(catalog(campaignB, 5))
    )
    const acceptedSession = session(9)
    const read = vi.fn<SaltMarcherApi['session']['read']>(() =>
      Promise.resolve(acceptedSession)
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, commandReceipt, list }, { read })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    await expect(projection.createCampaign('Unknown')).rejects.toBe(unknown)

    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).toHaveBeenCalledOnce()
    expect(list).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledWith({ campaignId: campaignB })
    expect(projection.snapshot()).toMatchObject({
      campaigns: { revision: 5, activeCampaignId: campaignB },
      sessionCampaignId: campaignB,
      session: acceptedSession,
      reconciliationCommandId: null
    })
  })

  it('finishes absent-receipt readback before the next Campaign transport selects its revision', async () => {
    const unknown = new CapabilityError('outcome_unknown', true)
    const readback = deferred<ReturnType<typeof catalog>>()
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(unknown)
    )
    const commandReceipt = vi.fn<SaltMarcherApi['campaigns']['commandReceipt']>(
      () => Promise.resolve(null)
    )
    const list = vi.fn<SaltMarcherApi['campaigns']['list']>(
      () => readback.promise
    )
    const rename = vi.fn<SaltMarcherApi['campaigns']['rename']>((input) =>
      Promise.resolve({
        kind: 'renamed',
        commandId: input.commandId,
        campaignId: input.id,
        snapshot: catalog(campaignA, 6, {
          [campaignA]: 'After readback'
        })
      })
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, commandReceipt, list, rename })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    const creating = projection.createCampaign('Unknown')
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce())
    const renaming = projection.renameCampaign(campaignA, 'After readback')
    await Promise.resolve()
    expect(rename).not.toHaveBeenCalled()

    readback.resolve(catalog(campaignA, 5))
    await expect(creating).rejects.toBe(unknown)
    await expect(renaming).resolves.toMatchObject({ revision: 6 })
    const renameInput = rename.mock.calls[0]![0]
    expectCommandId(renameInput.commandId)
    expect(renameInput).toEqual({
      commandId: renameInput.commandId,
      expectedRegistryRevision: 5,
      id: campaignA,
      name: 'After readback'
    })
  })

  it('clears the pending UI state after an explicit check conclusively finds no receipt', async () => {
    const unknown = new CapabilityError('outcome_unknown', true)
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(unknown)
    )
    const commandReceipt = vi
      .fn<SaltMarcherApi['campaigns']['commandReceipt']>()
      .mockRejectedValueOnce(new CapabilityError('core_unavailable', true))
      .mockResolvedValueOnce(null)
    const list = vi.fn<SaltMarcherApi['campaigns']['list']>(() =>
      Promise.resolve(catalog(campaignA, 4))
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns(
        { create, commandReceipt, list },
        {
          read: vi.fn(() => Promise.resolve(session(4)))
        }
      )
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    await expect(projection.createCampaign('Unknown')).rejects.toBeInstanceOf(
      CampaignReconciliationPendingError
    )
    await expect(projection.reconcilePendingCommand()).rejects.toBe(unknown)

    expect(create).toHaveBeenCalledOnce()
    expect(projection.snapshot().reconciliationCommandId).toBeNull()
    await expect(projection.reconcilePendingCommand()).rejects.toThrow(
      'No Campaign command is pending.'
    )
  })

  it('does not let a failed command poison the next queued command', async () => {
    const failure = new Error('create failed')
    const create = vi.fn<SaltMarcherApi['campaigns']['create']>(() =>
      Promise.reject(failure)
    )
    const rename = vi.fn<SaltMarcherApi['campaigns']['rename']>((input) =>
      Promise.resolve({
        kind: 'renamed',
        commandId: input.commandId,
        campaignId: input.id,
        snapshot: catalog(campaignA, 5, { [campaignA]: 'Still runs' })
      })
    )
    const projection = new CampaignWorkspaceProjection(
      apiWithCampaigns({ create, rename })
    )
    projection.publishCampaigns(catalog(campaignA, 4))

    const creating = projection.createCampaign('Fails')
    const renaming = projection.renameCampaign(campaignA, 'Still runs')

    await expect(creating).rejects.toBe(failure)
    await expect(renaming).resolves.toMatchObject({ revision: 5 })
    const renameInput = rename.mock.calls[0]![0]
    expectCommandId(renameInput.commandId)
    expect(renameInput).toEqual({
      commandId: renameInput.commandId,
      expectedRegistryRevision: 4,
      id: campaignA,
      name: 'Still runs'
    })
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

function apiWithCampaigns(
  campaigns: Partial<SaltMarcherApi['campaigns']>,
  sessionCapability: Partial<SaltMarcherApi['session']> = {}
): SaltMarcherApi {
  return {
    campaigns: {
      list: vi.fn(() => Promise.resolve(catalog(campaignA))),
      commandReceipt: vi.fn(() => Promise.resolve(null)),
      ...campaigns
    },
    session: {
      read: vi.fn(() => Promise.resolve(session(0))),
      ...sessionCapability
    }
  } as unknown as SaltMarcherApi
}

function catalog(
  activeCampaignId: string | null,
  revision = 0,
  names: Readonly<Record<string, string>> = {}
): Awaited<ReturnType<SaltMarcherApi['campaigns']['list']>> {
  return {
    revision,
    activeCampaignId,
    campaigns: [campaignA, campaignB].map((id) => ({
      id,
      name: names[id] ?? `Campaign ${id.at(-1)}`,
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

function expectCommandId(value: string): void {
  expect(value).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
}

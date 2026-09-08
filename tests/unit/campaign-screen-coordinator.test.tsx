/// <reference types="vite/client" />
// @vitest-environment jsdom
import type { CampaignCommandReceipt } from '../../src/shared/contracts/campaign.js'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode, ContextType } from 'react'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { CapabilityContext } from '../../src/renderer/capabilities/capability-context.js'
import { useCampaignSessionCoordinator } from '../../src/renderer/features/workspace/use-campaign-session-coordinator.js'
const guards = vi.hoisted(() => ({ dirty: false }))
vi.mock(
  '../../src/renderer/shell/maintenance-drafts.js',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../src/renderer/shell/maintenance-drafts.js')
    >()),
    hasMaintenanceDrafts: () => guards.dirty
  })
)
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
  guards.dirty = false
})
function fixture() {
  const snapshot = {
    campaigns: {
      revision: 1,
      activeCampaignId: 'a',
      campaigns: [],
      trashedCampaigns: []
    },
    session: null as LiveSessionSnapshot | null,
    sessionCampaignId: null as string | null,
    reconciliationCommandId: null as string | null
  }
  const projection = {
    subscribe: () => () => {},
    snapshot: () => snapshot,
    load: vi.fn<
      (
        loadSession: boolean
      ) => Promise<{ status: string; value: typeof snapshot }>
    >(() =>
      Promise.resolve({
        status: 'ready',
        value: snapshot
      })
    ),
    createCampaign: vi.fn(() => Promise.resolve(snapshot.campaigns)),
    reconcilePendingCommand: vi.fn<() => Promise<CampaignCommandReceipt>>(),
    activateCampaign: vi.fn<(id: string) => Promise<void>>(() =>
      Promise.resolve()
    ),
    refreshActiveSession: vi.fn(() => {
      snapshot.session = { revision: 1 } as LiveSessionSnapshot
      snapshot.sessionCampaignId = snapshot.campaigns.activeCampaignId
      return Promise.resolve({
        status: 'ready',
        value: snapshot,
        cause: null as unknown
      })
    })
  }
  const report = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CapabilityContext.Provider
      value={
        { campaignWorkspace: projection } as unknown as NonNullable<
          ContextType<typeof CapabilityContext>
        >
      }
    >
      {children}
    </CapabilityContext.Provider>
  )
  const hook = renderHook(() => useCampaignSessionCoordinator(report), {
    wrapper
  })
  return { ...hook, projection, report }
}
it('always starts in campaigns and loads only the catalog', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  expect(f.result.current.screen).toBe('campaigns')
  expect(f.projection.load).toHaveBeenCalledWith(false)
  expect(f.projection.refreshActiveSession).not.toHaveBeenCalled()
  await act(async () => {
    await f.result.current.switchCampaign('a')
  })
  expect(f.result.current.screen).toBe('workspace')
  act(() => f.result.current.showCampaigns())
  expect(f.result.current.screen).toBe('campaigns')
})
it('keeps the campaign screen on session failure and retries the read without activating again', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  f.projection.refreshActiveSession.mockResolvedValueOnce({
    status: 'failure',
    value: {} as never,
    cause: new Error('unavailable')
  })
  await act(async () => {
    expect(await f.result.current.switchCampaign('a')).toBe(false)
  })
  expect(f.result.current.screen).toBe('campaigns')
  expect(f.result.current.sessionRetry).toBe(true)
  await act(async () => {
    await f.result.current.retrySession()
  })
  expect(f.result.current.screen).toBe('workspace')
  expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
})
it('protects workspace drafts when returning to the campaign screen', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  await act(async () => {
    await f.result.current.switchCampaign('a')
  })
  guards.dirty = true
  act(() => f.result.current.showCampaigns())
  expect(f.result.current.screen).toBe('workspace')
  expect(f.report).toHaveBeenCalledOnce()
})
it.each(['save', 'discard'] as const)(
  'holds confirmed activation until central %s can finish the session read',
  async (choice) => {
    const f = fixture()
    await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
    f.projection.refreshActiveSession.mockRejectedValueOnce(
      new Error('offline')
    )
    await act(async () => {
      expect(await f.result.current.switchCampaign('a')).toBe(false)
    })
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    await act(async () => {
      expect(await f.result.current.switchCampaign('b')).toBe(false)
    })
    expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve(choice)).toEqual([])
    })
    expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
    expect(f.result.current.screen).toBe('campaigns')
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  }
)
it('does not release maintenance while the original session read is running', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  const ready = f.projection.refreshActiveSession.getMockImplementation()!
  let finish!: () => void
  f.projection.refreshActiveSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => {
          void ready().then(resolve)
        }
      })
  )
  let opening!: Promise<boolean>
  act(() => {
    opening = f.result.current.switchCampaign('a')
  })
  await waitFor(() =>
    expect(f.projection.refreshActiveSession).toHaveBeenCalledOnce()
  )
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  const done = vi.fn()
  let resolving!: Promise<readonly unknown[]>
  act(() => {
    resolving = resolution!.resolve('discard')
    void resolving.then(done)
  })
  expect(done).not.toHaveBeenCalled()
  await act(async () => {
    finish()
    await opening
    await resolving
  })
  expect(await resolving).toEqual([])
  expect(f.result.current.screen).toBe('campaigns')
  expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
})
it.each(['stale', 'empty', 'different'] as const)(
  'rejects %s session results and preserves a read-only retry',
  async (kind) => {
    const f = fixture()
    await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
    const root = f.projection.snapshot()
    f.projection.refreshActiveSession.mockResolvedValueOnce({
      status: kind === 'stale' ? 'stale' : 'ready',
      value: {
        ...root,
        session:
          kind === 'empty' ? null : ({ revision: 1 } as LiveSessionSnapshot),
        sessionCampaignId: kind === 'different' ? 'b' : 'a'
      },
      cause: null
    })
    await act(async () => {
      expect(await f.result.current.switchCampaign('a')).toBe(false)
    })
    expect(f.result.current.sessionRetry).toBe(true)
    await act(async () => {
      expect(await f.result.current.retrySession()).toBe(true)
    })
    expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
  }
)
it('keeps the original campaign identity when the active campaign changes before retry', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  f.projection.refreshActiveSession.mockRejectedValueOnce(new Error('offline'))
  await act(async () => {
    await f.result.current.switchCampaign('a')
  })
  f.projection.snapshot().campaigns.activeCampaignId = 'b'
  await act(async () => {
    expect(await f.result.current.retrySession()).toBe(false)
  })
  expect(f.projection.refreshActiveSession).toHaveBeenCalledOnce()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  f.projection.snapshot().campaigns.activeCampaignId = 'a'
  await act(async () => {
    expect(await f.result.current.retrySession()).toBe(true)
  })
  expect(f.projection.activateCampaign).toHaveBeenCalledOnce()
})
it('retains failed receipt recovery for the next central attempt and never activates again', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  const root = f.projection.snapshot()
  root.reconciliationCommandId = 'original-command'
  f.projection.reconcilePendingCommand
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => {
      root.reconciliationCommandId = null
      return Promise.resolve({
        kind: 'activated',
        commandId: 'original-command',
        campaignId: 'a',
        snapshot: root.campaigns
      })
    })
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await resolution!.resolve('save')).toHaveLength(1)
  })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  await act(async () => {
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(f.projection.activateCampaign).not.toHaveBeenCalled()
  expect(f.projection.refreshActiveSession).toHaveBeenCalledOnce()
  expect(f.result.current.screen).toBe('campaigns')
})
it('keeps the recovered receipt campaign rather than opening a newer active campaign', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  const root = f.projection.snapshot()
  root.reconciliationCommandId = 'original-command'
  root.campaigns.activeCampaignId = 'b'
  f.projection.reconcilePendingCommand.mockImplementationOnce(() => {
    root.reconciliationCommandId = null
    return Promise.resolve({
      kind: 'activated',
      commandId: 'original-command',
      campaignId: 'a',
      snapshot: { ...root.campaigns, activeCampaignId: 'a' }
    })
  })
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await resolution!.resolve('save')).toHaveLength(1)
  })
  expect(f.projection.refreshActiveSession).not.toHaveBeenCalled()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  root.campaigns.activeCampaignId = 'a'
  await act(async () => {
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(f.projection.activateCampaign).not.toHaveBeenCalled()
  expect(f.projection.refreshActiveSession).toHaveBeenCalledOnce()
})
it('blocks public activation while maintenance is locked', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await f.result.current.switchCampaign('a')).toBe(false)
  })
  expect(f.projection.activateCampaign).not.toHaveBeenCalled()
})
it('does not create a second campaign after a confirmed create whose session read failed', async () => {
  const f = fixture()
  await waitFor(() => expect(f.result.current.catalogStatus).toBe('ready'))
  f.projection.refreshActiveSession.mockRejectedValueOnce(new Error('offline'))
  await act(async () => {
    expect(await f.result.current.createCampaign(' New ')).toBe(false)
  })
  expect(f.projection.createCampaign).toHaveBeenCalledWith('New')
  await act(async () => {
    expect(await f.result.current.createCampaign('New')).toBe(false)
  })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  await act(async () => {
    expect(await f.result.current.retrySession()).toBe(true)
  })
  expect(f.projection.createCampaign).toHaveBeenCalledOnce()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})

/// <reference types="vite/client" />
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode, ContextType } from 'react'
import { CapabilityContext } from '../../src/renderer/capabilities/capability-context.js'
import { useCampaignSessionCoordinator } from '../../src/renderer/features/workspace/use-campaign-session-coordinator.js'
const guards = vi.hoisted(() => ({ dirty: false }))
vi.mock('../../src/renderer/shell/maintenance-drafts.js', () => ({
  hasMaintenanceDrafts: () => guards.dirty
}))
afterEach(() => {
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
    session: null,
    sessionCampaignId: null,
    reconciliationCommandId: null
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
    activateCampaign: vi.fn<(id: string) => Promise<void>>(() =>
      Promise.resolve()
    ),
    refreshActiveSession: vi.fn(() =>
      Promise.resolve({
        status: 'ready',
        value: snapshot,
        cause: null as unknown
      })
    )
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
    await f.result.current.switchCampaign('a')
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

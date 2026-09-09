// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useSessionMutationController } from '../../src/renderer/features/session/use-session-mutation-controller.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
afterEach(cleanup)
function fixture() {
  const initial = { scene: { revision: 4 } } as LiveSessionSnapshot
  let root = {
    sessionCampaignId: 'a',
    campaigns: { activeCampaignId: 'a' },
    session: initial
  }
  const setSnapshot = vi.fn<Dispatch<SetStateAction<LiveSessionSnapshot>>>()
  const onError = vi.fn()
  const context = {
    campaignWorkspace: { snapshot: () => root }
  } as unknown as CapabilityContextValue
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CapabilityContext.Provider value={context}>
      {children}
    </CapabilityContext.Provider>
  )
  const hook = renderHook(
    () =>
      useSessionMutationController({ snapshot: initial, setSnapshot, onError }),
    { wrapper }
  )
  return {
    mutate: hook.result.current.mutateSnapshot,
    setSnapshot,
    onError,
    revise: () => {
      root = {
        ...root,
        session: { scene: { revision: 9 } } as LiveSessionSnapshot
      }
    },
    switchCampaign: () => {
      root = { ...root, campaigns: { activeCampaignId: 'b' } }
    }
  }
}
it('uses the current projection even when the original callback predates a draft save', async () => {
  const f = fixture()
  f.revise()
  const operation = vi.fn((current: LiveSessionSnapshot) =>
    Promise.resolve(current)
  )
  await act(async () => {
    await f.mutate(operation)
  })
  expect(operation.mock.calls[0]?.[0].scene.revision).toBe(9)
  expect(f.setSnapshot.mock.calls[0]?.[0]).toEqual({ scene: { revision: 9 } })
  expect(f.onError).not.toHaveBeenCalled()
})
it.each(['before', 'during'] as const)(
  'rejects changed campaign %s a retained mutation',
  async (when) => {
    const f = fixture()
    if (when === 'before') f.switchCampaign()
    const operation = vi.fn((current: LiveSessionSnapshot) => {
      f.switchCampaign()
      return Promise.resolve(current)
    })
    await act(async () => {
      await f.mutate(operation)
    })
    expect(operation).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
    expect(f.setSnapshot).not.toHaveBeenCalled()
    expect(f.onError).toHaveBeenCalledOnce()
  }
)

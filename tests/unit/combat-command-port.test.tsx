// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useCombatCommandPort } from '../../src/renderer/features/encounter/use-combat-command-port.js'

const input = {
  commandId: 'command',
  sceneId: 'scene',
  command: {
    kind: 'changeHp' as const,
    input: {
      cardId: 'card',
      amount: 1,
      healing: false,
      expectedRevision: 7
    }
  }
}

function fixture() {
  let root = {
    sessionCampaignId: 'original',
    campaigns: { activeCampaignId: 'original' }
  }
  const session = { party: { revision: 8 } }
  const execute = vi.fn().mockResolvedValue({ characterId: 'character' })
  const status = vi.fn().mockResolvedValue({ receipt: null })
  const refresh = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ status: 'ready', value: { ...root, session } })
    )
  const context = {
    api: {
      combat: {
        executeCommand: execute,
        commandStatus: status
      }
    },
    campaignWorkspace: {
      snapshot: () => ({ ...root, session }),
      refreshActiveSession: refresh
    }
  } as unknown as CapabilityContextValue
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CapabilityContext.Provider value={context}>
      {children}
    </CapabilityContext.Provider>
  )
  const hook = renderHook(() => useCombatCommandPort('original'), {
    wrapper
  })
  return {
    port: hook.result.current,
    execute,
    status,
    refresh,
    session,
    switchCampaign: (identity: 'active' | 'loaded') => {
      root =
        identity === 'active'
          ? { ...root, campaigns: { activeCampaignId: 'other' } }
          : { ...root, sessionCampaignId: 'other' }
    }
  }
}

describe('Combat command original campaign port', () => {
  it('binds writes and status to the original campaign and awaits full refresh', async () => {
    const f = fixture()
    expect(f.port.current()).toBe(f.session)
    await f.port.execute(input)
    await f.port.status(input)
    expect(f.execute).toHaveBeenCalledWith({ ...input, campaignId: 'original' })
    expect(f.status).toHaveBeenCalledWith({ ...input, campaignId: 'original' })
    expect(await f.port.refresh()).toBe(f.session)
    expect(f.refresh).toHaveBeenCalledOnce()
  })

  for (const identity of ['active', 'loaded'] as const) {
    it.each(['before', 'during'] as const)(
      `rejects changed ${identity} campaign %s transport`,
      async (when) => {
        const f = fixture()
        if (when === 'before') f.switchCampaign(identity)
        const write = f.port.execute(input)
        const read = f.port.status(input)
        const refresh = f.port.refresh()
        if (when === 'during') f.switchCampaign(identity)
        await expect(write).rejects.toMatchObject({
          code: when === 'before' ? 'stale' : 'outcome_unknown'
        })
        await expect(read).rejects.toMatchObject({ code: 'stale' })
        await expect(refresh).rejects.toMatchObject({ code: 'stale' })
        for (const transport of [f.execute, f.status, f.refresh])
          expect(transport).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
      }
    )
  }

  it.each([
    { status: 'stale' },
    {
      status: 'ready',
      value: {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' },
        session: null
      }
    },
    {
      status: 'ready',
      value: {
        sessionCampaignId: 'other',
        campaigns: { activeCampaignId: 'original' },
        session: {}
      }
    },
    {
      status: 'ready',
      value: {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'other' },
        session: {}
      }
    }
  ])('rejects unusable refresh result %#', async (result) => {
    const f = fixture()
    f.refresh.mockResolvedValue(result)
    await expect(f.port.refresh()).rejects.toMatchObject({ code: 'stale' })
    expect(f.execute).not.toHaveBeenCalled()
  })

  it('preserves refresh failure without replaying a write', async () => {
    const f = fixture()
    const cause = new Error('read failed')
    f.refresh.mockResolvedValue({ status: 'failure', cause })
    await expect(f.port.refresh()).rejects.toBe(cause)
    f.refresh.mockRejectedValue(cause)
    await expect(f.port.refresh()).rejects.toBe(cause)
    expect(f.execute).not.toHaveBeenCalled()
  })
})

it.each(['active', 'loaded'] as const)(
  'rejects synchronous reads after the %s campaign changes',
  (identity) => {
    const f = fixture()
    f.switchCampaign(identity)
    expect(() => f.port.current()).toThrow()
    expect(f.execute).not.toHaveBeenCalled()
    expect(f.refresh).not.toHaveBeenCalled()
  }
)

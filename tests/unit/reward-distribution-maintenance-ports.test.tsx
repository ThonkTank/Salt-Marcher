// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useRewardDistributionPort } from '../../src/renderer/features/loot/use-loot-ports.js'

describe('Reward distribution original campaign binding', () => {
  it.each(['before', 'during'] as const)(
    'holds campaign identity %s transport',
    async (when) => {
      const distributeForCampaign = vi.fn().mockResolvedValue({})
      const distributionStatus = vi.fn().mockResolvedValue({})
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: { loot: { distributeForCampaign, distributionStatus } },
        campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
      } as unknown as CapabilityContextValue
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CapabilityContext.Provider value={context}>
          {children}
        </CapabilityContext.Provider>
      )
      const hook = renderHook(() => useRewardDistributionPort(), { wrapper })
      const original = hook.result.current
      const input = {
        commandId: 'command',
        treasureId: 'treasure',
        expectedTreasureRevision: 3,
        expectedPartyRevision: 7,
        items: [
          {
            itemId: 'item',
            shares: [{ characterId: 'character', quantity: 2 }]
          }
        ]
      }
      await original.distribute(input)
      await original.distributionStatus(input)
      expect(distributeForCampaign).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      expect(distributionStatus).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      distributeForCampaign.mockClear()
      distributionStatus.mockClear()
      if (when === 'before') root = { ...root, sessionCampaignId: 'other' }
      const write = original.distribute(input)
      const read = original.distributionStatus(input)
      root = { ...root, campaigns: { activeCampaignId: 'other' } }
      await expect(write).rejects.toMatchObject({
        code: when === 'before' ? 'stale' : 'outcome_unknown'
      })
      await expect(read).rejects.toMatchObject({ code: 'stale' })
      expect(distributeForCampaign).toHaveBeenCalledTimes(
        when === 'before' ? 0 : 1
      )
      expect(distributionStatus).toHaveBeenCalledTimes(
        when === 'before' ? 0 : 1
      )
    }
  )
})

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { SaveSceneGroupInput } from '../../src/shared/contracts/scene.js'
import type { CommitGroupRewardInput } from '../../src/shared/contracts/loot.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useGroupManagerCapabilityPorts } from '../../src/renderer/features/session/use-group-manager-capability-ports.js'

describe('group manager campaign-bound session read', () => {
  it.each(['session', 'active'] as const)(
    'rejects a changed %s campaign instead of reading the replacement',
    async (changed) => {
      const read = vi.fn().mockResolvedValue({ revision: 3 })
      const groupSaveReceipt = vi.fn().mockResolvedValue(null)
      const groupRewardReceipt = vi.fn().mockResolvedValue(null)
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: {
          runtime: { e2e: true },
          creatures: {},
          scene: { groupSaveReceipt },
          loot: { groupRewardReceipt },
          combat: {},
          session: { read }
        },
        campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
      } as unknown as CapabilityContextValue
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CapabilityContext.Provider value={context}>
          {children}
        </CapabilityContext.Provider>
      )
      const hook = renderHook(() => useGroupManagerCapabilityPorts(), {
        wrapper
      })
      const original = hook.result.current
      const normal = { commandId: 'save' } as SaveSceneGroupInput
      const reward = { commandId: 'reward' } as CommitGroupRewardInput
      expect(await original.scene.groupSaveReceipt(normal)).toBeNull()
      expect(await original.loot.groupRewardReceipt(reward)).toBeNull()
      expect(groupSaveReceipt).toHaveBeenCalledWith({
        ...normal,
        campaignId: 'original'
      })
      expect(groupRewardReceipt).toHaveBeenCalledWith({
        ...reward,
        campaignId: 'original'
      })
      const originalPort = original.session
      expect(await originalPort.read()).toEqual({ revision: 3 })
      expect(read).toHaveBeenCalledWith({ campaignId: 'original' })
      root =
        changed === 'session'
          ? { ...root, sessionCampaignId: 'replacement' }
          : { ...root, campaigns: { activeCampaignId: 'replacement' } }
      await expect(originalPort.read()).rejects.toMatchObject({ code: 'stale' })
      await expect(
        original.scene.groupSaveReceipt(normal)
      ).rejects.toMatchObject({ code: 'stale' })
      await expect(
        original.loot.groupRewardReceipt(reward)
      ).rejects.toMatchObject({ code: 'stale' })
      expect(groupSaveReceipt).toHaveBeenCalledOnce()
      expect(groupRewardReceipt).toHaveBeenCalledOnce()
      expect(read).toHaveBeenCalledOnce()
    }
  )
})

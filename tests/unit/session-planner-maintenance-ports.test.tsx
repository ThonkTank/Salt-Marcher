// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useSessionPlannerPorts } from '../../src/renderer/features/session-planner/use-session-planner-ports.js'

describe('Planner maintenance campaign binding', () => {
  it.each(['session', 'active', 'during-read'] as const)(
    'rejects %s campaign changes before status or cancellation',
    async (changed) => {
      const preparationMaintenanceStatus = vi
        .fn()
        .mockResolvedValue({ operations: [] })
      const cancelPreparationForMaintenance = vi
        .fn()
        .mockResolvedValue({ receipt: null })
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: {
          sessionPlanner: {
            preparationMaintenanceStatus,
            cancelPreparationForMaintenance
          },
          encounters: {},
          encounterPlans: {},
          loot: {}
        },
        campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
      } as unknown as CapabilityContextValue
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CapabilityContext.Provider value={context}>
          {children}
        </CapabilityContext.Provider>
      )
      const hook = renderHook(() => useSessionPlannerPorts(), { wrapper })
      const original = hook.result.current.planner
      if (changed === 'during-read') {
        const status = original.preparationMaintenanceStatus(['operation'])
        const cancel = original.cancelPreparationForMaintenance('operation')
        root = { ...root, sessionCampaignId: 'replacement' }
        await expect(status).rejects.toMatchObject({ code: 'stale' })
        await expect(cancel).rejects.toMatchObject({ code: 'stale' })
        expect(preparationMaintenanceStatus).toHaveBeenCalledOnce()
        expect(cancelPreparationForMaintenance).toHaveBeenCalledOnce()
        return
      }
      await original.preparationMaintenanceStatus(['operation'])
      await original.cancelPreparationForMaintenance('operation')
      expect(preparationMaintenanceStatus).toHaveBeenCalledWith({
        campaignId: 'original',
        operationIds: ['operation']
      })
      expect(cancelPreparationForMaintenance).toHaveBeenCalledWith({
        campaignId: 'original',
        operationId: 'operation'
      })
      root =
        changed === 'session'
          ? { ...root, sessionCampaignId: 'replacement' }
          : { ...root, campaigns: { activeCampaignId: 'replacement' } }
      await expect(
        original.preparationMaintenanceStatus([])
      ).rejects.toMatchObject({ code: 'stale' })
      await expect(
        original.cancelPreparationForMaintenance('operation')
      ).rejects.toMatchObject({ code: 'stale' })
      expect(preparationMaintenanceStatus).toHaveBeenCalledOnce()
      expect(cancelPreparationForMaintenance).toHaveBeenCalledOnce()
    }
  )
})

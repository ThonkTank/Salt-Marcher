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
  it.each(['before', 'during'] as const)(
    'binds generated loot and workspace reads %s transport',
    async (when) => {
      const acceptGeneratedForCampaign = vi.fn().mockResolvedValue({})
      const generatedAcceptanceStatus = vi
        .fn()
        .mockResolvedValue({ receipt: null, treasure: null })
      const readForCampaign = vi.fn().mockResolvedValue({})
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: {
          sessionPlanner: { readForCampaign },
          encounterPlans: {},
          loot: { acceptGeneratedForCampaign, generatedAcceptanceStatus }
        },
        campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
      } as unknown as CapabilityContextValue
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CapabilityContext.Provider value={context}>
          {children}
        </CapabilityContext.Provider>
      )
      const { result } = renderHook(() => useSessionPlannerPorts(), { wrapper })
      const original = result.current
      const input = {
        commandId: 'command',
        runId: 'run',
        generatedTreasureId: 'treasure',
        label: 'Original',
        anchor: { kind: 'unplaced' as const }
      }
      await original.loot.acceptGenerated(input)
      await original.loot.generatedAcceptanceStatus(input)
      await original.planner.read()
      expect(acceptGeneratedForCampaign).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      expect(generatedAcceptanceStatus).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      expect(readForCampaign).toHaveBeenCalledWith({ campaignId: 'original' })
      for (const fn of [
        acceptGeneratedForCampaign,
        generatedAcceptanceStatus,
        readForCampaign
      ])
        fn.mockClear()
      if (when === 'before')
        root = { ...root, campaigns: { activeCampaignId: 'other' } }
      const write = original.loot.acceptGenerated(input)
      const status = original.loot.generatedAcceptanceStatus(input)
      const workspace = original.planner.read()
      root = { ...root, campaigns: { activeCampaignId: 'other' } }
      await expect(write).rejects.toMatchObject({
        code: when === 'before' ? 'stale' : 'outcome_unknown'
      })
      await expect(status).rejects.toMatchObject({ code: 'stale' })
      await expect(workspace).rejects.toMatchObject({ code: 'stale' })
      for (const fn of [
        acceptGeneratedForCampaign,
        generatedAcceptanceStatus,
        readForCampaign
      ])
        expect(fn).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
    }
  )

  it.each(['before', 'during'] as const)(
    'binds writes and recovery reads to the original campaign %s transport',
    async (when) => {
      const executeCommand = vi.fn().mockResolvedValue({})
      const commandStatus = vi.fn().mockResolvedValue({ receipt: null })
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: {
          sessionPlanner: { executeCommand, commandStatus },
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
      const input = {
        commandId: 'command',
        command: {
          kind: 'create' as const,
          input: { name: 'Original request' }
        }
      }
      await original.executeCommand(input)
      await original.commandStatus(input)
      expect(executeCommand).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      expect(commandStatus).toHaveBeenCalledWith({
        ...input,
        campaignId: 'original'
      })
      executeCommand.mockClear()
      commandStatus.mockClear()
      if (when === 'before') root = { ...root, sessionCampaignId: 'other' }
      const write = original.executeCommand(input)
      const read = original.commandStatus(input)
      root = { ...root, sessionCampaignId: 'other' }
      await expect(write).rejects.toMatchObject({
        code: when === 'before' ? 'stale' : 'outcome_unknown'
      })
      await expect(read).rejects.toMatchObject({ code: 'stale' })
      expect(executeCommand).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
      expect(commandStatus).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
      root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      await original.commandStatus(input)
      expect(commandStatus).toHaveBeenLastCalledWith({
        ...input,
        campaignId: 'original'
      })
    }
  )

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

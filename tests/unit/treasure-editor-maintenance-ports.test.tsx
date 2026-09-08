// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useTreasureEditorPort } from '../../src/renderer/features/loot/use-loot-ports.js'

describe('Treasure editor campaign binding', () => {
  it.each(['before', 'during'] as const)(
    'retains the original campaign %s transport',
    async (when) => {
      const createForCampaign = vi.fn().mockResolvedValue({})
      const updateForCampaign = vi.fn().mockResolvedValue({})
      const editorStatus = vi
        .fn()
        .mockResolvedValue({ receipt: null, treasure: null })
      let root = {
        sessionCampaignId: 'original',
        campaigns: { activeCampaignId: 'original' }
      }
      const context = {
        api: {
          loot: {
            createForCampaign,
            updateForCampaign,
            editorStatus,
            catalog: vi.fn()
          }
        },
        campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
      } as unknown as CapabilityContextValue
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CapabilityContext.Provider value={context}>
          {children}
        </CapabilityContext.Provider>
      )
      const hook = renderHook(() => useTreasureEditorPort(), { wrapper })
      const original = hook.result.current
      const create = {
        commandId: 'command',
        label: 'Original',
        anchor: { kind: 'unplaced' as const },
        containers: [],
        items: []
      }
      const update = { ...create, treasureId: 'treasure', expectedRevision: 1 }
      const command = { kind: 'create' as const, input: create }
      await original.create(create)
      await original.update(update)
      await original.editorStatus(command)
      expect(createForCampaign).toHaveBeenCalledWith({
        ...create,
        campaignId: 'original'
      })
      expect(updateForCampaign).toHaveBeenCalledWith({
        ...update,
        campaignId: 'original'
      })
      expect(editorStatus).toHaveBeenCalledWith({
        command,
        campaignId: 'original'
      })
      for (const fn of [createForCampaign, updateForCampaign, editorStatus])
        fn.mockClear()
      if (when === 'before') root = { ...root, sessionCampaignId: 'other' }
      const creating = original.create(create)
      const updating = original.update(update)
      const reading = original.editorStatus(command)
      root = { ...root, sessionCampaignId: 'other' }
      await expect(creating).rejects.toMatchObject({
        code: when === 'before' ? 'stale' : 'outcome_unknown'
      })
      await expect(updating).rejects.toMatchObject({
        code: when === 'before' ? 'stale' : 'outcome_unknown'
      })
      await expect(reading).rejects.toMatchObject({ code: 'stale' })
      for (const fn of [createForCampaign, updateForCampaign, editorStatus])
        expect(fn).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
    }
  )
})

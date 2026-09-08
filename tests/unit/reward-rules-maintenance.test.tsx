// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignRewardRulesCard } from '../../src/renderer/features/workspace/campaign-reward-rules-card.js'
import type { CampaignRewardRulesPort } from '../../src/renderer/features/workspace/campaign-reward-rules-port.js'
import type { CampaignRules } from '../../src/shared/contracts/campaign-rules.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
const initial: CampaignRules = {
  revision: 0,
  rewardXpBasis: 'base',
  updatedAt: '2026-09-08T00:00:00Z'
}
const saved: CampaignRules = {
  ...initial,
  revision: 1,
  rewardXpBasis: 'adjusted'
}
let resolution: MaintenanceDraftResolution | undefined
function begin() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
afterEach(() => {
  act(() => resolution?.release())
  resolution = undefined
  cleanup()
})
async function view(overrides: Partial<CampaignRewardRulesPort> = {}) {
  const port: CampaignRewardRulesPort = {
    read: vi.fn().mockResolvedValue(initial),
    update: vi.fn().mockResolvedValue(saved),
    commandReceipt: vi.fn().mockResolvedValue(null),
    ...overrides
  }
  const onError = vi.fn()
  render(
    <CampaignRewardRulesCard
      campaignRules={port}
      activeCampaignId="campaign"
      onError={onError}
    />
  )
  const radios = screen.getAllByRole('radio')
  await waitFor(() => expect(radios[1]).toBeEnabled())
  return { port, onError, adjusted: radios[1]!, base: radios[0]! }
}
describe('reward rules maintenance coordination', () => {
  it('blocks a new immediate write during maintenance', async () => {
    const { port, adjusted } = await view()
    begin()
    expect(adjusted).toBeDisabled()
    fireEvent.click(adjusted)
    await act(async () => {
      expect(await resolution!.resolve('check')).toEqual([])
    })
    expect(port.update).not.toHaveBeenCalled()
  })
  it.each(['save', 'discard'] as const)(
    'waits for an in-flight command on %s without repeating or undoing it',
    async (choice) => {
      let finish!: () => void
      const update = vi.fn(
        () =>
          new Promise<CampaignRules>((resolve) => {
            finish = () => resolve(saved)
          })
      )
      const { adjusted, base } = await view({ update })
      fireEvent.click(adjusted)
      await waitFor(() => expect(update).toHaveBeenCalledOnce())
      begin()
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
      fireEvent.click(base)
      await act(async () => {
        const result = resolution!.resolve(choice)
        finish()
        expect(await result).toEqual([])
      })
      expect(update).toHaveBeenCalledOnce()
      expect(adjusted).toBeChecked()
    }
  )
  it('reconciles an unknown outcome using the same command ID, never another update', async () => {
    const update = vi
      .fn<CampaignRewardRulesPort['update']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const commandReceipt = vi
      .fn<CampaignRewardRulesPort['commandReceipt']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved)
    const { adjusted } = await view({ update, commandReceipt })
    fireEvent.click(adjusted)
    await screen.findByRole('button', { name: 'Ergebnis erneut prüfen' })
    await waitFor(() => expect(commandReceipt).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(update).toHaveBeenCalledOnce()
    const commandId = update.mock.calls[0]![0].commandId
    expect(commandReceipt).toHaveBeenNthCalledWith(1, { commandId })
    expect(commandReceipt).toHaveBeenNthCalledWith(2, { commandId })
    expect(adjusted).toBeChecked()
  })
  it('keeps maintenance blocked when receipt lookup fails, then permits a read-only retry', async () => {
    const update = vi
      .fn()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const commandReceipt = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(saved)
    const { adjusted, onError } = await view({ update, commandReceipt })
    fireEvent.click(adjusted)
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toHaveLength(1)
    })
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(update).toHaveBeenCalledOnce()
  })
  it('contains a failed stale reload without losing the last known rule', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('reload offline'))
    const { adjusted, base, onError } = await view({
      read,
      update: vi.fn().mockRejectedValue(new CapabilityError('stale', false))
    })
    fireEvent.click(adjusted)
    await waitFor(() => expect(onError).toHaveBeenCalledWith('reload offline'))
    expect(base).toBeChecked()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
})

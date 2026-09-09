// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useCharacterLootPort } from '../../src/renderer/features/loot/use-loot-ports.js'

const command = {
  commandId: 'command',
  characterId: 'character',
  entryId: 'entry',
  expectedRevision: 1,
  quantity: 1,
  status: 'sold' as const,
  reason: 'Test'
}
function fixture() {
  const loot = {
    ledgerForCampaign: vi.fn().mockResolvedValue({ entries: [] }),
    correctLedgerForCampaign: vi.fn().mockResolvedValue({ entries: [] }),
    ledgerCorrectionStatus: vi
      .fn()
      .mockResolvedValue({ receipt: null, ledger: { entries: [] } })
  }
  let root = {
    sessionCampaignId: 'original',
    campaigns: { activeCampaignId: 'original' }
  }
  const context = {
    api: { loot },
    campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
  } as unknown as CapabilityContextValue
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CapabilityContext.Provider value={context}>
      {children}
    </CapabilityContext.Provider>
  )
  const hook = renderHook(() => useCharacterLootPort(), { wrapper })
  return {
    port: hook.result.current,
    loot,
    change: (dimension: 'session' | 'active') => {
      root =
        dimension === 'session'
          ? { ...root, sessionCampaignId: 'other' }
          : { ...root, campaigns: { activeCampaignId: 'other' } }
    }
  }
}
describe('character ledger campaign binding', () => {
  it('sends the original campaign on reads, correction and receipt lookup', async () => {
    const f = fixture()
    await f.port.ledger({ characterId: command.characterId })
    await f.port.correctLedger(command)
    await f.port.correctionStatus(command)
    expect(f.loot.ledgerForCampaign).toHaveBeenCalledWith({
      characterId: command.characterId,
      campaignId: 'original'
    })
    expect(f.loot.correctLedgerForCampaign).toHaveBeenCalledWith({
      ...command,
      campaignId: 'original'
    })
    expect(f.loot.ledgerCorrectionStatus).toHaveBeenCalledWith({
      ...command,
      campaignId: 'original'
    })
  })
  it.each(['session', 'active'] as const)(
    'rejects a changed %s before any transport',
    async (dimension) => {
      const f = fixture()
      f.change(dimension)
      await expect(
        f.port.ledger({ characterId: command.characterId })
      ).rejects.toMatchObject({ code: 'stale' })
      await expect(f.port.correctLedger(command)).rejects.toMatchObject({
        code: 'stale'
      })
      await expect(f.port.correctionStatus(command)).rejects.toMatchObject({
        code: 'stale'
      })
      expect(f.loot.ledgerForCampaign).not.toHaveBeenCalled()
      expect(f.loot.correctLedgerForCampaign).not.toHaveBeenCalled()
      expect(f.loot.ledgerCorrectionStatus).not.toHaveBeenCalled()
    }
  )
  it('rejects old responses when campaign changes during transport', async () => {
    const f = fixture()
    const read = f.port.ledger({ characterId: command.characterId })
    const save = f.port.correctLedger(command)
    const status = f.port.correctionStatus(command)
    f.change('active')
    await expect(read).rejects.toMatchObject({ code: 'stale' })
    await expect(save).rejects.toMatchObject({ code: 'stale' })
    await expect(status).rejects.toMatchObject({ code: 'stale' })
  })
})

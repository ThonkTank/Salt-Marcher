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
import { CharacterLootLedgerDialog } from '../../src/renderer/features/loot/character-loot-ledger-dialog.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { PartyCharacter } from '../../src/shared/contracts/party.js'
import {
  emptyItemDefinitionComponents,
  type CharacterLootEntry,
  type CharacterLootLedger
} from '../../src/shared/contracts/loot.js'

const character = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Edrik'
} as PartyCharacter
const entry: CharacterLootEntry = {
  id: '00000000-0000-4000-8000-000000000002',
  characterId: character.id,
  treasureId: null,
  treasureItemId: null,
  source: 'award',
  itemReference: { kind: 'legacy', definitionId: 'pearl' },
  definition: {
    reference: { kind: 'legacy', definitionId: 'pearl' },
    name: 'Perle',
    unitValueCp: 100,
    unitCapacity: 1,
    stackable: true,
    magic: false,
    rarity: null,
    curse: null,
    components: emptyItemDefinitionComponents
  },
  quantity: 1,
  status: 'received',
  provenance: {
    kind: 'treasure_distribution',
    treasureLabel: 'Fund',
    recipientName: 'Edrik'
  },
  rewardProvenance: null,
  correctsEntryId: null,
  supersededByEntryId: null,
  correctionReason: null,
  receivedAt: '2026-09-08T00:00:00.000Z'
}
const initial: CharacterLootLedger = {
  characterId: character.id,
  revision: 1,
  entries: [entry]
}
const corrected: CharacterLootLedger = {
  ...initial,
  revision: 2,
  entries: [
    { ...entry, supersededByEntryId: '00000000-0000-4000-8000-000000000003' },
    {
      ...entry,
      id: '00000000-0000-4000-8000-000000000003',
      source: 'correction',
      correctsEntryId: entry.id,
      correctionReason: 'Verkauf',
      status: 'sold'
    }
  ]
}
const later: CharacterLootLedger = {
  ...corrected,
  revision: 3,
  entries: [
    ...corrected.entries,
    {
      ...entry,
      id: '00000000-0000-4000-8000-000000000004',
      source: 'correction',
      correctionReason: 'Spätere Änderung',
      status: 'given_away'
    }
  ]
}
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
})
function fixture() {
  let stored = initial
  let root = {
    sessionCampaignId: 'original',
    campaigns: { activeCampaignId: 'original' }
  }
  const save = vi.fn().mockImplementation(() => {
    stored = corrected
    return Promise.resolve(corrected)
  })
  const status = vi
    .fn()
    .mockResolvedValue({ receipt: corrected, ledger: later })
  const read = vi.fn().mockImplementation(() => Promise.resolve(stored))
  const context = {
    api: {
      loot: {
        ledgerForCampaign: read,
        correctLedgerForCampaign: save,
        ledgerCorrectionStatus: status
      }
    },
    campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
  } as unknown as CapabilityContextValue
  const close = vi.fn()
  render(
    <CapabilityContext.Provider value={context}>
      <ModalLayerProvider>
        <CharacterLootLedgerDialog
          character={character}
          close={close}
          onError={vi.fn()}
        />
      </ModalLayerProvider>
    </CapabilityContext.Provider>
  )
  return {
    save,
    status,
    read,
    close,
    changeCampaign: (id: string) => {
      root = { sessionCampaignId: id, campaigns: { activeCampaignId: id } }
    }
  }
}
async function draft(reason = 'Verkauf') {
  fireEvent.click(await screen.findByRole('button', { name: 'Korrigieren' }))
  fireEvent.change(screen.getByLabelText('Grund'), {
    target: { value: reason }
  })
}
function begin() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
async function resolve(choice: 'save' | 'discard') {
  let result!: Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
  await act(async () => {
    result = await resolution!.resolve(choice)
  })
  return result
}
async function loseResponse(f: ReturnType<typeof fixture>) {
  f.save.mockRejectedValue(new Error('lost response'))
  await draft()
  fireEvent.click(screen.getByRole('button', { name: 'Korrektur speichern' }))
  await screen.findByRole('button', { name: 'Gespeicherten Stand prüfen' })
}

describe('character ledger maintenance and recovery', () => {
  it.each(['save', 'discard'] as const)(
    'resolves an open correction with %s and blocks new input immediately',
    async (choice) => {
      const f = fixture()
      await draft()
      begin()
      fireEvent.change(screen.getByLabelText('Grund'), {
        target: { value: 'Forbidden' }
      })
      expect(await resolve(choice)).toEqual([])
      expect(f.save).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
      if (choice === 'save')
        expect(f.save.mock.calls[0]?.[0]).toMatchObject({
          characterId: character.id,
          campaignId: 'original',
          reason: 'Verkauf',
          expectedRevision: 1
        })
      expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument()
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    }
  )
  it('keeps invalid input for correction and preserves it when maintenance is canceled', async () => {
    const f = fixture()
    await draft('')
    begin()
    expect(await resolve('save')).toMatchObject([
      { label: 'Persönliche Beute: Edrik' }
    ])
    expect(f.save).not.toHaveBeenCalled()
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    expect(screen.getByLabelText('Grund')).toBeEnabled()
  })
  it('waits for an existing booking and does not book again when discarding', async () => {
    const f = fixture()
    let finish!: (value: CharacterLootLedger) => void
    f.save.mockReturnValue(
      new Promise((done) => {
        finish = done
      })
    )
    await draft()
    fireEvent.click(screen.getByRole('button', { name: 'Korrektur speichern' }))
    await waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    begin()
    let result!: Promise<readonly unknown[]>
    const finished = vi.fn()
    act(() => {
      result = resolution!.resolve('discard')
      void result.then(finished)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(finished).not.toHaveBeenCalled()
    f.read.mockResolvedValue(corrected)
    await act(async () => {
      finish(corrected)
      await result
    })
    expect(await result).toEqual([])
    expect(f.save).toHaveBeenCalledOnce()
  })
  it('retries a failed receipt read with the original input and keeps later ledger entries without another write', async () => {
    const f = fixture()
    f.status.mockRejectedValueOnce(new Error('read unavailable'))
    await loseResponse(f)
    expect(screen.getByLabelText('Grund')).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
    )
    await waitFor(() => expect(f.status).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
      ).toBeEnabled()
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
    )
    await screen.findByText('Korrektur: Spätere Änderung')
    expect(f.status.mock.calls[0]?.[0]).toEqual(f.save.mock.calls[0]?.[0])
    expect(f.status.mock.calls[1]?.[0]).toEqual(f.save.mock.calls[0]?.[0])
    expect(f.save).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument()
  })
  it.each(['save', 'discard'] as const)(
    'automatically reconciles a confirmed booking before maintenance %s',
    async (choice) => {
      const f = fixture()
      await loseResponse(f)
      begin()
      expect(await resolve(choice)).toEqual([])
      expect(f.status).toHaveBeenCalledOnce()
      expect(f.save).toHaveBeenCalledOnce()
      expect(screen.getByText('Korrektur: Spätere Änderung')).toBeVisible()
    }
  )
  it('keeps an absent correction editable and only writes after an explicit save', async () => {
    const f = fixture()
    f.status.mockResolvedValue({ receipt: null, ledger: initial })
    await loseResponse(f)
    fireEvent.click(
      screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
    )
    await waitFor(() => expect(screen.getByLabelText('Grund')).toBeEnabled())
    expect(f.save).toHaveBeenCalledOnce()
    f.save.mockResolvedValue(corrected)
    fireEvent.click(screen.getByRole('button', { name: 'Korrektur speichern' }))
    await waitFor(() =>
      expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument()
    )
    expect(f.save).toHaveBeenCalledTimes(2)
  })
  it('does not apply an absent correction onto a newer ledger and allows discard', async () => {
    const f = fixture()
    f.status.mockResolvedValue({ receipt: null, ledger: later })
    await loseResponse(f)
    begin()
    expect(await resolve('save')).toHaveLength(1)
    expect(screen.getByLabelText('Grund')).toHaveValue('Verkauf')
    f.read.mockResolvedValue(later)
    expect(await resolve('discard')).toEqual([])
    expect(f.save).toHaveBeenCalledOnce()
  })
  it('keeps recovery on the original campaign port', async () => {
    const f = fixture()
    await loseResponse(f)
    f.changeCampaign('other')
    fireEvent.click(
      screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
      ).toBeEnabled()
    )
    expect(f.status).not.toHaveBeenCalled()
    f.changeCampaign('original')
    fireEvent.click(
      screen.getByRole('button', { name: 'Gespeicherten Stand prüfen' })
    )
    await screen.findByText('Korrektur: Spätere Änderung')
    expect(f.status.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'original'
    })
  })
})

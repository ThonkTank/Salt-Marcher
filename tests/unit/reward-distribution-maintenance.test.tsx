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
import { RewardDistributionDialog } from '../../src/renderer/features/loot/reward-distribution-dialog.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import {
  emptyItemDefinitionComponents,
  type Treasure,
  type LootDistributionResult
} from '../../src/shared/contracts/loot.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

const initial: Treasure = {
  id: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  label: 'Fund',
  anchor: { kind: 'unplaced' },
  source: { kind: 'manual' },
  containers: [],
  items: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      provenance: { kind: 'manual' },
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
      quantity: 4,
      allocatedQuantity: 0,
      containerId: null,
      position: 0
    }
  ],
  totalValueCp: 400,
  allocatedValueCp: 0,
  distributionState: 'open',
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z'
}
const stored: Treasure = {
  ...initial,
  revision: 2,
  distributionState: 'partial',
  allocatedValueCp: 300,
  items: initial.items.map((item) => ({ ...item, allocatedQuantity: 3 }))
}
const later: Treasure = { ...stored, revision: 3, label: 'Später geändert' }
const first = '00000000-0000-4000-8000-000000000011'
const second = '00000000-0000-4000-8000-000000000012'
const snapshot = {
  party: {
    revision: 7,
    members: [
      { id: first, name: 'Alrik', active: true },
      { id: second, name: 'Brynn', active: true }
    ]
  }
} as unknown as LiveSessionSnapshot
const receipt: LootDistributionResult = { treasure: stored, createdEntries: [] }
let resolution: MaintenanceDraftResolution | undefined
let unregister: (() => void) | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  unregister?.()
  unregister = undefined
  cleanup()
})
function fixture() {
  let root = {
    sessionCampaignId: 'original',
    campaigns: { activeCampaignId: 'original' }
  }
  const distribute = vi.fn().mockResolvedValue(receipt)
  const status = vi
    .fn()
    .mockResolvedValue({ receipt, treasure: later, partyRevision: 9 })
  const completed = vi.fn<() => Promise<void>>().mockResolvedValue()
  const close = vi.fn()
  const context = {
    api: {
      loot: { distributeForCampaign: distribute, distributionStatus: status }
    },
    campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
  } as unknown as CapabilityContextValue
  render(
    <CapabilityContext.Provider value={context}>
      <ModalLayerProvider>
        <RewardDistributionDialog
          treasure={initial}
          snapshot={snapshot}
          completed={completed}
          close={close}
          onError={vi.fn()}
          maintenanceId="distribution-test"
        />
      </ModalLayerProvider>
    </CapabilityContext.Provider>
  )
  return {
    distribute,
    status,
    completed,
    close,
    changeCampaign: (id: string) => {
      root = { sessionCampaignId: id, campaigns: { activeCampaignId: id } }
    }
  }
}
function draft() {
  fireEvent.change(screen.getByLabelText('Empfänger für Perle'), {
    target: { value: first }
  })
  fireEvent.change(screen.getByLabelText('Menge für Perle'), {
    target: { value: 1 }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Aufteilen' }))
  fireEvent.change(screen.getAllByLabelText('Empfänger für Perle')[1]!, {
    target: { value: second }
  })
  fireEvent.change(screen.getAllByLabelText('Menge für Perle')[1]!, {
    target: { value: 2 }
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
  f.distribute.mockRejectedValue(new Error('lost response'))
  draft()
  fireEvent.click(
    screen.getByRole('button', { name: 'Verteilung abschließen' })
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
    ).toBeEnabled()
  )
}
function retry() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
  )
}

describe('Reward distribution maintenance', () => {
  it.each(['save', 'discard'] as const)(
    'settles multiple shares with %s and immediately blocks edits and close',
    async (choice) => {
      const f = fixture()
      draft()
      begin()
      expect(
        screen.getAllByLabelText('Menge für Perle')[0]!.closest('[inert]')
      ).not.toBeNull()
      fireEvent.change(screen.getAllByLabelText('Menge für Perle')[0]!, {
        target: { value: 4 }
      })
      fireEvent.click(screen.getByRole('button', { name: 'Aufteilen' }))
      expect(screen.getAllByLabelText('Menge für Perle')).toHaveLength(2)
      expect(screen.getAllByLabelText('Menge für Perle')[0]).toHaveValue(1)
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled()
      expect(await resolve(choice)).toEqual([])
      expect(f.distribute).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
      if (choice === 'save')
        expect(f.distribute.mock.calls[0]?.[0]).toMatchObject({
          campaignId: 'original',
          treasureId: initial.id,
          expectedTreasureRevision: 1,
          expectedPartyRevision: 7,
          items: [
            {
              itemId: initial.items[0]!.id,
              shares: [
                { characterId: first, quantity: 1 },
                { characterId: second, quantity: 2 }
              ]
            }
          ]
        })
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    }
  )
  it('closes an untouched dialog without distributing', async () => {
    const f = fixture()
    begin()
    expect(await resolve('save')).toEqual([])
    expect(f.close).toHaveBeenCalledOnce()
    expect(f.distribute).not.toHaveBeenCalled()
  })
  it.each(['duplicate', 'overallocated', 'fraction'] as const)(
    'retains %s shares after rejected save and canceled maintenance',
    async (kind) => {
      const f = fixture()
      draft()
      if (kind === 'duplicate')
        fireEvent.change(screen.getAllByLabelText('Empfänger für Perle')[1]!, {
          target: { value: first }
        })
      else
        fireEvent.change(screen.getAllByLabelText('Menge für Perle')[1]!, {
          target: { value: kind === 'fraction' ? 1.5 : 4 }
        })
      begin()
      expect(await resolve('save')).toMatchObject([
        { label: 'Beuteverteilung: Fund' }
      ])
      expect(f.distribute).not.toHaveBeenCalled()
      act(() => {
        resolution!.release()
        resolution = undefined
      })
      expect(
        screen.getAllByLabelText('Menge für Perle')[0]!.closest('[inert]')
      ).toBeNull()
      expect(screen.getAllByLabelText('Menge für Perle')).toHaveLength(2)
    }
  )
  it('waits for an existing booking and its async parent completion before discard finishes', async () => {
    const f = fixture()
    let finishWrite!: (value: LootDistributionResult) => void
    let finishRefresh!: () => void
    f.distribute.mockReturnValue(
      new Promise((done) => {
        finishWrite = done
      })
    )
    f.completed.mockReturnValue(
      new Promise<void>((done) => {
        finishRefresh = done
      })
    )
    draft()
    fireEvent.click(
      screen.getByRole('button', { name: 'Verteilung abschließen' })
    )
    await waitFor(() => expect(f.distribute).toHaveBeenCalledOnce())
    begin()
    let result!: Promise<readonly unknown[]>
    const finished = vi.fn()
    act(() => {
      result = resolution!.resolve('discard')
      void result.then(finished)
    })
    await act(async () => {
      finishWrite(receipt)
      await Promise.resolve()
    })
    expect(f.completed).toHaveBeenCalledOnce()
    expect(finished).not.toHaveBeenCalled()
    await act(async () => {
      finishRefresh()
      await result
    })
    expect(await result).toEqual([])
    expect(f.distribute).toHaveBeenCalledOnce()
    expect(f.close).not.toHaveBeenCalled()
  })
  it('retries a failed receipt read with the exact original booking without replay', async () => {
    const f = fixture()
    f.status.mockRejectedValueOnce(new Error('read failed'))
    await loseResponse(f)
    retry()
    await waitFor(() => expect(f.status).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
      ).toBeEnabled()
    )
    expect(f.completed).not.toHaveBeenCalled()
    retry()
    await waitFor(() =>
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    )
    const original: unknown = f.distribute.mock.calls[0]?.[0]
    expect(f.status.mock.calls).toEqual([[original], [original]])
    expect(f.distribute).toHaveBeenCalledOnce()
  })
  it('reconciles a confirmed booking after the parent refresh fails', async () => {
    const f = fixture()
    f.completed.mockRejectedValueOnce(new Error('refresh failed'))
    draft()
    fireEvent.click(
      screen.getByRole('button', { name: 'Verteilung abschließen' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
      ).toBeEnabled()
    )
    begin()
    expect(await resolve('save')).toEqual([])
    expect(f.completed).toHaveBeenCalledTimes(2)
    expect(f.distribute).toHaveBeenCalledOnce()
    expect(f.status).toHaveBeenCalledOnce()
  })
  it('keeps an absent booking editable and requires another explicit save', async () => {
    const f = fixture()
    f.status.mockResolvedValue({
      receipt: null,
      treasure: initial,
      partyRevision: 7
    })
    await loseResponse(f)
    retry()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getAllByLabelText('Menge für Perle')[1]).toHaveValue(2)
    expect(f.distribute).toHaveBeenCalledOnce()
    f.distribute.mockResolvedValue(receipt)
    fireEvent.click(
      screen.getByRole('button', { name: 'Verteilung abschließen' })
    )
    await waitFor(() => expect(f.completed).toHaveBeenCalledOnce())
    expect(f.distribute).toHaveBeenCalledTimes(2)
    const old = f.distribute.mock.calls[0]?.[0] as { commandId: string }
    expect(f.distribute.mock.calls[1]?.[0]).not.toMatchObject({
      commandId: old.commandId
    })
  })
  it.each(['treasure', 'party'] as const)(
    'blocks an absent booking when the %s revision changed and permits discard',
    async (kind) => {
      const f = fixture()
      f.status.mockResolvedValue({
        receipt: null,
        treasure: kind === 'treasure' ? later : initial,
        partyRevision: kind === 'party' ? 8 : 7
      })
      await loseResponse(f)
      begin()
      expect(await resolve('save')).toHaveLength(1)
      expect(await resolve('discard')).toEqual([])
      expect(f.distribute).toHaveBeenCalledOnce()
      expect(f.close).toHaveBeenCalledOnce()
    }
  )
  it('cannot read recovery against another campaign', async () => {
    const f = fixture()
    await loseResponse(f)
    f.changeCampaign('other')
    retry()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherte Verteilung prüfen' })
      ).toBeEnabled()
    )
    expect(f.status).not.toHaveBeenCalled()
    f.changeCampaign('original')
    retry()
    await waitFor(() => expect(f.completed).toHaveBeenCalledOnce())
    expect(f.status.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'original'
    })
  })
  it('settles a dependent distribution before the parent and blocks the parent when the child fails', async () => {
    let parentDirty = true
    const parentSave = vi.fn(() => {
      parentDirty = false
      return Promise.resolve(true)
    })
    unregister = maintenanceDraftCoordinator.register('planner-parent', {
      label: 'Sitzungsplanung',
      dependsOn: ['distribution-test'],
      isDirty: () => parentDirty,
      save: parentSave
    })
    const f = fixture()
    f.completed.mockRejectedValueOnce(new Error('refresh failed'))
    draft()
    begin()
    expect(await resolve('save')).toHaveLength(2)
    expect(parentSave).not.toHaveBeenCalled()
    f.completed.mockImplementation(() => {
      expect(maintenanceDraftCoordinator.isLocked()).toBe(true)
      return Promise.resolve()
    })
    expect(await resolve('save')).toEqual([])
    expect(parentSave).toHaveBeenCalledOnce()
    expect(f.distribute).toHaveBeenCalledOnce()
  })
})

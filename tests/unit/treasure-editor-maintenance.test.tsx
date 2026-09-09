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
import { TreasureEditorDialog } from '../../src/renderer/features/loot/treasure-editor-dialog.js'
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
  type Treasure
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
      quantity: 1,
      allocatedQuantity: 0,
      containerId: null,
      position: 0
    }
  ],
  totalValueCp: 100,
  allocatedValueCp: 0,
  distributionState: 'open',
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z'
}
const stored: Treasure = { ...initial, revision: 2, label: 'Bearbeitet' }
const later: Treasure = { ...stored, revision: 3, label: 'Später geändert' }
const snapshot = {
  scene: {
    focusedSceneId: 'scene',
    scenes: [{ id: 'scene', locationId: null, groups: [] }]
  }
} as unknown as LiveSessionSnapshot
let resolution: MaintenanceDraftResolution | undefined
const unregister: (() => void)[] = []
afterEach(() => {
  resolution?.release()
  resolution = undefined
  unregister.splice(0).forEach((close) => close())
  cleanup()
})
function fixture() {
  let root = {
    sessionCampaignId: 'original',
    campaigns: { activeCampaignId: 'original' }
  }
  const update = vi.fn().mockResolvedValue(stored)
  const create = vi.fn().mockResolvedValue(stored)
  const status = vi.fn().mockResolvedValue({ receipt: stored, treasure: later })
  const saved = vi.fn<() => Promise<void>>().mockResolvedValue()
  const close = vi.fn()
  const context = {
    api: {
      loot: {
        createForCampaign: create,
        updateForCampaign: update,
        editorStatus: status,
        catalog: vi.fn().mockResolvedValue({
          entries: [],
          total: 0,
          filterOptions: { types: [], categories: [], rarities: [] }
        })
      }
    },
    campaignWorkspace: { snapshot: () => root, subscribe: () => () => {} }
  } as unknown as CapabilityContextValue
  render(
    <CapabilityContext.Provider value={context}>
      <ModalLayerProvider>
        <TreasureEditorDialog
          snapshot={snapshot}
          treasure={initial}
          initialAnchor={{ kind: 'unplaced' }}
          maintenanceId="treasure-test"
          saved={saved}
          close={close}
          onError={vi.fn()}
        />
      </ModalLayerProvider>
    </CapabilityContext.Provider>
  )
  return {
    update,
    create,
    status,
    saved,
    close,
    changeCampaign: (id: string) => {
      root = { sessionCampaignId: id, campaigns: { activeCampaignId: id } }
    }
  }
}
function draft(label = 'Bearbeitet') {
  fireEvent.change(screen.getByLabelText('Bezeichnung'), {
    target: { value: label }
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
  f.update.mockRejectedValue(new Error('lost response'))
  draft()
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Gespeicherten Schatz prüfen' })
    ).toBeEnabled()
  )
}
function retry() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Gespeicherten Schatz prüfen' })
  )
}

describe('treasure editor maintenance', () => {
  it.each(['save', 'discard'] as const)(
    'resolves the draft with %s and synchronously blocks new edits',
    async (choice) => {
      const f = fixture()
      draft()
      begin()
      expect(
        screen.getByLabelText('Bezeichnung').closest('[inert]')
      ).not.toBeNull()
      draft('Forbidden')
      expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Bearbeitet')
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled()
      expect(await resolve(choice)).toEqual([])
      expect(f.update).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
      if (choice === 'save')
        expect(f.update.mock.calls[0]?.[0]).toMatchObject({
          campaignId: 'original',
          treasureId: initial.id,
          expectedRevision: 1,
          label: 'Bearbeitet',
          items: [{ id: initial.items[0]!.id, quantity: 1, containerId: null }]
        })
      expect(f.saved).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
      expect(f.close).toHaveBeenCalledTimes(choice === 'discard' ? 1 : 0)
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    }
  )
  it('closes an untouched editor without writing', async () => {
    const f = fixture()
    begin()
    expect(await resolve('save')).toEqual([])
    expect(f.close).toHaveBeenCalledOnce()
    expect(f.update).not.toHaveBeenCalled()
  })
  it('keeps invalid input when central save fails and maintenance is canceled', async () => {
    const f = fixture()
    draft('')
    begin()
    expect(await resolve('save')).toMatchObject([
      { label: 'Schatz: Neuer Schatz' }
    ])
    expect(f.update).not.toHaveBeenCalled()
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    expect(screen.getByLabelText('Bezeichnung').closest('[inert]')).toBeNull()
    draft('Korrigiert')
    expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Korrigiert')
  })
  it('waits for both an existing write and its parent refresh before central discard completes', async () => {
    const f = fixture()
    let finishWrite!: (treasure: Treasure) => void
    let finishRefresh!: () => void
    f.update.mockReturnValue(
      new Promise((done) => {
        finishWrite = done
      })
    )
    f.saved.mockReturnValue(
      new Promise<void>((done) => {
        finishRefresh = done
      })
    )
    draft()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(f.update).toHaveBeenCalledOnce())
    begin()
    let result!: Promise<readonly unknown[]>
    const finished = vi.fn()
    act(() => {
      result = resolution!.resolve('discard')
      void result.then(finished)
    })
    await act(async () => {
      finishWrite(stored)
      await Promise.resolve()
    })
    expect(f.saved).toHaveBeenCalledOnce()
    expect(finished).not.toHaveBeenCalled()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    await act(async () => {
      finishRefresh()
      await result
    })
    expect(await result).toEqual([])
    expect(f.update).toHaveBeenCalledOnce()
    expect(f.close).not.toHaveBeenCalled()
  })
  it('retries failed reads using the original command and never repeats the write', async () => {
    const f = fixture()
    f.status.mockRejectedValueOnce(new Error('read unavailable'))
    await loseResponse(f)
    retry()
    await waitFor(() => expect(f.status).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherten Schatz prüfen' })
      ).toBeEnabled()
    )
    expect(f.saved).not.toHaveBeenCalled()
    retry()
    await waitFor(() =>
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    )
    const original = f.update.mock.calls[0]?.[0] as Record<string, unknown>
    const { campaignId, ...input } = original
    expect(f.status.mock.calls.map(([value]): unknown => value)).toEqual([
      { campaignId, command: { kind: 'update', input } },
      { campaignId, command: { kind: 'update', input } }
    ])
    expect(f.update).toHaveBeenCalledOnce()
    expect(f.saved).toHaveBeenCalledOnce()
  })
  it('recovers a parent refresh failure after a confirmed write without writing again', async () => {
    const f = fixture()
    f.saved.mockRejectedValueOnce(new Error('refresh failed'))
    draft()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherten Schatz prüfen' })
      ).toBeEnabled()
    )
    begin()
    expect(await resolve('save')).toEqual([])
    expect(f.update).toHaveBeenCalledOnce()
    expect(f.status).toHaveBeenCalledOnce()
    expect(f.saved).toHaveBeenCalledTimes(2)
  })
  it('keeps an absent write editable until another explicit save', async () => {
    const f = fixture()
    f.status.mockResolvedValue({ receipt: null, treasure: initial })
    await loseResponse(f)
    retry()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Gespeicherten Schatz prüfen' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Bearbeitet')
    expect(f.update).toHaveBeenCalledOnce()
    f.update.mockResolvedValue(stored)
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(f.saved).toHaveBeenCalledOnce())
    expect(f.update).toHaveBeenCalledTimes(2)
    expect(f.update.mock.calls[1]?.[0]).not.toMatchObject({
      commandId: (f.update.mock.calls[0]?.[0] as { commandId: string })
        .commandId
    })
  })
  it('rejects an absent write against a newer revision and allows explicit discard', async () => {
    const f = fixture()
    f.status.mockResolvedValue({ receipt: null, treasure: later })
    await loseResponse(f)
    begin()
    expect(await resolve('save')).toHaveLength(1)
    expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Bearbeitet')
    expect(await resolve('discard')).toEqual([])
    expect(f.update).toHaveBeenCalledOnce()
    expect(f.close).toHaveBeenCalledOnce()
  })
  it('keeps the original campaign binding throughout recovery', async () => {
    const f = fixture()
    await loseResponse(f)
    f.changeCampaign('other')
    retry()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gespeicherten Schatz prüfen' })
      ).toBeEnabled()
    )
    expect(f.status).not.toHaveBeenCalled()
    f.changeCampaign('original')
    retry()
    await waitFor(() => expect(f.saved).toHaveBeenCalledOnce())
    expect(f.status.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'original'
    })
  })
  it('settles a child before its earlier registered parent and waits for its refresh while locked', async () => {
    let parentDirty = true
    let refreshed = false
    const parentSave = vi.fn(() => {
      expect(refreshed).toBe(true)
      parentDirty = false
      return Promise.resolve(true)
    })
    unregister.push(
      maintenanceDraftCoordinator.register('parent', {
        label: 'Sitzungsplanung',
        dependsOn: ['treasure-test'],
        isDirty: () => parentDirty,
        save: parentSave
      })
    )
    const f = fixture()
    f.saved.mockImplementation(() => {
      expect(maintenanceDraftCoordinator.isLocked()).toBe(true)
      refreshed = true
      return Promise.resolve()
    })
    draft()
    begin()
    expect(await resolve('save')).toEqual([])
    expect(parentSave).toHaveBeenCalledOnce()
    expect(f.update).toHaveBeenCalledOnce()
  })
})

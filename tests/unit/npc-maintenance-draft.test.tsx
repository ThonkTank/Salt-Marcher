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
import { NpcCatalogEditor } from '../../src/renderer/features/catalog/npc-catalog-editor.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { WorldNpcDraft } from '../../src/shared/contracts/world-npc.js'
let resolution: MaintenanceDraftResolution | undefined
const npc = {
  id: '01900000-0000-7000-8000-000000000001',
  displayName: 'Erika',
  creatureId: 'sprite',
  lifecycle: 'active' as const,
  appearance: '',
  behavior: '',
  history: '',
  notes: '',
  dispositionModifier: 0,
  factionId: null,
  locationId: null,
  position: 0
}
function view(
  save: (draft: WorldNpcDraft) => Promise<boolean>,
  close = vi.fn()
) {
  render(
    <ModalLayerProvider>
      <NpcCatalogEditor
        npc={npc}
        conflict={null}
        factions={[]}
        locations={[]}
        creatureOptions={[{ id: 'sprite', label: 'Sprite' }]}
        searchCreatures={() => Promise.resolve([])}
        save={save}
        close={close}
      />
    </ModalLayerProvider>
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Neue Erika' }
  })
  return close
}
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
describe('NPC maintenance owner', () => {
  it('blocks inputs and saves the original draft through its owner', async () => {
    const save = vi
      .fn<(draft: WorldNpcDraft) => Promise<boolean>>()
      .mockResolvedValue(true)
    view(save)
    begin()
    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Forbidden edit' } })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledWith({
      ...npcDraft(),
      displayName: 'Neue Erika'
    })
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it.each(['rejected', 'unconfirmed'])(
    'retains the draft after %s save',
    async (kind) => {
      const save =
        kind === 'rejected'
          ? () => Promise.reject(new Error('validation failed'))
          : () => Promise.resolve(false)
      view(save)
      begin()
      await act(async () => {
        const failures = await resolution!.resolve('save')
        expect(failures).toHaveLength(1)
        expect(failures[0]?.label).toBe('NSC: Neue Erika')
      })
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    }
  )
  it('discards explicitly without saving', async () => {
    const save = vi.fn(() => Promise.resolve(true))
    const close = view(save)
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(save).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('waits for a normal save already running instead of sending another mutation', async () => {
    let finish!: (saved: boolean) => void
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        })
    )
    view(save)
    fireEvent.submit(
      screen.getByRole('button', { name: 'Speichern' }).closest('form')!
    )
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      const pending = resolution!.resolve('save')
      finish(true)
      expect(await pending).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
  })
})
function npcDraft(): WorldNpcDraft {
  return {
    displayName: npc.displayName,
    creatureId: npc.creatureId,
    lifecycle: npc.lifecycle,
    appearance: '',
    behavior: '',
    history: '',
    notes: '',
    dispositionModifier: 0,
    factionId: null,
    locationId: null
  }
}

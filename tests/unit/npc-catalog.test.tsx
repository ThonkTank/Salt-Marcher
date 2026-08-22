// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogCapabilities } from '../../src/renderer/features/catalog/catalog-capabilities.js'
import { useNpcCatalogController } from '../../src/renderer/features/catalog/npc-catalog-controller.js'
import NpcCatalogSection from '../../src/renderer/features/catalog/npc-catalog-section.js'
import {
  initialNpcCatalogState,
  reduceNpcCatalogState
} from '../../src/renderer/features/catalog/npc-catalog-state.js'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { WorldNpc } from '../../src/shared/contracts/world-npc.js'

const factionId = '01900000-0000-7000-8000-000000000101'
const locationId = '01900000-0000-7000-8000-000000000102'
const erikaId = '01900000-0000-7000-8000-000000000103'
const banditId = '01900000-0000-7000-8000-000000000104'

const erika: WorldNpc = {
  id: erikaId,
  displayName: 'Erika',
  creatureId: 'sprite',
  lifecycle: 'active',
  appearance: 'Silberne Flügel.',
  behavior: 'Neugierig.',
  history: 'Tochter von Rosenschein.',
  notes: 'Gerettet.',
  dispositionModifier: 3,
  factionId,
  locationId,
  position: 0
}
const bandit: WorldNpc = {
  ...erika,
  id: banditId,
  displayName: 'Überlebender Bandit',
  creatureId: 'bandit',
  lifecycle: 'defeated',
  factionId: null,
  locationId: null,
  position: 1
}
const factions = {
  revision: 5,
  factions: [
    {
      id: factionId,
      displayName: 'Rosenhof',
      notes: '',
      disposition: 15,
      primaryEncounterTableId: null,
      position: 0,
      inventory: []
    }
  ]
}
const locations = {
  revision: 2,
  locations: [
    {
      id: locationId,
      displayName: 'Flussuferhöhle',
      tags: ['Höhle'],
      readAloud: '',
      notes: '',
      factionIds: [factionId],
      encounterTableIds: [],
      position: 0,
      mapPresentation: {
        revision: 0,
        titleOverride: null,
        symbolId: 'location',
        symbolSize: 44,
        labelCurve: 0,
        labelPosition: 'below'
      }
    }
  ]
}

function setup(
  active = true,
  searchOverride?: (input: {
    query: string
    lifecycle: WorldNpc['lifecycle'] | null
    factionId?: string | null
    locationId?: string | null
    offset: number
    limit: number
  }) => Promise<unknown>
) {
  const all = [erika, bandit]
  const create = vi.fn(
    (input: {
      expectedRevision: number
      expectedFactionRevision: number
      npc: Omit<WorldNpc, 'id' | 'position'>
    }) => {
      const saved = {
        ...input.npc,
        id: '01900000-0000-7000-8000-000000000105',
        position: 2
      }
      all.push(saved)
      return Promise.resolve({
        revision: 4,
        factionRevision: 6,
        saved
      })
    }
  )
  const defaultSearch = (input: {
    query: string
    lifecycle: WorldNpc['lifecycle'] | null
    factionId?: string | null
    locationId?: string | null
    offset: number
    limit: number
  }) => {
    const rows = all.filter(
      (npc) =>
        (input.lifecycle === null || npc.lifecycle === input.lifecycle) &&
        (input.factionId === undefined || npc.factionId === input.factionId) &&
        (input.locationId === undefined ||
          npc.locationId === input.locationId) &&
        npc.displayName
          .toLocaleLowerCase()
          .includes(input.query.toLocaleLowerCase())
    )
    return Promise.resolve({
      revision: all.length > 2 ? 4 : 3,
      rows: rows.map((npc) => ({
        id: npc.id,
        displayName: npc.displayName,
        creatureId: npc.creatureId,
        creatureDisplayName: npc.creatureId === 'sprite' ? 'Sprite' : 'Bandit',
        lifecycle: npc.lifecycle,
        dispositionModifier: npc.dispositionModifier,
        factionId: npc.factionId,
        factionDisplayName: npc.factionId ? 'Rosenhof' : null,
        locationId: npc.locationId,
        locationDisplayName: npc.locationId ? 'Flussuferhöhle' : null,
        position: npc.position
      })),
      total: rows.length,
      offset: input.offset,
      limit: input.limit
    })
  }
  const search = vi.fn(searchOverride ?? defaultSearch)
  const api = {
    npcs: {
      search,
      detail: vi.fn(({ id }: { id: string }) => {
        const npc = all.find((candidate) => candidate.id === id)!
        return Promise.resolve({
          revision: all.length > 2 ? 4 : 3,
          npc,
          creatureDisplayName:
            npc.creatureId === 'sprite' ? 'Sprite' : 'Bandit',
          factionDisplayName: npc.factionId ? 'Rosenhof' : null,
          locationDisplayName: npc.locationId ? 'Flussuferhöhle' : null
        })
      }),
      create,
      update: vi.fn(),
      delete: vi.fn(),
      commandReceipt: vi.fn(),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    factions: {
      read: vi.fn().mockResolvedValue(factions),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    locations: {
      read: vi.fn().mockResolvedValue(locations),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    }
  } as unknown as CatalogCapabilities
  const creatures = {
    search: vi.fn().mockResolvedValue({
      status: 'ready',
      rows: [
        {
          id: 'sprite',
          name: 'Sprite',
          type: 'Fey',
          subtype: '',
          challengeRating: '1/4'
        }
      ],
      total: 1,
      offset: 0,
      limit: 40,
      message: ''
    })
  } as unknown as CreatureCapabilityPort
  const onError = vi.fn()
  function Harness(props: { active: boolean }) {
    const controller = useNpcCatalogController(
      props.active,
      onError,
      api,
      creatures
    )
    return <NpcCatalogSection controller={controller} />
  }
  const view = render(
    <ModalLayerProvider>
      <Harness active={active} />
    </ModalLayerProvider>
  )
  return {
    api,
    creatures,
    create,
    onError,
    rerenderActive: (next: boolean) =>
      view.rerender(
        <ModalLayerProvider>
          <Harness active={next} />
        </ModalLayerProvider>
      )
  }
}

afterEach(cleanup)

describe('NPC catalog UI', () => {
  it('does not read catalog aggregates while its lazy section is inactive', () => {
    const { api } = setup(false)
    expect(api.npcs.search).not.toHaveBeenCalled()
    expect(api.factions.read).not.toHaveBeenCalled()
    expect(api.locations.read).not.toHaveBeenCalled()
  })

  it('suppresses a late NPC failure after the section becomes inactive', async () => {
    const pending = deferred<unknown>()
    const { api, onError, rerenderActive } = setup(true, () => pending.promise)
    await waitFor(() => expect(api.npcs.search).toHaveBeenCalledOnce())
    rerenderActive(false)
    pending.reject(new Error('obsolete NPC failure'))
    await Promise.resolve()
    await Promise.resolve()
    expect(onError).not.toHaveBeenCalled()
  })

  it('publishes only the latest NPC page when searches complete out of order', async () => {
    const older = deferred<unknown>()
    const newer = deferred<unknown>()
    const search = vi
      .fn()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    setup(true, search)
    await waitFor(() => expect(search).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('NPCs suchen'), {
      target: { value: 'Erika' }
    })
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
    newer.resolve(pageFor(erika))
    expect(await screen.findByRole('button', { name: 'Erika' })).toBeVisible()
    older.resolve(pageFor(bandit))
    await older.promise
    expect(screen.getByRole('button', { name: 'Erika' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Überlebender Bandit' })
    ).toBeNull()
  })

  it('debounces text search and combines status, faction and location filters', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'Erika' })).toBeVisible()
    fireEvent.change(screen.getByLabelText('NPC-Status filtern'), {
      target: { value: 'defeated' }
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Erika' })).toBeNull()
    )
    expect(
      await screen.findByRole('button', { name: 'Überlebender Bandit' })
    ).toBeVisible()

    fireEvent.change(screen.getByLabelText('NPC-Status filtern'), {
      target: { value: 'all' }
    })
    fireEvent.change(screen.getByLabelText('NPC-Fraktion filtern'), {
      target: { value: factionId }
    })
    expect(await screen.findByRole('button', { name: 'Erika' })).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Überlebender Bandit' })
      ).toBeNull()
    )
    fireEvent.change(screen.getByLabelText('NPC-Ort filtern'), {
      target: { value: locationId }
    })
    fireEvent.change(screen.getByLabelText('NPCs suchen'), {
      target: { value: 'Bandit' }
    })
    expect(screen.getByRole('button', { name: 'Erika' })).toBeVisible()
    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Erika' })).toBeNull(),
      { timeout: 1_000 }
    )
  })

  it('opens the inspector and edits only through its explicit action', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Erika' }))
    const inspector = screen.getByRole('complementary', {
      name: 'NPC-Inspector'
    })
    expect(await within(inspector).findByText('Silberne Flügel.')).toBeVisible()
    expect(within(inspector).getByText('Rosenhof')).toBeVisible()
    fireEvent.click(
      within(inspector).getByRole('button', { name: 'Bearbeiten' })
    )
    expect(screen.getByRole('dialog', { name: 'NPC bearbeiten' })).toBeVisible()
  })

  it('uses catalog statblocks, guards dirty discard and sends both revisions', async () => {
    const { create, creatures } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Erstellen' }))
    const dialog = screen.getByRole('dialog', { name: 'NPC erstellen' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Neue Fee' }
    })
    const statblock = within(dialog).getByRole('combobox', {
      name: 'Statblock'
    })
    fireEvent.focus(statblock)
    fireEvent.change(statblock, { target: { value: 'spr' } })
    fireEvent.click(await screen.findByRole('option', { name: /Sprite/ }))
    expect(creatures.search).toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('Status'), {
      target: { value: 'defeated' }
    })
    fireEvent.change(within(dialog).getByLabelText('Fraktion'), {
      target: { value: factionId }
    })
    fireEvent.change(within(dialog).getByLabelText('Ort'), {
      target: { value: locationId }
    })
    fireEvent.change(within(dialog).getByLabelText('Aussehen'), {
      target: { value: 'Leuchtend.' }
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    const discard = screen.getByRole('alertdialog', {
      name: 'Ungespeicherte Änderungen verwerfen?'
    })
    fireEvent.click(within(discard).getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('dialog', { name: 'NPC erstellen' })).toBeVisible()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0]![0]).toMatchObject({
      expectedRevision: 3,
      expectedFactionRevision: 5,
      npc: {
        displayName: 'Neue Fee',
        creatureId: 'sprite',
        lifecycle: 'defeated',
        factionId,
        locationId,
        appearance: 'Leuchtend.'
      }
    })
  })
})

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function pageFor(npc: WorldNpc) {
  return {
    revision: 3,
    rows: [
      {
        id: npc.id,
        displayName: npc.displayName,
        creatureId: npc.creatureId,
        creatureDisplayName: npc.creatureId === 'sprite' ? 'Sprite' : 'Bandit',
        lifecycle: npc.lifecycle,
        dispositionModifier: npc.dispositionModifier,
        factionId: npc.factionId,
        factionDisplayName: npc.factionId ? 'Rosenhof' : null,
        locationId: npc.locationId,
        locationDisplayName: npc.locationId ? 'Flussuferhöhle' : null,
        position: npc.position
      }
    ],
    total: 1,
    offset: 0,
    limit: 50
  }
}

describe('NPC catalog lifecycle reducer', () => {
  it('covers loading, ready, editing, saving and conflict', () => {
    const loading = reduceNpcCatalogState(initialNpcCatalogState, {
      type: 'load-started'
    })
    const ready = reduceNpcCatalogState(loading, {
      type: 'load-completed'
    })
    expect(ready).toEqual({ status: 'ready' })
    const editing = reduceNpcCatalogState(ready, {
      type: 'edit-started',
      npc: erika
    })
    const saving = reduceNpcCatalogState(editing, {
      type: 'save-started'
    })
    expect(saving).toMatchObject({ status: 'saving', npc: erika })
    expect(
      reduceNpcCatalogState(saving, {
        type: 'save-conflicted',
        message: 'Revision geändert'
      })
    ).toEqual({
      status: 'conflict',
      npc: erika,
      message: 'Revision geändert'
    })
  })

  it('covers confirming and deletion', () => {
    const requested = reduceNpcCatalogState(
      { status: 'ready' },
      { type: 'delete-requested', npcId: erikaId }
    )
    const deleting = reduceNpcCatalogState(requested, {
      type: 'delete-started',
      npcId: erikaId
    })
    expect(deleting).toEqual({
      status: 'deleting',
      npcId: erikaId,
      phase: 'saving'
    })
    expect(
      reduceNpcCatalogState(deleting, {
        type: 'delete-completed'
      })
    ).toEqual({ status: 'ready' })
  })
})

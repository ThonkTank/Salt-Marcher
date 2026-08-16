// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { RewardDistributionDialog } from '../../src/renderer/features/loot/reward-distribution-dialog.js'
import { SessionGroupsPanel } from '../../src/renderer/features/session/session-groups-panel.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { Treasure } from '../../src/shared/contracts/loot.js'
import type { SceneSnapshot } from '../../src/shared/contracts/scene.js'

afterEach(cleanup)

const sceneId = '01900000-0000-7000-8000-000000000001'
const groupId = '01900000-0000-7000-8000-000000000002'
const locationId = '01900000-0000-7000-8000-000000000003'
const characterId = '01900000-0000-7000-8000-000000000004'

describe('Loot UI', () => {
  it('shows group and location treasure through the shared expandable card', () => {
    const groupTreasure = treasure(
      '01900000-0000-7000-8000-000000000010',
      'Gruppenfund',
      'Gruppenring'
    )
    const locationTreasure = treasure(
      '01900000-0000-7000-8000-000000000011',
      'Ortsfund',
      'Ortsperle'
    )
    const focused = {
      id: sceneId,
      title: 'Testszene',
      locationId,
      locationName: 'Alter Kai',
      partyMemberIds: [],
      groups: [
        {
          id: groupId,
          revision: 0,
          name: 'Schmuggler',
          note: '',
          disposition: 'hostile',
          archived: false,
          entries: [],
          baseXp: 0
        }
      ]
    } as unknown as SceneSnapshot['scenes'][number]
    const snapshot = {
      party: { revision: 0, members: [] },
      scene: { revision: 0, focusedSceneId: sceneId, scenes: [focused] }
    } as unknown as LiveSessionSnapshot
    const loot = {
      revision: 2,
      sceneId,
      locationId,
      locationTreasures: [locationTreasure],
      groupTreasures: [{ groupId, treasures: [groupTreasure] }]
    }

    render(
      <CapabilityProvider api={{} as SaltMarcherApi}>
        <SessionGroupsPanel
          snapshot={snapshot}
          loot={loot}
          lootInbox={{ revision: 2, entries: [], nextCursor: null }}
          lootInboxOpen={false}
          openLootInbox={vi.fn()}
          loadMoreLoot={vi.fn()}
          focused={focused}
          setSnapshot={vi.fn()}
          onError={vi.fn()}
          inspect={vi.fn()}
          edit={vi.fn()}
          distribute={vi.fn()}
          createLoot={vi.fn()}
          editLoot={vi.fn()}
        />
      </CapabilityProvider>
    )

    expect(screen.getByText('Beute am Ort')).toBeTruthy()
    expect(screen.getByText('Ortsfund')).toBeTruthy()
    expect(screen.getByText(/Ortsperle/)).toBeTruthy()
    expect(screen.queryByText('Gruppenfund')).toBeNull()
    expect(document.querySelectorAll('.group-expanded')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Party aufklappen' }))
    expect(document.querySelectorAll('.group-expanded')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Beute (1)' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Schmuggler aufklappen' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Beute (1)' }))
    expect(screen.getByText('Gruppenfund')).toBeTruthy()
    expect(screen.getByText(/Gruppenring/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Gruppenfund/ })[0]!)
    expect(screen.queryByText(/Gruppenring/)).toBeNull()
    expect(screen.getByText(/Ortsperle/)).toBeTruthy()
  })

  it('opens an individual character ledger from the compact party chip', async () => {
    const focused = {
      id: sceneId,
      title: 'Testszene',
      locationId: null,
      locationName: '',
      partyMemberIds: [characterId],
      groups: []
    } as unknown as SceneSnapshot['scenes'][number]
    const snapshot = {
      party: {
        revision: 0,
        members: [{ id: characterId, name: 'Alrik', level: 5, active: true }]
      },
      scene: { revision: 0, focusedSceneId: sceneId, scenes: [focused] }
    } as unknown as LiveSessionSnapshot
    const api = {
      loot: {
        ledger: vi.fn().mockResolvedValue({
          characterId,
          revision: 0,
          entries: []
        })
      }
    } as unknown as SaltMarcherApi

    render(
      <CapabilityProvider api={api}>
        <ModalLayerProvider>
          <SessionGroupsPanel
            snapshot={snapshot}
            loot={{
              revision: 0,
              sceneId,
              locationId: null,
              locationTreasures: [],
              groupTreasures: []
            }}
            lootInbox={{ revision: 0, entries: [], nextCursor: null }}
            lootInboxOpen
            openLootInbox={vi.fn()}
            loadMoreLoot={vi.fn()}
            focused={focused}
            setSnapshot={vi.fn()}
            onError={vi.fn()}
            inspect={vi.fn()}
            edit={vi.fn()}
            distribute={vi.fn()}
            createLoot={vi.fn()}
            editLoot={vi.fn()}
          />
        </ModalLayerProvider>
      </CapabilityProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Beute: Alrik' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Alrik')
    expect(await screen.findByText('Noch keine Beute erhalten.')).toBeVisible()
  })

  it('traps initial focus and Escape discards a local distribution draft', async () => {
    const distribute = vi.fn()
    const close = vi.fn()
    const dialogTreasure = treasure(
      '01900000-0000-7000-8000-000000000012',
      'Verteilfund',
      'Silber'
    )
    const snapshot = {
      party: {
        revision: 4,
        members: [{ id: characterId, name: 'Alrik', active: true }]
      }
    } as unknown as LiveSessionSnapshot
    const api = {
      loot: { distribute },
      session: { read: vi.fn() }
    } as unknown as SaltMarcherApi

    const view = render(
      <CapabilityProvider api={api}>
        <ModalLayerProvider>
          <RewardDistributionDialog
            treasure={dialogTreasure}
            snapshot={snapshot}
            close={close}
            completed={vi.fn()}
            onError={vi.fn()}
          />
        </ModalLayerProvider>
      </CapabilityProvider>
    )
    const closeButton = await screen.findByRole('button', {
      name: 'Dialog schließen'
    })
    await waitFor(() => expect(document.activeElement).toBe(closeButton))
    fireEvent.change(screen.getByLabelText('Empfänger für Silber'), {
      target: { value: characterId }
    })
    expect(screen.getByLabelText('Empfänger für Silber')).toHaveValue(
      characterId
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(distribute).not.toHaveBeenCalled()
    view.unmount()

    render(
      <CapabilityProvider api={api}>
        <ModalLayerProvider>
          <RewardDistributionDialog
            treasure={dialogTreasure}
            snapshot={snapshot}
            close={vi.fn()}
            completed={vi.fn()}
            onError={vi.fn()}
          />
        </ModalLayerProvider>
      </CapabilityProvider>
    )
    expect(await screen.findByLabelText('Empfänger für Silber')).toHaveValue('')
  })
})

function treasure(id: string, label: string, itemName: string): Treasure {
  return {
    id,
    revision: 0,
    label,
    anchor: { kind: 'unplaced' },
    source: { kind: 'manual' },
    items: [
      {
        id: id.replace(/.$/, '9'),
        provenance: { kind: 'manual' },
        name: itemName,
        quantity: 2,
        allocatedQuantity: 0,
        unitValueCp: 10,
        stackable: true,
        magic: false,
        rarity: null,
        curseName: null,
        containerId: null,
        position: 0
      }
    ],
    containers: [],
    totalValueCp: 20,
    allocatedValueCp: 0,
    distributionState: 'open',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z'
  }
}

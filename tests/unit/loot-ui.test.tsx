// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { RewardDistributionDialog } from '../../src/renderer/features/loot/reward-distribution-dialog.js'
import { SessionGroupsPanel } from '../../src/renderer/features/session/session-groups-panel.js'
import type {
  SessionExpansionTarget,
  SessionGroupsViewModel,
  SessionWorkspaceActions
} from '../../src/renderer/features/session/session-workspace-model.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type {
  LootSceneProjection,
  Treasure
} from '../../src/shared/contracts/loot.js'
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
        <GroupsPanelHarness snapshot={snapshot} loot={loot} focused={focused} />
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

  it('routes an individual character ledger request from the compact party chip', () => {
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
    const openLedger = vi.fn()

    render(
      <GroupsPanelHarness
        snapshot={snapshot}
        loot={{
          revision: 0,
          sceneId,
          locationId: null,
          locationTreasures: [],
          groupTreasures: []
        }}
        focused={focused}
        initialExpansion={{ kind: 'party' }}
        openLedger={openLedger}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Beute: Alrik' }))
    expect(openLedger).toHaveBeenCalledWith(snapshot.party.members[0])
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

function GroupsPanelHarness(props: {
  snapshot: LiveSessionSnapshot
  focused: SceneSnapshot['scenes'][number]
  loot: LootSceneProjection
  initialExpansion?: SessionExpansionTarget
  openLedger?: SessionWorkspaceActions['openLedger']
}) {
  const [expansion, setExpansion] = useState<SessionExpansionTarget>(
    props.initialExpansion ??
      (props.focused.groups[0]
        ? { kind: 'group', groupId: props.focused.groups[0].id }
        : { kind: 'party' })
  )
  const actions = {
    toggleRow: (target) =>
      setExpansion((current) => (sameTarget(current, target) ? null : target)),
    focusScene: vi.fn(),
    setSceneLocation: vi.fn(),
    editParty: vi.fn(),
    openLedger: props.openLedger ?? vi.fn(),
    inspectCreature: vi.fn(),
    editGroup: vi.fn(),
    manageGroups: vi.fn(),
    reinforce: vi.fn(),
    restoreGroup: vi.fn(),
    requestGroupDelete: vi.fn(),
    cancelGroupDelete: vi.fn(),
    confirmGroupDelete: vi.fn(),
    openLootInbox: vi.fn(),
    loadMoreLoot: vi.fn(),
    createLoot: vi.fn(),
    editLoot: vi.fn(),
    distribute: vi.fn(),
    closeDialog: vi.fn(),
    groupSaved: vi.fn(),
    lootChanged: vi.fn(),
    assignPartyMember: vi.fn()
  } satisfies SessionWorkspaceActions
  const groupLoot = new Map(
    props.loot.groupTreasures.map((entry) => [entry.groupId, entry.treasures])
  )
  const members = props.snapshot.party.members.filter(
    (member) =>
      member.active && props.focused.partyMemberIds.includes(member.id)
  )
  const model = {
    scene: props.focused,
    activeRows: [
      {
        kind: 'party',
        key: 'party',
        name: 'Party',
        count: members.length,
        expanded: expansion?.kind === 'party',
        members
      },
      ...props.focused.groups
        .filter((group) => !group.archived)
        .map((group) => ({
          kind: 'active-group' as const,
          key: group.id,
          sceneId: props.focused.id,
          group,
          count: group.entries.reduce((sum, entry) => sum + entry.quantity, 0),
          expanded:
            expansion?.kind === 'group' && expansion.groupId === group.id,
          treasures: groupLoot.get(group.id) ?? []
        }))
    ],
    archivedRows: [],
    locationLoot: props.loot.locationTreasures.map((treasure) => ({
      kind: 'loot' as const,
      placement: 'location' as const,
      treasure
    })),
    inboxLoot: [],
    inbox: { revision: props.loot.revision, entries: [], nextCursor: null },
    inboxOpen: false
  } satisfies SessionGroupsViewModel
  return <SessionGroupsPanel model={model} actions={actions} />
}

function sameTarget(
  left: SessionExpansionTarget,
  right: Exclude<SessionExpansionTarget, null>
) {
  return (
    left?.kind === right.kind &&
    (left.kind === 'party' ||
      (left.kind === 'group' &&
        right.kind === 'group' &&
        left.groupId === right.groupId))
  )
}

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
        itemReference: { kind: 'legacy', definitionId: `test:${id}` },
        definition: {
          reference: { kind: 'legacy', definitionId: `test:${id}` },
          name: itemName,
          unitValueCp: 10,
          unitCapacity: 1,
          stackable: true,
          magic: false,
          rarity: null,
          curse: null,
          components: {
            baseItemId: null,
            modifierId: null,
            componentId: null,
            magicItemId: null,
            magicVariantId: null,
            spellId: null,
            enspelledRuleId: null,
            curseId: null,
            coinDenominations: []
          }
        },
        quantity: 2,
        allocatedQuantity: 0,
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

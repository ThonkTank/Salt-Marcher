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
import { afterEach, expect, it, vi } from 'vitest'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { DesktopRosterActions } from '../../src/renderer/features/scene-desktop/desktop-roster-actions.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { CharacterCommandPort } from '../../src/renderer/features/party/use-character-command-port.js'
import { DesktopXpAction } from '../../src/renderer/features/scene-desktop/desktop-xp-action.js'
const xpPort = vi.hoisted(() => ({
  execute: vi.fn<CharacterCommandPort['execute']>(),
  status: vi.fn<CharacterCommandPort['status']>(),
  refresh: vi.fn<CharacterCommandPort['refresh']>()
}))
vi.mock(
  '../../src/renderer/features/party/use-character-command-port.js',
  () => ({ useCharacterCommandPort: () => xpPort })
)
import type { ScenePartyCommandPort } from '../../src/renderer/features/scene-desktop/use-scene-party-command-port.js'
const scenePort = vi.hoisted(() => ({
  current: vi.fn<ScenePartyCommandPort['current']>(),
  execute: vi.fn<ScenePartyCommandPort['execute']>(),
  status: vi.fn<ScenePartyCommandPort['status']>(),
  refresh: vi.fn<ScenePartyCommandPort['refresh']>()
}))
vi.mock(
  '../../src/renderer/features/scene-desktop/use-scene-party-command-port.js',
  () => ({ useScenePartyCommandPort: () => scenePort })
)
vi.mock('../../src/renderer/capabilities/use-capability-api.js', () => {
  const api = {
    party: {
      previewXp: async ({
        amount,
        expectedRevision
      }: {
        amount: number
        expectedRevision: number
      }) => ({
        revision: expectedRevision,
        amount,
        add: 2000 + amount,
        subtract: Math.max(0, 2000 - amount),
        set: amount
      })
    }
  }
  return { useCapabilityApi: () => api }
})
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
  vi.restoreAllMocks()
})
it('retains row identity, scroll and hidden selections and submits one batch', async () => {
  const ids = Array.from(
    { length: 18 },
    (_, index) => `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`
  )
  const snapshot = {
    revision: 2,
    party: {
      revision: 3,
      members: ids.map((id, index) => ({
        id,
        name: `Charakter ${index}`,
        playerName: `Spieler ${index}`,
        active: index === 0
      }))
    },
    scene: {
      revision: 2,
      focusedSceneId: 'source',
      scenes: [{ id: 'source', title: 'Hafen', partyMemberIds: [ids[0]] }]
    }
  } as unknown as LiveSessionSnapshot
  const setRoster = scenePort.execute
    .mockReset()
    .mockResolvedValue({ snapshot })
  scenePort.current.mockReset().mockReturnValue(snapshot)
  scenePort.refresh.mockReset().mockResolvedValue(snapshot)
  const api = {
    scene: { setRoster },
    session: {
      read: vi.fn().mockResolvedValue(snapshot),
      onChanged: () => () => undefined
    }
  } as unknown as SaltMarcherApi
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'publishSession'
  ).mockImplementation(() => true)
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'refreshActiveSession'
  ).mockResolvedValue({ status: 'inactive' } as never)
  render(
    <CapabilityProvider api={api}>
      <ModalLayerProvider>
        <DesktopRosterActions
          campaignId="campaign"
          sceneId="source"
          snapshot={snapshot}
        />
      </ModalLayerProvider>
    </CapabilityProvider>
  )
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  const boxes = await screen.findAllByRole('checkbox')
  const list = boxes[0]!.closest('.desktop-roster-list')!
  list.scrollTop = 85
  fireEvent.click(boxes[1]!)
  expect(screen.getAllByRole('checkbox')[1]).toBe(boxes[1])
  expect(list.scrollTop).toBe(85)
  fireEvent.change(screen.getByLabelText('Charakter oder Spieler'), {
    target: { value: 'Spieler 17' }
  })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByText('Übernehmen'))
  await waitFor(() => expect(setRoster).toHaveBeenCalledTimes(1))
  expect(setRoster.mock.lastCall?.[0].command).toEqual({
    kind: 'set-roster',
    input: {
      sceneId: 'source',
      memberIds: [ids[0], ids[1], ids[17]],
      expectedRevision: 2,
      expectedPartyRevision: 3
    }
  })
})

async function xpFixture() {
  const party = {
    revision: 4,
    members: []
  } as unknown as LiveSessionSnapshot['party']
  const receipt = { characterId: 'character', party }
  xpPort.execute.mockReset().mockResolvedValue(receipt)
  xpPort.status.mockReset().mockResolvedValue({ receipt, party })
  xpPort.refresh.mockReset().mockResolvedValue({ party } as LiveSessionSnapshot)
  const view = render(
    <ModalLayerProvider>
      <DesktopXpAction
        campaignId="campaign"
        member={
          {
            id: 'character',
            name: 'Edrik',
            xp: 2000,
            level: 3,
            currentLevelFloor: 900,
            nextLevelXp: 2700
          } as never
        }
        revision={3}
      />
    </ModalLayerProvider>
  )
  fireEvent.click(screen.getByText('XP'))
  fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '50' } })
  await waitFor(() => expect(screen.getByText('+')).toBeEnabled())
  return { ...view, receipt, party }
}
it('writes explicit XP actions with original receipts and keeps the confirmed amount reusable', async () => {
  await xpFixture()
  for (const [button, command] of [
    [
      '+',
      {
        kind: 'adjust-xp',
        input: { id: 'character', delta: 50, expectedRevision: 3 }
      }
    ],
    [
      '−',
      {
        kind: 'adjust-xp',
        input: { id: 'character', delta: -50, expectedRevision: 3 }
      }
    ],
    [
      'Übernehmen',
      {
        kind: 'set-xp',
        input: { id: 'character', amount: 50, expectedRevision: 3 }
      }
    ]
  ] as const) {
    fireEvent.click(screen.getByText(button))
    await waitFor(() =>
      expect(xpPort.execute.mock.lastCall?.[0].command).toEqual(command)
    )
    expect(xpPort.execute.mock.lastCall?.[0].commandId).toEqual(
      expect.any(String)
    )
    await waitFor(() => expect(screen.getByText(button)).toBeEnabled())
    expect(screen.getByLabelText('Betrag')).toHaveValue(50)
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  }
  expect(
    new Set(xpPort.execute.mock.calls.map(([input]) => input.commandId)).size
  ).toBe(3)
})
it('retains a never submitted XP amount, rejects ambiguous central save and permits discard', async () => {
  await xpFixture()
  fireEvent.click(screen.getByText('XP'))
  fireEvent.click(screen.getByText('XP'))
  expect(screen.getByLabelText('Betrag')).toHaveValue(50)
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  let failures: readonly { label: string; message: string }[] = []
  await act(async () => {
    failures = await resolution!.resolve('save')
  })
  expect(failures).toEqual([
    expect.objectContaining({
      label: 'XP: Edrik'
    })
  ])
  expect(failures[0]?.message).toContain(
    'Bitte zuerst +, − oder Überschreiben wählen'
  )
  expect(xpPort.execute).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Betrag')).toHaveValue(50)
  expect(screen.getByLabelText('Betrag')).toBeDisabled()
  await act(async () => {
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  expect(xpPort.execute).not.toHaveBeenCalled()
})
it('holds an unknown XP write and resolves the original command without replay', async () => {
  await xpFixture()
  xpPort.execute.mockRejectedValueOnce(new Error('lost response'))
  await waitFor(() => expect(screen.getByText('+')).toBeEnabled())
  fireEvent.click(screen.getByText('+'))
  await screen.findByText('Speicherstatus erneut prüfen')
  const original = xpPort.execute.mock.calls[0]![0]
  expect(screen.getByLabelText('Betrag')).toBeDisabled()
  fireEvent.click(screen.getByText('−'))
  expect(xpPort.execute).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByText('Speicherstatus erneut prüfen'))
  await waitFor(() => expect(screen.getByText('+')).toBeEnabled())
  expect(xpPort.status).toHaveBeenCalledWith(original)
  expect(xpPort.execute).toHaveBeenCalledOnce()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})

it('requires the same rest button twice and invalidates confirmation on selection and revision changes', async () => {
  const { DesktopRestAction } =
    await import('../../src/renderer/features/scene-desktop/desktop-rest-action.js')
  const restSelected = scenePort.execute.mockReset()
  const api = {
    party: { restSelected },
    session: { onChanged: () => () => undefined }
  } as unknown as SaltMarcherApi
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'publishSession'
  ).mockImplementation(() => true)
  const snapshot = {
    party: {
      revision: 2,
      members: [
        { id: 'a', name: 'Edrik' },
        { id: 'b', name: 'Vivian' }
      ]
    },
    scene: {
      revision: 3,
      scenes: [{ id: 'source', partyMemberIds: ['a', 'b'] }]
    }
  } as unknown as LiveSessionSnapshot
  restSelected.mockResolvedValue({ snapshot })
  scenePort.current.mockReset().mockReturnValue(snapshot)
  scenePort.refresh.mockReset().mockResolvedValue(snapshot)
  function view(value: LiveSessionSnapshot) {
    return (
      <CapabilityProvider api={api}>
        <ModalLayerProvider>
          <DesktopRestAction
            campaignId="campaign"
            sceneId="source"
            snapshot={value}
          />
        </ModalLayerProvider>
      </CapabilityProvider>
    )
  }
  const { rerender } = render(view(snapshot))
  fireEvent.click(screen.getByText('Rasten'))
  fireEvent.click(screen.getByText('Kurze Rast'))
  expect(restSelected).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Lange Rast'))
  expect(screen.queryByText('Kurze Rast bestätigen')).toBeNull()
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)
  expect(screen.queryByText('Lange Rast bestätigen')).toBeNull()
  fireEvent.click(screen.getByText('Kurze Rast'))
  rerender(view({ ...snapshot, party: { ...snapshot.party, revision: 3 } }))
  expect(screen.queryByText('Kurze Rast bestätigen')).toBeNull()
  fireEvent.click(screen.getByText('Kurze Rast'))
  expect(restSelected).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Kurze Rast bestätigen'))
  await waitFor(() =>
    expect(restSelected.mock.lastCall?.[0].command).toEqual({
      kind: 'rest-selected',
      input: {
        sceneId: 'source',
        memberIds: ['a'],
        type: 'short',
        expectedRevision: 3,
        expectedSceneRevision: 3
      }
    })
  )
})

function sceneFixture(withXp = false) {
  const snapshot = {
    party: {
      revision: 7,
      members: [
        { id: 'a', name: 'Edrik', active: true },
        { id: 'b', name: 'Vivian', active: true }
      ]
    },
    scene: {
      revision: 4,
      unassignedPartyMemberIds: [],
      scenes: [{ id: 'source', title: 'Hafen', partyMemberIds: ['a', 'b'] }]
    }
  } as unknown as LiveSessionSnapshot
  scenePort.execute.mockReset().mockResolvedValue({ snapshot })
  scenePort.status
    .mockReset()
    .mockResolvedValue({ receipt: { snapshot }, snapshot })
  scenePort.current.mockReset().mockReturnValue(snapshot)
  scenePort.refresh.mockReset().mockResolvedValue(snapshot)
  xpPort.execute
    .mockReset()
    .mockResolvedValue({ characterId: 'a', party: snapshot.party })
  xpPort.status.mockReset().mockResolvedValue({
    receipt: { characterId: 'a', party: snapshot.party },
    party: snapshot.party
  })
  xpPort.refresh.mockReset().mockResolvedValue(snapshot)
  render(
    <ModalLayerProvider>
      <DesktopRosterActions
        characterDraftIds={withXp ? ['xp-a'] : []}
        campaignId="campaign"
        sceneId="source"
        snapshot={snapshot}
      />
      {withXp && (
        <DesktopXpAction
          maintenanceId="xp-a"
          campaignId="campaign"
          member={
            {
              id: 'a',
              name: 'Edrik',
              xp: 2000,
              level: 3,
              currentLevelFloor: 900,
              nextLevelXp: 2700
            } as never
          }
          revision={7}
        />
      )}
    </ModalLayerProvider>
  )
  return snapshot
}
it('retains roster selection through popup dismissal and central cancel, then saves under the editing lock', async () => {
  sceneFixture()
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked()
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  expect(screen.getAllByRole('checkbox')[0]).toBeDisabled()
  act(() => {
    resolution!.release()
    resolution = undefined
  })
  expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked()
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await resolution!.resolve('save')).toEqual([])
  })
  expect(scenePort.execute.mock.lastCall?.[0].command).toEqual({
    kind: 'set-roster',
    input: {
      sceneId: 'source',
      memberIds: ['a'],
      expectedRevision: 4,
      expectedPartyRevision: 7
    }
  })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
it('blocks unconfirmed rest during central save and discards without executing it', async () => {
  sceneFixture()
  fireEvent.click(screen.getByText('Rasten'))
  fireEvent.click(screen.getByText('Kurze Rast'))
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    const failures = await resolution!.resolve('save')
    expect(failures).toHaveLength(1)
    expect(failures[0]?.label).toBe('Rast: Hafen')
    expect(failures[0]?.message).toContain('bestätige')
  })
  expect(scenePort.execute).not.toHaveBeenCalled()
  expect(screen.getAllByRole('checkbox')[0]).toBeDisabled()
  await act(async () => {
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(scenePort.execute).not.toHaveBeenCalled()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
it.each(['save', 'discard'] as const)(
  'settles an unknown confirmed rest before central %s without replay',
  async (choice) => {
    sceneFixture()
    scenePort.execute.mockRejectedValueOnce(new Error('lost'))
    fireEvent.click(screen.getByText('Rasten'))
    fireEvent.click(screen.getByText('Lange Rast'))
    fireEvent.click(screen.getByText('Lange Rast bestätigen'))
    await screen.findByText('Speicherstatus erneut prüfen')
    const original = scenePort.execute.mock.calls[0]![0]
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve(choice)).toEqual([])
    })
    expect(scenePort.status).toHaveBeenCalledWith(original)
    expect(scenePort.execute).toHaveBeenCalledOnce()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  }
)
it('recovers a confirmed new-scene move after refresh failure without creating a second scene', async () => {
  sceneFixture()
  scenePort.refresh.mockRejectedValueOnce(new Error('refresh lost'))
  fireEvent.click(screen.getByText('Verschieben'))
  fireEvent.click(screen.getByText('Alle auswählen'))
  expect(screen.queryByLabelText('Szenenname')).toBeNull()
  fireEvent.click(screen.getByText('Übernehmen'))
  await screen.findByText('Speicherstatus erneut prüfen')
  expect(screen.getByText('Übernehmen')).toBeDisabled()
  fireEvent.click(screen.getByText('Speicherstatus erneut prüfen'))
  await waitFor(() =>
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  )
  expect(scenePort.execute).toHaveBeenCalledOnce()
  expect(scenePort.execute.mock.lastCall?.[0].command).toMatchObject({
    kind: 'move-roster',
    input: { target: { kind: 'new' } }
  })
})

it('direct roster apply cannot remove an unresolved XP editor and central discard clears both drafts', async () => {
  sceneFixture(true)
  fireEvent.click(screen.getByText('XP'))
  fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '50' } })
  fireEvent.click(screen.getByText('XP'))
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  fireEvent.click(screen.getAllByRole('checkbox')[0]!)
  fireEvent.click(screen.getByText('Übernehmen'))
  await screen.findByRole('alertdialog', { name: 'Besetzung ändern' })
  fireEvent.click(screen.getByText('Speichern und fortfahren'))
  await waitFor(() =>
    expect(screen.getByRole('alertdialog')).toHaveTextContent('XP: Edrik')
  )
  expect(scenePort.execute).not.toHaveBeenCalled()
  expect(xpPort.execute).not.toHaveBeenCalled()
  expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked()
  fireEvent.click(screen.getByText('Abbrechen'))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  fireEvent.click(screen.getByText('Übernehmen'))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByText('Verwerfen und fortfahren'))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  expect(scenePort.execute).not.toHaveBeenCalled()
  expect(xpPort.execute).not.toHaveBeenCalled()
})
it('settles XP before roster save and uses the resulting Party revision without replaying XP', async () => {
  const snapshot = sceneFixture(true)
  const current = { ...snapshot, party: { ...snapshot.party, revision: 8 } }
  xpPort.execute.mockRejectedValueOnce(new Error('lost'))
  xpPort.status.mockResolvedValue({
    receipt: { characterId: 'a', party: current.party },
    party: current.party
  })
  xpPort.refresh.mockResolvedValue(current)
  scenePort.current.mockReturnValue(current)
  scenePort.refresh.mockResolvedValue(current)
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  fireEvent.click(screen.getAllByRole('checkbox')[0]!)
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByText('XP'))
  fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '50' } })
  await waitFor(() => expect(screen.getByText('+')).toBeEnabled())
  fireEvent.click(screen.getByText('+'))
  await screen.findByText('Speicherstatus erneut prüfen')
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await resolution!.resolve('save')).toEqual([])
  })
  expect(xpPort.execute).toHaveBeenCalledOnce()
  expect(xpPort.status.mock.invocationCallOrder[0]).toBeLessThan(
    scenePort.execute.mock.invocationCallOrder[0]!
  )
  expect(scenePort.execute.mock.lastCall?.[0].command).toMatchObject({
    kind: 'set-roster',
    input: { memberIds: ['b'], expectedPartyRevision: 8, expectedRevision: 4 }
  })
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
it('does not rebase an unsubmitted roster across changed membership', async () => {
  const snapshot = sceneFixture()
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  fireEvent.click(screen.getAllByRole('checkbox')[0]!)
  scenePort.current.mockReturnValue({
    ...snapshot,
    party: {
      ...snapshot.party,
      revision: 8,
      members: snapshot.party.members.map((member) => ({
        ...member,
        active: false
      }))
    }
  })
  fireEvent.click(screen.getByText('Übernehmen'))
  await screen.findByText(
    'Szene oder Gruppe wurden inzwischen geändert. Bitte den Entwurf verwerfen und neu öffnen.'
  )
  expect(scenePort.execute).not.toHaveBeenCalled()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
})

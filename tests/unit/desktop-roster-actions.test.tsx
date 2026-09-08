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
  const setRoster = vi.fn().mockResolvedValue(snapshot)
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
  fireEvent.click(screen.getByText('Besetzung'))
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
  expect(setRoster).toHaveBeenCalledWith({
    sceneId: 'source',
    memberIds: [ids[0], ids[1], ids[17]],
    expectedRevision: 2,
    expectedPartyRevision: 3
  })
})

function xpFixture() {
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
        member={{ id: 'character', name: 'Edrik' } as never}
        revision={3}
      />
    </ModalLayerProvider>
  )
  fireEvent.click(screen.getByText('XP'))
  fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '50' } })
  return { ...view, receipt, party }
}
it('writes explicit XP actions with original receipts and keeps the confirmed amount reusable', async () => {
  xpFixture()
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
      'Überschreiben',
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
  xpFixture()
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
  xpFixture()
  xpPort.execute.mockRejectedValueOnce(new Error('lost response'))
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
  const restSelected = vi.fn().mockResolvedValue({ revision: 4 })
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
    expect(restSelected).toHaveBeenCalledWith({
      sceneId: 'source',
      memberIds: ['a'],
      type: 'short',
      expectedRevision: 3,
      expectedSceneRevision: 3
    })
  )
})

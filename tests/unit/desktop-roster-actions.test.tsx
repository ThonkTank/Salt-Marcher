// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
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
afterEach(() => {
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

it('writes XP immediately with only amount and three actions', async () => {
  const { DesktopXpAction } =
    await import('../../src/renderer/features/scene-desktop/desktop-xp-action.js')
  const result = { revision: 4, members: [], adventuringDay: {} }
  const adjustXp = vi.fn().mockResolvedValue(result)
  const setXp = vi.fn().mockResolvedValue(result)
  const api = {
    party: { adjustXp, setXp },
    session: { onChanged: () => () => undefined }
  } as unknown as SaltMarcherApi
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'publishSession'
  ).mockImplementation(() => true)
  render(
    <CapabilityProvider api={api}>
      <ModalLayerProvider>
        <DesktopXpAction
          campaignId="campaign"
          member={{ id: 'character' } as never}
          revision={3}
        />
      </ModalLayerProvider>
    </CapabilityProvider>
  )
  fireEvent.click(screen.getByText('XP'))
  fireEvent.change(screen.getByLabelText('Betrag'), { target: { value: '50' } })
  fireEvent.click(screen.getByText('+'))
  await waitFor(() =>
    expect(adjustXp).toHaveBeenCalledWith({
      id: 'character',
      delta: 50,
      expectedRevision: 3
    })
  )
  await waitFor(() => expect(screen.getByText('−')).not.toBeDisabled())
  fireEvent.click(screen.getByText('−'))
  await waitFor(() =>
    expect(adjustXp).toHaveBeenLastCalledWith({
      id: 'character',
      delta: -50,
      expectedRevision: 3
    })
  )
  await waitFor(() =>
    expect(screen.getByText('Überschreiben')).not.toBeDisabled()
  )
  fireEvent.click(screen.getByText('Überschreiben'))
  await waitFor(() =>
    expect(setXp).toHaveBeenCalledWith({
      id: 'character',
      amount: 50,
      expectedRevision: 3
    })
  )
  expect(screen.queryByText('Übernehmen')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
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

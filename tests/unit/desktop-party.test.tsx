import { maintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import * as partyPort from '../../src/renderer/features/scene-desktop/use-scene-party-command-port.js'
// @vitest-environment jsdom
import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DesktopParty } from '../../src/renderer/features/scene-desktop/desktop-party.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import {
  defaultInstallationPreferences,
  installationPreferencesSchema
} from '../../src/shared/contracts/settings.js'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('keeps all details available while changing only collapsed quick fields, and moves one character atomically', async () => {
  const member = {
    id: 'mira',
    name: 'Mira',
    active: true,
    characterClass: 'Rogue',
    level: 4,
    playerName: 'Anna',
    species: 'Human',
    languages: ['Common'],
    armorClass: 15,
    movementSpeedFeet: 30,
    passivePerception: 16,
    passiveInsight: 12,
    passiveInvestigation: 14
  }
  const snapshot = {
    party: {
      revision: 3,
      members: [
        member,
        { ...member, id: 'borin', name: 'Borin' },
        { ...member, id: 'absent', name: 'Absent' }
      ]
    },
    scene: {
      revision: 4,
      focusedSceneId: 'source',
      scenes: [
        { id: 'source', title: 'Hafen', partyMemberIds: ['mira', 'borin'] },
        { id: 'target', title: 'Wald', partyMemberIds: ['absent'] }
      ]
    }
  } as unknown as LiveSessionSnapshot
  let settings = { revision: 0, preferences: defaultInstallationPreferences }
  const update = vi
    .fn()
    .mockImplementation(
      ({ patch }: Parameters<SaltMarcherApi['settings']['update']>[0]) => {
        settings = {
          revision: settings.revision + 1,
          preferences: installationPreferencesSchema.parse({
            ...settings.preferences,
            ...patch
          })
        }
        return Promise.resolve(settings)
      }
    )
  const moveRoster = vi
    .fn()
    .mockRejectedValueOnce(new Error('Speicherfehler'))
    .mockResolvedValue({ snapshot })
  vi.spyOn(partyPort, 'useScenePartyCommandPort').mockReturnValue({
    current: () => snapshot,
    refresh: () => Promise.resolve(snapshot),
    execute: moveRoster,
    status: () => Promise.resolve({ receipt: null, snapshot })
  })
  const api = {
    settings: {
      read: vi.fn().mockImplementation(() => Promise.resolve(settings)),
      update
    },
    scene: { moveRoster },
    session: { onChanged: () => () => undefined }
  } as unknown as SaltMarcherApi
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'refreshActiveSession'
  ).mockResolvedValue({ status: 'inactive' } as never)
  function Harness() {
    const [expanded, setExpanded] = useState<string[]>([])
    return (
      <DesktopParty
        campaignId="campaign"
        sceneId="source"
        snapshot={snapshot}
        expanded={expanded}
        toggle={(id) =>
          setExpanded((ids) =>
            ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
          )
        }
      />
    )
  }
  render(
    <CapabilityProvider api={api}>
      <ModalLayerProvider>
        <Harness />
      </ModalLayerProvider>
    </CapabilityProvider>
  )
  expect(screen.queryByText('Absent')).toBeNull()
  await waitFor(() =>
    expect(screen.getByText('Schnellwerte')).not.toBeDisabled()
  )
  // Party alone must not depend on XP editors in the closed character window.
  await act(async () => {
    const resolution = maintenanceDraftCoordinator.begin()
    try {
      expect(await resolution.resolve('check')).toEqual([])
    } finally {
      resolution.release()
    }
  })
  const quick = document.querySelector('.desktop-party-quick')!
  expect(quick.textContent).toContain('AC 15')
  expect(quick.parentElement?.textContent).toContain('Mira')
  fireEvent.click(screen.getByText('Schnellwerte'))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Inv.' }))
  await waitFor(() => expect(update).toHaveBeenCalledOnce())
  await waitFor(() => expect(quick.textContent).toContain('Inv. 14'))
  fireEvent.click(screen.getByText('Fertig'))
  fireEvent.click(screen.getByRole('button', { name: /▸ Mira/ }))
  fireEvent.click(screen.getByRole('button', { name: /▸ Borin/ }))
  expect(
    document.querySelectorAll('.desktop-party-details:not([hidden])')
  ).toHaveLength(2)
  expect(
    document.querySelector('.desktop-party-details')?.textContent
  ).toContain('Rogue 4HumanAnna')
  expect(
    document.querySelector('.desktop-party-details')?.textContent
  ).toContain('Speed 30 ft.')
  expect(quick.textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Mira verschieben' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wald' }))
  await screen.findByRole('alert')
  expect(screen.getByText('Verschieben nach')).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Speicherstatus erneut prüfen' })
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Wald' })).not.toBeDisabled()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Wald' }))
  await waitFor(() => expect(screen.queryByText('Verschieben nach')).toBeNull())
  expect(moveRoster).toHaveBeenLastCalledWith({
    commandId: expect.any(String) as string,
    command: {
      kind: 'move-roster',
      input: {
        sceneId: 'source',
        memberIds: ['mira'],
        expectedRevision: 4,
        expectedPartyRevision: 3,
        target: { kind: 'existing', sceneId: 'target' }
      }
    }
  })
})

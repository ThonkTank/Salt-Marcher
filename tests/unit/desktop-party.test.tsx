// @vitest-environment jsdom
import { useState } from 'react'
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DesktopParty } from '../../src/renderer/features/scene-desktop/desktop-party.js'
import { DesktopWindow } from '../../src/renderer/features/scene-desktop/desktop-window.js'
import { initialPartyWindow } from '../../src/renderer/features/scene-desktop/desktop-state.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { defaultInstallationPreferences } from '../../src/shared/contracts/settings.js'
import * as scenePort from '../../src/renderer/features/scene-desktop/use-scene-party-command-port.js'
import * as characterPort from '../../src/renderer/features/party/use-character-command-port.js'
import * as actionPort from '../../src/renderer/features/scene-desktop/use-party-action-port.js'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import type { PartyHistory } from '../../src/shared/contracts/party-actions.js'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function fixture(
  options: {
    readHistory?: SaltMarcherApi['party']['history']
  } = {}
) {
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
    passiveInvestigation: 14,
    xp: 3200,
    currentLevelFloor: 2700,
    nextLevelXp: 6500,
    xpSinceShortRest: 300,
    xpSinceLongRest: 500,
    burden: {
      shortTrusted: true,
      longTrusted: true,
      dailyBudget: 1700,
      completedShortRestSections: 0,
      sectionStartXp: 0,
      sectionsTrusted: true
    }
  }
  const snapshot = {
    party: {
      revision: 3,
      members: [
        member,
        { ...member, id: 'borin', name: 'Borin' },
        { ...member, id: 'absent', name: 'Absent' },
        ...Array.from({ length: 45 }, (_, i) => ({
          ...member,
          id: `extra-${i}`,
          name: i < 2 ? 'Doppel' : `Charakter ${i}`,
          playerName: `Spieler ${i}`,
          active: false
        }))
      ]
    },
    scene: {
      revision: 4,
      focusedSceneId: 'source',
      unassignedPartyMemberIds: [],
      scenes: [
        {
          id: 'source',
          title: 'Historischer Titel',
          locationName: 'Hafen',
          partyMemberIds: ['mira', 'borin']
        },
        {
          id: 'target',
          title: 'Alter Titel',
          locationName: 'Wald',
          partyMemberIds: ['absent']
        }
      ]
    }
  } as unknown as LiveSessionSnapshot
  const settings = { revision: 0, preferences: defaultInstallationPreferences }
  const history = { undo: null, redo: null, pending: false }
  const move = vi
    .fn<scenePort.ScenePartyCommandPort['execute']>()
    .mockResolvedValue({ snapshot } as never)
  const xp = vi
    .fn<characterPort.CharacterCommandPort['execute']>()
    .mockResolvedValue({ characterId: 'mira', party: snapshot.party } as never)
  const action = vi
    .fn<actionPort.PartyActionPort['execute']>()
    .mockResolvedValue({ snapshot, settings, history })
  const readHistory = vi.fn<SaltMarcherApi['party']['history']>(
    options.readHistory ?? (() => Promise.resolve(history))
  )
  vi.spyOn(scenePort, 'useScenePartyCommandPort').mockReturnValue({
    current: () => snapshot,
    refresh: () => Promise.resolve(snapshot),
    execute: move,
    status: () => Promise.resolve({ receipt: null, snapshot })
  })
  vi.spyOn(characterPort, 'useCharacterCommandPort').mockReturnValue({
    refresh: () => Promise.resolve(snapshot),
    execute: xp,
    status: () => Promise.resolve({ receipt: null, party: snapshot.party })
  })
  vi.spyOn(actionPort, 'usePartyActionPort').mockReturnValue({
    refresh: () => Promise.resolve(snapshot),
    execute: action,
    status: () =>
      Promise.resolve({
        committed: false,
        result: { snapshot, settings, history }
      })
  })
  vi.spyOn(
    CampaignWorkspaceProjection.prototype,
    'refreshActiveSession'
  ).mockResolvedValue({ status: 'inactive' } as never)
  const api = {
    settings: { read: () => Promise.resolve(settings) },
    party: {
      history: readHistory,
      previewXp: ({
        amount,
        expectedRevision
      }: {
        amount: number
        expectedRevision: number
      }) =>
        Promise.resolve({
          revision: expectedRevision,
          amount,
          add: 3200 + amount,
          subtract: Math.max(0, 3200 - amount),
          set: amount
        })
    },
    session: { onChanged: () => () => {} }
  } as unknown as SaltMarcherApi
  function Harness({
    campaignId,
    currentSnapshot
  }: {
    campaignId: string
    currentSnapshot: LiveSessionSnapshot
  }) {
    const [expanded, setExpanded] = useState<string[]>([])
    return (
      <DesktopWindow
        window={initialPartyWindow}
        size={{ width: 800, height: 600 }}
        others={[]}
        title="Party"
        raised
        disabled={false}
        dispatch={() => {}}
        preview={() => {}}
      >
        <DesktopParty
          campaignId={campaignId}
          sceneId="source"
          snapshot={currentSnapshot}
          expanded={expanded}
          toggle={(id) =>
            setExpanded((ids) =>
              ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
            )
          }
          openCharacter={() => {}}
        />
      </DesktopWindow>
    )
  }
  const tree = (campaignId = 'campaign', currentSnapshot = snapshot) => (
    <CapabilityProvider api={api}>
      <ModalLayerProvider>
        <Harness campaignId={campaignId} currentSnapshot={currentSnapshot} />
      </ModalLayerProvider>
    </CapabilityProvider>
  )
  const view = render(tree())
  return {
    move,
    xp,
    action,
    readHistory,
    snapshot,
    unmount: view.unmount,
    rerender: (campaignId: string, currentSnapshot = snapshot) =>
      view.rerender(tree(campaignId, currentSnapshot))
  }
}
it('keeps compact bars beside names, replaces quick information with details and uses the real title bar', async () => {
  fixture()
  expect(screen.queryByText('Absent')).toBeNull()
  expect(screen.getAllByRole('heading', { name: 'Party' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Mira verschieben' })).toBeNull()
  expect(
    document.querySelectorAll('.desktop-party-row .party-meter')
  ).toHaveLength(4)
  expect(document.querySelectorAll('.desktop-party-quick')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /▸ Mira/ }))
  expect(document.querySelectorAll('.desktop-party-quick')).toHaveLength(1)
  expect(
    document.querySelector('.desktop-party-details')?.textContent
  ).toContain('Rogue 4')
  expect(
    document.querySelector('.desktop-party-details')?.textContent
  ).toContain('Speed 30 ft.')
  expect(screen.getByRole('button', { name: 'Beute' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Katalog' })).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Party-Aktionen' })
    ).not.toBeDisabled()
  )
})
it('retains roster selection across character, player and ID filters for a large roster', async () => {
  const h = fixture()
  fireEvent.click(screen.getByRole('button', { name: 'Party-Aktionen' }))
  fireEvent.click(screen.getByText('Aktives Roster bearbeiten'))
  const search = screen.getByPlaceholderText('Charakter oder Spieler')
  fireEvent.change(search, { target: { value: 'Spieler 24' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Charakter 24/ }))
  fireEvent.change(search, { target: { value: 'extra-2' } })
  expect(screen.getByText('3 ausgewählt')).toBeInTheDocument()
  fireEvent.change(search, { target: { value: 'Doppel' } })
  expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))
  await waitFor(() => expect(h.move).toHaveBeenCalledOnce())
  expect(h.move.mock.calls[0]?.[0].command).toMatchObject({
    kind: 'set-roster',
    input: { memberIds: ['mira', 'borin', 'extra-24'] }
  })
})
it('shows an XP input only on bar activation and shares preview with all three actions', async () => {
  const h = fixture()
  expect(screen.queryByRole('spinbutton')).toBeNull()
  const bar = screen.getByRole('button', { name: /Mira: 3.200 XP/ })
  fireEvent.focus(bar)
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'Nächste Stufe bei 6.500 XP'
  )
  fireEvent.click(bar)
  const input = screen.getByRole('spinbutton')
  fireEvent.change(input, { target: { value: '4000' } })
  const plus = screen.getByRole('button', { name: 'XP addieren' })
  await waitFor(() => expect(plus).not.toBeDisabled())
  fireEvent.focus(plus)
  expect(
    screen
      .getAllByRole('tooltip')
      .some((t) => t.textContent === 'Ergebnis: 7.200 XP')
  ).toBe(true)
  fireEvent.click(plus)
  await waitFor(() => expect(h.xp).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'XP subtrahieren' })
    ).not.toBeDisabled()
  )
  fireEvent.click(screen.getByRole('button', { name: 'XP subtrahieren' }))
  await waitFor(() => expect(h.xp).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Gesamt-XP durch Betrag ersetzen' })
    ).not.toBeDisabled()
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Gesamt-XP durch Betrag ersetzen' })
  )
  await waitFor(() => expect(h.xp).toHaveBeenCalledTimes(3))
  expect(h.xp.mock.calls.map((call) => call[0].command.kind)).toEqual([
    'adjust-xp',
    'adjust-xp',
    'set-xp'
  ])
})

const availableHistory: PartyHistory = {
  undo: { id: 'undo-step', description: 'XP ändern', blockedReason: null },
  redo: { id: 'redo-step', description: 'Rasten', blockedReason: null },
  pending: false
}
function deferredHistory() {
  let resolve!: (value: PartyHistory) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<PartyHistory>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
it('keeps pending and ready-empty history non-actionable without showing a false failure', async () => {
  const pending = deferredHistory()
  fixture({ readHistory: () => pending.promise })
  expect(
    screen.getByRole('button', { name: 'Party-Aktion rückgängig machen' })
  ).toBeDisabled()
  expect(screen.queryByRole('alert')).toBeNull()
  await act(async () => {
    pending.resolve({ undo: null, redo: null, pending: false })
    await pending.promise
  })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Erneut versuchen')).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Party-Aktion wiederherstellen' })
  ).toBeDisabled()
})
it('reports repeated read failures and restores current actions on retry without submitting writes', async () => {
  const read = vi
    .fn<SaltMarcherApi['party']['history']>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('still offline'))
    .mockResolvedValue(availableHistory)
  const h = fixture({ readHistory: read })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Verlauf konnte nicht geladen werden.'
  )
  const retry = screen.getByRole('button', { name: 'Erneut versuchen' })
  retry.focus()
  expect(retry).toHaveFocus()
  expect(retry.tabIndex).toBe(0)
  fireEvent.click(retry)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Verlauf konnte nicht geladen werden.'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Rückgängig: XP ändern' })
    ).toBeEnabled()
  )
  expect(
    screen.getByRole('button', { name: 'Wiederherstellen: Rasten' })
  ).toBeEnabled()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(read).toHaveBeenCalledTimes(3)
  expect(h.action).not.toHaveBeenCalled()
  expect(h.xp).not.toHaveBeenCalled()
  expect(h.move).not.toHaveBeenCalled()
})
it('disables previously available actions immediately when their snapshot is replaced', async () => {
  const pending = deferredHistory()
  const read = vi
    .fn<SaltMarcherApi['party']['history']>()
    .mockResolvedValueOnce(availableHistory)
    .mockImplementation(() => pending.promise)
  const h = fixture({ readHistory: read })
  await screen.findByRole('button', { name: 'Rückgängig: XP ändern' })
  h.rerender('campaign', structuredClone(h.snapshot))
  expect(
    screen.getByRole('button', { name: 'Party-Aktion rückgängig machen' })
  ).toBeDisabled()
  await act(async () => {
    pending.reject(new Error('offline'))
    await pending.promise.catch(() => undefined)
  })
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Verlauf konnte nicht geladen werden.'
  )
  expect(
    screen.getByRole('button', { name: 'Party-Aktion rückgängig machen' })
  ).toBeDisabled()
})
it.each(['campaign', 'snapshot'] as const)(
  'ignores late success and failure after a %s change',
  async (change) => {
    const first = deferredHistory()
    const second = deferredHistory()
    const read = vi
      .fn<SaltMarcherApi['party']['history']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
      .mockResolvedValue(availableHistory)
    const h = fixture({ readHistory: read })
    h.rerender(
      change === 'campaign' ? 'second-campaign' : 'campaign',
      structuredClone(h.snapshot)
    )
    h.rerender(
      change === 'campaign' ? 'third-campaign' : 'campaign',
      structuredClone(h.snapshot)
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Rückgängig: XP ändern' })
      ).toBeEnabled()
    )
    await act(async () => {
      first.resolve({ undo: null, redo: null, pending: false })
      second.reject(new Error('obsolete failure'))
      await Promise.allSettled([first.promise, second.promise])
    })
    expect(
      screen.getByRole('button', { name: 'Rückgängig: XP ändern' })
    ).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(h.action).not.toHaveBeenCalled()
  }
)
it('ignores a closed window reply after another Party window mounts', async () => {
  const pending = deferredHistory()
  const first = fixture({ readHistory: () => pending.promise })
  first.unmount()
  fixture({ readHistory: () => Promise.resolve(availableHistory) })
  await screen.findByRole('button', { name: 'Rückgängig: XP ändern' })
  await act(async () => {
    pending.reject(new Error('closed window'))
    await pending.promise.catch(() => undefined)
  })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Rückgängig: XP ändern' })
  ).toBeEnabled()
})

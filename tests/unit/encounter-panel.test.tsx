// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { SessionEncounterPanel } from '../../src/renderer/features/encounter/encounter-panels.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { combatConditions } from '../../src/shared/contracts/live-session.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const sceneId = '01900000-0000-7000-8000-000000000001'
const groupId = '01900000-0000-7000-8000-000000000002'
const combatId = '01900000-0000-7000-8000-000000000003'

function combatSnapshot(): LiveSessionSnapshot {
  return {
    revision: 4,
    party: { revision: 0, members: [] },
    scene: {
      revision: 4,
      defaultSceneId: sceneId,
      focusedSceneId: sceneId,
      locationChoices: [],
      unassignedPartyMemberIds: [],
      scenes: [
        {
          id: sceneId,
          title: 'Hafen',
          defaultScene: true,
          focused: true,
          locationId: null,
          locationName: '',
          gameTimeSeconds: 0,
          partyMemberIds: [],
          groups: []
        }
      ]
    },
    travel: { kind: 'none', label: '', hint: '' },
    combat: {
      id: combatId,
      revision: 3,
      phase: 'combat',
      selectedGroupIds: [groupId],
      initiativeRows: [],
      round: 2,
      undoLabel: '−7 TP · Wolf',
      allEnemiesDefeated: false,
      resolution: null,
      cards: [
        {
          id: 'wolf-card',
          creatureId: 'wolf',
          memberIds: ['wolf-1', 'wolf-2'],
          name: 'Wölfe',
          playerCharacter: false,
          active: true,
          done: false,
          alive: true,
          currentHp: 7,
          maxHp: 11,
          armorClass: 13,
          initiative: 15,
          count: 2,
          aliveCount: 2,
          conditions: ['prone'],
          concentrating: false,
          exhaustionLevel: 0,
          detail: ''
        }
      ]
    }
  } as unknown as LiveSessionSnapshot
}

describe('encounter scenario panel', () => {
  let api: SaltMarcherApi

  beforeEach(() => {
    api = {
      encounter: { evaluate: vi.fn().mockResolvedValue(null) }
    } as unknown as SaltMarcherApi
  })

  it('renders a readable two-action footer and closes the HP modal after success', async () => {
    const snapshot = combatSnapshot()
    const changeHp = vi.fn().mockResolvedValue({
      combat: { ...snapshot.combat!, revision: 4 },
      scenePatch: null,
      party: null
    })
    api = { ...api, combat: { changeHp } } as unknown as SaltMarcherApi
    render(
      <CapabilityProvider api={api}>
        <ModalLayerProvider>
          <SessionEncounterPanel
            snapshot={snapshot}
            loot={{
              revision: 0,
              sceneId,
              locationId: null,
              locationTreasures: [],
              groupTreasures: []
            }}
            setSnapshot={vi.fn()}
            onError={vi.fn()}
            inspect={vi.fn()}
          />
        </ModalLayerProvider>
      </CapabilityProvider>
    )

    const footer = screen.getByRole('button', {
      name: 'Rückgängig'
    }).parentElement!
    expect(within(footer).getAllByRole('button')).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Verstärkung' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bestätigen' })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Trefferpunkte und Zustände für Wölfe'
      })
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getAllByRole('button', { pressed: false })
    ).toHaveLength(combatConditions.length)
    expect(
      within(dialog).getByRole('button', { pressed: true })
    ).toHaveTextContent('Prone')
    expect(
      within(dialog).getByText(`1 von ${combatConditions.length + 2}`)
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Schaden anwenden' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(changeHp).toHaveBeenCalledOnce()
  })
})

// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { PartyDropdown } from '../../src/renderer/features/party/party-controls.js'
import { partyCharacterMatchesSearch } from '../../src/renderer/features/party/party-search.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  PartyCharacter,
  PartyCharacterDraft,
  PartySnapshot
} from '../../src/shared/contracts/party.js'

const character: PartyCharacter = {
  id: '01900000-0000-7000-8000-000000000201',
  name: 'Grikania',
  playerName: 'Jan',
  species: 'Githjanki',
  characterClass: 'Rogue',
  languages: ['Common', 'Gith'],
  level: 2,
  passivePerception: 16,
  passiveInvestigation: 16,
  passiveInsight: 12,
  armorClass: null,
  movementSpeedFeet: null,
  travelPosition: null,
  attachedToPartyToken: false,
  active: true,
  xp: 300,
  currentLevelFloor: 300,
  nextLevelXp: 900,
  xpSinceShortRest: 0,
  xpSinceLongRest: 0
}
const party: PartySnapshot = {
  revision: 4,
  members: [character],
  adventuringDay: {
    available: true,
    partySize: 1,
    dailyBudget: 600,
    shortRestXp: 0,
    longRestXp: 0
  }
}

afterEach(cleanup)

describe('structured party profile UI', () => {
  it('searches every added identity and passive field', () => {
    for (const query of ['githjanki', 'rogue', 'gith', '16', '12'])
      expect(partyCharacterMatchesSearch(character, query)).toBe(true)
    expect(partyCharacterMatchesSearch(character, 'wizard')).toBe(false)
  })

  it('renders and submits all added editor fields', () => {
    const update = vi.fn(
      (input: {
        id: string
        expectedRevision: number
        character: PartyCharacterDraft
      }) => {
        void input
        return Promise.resolve(party)
      }
    )
    const api = {
      party: { update },
      session: { onChanged: vi.fn(() => () => undefined) }
    } as unknown as SaltMarcherApi
    render(
      <CapabilityProvider api={api}>
        <PartyDropdown
          party={party}
          open
          setOpen={vi.fn()}
          changed={vi.fn()}
          onError={vi.fn()}
        />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!)
    expect(screen.getByLabelText('Spezies')).toHaveValue('Githjanki')
    expect(screen.getByLabelText('Klasse')).toHaveValue('Rogue')
    expect(screen.getByLabelText('Sprachen')).toHaveValue('Common, Gith')
    expect(screen.getByLabelText('Passive Investigation')).toHaveValue(16)
    expect(screen.getByLabelText('Passive Insight')).toHaveValue(12)

    fireEvent.change(screen.getByLabelText('Sprachen'), {
      target: { value: 'Common, common, Sylvan' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(update.mock.calls[0]![0]).toMatchObject({
      id: character.id,
      expectedRevision: party.revision,
      character: { languages: ['Common', 'Sylvan'] }
    })
  })
})

// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterProfileForm } from '../../src/renderer/features/party/character-profile-form.js'
import { partyCharacterMatchesSearch } from '../../src/renderer/features/party/party-search.js'
import type { PartyCharacter } from '../../src/shared/contracts/party.js'

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
afterEach(cleanup)

describe('structured party profile UI', () => {
  it('searches every added identity and passive field', () => {
    for (const query of ['githjanki', 'rogue', 'gith', '16', '12'])
      expect(partyCharacterMatchesSearch(character, query)).toBe(true)
    expect(partyCharacterMatchesSearch(character, 'wizard')).toBe(false)
  })

  it('renders and submits all added editor fields', () => {
    const save = vi.fn()
    render(
      <CharacterProfileForm
        member={character}
        busy={false}
        blocked={false}
        error={null}
        save={save}
        close={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Spezies')).toHaveValue('Githjanki')
    expect(screen.getByLabelText('Klasse')).toHaveValue('Rogue')
    expect(screen.getByRole('textbox', { name: /Sprachen/ })).toHaveValue(
      'Common, Gith'
    )
    expect(
      screen.getByRole('spinbutton', { name: /Nachforschung/ })
    ).toHaveValue(16)
    expect(screen.getByRole('spinbutton', { name: /Einsicht/ })).toHaveValue(12)

    fireEvent.change(screen.getByRole('textbox', { name: /Sprachen/ }), {
      target: { value: 'Common, common, Sylvan' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ languages: ['Common', 'Sylvan'] })
    )
  })

  it('blocks editing while allowing the registered transition save', async () => {
    const save = vi.fn(() => Promise.resolve(true))
    let transitionSave: (() => Promise<boolean>) | undefined
    render(
      <CharacterProfileForm
        member={character}
        busy={false}
        blocked
        error={null}
        save={save}
        registerSave={(submit) => {
          transitionSave = submit
          return () => undefined
        }}
        close={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Charaktername')).toBeDisabled()
    expect(await transitionSave?.()).toBe(true)
    expect(save).toHaveBeenCalledOnce()
  })
})

// @vitest-environment jsdom
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import CharacterCatalogSection from '../../src/renderer/features/party/character-catalog-section.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { partyCharacterSchema } from '../../src/shared/contracts/party.js'
import {
  characterFormValues,
  parseCharacterForm,
  characterShortId
} from '../../src/renderer/features/party/character-profile.js'
import { CharacterProfileForm } from '../../src/renderer/features/party/character-profile-form.js'
import { DesktopCharacters } from '../../src/renderer/features/scene-desktop/desktop-characters.js'
import {
  initialDesktopState,
  reduceDesktop
} from '../../src/renderer/features/scene-desktop/desktop-state.js'
import { readStoredDesktopState } from '../../src/shared/contracts/scene-desktop.js'
const member = partyCharacterSchema.parse({
  id: '01900000-0000-7000-8000-000000000201',
  name: 'Edrik',
  playerName: 'Alex',
  species: null,
  characterClass: null,
  languages: ['Common', 'Abyssal'],
  level: 3,
  passivePerception: 14,
  passiveInsight: null,
  passiveInvestigation: 12,
  armorClass: null,
  movementSpeedFeet: 30,
  travelPosition: null,
  attachedToPartyToken: false,
  active: true,
  xp: 900,
  currentLevelFloor: 900,
  nextLevelXp: 2700,
  xpSinceShortRest: 0,
  xpSinceLongRest: 0
})
afterEach(cleanup)
describe('character library and scene facts', () => {
  it('accepts name-only profiles, clears nullable facts and deduplicates languages in authored order', () => {
    const values = characterFormValues(null)
    expect(parseCharacterForm(values).success).toBe(false)
    values.name = '  Edrik '
    values.languages = 'Abyssal, common, abyssal'
    const result = parseCharacterForm(values)
    expect(result.success && result.data).toMatchObject({
      name: 'Edrik',
      level: null,
      playerName: null,
      languages: ['Abyssal', 'common'],
      passiveInsight: null
    })
    values.level = '2.5'
    expect(parseCharacterForm(values).success).toBe(false)
    values.level = '21'
    expect(parseCharacterForm(values).success).toBe(false)
  })
  it('shows invalid fields beside preserved inputs and submits a cleared optional value', () => {
    const save = vi.fn()
    render(
      <CharacterProfileForm
        member={member}
        busy={false}
        error={null}
        save={save}
        close={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText('Level'), {
      target: { value: '21' }
    })
    fireEvent.click(screen.getByText('Speichern'))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Level')).toHaveValue(21)
    expect(screen.getByRole('alert')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Speichern'))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ level: null }))
  })
  it('keeps scene order and missing values while highlighting matches', () => {
    const other = {
      ...member,
      id: '01900000-0000-7000-8000-000000000202',
      name: 'Vivian',
      languages: []
    }
    const props = {
      members: [other, member],
      comparison: {
        language: 'Abyssal',
        passive: 'passiveInsight' as const,
        minimum: null
      },
      change: vi.fn(),
      openCharacter: vi.fn(),
      onError: vi.fn()
    }
    const { container, rerender } = render(<DesktopCharacters {...props} />)
    const ids = () =>
      Array.from(container.querySelectorAll('tbody')).map((node) =>
        node.getAttribute('data-character-id')
      )
    expect(ids()).toEqual([other.id, member.id])
    expect(container.querySelectorAll('[data-match="true"]')).toHaveLength(1)
    rerender(
      <DesktopCharacters
        {...props}
        comparison={{ ...props.comparison, minimum: 0 }}
      />
    )
    expect(ids()).toEqual([other.id, member.id])
    expect(container.querySelectorAll('[data-match="true"]')).toHaveLength(0)
    expect(screen.getAllByText('XP 900 / 2700')).toHaveLength(2)
  })
  it('disambiguates identical UUID prefixes and retains v3 map state when upgrading', () => {
    const other = { ...member, id: '01900000-0000-7000-8000-000000000202' }
    expect(characterShortId(member, [member, other])).not.toBe(
      characterShortId(other, [member, other])
    )
    const previous = reduceDesktop(initialDesktopState(), { type: 'open-map' })
    const upgraded = readStoredDesktopState({ ...previous, schemaVersion: 3 })
    expect(upgraded).toEqual(previous)
    const opened = reduceDesktop(upgraded, { type: 'open-characters' })
    expect(readStoredDesktopState(opened)).toEqual(opened)
    expect(
      reduceDesktop(opened, { type: 'open-characters' }).windows.filter(
        (window) => window.kind === 'characters'
      )
    ).toHaveLength(1)
  })
})

describe('catalog draft concurrency', () => {
  const snapshot = (changed = member) =>
    ({
      party: { revision: 3, members: [changed] },
      scene: { scenes: [] }
    }) as unknown as LiveSessionSnapshot
  it('does not overwrite a profile changed after opening the editor', () => {
    const update = vi.fn()
    const api = {
      party: { update },
      session: { onChanged: () => () => undefined }
    } as unknown as SaltMarcherApi
    const props = {
      campaignId: 'campaign',
      snapshot: snapshot(),
      selectedId: member.id,
      select: vi.fn(),
      onError: vi.fn()
    }
    const view = render(
      <CapabilityProvider api={api}>
        <CharacterCatalogSection {...props} />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getByText('Bearbeiten'))
    fireEvent.change(screen.getByLabelText('Charaktername'), {
      target: { value: 'My draft' }
    })
    view.rerender(
      <CapabilityProvider api={api}>
        <CharacterCatalogSection
          {...props}
          snapshot={snapshot({ ...member, name: 'External edit' })}
        />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getByText('Speichern'))
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('inzwischen geändert')
    expect(screen.getByLabelText('Charaktername')).toHaveValue('My draft')
  })
  it('publishes a confirmed character mutation and refreshes scene reconciliation', async () => {
    const publish = vi.spyOn(
      CampaignWorkspaceProjection.prototype,
      'publishSession'
    )
    const refresh = vi.spyOn(
      CampaignWorkspaceProjection.prototype,
      'refreshActiveSession'
    )
    try {
      const result = {
        ...snapshot().party,
        revision: 4,
        members: [member, { ...member, id: 'new', name: 'New' }]
      }
      const api = {
        party: { create: vi.fn(() => Promise.resolve(result)) },
        session: { onChanged: () => () => undefined }
      } as unknown as SaltMarcherApi
      const select = vi.fn()
      render(
        <CapabilityProvider api={api}>
          <CharacterCatalogSection
            campaignId="campaign"
            snapshot={snapshot()}
            selectedId={null}
            select={select}
            onError={vi.fn()}
          />
        </CapabilityProvider>
      )
      fireEvent.click(screen.getByText('Neu'))
      fireEvent.change(screen.getByLabelText('Charaktername'), {
        target: { value: 'New' }
      })
      fireEvent.click(screen.getByText('Speichern'))
      await waitFor(() => expect(select).toHaveBeenCalledWith('new'))
      expect(publish).toHaveBeenCalledWith('campaign', expect.any(Function))
      const update = publish.mock.calls[0]![1]
      expect(typeof update === 'function' && update(snapshot()).party).toEqual(
        result
      )
      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      publish.mockRestore()
      refresh.mockRestore()
    }
  })
  it('prevents duplicate saves and ignores late navigation after unmount', async () => {
    let resolve!: (value: unknown) => void
    const create = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const api = {
      party: { create },
      session: { onChanged: () => () => undefined }
    } as unknown as SaltMarcherApi
    const select = vi.fn()
    const view = render(
      <CapabilityProvider api={api}>
        <CharacterCatalogSection
          campaignId="campaign"
          snapshot={snapshot()}
          selectedId={null}
          select={select}
          onError={vi.fn()}
        />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getByText('Neu'))
    select.mockClear()
    fireEvent.change(screen.getByLabelText('Charaktername'), {
      target: { value: 'New' }
    })
    fireEvent.click(screen.getByText('Speichern'))
    fireEvent.click(screen.getByText('Speichern'))
    expect(create).toHaveBeenCalledTimes(1)
    view.unmount()
    resolve({ members: [member, { ...member, id: 'new', name: 'New' }] })
    await Promise.resolve()
    await Promise.resolve()
    expect(select).not.toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import CharacterCatalogSection from '../../src/renderer/features/party/character-catalog-section.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  partyCharacterSchema,
  type PartyCharacterCommand,
  type PartyCharacterCommandReceipt
} from '../../src/shared/contracts/party.js'
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
let maintenanceResolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  maintenanceResolution?.release()
  maintenanceResolution = undefined
  cleanup()
  vi.restoreAllMocks()
})
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
  const initial = {
    revision: 3,
    party: { revision: 3, members: [member] },
    scene: { scenes: [] }
  } as unknown as LiveSessionSnapshot
  function fixture() {
    let current = initial
    let receipt: PartyCharacterCommandReceipt | null = null
    const execute = vi.fn((input: PartyCharacterCommand) => {
      const command = input.command
      const id = command.kind === 'create' ? 'new' : command.input.id
      const members =
        command.kind === 'delete'
          ? []
          : command.kind === 'create'
            ? [member, { ...member, ...command.input.character, id }]
            : [{ ...member, ...command.input.character }]
      current = {
        ...initial,
        revision: 4,
        party: { ...initial.party, revision: 4, members }
      }
      receipt = { characterId: id, party: current.party }
      return Promise.resolve(receipt)
    })
    const status = vi.fn(() =>
      Promise.resolve({ receipt, party: current.party })
    )
    const read = vi.fn(() => Promise.resolve(current))
    const api = {
      party: {
        executeCharacterCommand: execute,
        characterCommandStatus: status
      },
      session: { read, onChanged: () => () => undefined }
    } as unknown as SaltMarcherApi
    const workspace = new CampaignWorkspaceProjection(api)
    workspace.publishCampaigns({
      revision: 1,
      activeCampaignId: 'campaign',
      campaigns: [],
      trashedCampaigns: []
    })
    workspace.publishSession('campaign', initial)
    const context = {
      api,
      campaignWorkspace: workspace
    } as CapabilityContextValue
    const select = vi.fn()
    const onError = vi.fn()
    const renderCatalog = (snapshot = initial) => (
      <CapabilityContext.Provider value={context}>
        <CharacterCatalogSection
          campaignId="campaign"
          snapshot={snapshot}
          selectedId={member.id}
          select={select}
          onError={onError}
        />
      </CapabilityContext.Provider>
    )
    const view = render(renderCatalog())
    return {
      execute,
      status,
      read,
      workspace,
      select,
      onError,
      view,
      current: () => current,
      receipt: () => receipt,
      later: (value: LiveSessionSnapshot) => {
        current = value
      },
      rerender: (snapshot: LiveSessionSnapshot) =>
        view.rerender(renderCatalog(snapshot))
    }
  }
  function edit(action = 'Bearbeiten', name = 'Draft') {
    fireEvent.click(screen.getByText(action))
    fireEvent.change(screen.getByLabelText('Charaktername'), {
      target: { value: name }
    })
  }
  function beginMaintenance() {
    act(() => {
      maintenanceResolution = maintenanceDraftCoordinator.begin()
    })
  }
  async function resolveMaintenance(choice: 'save' | 'discard') {
    let result!: Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
    await act(async () => {
      result = await maintenanceResolution!.resolve(choice)
    })
    return result
  }
  it('does not overwrite a profile changed after opening the editor', () => {
    const f = fixture()
    edit()
    f.rerender({
      ...initial,
      party: {
        ...initial.party,
        members: [{ ...member, name: 'External edit' }]
      }
    })
    fireEvent.click(screen.getByText('Speichern'))
    expect(f.execute).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('inzwischen geändert')
    expect(screen.getByLabelText('Charaktername')).toHaveValue('Draft')
  })
  it('refreshes the complete workspace before selecting the created character', async () => {
    const f = fixture()
    edit('Neu', 'New')
    fireEvent.click(screen.getByText('Speichern'))
    await waitFor(() => expect(f.select).toHaveBeenCalledWith('new'))
    expect(f.workspace.snapshot().session).toEqual(f.current())
    expect(f.read).toHaveBeenCalledOnce()
    expect(f.execute.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'campaign',
      command: { kind: 'create' }
    })
  })
  it('prevents duplicate saves and retains maintenance ownership after unmount', async () => {
    const f = fixture()
    let finish!: (receipt: PartyCharacterCommandReceipt) => void
    f.execute.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    edit('Neu')
    f.select.mockClear()
    fireEvent.click(screen.getByText('Speichern'))
    fireEvent.click(screen.getByText('Speichern'))
    await waitFor(() => expect(f.execute).toHaveBeenCalledOnce())
    f.view.unmount()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    act(() => {
      finish({ characterId: 'new', party: initial.party })
    })
    await waitFor(() =>
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    )
    expect(f.select).not.toHaveBeenCalled()
    expect(f.read).toHaveBeenCalledOnce()
  })
  it.each(['save', 'discard'] as const)(
    'retains an absent character draft after unmount for explicit %s',
    async (choice) => {
      const f = fixture()
      f.execute.mockRejectedValueOnce(new Error('lost answer'))
      edit('Neu', 'Retained draft')
      f.select.mockClear()
      fireEvent.click(screen.getByText('Speichern'))
      await waitFor(() =>
        expect(screen.getByText('Speicherstatus erneut prüfen')).toBeVisible()
      )
      const original = f.execute.mock.calls[0]![0]
      f.view.unmount()
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
      beginMaintenance()
      expect(await resolveMaintenance(choice)).toEqual([])
      expect(f.status).toHaveBeenCalledWith(original)
      expect(f.execute).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
      if (choice === 'save') {
        const next = f.execute.mock.calls[1]![0]
        expect(next.commandId).not.toBe(original.commandId)
        expect(next.command).toEqual(original.command)
        expect(f.workspace.snapshot().session?.party.members.at(-1)?.name).toBe(
          'Retained draft'
        )
      }
      expect(f.select).not.toHaveBeenCalled()
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    }
  )

  it.each(['Neu', 'Bearbeiten'])(
    'saves %s centrally and blocks later input',
    async (action) => {
      const f = fixture()
      edit(action, 'Saved name')
      beginMaintenance()
      fireEvent.change(screen.getByLabelText('Charaktername'), {
        target: { value: 'Forbidden' }
      })
      expect(await resolveMaintenance('save')).toEqual([])
      expect(f.execute).toHaveBeenCalledOnce()
      expect(f.execute.mock.calls[0]?.[0].command).toMatchObject({
        kind: action === 'Neu' ? 'create' : 'update',
        input: { character: { name: 'Saved name' }, expectedRevision: 3 }
      })
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
    }
  )
  it.each(['save', 'discard'] as const)(
    'closes unconfirmed deletion on %s without deleting',
    async (choice) => {
      const f = fixture()
      fireEvent.click(screen.getByText('Löschen'))
      expect(
        screen.getByRole('group', { name: 'Löschen bestätigen' })
      ).toBeVisible()
      beginMaintenance()
      expect(await resolveMaintenance(choice)).toEqual([])
      expect(f.execute).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('group', { name: 'Löschen bestätigen' })
      ).not.toBeInTheDocument()
    }
  )
  it('deletes only after explicit confirmation and reconciles a lost answer', async () => {
    const f = fixture()
    const execute = f.execute.getMockImplementation()!
    f.execute.mockImplementation(async (input) => {
      await execute(input)
      throw new CapabilityError('outcome_unknown', true)
    })
    fireEvent.click(screen.getByText('Löschen'))
    fireEvent.click(screen.getByText('Endgültig löschen'))
    await waitFor(() =>
      expect(screen.getByText('Speicherstatus erneut prüfen')).toBeVisible()
    )
    fireEvent.click(screen.getByText('Speicherstatus erneut prüfen'))
    await waitFor(() => expect(f.select).toHaveBeenCalledWith(null))
    expect(f.execute).toHaveBeenCalledOnce()
    expect(f.status).toHaveBeenCalledWith(f.execute.mock.calls[0]?.[0])
  })
  it('keeps validation errors until explicit discard', async () => {
    const f = fixture()
    fireEvent.click(screen.getByText('Neu'))
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(screen.getByLabelText('Charaktername')).toHaveValue('')
    expect(f.execute).not.toHaveBeenCalled()
    expect(await resolveMaintenance('discard')).toEqual([])
  })
  it('keeps failed input and permits discard only after read confirmation of absence', async () => {
    const f = fixture()
    f.execute.mockRejectedValue(new Error('not saved'))
    edit()
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(screen.getByLabelText('Charaktername')).toHaveValue('Draft')
    expect(await resolveMaintenance('discard')).toEqual([])
    expect(f.execute).toHaveBeenCalledOnce()
    expect(f.status).toHaveBeenCalledOnce()
  })
  it('blocks maintenance through repeated failed reads then recovers without replay', async () => {
    const f = fixture()
    const execute = f.execute.getMockImplementation()!
    f.execute.mockImplementation(async (input) => {
      await execute(input)
      throw new Error('lost')
    })
    f.status
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
    edit('Neu', 'Unknown')
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(await resolveMaintenance('discard')).toHaveLength(1)
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(screen.getByLabelText('Charaktername')).toHaveValue('Unknown')
    expect(await resolveMaintenance('discard')).toEqual([])
    expect(f.execute).toHaveBeenCalledOnce()
    expect(f.select).toHaveBeenCalledWith('new')
  })
  it('keeps the form when maintenance is canceled', () => {
    fixture()
    edit()
    beginMaintenance()
    act(() => {
      maintenanceResolution!.release()
      maintenanceResolution = undefined
    })
    expect(screen.getByLabelText('Charaktername')).toHaveValue('Draft')
    expect(screen.getByLabelText('Charaktername')).toBeEnabled()
  })
  it('waits for the existing write and full refresh before discard', async () => {
    const f = fixture()
    let finishRead!: (value: LiveSessionSnapshot) => void
    f.read.mockReturnValue(
      new Promise((resolve) => {
        finishRead = resolve
      })
    )
    edit()
    fireEvent.click(screen.getByText('Speichern'))
    await waitFor(() => expect(f.read).toHaveBeenCalledOnce())
    beginMaintenance()
    const settled = vi.fn()
    let result!: Promise<readonly unknown[]>
    act(() => {
      result = maintenanceResolution!.resolve('discard')
      void result.then(settled)
    })
    expect(settled).not.toHaveBeenCalled()
    await act(async () => {
      finishRead(f.current())
      await result
    })
    expect(await result).toEqual([])
    expect(f.execute).toHaveBeenCalledOnce()
  })
  it('holds a confirmed write after refresh failure and reads later data without resurrecting a deleted character', async () => {
    const f = fixture()
    f.read.mockRejectedValueOnce(new Error('read failed'))
    edit('Neu')
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    f.later({
      ...initial,
      revision: 6,
      party: { ...initial.party, revision: 6, members: [] }
    })
    expect(await resolveMaintenance('save')).toEqual([])
    expect(f.execute).toHaveBeenCalledOnce()
    expect(f.select).toHaveBeenLastCalledWith(null)
    expect(f.workspace.snapshot().session?.party.members).toEqual([])
  })
  it('preserves an absent conflicting draft until explicit discard', async () => {
    const f = fixture()
    f.execute.mockRejectedValue(new Error('lost'))
    edit()
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    f.later({
      ...initial,
      revision: 5,
      party: { ...initial.party, revision: 5 }
    })
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(screen.getByLabelText('Charaktername')).toHaveValue('Draft')
    expect(f.execute).toHaveBeenCalledOnce()
    expect(await resolveMaintenance('discard')).toEqual([])
  })
})

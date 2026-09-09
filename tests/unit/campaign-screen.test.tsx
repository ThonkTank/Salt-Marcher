// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CampaignScreen,
  type CampaignScreenProps
} from '../../src/renderer/features/workspace/campaign-screen.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { CampaignWorkspaceProjection } from '../../src/renderer/capabilities/campaign-workspace-projection.js'
import { useCampaignSessionCoordinator } from '../../src/renderer/features/workspace/use-campaign-session-coordinator.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  compareCampaigns,
  formatCampaignOpenedAt
} from '../../src/renderer/features/workspace/campaign-presentation.js'

const campaign = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Salzmark',
  createdAt: '2026-09-01T10:00:00.000Z',
  lastOpenedAt: '2026-09-08T10:00:00.000Z'
}
type TestActions = {
  create: (name: string) => Promise<boolean>
  activate: (id: string) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  trash: (id: string) => Promise<boolean>
  restore: (id: string) => Promise<boolean>
  deleteForever: (id: string, confirmation: string) => Promise<boolean>
}
function fixture(
  overrides: Partial<CampaignScreenProps & TestActions> = {}
): CampaignScreenProps & TestActions {
  const actions: TestActions = {
    create: overrides.create ?? vi.fn(() => Promise.resolve(true)),
    activate: overrides.activate ?? vi.fn(() => Promise.resolve(true)),
    rename: overrides.rename ?? vi.fn(() => Promise.resolve(true)),
    trash: overrides.trash ?? vi.fn(() => Promise.resolve(true)),
    restore: overrides.restore ?? vi.fn(() => Promise.resolve(true)),
    deleteForever: overrides.deleteForever ?? vi.fn(() => Promise.resolve(true))
  }
  return {
    ...actions,
    begin: (command) => {
      const completion =
        command.kind === 'create'
          ? actions.create(command.name)
          : command.kind === 'activate'
            ? actions.activate(command.id)
            : command.kind === 'rename'
              ? actions.rename(command.id, command.name)
              : command.kind === 'trash'
                ? actions.trash(command.id)
                : command.kind === 'restore'
                  ? actions.restore(command.id)
                  : actions.deleteForever(command.id, command.confirmationName)
      return {
        completion,
        settle: async () => ((await completion) ? 'confirmed' : 'absent')
      }
    },
    snapshot: {
      revision: 1,
      activeCampaignId: campaign.id,
      campaigns: [campaign],
      trashedCampaigns: []
    },
    status: 'ready',
    error: '',
    busy: false,
    sessionRetry: false,
    reconciliationPending: false,
    reconcile: vi.fn(() => Promise.resolve(null)),
    retryCatalog: vi.fn(() => Promise.resolve()),
    retrySession: vi.fn(() => Promise.resolve(true)),
    ...overrides
  }
}
function mount(props: CampaignScreenProps) {
  return render(
    <ModalLayerProvider>
      <CampaignScreen {...props} />
    </ModalLayerProvider>
  )
}
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
})

describe('campaign screen', () => {
  it('is a full screen even with an active campaign and only opens on demand', () => {
    const props = fixture()
    mount(props)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Schließen' })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.activate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark öffnen' }))
    expect(props.activate).toHaveBeenCalledWith(campaign.id)
  })
  it('discards a name draft with X, but trims and saves explicitly', async () => {
    const props = fixture()
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: 'Verworfen' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(props.rename).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Salzmark')
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: '  Neu  ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(props.rename).toHaveBeenCalledWith(campaign.id, 'Neu')
  })
  it('blocks duplicate creates and closing while a command is pending', async () => {
    let finish!: (value: boolean) => void
    const create = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        })
    )
    mount(fixture({ create }))
    fireEvent.click(screen.getByRole('button', { name: '+ Neue Kampagne' }))
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: 'Neu' }
    })
    const button = screen.getByRole('button', { name: 'Erstellen & öffnen' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(create).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeDisabled()
    finish(false)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ergebnis prüfen' })
    )
    await waitFor(() => expect(button).not.toBeDisabled())
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Neu')
  })
  it('moves a campaign to trash from editing', async () => {
    const props = fixture()
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    fireEvent.click(screen.getByRole('button', { name: 'In den Papierkorb' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(props.trash).toHaveBeenCalledWith(campaign.id)
  })
  it('restores without activating and requires exact confirmation to delete', async () => {
    const props = fixture({
      snapshot: {
        revision: 2,
        activeCampaignId: null,
        campaigns: [],
        trashedCampaigns: [{ ...campaign, trashedAt: campaign.createdAt }]
      }
    })
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Papierkorb (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }))
    await waitFor(() => expect(props.restore).toHaveBeenCalledWith(campaign.id))
    expect(props.activate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Papierkorb' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Löschen …' }))
    const input = screen.getByLabelText('Kampagnenname zur Bestätigung')
    const button = screen.getByRole('button', { name: 'Endgültig löschen' })
    fireEvent.change(input, { target: { value: 'salzmark' } })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Salzmark' } })
    fireEvent.click(button)
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Papierkorb' })).toBeVisible()
    )
    expect(props.deleteForever).toHaveBeenCalledWith(campaign.id, 'Salzmark')
  })
  it('distinguishes a failed read from an empty catalog', () => {
    const props = fixture({ status: 'failure', error: 'Lesen fehlgeschlagen' })
    mount(props)
    expect(
      screen.queryByRole('button', { name: '+ Neue Kampagne' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(props.retryCatalog).toHaveBeenCalledOnce()
  })
  it('shows an empty trash popup with a uniform close control', () => {
    mount(fixture())
    fireEvent.click(screen.getByRole('button', { name: 'Papierkorb (0)' }))
    const popup = screen.getByRole('dialog')
    expect(within(popup).getByText('Der Papierkorb ist leer.')).toBeVisible()
    fireEvent.click(within(popup).getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
describe('campaign presentation', () => {
  it('orders known usage ahead of unknown and breaks ties by creation and identity', () => {
    const unknown = { ...campaign, id: 'a', lastOpenedAt: null }
    const newer = { ...unknown, id: 'b', createdAt: '2026-09-05T00:00:00.000Z' }
    expect(
      [unknown, newer, campaign].sort(compareCampaigns).map((c) => c.id)
    ).toEqual([campaign.id, 'b', 'a'])
  })
  it('uses calendar days rather than 24-hour offsets and handles unknown usage', () => {
    const now = new Date(2026, 8, 8, 0, 10)
    expect(
      formatCampaignOpenedAt(new Date(2026, 8, 7, 23, 50).toISOString(), now)
    ).toContain('gestern, 23:50')
    expect(formatCampaignOpenedAt(null, now)).toBe('Letzte Öffnung unbekannt')
  })
})

function beginMaintenance() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
async function resolveMaintenance(choice: 'save' | 'discard') {
  let failures!: Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
  await act(async () => {
    failures = await resolution!.resolve(choice)
  })
  return failures
}
function enterName(action = 'Salzmark bearbeiten') {
  fireEvent.click(screen.getByRole('button', { name: action }))
  fireEvent.change(screen.getByLabelText('Kampagnenname'), {
    target: { value: 'Retained name' }
  })
}
describe('campaign dialog maintenance', () => {
  it.each(['+ Neue Kampagne', 'Salzmark bearbeiten'])(
    'saves %s through the explicit maintenance path',
    async (action) => {
      const props = fixture()
      const begin = vi.fn(props.begin)
      mount({ ...props, begin })
      enterName(action)
      beginMaintenance()
      expect(screen.getByLabelText('Kampagnenname')).toBeDisabled()
      fireEvent.change(screen.getByLabelText('Kampagnenname'), {
        target: { value: 'Forbidden' }
      })
      expect(await resolveMaintenance('save')).toEqual([])
      expect(begin).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: action.startsWith('+') ? 'create' : 'rename',
          name: 'Retained name'
        }),
        true
      )
      expect(begin).toHaveBeenCalledOnce()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
  )
  it.each(['save', 'discard'] as const)(
    'never submits an unconfirmed permanent deletion on central %s',
    async (choice) => {
      const props = fixture({
        snapshot: {
          revision: 1,
          activeCampaignId: null,
          campaigns: [],
          trashedCampaigns: [
            { ...campaign, trashedAt: '2026-09-01T12:00:00.000Z' }
          ]
        }
      })
      mount(props)
      fireEvent.click(screen.getByRole('button', { name: 'Papierkorb (1)' }))
      fireEvent.click(screen.getByRole('button', { name: 'Löschen …' }))
      fireEvent.change(screen.getByLabelText('Kampagnenname zur Bestätigung'), {
        target: { value: campaign.name }
      })
      beginMaintenance()
      expect(await resolveMaintenance(choice)).toEqual([])
      expect(props.deleteForever).not.toHaveBeenCalled()
      expect(props.restore).not.toHaveBeenCalled()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    }
  )
  it('keeps an invalid new name until explicit discard', async () => {
    const props = fixture()
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: '+ Neue Kampagne' }))
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('')
    expect(props.create).not.toHaveBeenCalled()
    expect(await resolveMaintenance('discard')).toEqual([])
  })
  it('keeps the name and unlocks it when maintenance is canceled', () => {
    mount(fixture())
    enterName()
    beginMaintenance()
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Retained name')
    expect(screen.getByLabelText('Kampagnenname')).toBeEnabled()
  })
  it.each(['removed', 'renamed'])(
    'preserves the original edit when its campaign is %s',
    async (change) => {
      const props = fixture()
      const view = mount(props)
      enterName()
      view.rerender(
        <ModalLayerProvider>
          <CampaignScreen
            {...props}
            snapshot={{
              ...props.snapshot,
              revision: 2,
              campaigns:
                change === 'removed'
                  ? []
                  : [{ ...campaign, name: 'Changed elsewhere' }]
            }}
          />
        </ModalLayerProvider>
      )
      expect(screen.getByLabelText('Kampagnenname')).toHaveValue(
        'Retained name'
      )
      beginMaintenance()
      expect(await resolveMaintenance('save')).toHaveLength(1)
      expect(screen.getByRole('alert')).toHaveTextContent(
        'inzwischen geändert oder entfernt'
      )
      expect(props.create).not.toHaveBeenCalled()
      expect(props.rename).not.toHaveBeenCalled()
      expect(await resolveMaintenance('discard')).toEqual([])
    }
  )
  it('uses an already centrally confirmed original handle without repeating create', async () => {
    const settle = vi.fn(() => Promise.resolve('confirmed' as const))
    const begin = vi.fn<CampaignScreenProps['begin']>(() => ({
      completion: Promise.resolve(false),
      settle
    }))
    mount(fixture({ begin }))
    enterName('+ Neue Kampagne')
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen & öffnen' }))
    await screen.findByRole('button', { name: 'Ergebnis prüfen' })
    beginMaintenance()
    expect(await resolveMaintenance('save')).toEqual([])
    expect(begin).toHaveBeenCalledOnce()
    expect(settle).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('holds the draft through repeated pending reads until confirmed', async () => {
    let status: 'pending' | 'confirmed' = 'pending'
    const settle = vi.fn(() => Promise.resolve(status))
    const begin = vi.fn<CampaignScreenProps['begin']>(() => ({
      completion: Promise.resolve(false),
      settle
    }))
    mount(fixture({ begin }))
    enterName()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByRole('button', { name: 'Ergebnis prüfen' })
    beginMaintenance()
    expect(await resolveMaintenance('save')).toHaveLength(1)
    expect(await resolveMaintenance('discard')).toHaveLength(1)
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Retained name')
    status = 'confirmed'
    expect(await resolveMaintenance('discard')).toEqual([])
    expect(begin).toHaveBeenCalledOnce()
  })
  it.each(['save', 'discard'] as const)(
    'retains an absent name draft for explicit %s',
    async (choice) => {
      const begin = vi
        .fn<CampaignScreenProps['begin']>()
        .mockReturnValueOnce({
          completion: Promise.resolve(false),
          settle: () => Promise.resolve('absent')
        })
        .mockReturnValue({
          completion: Promise.resolve(true),
          settle: () => Promise.resolve('confirmed')
        })
      mount(fixture({ begin }))
      enterName()
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
      await screen.findByRole('button', { name: 'Ergebnis prüfen' })
      beginMaintenance()
      expect(await resolveMaintenance(choice)).toEqual([])
      expect(begin).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
      if (choice === 'save')
        expect(begin.mock.calls[1]?.[0]).toEqual({
          kind: 'rename',
          id: campaign.id,
          name: 'Retained name'
        })
    }
  )
  it('waits for the original pending completion before central discard', async () => {
    let finish!: (value: boolean) => void
    const completion = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const begin = vi.fn<CampaignScreenProps['begin']>(() => ({
      completion,
      settle: () => Promise.resolve('confirmed')
    }))
    mount(fixture({ begin }))
    enterName()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    beginMaintenance()
    const done = vi.fn()
    let resolving!: Promise<readonly unknown[]>
    act(() => {
      resolving = resolution!.resolve('discard')
      void resolving.then(done)
    })
    expect(done).not.toHaveBeenCalled()
    await act(async () => {
      finish(true)
      await resolving
    })
    expect(await resolving).toEqual([])
    expect(begin).toHaveBeenCalledOnce()
  })
})
it('coordinates real projection recovery before closing the original create dialog without another create', async () => {
  let campaigns = {
    revision: 1,
    activeCampaignId: campaign.id,
    campaigns: [campaign],
    trashedCampaigns: []
  }
  const createdId = '00000000-0000-4000-8000-000000000002'
  const create = vi.fn(
    (input: Parameters<SaltMarcherApi['campaigns']['create']>[0]) => {
      campaigns = {
        ...campaigns,
        revision: 2,
        activeCampaignId: createdId,
        campaigns: [
          ...campaigns.campaigns,
          { ...campaign, id: createdId, name: input.name }
        ]
      }
      return Promise.resolve({
        kind: 'created' as const,
        campaignId: createdId,
        commandId: input.commandId,
        snapshot: campaigns
      })
    }
  )
  const read = vi
    .fn()
    .mockRejectedValueOnce(new Error('session unavailable'))
    .mockRejectedValueOnce(new Error('still unavailable'))
    .mockResolvedValue({ revision: 1 })
  const api = {
    campaigns: { list: () => Promise.resolve(campaigns), create },
    session: { read, onChanged: () => () => {} }
  } as unknown as SaltMarcherApi
  const projection = new CampaignWorkspaceProjection(api)
  const context = {
    api,
    campaignWorkspace: projection
  } as CapabilityContextValue
  function Harness() {
    const coordinator = useCampaignSessionCoordinator(vi.fn())
    return (
      <CampaignScreen
        snapshot={coordinator.campaigns}
        status={coordinator.catalogStatus}
        error={coordinator.error}
        busy={coordinator.busy}
        sessionRetry={coordinator.sessionRetry}
        retryCatalog={coordinator.retryCatalog}
        retrySession={coordinator.retrySession}
        begin={coordinator.beginCampaignAction}
        maintenanceDependencyId={coordinator.campaignMaintenanceId}
        reconciliationPending={coordinator.campaignReconciliationPending}
        reconcile={coordinator.reconcileCampaign}
      />
    )
  }
  render(
    <CapabilityContext.Provider value={context}>
      <ModalLayerProvider>
        <Harness />
      </ModalLayerProvider>
    </CapabilityContext.Provider>
  )
  await screen.findByRole('button', { name: '+ Neue Kampagne' })
  enterName('+ Neue Kampagne')
  fireEvent.click(screen.getByRole('button', { name: 'Erstellen & öffnen' }))
  await screen.findByRole('button', { name: 'Ergebnis prüfen' })
  expect(create).toHaveBeenCalledOnce()
  beginMaintenance()
  expect(await resolveMaintenance('save')).toHaveLength(2)
  expect(read).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Retained name')
  expect(await resolveMaintenance('save')).toEqual([])
  expect(create).toHaveBeenCalledOnce()
  expect(read).toHaveBeenCalledTimes(3)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  projection.dispose()
})
it('retains the draft after a thrown read error and permits a later read retry', async () => {
  const settle = vi
    .fn<() => Promise<'confirmed'>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('confirmed')
  const begin = vi.fn<CampaignScreenProps['begin']>(() => ({
    completion: Promise.resolve(false),
    settle
  }))
  mount(fixture({ begin }))
  enterName()
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ergebnis prüfen' })
  )
  await waitFor(() => expect(screen.getByRole('alert')).toBeVisible())
  expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Retained name')
  fireEvent.click(screen.getByRole('button', { name: 'Ergebnis prüfen' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(begin).toHaveBeenCalledOnce()
})
it('closes an unchanged rename during maintenance without writing', async () => {
  const props = fixture()
  mount(props)
  fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
  beginMaintenance()
  expect(await resolveMaintenance('save')).toEqual([])
  expect(props.rename).not.toHaveBeenCalled()
})
it('keeps a newer independent name draft when general recovery confirms an older create', async () => {
  const reconcile = vi.fn<CampaignScreenProps['reconcile']>(() =>
    Promise.resolve({
      kind: 'created',
      commandId: 'older-command',
      campaignId: campaign.id,
      snapshot: {
        revision: 1,
        activeCampaignId: campaign.id,
        campaigns: [campaign],
        trashedCampaigns: []
      }
    })
  )
  const props = fixture({ reconcile })
  const view = mount(props)
  enterName('+ Neue Kampagne')
  view.rerender(
    <ModalLayerProvider>
      <CampaignScreen {...props} reconciliationPending />
    </ModalLayerProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ergebnis prüfen' }))
  expect(
    await screen.findByText('Der Kampagnenbefehl wurde geklärt.')
  ).toBeVisible()
  expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Retained name')
  expect(screen.getByRole('dialog', { name: 'Neue Kampagne' })).toBeVisible()
  expect(reconcile).toHaveBeenCalledWith(true)
  expect(props.create).not.toHaveBeenCalled()
})

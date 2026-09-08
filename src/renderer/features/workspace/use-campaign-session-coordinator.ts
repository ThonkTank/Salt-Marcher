import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CampaignCommandReceipt } from '../../../shared/contracts/campaign.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { CampaignReconciliationPendingError } from '../../capabilities/campaign-workspace-projection.js'
import {
  hasMaintenanceDrafts,
  useMaintenanceDraft
} from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { message } from '../../i18n/campaign-menu-runtime.de.js'
import type { WorkspaceId } from './workspace-definition.js'

export function useCampaignSessionCoordinator(
  reportError: (message: string) => void,
  enabled = true
) {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const projection = context.campaignWorkspace
  const root = useSyncExternalStore(
    projection.subscribe,
    projection.snapshot,
    projection.snapshot
  )
  const [screen, setScreen] = useState<'campaigns' | 'workspace'>('campaigns')
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceId>('session')
  const [catalogStatus, setCatalogStatus] = useState<
    'loading' | 'ready' | 'failure'
  >('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const running = useRef<Promise<boolean> | null>(null)
  const pendingEntry = useRef<string | null>(null)
  const [sessionRetry, setSessionRetry] = useState(false)

  const load = useCallback(async () => {
    setCatalogStatus('loading')
    setError('')
    const outcome = await projection.load(false)
    if (outcome.status === 'ready') setCatalogStatus('ready')
    else if (outcome.status === 'failure') {
      setCatalogStatus('failure')
      setError(capabilityErrorText(outcome.cause))
    }
  }, [projection])

  useEffect(() => {
    if (enabled) void Promise.resolve().then(load)
  }, [enabled, load])

  function run(
    operation: () => Promise<void>,
    recovery = false
  ): Promise<boolean> {
    if (
      running.current ||
      (!recovery &&
        (pendingEntry.current ||
          projection.snapshot().reconciliationCommandId ||
          maintenanceDraftCoordinator.isLocked()))
    )
      return Promise.resolve(false)
    setBusy(true)
    setError('')
    const request = Promise.resolve()
      .then(operation)
      .then(() => true)
      .catch((cause: unknown) => {
        if (!(cause instanceof CampaignReconciliationPendingError))
          setError(capabilityErrorText(cause))
        return false
      })
      .finally(() => {
        running.current = null
        setBusy(false)
      })
    running.current = request
    return request
  }

  async function enterSession(): Promise<void> {
    const campaignId =
      pendingEntry.current ?? projection.snapshot().campaigns.activeCampaignId
    if (!campaignId) throw new CapabilityError('stale', false)
    pendingEntry.current = campaignId
    setSessionRetry(true)
    if (projection.snapshot().campaigns.activeCampaignId !== campaignId)
      throw new CapabilityError('stale', false)
    const outcome = await projection.refreshActiveSession()
    if (outcome.status === 'failure') throw outcome.cause
    if (
      outcome.status !== 'ready' ||
      !outcome.value.session ||
      outcome.value.sessionCampaignId !== campaignId ||
      outcome.value.campaigns.activeCampaignId !== campaignId ||
      projection.snapshot().campaigns.activeCampaignId !== campaignId
    )
      throw new CapabilityError('stale', false)
    pendingEntry.current = null
    setSessionRetry(false)
    if (!maintenanceDraftCoordinator.isLocked()) {
      setWorkspace('session')
      setScreen('workspace')
      setCampaignMenuOpen(false)
    }
  }

  async function reconcile(): Promise<CampaignCommandReceipt | null> {
    let accepted: CampaignCommandReceipt | null = null
    const complete = await run(async () => {
      accepted = await projection.reconcilePendingCommand()
      if (accepted.kind === 'created' || accepted.kind === 'activated') {
        pendingEntry.current = accepted.campaignId
        await enterSession()
      }
    }, true)
    return complete ? accepted : null
  }

  async function settle(): Promise<boolean> {
    await running.current
    if (projection.snapshot().reconciliationCommandId) {
      await reconcile()
      return (
        !projection.snapshot().reconciliationCommandId && !pendingEntry.current
      )
    }
    if (pendingEntry.current) return run(enterSession, true)
    return true
  }
  const maintenanceBlocked = useMaintenanceDraft({
    label: 'Kampagnenwechsel',
    isDirty: () =>
      Boolean(
        running.current ||
        pendingEntry.current ||
        projection.snapshot().reconciliationCommandId
      ),
    save: settle,
    discard: settle
  })

  const activeCampaignId = root.campaigns.activeCampaignId
  return {
    campaigns: root.campaigns,
    sessionCampaignId: root.sessionCampaignId,
    session: root.session,
    screen,
    catalogStatus,
    error,
    busy: busy || maintenanceBlocked,
    sessionRetry,
    retryCatalog: load,
    retrySession: () => run(enterSession, true),
    showCampaigns: () => {
      if (screen === 'workspace' && hasMaintenanceDrafts()) {
        reportError(message('campaign.unsavedWorkspace'))
        return
      }
      setScreen('campaigns')
      setCampaignMenuOpen(false)
    },
    setSession: (
      update:
        | LiveSessionSnapshot
        | ((current: LiveSessionSnapshot | null) => LiveSessionSnapshot | null)
    ) => {
      if (!activeCampaignId) return
      if (typeof update === 'function') {
        projection.publishSession(
          activeCampaignId,
          (current) => update(current) ?? current
        )
        return
      }
      projection.publishSession(activeCampaignId, update)
    },
    campaignMenuOpen,
    setCampaignMenuOpen,
    workspace,
    setWorkspace,
    campaignReconciliationPending: root.reconciliationCommandId !== null,
    reconcileCampaign: reconcile,
    createCampaign: (name: string) =>
      run(async () => {
        const created = await projection.createCampaign(name.trim())
        pendingEntry.current = created.activeCampaignId
        await enterSession()
      }),
    switchCampaign: (id: string) =>
      run(async () => {
        await projection.activateCampaign(id)
        pendingEntry.current = id
        await enterSession()
      }),
    renameCampaign: (id: string, name: string) =>
      run(async () => {
        await projection.renameCampaign(id, name.trim())
      }),
    trashCampaign: (id: string) =>
      run(async () => {
        const next = await projection.trashCampaign(id)
        if (next.activeCampaignId === null) {
          setScreen('campaigns')
          setSessionRetry(false)
        }
      }),
    restoreCampaign: (id: string) =>
      run(async () => {
        await projection.restoreCampaign(id)
      }),
    deleteCampaignForever: (id: string, confirmationName: string) =>
      run(async () => {
        await projection.deleteCampaignForever(id, confirmationName)
      })
  }
}
